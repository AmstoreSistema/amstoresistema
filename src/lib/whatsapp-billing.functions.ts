import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getDebtorsData = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Fetch clients with their sales and installments
    const { data: clients, error } = await supabaseAdmin
      .from("clients")
      .select(`
        id,
        name,
        phone,
        sales(
          id,
          sale_code,
          sale_installments(
            id,
            amount,
            paid_amount,
            due_date,
            status,
            installment_number
          )
        )
      `);

    if (error) throw new Error(`Erro ao buscar devedores: ${error.message}`);

    const debtors = (clients || []).map(client => {
      const allInstallments: any[] = [];
      (client.sales || []).forEach((sale: any) => {
        (sale.sale_installments || []).forEach((inst: any) => {
          allInstallments.push({
            ...inst,
            sale_code: sale.sale_code,
            amount: Number(inst.amount),
            paid_amount: Number(inst.paid_amount || 0)
          });
        });
      });

      const pendingInstallments = allInstallments.filter((i: any) => 
        !['paid', 'pago'].includes(String(i.status || '').toLowerCase()) && 
        (i.amount - i.paid_amount) > 0
      );

      if (pendingInstallments.length === 0) return null;

      const totalDue = pendingInstallments.reduce((sum, i) => sum + (i.amount - i.paid_amount), 0);
      const overdueInstallments = pendingInstallments.filter(i => new Date(i.due_date) < new Date());
      const totalOverdue = overdueInstallments.reduce((sum, i) => sum + (i.amount - i.paid_amount), 0);
      
      const salesCount = new Set(pendingInstallments.map(i => i.sale_id)).size;
      const sortedInstallments = [...pendingInstallments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      const nextDue = sortedInstallments.length > 0 ? sortedInstallments[0].due_date : null;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        totalDue,
        totalOverdue,
        salesCount,
        nextDue,
        installments: sortedInstallments
      };
    }).filter(Boolean);

    // Calculate metrics
    const totalClients = clients?.length || 0;
    const clientsWithPhone = clients?.filter(c => !!c.phone).length || 0;
    const clientsWithOverdue = debtors.filter(d => (d as any).totalOverdue > 0).length;
    const totalToReceive = debtors.reduce((sum, d) => sum + (d as any).totalDue, 0);
    const totalOverdueValue = debtors.reduce((sum, d) => sum + (d as any).totalOverdue, 0);

    return {
      debtors,
      metrics: {
        totalClients,
        clientsWithPhone,
        clientsWithOverdue,
        totalToReceive,
        totalOverdueValue
      }
    };
  });
