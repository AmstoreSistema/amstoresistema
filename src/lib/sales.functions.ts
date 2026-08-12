import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Note: In a real app, these should be in a separate .server.ts file for complete separation,
// but following the pattern of simple wrappers for createServerFn.

export const createSale = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    client_id: z.string(),
    payment_method: z.string(),
    total_amount: z.number(),
    discount: z.number(),
    paid_amount: z.number(),
    is_debt: z.boolean(),
    notes: z.string().optional(),
    items: z.array(z.object({
      stock_id: z.string(),
      product_id: z.string(),
      product_name: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      numeracao: z.string().optional(),
      stock_snapshot: z.any()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    // In a production environment, this would use a Supabase RPC to ensure atomic transactions
    // Since we can't easily add new RPCs here without a migration, we'll try to follow the flow
    
    // 1. Create Sale
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        client_id: data.client_id,
        payment_method: data.payment_method,
        total_amount: data.total_amount,
        discount: data.discount,
        paid_amount: data.paid_amount,
        is_debt: data.is_debt,
        notes: data.notes || null,
        status: data.paid_amount >= data.total_amount ? "paid" : (data.paid_amount > 0 ? "partial" : "pending")
      })
      .select()
      .single();

    if (saleError) throw new Error(`Sale creation failed: ${saleError.message}`);

    // 2. Create Items & Update Stock
    for (const item of data.items) {
      // Create Sale Item
      const { error: itemError } = await supabase
        .from("sale_items")
        .insert({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        });
      
      if (itemError) console.error(`Item creation failed for ${item.product_name}:`, itemError);

      // Update Stock (Decrement)
      // We need to fetch current stock to handle numeracoes correctly
      const { data: stockItem } = await supabase
        .from("stock_products")
        .select("quantidade_disponivel, numeracoes")
        .eq("id", item.stock_id)
        .single();

      if (stockItem) {
        const newTotal = (stockItem.quantidade_disponivel || 0) - item.quantity;
        let newNumeracoes = stockItem.numeracoes;
        
        if (item.numeracao && typeof newNumeracoes === 'object' && newNumeracoes !== null) {
          const numObj = { ...(newNumeracoes as Record<string, number>) };
          const currentVal = numObj[item.numeracao];
          if (typeof currentVal === 'number') {
            numObj[item.numeracao] = Math.max(0, currentVal - item.quantity);
          }
          newNumeracoes = numObj;
        }

        await supabase
          .from("stock_products")
          .update({ 
            quantidade_disponivel: newTotal,
            numeracoes: newNumeracoes
          })
          .eq("id", item.stock_id);
      }
    }

    // 3. Finance (Transaction)
    if (data.paid_amount > 0) {
      await supabase
        .from("transactions")
        .insert({
          amount: data.paid_amount,
          type: "income",
          description: `Venda #${sale.id.slice(0, 8)}`,
          sale_id: sale.id
        });
    }

    return sale;
  });

export const cancelSale = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ sale_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    // 1. Get Sale Items to restore stock
    const { data: items } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", data.sale_id);

    // Note: This logic is simplified as we don't have the stock_id in sale_items (need to join with product or add stock_id to sale_items)
    // For now, let's update sale status
    const { error } = await supabase
      .from("sales")
      .update({ status: "cancelled" })
      .eq("id", data.sale_id);

    if (error) throw new Error(`Cancel failed: ${error.message}`);
    
    return { success: true };
  });
