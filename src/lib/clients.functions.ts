import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getClientDetails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ client_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [salesResult, installmentsResult, cashbackEntriesResult, clientResult] = await Promise.all([
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
          discount,
          cashback_earned
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
        .select("amount, kind, sale_id, sales(status, sale_items(quantity, unit_price, discount, products(category)))")
        .eq("client_id", data.client_id),
      supabaseAdmin
        .from("clients")
        .select("cashback_balance")
        .eq("id", data.client_id)
        .single()
    ]);

    if (salesResult.error) throw new Error(`Erro ao buscar vendas: ${salesResult.error.message}`);
    
    const sales = salesResult.data || [];
    const saleIds = sales.map(s => s.id);
    // Filter cashback entries that are either NOT linked to a sale (bonus) 
    // or linked to a sale that still exists
    const cashbackEntries = (cashbackEntriesResult.data || []).filter((entry: any) => 
      !entry.sale_id || (entry.sales && entry.sales.status)
    ) as any[];

    let installments: any[] = [];
    if (saleIds.length > 0) {
      installments = (installmentsResult.data || []).filter(i => saleIds.includes(i.sale_id));
    }

    // Calculate totals
    const total_bought = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const total_paid = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const pending_installments = installments.filter(i => i.status !== 'paid');
    const total_debt = pending_installments.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
    const cashback_balance = Number(clientResult.data?.cashback_balance || 0);

    return {
      sales,
      installments,
      cashback_entries: cashbackEntries,
      stats: {
        sales_count: sales.length,
        total_bought,
        total_paid,
        total_debt,
        cashback_balance
      }
    };
  });
