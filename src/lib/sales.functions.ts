import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const createSale = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    client_id: z.string().nullable(),
    payment_method: z.string(),
    total_amount: z.number(),
    discount: z.number(),
    paid_amount: z.number(),
    is_debt: z.boolean(),
    cashback_used: z.number().default(0),
    cashback_earned: z.number().default(0),
    notes: z.string().optional(),
    items: z.array(z.object({
      stock_id: z.string().nullable(),
      product_id: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      numeracao: z.string().nullable().optional(),
      discount: z.number().default(0),
      stock_snapshot: z.any().optional()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: saleId, error } = await supabase.rpc('create_complete_sale', {
      p_client_id: data.client_id || undefined,
      p_payment_method: data.payment_method,
      p_total_amount: data.total_amount,
      p_discount: data.discount,
      p_paid_amount: data.paid_amount,
      p_is_debt: data.is_debt,
      p_cashback_used: data.cashback_used,
      p_cashback_earned: data.cashback_earned,
      p_notes: data.notes || '',
      p_items: data.items as any
    });

    if (error) throw new Error(`Erro ao criar venda: ${error.message}`);
    return { saleId };
  });

export const cancelSale = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ sale_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.rpc('cancel_complete_sale', {
      p_sale_id: data.sale_id
    });
    
    if (error) throw new Error(`Erro ao cancelar venda: ${error.message}`);
    return { success: true };
  });

export const registerSalePayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    sale_id: z.string(),
    amount: z.number(),
    payment_method: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { error: paymentError } = await supabase
      .from("sale_payments")
      .insert({
        sale_id: data.sale_id,
        amount: data.amount,
        payment_method: data.payment_method
      });

    if (paymentError) throw new Error(`Erro ao registrar pagamento: ${paymentError.message}`);

    // Atualizar valor pago na venda
    const { data: sale } = await supabase
      .from("sales")
      .select("paid_amount, total_amount")
      .eq("id", data.sale_id)
      .single();

    if (sale) {
      const newPaidAmount = Number(sale.paid_amount) + data.amount;
      const newStatus = newPaidAmount >= Number(sale.total_amount) ? "paid" : "partial";
      
      await supabase
        .from("sales")
        .update({ 
          paid_amount: newPaidAmount,
          status: newStatus
        })
        .eq("id", data.sale_id);

      // Registrar transação
      await supabase
        .from("transactions")
        .insert({
          amount: data.amount,
          type: "income",
          description: `Pagamento Venda #${data.sale_id.slice(0, 8)}`,
          sale_id: data.sale_id,
          category: 'Venda'
        });
    }

    return { success: true };
  });
