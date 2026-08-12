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
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("transactions")
      .insert({
        type: data.type,
        amount: data.type === "saida" ? -Math.abs(data.amount) : Math.abs(data.amount),
        description: data.description,
        account_id: data.account_id,
        category: data.category || null,
        status: data.status,
        due_date: data.due_date || null,
        reference_id: data.reference_id || null,
        reference_type: data.reference_type || null
      });

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateTransactionStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string(),
    status: z.enum(["pago", "pendente", "cancelado"]),
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("transactions")
      .update({ status: data.status })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: id }) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
