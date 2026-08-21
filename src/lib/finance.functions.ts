import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createTransaction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    type: z.enum(["entrada", "saida", "transferencia"]),
    amount: z.number().positive(),
    description: z.string(),
    account_id: z.string(),
    category: z.string().optional().nullable(),
    status: z.enum(["pago", "pendente", "cancelado"]).default("pago"),
    due_date: z.string().optional().nullable(),
    reference_id: z.string().optional().nullable(),
    reference_type: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    supplier_id: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error } = await admin
      .from("transactions")
      .insert({
        type: data.type,
        amount: data.type === "saida" ? -Math.abs(data.amount) : Math.abs(data.amount),
        description: data.description,
        account_id: data.account_id,
        category: data.category ?? null,
        status: data.status,
        due_date: data.due_date ?? null,
        reference_id: data.reference_id ?? null,
        reference_type: data.reference_type ?? null,
        client_id: data.client_id ?? null,
        supplier_id: data.supplier_id ?? null
      } as any);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string(),
    type: z.enum(["entrada", "saida", "transferencia"]),
    amount: z.number(),
    description: z.string(),
    account_id: z.string(),
    category: z.string().optional().nullable(),
    status: z.enum(["pago", "pendente", "cancelado"]),
    due_date: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    supplier_id: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    // Get old transaction for balance diff calculation
    const { data: oldTx } = await admin.from("transactions").select("*").eq("id", data.id).single();
    if (!oldTx) throw new Error("Transação não encontrada");

    const { error } = await admin
      .from("transactions")
      .update({
        type: data.type,
        amount: data.type === "saida" ? -Math.abs(data.amount) : Math.abs(data.amount),
        description: data.description,
        account_id: data.account_id,
        category: data.category,
        status: data.status,
        due_date: data.due_date,
        payment_method: data.payment_method,
        client_id: data.client_id,
        supplier_id: data.supplier_id
      } as any)
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    // A atualização de saldo agora é feita via trigger (transaction_balance_trigger) no banco de dados.
    // O código abaixo foi removido para evitar atualizações duplas (Double Balancing).
    return { success: true };

    return { success: true };
  });

export const updateTransactionStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string(),
    status: z.enum(["pago", "pendente", "cancelado"]),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    const { data: oldTx } = await admin.from("transactions").select("*").eq("id", data.id).single();
    if (!oldTx) throw new Error("Transação não encontrada");

    const { error } = await admin
      .from("transactions")
      .update({ status: data.status } as any)
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    // A atualização de saldo agora é feita via trigger no banco de dados.
    return { success: true };

    return { success: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: id }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    const { data: tx } = await admin.from("transactions").select("*").eq("id", id).single();
    if (!tx) throw new Error("Transação não encontrada");

    const { error } = await admin
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);

    // A atualização de saldo (estorno) agora é feita via trigger no banco de dados.
    return { success: true };

    return { success: true };
  });

export const updateAccountBalance = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string(),
    current_balance: z.number(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error } = await admin
      .from("financial_accounts")
      .update({ current_balance: data.current_balance } as any)
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteFinancialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    // Check if there are transactions linked to this account
    const { count, error: countError } = await admin
      .from("transactions")
      .select("*", { count: 'exact', head: true })
      .eq("account_id", data.id);

    if (countError) throw new Error(countError.message);
    if (count && count > 0) {
      throw new Error(`Não é possível excluir esta conta pois existem ${count} transações vinculadas a ela. Tente desativá-la em vez de excluir.`);
    }

    const { error } = await admin
      .from("financial_accounts")
      .delete()
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });