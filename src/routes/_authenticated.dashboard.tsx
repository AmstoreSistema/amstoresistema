import { createFileRoute } from "@tanstack/react-router";
import { 
  AlertTriangle, 
  ArrowUpRight, 
  Boxes, 
  CheckCircle2, 
  Clock,
  Factory, 
  Package, 
  ShoppingCart, 
  TrendingUp,
  User,
  ChevronRight
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/data";
import { brl } from "@/lib/format";
import { StatCard } from "@/components/stat-card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de Controle — Amstore Gestão" },
      { name: "description", content: "Visão geral da produção, estoque de materiais e vendas da Amstore." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: materials = [] } = useRows("materials");
  const { data: products = [] } = useRows("products");
  const { data: orders = [] } = useRows("production_orders");
  const { data: sales = [] } = useRows("sales");
  const { data: clients = [] } = useRows("clients");
  const { data: installments = [] } = useRows("sale_installments", { 
    filters: [{ column: "status", value: "overdue" }],
    order: { column: "due_date", ascending: true }
  });

  useEffect(() => {
    supabase.rpc('check_sale_installments_alerts').then(() => {
      // Alerts checked
    });
  }, []);

  const criticalMaterials = useMemo(
    () => materials.filter((m: any) => Number(m.current_stock) <= Number(m.min_stock)).length,
    [materials]
  );

  const activeOrders = useMemo(
    () => orders.filter((o: any) => o.status === "pendente" || o.status === "em_producao").length,
    [orders]
  );

  const lowStockProducts = useMemo(
    () => products.filter((p: any) => Number(p.current_stock) <= Number(p.min_stock)).length,
    [products]
  );

  const today = new Date().toDateString();
  const salesToday = useMemo(
    () => sales.filter((s: any) => s.created_at && new Date(s.created_at).toDateString() === today),
    [sales, today]
  );

  const totalRevenueToday = useMemo(
    () => salesToday.reduce((sum, s: any) => sum + Number(s.total_amount), 0),
    [salesToday]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold tracking-tight bg-gradient-gold bg-clip-text text-transparent">
          Painel de Controle
        </h1>
        <p className="text-muted-foreground">Bem-vindo à Amstore Gestão. Confira os números de hoje.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total de Materiais" 
          value={materials.length} 
          sub={`${criticalMaterials} em nível crítico`} 
          icon={Boxes} 
          tone="dark" 
        />
        <StatCard 
          title="Ordens Ativas" 
          value={activeOrders} 
          sub={`De um total de ${orders.length}`} 
          icon={Factory} 
          tone="gold" 
        />
        <StatCard 
          title="Produtos em Estoque" 
          value={products.reduce((s, p: any) => s + Number(p.current_stock), 0)} 
          sub={`${lowStockProducts} com estoque baixo`} 
          icon={Package} 
          tone="dark" 
        />
        <StatCard 
          title="Vendas Hoje" 
          value={salesToday.length} 
          sub={brl(totalRevenueToday)} 
          icon={ShoppingCart} 
          tone="success" 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <div className="col-span-4 rounded-3xl border border-border bg-card/50 p-8 shadow-sm backdrop-blur-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold">Produção Recente</h3>
              <p className="text-xs text-muted-foreground">Status das últimas ordens de produção.</p>
            </div>
            <TrendingUp className="size-5 text-gold" />
          </div>
          
          <div className="space-y-4">
            {orders.slice(0, 5).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 p-4 transition-colors hover:bg-background">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
                    <Factory className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{products.find((p: any) => p.id === order.product_id)?.name || "Produto"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{order.status.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{order.quantity} un</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Factory className="mb-2 size-8 opacity-20" />
                <p className="text-sm italic">Nenhuma ordem recente encontrada.</p>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3 rounded-3xl border border-border bg-card/50 p-8 shadow-sm backdrop-blur-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold">Alertas de Estoque</h3>
              <p className="text-xs text-muted-foreground">Materiais abaixo do estoque mínimo.</p>
            </div>
            <AlertTriangle className="size-5 text-destructive" />
          </div>

          <div className="space-y-4">
            {materials
              .filter((m: any) => Number(m.current_stock) <= Number(m.min_stock))
              .slice(0, 6)
              .map((material: any) => (
                <div key={material.id} className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/50 p-4 transition-colors hover:bg-background">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <AlertTriangle className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{material.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{material.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">{material.current_stock} {material.unit}</p>
                    <p className="text-[10px] text-muted-foreground">mín: {material.min_stock}</p>
                  </div>
                </div>
              ))}
            {criticalMaterials === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <CheckCircle2 className="mb-2 size-8 text-success opacity-20" />
                <p className="text-sm italic">Tudo em ordem com o estoque.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 shadow-sm backdrop-blur-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5" /> Parcelas de Fiado em Atraso
              </h3>
              <p className="text-xs text-muted-foreground">Clientes com pendências financeiras que precisam de atenção.</p>
            </div>
            <Badge variant="destructive" className="rounded-full px-3">{installments.length}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installments.slice(0, 6).map((inst: any) => {
              const sale = sales.find((s: any) => s.id === inst.sale_id);
              const client = clients.find((c: any) => c.id === sale?.client_id);
              return (
                <div key={inst.id} className="flex items-center justify-between rounded-2xl border border-destructive/10 bg-card p-4 transition-all hover:border-destructive/30">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                      <User className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold truncate max-w-[120px]">{client?.name || "Consumidor"}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="size-3" /> Venceu {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-destructive">{brl(inst.amount)}</p>
                    <ChevronRight className="size-4 text-muted-foreground/30 ml-auto" />
                  </div>
                </div>
              );
            })}
            {installments.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CheckCircle2 className="mb-2 size-8 text-success opacity-20" />
                <p className="text-sm italic">Nenhuma parcela em atraso hoje.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-gradient-to-br from-gold/5 via-transparent to-transparent p-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold">Gestão Integrada Amstore</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              O sistema sincroniza automaticamente a produção com a baixa de matéria-prima e o lançamento de vendas no financeiro.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-2 text-xs font-semibold text-gold">
              <div className="size-2 animate-pulse rounded-full bg-gold" />
              SISTEMA ATIVO
            </div>
            <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
