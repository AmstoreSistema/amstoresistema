import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Clear all records from cashback_entries
    // Using a filter that is always true for existing records to bypass "no filter" protection if any,
    // and ensuring we don't rely on a specific hardcoded UUID.
    const { error: entriesError } = await supabaseAdmin
      .from("cashback_entries")
      .delete()
      .not("id", "is", null);

    if (entriesError) {
      console.error("Error deleting cashback entries:", entriesError);
      throw entriesError;
    }

    // 2. Reset balance for all clients
    const { error: clientsError } = await supabaseAdmin
      .from("clients")
      .update({ cashback_balance: 0 })
      .not("id", "is", null);

    if (clientsError) {
      console.error("Error resetting client balances:", clientsError);
      throw clientsError;
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