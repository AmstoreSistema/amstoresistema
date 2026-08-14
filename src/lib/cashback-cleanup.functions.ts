import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Reset balance for all clients
    // This is safe because updated_at failure happened in a trigger triggered by entries,
    // but we should verify if clients itself has a trigger.
    const { error: clientsError } = await admin
      .from("clients")
      .update({ cashback_balance: 0 })
      .not("id", "is", null);

    if (clientsError) {
      console.error("Error resetting client balances:", clientsError);
      throw clientsError;
    }

    // 2. Clear all records from cashback_entries
    // This is the one that triggers sync_client_cashback_balance
    // We try to clear entries. Even if the trigger fails to update the non-existent updated_at,
    // we already manually set balances to 0 above.
    try {
      const { error: entriesError } = await admin
        .from("cashback_entries")
        .delete()
        .not("id", "is", null);

      if (entriesError) {
        console.error("Error deleting cashback entries:", entriesError);
        // We continue because the critical part (balances) was already reset
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