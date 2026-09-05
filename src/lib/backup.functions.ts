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
function sanitizeRow(row: Record<string, any>, keepRawIds = false) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    if (
      !keepRawIds &&
      (key === "id" || key.endsWith("_id")) &&
      typeof value === "string" &&
      !UUID_RE.test(value)
    )
      continue;
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
    const { mapForeignBackup, IMPORT_ORDER, MIRROR_TABLES } = await import("@/lib/backup-mapping");

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
      sales: ["sale_code"],
    };

    // ---- Resolução de vínculos (IDs externos não existem no nosso banco) ----
    const lookupCache: Record<string, Map<string, string>> = {};
    const norm = (v: any) => String(v ?? "").trim().toLowerCase();

    async function lookup(table: string, column: string) {
      const cacheKey = `${table}.${column}`;
      const cached = lookupCache[cacheKey];
      if (cached) return cached;
      const map = new Map<string, string>();
      const { data } = await supabaseAdmin
        .from(table as any)
        .select(`id,${column}`)
        .limit(50000);
      for (const row of (data as any[]) || []) {
        const key = norm(row?.[column]);
        if (key && !map.has(key)) map.set(key, row.id);
      }
      lookupCache[cacheKey] = map;
      return map;
    }

    async function resolveRefs(table: string, rows: Record<string, any>[]) {
      const needs = rows.some((r) =>
        Object.keys(r).some((k) => k.startsWith("__")),
      );
      if (!needs) return rows;

      const clientMap = await lookup("clients", "name");
      const accountMap = table === "transactions" ? await lookup("financial_accounts", "name") : null;
      const supplierMap = table === "transactions" ? await lookup("suppliers", "name") : null;
      const productMap =
        table === "stock_products" || table === "sale_items" ? await lookup("products", "name") : null;
      const saleMap =
        table === "sale_items" || table === "sale_payments" || table === "sale_installments"
          ? await lookup("sales", "sale_code")
          : null;

      const out: Record<string, any>[] = [];
      for (const row of rows) {
        const clientName = row["__client_name"];
        const productName = row["__product_name"];
        const supplierName = row["__supplier_name"];
        const accountName = row["__account_name"];
        const saleCode = row["__sale_code"];
        for (const key of Object.keys(row)) if (key.startsWith("__")) delete row[key];

        if (clientName && !row["client_id"]) row["client_id"] = clientMap.get(norm(clientName)) ?? null;
        if (accountMap && accountName && !row["account_id"])
          row["account_id"] = accountMap.get(norm(accountName)) ?? null;
        if (supplierMap && supplierName && !row["supplier_id"])
          row["supplier_id"] = supplierMap.get(norm(supplierName)) ?? null;
        if (productMap && productName && !row["produto_id"] && table === "stock_products")
          row["produto_id"] = productMap.get(norm(productName)) ?? null;
        if (productMap && productName && !row["product_id"] && table === "sale_items")
          row["product_id"] = productMap.get(norm(productName)) ?? null;

        if (saleMap) {
          const saleId = row["sale_id"] ?? (saleCode ? saleMap.get(norm(saleCode)) : undefined);
          if (!saleId) continue; // sem venda vinculada o registro é inválido
          row["sale_id"] = saleId;
        }
        out.push(row);
      }
      return out;
    }

    for (const table of orderedTables) {
      const rawRows = dataToImport[table];
      if (!Array.isArray(rawRows)) continue;

      const keepRawIds = MIRROR_TABLES.includes(table);
      let rows = rawRows.filter((r) => r && typeof r === "object").map((r) => sanitizeRow(r, keepRawIds));
      const res = { inserted: 0, updated: 0, failed: 0 } as {
        inserted: number; updated: number; failed: number; error?: string;
      };

      rows = await resolveRefs(table, rows);

      if (rows.length === 0) {
        results[table] = res;
        continue;
      }


      const keys = NATURAL_KEY[table];
      const toInsert: Record<string, any>[] = [];
      const toUpdate: { id: string; row: Record<string, any> }[] = [];

      // 1) Registros que já trazem chave primária: upsert (atualiza para a versão do backup)
      const pkColumnForTable = table === "app_settings" ? "key" : "id";
      const withPk: Record<string, any>[] = [];
      const withoutPk: Record<string, any>[] = [];
      const seenPk = new Set<string>();
      for (const row of rows) {
        const pk = row[pkColumnForTable];
        if (pk !== null && pk !== undefined && String(pk).trim() !== "") {
          const norm = String(pk).trim().toLowerCase();
          if (seenPk.has(norm)) continue; // duplicado dentro do próprio arquivo
          seenPk.add(norm);
          withPk.push(row);
        } else {
          withoutPk.push(row);
        }
      }

      for (const batch of chunk(withPk, 200)) {
        const { error } = await supabaseAdmin
          .from(table as any)
          .upsert(batch, { onConflict: pkColumnForTable });
        if (!error) {
          res.updated += batch.length;
          continue;
        }
        for (const row of batch) {
          const { error: rowError } = await supabaseAdmin
            .from(table as any)
            .upsert(row, { onConflict: pkColumnForTable });
          if (rowError) {
            res.failed += 1;
            res.error = res.error ?? rowError.message;
          } else {
            res.updated += 1;
          }
        }
      }

      rows = withoutPk;

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

      console.log(`[Import] ${table}`, JSON.stringify(res));
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
    const { mapForeignBackup, unrecognizedCollections, extractAllCollections, TABLE_ALIASES, IGNORED_TABLE } = await import("@/lib/backup-mapping");

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

    // Contagem final considerando o que realmente será importado após o mapeamento
    const mapped = mapForeignBackup(payload);
    const rawCollections = extractAllCollections(payload);
    const collections: Record<string, number> = {};

    for (const [key, rows] of Object.entries(rawCollections)) {
      const target = TABLE_ALIASES[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
      if (target === IGNORED_TABLE) continue;
      const name = target || key;
      const mappedRows = mapped[name];
      collections[name] = Math.max(
        collections[name] ?? 0,
        Array.isArray(mappedRows) ? mappedRows.length : (rows as any[]).length,
      );
    }

    return {
      format: "externo" as const,
      collections,
      skipped: unrecognizedCollections(payload),
    };
  });
