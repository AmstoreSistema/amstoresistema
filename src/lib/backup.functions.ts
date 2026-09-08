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
      const productSkuMap =
        table === "stock_products" || table === "sale_items" ? await lookup("products", "sku") : null;
      const saleMap =
        table === "sale_items" || table === "sale_payments" || table === "sale_installments" || table === "transactions"
          ? await lookup("sales", "sale_code")
          : null;

      // Cria produtos que ainda não existem para itens de estoque ou itens de venda
      if ((table === "stock_products" || table === "sale_items") && productMap) {
        const novos = new Map<string, Record<string, any>>();
        for (const row of rows) {
          const base = row["__create_product"];
          const nameToUse = base?.name ?? row["__product_name"] ?? (row["__product_sku"] ? `Produto ${row["__product_sku"]}` : null);
          const skuToUse = base?.sku ?? row["__product_sku"] ?? null;
          if (!nameToUse) continue;
          const key = norm(nameToUse);
          const skuKey = skuToUse ? norm(skuToUse) : null;
          if ((productMap.get(key) || (skuKey && productSkuMap?.get(skuKey))) || novos.has(key)) continue;
          novos.set(key, {
            name: nameToUse,
            sku: skuToUse,
            category: base?.category || "Geral",
            color: base?.color ?? null,
            image_url: base?.image_url ?? null,
            cost_price: base?.cost_price ?? 0,
            sale_price: base?.sale_price ?? 0,
            wholesale_price: base?.wholesale_price ?? null,
            current_stock: base?.current_stock ?? 0,
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
            .select("id,name,sku,category,current_stock");
          if (error) {
            console.error(`[Import] falha ao criar produtos de ${table}:`, error.message);
            continue;
          }
          for (const p of (created as any[]) || []) {
            productMap.set(norm(p.name), p.id);
            if (p.sku) productSkuMap?.set(norm(p.sku), p.id);
            auditMetrics.productsCreated++;

            // Cria registro correspondente em stock_products para manter o estoque preenchido
            try {
              await supabaseAdmin.from("stock_products" as any).insert({
                produto_id: p.id,
                produto_nome: p.name,
                quantidade_disponivel: Number(p.current_stock ?? 0),
                categoria: p.category ?? "Geral",
                localizacao: "Loja Principal",
              });
            } catch {}
          }
        }
      }

      const out: Record<string, any>[] = [];

      for (const row of rows) {
        const clientName = row["__client_name"];
        const productName = row["__product_name"];
        const productSku = row["__product_sku"];
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
        if (table === "sale_items" && !row["product_id"]) {
          const matchedId =
            (productName ? productMap?.get(norm(productName)) : null) ??
            (productSku ? productSkuMap?.get(norm(productSku)) : null);
          if (matchedId) row["product_id"] = matchedId;
        }

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

    // Tabelas de cashback exigem cliente_nome NOT NULL – preenche a partir do ID quando ausente.
    const CASHBACK_NOME_TABLES = new Set([
      "CashbackCliente",
      "CashbackMovimentacao",
      "CashbackHistorico",
    ]);

    async function enrichCashbackNomes(table: string, rows: Record<string, any>[]) {
      if (!CASHBACK_NOME_TABLES.has(table)) return rows;
      const needsEnrich = rows.some((r) => !r["cliente_nome"] && r["cliente_id"]);
      if (!needsEnrich) return rows;

      // Monta mapa id -> nome a partir dos clientes que aparecem nos registros
      const idsToFetch = [...new Set(rows.map((r) => r["cliente_id"]).filter(Boolean))];
      const idToName = new Map<string, string>();
      for (const batch of chunk(idsToFetch, 200)) {
        const { data } = await supabaseAdmin
          .from("clients" as any)
          .select("id,name")
          .in("id", batch);
        for (const c of (data as any[]) || []) {
          if (c.id && c.name) idToName.set(String(c.id), String(c.name));
        }
      }

      return rows.map((r) => {
        if (!r["cliente_nome"] && r["cliente_id"]) {
          const resolved = idToName.get(String(r["cliente_id"]));
          if (resolved) r["cliente_nome"] = resolved;
        }
        // Se ainda não tiver cliente_nome, descarta o registro para evitar violação NOT NULL
        if (!r["cliente_nome"]) return null;
        return r;
      }).filter(Boolean) as Record<string, any>[];
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
      rows = await enrichCashbackNomes(table, rows);

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
        const saleIds = [...new Set(rows.map((r) => r["sale_id"]).filter(Boolean))];
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
          const key = `${row["sale_id"]}::${row["product_id"] ?? ""}::${norm(row["numeracao"] ?? "")}`;
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
        const saleIds = [...new Set(rows.map((r) => r["sale_id"]).filter(Boolean))];
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
          const key = `${row["sale_id"]}::${row["installment_number"]}`;
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
        const saleIds = [...new Set(rows.map((r) => r["sale_id"]).filter(Boolean))];
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
          const key = `${row["sale_id"]}::${Number(row["amount"] || 0).toFixed(2)}::${norm(row["payment_method"])}`;
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
          const dt = String(row["created_at"] || "").slice(0, 10);
          const key = `${norm(row["description"])}::${Number(row["amount"] || 0).toFixed(2)}::${row["type"]}::${dt}`;
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

export const linkSaleItemsAndFillStock = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const norm = (s: any) =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    // 1. Carrega todos os produtos existentes
    const { data: allProducts, error: prodErr } = await supabaseAdmin
      .from("products" as any)
      .select("id, name, sku, category, sale_price, cost_price, current_stock")
      .limit(50000);

    if (prodErr) {
      console.error("[LinkStock] Erro ao carregar produtos:", prodErr);
      return { success: false, message: prodErr.message, itemsLinked: 0, productsCreated: 0, stockUpdated: 0 };
    }

    const productByName = new Map<string, any>();
    const productBySku = new Map<string, any>();
    for (const p of (allProducts as any[]) || []) {
      if (p.name) productByName.set(norm(p.name), p);
      if (p.sku) productBySku.set(norm(p.sku), p);
    }

    // 2. Carrega itens de venda
    const { data: items, error: itemErr } = await supabaseAdmin
      .from("sale_items" as any)
      .select("id, sale_id, product_id, quantity, unit_price, discount, numeracao, stock_snapshot")
      .limit(50000);

    let itemsLinked = 0;
    let productsCreated = 0;

    const unlinkedItems = (items as any[] || []).filter((item) => !item.product_id);

    if (unlinkedItems.length > 0) {
      const missingProducts = new Map<string, Record<string, any>>();
      const itemToMissingKey = new Map<string, string>();

      for (const item of unlinkedItems) {
        let pName: string | null = null;
        let pSku: string | null = null;
        let pCategory = "Geral";
        let pPrice = Number(item.unit_price ?? 0);

        if (item.stock_snapshot) {
          const snap =
            typeof item.stock_snapshot === "string"
              ? (() => {
                  try {
                    return JSON.parse(item.stock_snapshot);
                  } catch {
                    return {};
                  }
                })()
              : item.stock_snapshot;
          pName = snap?.name || snap?.nome || snap?.produto_nome || snap?.produto || null;
          pSku = snap?.sku || snap?.codigo || snap?.codigo_produto || snap?.referencia || null;
          pCategory = snap?.category || snap?.categoria || "Geral";
          pPrice = Number(snap?.sale_price || snap?.preco || item.unit_price || 0);
        }

        if (!pName && !pSku) {
          pName = `Produto Venda #${item.id.slice(0, 8)}`;
        }

        const matched =
          (pName ? productByName.get(norm(pName)) : null) || (pSku ? productBySku.get(norm(pSku)) : null);

        if (matched) {
          await supabaseAdmin.from("sale_items" as any).update({ product_id: matched.id }).eq("id", item.id);
          itemsLinked++;
        } else {
          const key = norm(pName || pSku);
          if (!missingProducts.has(key)) {
            missingProducts.set(key, {
              name: pName || `Produto ${pSku}`,
              sku: pSku || null,
              category: pCategory,
              sale_price: pPrice,
              cost_price: 0,
              current_stock: 0,
              min_stock: 0,
              active: true,
            });
          }
          itemToMissingKey.set(item.id, key);
        }
      }

      // Cria produtos que faltam
      if (missingProducts.size > 0) {
        for (const batch of chunk([...missingProducts.values()], 100)) {
          const { data: created, error } = await supabaseAdmin
            .from("products" as any)
            .insert(batch)
            .select("id, name, sku, category, current_stock");

          if (!error && created) {
            for (const p of (created as any[]) || []) {
              productByName.set(norm(p.name), p);
              if (p.sku) productBySku.set(norm(p.sku), p);
              productsCreated++;
            }
          }
        }

        // Vincula os itens restantes
        for (const [itemId, key] of itemToMissingKey.entries()) {
          const prod = productByName.get(key);
          if (prod) {
            await supabaseAdmin.from("sale_items" as any).update({ product_id: prod.id }).eq("id", itemId);
            itemsLinked++;
          }
        }
      }
    }

    // 3. Preenche o estoque com as quantidades de cada produto
    const [{ data: latestProds }, { data: stockRecords }] = await Promise.all([
      supabaseAdmin.from("products" as any).select("id, name, category, current_stock").limit(50000),
      supabaseAdmin.from("stock_products" as any).select("id, produto_id, quantidade_disponivel").limit(50000),
    ]);

    const stockByProdId = new Map<string, number>();
    const registeredStockProdIds = new Set<string>();

    for (const r of (stockRecords as any[]) || []) {
      if (!r.produto_id) continue;
      registeredStockProdIds.add(r.produto_id);
      stockByProdId.set(r.produto_id, (stockByProdId.get(r.produto_id) ?? 0) + Number(r.quantidade_disponivel ?? 0));
    }

    let stockUpdated = 0;

    // Se houver saldo em stock_products, atualiza current_stock no produto
    for (const p of (latestProds as any[]) || []) {
      const totalInStock = stockByProdId.get(p.id);
      if (totalInStock !== undefined && totalInStock !== p.current_stock) {
        await supabaseAdmin.from("products" as any).update({ current_stock: totalInStock }).eq("id", p.id);
        stockUpdated++;
      }
    }

    // Garante que todo produto possua ao menos um registro correspondente em stock_products
    const prodsWithoutStockRecord = (latestProds as any[] || []).filter((p) => !registeredStockProdIds.has(p.id));
    if (prodsWithoutStockRecord.length > 0) {
      const newStockEntries = prodsWithoutStockRecord.map((p) => ({
        produto_id: p.id,
        produto_nome: p.name,
        quantidade_disponivel: Number(p.current_stock ?? 0),
        categoria: p.category ?? "Geral",
        localizacao: "Loja Principal",
      }));

      for (const batch of chunk(newStockEntries, 100)) {
        await supabaseAdmin.from("stock_products" as any).insert(batch);
      }
    }

    return {
      success: true,
      itemsLinked,
      productsCreated,
      stockUpdated,
      totalProducts: (latestProds as any[])?.length ?? 0,
    };
  });

export const reconcileOrphanTransactions = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Carrega transações com client_id ou sale_id nulos
    const { data: orphans, error: txErr } = await supabaseAdmin
      .from("transactions" as any)
      .select("id, description, notes, amount, type, client_id, sale_id, created_at, due_date")
      .or("client_id.is.null,sale_id.is.null")
      .limit(10000);

    if (txErr || !orphans) {
      console.error("[Reconcile] Erro ao buscar transações:", txErr);
      return { success: false, message: txErr?.message, fixedClients: 0, fixedSales: 0, totalOrphans: 0 };
    }

    // 2. Carrega vendas, clientes, pagamentos e parcelas para correlação profunda
    const [{ data: sales }, { data: clients }, { data: salePayments }] = await Promise.all([
      supabaseAdmin.from("sales" as any).select("id, sale_code, client_id, total_amount, paid_amount, created_at").limit(30000),
      supabaseAdmin.from("clients" as any).select("id, name, document_cpf, phone").limit(30000),
      supabaseAdmin.from("sale_payments" as any).select("id, sale_id, amount, created_at").limit(30000),
    ]);

    const norm = (s: any) =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const cleanDigits = (s: any) => String(s ?? "").replace(/\D/g, "");

    const saleByCode = new Map<string, any>();
    const salesById = new Map<string, any>();
    const salesByClient = new Map<string, any[]>();

    for (const s of (sales as any[]) || []) {
      salesById.set(s.id, s);
      if (s.sale_code) {
        const codeNorm = norm(s.sale_code);
        saleByCode.set(codeNorm, s);
        const digits = cleanDigits(s.sale_code);
        if (digits && digits.length >= 1) {
          saleByCode.set(digits, s);
        }
      }
      if (s.client_id) {
        const list = salesByClient.get(s.client_id) || [];
        list.push(s);
        salesByClient.set(s.client_id, list);
      }
    }

    // Clientes indexados por nome completo normalizado
    const clientByName = new Map<string, string>();
    const clientList: { id: string; nameNorm: string; nameLength: number }[] = [];

    for (const c of (clients as any[]) || []) {
      if (c.name) {
        const nameNorm = norm(c.name);
        clientByName.set(nameNorm, c.id);
        clientList.push({ id: c.id, nameNorm, nameLength: nameNorm.length });
      }
    }
    // Ordena clientes pelo maior comprimento de nome primeiro para casar nomes mais específicos
    clientList.sort((a, b) => b.nameLength - a.nameLength);

    // Mapeamento de pagamentos por venda
    const paymentsBySale = new Map<string, any[]>();
    for (const p of (salePayments as any[]) || []) {
      if (p.sale_id) {
        const list = paymentsBySale.get(p.sale_id) || [];
        list.push(p);
        paymentsBySale.set(p.sale_id, list);
      }
    }

    let fixedSales = 0;
    let fixedClients = 0;
    const updatesToPersist: { id: string; sale_id: string | null; client_id: string | null }[] = [];

    for (const tx of (orphans as any[]) || []) {
      let updatedSaleId = tx.sale_id;
      let updatedClientId = tx.client_id;
      const textToSearch = `${tx.description || ""} ${tx.notes || ""}`.trim();
      const textNorm = norm(textToSearch);

      // A. Extração direta de JSON ou campos de notas
      if (tx.notes && typeof tx.notes === "string" && tx.notes.includes("{")) {
        try {
          const parsed = JSON.parse(tx.notes);
          const saleCode = parsed?.codigo_venda || parsed?.sale_code || parsed?.venda_codigo;
          if (saleCode && !updatedSaleId) {
            const hit = saleByCode.get(norm(saleCode)) || saleByCode.get(cleanDigits(saleCode));
            if (hit) updatedSaleId = hit.id;
          }
          const clientName = parsed?.cliente_nome || parsed?.client_name || parsed?.cliente;
          if (clientName && !updatedClientId) {
            const hit = clientByName.get(norm(clientName));
            if (hit) updatedClientId = hit;
          }
        } catch {}
      }

      // B. Procura por código de venda via Regex e padrões de texto
      if (!updatedSaleId && textNorm) {
        // Regex para formatos como: "Venda #123", "VD-123", "V-00123", "Pedido 123", "#123"
        const regexMatch = textNorm.match(/(?:venda|vd|pedido|ped|v-|cupom|recibo|nf|#)\s*[:#\-]?\s*([a-z0-9_-]+)/i);
        if (regexMatch && regexMatch[1]) {
          const candidate = regexMatch[1];
          const hit = saleByCode.get(candidate) || saleByCode.get(cleanDigits(candidate));
          if (hit) {
            updatedSaleId = hit.id;
          }
        }

        // Se ainda não achou, faz varredura direta pelos códigos cadastrados
        if (!updatedSaleId) {
          for (const [code, s] of saleByCode.entries()) {
            if (code.length >= 3 && textNorm.includes(code)) {
              updatedSaleId = s.id;
              break;
            }
          }
        }
      }

      // Se encontrou a venda, herda o cliente da venda
      if (updatedSaleId) {
        const foundSale = salesById.get(updatedSaleId);
        if (foundSale?.client_id && !updatedClientId) {
          updatedClientId = foundSale.client_id;
        }
      }

      // C. Procura nome de cliente no texto da transação
      if (!updatedClientId && textNorm) {
        for (const { id: cId, nameNorm, nameLength } of clientList) {
          if (nameLength >= 4 && textNorm.includes(nameNorm)) {
            updatedClientId = cId;
            break;
          }
        }
      }

      // D. Se achou cliente mas não achou venda, tenta correlacionar com as vendas do cliente
      if (updatedClientId && !updatedSaleId) {
        const clientSales = salesByClient.get(updatedClientId) || [];
        if (clientSales.length === 1) {
          // Cliente só possui 1 venda no sistema: vínculo direto
          updatedSaleId = clientSales[0].id;
        } else if (clientSales.length > 1 && tx.amount) {
          // Procura venda do cliente com valor idêntico
          const matchAmount = clientSales.find(
            (s) => Math.abs(Number(s.total_amount) - Number(tx.amount)) < 0.05,
          );
          if (matchAmount) {
            updatedSaleId = matchAmount.id;
          }
        }
      }

      // Contabiliza o que foi corrigido nesta transação
      const saleChanged = updatedSaleId && updatedSaleId !== tx.sale_id;
      const clientChanged = updatedClientId && updatedClientId !== tx.client_id;

      if (saleChanged || clientChanged) {
        if (saleChanged) fixedSales++;
        if (clientChanged) fixedClients++;
        updatesToPersist.push({
          id: tx.id,
          sale_id: updatedSaleId || tx.sale_id,
          client_id: updatedClientId || tx.client_id,
        });
      }
    }

    // Salva alterações em lotes de 50 no banco de dados
    for (const batch of chunk(updatesToPersist, 50)) {
      await Promise.all(
        batch.map((up) =>
          supabaseAdmin
            .from("transactions" as any)
            .update({
              sale_id: up.sale_id,
              client_id: up.client_id,
            })
            .eq("id", up.id),
        ),
      );
    }

    return {
      success: true,
      totalOrphans: orphans.length,
      fixedSales,
      fixedClients,
      remainingOrphans: Math.max(orphans.length - Math.max(fixedSales, fixedClients), 0),
    };
  });

export const getRestorationAuditReport = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Vendas
    const { count: totalSales } = await supabaseAdmin.from("sales" as any).select("id", { count: "exact", head: true });
    const { count: totalSaleItems } = await supabaseAdmin.from("sale_items" as any).select("id", { count: "exact", head: true });
    const { count: totalSalePayments } = await supabaseAdmin.from("sale_payments" as any).select("id", { count: "exact", head: true });
    const { count: totalSaleInstallments } = await supabaseAdmin.from("sale_installments" as any).select("id", { count: "exact", head: true });

    // Amostra para conferir vendas com itens
    const { data: salesList } = await supabaseAdmin.from("sales" as any).select("id").limit(10000);
    const { data: itemsList } = await supabaseAdmin.from("sale_items" as any).select("sale_id").not("sale_id", "is", null).limit(50000);
    const salesWithItemsSet = new Set((itemsList || []).map((i: any) => i.sale_id));
    const salesWithItems = (salesList || []).filter((s: any) => salesWithItemsSet.has(s.id)).length;
    const salesWithoutItems = Math.max((totalSales ?? 0) - salesWithItems, 0);

    // 2. Transações
    const { count: totalTransactions } = await supabaseAdmin.from("transactions" as any).select("id", { count: "exact", head: true });
    const { count: txWithClient } = await supabaseAdmin.from("transactions" as any).select("id", { count: "exact", head: true }).not("client_id", "is", null);
    const { count: txWithSale } = await supabaseAdmin.from("transactions" as any).select("id", { count: "exact", head: true }).not("sale_id", "is", null);
    const { count: txPureOrphans } = await supabaseAdmin.from("transactions" as any).select("id", { count: "exact", head: true }).is("client_id", null).is("sale_id", null);
    const txWithoutClient = Math.max((totalTransactions ?? 0) - (txWithClient ?? 0), 0);
    const txWithoutSale = Math.max((totalTransactions ?? 0) - (txWithSale ?? 0), 0);

    // 3. Estoque
    const { count: totalProducts } = await supabaseAdmin.from("products" as any).select("id", { count: "exact", head: true });
    const { count: productsWithStock } = await supabaseAdmin.from("products" as any).select("id", { count: "exact", head: true }).gt("current_stock", 0);
    const { count: totalStockRecords } = await supabaseAdmin.from("stock_products" as any).select("id", { count: "exact", head: true });
    const { count: totalMaterials } = await supabaseAdmin.from("materials" as any).select("id", { count: "exact", head: true });
    const productsZeroStock = Math.max((totalProducts ?? 0) - (productsWithStock ?? 0), 0);

    // 4. Cashback
    let totalCashbackConfig = 0;
    let totalMirrorConfig = 0;
    let clientsWithCashback = 0;
    let totalCashbackEntries = 0;
    let totalMirrorEntries = 0;

    try {
      const { count: cConfig } = await supabaseAdmin.from("cashback_config" as any).select("id", { count: "exact", head: true });
      totalCashbackConfig = cConfig ?? 0;
    } catch {}

    try {
      const { count: mConfig } = await supabaseAdmin.from("CashbackCategoria" as any).select("id", { count: "exact", head: true });
      totalMirrorConfig = mConfig ?? 0;
    } catch {}

    try {
      const { count: cClients } = await supabaseAdmin.from("clients" as any).select("id", { count: "exact", head: true }).gt("cashback_balance", 0);
      clientsWithCashback = cClients ?? 0;
    } catch {}

    try {
      const { count: cEntries } = await supabaseAdmin.from("cashback_entries" as any).select("id", { count: "exact", head: true });
      totalCashbackEntries = cEntries ?? 0;
    } catch {}

    try {
      const { count: mEntries } = await supabaseAdmin.from("CashbackMovimentacao" as any).select("id", { count: "exact", head: true });
      totalMirrorEntries = mEntries ?? 0;
    } catch {}

    // 5. O que falta por área
    const missing = {
      sales:
        salesWithoutItems > 0
          ? `${salesWithoutItems} venda(s) ainda não possuem itens de produto vinculados.`
          : "Todas as vendas possuem itens vinculados.",
      transactions:
        txWithoutClient > 0 || txWithoutSale > 0
          ? `${txWithoutClient} transação(ões) sem cliente e ${txWithoutSale} sem venda vinculada.`
          : "Todas as transações estão vinculadas a clientes e vendas.",
      stock:
        productsZeroStock > 0
          ? `${productsZeroStock} produto(s) com quantidade de estoque zerada no catálogo.`
          : "Todos os produtos possuem quantidade em estoque registrada.",
      cashback:
        totalCashbackConfig + totalMirrorConfig === 0
          ? "Nenhuma regra de categoria de cashback ativa configurada."
          : `${clientsWithCashback} cliente(s) possuem saldo acumulado de cashback.`,
    };

    return {
      sales: {
        total: totalSales ?? 0,
        items: totalSaleItems ?? 0,
        payments: totalSalePayments ?? 0,
        installments: totalSaleInstallments ?? 0,
        salesWithItems,
        salesWithoutItems,
        status: salesWithoutItems === 0 && (totalSales ?? 0) > 0 ? "ok" : (salesWithItems > 0 ? "warning" : "pending"),
        missing: missing.sales,
      },
      transactions: {
        total: totalTransactions ?? 0,
        withClient: txWithClient ?? 0,
        withoutClient: txWithoutClient,
        withSale: txWithSale ?? 0,
        withoutSale: txWithoutSale,
        pureOrphans: txPureOrphans ?? 0,
        status: txWithoutClient === 0 && txWithoutSale === 0 && (totalTransactions ?? 0) > 0 ? "ok" : "warning",
        missing: missing.transactions,
      },
      stock: {
        totalProducts: totalProducts ?? 0,
        productsWithStock: productsWithStock ?? 0,
        productsZeroStock,
        totalStockRecords: totalStockRecords ?? 0,
        totalMaterials: totalMaterials ?? 0,
        status: (productsWithStock ?? 0) > 0 ? "ok" : "warning",
        missing: missing.stock,
      },
      cashback: {
        activeConfigs: totalCashbackConfig + totalMirrorConfig,
        clientsWithCashback,
        totalEntries: totalCashbackEntries + totalMirrorEntries,
        status: totalCashbackConfig + totalMirrorConfig > 0 ? "ok" : "warning",
        missing: missing.cashback,
      },
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
