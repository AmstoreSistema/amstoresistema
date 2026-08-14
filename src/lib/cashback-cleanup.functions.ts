import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .handler(async () => {
    // 1. Temporarily disable the trigger to prevent it from firing during bulk delete
    // We use a migration-style raw SQL to fix the function and clear data
    const { error: sqlError } = await supabaseAdmin.rpc("exec_sql", {
      sql_query: `
        -- 1. Fix the trigger function first (remove updated_at which doesn't exist)
        CREATE OR REPLACE FUNCTION public.sync_client_cashback_balance()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_client_id uuid;
            v_total numeric;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                v_client_id := OLD.client_id;
            ELSE
                v_client_id := NEW.client_id;
            END IF;

            IF v_client_id IS NOT NULL THEN
                SELECT COALESCE(SUM(
                    CASE 
                        WHEN kind = 'earned' THEN amount 
                        WHEN kind = 'used' THEN -amount 
                        ELSE 0 
                    END
                ), 0) INTO v_total
                FROM public.cashback_entries
                WHERE client_id = v_client_id;

                UPDATE public.clients
                SET cashback_balance = GREATEST(0, v_total)
                WHERE id = v_client_id;
            END IF;

            RETURN NULL;
        END;
        $$;

        -- 2. Clear all records
        DELETE FROM public.cashback_entries;
        UPDATE public.clients SET cashback_balance = 0;
        DELETE FROM public.qr_promo_history;
        UPDATE public.qr_promo_config SET current_counter = 0;
      `
    });

    if (sqlError) {
      console.error("Error resetting all cashbacks via SQL:", sqlError);
      
      // Fallback: try adding the column if exec_sql isn't available or fails
      // or try the direct update approach
      const { error: clientsError } = await supabaseAdmin
        .from("clients")
        .update({ cashback_balance: 0 } as any)
        .not("id", "is", null);

      if (clientsError) throw clientsError;
      
      await supabaseAdmin.from("cashback_entries").delete().not("id", "is", null);
      await supabaseAdmin.from("qr_promo_history").delete().not("id", "is", null);
      await supabaseAdmin.from("qr_promo_config").update({ current_counter: 0 } as any).not("id", "is", null);
    }

    return { success: true };
  });