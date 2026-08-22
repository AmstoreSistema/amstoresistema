import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const exportSystemData = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    tables: z.array(z.string()),
    onProgress: z.function().args(z.string(), z.number()).optional()
  }).parse(data))
  .handler(async ({ data: { tables } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const exportData: Record<string, any> = {};
    
    for (const table of tables) {
      const { data, error } = await supabaseAdmin.from(table as any).select("*");
      if (error) console.error(`Error exporting ${table}:`, error);
      exportData[table] = data || [];
    }
    
    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: exportData
    };
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Remove valores indefinidos e IDs externos inválidos (não-UUID) que quebram as FKs. */
function sanitizeRow(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if ((key === "id" || key.endsWith("_id")) && typeof value === "string" && !UUID_RE.test(value)) continue;
    out[key] = value;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const importSystemData = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    payload: z.any(),
    tables: z.array(z.string()).optional(),
    isBase44: z.boolean().optional(),
  }).parse(data))
  .handler(async ({ data: { payload, tables: selectedTables } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mapForeignBackup, IMPORT_ORDER } = await import("@/lib/backup-mapping");

    const isNative = !!payload?.data && !!payload?.version;
    let dataToImport: Record<string, any[]> = {};

    if (isNative) {
      dataToImport = selectedTables
        ? Object.fromEntries(
            Object.entries(payload.data).filter(([table]) => selectedTables.includes(table)),
          )
        : payload.data;
    } else {
      dataToImport = mapForeignBackup(payload);
      if (selectedTables) {
        dataToImport = Object.fromEntries(
          Object.entries(dataToImport).filter(([table]) => selectedTables.includes(table)),
        );
      }
      if (Object.keys(dataToImport).length === 0) {
        console.warn("[Import] Nenhuma coleção mapeada para as tabelas internas.", {
          payloadKeys: Object.keys(payload || {}),
          selectedTables,
        });
      }
    }

    const results: Record<string, { inserted: number; updated: number; failed: number; error?: string }> = {};
    const orderedTables = Object.keys(dataToImport).sort(
      (a, b) =>
        (IMPORT_ORDER.indexOf(a) === -1 ? 99 : IMPORT_ORDER.indexOf(a)) -
        (IMPORT_ORDER.indexOf(b) === -1 ? 99 : IMPORT_ORDER.indexOf(b)),
    );

    // Chave natural usada para deduplicar (não depende de índices únicos no banco)
    const NATURAL_KEY: Record<string, string[]> = {
      clients: ["name"],
      products: ["sku", "name"],
      suppliers: ["name"],
      materials: ["sku", "name"],
      material_categories: ["name"],
      financial_accounts: ["name"],
      units_of_measure: ["name"],
      promotions: ["name"],
      app_settings: ["key"],
    };

    for (const table of orderedTables) {
      const rawRows = dataToImport[table];
      if (!Array.isArray(rawRows)) continue;

      const rows = rawRows.filter((r) => r && typeof r === "object").map(sanitizeRow);
      const res = { inserted: 0, updated: 0, failed: 0 } as {
        inserted: number; updated: number; failed: number; error?: string;
      };

      if (rows.length === 0) {
        results[table] = res;
        continue;
      }

      const keys = NATURAL_KEY[table];
      const toInsert: Record<string, any>[] = [];
      const toUpdate: { id: string; row: Record<string, any> }[] = [];

      if (keys) {
        // Carrega registros existentes e monta índices por chave natural
        const { data: existing } = await supabaseAdmin
          .from(table as any)
          .select(["id", ...keys].join(","))
          .limit(20000);

        const indexes: Record<string, Map<string, string>> = {};
        for (const k of keys) indexes[k] = new Map();
        for (const ex of (existing as any[]) || []) {
          for (const k of keys) {
            const v = ex?.[k];
            if (v !== null && v !== undefined && String(v).trim() !== "") {
              indexes[k]!.set(String(v).trim().toLowerCase(), ex.id ?? String(v));
            }
          }
        }

        const seen: Record<string, Set<string>> = {};
        for (const k of keys) seen[k] = new Set();

        for (const row of rows) {
          let matchedId: string | undefined;
          let duplicateInFile = false;
          for (const k of keys) {
            const v = row[k];
            if (v === null || v === undefined || String(v).trim() === "") continue;
            const norm = String(v).trim().toLowerCase();
            if (seen[k]!.has(norm)) { duplicateInFile = true; break; }
            const hit = indexes[k]!.get(norm);
            if (hit) { matchedId = hit; break; }
          }
          if (duplicateInFile) continue;
          for (const k of keys) {
            const v = row[k];
            if (v !== null && v !== undefined && String(v).trim() !== "") seen[k]!.add(String(v).trim().toLowerCase());
          }
          if (matchedId) toUpdate.push({ id: matchedId, row });
          else toInsert.push(row);
        }
      } else {
        toInsert.push(...rows);
      }

      // Inserções em lotes, com fallback linha a linha
      for (const batch of chunk(toInsert, 200)) {
        const { error } = await supabaseAdmin.from(table as any).insert(batch);
        if (!error) {
          res.inserted += batch.length;
          continue;
        }
        for (const row of batch) {
          const { error: rowError } = await supabaseAdmin.from(table as any).insert(row);
          if (rowError) {
            res.failed += 1;
            res.error = res.error ?? rowError.message;
          } else {
            res.inserted += 1;
          }
        }
      }

      // Atualizações dos registros já existentes (evita duplicidade)
      for (const { id, row } of toUpdate) {
        const patch = { ...row };
        delete patch["id"];
        delete patch["created_at"];
        const pkColumn = table === "app_settings" ? "key" : "id";
        const { error } = await supabaseAdmin.from(table as any).update(patch).eq(pkColumn, id);
        if (error) {
          res.failed += 1;
          res.error = res.error ?? error.message;
        } else {
          res.updated += 1;
        }
      }

      results[table] = res;
    }

    const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
    const totalUpdated = Object.values(results).reduce((s, r) => s + r.updated, 0);
    const totalFailed = Object.values(results).reduce((s, r) => s + r.failed, 0);

    if (totalInserted === 0 && totalUpdated === 0 && totalFailed > 0) {
      const firstError = Object.values(results).find((r) => r.error)?.error;
      throw new Error(
        `Nenhum registro pôde ser restaurado.${firstError ? ` Motivo: ${firstError}` : ""}`,
      );
    }

    return {
      success: true,
      results,
      totalInserted,
      totalUpdated,
      totalFailed,
      format: isNative ? "amstore" : "externo",
    };
  });


export const inspectBackupFile = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ payload: z.any() }).parse(data))
  .handler(async ({ data: { payload } }) => {
    const { mapForeignBackup, unrecognizedCollections, extractAllCollections, TABLE_ALIASES } = await import("@/lib/backup-mapping");
    
    // Log para depuração de backups Base44 / Externos
    console.log("[Backup Inspect] Payload recebido:", JSON.stringify(payload, null, 2));

    if (payload?.data && payload?.version) {
      return {
        format: "amstore" as const,
        collections: Object.fromEntries(
          Object.entries(payload.data as Record<string, any[]>).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.length : 0,
          ]),
        ),
        skipped: {} as Record<string, number>,
      };
    }
    const rawCollections = extractAllCollections(payload);
    
    return {
      format: "externo" as const,
      collections: Object.fromEntries(
        Object.entries(rawCollections).map(([k, v]) => {
          const rows = v as any[];
          const target = TABLE_ALIASES[k.toLowerCase().replace(/[^a-z0-9]/g, "")];
          return [target || k, rows.length];
        })
      ),
      skipped: unrecognizedCollections(payload),
    };
  });