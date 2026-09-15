import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteProductsSafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        productIds: z.array(z.string()).min(1),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { productIds } = data;

    if (!productIds || productIds.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Desvincular de sale_items (mantém o histórico de vendas, relatórios e snapshots intactos)
    // Isso evita o erro de chave estrangeira sale_items_product_id_fkey
    const { error: saleItemsError } = await supabaseAdmin
      .from("sale_items")
      .update({ product_id: null } as any)
      .in("product_id", productIds);

    if (saleItemsError) {
      console.error("Erro ao desvincular itens de venda:", saleItemsError);
      throw new Error(`Erro ao desvincular itens de venda: ${saleItemsError.message}`);
    }

    // 2. Desvincular de ordens de produção e etiquetas geradas (mantém histórico)
    await supabaseAdmin
      .from("production_orders")
      .update({ product_id: null } as any)
      .in("product_id", productIds);

    await supabaseAdmin
      .from("etiqueta_gerada")
      .update({ produto_id: null } as any)
      .in("produto_id", productIds);

    // 3. Excluir composições técnicas de materiais (product_materials)
    await supabaseAdmin
      .from("product_materials")
      .delete()
      .in("product_id", productIds);

    // 4. Excluir registros de estoque detalhado (stock_products)
    const { error: stockError } = await supabaseAdmin
      .from("stock_products")
      .delete()
      .in("produto_id", productIds);

    if (stockError) {
      console.error("Erro ao excluir registros de estoque:", stockError);
      throw new Error(`Erro ao excluir estoque: ${stockError.message}`);
    }

    // 5. Excluir produtos da tabela principal (products)
    const { error: prodError } = await supabaseAdmin
      .from("products")
      .delete()
      .in("id", productIds);

    if (prodError) {
      console.error("Erro ao excluir produtos:", prodError);
      throw new Error(`Erro ao excluir produtos: ${prodError.message}`);
    }

    // 6. Registrar auditoria
    try {
      await supabaseAdmin.from("audit_log").insert(
        productIds.map((id) => ({
          action: "excluir",
          entity: "products",
          details: `Produto excluído do estoque com desvinculação segura (${productIds.length} selecionado(s))`,
          entity_id: id,
        })) as any
      );
    } catch (auditErr) {
      console.warn("Falha ao registrar auditoria de exclusão de produtos:", auditErr);
    }

    return {
      success: true,
      count: productIds.length,
    };
  });

