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
      // Backup externo (Base44 ou qualquer JSON com coleções de registros)
      dataToImport = mapForeignBackup(payload);
      if (selectedTables) {
        dataToImport = Object.fromEntries(
          Object.entries(dataToImport).filter(([table]) => selectedTables.includes(table)),
        );
      }
      if (Object.keys(dataToImport).length === 0) {
        // Log para ajudar a entender por que não houve mapeamento
        console.warn("[Import] Nenhuma coleção mapeada para as tabelas internas.", { 
          payloadKeys: Object.keys(payload || {}),
          selectedTables 
        });
      }
    }

    const results: Record<string, { inserted: number; updated: number; failed: number; error?: string }> = {};
    const orderedTables = Object.keys(dataToImport).sort(
      (a, b) =>
        (IMPORT_ORDER.indexOf(a) === -1 ? 99 : IMPORT_ORDER.indexOf(a)) -
        (IMPORT_ORDER.indexOf(b) === -1 ? 99 : IMPORT_ORDER.indexOf(b)),
    );

    // Chaves de conflito para evitar duplicidade em backups externos
    const CONFLICT_KEYS: Record<string, string> = {
      clients: "name",
      products: "sku",
      suppliers: "name",
      materials: "name",
      material_categories: "name",
      financial_accounts: "name",
      units_of_measure: "name",
      promotions: "name",
    };

    for (const table of orderedTables) {
      const rows = dataToImport[table];
      if (!Array.isArray(rows)) continue;
      // Permite que a importação prossiga mesmo se o array estiver vazio,
      // mas pulamos a parte de inserção no banco se não houver registros.
      if (rows.length === 0) {
        results[table] = { inserted: 0, updated: 0, failed: 0 };
        continue;
      }

      const res = { inserted: 0, updated: 0, failed: 0 } as { inserted: number; updated: number; failed: number; error?: string };
      const onConflict = CONFLICT_KEYS[table];

      // Tenta upsert se houver chave de conflito, senão insert normal
      const { data, error: bulkError } = await (onConflict 
        ? supabaseAdmin.from(table as any).upsert(rows, { onConflict, ignoreDuplicates: false })
        : supabaseAdmin.from(table as any).insert(rows)
      ).select("id");

      if (!bulkError) {
        res.inserted = rows.length;
      } else {
        // Fallback linha por linha se o lote falhar
        for (const row of rows) {
          try {
            const { error } = await (onConflict
              ? supabaseAdmin.from(table as any).upsert(row, { onConflict, ignoreDuplicates: false })
              : supabaseAdmin.from(table as any).insert(row)
            );
            
            if (error) {
              res.failed += 1;
              res.error = res.error ?? error.message;
            } else {
              res.inserted += 1;
            }
          } catch (e: any) {
            res.failed += 1;
            res.error = res.error ?? e.message;
          }
        }
      }
      results[table] = res;
    }

    const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
    const totalFailed = Object.values(results).reduce((s, r) => s + r.failed, 0);

    if (totalInserted === 0 && totalFailed > 0) {
      const firstError = Object.values(results).find((r) => r.error)?.error;
      throw new Error(
        `Nenhum registro pôde ser restaurado.${firstError ? ` Motivo: ${firstError}` : ""}`,
      );
    }

    return { success: true, results, totalInserted, totalFailed, format: isNative ? "amstore" : "externo" };
  });

export const inspectBackupFile = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ payload: z.any() }).parse(data))
  .handler(async ({ data: { payload } }) => {
    const { mapForeignBackup, unrecognizedCollections } = await import("@/lib/backup-mapping");
    
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
    const mapped = mapForeignBackup(payload);
    const rawCollections = extractAllCollections(payload);
    
    return {
      format: "externo" as const,
      collections: Object.fromEntries(
        Object.entries(rawCollections).map(([k, v]) => {
          // Se a chave for reconhecida, usamos o nome da tabela destino no count
          const target = TABLE_ALIASES[k.toLowerCase().replace(/[^a-z0-9]/g, "")];
          return [target || k, v.length];
        })
      ),
      skipped: unrecognizedCollections(payload),
    };
  });