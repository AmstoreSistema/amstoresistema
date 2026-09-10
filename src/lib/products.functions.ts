import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deleteProductsSafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
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
