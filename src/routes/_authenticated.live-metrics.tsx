import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Coins,
  CreditCard,
  Factory,
  HandCoins,
  Package,
  Radio,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/data";
import { brl, dateTimeBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/live-metrics")({
  head: () => ({
    meta: [
      { title: "Métricas ao Vivo — Amstore Gestão" },
      {
        name: "description",
        content: "Indicadores em tempo real de vendas, caixa, fiado, produção e estoque da Amstore.",
      },
      { property: "og:title", content: "Métricas ao Vivo — Amstore Gestão" },
      {
        property: "og:description",
        content: "Acompanhe vendas, recebimentos, fiado e produção atualizando em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveMetrics,
});

const WATCHED = [
  "sales",
  "sale_items",
  "sale_payments",
  "sale_installments",
  "transactions",
  "financial_accounts",
  "production_orders",
  "materials",
  "products",
  "clients",
  "cashback_entries",
];

const isToday = (v: string | null | undefined) =>
  !!v && new Date(v).toDateString() === new Date().toDateString();

function LiveMetrics() {
  const qc = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date());
  const [live, setLive] = useState(false);
  const [pulses, setPulses] = useState<{ id: string; table: string; event: string; at: Date }[]>([]);

  const { data: sales = [] } = useRows<any>("sales", { order: { column: "created_at", ascending: false }, limit: 400 });
  const { data: saleItems = [] } = useRows<any>("sale_items", { limit: 2000 });
  const { data: payments = [] } = useRows<any>("sale_payments", { limit: 500 });
  const { data: installments = [] } = useRows<any>("sale_installments", { limit: 1000 });
  const { data: transactions = [] } = useRows<any>("transactions", {
    order: { column: "created_at", ascending: false },
    limit: 400,
  });
  const { data: accounts = [] } = useRows<any>("financial_accounts");
  const { data: orders = [] } = useRows<any>("production_orders", {
    order: { column: "created_at", ascending: false },
    limit: 200,
  });
  const { data: materials = [] } = useRows<any>("materials");
  const { data: products = [] } = useRows<any>("products");
  const { data: clients = [] } = useRows<any>("clients");

  useEffect(() => {
    const channel = supabase.channel("live-metrics");
    for (const table of WATCHED) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload: any) => {
        setPulses((p) =>
          [{ id: crypto.randomUUID(), table, event: payload.eventType as string, at: new Date() }, ...p].slice(0, 12),
        );
        void qc.invalidateQueries({ queryKey: [table] });
        setLastUpdate(new Date());
      });
    }
    channel.subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    const t = setInterval(() => {
      for (const table of WATCHED) {
        void qc.invalidateQueries({ queryKey: [table] });
      }
      setLastUpdate(new Date());
    }, 30000);
    return () => clearInterval(t);
  }, [qc]);

  const m = useMemo(() => {
    const salesToday = sales.filter((s: any) => isToday(s.created_at));
    const revenueToday = salesToday.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);
    const receivedToday = payments
      .filter((p: any) => isToday(p.created_at || p.paid_at))
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const expensesToday = transactions
      .filter((t: any) => t.type === "despesa" && isToday(t.created_at))
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    const openInstallments = installments.filter(
      (i: any) => !["paid", "pago"].includes(String(i.status || "").toLowerCase()),
    );
    const openDebt = openInstallments.reduce(
      (sum: number, i: any) => sum + (Number(i.amount || 0) - Number(i.paid_amount || 0)),
      0,
    );
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const overdue = openInstallments.filter((i: any) => i.due_date && new Date(i.due_date) < today0);

    const byHour = Array.from({ length: 24 }, (_, h) => ({
      h,
      total: salesToday
        .filter((s: any) => new Date(s.created_at).getHours() === h)
        .reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0),
    }));

    const payMix = salesToday.reduce<Record<string, number>>((acc, s: any) => {
      const k = String(s.payment_method || "não informado");
      acc[k] = (acc[k] ?? 0) + Number(s.total_amount || 0);
      return acc;
    }, {});

    const todayIds = new Set(salesToday.map((s: any) => s.id));
    const itemsToday = saleItems.filter((i: any) => todayIds.has(i.sale_id));
    const topProducts = Object.entries(
      itemsToday.reduce<Record<string, number>>((acc, i: any) => {
        const name = products.find((p: any) => p.id === i.product_id)?.name ?? "Produto";
        acc[name] = (acc[name] ?? 0) + Number(i.quantity || 0);
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      salesToday,
      revenueToday,
      receivedToday,
      expensesToday,
      ticket: salesToday.length ? revenueToday / salesToday.length : 0,
      openDebt,
      overdue,
      byHour,
      payMix,
      topProducts,
      itemsToday: itemsToday.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0),
      cashTotal: accounts.reduce((s: number, a: any) => s + Number(a.balance || 0), 0),
      activeOrders: orders.filter((o: any) => ["pendente", "em_producao"].includes(o.status)).length,
      criticalMaterials: materials.filter((x: any) => Number(x.current_stock) <= Number(x.min_stock)),
      lowProducts: products.filter((p: any) => Number(p.current_stock) <= Number(p.min_stock)).length,
      cashbackTotal: clients.reduce((s: number, c: any) => s + Number(c.cashback_balance || 0), 0),
      newClientsToday: clients.filter((c: any) => isToday(c.created_at)).length,
    };
  }, [sales, saleItems, payments, installments, transactions, accounts, orders, materials, products, clients]);

  const maxHour = Math.max(1, ...m.byHour.map((b) => b.total));
  const payTotal = Object.values(m.payMix).reduce((a, b) => a + b, 0) || 1;
  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas ao Vivo"
        description="Indicadores do dia atualizados automaticamente a cada movimento no sistema."
        icon={Activity}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={live ? "default" : "secondary"} className="gap-2 rounded-full">
              <Radio className={live ? "size-3 animate-pulse" : "size-3"} />
              {live ? "AO VIVO" : "CONECTANDO"}
            </Badge>
            <span className="text-xs text-muted-foreground">Atualizado {dateTimeBR(lastUpdate.toISOString())}</span>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Vendas hoje" value={m.salesToday.length} sub={`${num(m.itemsToday, 0)} itens vendidos`} icon={ShoppingCart} tone="gold" to="/sales" />
        <StatCard title="Faturamento hoje" value={brl(m.revenueToday)} sub={`Ticket médio ${brl(m.ticket)}`} icon={TrendingUp} tone="success" to="/reports" />
        <StatCard title="Recebido hoje" value={brl(m.receivedToday)} sub={`Despesas ${brl(m.expensesToday)}`} icon={CreditCard} tone="info" to="/transactions" />
        <StatCard title="Saldo em caixa" value={brl(m.cashTotal)} sub={`${accounts.length} conta(s)`} icon={Wallet} tone="dark" to="/accounts" />
        <StatCard title="Fiado em aberto" value={brl(m.openDebt)} sub={`${m.overdue.length} parcela(s) vencida(s)`} icon={HandCoins} tone={m.overdue.length ? "destructive" : "warning"} to="/credit" />
        <StatCard title="Ordens ativas" value={m.activeOrders} sub={`${orders.length} ordens no total`} icon={Factory} tone="dark" to="/production" />
        <StatCard title="Alertas de estoque" value={m.criticalMaterials.length + m.lowProducts} sub={`${m.criticalMaterials.length} materiais · ${m.lowProducts} produtos`} icon={AlertTriangle} tone={m.criticalMaterials.length + m.lowProducts ? "destructive" : "success"} to="/stock" />
        <StatCard title="Cashback acumulado" value={brl(m.cashbackTotal)} sub={`${clients.length} clientes · ${m.newClientsToday} novos hoje`} icon={Coins} tone="gold" to="/cashback" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendas por hora (hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-1">
              {m.byHour.map((b) => (
                <div key={b.h} className="flex flex-1 flex-col items-center gap-1" title={`${b.h}h — ${brl(b.total)}`}>
                  <div
                    className="w-full rounded-t bg-gradient-gold transition-all"
                    style={{ height: `${Math.max(2, (b.total / maxHour) * 100)}%`, opacity: b.total ? 1 : 0.15 }}
                  />
                  {b.h % 3 === 0 && <span className="text-[9px] text-muted-foreground">{b.h}h</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Formas de pagamento (hoje)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(m.payMix).length === 0 && (
              <p className="py-8 text-center text-sm italic text-muted-foreground">Nenhuma venda registrada hoje.</p>
            )}
            {Object.entries(m.payMix)
              .sort((a, b) => b[1] - a[1])
              .map(([method, total]) => (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="uppercase tracking-wide text-muted-foreground">{method}</span>
                    <span className="font-semibold tabular-nums">{brl(total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${(total / payTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top produtos do dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.topProducts.length === 0 && (
              <p className="py-6 text-center text-sm italic text-muted-foreground">Sem itens vendidos hoje.</p>
            )}
            {m.topProducts.map(([name, qty], i) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-gold/10 text-xs font-bold text-gold">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{num(qty, 0)} un</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Últimas vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sales.slice(0, 6).map((s: any) => {
              const client = s.client_id ? clientById.get(s.client_id) : null;
              const clientName = client?.name || (s.client_name ? s.client_name : "Consumidor");
              return (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate text-foreground">{clientName}</p>
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        #{s.sale_code ?? s.id.slice(0, 6)}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      {dateTimeBR(s.created_at)} · {s.payment_method ?? "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-foreground shrink-0">{brl(s.total_amount)}</span>
                </div>
              );
            })}
            {sales.length === 0 && (
              <p className="py-6 text-center text-sm italic text-muted-foreground">Nenhuma venda registrada.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> Eventos em tempo real
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pulses.length === 0 && (
              <p className="py-6 text-center text-sm italic text-muted-foreground">
                Aguardando movimentações no sistema…
              </p>
            )}
            {pulses.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground">{p.table}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{p.event}</Badge>
                  {p.at.toLocaleTimeString("pt-BR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {m.criticalMaterials.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="size-4" /> Materiais em nível crítico
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {m.criticalMaterials.slice(0, 9).map((mat: any) => (
              <div key={mat.id} className="flex items-center justify-between rounded-xl border border-destructive/20 bg-card p-3">
                <span className="text-sm font-medium">{mat.name}</span>
                <span className="text-sm font-bold text-destructive tabular-nums">
                  {num(mat.current_stock)} {mat.unit}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
