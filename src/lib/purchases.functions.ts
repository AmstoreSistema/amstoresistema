import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPurchaseDetails = createServerFn({ method: "GET" })
  .validator((data) => z.object({ purchase_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [purchaseResult, itemsResult] = await Promise.all([
      supabaseAdmin.from("purchases").select("*, suppliers(name)").eq("id", data.purchase_id).single(),
      supabaseAdmin.from("purchase_items").select("*").eq("purchase_id", data.purchase_id)
    ]);

    if (purchaseResult.error) throw new Error(`Erro ao buscar compra: ${purchaseResult.error.message}`);
    
    return {
      purchase: purchaseResult.data,
      items: itemsResult.data || []
    };
  });
