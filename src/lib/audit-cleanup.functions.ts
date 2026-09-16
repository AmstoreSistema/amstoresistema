import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Retorna os anos que possuem registros de auditoria e a quantidade em cada um
 */
export const getAuditYearsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: logs, error } = await supabaseAdmin
      .from("audit_log")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(50000);

    if (error) {
      console.error("Erro ao carregar resumo de anos da auditoria:", error);
      throw new Error(`Falha ao obter histórico de auditoria: ${error.message}`);
    }

    const yearCounts: Record<number, number> = {};
    const currentYear = new Date().getFullYear();

    // Inicializa pelo menos os últimos 3 anos
    for (let y = currentYear - 3; y <= currentYear; y++) {
      yearCounts[y] = 0;
    }

    (logs || []).forEach((row) => {
      if (row.created_at) {
        const y = new Date(row.created_at).getFullYear();
        if (!isNaN(y)) {
          yearCounts[y] = (yearCounts[y] || 0) + 1;
        }
      }
    });

    const summary = Object.entries(yearCounts)
      .map(([yearStr, count]) => ({
        year: Number(yearStr),
        count,
      }))
      .sort((a, b) => b.year - a.year);

    return summary;
  });

/**
 * Exclui todos os registros de auditoria de um ano específico
 */
export const purgeAuditLogsByYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({
      year: z.number().int().min(2000).max(2100),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { year } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userEmail = (context.claims?.email || "usuario").toLowerCase();

    const startIso = `${year}-01-01T00:00:00.000Z`;
    const endIso = `${year}-12-31T23:59:59.999Z`;

    // 1. Remove os registros do ano selecionado
    const { error, count } = await supabaseAdmin
      .from("audit_log")
      .delete({ count: "exact" })
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (error) {
      console.error(`Erro ao apagar auditoria do ano ${year}:`, error);
      throw new Error(`Falha ao excluir registros de ${year}: ${error.message}`);
    }

    const removedCount = count ?? 0;

    // 2. Registra no próprio log de auditoria a limpeza realizada
    try {
      await supabaseAdmin.from("audit_log").insert({
        action: "exclusao",
        entity: "audit_log",
        entity_id: String(year),
        details: `Limpeza de histórico de auditoria do ano ${year} realizada por ${userEmail}. Total de registros removidos: ${removedCount}`,
        user_email: userEmail,
      });
    } catch (e) {
      console.warn("Aviso ao registrar log da limpeza de auditoria:", e);
    }

    return {
      success: true,
      removedCount,
      year,
    };
  });
