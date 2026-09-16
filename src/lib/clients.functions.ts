import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getClientDetails = createServerFn({ method: "GET" })
  .validator((data) => z.object({ client_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [salesResult, installmentsResult, transactionsResult, cashbackEntriesResult, clientResult] = await Promise.all([
      supabaseAdmin
        .from("sales")
        .select(`
          id,
          sale_code,
          total_amount,
          paid_amount,
          status,
          payment_method,
          is_debt,
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
          paid_amount,
          due_date,
          status
        `)
        .order("due_date", { ascending: true }),
      supabaseAdmin
        .from("transactions")
        .select("id, sale_id, amount, status, type")
        .eq("client_id", data.client_id)
        .eq("type", "income"),
      supabaseAdmin
        .from("cashback_entries")
        .select("amount, kind, sale_id, sales(status, total_amount, cashback_earned, sale_items(quantity, unit_price, discount, products(category)))")
        .eq("client_id", data.client_id),
      supabaseAdmin
        .from("clients")
        .select("cashback_balance")
        .eq("id", data.client_id)
        .single()
    ]);

    if (salesResult.error) throw new Error(`Erro ao buscar vendas: ${salesResult.error.message}`);
    
    const rawSales = salesResult.data || [];
    const saleIds = rawSales.map(s => s.id);
    const transactions = transactionsResult.data || [];

    const cashbackEntries = (cashbackEntriesResult.data || []).filter((entry: any) => 
      !entry.sale_id || (entry.sales && entry.sales.status)
    ) as any[];

    let allInstallments: any[] = [];
    if (saleIds.length > 0) {
      allInstallments = (installmentsResult.data || []).filter(i => saleIds.includes(i.sale_id));
    }

    const isInstallmentSettled = (i: any) => {
      const st = String(i.status || '').toLowerCase().trim();
      if (['paid', 'pago', 'paga', 'quitada', 'liquidada', 'cancelada'].includes(st)) return true;
      const amt = Number(i.amount || 0);
      const paid = Number(i.paid_amount || 0);
      return amt > 0 && paid >= amt - 0.009;
    };

    const salesNeedFix: string[] = [];

    const enrichedSales = rawSales.map(s => {
      const saleInsts = allInstallments.filter(i => i.sale_id === s.id);
      const saleTrans = transactions.filter(t => t.sale_id === s.id && !['cancelado', 'cancelled', 'estornado'].includes(String(t.status || '').toLowerCase()));

      const paidFromInsts = saleInsts.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
      const paidFromTrans = saleTrans.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const recordedPaid = Number(s.paid_amount || 0);

      const effectivePaid = Math.max(recordedPaid, paidFromInsts, paidFromTrans);
      const totalAmount = Number(s.total_amount || 0);

      const allInstallmentsPaid = saleInsts.length > 0 && saleInsts.every(isInstallmentSettled);
      const isStatusPaid = ['paid', 'pago', 'quitado', 'completed', 'finalizado'].includes(String(s.status || '').toLowerCase());
      const isAmountCovered = totalAmount > 0 && effectivePaid >= totalAmount - 0.009;

      const isFullyPaid = isStatusPaid || isAmountCovered || allInstallmentsPaid;
      const remainingBalance = isFullyPaid ? 0 : Math.max(0, totalAmount - effectivePaid);

      // Marca se precisa de cura automática no banco
      if (isFullyPaid && (s.status !== 'paid' || recordedPaid < totalAmount - 0.009 || s.is_debt)) {
        salesNeedFix.push(s.id);
      }

      return {
        ...s,
        paid_amount: isFullyPaid ? totalAmount : effectivePaid,
        effective_paid: isFullyPaid ? totalAmount : effectivePaid,
        remaining_balance: remainingBalance,
        is_fully_paid: isFullyPaid,
        status: isFullyPaid ? 'paid' : (effectivePaid > 0 ? 'partial' : s.status),
      };
    });

    // Auto-cura no banco em segundo plano para vendas que já foram pagas
    if (salesNeedFix.length > 0) {
      void Promise.all(
        salesNeedFix.map(saleId =>
          supabaseAdmin
            .from("sales")
            .update({ status: 'paid', is_debt: false })
            .eq("id", saleId)
        )
      ).catch(err => console.error("Erro na auto-cura de vendas quitadas:", err));
    }

    // Calcula os totais precisos
    const total_bought = enrichedSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const total_paid = enrichedSales.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const total_debt = enrichedSales.reduce((sum, s) => sum + Number(s.remaining_balance || 0), 0);
    const cashback_balance = Number(clientResult.data?.cashback_balance || 0);

    return {
      sales: enrichedSales,
      installments: allInstallments,
      cashback_entries: cashbackEntries,
      stats: {
        sales_count: enrichedSales.length,
        total_bought,
        total_paid,
        total_debt,
        cashback_balance
      }
    };
  });
