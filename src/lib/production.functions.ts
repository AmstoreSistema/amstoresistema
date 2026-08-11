import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const processProductionCompletion = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ data: { orderId } }) => {
    // 1. Get the order and its product
    const { data: order, error: orderError } = await supabase
      .from("production_orders")
      .select("*, products(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "Order not found");
    }

    if (order.status === "completed") {
      throw new Error("Ordem já concluída");
    }

    const productId = order.product_id;
    const quantity = order.quantity;

    // 2. Get the product composition (BOM)
    const { data: composition, error: compError } = await supabase
      .from("product_materials")
      .select("*")
      .eq("product_id", productId);

    if (compError) throw compError;

    // 3. Process each material in the composition
    for (const item of composition || []) {
      const neededQty = (item.quantity || 0) * quantity;

      // Case A: It's a reserved cut
      if (item.material_cut_id) {
        const { error: cutError } = await supabase
          .from("material_cuts")
          .update({ status: "utilizado" })
          .eq("id", item.material_cut_id);
        
        if (cutError) throw cutError;
      } 
      // Case B: It's a variation
      else if (item.material_variation_id) {
        // Atomic decrement of variation stock
        const { data: variation, error: varGetError } = await supabase
          .from("material_variations")
          .select("current_stock")
          .eq("id", item.material_variation_id)
          .single();
        
        if (varGetError) throw varGetError;

        const { error: varUpdateError } = await supabase
          .from("material_variations")
          .update({ current_stock: (variation.current_stock || 0) - neededQty })
          .eq("id", item.material_variation_id);
        
        if (varUpdateError) throw varUpdateError;
      }
      // Case C: Raw material stock
      else if (item.material_id) {
        const { data: material, error: matGetError } = await supabase
          .from("materials")
          .select("current_stock")
          .eq("id", item.material_id)
          .single();
        
        if (matGetError) throw matGetError;

        const { error: matUpdateError } = await supabase
          .from("materials")
          .update({ current_stock: (material.current_stock || 0) - neededQty })
          .eq("id", item.material_id);
        
        if (matUpdateError) throw matUpdateError;
      }
    }

    // 4. Update product stock (finished good)
    const currentProdStock = order.products?.current_stock || 0;
    const { error: prodUpdateError } = await supabase
      .from("products")
      .update({ 
        current_stock: currentProdStock + quantity,
        updated_at: new Date().toISOString()
      })
      .eq("id", productId);
    
    if (prodUpdateError) throw prodUpdateError;

    // 5. Finally mark order as completed
    const { error: finalError } = await supabase
      .from("production_orders")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (finalError) throw finalError;

    return { success: true };
  });
