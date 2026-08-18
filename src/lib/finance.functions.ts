import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

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

    // Sync account balance
    const newAmount = data.type === "saida" ? -Math.abs(data.amount) : Math.abs(data.amount);
    const diff = (data.status === 'pago' ? newAmount : 0) - (oldTx.status === 'pago' ? oldTx.amount : 0);
    
    if (diff !== 0) {
      const { data: account } = await admin.from("financial_accounts").select("current_balance").eq("id", data.account_id).single();
      if (account) {
        await admin.from("financial_accounts").update({ current_balance: Number(account.current_balance) + diff }).eq("id", data.account_id);
      }
    }

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

    // If status changed from/to 'pago', update balance
    if (oldTx.status !== data.status && (oldTx.status === 'pago' || data.status === 'pago')) {
      const diff = data.status === 'pago' ? oldTx.amount : -oldTx.amount;
      const { data: account } = await admin.from("financial_accounts").select("current_balance").eq("id", oldTx.account_id).single();
      if (account) {
        await admin.from("financial_accounts").update({ current_balance: Number(account.current_balance) + diff }).eq("id", oldTx.account_id);
      }
    }

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

    // Update account balance if transaction was 'pago'
    if (tx.status === 'pago') {
      const { data: account } = await admin.from("financial_accounts").select("current_balance").eq("id", tx.account_id).single();
      if (account) {
        await admin.from("financial_accounts").update({ current_balance: Number(account.current_balance) - tx.amount }).eq("id", tx.account_id);
      }
    }

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