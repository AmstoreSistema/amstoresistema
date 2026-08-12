import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getClientDetails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ client_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Fetch sales and installments in parallel
    const [salesResult, installmentsResult] = await Promise.all([
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
          number,
          amount,
          due_date,
          status
        `)
        .eq("client_id", data.client_id)
        .order("due_date", { ascending: true })
    ]);

    if (salesResult.error) throw new Error(`Erro ao buscar vendas: ${salesResult.error.message}`);
    
    const sales = salesResult.data || [];
    const installments = installmentsResult.data || [];

    // Calculate totals
    const total_bought = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const total_paid = sales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const pending_installments = installments.filter(i => i.status !== 'paid');
    const total_debt = pending_installments.reduce((sum, i) => sum + Number(i.amount || 0), 0);

    return {
      sales,
      installments,
      stats: {
        sales_count: sales.length,
        total_bought,
        total_paid,
        total_debt
      }
    };
  });
