import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  BookMarked,
  Coins,
  HandCoins,
  Landmark,
  Package,
  ShoppingCart,
  Store,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/data";
import { brl, dateTimeBR, num } from "@/lib/format";
import { BirthdayAlertCard } from "@/components/BirthdayAlertCard";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({
    meta: [
      { title: "Painel da Loja — Amstore Gestão" },
      {
        name: "description",
        content:
          "Painel de controle da loja: vendas do dia, faturamento, fiado em aberto, cashback e saldo das contas.",
      },
      { property: "og:title", content: "Painel da Loja — Amstore Gestão" },
      {
        property: "og:description",
        content: "Acompanhe vendas, fiado, cashback e caixa da loja em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePanel,
});

type Period = 7 | 30 | 90;

function StorePanel() {
  const [period, setPeriod] = useState<Period>(30);

  const { data: sales = [] } = useRows<any>("sales", {
    order: { column: "created_at", ascending: false },
    limit: 500,
  });
  const { data: saleItems = [] } = useRows<any>("sale_items", { limit: 2000 });
  const { data: products = [] } = useRows<any>("products");
  const { data: clients = [] } = useRows<any>("clients");
  const { data: accounts = [] } = useRows<any>("financial_accounts");
  const { data: installments = [] } = useRows<any>("sale_installments", { limit: 1000 });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const periodStart = startOfToday - (period - 1) * 86400000;

  const activeSales = useMemo(
    () => sales.filter((s: any) => (s.status ?? "concluida") !== "cancelada"),
    [sales],
  );

  const salesToday = useMemo(
    () =>
      activeSales.filter(
        (s: any) => s.created_at && new Date(s.created_at).getTime() >= startOfToday,
      ),
    [activeSales, startOfToday],
  );

  const salesPeriod = useMemo(
    () =>
      activeSales.filter(
        (s: any) => s.created_at && new Date(s.created_at).getTime() >= periodStart,
      ),
    [activeSales, periodStart],
  );

  const revenueToday = salesToday.reduce((a: number, s: any) => a + Number(s.total_amount ?? 0), 0);
  const revenuePeriod = salesPeriod.reduce(
    (a: number, s: any) => a + Number(s.total_amount ?? 0),
    0,
  );
  const ticket = salesPeriod.length ? revenuePeriod / salesPeriod.length : 0;

  const openCredit = useMemo(
    () =>
      activeSales
        .filter((s: any) => s.is_debt)
        .reduce(
          (a: number, s: any) =>
            a + Math.max(0, Number(s.total_amount ?? 0) - Number(s.paid_amount ?? 0)),
          0,
        ),
    [activeSales],
  );

  const overdueCount = useMemo(
    () =>
      installments.filter(
        (i: any) =>
          i.status !== "paga" &&
          i.status !== "paid" &&
          i.due_date &&
          new Date(i.due_date).getTime() < startOfToday,
      ).length,
    [installments, startOfToday],
  );

  const cashbackTotal = useMemo(
    () => clients.reduce((a: number, c: any) => a + Number(c.cashback_balance ?? 0), 0),
    [clients],
  );

  const activeAccount = useMemo(
    () => accounts.find((a: any) => a.active) ?? accounts[0],
    [accounts],
  );
  const totalBalance = useMemo(
    () => accounts.reduce((a: number, x: any) => a + Number(x.current_balance ?? 0), 0),
    [accounts],
  );

  const paymentMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of salesPeriod) {
      const key = (s.payment_method ?? "outros").toString();
      map.set(key, (map.get(key) ?? 0) + Number(s.total_amount ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [salesPeriod]);

  const topProducts = useMemo(() => {
    const periodSaleIds = new Set(salesPeriod.map((s: any) => s.id));
    const productName = new Map(products.map((p: any) => [p.id, p.name]));
    const map = new Map<string, { name: string; qty: number; total: number }>();
    for (const it of saleItems) {
      if (!periodSaleIds.has(it.sale_id)) continue;
      const name = productName.get(it.product_id) ?? "Produto removido";
      const cur = map.get(name) ?? { name, qty: 0, total: 0 };
      cur.qty += Number(it.quantity ?? 0);
      cur.total += Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [saleItems, salesPeriod, products]);

  const clientName = useMemo(
    () => new Map(clients.map((c: any) => [c.id, c.name])),
    [clients],
  );

  const [topClientsScope, setTopClientsScope] = useState<"all" | "period">("all");

  const { data: topClients = [], isLoading: isLoadingTopClients } = useQuery({
    queryKey: ["store-top-clients", topClientsScope, period],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("client_id, total_amount, created_at, clients(id, name)")
        .neq("status", "cancelada")
        .not("client_id", "is", null);

      if (topClientsScope === "period") {
        const periodIso = new Date(periodStart).toISOString();
        q = q.gte("created_at", periodIso);
      }

      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, { id: string; name: string; total: number; count: number }>();
      for (const s of (data || []) as any[]) {
        if (!s.client_id) continue;
        const name = s.clients?.name || clientName.get(s.client_id) || "Cliente";
        const cur = map.get(s.client_id) || { id: s.client_id, name, total: 0, count: 0 };
        cur.total += Number(s.total_amount || 0);
        cur.count += 1;
        map.set(s.client_id, cur);
      }

      return Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  const recentSales = salesPeriod.slice(0, 8);
  const maxMix = paymentMix[0]?.[1] ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Painel de controle da Loja"
        description="Visão consolidada das vendas, fiado, cashback e caixa da loja."
        icon={Store}
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-border p-1">
            {([7, 30, 90] as Period[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? "default" : "ghost"}
                onClick={() => setPeriod(p)}
              >
                {p} dias
              </Button>
            ))}
          </div>
        }
      />

      {/* Cartão de Alerta de Aniversariantes de Hoje */}
      <BirthdayAlertCard />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Vendas hoje"
          value={salesToday.length}
          sub={`${brl(revenueToday)} faturado hoje`}
          icon={ShoppingCart}
          tone="gold"
          to="/sales"
        />
        <StatCard
          title={`Faturamento (${period}d)`}
          value={brl(revenuePeriod)}
          sub={`Ticket médio ${brl(ticket)}`}
          icon={TrendingUp}
          tone="success"
          to="/reports"
        />
        <StatCard
          title="Fiado em aberto"
          value={brl(openCredit)}
          sub={overdueCount ? `${overdueCount} parcela(s) em atraso` : "Sem parcelas em atraso"}
          icon={HandCoins}
          tone={overdueCount ? "destructive" : "info"}
          to="/credit"
        />
        <StatCard
          title="Saldo em contas"
          value={brl(totalBalance)}
          sub={activeAccount ? `Conta ativa: ${activeAccount.name}` : "Nenhuma conta cadastrada"}
          icon={Landmark}
          tone="dark"
          to="/accounts"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          title="Clientes"
          value={num(clients.length, 0)}
          sub="Cadastrados na loja"
          icon={Users}
          tone="info"
          to="/clients"
        />
        <StatCard
          title="Cashback acumulado"
          value={brl(cashbackTotal)}
          sub={`${clients.filter((c: any) => Number(c.cashback_balance ?? 0) > 0).length} cliente(s) com saldo`}
          icon={Coins}
          tone="warning"
          to="/cashback"
        />
        <StatCard
          title="Produtos ativos"
          value={num(products.filter((p: any) => p.active !== false).length, 0)}
          sub={`${products.filter((p: any) => Number(p.current_stock ?? 0) <= Number(p.min_stock ?? 0)).length} com estoque baixo`}
          icon={Package}
          tone="dark"
          to="/products"
        />
        <StatCard
          title={`Vendas (${period}d)`}
          value={num(salesPeriod.length, 0)}
          sub="Total de pedidos no período"
          icon={Wallet}
          tone="success"
          to="/sales"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formas de pagamento ({period} dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMix.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
            )}
            {paymentMix.map(([method, total]) => (
              <div key={method} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{method.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{brl(total)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-gold"
                    style={{ width: `${maxMix ? (total / maxMix) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos mais vendidos ({period} dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum item vendido no período.</p>
            )}
            {topProducts.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{num(p.qty, 0)} unidade(s)</p>
                </div>
                <span className="text-sm font-semibold">{brl(p.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimas vendas</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/sales">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSales.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada no período.</p>
            )}
            {recentSales.map((s: any) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.sale_code ?? `Venda ${String(s.id).slice(0, 8)}`}
                    {" · "}
                    <span className="text-muted-foreground">
                      {clientName.get(s.client_id) ?? "Consumidor"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{dateTimeBR(s.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {s.is_debt ? (
                    <Badge variant="outline">Fiado</Badge>
                  ) : (
                    <Badge variant="secondary" className="capitalize">
                      {(s.payment_method ?? "—").toString().replace(/_/g, " ")}
                    </Badge>
                  )}
                  <span className="text-sm font-semibold">{brl(s.total_amount)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-gold" />
              <CardTitle className="text-base">Top 10 Clientes</CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTopClientsScope("all")}
                  className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                    topClientsScope === "all"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Geral
                </button>
                <button
                  type="button"
                  onClick={() => setTopClientsScope("period")}
                  className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                    topClientsScope === "period"
                      ? "bg-background text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {period}d
                </button>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <Link to="/clients">Ver todos</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingTopClients ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum cliente com compras registradas.
              </p>
            ) : (
              topClients.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        idx === 0
                          ? "bg-gold/20 text-gold font-bold"
                          : idx === 1
                          ? "bg-muted-foreground/20 text-foreground font-bold"
                          : idx === 2
                          ? "bg-amber-700/20 text-amber-700 dark:text-amber-400 font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {idx + 1}º
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.count} {c.count === 1 ? "compra" : "compras"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-foreground">
                      {brl(c.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/sales", label: "Nova venda (PDV)", icon: ShoppingCart },
          { to: "/transactions", label: "Transações", icon: ArrowLeftRight },
          { to: "/clients", label: "Clientes", icon: Users },
          { to: "/catalog", label: "Catálogo", icon: BookMarked },
        ].map((a) => (
          <Button key={a.to} asChild variant="outline" className="justify-start gap-2">
            <Link to={a.to}>
              <a.icon className="size-4" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
