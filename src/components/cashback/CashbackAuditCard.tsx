import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCashbackAudit } from "@/lib/cashback-cleanup.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Users, 
  Coins, 
  FileText, 
  XCircle,
  Clock,
  HelpCircle
} from "lucide-react";

export function CashbackAuditCard() {
  const fetchAudit = useServerFn(getCashbackAudit);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cashback-system-audit"],
    queryFn: async () => {
      try {
        const sRes = await fetchAudit();
        if (sRes && (sRes as any).success) {
          const res = sRes as any;
          return {
            total_clients: res.total_clients,
            clients_with_balance: res.clients_with_balance,
            total_circulating_balance: res.total_circulating_balance,
            total_entries: res.total_entries,
            reconciliation_divergences: res.reconciliation_divergences || [],
            entries_on_cancelled_sales: res.cancelled_sales_with_cashback || [],
            orphan_entries: res.orphan_entries || [],
            duplicate_credits: res.duplicate_credits || [],
            negative_balance_incidents: res.negative_balance_incidents || [],
            configs: res.configs || [],
            is_consistent:
              (res.reconciliation_divergences?.length || 0) === 0 &&
              (res.cancelled_sales_with_cashback?.length || 0) === 0 &&
              (res.orphan_entries?.length || 0) === 0 &&
              (res.duplicate_credits?.length || 0) === 0 &&
              (res.negative_balance_incidents?.length || 0) === 0,
          };
        }
      } catch (err) {
        console.warn("fetchAudit fallback to direct query:", err);
      }
      // 1. Clientes
      const { data: clients = [], error: clientsErr } = await supabase
        .from("clients")
        .select("id, name, phone, cashback_balance")
        .limit(5000);
      if (clientsErr) throw new Error("Erro ao buscar clientes: " + clientsErr.message);

      // 2. Cashback entries (paginado para garantir integridade total)
      const allEntries: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: batch, error: bErr } = await supabase
          .from("cashback_entries")
          .select("*")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (bErr) throw new Error("Erro ao buscar cashback_entries: " + bErr.message);
        if (!batch || batch.length === 0) break;
        allEntries.push(...batch);
        if (batch.length < pageSize) break;
        page++;
      }

      // 3. Vendas canceladas
      const { data: cancelledSales = [], error: salesErr } = await supabase
        .from("sales")
        .select("id, sale_code, status, total_amount, client_id, cashback_earned, cashback_used, created_at")
        .in("status", ["cancelled", "cancelada", "estornado"])
        .limit(5000);
      if (salesErr) throw new Error("Erro ao buscar vendas: " + salesErr.message);

      // 4. Configurações
      const { data: configs = [] } = await supabase
        .from("cashback_config")
        .select("*");

      const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

      // Ponto 1: Reconciliação
      const clientStats = new Map<string, {
        client: any;
        credits: number;
        debits: number;
        calculated: number;
        entriesCount: number;
      }>();

      for (const c of (clients || [])) {
        clientStats.set(c.id, {
          client: c,
          credits: 0,
          debits: 0,
          calculated: 0,
          entriesCount: 0,
        });
      }

      // Ponto 5: Histórico Negativo
      const negativeBalanceIncidents: any[] = [];
      const runningBalances = new Map<string, number>();

      const sortedEntries = [...allEntries].sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return da - db;
      });

      for (const e of sortedEntries) {
        if (!e.client_id) continue;
        let stat = clientStats.get(e.client_id);
        if (!stat) {
          stat = {
            client: { id: e.client_id, name: "CLIENTE EXCLUÍDO (" + String(e.client_id).slice(0, 8) + ")", cashback_balance: 0 },
            credits: 0,
            debits: 0,
            calculated: 0,
            entriesCount: 0,
          };
          clientStats.set(e.client_id, stat);
        }
        stat.entriesCount++;

        const rawAmt = Number(e.amount || 0);
        const kind = String(e.kind || "").toLowerCase().trim();
        const isDebit = kind === "used" || kind === "debito" || kind === "debit" || rawAmt < 0;
        const absAmt = Math.abs(rawAmt);

        if (isDebit) {
          stat.debits += absAmt;
          stat.calculated -= absAmt;
        } else {
          stat.credits += absAmt;
          stat.calculated += absAmt;
        }

        const currentRunning = (runningBalances.get(e.client_id) || 0) + (isDebit ? -absAmt : absAmt);
        runningBalances.set(e.client_id, currentRunning);
        if (currentRunning < -0.009) {
          negativeBalanceIncidents.push({
            client_id: e.client_id,
            client_name: stat.client.name,
            entry_id: e.id,
            amount: e.amount,
            kind: e.kind,
            running_balance: Number(currentRunning.toFixed(2)),
            created_at: e.created_at,
          });
        }
      }

      const reconciliationDivergences: any[] = [];
      for (const [clientId, data] of clientStats.entries()) {
        const saved = Number(data.client.cashback_balance || 0);
        const calculated = Number(data.calculated.toFixed(2));
        const difference = Number((calculated - saved).toFixed(2));
        if (Math.abs(difference) > 0.009) {
          reconciliationDivergences.push({
            client_id: clientId,
            client_name: data.client.name,
            phone: data.client.phone,
            calculated_balance: calculated,
            saved_balance: saved,
            difference: difference,
            total_credits: Number(data.credits.toFixed(2)),
            total_debits: Number(data.debits.toFixed(2)),
            entries_count: data.entriesCount,
          });
        }
      }

      // Ponto 2: Vendas Canceladas
      const cancelledSaleIds = new Set((cancelledSales || []).map((s: any) => s.id));
      const entriesOnCancelledSales: any[] = [];
      for (const e of allEntries) {
        if (e.sale_id && cancelledSaleIds.has(e.sale_id)) {
          const sale = (cancelledSales || []).find((s: any) => s.id === e.sale_id);
          entriesOnCancelledSales.push({
            entry_id: e.id,
            sale_id: e.sale_id,
            sale_code: sale?.sale_code,
            client_id: e.client_id,
            client_name: clientMap.get(e.client_id)?.name || "N/A",
            amount: e.amount,
            kind: e.kind,
            sale_status: sale?.status,
            sale_total: sale?.total_amount,
            created_at: e.created_at,
          });
        }
      }

      // Ponto 3: Órfãos
      const orphanEntries: any[] = [];
      for (const e of allEntries) {
        if (!e.client_id) {
          orphanEntries.push({ reason: "CLIENT_ID_NULL", entry: e });
        } else if (!clientMap.has(e.client_id)) {
          orphanEntries.push({ reason: "CLIENTE_NAO_EXISTE", entry: e });
        }
      }

      // Ponto 4: Duplicidade
      const creditsBySale = new Map<string, any[]>();
      for (const e of allEntries) {
        const rawAmt = Number(e.amount || 0);
        const kind = String(e.kind || "").toLowerCase().trim();
        const isCredit = kind === "earned" || (!["used", "debito", "debit"].includes(kind) && rawAmt > 0);
        if (e.sale_id && isCredit) {
          const list = creditsBySale.get(e.sale_id) || [];
          list.push(e);
          creditsBySale.set(e.sale_id, list);
        }
      }
      const duplicateCredits: any[] = [];
      for (const [saleId, list] of creditsBySale.entries()) {
        if (list.length > 1) {
          duplicateCredits.push({
            sale_id: saleId,
            credits_count: list.length,
            total_credited: list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
            entries: list,
          });
        }
      }

      const totalCirculating = (clients || []).reduce((s: number, c: any) => s + Number(c.cashback_balance || 0), 0);
      const clientsWithBalance = (clients || []).filter((c: any) => Number(c.cashback_balance || 0) > 0).length;

      return {
        total_clients: (clients || []).length,
        clients_with_balance: clientsWithBalance,
        total_circulating_balance: totalCirculating,
        total_entries: allEntries.length,
        reconciliation_divergences: reconciliationDivergences,
        entries_on_cancelled_sales: entriesOnCancelledSales,
        orphan_entries: orphanEntries,
        duplicate_credits: duplicateCredits,
        negative_balance_incidents: negativeBalanceIncidents,
        configs: configs,
        is_consistent:
          reconciliationDivergences.length === 0 &&
          entriesOnCancelledSales.length === 0 &&
          orphanEntries.length === 0 &&
          duplicateCredits.length === 0 &&
          negativeBalanceIncidents.length === 0,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <Card className="rounded-[1.75rem] border border-border/80 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden" id="cashback-audit-section">
      <CardHeader className="border-b border-border/40 pb-4 bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Auditoria de Integridade do Cashback
                {data && (
                  data.is_consistent ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold gap-1 text-xs">
                      <CheckCircle2 className="size-3" /> 100% Consistente
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="font-bold gap-1 text-xs">
                      <AlertTriangle className="size-3" /> Inconsistências Detectadas
                    </Badge>
                  )
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Auditoria diagnóstica em tempo real de saldos, movimentações, cancelamentos e órfãos
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar Auditoria
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" />
            <span className="text-sm font-medium">Auditoria em execução no banco de dados...</span>
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Não foi possível carregar o diagnóstico.</div>
        ) : (
          <>
            {/* Metricas Principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="audit-metrics-grid">
              <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3" /> Clientes na Base
                </p>
                <p className="text-2xl font-black mt-1" id="audit-total-clients">{data.total_clients}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5" id="audit-clients-with-balance">
                  {data.clients_with_balance} com saldo positivo
                </p>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Coins className="size-3 text-amber-500" /> Saldo em Circulação
                </p>
                <p className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400" id="audit-circulating-balance">
                  {brl(data.total_circulating_balance)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Soma de cashback_balance</p>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3" /> Movimentações (Log)
                </p>
                <p className="text-2xl font-black mt-1" id="audit-total-entries">{data.total_entries}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Tabela cashback_entries</p>
              </div>

              <div className="rounded-xl border border-border/50 bg-background/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3" /> Divergências de Saldo
                </p>
                <p className={`text-2xl font-black mt-1 ${data.reconciliation_divergences.length === 0 ? "text-emerald-600" : "text-red-600"}`} id="audit-divergences-count">
                  {data.reconciliation_divergences.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Soma log vs Saldo salvo</p>
              </div>
            </div>

            {/* Checklist dos 5 Pontos Auditados */}
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-5 space-y-3" id="audit-checklist-section">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Resultado Detalhado dos 5 Pontos de Verificação
              </h4>

              <div className="space-y-2.5 text-sm">
                {/* Ponto 1 */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border/40 bg-background/60" id="point-1-reconciliation">
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-2">
                      1. Reconciliação do Saldo Individual (SUM vs Saldo Salvo)
                      <Badge variant={data.reconciliation_divergences.length === 0 ? "outline" : "destructive"} className="text-[10px]">
                        {data.reconciliation_divergences.length === 0 ? "OK" : `${data.reconciliation_divergences.length} Divergência(s)`}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Compara a soma histórica de créditos menos débitos em cashback_entries contra o campo cashback_balance da tabela clients.
                    </p>
                    {data.reconciliation_divergences.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {data.reconciliation_divergences.slice(0, 5).map((d: any) => (
                          <div key={d.client_id} className="text-xs p-2 rounded bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300">
                            <strong>{d.client_name}:</strong> Saldo salvo: {brl(d.saved_balance)} | Histórico: {brl(d.calculated_balance)} | Diferença: {brl(d.difference)} ({d.entries_count} lançamentos)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {data.reconciliation_divergences.length === 0 ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Ponto 2 */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border/40 bg-background/60" id="point-2-cancelled-sales">
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-2">
                      2. Vendas Canceladas / Estornadas com Cashback Ativo
                      <Badge variant={data.entries_on_cancelled_sales.length === 0 ? "outline" : "destructive"} className="text-[10px]">
                        {data.entries_on_cancelled_sales.length === 0 ? "OK" : `${data.entries_on_cancelled_sales.length} Registro(s)`}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Verifica vendas com status cancelada/estornada onde o cashback gerado não foi devidamente estornado.
                    </p>
                    {data.entries_on_cancelled_sales.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {data.entries_on_cancelled_sales.slice(0, 5).map((e: any) => (
                          <div key={e.entry_id} className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                            Venda #{e.sale_code || e.sale_id?.slice(0,8)} ({e.client_name}): {brl(e.amount)} [{e.kind}]
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {data.entries_on_cancelled_sales.length === 0 ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Ponto 3 */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border/40 bg-background/60" id="point-3-orphan-entries">
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-2">
                      3. Registros Órfãos (client_id nulo ou inexistente)
                      <Badge variant={data.orphan_entries.length === 0 ? "outline" : "destructive"} className="text-[10px]">
                        {data.orphan_entries.length === 0 ? "OK" : `${data.orphan_entries.length} Órfão(s)`}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Verifica entradas de cashback sem client_id ou com client_id de cliente removido do sistema.
                    </p>
                    {data.orphan_entries.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {data.orphan_entries.slice(0, 5).map((o: any, idx: number) => (
                          <div key={idx} className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                            ID: {o.entry.id?.slice(0,8)} | Motivo: {o.reason} | Valor: {brl(o.entry.amount)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {data.orphan_entries.length === 0 ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Ponto 4 */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border/40 bg-background/60" id="point-4-duplicates">
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-2">
                      4. Duplicidade de Crédito por Venda
                      <Badge variant={data.duplicate_credits.length === 0 ? "outline" : "destructive"} className="text-[10px]">
                        {data.duplicate_credits.length === 0 ? "OK" : `${data.duplicate_credits.length} Duplicidade(s)`}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Verifica se há vendas com mais de um crédito de cashback registrado para o mesmo sale_id.
                    </p>
                    {data.duplicate_credits.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {data.duplicate_credits.slice(0, 5).map((d: any) => (
                          <div key={d.sale_id} className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                            Venda ID: {d.sale_id?.slice(0,8)} | {d.credits_count} créditos | Total: {brl(d.total_credited)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {data.duplicate_credits.length === 0 ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Ponto 5 */}
                <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-border/40 bg-background/60" id="point-5-negative-balances">
                  <div className="space-y-0.5">
                    <p className="font-bold flex items-center gap-2">
                      5. Histórico de Saldo Negativo (Running Balance &lt; 0)
                      <Badge variant={data.negative_balance_incidents.length === 0 ? "outline" : "destructive"} className="text-[10px]">
                        {data.negative_balance_incidents.length === 0 ? "OK" : `${data.negative_balance_incidents.length} Incidente(s)`}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reconstitui a linha do tempo cronológica de cada cliente para checar se o saldo algum dia ficou negativo.
                    </p>
                    {data.negative_balance_incidents.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {data.negative_balance_incidents.slice(0, 5).map((i: any, idx: number) => (
                          <div key={idx} className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                            {i.client_name}: Ficou com {brl(i.running_balance)} após {i.kind} de {brl(i.amount)} em {new Date(i.created_at).toLocaleDateString()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {data.negative_balance_incidents.length === 0 ? (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Resumo de Configurações Ativas (Ponto 6) */}
            <div className="p-4 rounded-xl border border-border/40 bg-background/40 space-y-2" id="audit-configs-summary">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                6. Regra Atual de Geração de Cashback (Configurações por Categoria)
              </p>
              <div className="flex flex-wrap gap-2">
                {(data.configs || []).map((cfg: any) => (
                  <Badge key={cfg.id} variant={cfg.active ? "secondary" : "outline"} className="text-xs px-2.5 py-1">
                    {cfg.category_name}: <strong className="ml-1">{cfg.cashback_percent}%</strong> {cfg.active ? "" : "(inativo)"}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
