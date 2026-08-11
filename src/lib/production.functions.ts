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

    if (!order.product_id) {
      throw new Error("Ordem sem produto vinculado");
    }

    const productId = order.product_id;
    const quantity = order.quantity;

    // 2. Get the product composition (BOM)
    const { data: composition, error: compError } = await supabase
      .from("product_materials")
      .select("*")
      .eq("product_id", productId);

    if (compError) throw compError;

    // 3. Process each material in the composition (Down stock only if not already done)
    if (!order.materiais_baixados) {
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
          const { data: variation, error: vError } = await supabase
            .from("material_variations")
            .select("current_stock")
            .eq("id", item.material_variation_id)
            .maybeSingle();
          
          if (vError) throw vError;
          if (variation) {
            const { error: updError } = await supabase
              .from("material_variations")
              .update({ current_stock: (variation.current_stock || 0) - neededQty })
              .eq("id", item.material_variation_id);
            if (updError) throw updError;
          }
        }
        // Case C: Raw material stock
        else if (item.material_id) {
          const { data: material, error: mError } = await supabase
            .from("materials")
            .select("current_stock")
            .eq("id", item.material_id)
            .maybeSingle();
          
          if (mError) throw mError;
          if (material) {
            const { error: updError } = await supabase
              .from("materials")
              .update({ current_stock: (material.current_stock || 0) - neededQty })
              .eq("id", item.material_id);
            if (updError) throw updError;
          }
        }
      }
    }

    // 4. Create record in stock_products (finished good)
    const productData = order.products as any;
    
    // Sum costs from composition
    const unitCost = (composition || []).reduce((acc, item) => acc + (item.total_cost || 0), 0);

    const { error: stockInsertError } = await supabase
      .from("stock_products")
      .insert({
        produto_id: productId,
        produto_nome: order.produto_nome || productData?.name || "Produto",
        ordem_producao_id: orderId,
        quantidade_disponivel: quantity,
        data_entrada: new Date().toISOString(),
        categoria: productData?.category,
        preco_custo: unitCost,
        preco_venda: productData?.sale_price || 0,
      });
    
    if (stockInsertError) throw stockInsertError;

    // Update global product stock for backwards compatibility
    const currentProdStock = productData?.current_stock || 0;
    const { error: prodUpdError } = await supabase
      .from("products")
      .update({ current_stock: currentProdStock + quantity })
      .eq("id", productId);
    
    if (prodUpdError) throw prodUpdError;

    // 5. Finally mark order as completed
    const { error: finalError } = await supabase
      .from("production_orders")
      .update({ 
        status: "completed",
        completed_at: new Date().toISOString(),
        materiais_baixados: true
      })
      .eq("id", orderId);

    if (finalError) throw finalError;

    return { success: true };
  });

export const deleteProductionOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ data: { orderId } }) => {
    // 1. Get the order
    const { data: order, error: orderError } = await supabase
      .from("production_orders")
      .select("*, products(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "Ordem não encontrada");
    }

    const productId = order.product_id;
    const quantity = order.quantity;

    // 2. Reverse stock if materials were already baixados
    if (order.materiais_baixados && order.status !== "cancelado") {
      if (!productId) throw new Error("Produto não vinculado");

      const { data: composition } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", productId);

      for (const item of composition || []) {
        const neededQty = (item.quantity || 0) * quantity;

        if (item.material_cut_id) {
          const { error: cutError } = await supabase.from("material_cuts").update({ status: "reservado" }).eq("id", item.material_cut_id);
          if (cutError) throw cutError;
        } else if (item.material_variation_id) {
          const { data: variation, error: vError } = await supabase.from("material_variations").select("current_stock").eq("id", item.material_variation_id).maybeSingle();
          if (vError) throw vError;
          if (variation) {
            const { error: updError } = await supabase.from("material_variations").update({ current_stock: (variation.current_stock || 0) + neededQty }).eq("id", item.material_variation_id);
            if (updError) throw updError;
          }
        } else if (item.material_id) {
          const { data: material, error: mError } = await supabase.from("materials").select("current_stock").eq("id", item.material_id).maybeSingle();
          if (mError) throw mError;
          if (material) {
            const { error: updError } = await supabase.from("materials").update({ current_stock: (material.current_stock || 0) + neededQty }).eq("id", item.material_id);
            if (updError) throw updError;
          }
        }
      }
    }

    // 3. If completed, remove from stock_products
    if (order.status === "completed") {
      const { error: stockDelError } = await supabase.from("stock_products").delete().eq("ordem_producao_id", orderId);
      if (stockDelError) throw stockDelError;
      
      // Also update global product stock
      const productData = order.products as any;
      const currentProdStock = productData?.current_stock || 0;
      if (productId) {
        const { error: prodUpdError } = await supabase.from("products").update({ current_stock: Math.max(0, currentProdStock - quantity) }).eq("id", productId);
        if (prodUpdError) throw prodUpdError;
      }
    }

    // 4. Delete the order
    const { error: deleteError } = await supabase.from("production_orders").delete().eq("id", orderId);
    if (deleteError) throw deleteError;

    return { success: true };
  });

