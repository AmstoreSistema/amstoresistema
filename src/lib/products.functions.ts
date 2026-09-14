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

    // 1. Busca produtos e registros de estoque detalhado
    const [{ data: products, error: pErr }, { data: stockRecords, error: sErr }] = await Promise.all([
      supabaseAdmin.from("products").select("id, name, current_stock, category, active"),
      supabaseAdmin.from("stock_products").select("id, produto_id, produto_nome, quantidade_disponivel, numeracoes"),
    ]);

    if (pErr || sErr) {
      console.warn("Aviso ao ler produtos para sincronização:", pErr || sErr);
      return { success: false, synced: 0 };
    }

    const prodMap = new Map((products || []).map((p: any) => [p.id, p]));
    let syncedCount = 0;

    for (const record of (stockRecords || []) as any[]) {
      if (!record.produto_id) continue;
      const linkedProduct = prodMap.get(record.produto_id);

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

