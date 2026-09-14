import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRows<T = any>(
  table: string,
  opts?: {
    select?: string | undefined;
    order?: { column: string; ascending?: boolean | undefined } | undefined;
    limit?: number | undefined;
    filters?: { column: string; value: unknown; operator?: "eq" | "neq" | "gte" | "lte" | "gt" | "lt" | "in" }[] | undefined;
    dateRange?: { column: string; gte?: string | undefined; lte?: string | undefined } | undefined;
    enabled?: boolean | undefined;
    staleTime?: number | undefined;
  },
) {
  return useQuery({
    queryKey: [
      table,
      opts?.select ?? "*",
      opts?.order?.column ?? "",
      opts?.limit ?? 0,
      opts?.filters ?? [],
      opts?.dateRange?.column ?? "",
      opts?.dateRange?.gte ?? "",
      opts?.dateRange?.lte ?? "",
    ],
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? 5_000,
    queryFn: async () => {
      let q = supabase.from(table as any).select(opts?.select ?? "*");
      for (const f of opts?.filters ?? []) {
        if (f.operator === "neq") {
          q = q.neq(f.column, f.value as never);
        } else if (f.operator === "gte") {
          q = q.gte(f.column, f.value as never);
        } else if (f.operator === "lte") {
          q = q.lte(f.column, f.value as never);
        } else if (f.operator === "gt") {
          q = q.gt(f.column, f.value as never);
        } else if (f.operator === "lt") {
          q = q.lt(f.column, f.value as never);
        } else if (Array.isArray(f.value) || f.operator === "in") {
          q = q.in(f.column, f.value as never[]);
        } else {
          q = q.eq(f.column, f.value as never);
        }
      }
      if (opts?.dateRange?.column) {
        if (opts.dateRange.gte) q = q.gte(opts.dateRange.column, opts.dateRange.gte);
        if (opts.dateRange.lte) q = q.lte(opts.dateRange.column, opts.dateRange.lte);
      }
      if (opts?.order) q = q.order(opts.order.column, { ascending: opts.order.ascending ?? false });
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export async function logAudit(action: string, entity: string, details?: string, entityId?: string) {
  const { data } = await supabase.auth.getSession();
  await supabase.from("audit_log").insert({
    action,
    entity,
    details: details ?? null,
    entity_id: entityId ?? null,
    user_email: data.session?.user.email ?? null,
  } as any);
}

export function useSaveRow(table: string, label: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: Record<string, any> }) => {
      if (id) {
        const { data, error } = await supabase.from(table as any).update(values).eq("id", id).select().single();
        if (error) throw error;
        await logAudit("atualizar", table, `${label} atualizado`, id);
        return data as any;
      }
      const { data, error } = await supabase.from(table as any).insert(values).select().single();
      if (error) throw error;
      await logAudit("criar", table, `${label} criado`, (data as any)?.id);
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} salvo com sucesso`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
}

export function useDeleteRow(table: string, label: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
      await logAudit("excluir", table, `${label} excluído`, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} excluído`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
}