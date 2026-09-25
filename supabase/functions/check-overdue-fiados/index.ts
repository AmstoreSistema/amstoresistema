import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Data no fuso horário padronizado do sistema: Brasília (America/Sao_Paulo)
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    // Busca parcelas de fiado vencidas com status pendente
    const { data: overdueList, error } = await supabase
      .from("sale_installments")
      .select("id, amount, paid_amount, due_date, status, sale_id")
      .not("status", "in", "('paga','paid','quitada','cancelada')")
      .lt("due_date", today);

    if (error) {
      throw new Error(`Erro ao buscar fiados vencidos: ${error.message}`);
    }

    const count = overdueList?.length || 0;
    if (count === 0) {
      console.log(`[check-overdue-fiados] Nenhum fiado vencido hoje (${today}).`);
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "Nenhum fiado vencido hoje." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcula valor total pendente
    const totalPending = (overdueList || []).reduce((acc: number, curr: any) => {
      const remaining = Number(curr.amount || 0) - Number(curr.paid_amount || 0);
      return acc + (remaining > 0 ? remaining : 0);
    }, 0);

    const formattedTotal = totalPending.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const title = "⚠️ Fiados Vencidos";
    const body = `${count} ${
      count === 1 ? "fiado vencido hoje" : "fiados vencidos hoje"
    }, totalizando ${formattedTotal}. Toque para gerenciar.`;

    // Dispara a Edge Function genérica de push
    const pushEndpoint = `${supabaseUrl}/functions/v1/send-push-notification`;
    const pushRes = await fetch(pushEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        title,
        body,
        data: {
          type: "overdue_installments",
          count: String(count),
          total: String(totalPending),
          url: "/credit",
        },
      }),
    });

    const pushResult = await pushRes.json().catch(() => ({}));

    console.log(`[check-overdue-fiados] Notificação consolidada enviada para ${count} fiados vencidos.`, pushResult);

    return new Response(
      JSON.stringify({
        success: true,
        overdueCount: count,
        totalPending,
        notification: pushResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[check-overdue-fiados] Erro ao processar:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