export const startProduction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ data: { orderId } }) => {
    const { data: order, error } = await supabase
      .from("production_orders")
      .select("*, products(*)")
      .eq("id", orderId)
      .single();

    if (error || !order) throw new Error("Ordem não encontrada");
    if (order.status !== "pending") throw new Error("Apenas ordens pendentes podem ser iniciadas");

    const productId = order.product_id;
    const quantity = order.quantity;

    // A. Get composition
    const { data: composition } = await supabase.from("product_materials").select("*").eq("product_id", productId as string);

    // B. Down stock materials
    for (const item of composition || []) {
      const neededQty = (item.quantity || 0) * quantity;
      if (item.material_cut_id) {
        const { error: cutError } = await supabase.from("material_cuts").update({ status: "utilizado" }).eq("id", item.material_cut_id);
        if (cutError) throw cutError;
      } else if (item.material_variation_id) {
        const { data: v, error: vError } = await supabase.from("material_variations").select("current_stock").eq("id", item.material_variation_id).maybeSingle();
        if (vError) throw vError;
        if (v) {
          const { error: updError } = await supabase.from("material_variations").update({ current_stock: (v.current_stock || 0) - neededQty }).eq("id", item.material_variation_id);
          if (updError) throw updError;
        }
      } else if (item.material_id) {
        const { data: m, error: mError } = await supabase.from("materials").select("current_stock").eq("id", item.material_id).maybeSingle();
        if (mError) throw mError;
        if (m) {
          const { error: updError } = await supabase.from("materials").update({ current_stock: (m.current_stock || 0) - neededQty }).eq("id", item.material_id);
          if (updError) throw updError;
        }
      }
    }

    // C. Update status
    const { error: startError } = await supabase.from("production_orders").update({
      status: "ongoing",
      started_at: new Date().toISOString(),
      materiais_baixados: true
    }).eq("id", orderId);

    if (startError) throw startError;

    return { success: true };
  });

export const cancelProduction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ data: { orderId } }) => {
    const { data: order, error } = await supabase.from("production_orders").select("*").eq("id", orderId).single();
    if (error || !order) throw new Error("Ordem não encontrada");
    if (order.status === "completed") throw new Error("Não é possível cancelar uma ordem concluída");

    const quantity = order.quantity;
    const productId = order.product_id;

    if (order.materiais_baixados) {
      const { data: composition } = await supabase.from("product_materials").select("*").eq("product_id", productId as string);
      for (const item of composition || []) {
        const neededQty = (item.quantity || 0) * quantity;
        if (item.material_cut_id) {
          const { error: cutError } = await supabase.from("material_cuts").update({ status: "reservado" }).eq("id", item.material_cut_id);
          if (cutError) throw cutError;
        } else if (item.material_variation_id) {
          const { data: v, error: vError } = await supabase.from("material_variations").select("current_stock").eq("id", item.material_variation_id).maybeSingle();
          if (vError) throw vError;
          if (v) {
            const { error: updError } = await supabase.from("material_variations").update({ current_stock: (v.current_stock || 0) + neededQty }).eq("id", item.material_variation_id);
            if (updError) throw updError;
          }
        } else if (item.material_id) {
          const { data: m, error: mError } = await supabase.from("materials").select("current_stock").eq("id", item.material_id).maybeSingle();
          if (mError) throw mError;
          if (m) {
            const { error: updError } = await supabase.from("materials").update({ current_stock: (m.current_stock || 0) + neededQty }).eq("id", item.material_id);
            if (updError) throw updError;
          }
        }
      }
    }

    const { error: cancelError } = await supabase.from("production_orders").update({ status: "cancelled" }).eq("id", orderId);
    if (cancelError) throw cancelError;
    return { success: true };
  });
