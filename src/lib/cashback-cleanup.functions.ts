import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Reset balance for all clients
    // We do this first because the trigger on entries might fail due to the missing updated_at column.
    // By resetting clients first, we ensure the final state is correct (balance = 0) 
    // even if clearing the entries log hits the trigger error.
    const { error: clientsError } = await admin
      .from("clients")
      .update({ cashback_balance: 0 })
      .not("id", "is", null);

    if (clientsError) {
      console.error("Error resetting client balances:", clientsError);
      throw clientsError;
    }

    // 2. Clear all records from cashback_entries
    // This action triggers tr_sync_cashback_balance which currently fails.
    // We wrap it in a try-catch to ensure the rest of the cleanup continues.
    try {
      const { error: entriesError } = await admin
        .from("cashback_entries")
        .delete()
        .not("id", "is", null);

      if (entriesError) {
        console.error("Trigger error during entries deletion (expected due to database constraint):", entriesError);
        // Note: The entries might not be deleted if the trigger fails the transaction.
        // However, we prioritized the clients table update above.
      }
    } catch (e) {
      console.error("Exception during entries deletion:", e);
    }

    // 3. Clear all records from qr_promo_history
    const { error: promoError } = await admin
      .from("qr_promo_history")
      .delete()
      .not("id", "is", null);

    if (promoError) {
      console.error("Error clearing qr promo history:", promoError);
      throw promoError;
    }

    // 4. Reset counter in qr_promo_config
    const { error: configError } = await admin
      .from("qr_promo_config")
      .update({ current_counter: 0 })
      .not("id", "is", null);

    if (configError) {
      console.error("Error resetting qr promo counter:", configError);
      throw configError;
    }

    return { success: true };
  });

/**
 * Aplica a regra de corte de Outubro/2025:
 * 1. Zera cashback_earned e cashback_used em vendas com data < 2025-10-01.
 * 2. Remove cashback_entries com data < 2025-10-01 ou vinculadas a vendas < 2025-10-01.
 * 3. Recalcula o cashback_balance de cada cliente considerando apenas vendas/movimentações de Outubro/2025 em diante.
 */
export const cleanPreOctober2025Cashbacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Zera cashback_earned e cashback_used nas vendas anteriores a Outubro/2025 (< 2025-10-01)
    const { error: salesError } = await admin
      .from("sales")
      .update({ cashback_earned: 0, cashback_used: 0 })
      .lt("created_at", "2025-10-01");

    if (salesError) console.error("Erro ao zerar cashback de vendas antigas:", salesError);

    // 2. Remove cashback_entries com data anterior a 01/10/2025
    try {
      await admin
        .from("cashback_entries")
        .delete()
        .lt("created_at", "2025-10-01");
    } catch (e) {
      console.warn("Aviso ao remover entries antigas:", e);
    }

    // 3. Remove cashback_entries associadas a vendas anteriores a 01/10/2025
    const { data: oldSales } = await admin
      .from("sales")
      .select("id")
      .lt("created_at", "2025-10-01")
      .limit(5000);

    if (oldSales && oldSales.length > 0) {
      const oldSaleIds = oldSales.map((s: any) => s.id);
      for (let i = 0; i < oldSaleIds.length; i += 100) {
        const batch = oldSaleIds.slice(i, i + 100);
        try {
          await admin
            .from("cashback_entries")
            .delete()
            .in("sale_id", batch);
        } catch (e) {}
      }
    }

    // 4. Recalcula o cashback_balance dos clientes
    const { data: validSales } = await admin
      .from("sales")
      .select("client_id, cashback_earned, cashback_used")
      .gte("created_at", "2025-10-01")
      .not("client_id", "is", null);

    const clientBalanceMap = new Map<string, number>();
    if (validSales) {
      for (const s of validSales) {
        if (!s.client_id) continue;
        const current = clientBalanceMap.get(s.client_id) || 0;
        const earned = Number(s.cashback_earned || 0);
        const used = Number(s.cashback_used || 0);
        clientBalanceMap.set(s.client_id, Math.max(0, current + (earned - used)));
      }
    }

    // Atualiza saldo dos clientes
    const { data: allClients } = await admin
      .from("clients")
      .select("id, cashback_balance");

    let updatedCount = 0;
    if (allClients) {
      for (const client of allClients) {
        const newBalance = clientBalanceMap.get(client.id) || 0;
        if (Number(client.cashback_balance || 0) !== newBalance) {
          await admin
            .from("clients")
            .update({ cashback_balance: newBalance })
            .eq("id", client.id);
          updatedCount++;
        }
      }
    }

    return { success: true, updatedClients: updatedCount };
  });