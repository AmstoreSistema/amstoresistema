import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderInput = (data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data);

export const startProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("start_production_order", {
      _order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const processProductionCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("complete_production_order", {
      _order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteProductionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("delete_production_order", {
      _order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return result;
  });