export const syncStockConsistency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca produtos e registros de estoque detalhado completos
    const [{ data: products, error: pErr }, { data: stockRecords, error: sErr }] = await Promise.all([
      supabaseAdmin.from("products").select("id, name, sku, current_stock, category, active, sale_price, cost_price"),
      supabaseAdmin.from("stock_products").select("id, produto_id, produto_nome, quantidade_disponivel, numeracoes, preco_venda, preco_custo"),
    ]);

    if (pErr || sErr) {
      console.warn("Aviso ao ler produtos para sincronização:", pErr || sErr);
      return { success: false, synced: 0 };
    }

    const prodMapById = new Map((products || []).map((p: any) => [p.id, p]));
    const prodMapByName = new Map((products || []).map((p: any) => [(p.name || "").trim().toLowerCase(), p]));
    let syncedCount = 0;

    // Agrupa registros de stock_products por produto_id (ou nome)
    const recordsByProdId = new Map<string, any[]>();

    for (const record of (stockRecords || []) as any[]) {
      let prodId = record.produto_id;

      // Se produto_id for nulo, tenta vincular pelo nome
      if (!prodId && record.produto_nome) {
        const match = prodMapByName.get(record.produto_nome.trim().toLowerCase());
        if (match) {
          prodId = match.id;
          await supabaseAdmin
            .from("stock_products")
            .update({ produto_id: match.id })
            .eq("id", record.id);
          record.produto_id = match.id;
          syncedCount++;
        }
      }

      const key = prodId || (record.produto_nome ? `name:${record.produto_nome.trim().toLowerCase()}` : record.id);
      const list = recordsByProdId.get(key) || [];
      list.push(record);
      recordsByProdId.set(key, list);
    }

    // 2. Resolve duplicatas e corrige preços zerados
    for (const [key, records] of recordsByProdId.entries()) {
      const isId = !key.startsWith("name:");
      const linkedProduct = isId ? prodMapById.get(key) : prodMapByName.get(key.replace("name:", ""));
      const masterPrice = Number(linkedProduct?.sale_price ?? 0);

      if (records.length > 1) {
        // Ordena para priorizar o registro com preço válido > 0 e maior quantidade
        records.sort((a, b) => {
          const priceA = Number(a.preco_venda || 0);
          const priceB = Number(b.preco_venda || 0);
          if (priceA > 0 && priceB <= 0) return -1;
          if (priceB > 0 && priceA <= 0) return 1;
          return Number(b.quantidade_disponivel || 0) - Number(a.quantidade_disponivel || 0);
        });

        const primaryRecord = records[0];
        const duplicates = records.slice(1);

        let mergedQty = Number(primaryRecord.quantidade_disponivel || 0);
        let mergedNumeracoes: Record<string, number> | null =
          primaryRecord.numeracoes && typeof primaryRecord.numeracoes === "object"
            ? { ...(primaryRecord.numeracoes as Record<string, number>) }
            : null;

        // Consolida quantidades e grades dos duplicados antes de remover
        for (const dup of duplicates) {
          mergedQty += Number(dup.quantidade_disponivel || 0);
          if (dup.numeracoes && typeof dup.numeracoes === "object") {
            if (!mergedNumeracoes) mergedNumeracoes = {};
            for (const [size, qty] of Object.entries(dup.numeracoes as Record<string, any>)) {
              mergedNumeracoes[size] = (Number(mergedNumeracoes[size]) || 0) + (Number(qty) || 0);
            }
          }
          await supabaseAdmin.from("stock_products").delete().eq("id", dup.id);
          syncedCount++;
        }

        // Garante que o registro principal mantenha a quantidade consolidada e preço válido
        const primaryPrice = Number(primaryRecord.preco_venda || 0);
        const resolvedPrice = primaryPrice > 0 ? primaryPrice : masterPrice;

        await supabaseAdmin
          .from("stock_products")
          .update({
            quantidade_disponivel: mergedQty,
            numeracoes: mergedNumeracoes,
            preco_venda: resolvedPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", primaryRecord.id);

        primaryRecord.quantidade_disponivel = mergedQty;
        primaryRecord.numeracoes = mergedNumeracoes;
        primaryRecord.preco_venda = resolvedPrice;
        syncedCount++;
      } else {
        const record = records[0];
        const stockPrice = Number(record.preco_venda || 0);

        if (stockPrice <= 0 && masterPrice > 0) {
          await supabaseAdmin
            .from("stock_products")
            .update({ preco_venda: masterPrice, updated_at: new Date().toISOString() })
            .eq("id", record.id);
          record.preco_venda = masterPrice;
          syncedCount++;
        } else if (stockPrice > 0 && masterPrice <= 0 && linkedProduct) {
          await supabaseAdmin
            .from("products")
            .update({ sale_price: stockPrice, updated_at: new Date().toISOString() })
            .eq("id", linkedProduct.id);
          syncedCount++;
        }
      }
    }

    // 3. Verifica regras de estoque zerado e numerações esgotadas
    for (const record of (stockRecords || []) as any[]) {
      if (!record.produto_id) continue;
      const linkedProduct = prodMapById.get(record.produto_id);

      let needsUpdate = false;
      let newQty = Number(record.quantidade_disponivel ?? 0);

      // Regra A: Se o produto principal estiver inativo ou com estoque zerado no cadastro
      if (linkedProduct && (Number(linkedProduct.current_stock ?? 0) <= 0 || linkedProduct.active === false)) {
        if (newQty > 0) {
          newQty = 0;
          needsUpdate = true;
        }
      }

      // Regra B: Se o produto possui grade de numerações (calçados)
      if (record.numeracoes && typeof record.numeracoes === "object") {
        const sizes = Object.entries(record.numeracoes as Record<string, any>);
        if (sizes.length > 0) {
          const sumSizes = sizes.reduce((acc, [_, qty]) => {
            const n = Number(qty);
            return acc + (n > 0 ? n : 0);
          }, 0);
          if (sumSizes <= 0 && newQty > 0) {
            newQty = 0;
            needsUpdate = true;
          } else if (sumSizes > 0 && newQty !== sumSizes) {
            newQty = sumSizes;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await supabaseAdmin
          .from("stock_products")
          .update({ quantidade_disponivel: newQty, updated_at: new Date().toISOString() })
          .eq("id", record.id);
        syncedCount++;
      }
    }

    return { success: true, synced: syncedCount };
  });

