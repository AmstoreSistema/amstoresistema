import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatSaleDateISO } from "@/lib/format";

export const createTransaction = createServerFn({ method: "POST" })
  .validator((data) => z.object({
    type: z.enum(["entrada", "saida", "transferencia"]),
    amount: z.number().positive(),
    description: z.string(),
    account_id: z.string(),
    category: z.string().optional().nullable(),
    status: z.enum(["pago", "pendente", "cancelado"]).default("pago"),
    due_date: z.string().optional().nullable(),
    created_at: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    observations: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    supplier_id: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const finalDescription = data.observations?.trim()
      ? `${data.description.trim()} (${data.observations.trim()})`
      : data.description.trim();

    const createdAt = data.created_at
      ? data.created_at
      : (data.due_date ? formatSaleDateISO(data.due_date) : new Date().toISOString());

    const { error } = await admin
      .from("transactions")
      .insert({
        type: data.type,
        amount: data.type === "saida" ? -Math.abs(data.amount) : Math.abs(data.amount),
        description: finalDescription,
        account_id: data.account_id,
        category: data.category ?? null,
        status: data.status,
        due_date: data.due_date ? data.due_date : null,
        created_at: createdAt,
        payment_method: data.payment_method ?? null,
        client_id: data.client_id ?? null,
        supplier_id: data.supplier_id ?? null
      } as any);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .validator((data) => z.object({
    id: z.string(),
    type: z.enum(["entrada", "saida", "transferencia"]),
    amount: z.number(),
    description: z.string(),
    account_id: z.string(),
    category: z.string().optional().nullable(),
    status: z.enum(["pago", "pendente", "cancelado"]),
    due_date: z.string().optional().nullable(),
    created_at: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    observations: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    supplier_id: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    // Get old transaction for balance diff calculation
    const { data: oldTx } = await admin.from("transactions").select("*").eq("id", data.id).single();
    if (!oldTx) throw new Error("Transação não encontrada");

    const finalDescription = data.observations?.trim() && !data.description.includes(data.observations.trim())
      ? `${data.description.trim()} (${data.observations.trim()})`
      : data.description.trim();

    const updatePayload: {
      type: string;
      amount: number;
      description: string;
      account_id: string;
      category: string | null;
      status: string;
      due_date: string | null;
      payment_method: string | null;
      client_id: string | null;
      supplier_id: string | null;
      created_at?: string;
    } = {
      type: data.type,
      amount: data.type === "saida" ? -Math.abs(data.amount) : Math.abs(data.amount),
      description: finalDescription,
      account_id: data.account_id,
      category: data.category ?? null,
      status: data.status,
      due_date: data.due_date ? data.due_date : null,
      payment_method: data.payment_method ?? null,
      client_id: data.client_id ?? null,
      supplier_id: data.supplier_id ?? null
    };

    // Sincroniza a data da transação (created_at) para que a listagem e relatórios reflitam a nova data
    if (data.created_at) {
      updatePayload.created_at = data.created_at;
    } else if (data.due_date) {
      updatePayload.created_at = formatSaleDateISO(data.due_date);
    }

    const { error } = await admin
      .from("transactions")
      .update(updatePayload as any)
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    // A atualização de saldo agora é feita via trigger (transaction_balance_trigger) no banco de dados.
    return { success: true };
  });

export const updateTransactionStatus = createServerFn({ method: "POST" })
  .validator((data) => z.object({
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
  .validator((data) => z.string().parse(data))
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

/**
 * Ajusta o saldo de uma conta criando uma transação de ajuste auditável.
 * Em vez de sobrescrever current_balance diretamente, calcula a diferença
 * entre o novo saldo desejado e o saldo atual, e insere uma transação
 * do tipo 'entrada' ou 'saida' com categoria "Ajuste de saldo" para que
 * o trigger de balanço recalcule o current_balance automaticamente.
 *
 * Isso garante rastreabilidade total: toda mudança de saldo fica registrada
 * no histórico de transações com data, descrição e valor.
 */
export const updateAccountBalance = createServerFn({ method: "POST" })
  .validator((data) => z.object({
    id: z.string(),
    current_balance: z.number(),
    // Campo opcional: saldo anterior (para calcular diff sem re-consultar o banco)
    previous_balance: z.number().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Lê o saldo atual real para calcular a diferença
    const { data: acc, error: readErr } = await admin
      .from("financial_accounts")
      .select("current_balance, name")
      .eq("id", data.id)
      .single();

    if (readErr || !acc) throw new Error(readErr?.message ?? "Conta não encontrada");

    const currentBalance = Number(data.previous_balance ?? acc.current_balance ?? 0);
    const newBalance = Number(data.current_balance ?? 0);
    const diff = newBalance - currentBalance;

    // Se não há diferença real, não faz nada
    if (Math.abs(diff) < 0.009) {
      return { success: true, adjusted: false, diff: 0 };
    }

    // 2. Cria transação de ajuste auditável
    const isIncrease = diff > 0;
    const txType = isIncrease ? "entrada" : "saida";
    const txAmount = Math.abs(diff);
    const txDescription = `Ajuste de saldo — conta "${acc.name}"`;

    const { error: txErr } = await admin
      .from("transactions")
      .insert({
        type: txType,
        amount: isIncrease ? txAmount : -txAmount,
        description: txDescription,
        account_id: data.id,
        category: "Ajuste de saldo",
        status: "pago",
        created_at: new Date().toISOString(),
        payment_method: null,
        client_id: null,
        supplier_id: null,
      } as any);

    if (txErr) throw new Error(txErr.message);

    // 3. Fallback: atualiza current_balance diretamente caso o banco
    //    não tenha o trigger transaction_balance_trigger configurado.
    //    (seguro duplicar pois o trigger idempotente deve ter precedência)
    await admin
      .from("financial_accounts")
      .update({ current_balance: newBalance } as any)
      .eq("id", data.id);

    return { success: true, adjusted: true, diff, type: txType };
  });

export const deleteFinancialAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ id: z.string() }).parse(data))
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

export const saveCustomTransactionCategory = createServerFn({ method: "POST" })
  .validator((data) => z.object({
    type: z.enum(["saida", "entrada"]),
    category: z.string().min(1, "Nome da categoria é obrigatório")
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = data.type === "saida" ? "custom_expense_categories" : "custom_income_categories";
    
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    let currentList: string[] = [];
    if (existing?.value) {
      try {
        currentList = typeof existing.value === "string" ? JSON.parse(existing.value) : existing.value;
      } catch {
        currentList = [];
      }
    }
    if (!Array.isArray(currentList)) currentList = [];

    const trimmed = data.category.trim();
    if (!currentList.includes(trimmed)) {
      currentList.push(trimmed);
      await supabaseAdmin
        .from("app_settings")
        .upsert({
          key,
          value: JSON.stringify(currentList),
          updated_at: new Date().toISOString()
        });
    }

    return { success: true, categories: currentList };
  });

export const syncExistingTransactionCategories = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Busca todas as categorias já lançadas no banco
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("category, type")
      .not("category", "is", null);

    const expenseCats = new Set<string>();
    const incomeCats = new Set<string>();

    (txs || []).forEach((t: any) => {
      const cat = typeof t.category === "string" ? t.category.trim() : "";
      if (!cat) return;
      if (t.type === "saida" || t.type === "expense") {
        expenseCats.add(cat);
      } else if (t.type === "entrada" || t.type === "income") {
        incomeCats.add(cat);
      }
    });

    // 2. Busca o que já estiver salvo em app_settings
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["custom_expense_categories", "custom_income_categories"]);

    const expSetting = settings?.find((s: any) => s.key === "custom_expense_categories");
    const incSetting = settings?.find((s: any) => s.key === "custom_income_categories");

    let currentExp: string[] = [];
    if (expSetting?.value) {
      try {
        currentExp = typeof expSetting.value === "string" ? JSON.parse(expSetting.value) : expSetting.value;
      } catch {}
    }
    let currentInc: string[] = [];
    if (incSetting?.value) {
      try {
        currentInc = typeof incSetting.value === "string" ? JSON.parse(incSetting.value) : incSetting.value;
      } catch {}
    }

    if (Array.isArray(currentExp)) currentExp.forEach(c => c && expenseCats.add(c.trim()));
    if (Array.isArray(currentInc)) currentInc.forEach(c => c && incomeCats.add(c.trim()));

    const finalExp = Array.from(expenseCats);
    const finalInc = Array.from(incomeCats);

    await supabaseAdmin.from("app_settings").upsert([
      { key: "custom_expense_categories", value: JSON.stringify(finalExp), updated_at: new Date().toISOString() },
      { key: "custom_income_categories", value: JSON.stringify(finalInc), updated_at: new Date().toISOString() },
    ]);

    return { success: true, expenseCategories: finalExp, incomeCategories: finalInc };
  });