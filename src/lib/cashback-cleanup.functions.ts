import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Clear all records from cashback_entries
    const { error: entriesError } = await supabaseAdmin
      .from("cashback_entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (entriesError) throw entriesError;

    // 2. Reset balance for all clients
    const { error: clientsError } = await supabaseAdmin
      .from("clients")
      .update({ cashback_balance: 0 })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (clientsError) throw clientsError;

    // 3. Optional: Clear QR promo history bonus usage
    const { error: promoError } = await supabaseAdmin
      .from("qr_promo_history")
      .update({ available_bonus: false })
      .eq("is_awarded", true);

    if (promoError) throw promoError;

    return { success: true };
  });
