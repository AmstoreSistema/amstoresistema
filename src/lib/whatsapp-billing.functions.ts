import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getDebtorsData = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    // Fetch clients with their installments
    const { data: clients, error } = await supabaseAdmin
      .from("clients")
      .select(`
        id,
        name,
        phone,
        sale_installments(
          id,
          amount,
          paid_amount,
          due_date,
          status,
          sale_id,
          sales(
            sale_code
          )
        )
      `);

    if (error) throw new Error(`Erro ao buscar devedores: ${error.message}`);

    const debtors = (clients || []).map(client => {
      const installments = (client.sale_installments || []).map((inst: any) => ({
        ...inst,
        amount: Number(inst.amount),
        paid_amount: Number(inst.paid_amount),
        sale_code: inst.sales?.sale_code
      }));

      const pendingInstallments = installments.filter((i: any) => 
        !['paid', 'pago'].includes(String(i.status || '').toLowerCase()) && 
        (i.amount - i.paid_amount) > 0
      );

      if (pendingInstallments.length === 0) return null;

      const totalDue = pendingInstallments.reduce((sum, i) => sum + (i.amount - i.paid_amount), 0);
      const overdueInstallments = pendingInstallments.filter(i => new Date(i.due_date) < new Date());
      const totalOverdue = overdueInstallments.reduce((sum, i) => sum + (i.amount - i.paid_amount), 0);
      
      const salesCount = new Set(pendingInstallments.map(i => i.sale_id)).size;
      const nextDue = pendingInstallments.length > 0 
        ? pendingInstallments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0].due_date 
        : null;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        totalDue,
        totalOverdue,
        salesCount,
        nextDue,
        installments: pendingInstallments
      };
    }).filter(Boolean);

    // Calculate metrics
    const totalClients = clients?.length || 0;
    const clientsWithPhone = clients?.filter(c => !!c.phone).length || 0;
    const clientsWithOverdue = debtors.filter(d => d!.totalOverdue > 0).length;
    const totalToReceive = debtors.reduce((sum, d) => sum + d!.totalDue, 0);
    const totalOverdueValue = debtors.reduce((sum, d) => sum + d!.totalOverdue, 0);

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
