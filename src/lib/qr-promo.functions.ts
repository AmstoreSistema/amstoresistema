import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getQrPromoConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("qr_promo_config")
      .select("*")
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  });

export const updateQrPromoConfig = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    active: z.boolean(),
    name: z.string(),
    sales_limit: z.number(),
    bonus_value: z.number(),
    awarded_positions: z.string(),
    standard_message: z.string(),
    awarded_message: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("qr_promo_config")
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq("id", (await getQrPromoConfig()).id);
    
    if (error) throw error;
    return { success: true };
  });

export const resetQrPromoCounter = createServerFn({ method: "POST" })
  .handler(async () => {
    const config = await getQrPromoConfig();
    const { error } = await supabaseAdmin
      .from("qr_promo_config")
      .update({ current_counter: 0 })
      .eq("id", config.id);
    
    if (error) throw error;
    return { success: true };
  });

export const deleteQrPromoHistoryItem = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("qr_promo_history")
      .delete()
      .eq("id", data.id);
    
    if (error) throw error;
    return { success: true };
  });
