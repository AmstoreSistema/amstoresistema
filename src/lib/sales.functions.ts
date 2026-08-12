import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    sale_type: z.string().default("Varejo"),
    financial_account_id: z.string().nullable().optional(),
    protection_method: z.string().nullable().optional(),
    sale_code: z.string().nullable().optional(),
    created_at: z.string().optional(),
    items: z.array(z.object({
      stock_id: z.string().nullable(),
      product_id: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      numeracao: z.string().nullable().optional(),
      discount: z.number().default(0),
      stock_snapshot: z.any().optional()
    })),
    installments: z.array(z.object({
      number: z.number(),
      amount: z.number(),
      due_date: z.string()
    })).optional().default([])
  }).parse(data))

  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saleId, error } = await (supabaseAdmin.rpc as any)('create_complete_sale', {
      p_cashback_earned: data.cashback_earned,
      p_cashback_used: data.cashback_used,
      p_client_id: data.client_id,
      p_created_at: data.created_at,
      p_discount: data.discount,
      p_financial_account_id: data.financial_account_id,
      p_installments: data.installments,
      p_is_debt: data.is_debt,
      p_items: data.items,
      p_notes: data.notes || '',
      p_paid_amount: data.paid_amount,
      p_payment_method: data.payment_method,
      p_protection_method: data.protection_method,
      p_sale_code: data.sale_code,
      p_sale_type: data.sale_type,
      p_total_amount: data.total_amount
    });

    if (error) throw new Error(`Erro ao criar venda: ${error.message}`);
    return { saleId: saleId as string };
  });

export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sale_id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('cancel_complete_sale', {
      p_sale_id: data.sale_id
    });
    
    if (error) throw new Error(`Erro ao cancelar venda: ${error.message}`);
    return { success: true };
  });

export const registerSalePayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    installment_id: z.string().optional(),
    sale_id: z.string(),
    amount: z.number(),
    payment_method: z.string(),
    account_id: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    if (data.installment_id) {
      const { error } = await supabase.rpc('pay_sale_installment', {
        p_installment_id: data.installment_id,
        p_amount: data.amount,
        p_payment_method: data.payment_method
      });
      if (error) throw new Error(`Erro ao registrar pagamento da parcela: ${error.message}`);
    } else {
      const { error: paymentError } = await supabase
        .from("sale_payments")
        .insert({
          sale_id: data.sale_id,
          amount: data.amount,
          payment_method: data.payment_method
        });

      if (paymentError) throw new Error(`Erro ao registrar pagamento: ${paymentError.message}`);

      const { data: sale } = await supabase
        .from("sales")
        .select("paid_amount, total_amount, sale_code")
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

        await supabase
          .from("transactions")
          .insert({
            amount: data.amount,
            type: "income",
            description: `Pagamento Venda #${sale.sale_code || data.sale_id.slice(0, 8)}`,
            sale_id: data.sale_id,
            category: 'Venda',
            account_id: data.account_id
          } as any);
      }
    }

    return { success: true };
  });

export const updateInstallments = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    sale_id: z.string(),
    installments: z.array(z.object({
      number: z.number(),
      amount: z.number(),
      due_date: z.string()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.rpc('update_sale_installments', {
      p_sale_id: data.sale_id,
      p_installments: data.installments
    });
    
    if (error) throw new Error(`Erro ao atualizar parcelas: ${error.message}`);

    // Update sales table installments_count
    await supabase
      .from("sales")
      .update({ installments_count: data.installments.length })
      .eq("id", data.sale_id);

    return { success: true };
  });