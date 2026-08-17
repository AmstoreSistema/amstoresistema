import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRows<T = any>(
  table: string,
  opts?: {
    select?: string | undefined;
    order?: { column: string; ascending?: boolean | undefined } | undefined;
    limit?: number | undefined;
    filters?: { column: string; value: unknown }[] | undefined;
  },
) {
  return useQuery({
    queryKey: [table, opts?.select ?? "*", opts?.order?.column ?? "", opts?.limit ?? 0, opts?.filters ?? []],
    queryFn: async () => {
      let q = supabase.from(table as any).select(opts?.select ?? "*");
      for (const f of opts?.filters ?? []) {
        if (Array.isArray(f.value)) {
          q = q.in(f.column, f.value as never[]);
        } else {
          q = q.eq(f.column, f.value as never);
        }
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
        const { error } = await supabase.from(table as any).update(values).eq("id", id);
        if (error) throw error;
        await logAudit("atualizar", table, `${label} atualizado`, id);
      } else {
        const { error } = await supabase.from(table as any).insert(values);
        if (error) throw error;
        await logAudit("criar", table, `${label} criado`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
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
      qc.invalidateQueries();
      toast.success(`${label} excluído`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
}