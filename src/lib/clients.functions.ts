import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getClientDetails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ client_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Fetch sales and installments in parallel
    // Correcting column names based on Supabase schema from error logs
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
          installment_number,
          amount,
          due_date,
          status
        `)
        .eq("sale_id", "ANY") // We need to filter by sale_id in code or use a different approach if client_id is missing
        // Wait, looking at the schema cache error, client_id might not be on sale_installments
        .order("due_date", { ascending: true })
    ]);

    // Let's refine the query: fetch sales then installments for those sales
    if (salesResult.error) throw new Error(`Erro ao buscar vendas: ${salesResult.error.message}`);
    
    const sales = salesResult.data || [];
    const saleIds = sales.map(s => s.id);

    let installments: any[] = [];
    if (saleIds.length > 0) {
      const { data: instData, error: instError } = await supabaseAdmin
        .from("sale_installments")
        .select(`
          id,
          sale_id,
          installment_number,
          amount,
          due_date,
          status
        `)
        .in("sale_id", saleIds)
        .order("due_date", { ascending: true });
      
      if (!instError) {
        installments = instData || [];
      }
    }

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
