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

const FRIENDLY_FIELD_NAMES: Record<string, string> = {
  name: "nome",
  nome: "nome",
  phone: "telefone",
  email: "e-mail",
  address: "endereço",
  notes: "observações",
  document_cpf: "CPF",
  document: "documento",
  birth_date: "data de nascimento",
  zip_code: "CEP",
  city: "cidade",
  state: "UF",
  client_type: "tipo de cliente",
  cost_price: "custo",
  retail_price: "preço de venda",
  wholesale_price: "preço atacado",
  category: "categoria",
  quantidade_disponivel: "estoque",
  localizacao: "localização",
  status: "status",
};

export function useSaveRow(table: string, label: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: Record<string, any> }) => {
      let itemName = values["name"] || values["nome"] || values["title"] || values["description"] || values["produto_nome"] || "";

      if (id) {
        // Se values não contiver o nome (ex.: alterou apenas telefone ou endereço), busca o nome do registro atual
        if (!itemName) {
          try {
            const { data: existing } = await supabase
              .from(table as any)
              .select("name, nome, title, description, produto_nome, sku")
              .eq("id", id)
              .maybeSingle();
            if (existing) {
              itemName = (existing as any).name || (existing as any).nome || (existing as any).title || (existing as any).produto_nome || (existing as any).description || "";
            }
          } catch {
            // fallback
          }
        }

        const { data, error } = await supabase.from(table as any).update(values).eq("id", id).select().single();
        if (error) throw error;

        const alteredKeys = Object.keys(values).filter(k => !["id", "created_at", "updated_at"].includes(k));
        const alteredLabels = alteredKeys.map(k => FRIENDLY_FIELD_NAMES[k] || k).slice(0, 4).join(", ");
        const summaryText = itemName
          ? `Alterou ${label}: "${itemName}"${alteredLabels ? ` (${alteredLabels})` : ""}`
          : `Alterou ${label}${alteredLabels ? ` (${alteredLabels})` : ""}`;

        const auditPayload = JSON.stringify({
          resumo: summaryText,
          acao: "ATUALIZACAO",
          entidade: label,
          nome: itemName,
          id,
          campos_alterados: alteredLabels,
          campos: values,
        });

        await logAudit("atualizar", table, auditPayload, id);
        return data as any;
      }

      const { data, error } = await supabase.from(table as any).insert(values).select().single();
      if (error) throw error;

      const newId = (data as any)?.id;
      if (!itemName && data) {
        itemName = (data as any).name || (data as any).nome || (data as any).title || (data as any).produto_nome || "";
      }

      const summaryText = itemName
        ? `Cadastrou novo ${label}: "${itemName}"`
        : `Cadastrou novo ${label}`;

      const auditPayload = JSON.stringify({
        resumo: summaryText,
        acao: "CRIACAO",
        entidade: label,
        nome: itemName,
        id: newId,
        dados: values,
      });

      await logAudit("criar", table, auditPayload, newId);
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
      // Tenta obter o nome/descrição do item antes de excluir para auditoria legível
      let itemName = "";
      try {
        const { data: item } = await supabase
          .from(table as any)
          .select("name, nome, title, description, sale_code")
          .eq("id", id)
          .maybeSingle();
        if (item) {
          itemName = (item as any).name || (item as any).nome || (item as any).title || (item as any).sale_code || (item as any).description || "";
        }
      } catch {
        // fallback silencioso
      }

      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;

      const summaryText = itemName
        ? `Excluiu ${label}: "${itemName}"`
        : `Excluiu ${label}`;

      const auditPayload = JSON.stringify({
        resumo: summaryText,
        acao: "EXCLUSAO",
        entidade: label,
        identificador: itemName || id,
        id,
      });

      await logAudit("excluir", table, auditPayload, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} excluído`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
}