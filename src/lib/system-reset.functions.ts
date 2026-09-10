import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Ordem de exclusão: filhos primeiro para não violar chaves estrangeiras. */
const DELETE_ORDER = [
  "qr_promo_history",
  "cashback_entries",
  "condicional_items",
  "condicionais",
  "debt_payments",
  "sale_payments",
  "sale_installments",
  "sale_items",
  "transactions",
  "sales",
  "purchase_items",
  "purchases",
  "etiqueta_gerada",
  "stock_products",
  "production_orders",
  "product_materials",
  "material_cuts",
  "material_variations",
  "products",
  "materials",
  "clients",
  "suppliers",
  "cashback_config",
  "notifications",
  "promotions",
  "accounts",
  "audit_log",
];

export const resetSystemData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ confirm: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.confirm !== "ZERAR") {
      throw new Error("Confirmação inválida. Digite ZERAR para continuar.");
    }

    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context.userId, context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: Record<string, string> = {};
    for (const table of DELETE_ORDER) {
      const { error } = await supabaseAdmin
        .from(table as any)
        .delete()
        .not("id", "is", null);
      results[table] = error ? `erro: ${error.message}` : "limpo";
    }

    // Zera saldos das contas financeiras (mantém as contas cadastradas)
    await supabaseAdmin
      .from("financial_accounts")
      .update({ current_balance: 0, initial_balance: 0 })
      .not("id", "is", null);

    return { success: true, results };
  });
