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

    const auditMetrics = {
      productsCreated: 0,
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
        table === "sale_items" || table === "sale_payments" || table === "sale_installments" || table === "transactions"
          ? await lookup("sales", "sale_code")
          : null;

      // Cria produtos que ainda não existem para itens de estoque ou itens de venda
      if ((table === "stock_products" || table === "sale_items") && productMap) {
        const novos = new Map<string, Record<string, any>>();
        for (const row of rows) {
          const base = row["__create_product"];
          const nameToUse = base?.name ?? row["__product_name"];
          if (!nameToUse) continue;
          const key = norm(nameToUse);
          if (productMap.get(key) || novos.has(key)) continue;
          novos.set(key, {
            name: nameToUse,
            sku: base?.sku ?? null,
            category: base?.category || "Geral",
            color: base?.color ?? null,
            image_url: base?.image_url ?? null,
            cost_price: base?.cost_price ?? 0,
            sale_price: base?.sale_price ?? 0,
            wholesale_price: base?.wholesale_price ?? null,
            current_stock: 0,
            min_stock: 0,
            labor_cost: 0,
            overhead_cost: 0,
            retail_margin: 0,
            wholesale_margin: 0,
            active: true,
          });
        }
        for (const batch of chunk([...novos.values()], 100)) {
          const { data: created, error } = await supabaseAdmin
            .from("products" as any)
            .insert(batch)
            .select("id,name");
          if (error) {
            console.error(`[Import] falha ao criar produtos de ${table}:`, error.message);
            continue;
          }
          for (const p of (created as any[]) || []) {
            productMap.set(norm(p.name), p.id);
            auditMetrics.productsCreated++;
          }
        }
      }

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

        if (saleMap && saleCode && !row["sale_id"]) {
          const hit = saleMap.get(norm(saleCode));
          if (hit) row["sale_id"] = hit;
        }

        if (table === "sale_items" || table === "sale_payments" || table === "sale_installments") {
          const saleId = row["sale_id"] ?? (saleCode ? saleMap?.get(norm(saleCode)) : undefined);
          if (!saleId) continue; // sem venda vinculada o registro filho é inválido
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

      let customMatched = false;

      if (table === "sale_items") {
        customMatched = true;
        const saleIds = [...new Set(rows.map((r) => r.sale_id).filter(Boolean))];
        const existingItemsMap = new Map<string, string>();
        for (const batch of chunk(saleIds, 100)) {
          const { data: exItems } = await supabaseAdmin
            .from("sale_items" as any)
            .select("id,sale_id,product_id,numeracao")
            .in("sale_id", batch);
          for (const item of (exItems as any[]) || []) {
            const key = `${item.sale_id}::${item.product_id ?? ""}::${norm(item.numeracao ?? "")}`;
            if (!existingItemsMap.has(key)) existingItemsMap.set(key, item.id);
          }
        }

        const seenInBatch = new Set<string>();
        for (const row of rows) {
          const key = `${row.sale_id}::${row.product_id ?? ""}::${norm(row.numeracao ?? "")}`;
          if (seenInBatch.has(key)) continue;
          seenInBatch.add(key);

          const existingId = existingItemsMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, row });
          } else {
            toInsert.push(row);
          }
        }
      } else if (table === "sale_installments") {
        customMatched = true;
        const saleIds = [...new Set(rows.map((r) => r.sale_id).filter(Boolean))];
        const existingInstMap = new Map<string, string>();
        for (const batch of chunk(saleIds, 100)) {
          const { data: exInst } = await supabaseAdmin
            .from("sale_installments" as any)
            .select("id,sale_id,installment_number")
            .in("sale_id", batch);
          for (const inst of (exInst as any[]) || []) {
            const key = `${inst.sale_id}::${inst.installment_number}`;
            if (!existingInstMap.has(key)) existingInstMap.set(key, inst.id);
          }
        }

        const seenInBatch = new Set<string>();
        for (const row of rows) {
          const key = `${row.sale_id}::${row.installment_number}`;
          if (seenInBatch.has(key)) continue;
          seenInBatch.add(key);

          const existingId = existingInstMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, row });
          } else {
            toInsert.push(row);
          }
        }
      } else if (table === "sale_payments") {
        customMatched = true;
        const saleIds = [...new Set(rows.map((r) => r.sale_id).filter(Boolean))];
        const existingPayMap = new Map<string, string>();
        for (const batch of chunk(saleIds, 100)) {
          const { data: exPay } = await supabaseAdmin
            .from("sale_payments" as any)
            .select("id,sale_id,amount,payment_method")
            .in("sale_id", batch);
          for (const pay of (exPay as any[]) || []) {
            const key = `${pay.sale_id}::${Number(pay.amount || 0).toFixed(2)}::${norm(pay.payment_method)}`;
            if (!existingPayMap.has(key)) existingPayMap.set(key, pay.id);
          }
        }

        const seenInBatch = new Set<string>();
        for (const row of rows) {
          const key = `${row.sale_id}::${Number(row.amount || 0).toFixed(2)}::${norm(row.payment_method)}`;
          if (seenInBatch.has(key)) continue;
          seenInBatch.add(key);

          const existingId = existingPayMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, row });
          } else {
            toInsert.push(row);
          }
        }
      } else if (table === "transactions") {
        customMatched = true;
        // Busca transações já cadastradas para não duplicar e atualizar client_id / sale_id
        const { data: existingTx } = await supabaseAdmin
          .from("transactions" as any)
          .select("id,description,amount,type,created_at,client_id,sale_id")
          .limit(30000);

        const existingTxMap = new Map<string, string>();
        for (const tx of (existingTx as any[]) || []) {
          const dt = String(tx.created_at || "").slice(0, 10);
          const key = `${norm(tx.description)}::${Number(tx.amount || 0).toFixed(2)}::${tx.type}::${dt}`;
          if (!existingTxMap.has(key)) existingTxMap.set(key, tx.id);
        }

        const seenInBatch = new Set<string>();
        for (const row of rows) {
          const dt = String(row.created_at || "").slice(0, 10);
          const key = `${norm(row.description)}::${Number(row.amount || 0).toFixed(2)}::${row.type}::${dt}`;
          if (seenInBatch.has(key)) continue;
          seenInBatch.add(key);

          const existingId = existingTxMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, row });
          } else {
            toInsert.push(row);
          }
        }
      }

      if (!customMatched) {
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

    // Conciliação de parcelas com pagamentos da mesma venda:
    // Sincroniza forma de pagamento e data para parcelas quitadas
    if (results["sale_installments"] || results["sale_payments"]) {
      try {
        const { data: allSalesWithInst } = await supabaseAdmin
          .from("sale_installments" as any)
          .select("sale_id")
          .limit(10000);
        const uniqueSaleIds = [...new Set(((allSalesWithInst as any[]) || []).map((i) => i.sale_id).filter(Boolean))];

        for (const batch of chunk(uniqueSaleIds, 100)) {
          const [{ data: payments }, { data: installments }] = await Promise.all([
            supabaseAdmin
              .from("sale_payments" as any)
              .select("sale_id,amount,payment_method,created_at")
              .in("sale_id", batch),
            supabaseAdmin
              .from("sale_installments" as any)
              .select("id,sale_id,amount,payment_method,paid_at,status,paid_amount")
              .in("sale_id", batch),
          ]);

          const paymentsBySale = new Map<string, any[]>();
          for (const p of (payments as any[]) || []) {
            const list = paymentsBySale.get(p.sale_id) ?? [];
            list.push(p);
            paymentsBySale.set(p.sale_id, list);
          }

          for (const inst of (installments as any[]) || []) {
            if (!inst.payment_method && (inst.status === "pago" || (inst.paid_amount && Number(inst.paid_amount) > 0))) {
              const salePays = paymentsBySale.get(inst.sale_id) || [];
              const matchedPay =
                salePays.find((p) => Math.abs(Number(p.amount) - Number(inst.amount)) < 0.05) || salePays[0];
              if (matchedPay) {
                await supabaseAdmin
                  .from("sale_installments" as any)
                  .update({
                    payment_method: matchedPay.payment_method,
                    paid_at: inst.paid_at || matchedPay.created_at,
                  })
                  .eq("id", inst.id);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn("[Import] Aviso na conciliação de parcelas com pagamentos:", err?.message);
      }
    }

    // Sincroniza a quantidade dos produtos com o estoque restaurado
    if (results["stock_products"]) {
      const { data: stockRows } = await supabaseAdmin
        .from("stock_products" as any)
        .select("produto_id,quantidade_disponivel")
        .limit(50000);
      const totals = new Map<string, number>();
      for (const r of (stockRows as any[]) || []) {
        if (!r?.produto_id) continue;
        totals.set(r.produto_id, (totals.get(r.produto_id) ?? 0) + Number(r.quantidade_disponivel ?? 0));
      }
      for (const [productId, qty] of totals) {
        await supabaseAdmin.from("products" as any).update({ current_stock: qty }).eq("id", productId);
      }
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
      summary: {
        sales: (results["sales"]?.inserted ?? 0) + (results["sales"]?.updated ?? 0),
        sale_items: (results["sale_items"]?.inserted ?? 0) + (results["sale_items"]?.updated ?? 0),
        sale_payments: (results["sale_payments"]?.inserted ?? 0) + (results["sale_payments"]?.updated ?? 0),
        sale_installments: (results["sale_installments"]?.inserted ?? 0) + (results["sale_installments"]?.updated ?? 0),
        transactions: (results["transactions"]?.inserted ?? 0) + (results["transactions"]?.updated ?? 0),
        productsCreated: auditMetrics.productsCreated,
      },
    };
  });

export const reconcileOrphanTransactions = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Carrega transações com client_id ou sale_id nulos
    const { data: orphans, error: txErr } = await supabaseAdmin
      .from("transactions" as any)
      .select("id, description, notes, amount, type, client_id, sale_id, created_at")
      .or("client_id.is.null,sale_id.is.null")
      .limit(10000);

    if (txErr || !orphans) {
      console.error("[Reconcile] Erro ao buscar transações:", txErr);
      return { success: false, message: txErr?.message, fixedClients: 0, fixedSales: 0, totalOrphans: 0 };
    }

    // 2. Carrega vendas e clientes para referência
    const [{ data: sales }, { data: clients }] = await Promise.all([
      supabaseAdmin.from("sales" as any).select("id, sale_code, client_id, total_amount, created_at").limit(20000),
      supabaseAdmin.from("clients" as any).select("id, name").limit(20000),
    ]);

    const norm = (s: any) => String(s ?? "").trim().toLowerCase();

    const saleByCode = new Map<string, any>();
    for (const s of (sales as any[]) || []) {
      if (s.sale_code) saleByCode.set(norm(s.sale_code), s);
    }

    const clientByName = new Map<string, string>();
    for (const c of (clients as any[]) || []) {
      if (c.name) clientByName.set(norm(c.name), c.id);
    }

    let fixedSales = 0;
    let fixedClients = 0;

    for (const tx of orphans) {
      let updatedSaleId = tx.sale_id;
      let updatedClientId = tx.client_id;
      const textToSearch = `${tx.description || ""} ${tx.notes || ""}`.trim();

      // Procura código de venda no texto (ex.: V-00123, VD123, #123, etc.)
      if (!updatedSaleId && textToSearch) {
        for (const [code, s] of saleByCode.entries()) {
          if (code.length >= 2 && textToSearch.toLowerCase().includes(code)) {
            updatedSaleId = s.id;
            if (!updatedClientId && s.client_id) {
              updatedClientId = s.client_id;
              fixedClients++;
            }
            fixedSales++;
            break;
          }
        }
      }

      // Se ainda não achou client_id, procura nome de cliente no texto
      if (!updatedClientId && textToSearch) {
        for (const [cName, cId] of clientByName.entries()) {
          if (cName.length >= 3 && textToSearch.toLowerCase().includes(cName)) {
            updatedClientId = cId;
            fixedClients++;
            break;
          }
        }
      }

      // Se houve alteração, salva a transação
      if (updatedSaleId !== tx.sale_id || updatedClientId !== tx.client_id) {
        await supabaseAdmin
          .from("transactions" as any)
          .update({
            sale_id: updatedSaleId,
            client_id: updatedClientId,
          })
          .eq("id", tx.id);
      }
    }

    return {
      success: true,
      totalOrphans: orphans.length,
      fixedSales,
      fixedClients,
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
