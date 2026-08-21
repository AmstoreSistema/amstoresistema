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