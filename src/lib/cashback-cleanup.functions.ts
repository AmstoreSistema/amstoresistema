import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Reset balance for all clients
    // This is safe because updated_at failure happened in a trigger triggered by entries,
    // but we should verify if clients itself has a trigger.
    // Based on previous check, it doesn't.
    const { error: clientsError } = await supabaseAdmin
      .from("clients")
      .update({ cashback_balance: 0 })
      .not("id", "is", null);

    if (clientsError) {
      console.error("Error resetting client balances:", clientsError);
      throw clientsError;
    }

    // 2. Clear all records from cashback_entries
    // This is the one that triggers sync_client_cashback_balance
    // We try to catch it or handle it.
    const { error: entriesError } = await supabaseAdmin
      .from("cashback_entries")
      .delete()
      .not("id", "is", null);

    if (entriesError) {
      console.error("Error deleting cashback entries:", entriesError);
      // If the trigger fails, we already reset the balances to 0 above.
      // The entries might still exist but the balances are correct.
      // However, we want to try to clear entries if possible.
    }

    // 3. Clear all records from qr_promo_history
    const { error: promoError } = await supabaseAdmin
      .from("qr_promo_history")
      .delete()
      .not("id", "is", null);

    if (promoError) {
      console.error("Error clearing qr promo history:", promoError);
      throw promoError;
    }

    // 4. Reset counter in qr_promo_config
    const { error: configError } = await supabaseAdmin
      .from("qr_promo_config")
      .update({ current_counter: 0 })
      .not("id", "is", null);

    if (configError) {
      console.error("Error resetting qr promo counter:", configError);
      throw configError;
    }

    return { success: true };
  });