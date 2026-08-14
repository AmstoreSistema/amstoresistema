import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getClientDetails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ client_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [salesResult, installmentsResult, cashbackEntriesResult] = await Promise.all([
      supabaseAdmin
        .from("sales")
        .select(`
          id,
          sale_code,
          total_amount,
          paid_amount,
          status,
          payment_method,
          created_at,
          discount
        `)
        .eq("client_id", data.client_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("sale_installments")
        .select(`
          id,
          sale_id,
          installment_number,
          amount,
          due_date,
          status
        `)
        .order("due_date", { ascending: true }),
      supabaseAdmin
        .from("cashback_entries")
        .select("amount, kind, sales!inner(status, sale_items(quantity, unit_price, discount, products(category)))")
        .eq("client_id", data.client_id)
        .in("sales.status", ["paid", "completed", "finalizado", "ativo"])
    ]);

    if (salesResult.error) throw new Error(`Erro ao buscar vendas: ${salesResult.error.message}`);
    
    const sales = salesResult.data || [];
    const saleIds = sales.map(s => s.id);
    const cashbackEntries = (cashbackEntriesResult.data || []) as any[];

    let installments: any[] = [];
    if (saleIds.length > 0) {
      installments = (installmentsResult.data || []).filter(i => saleIds.includes(i.sale_id));
    }

    // Calculate totals
    const total_bought = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const total_paid = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const pending_installments = installments.filter(i => i.status !== 'paid');
    const total_debt = pending_installments.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
    const calculated_cashback = cashbackEntries.reduce((acc, entry) => {
      return acc + (entry.kind === 'earned' ? Number(entry.amount) : -Number(entry.amount));
    }, 0);

    return {
      sales,
      installments,
      cashback_entries: cashbackEntries,
      stats: {
        sales_count: sales.length,
        total_bought,
        total_paid,
        total_debt,
        cashback_balance: Math.max(0, calculated_cashback)
      }
    };
  });
