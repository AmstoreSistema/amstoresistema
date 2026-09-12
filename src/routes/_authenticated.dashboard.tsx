import { createFileRoute, Link } from "@tanstack/react-router";
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
  ChevronRight,
  Target,
  Pencil,
  Zap,
  HandCoins,
  MessageSquare,
  Search,
  ExternalLink,
  Phone
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/data";
import { brl } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { BirthdayAlertCard } from "@/components/BirthdayAlertCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncCurrentAdminProfile, getAppSettings, updateAppSetting } from "@/lib/settings.functions";

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
  const { data: materials = [] } = useRows("materials", { select: "id, name, type, current_stock, min_stock, unit" });
  const { data: products = [] } = useRows("products", { select: "id, name, current_stock, min_stock, sku" });
  const { data: orders = [] } = useRows("production_orders", { 
    select: "id, status, product_id, quantity, created_at",
    order: { column: "created_at", ascending: false },
    limit: 20
  });
  const { data: sales = [] } = useRows("sales", { 
    select: "id, created_at, total_amount, client_id",
    order: { column: "created_at", ascending: false },
    limit: 100
  });
  const { data: clients = [] } = useRows("clients", { select: "id, name, phone" });
  const { data: fiadoSales = [] } = useRows<any>("sales", { 
    select: "id, client_id, total_amount, paid_amount, status, is_debt, created_at, sale_code",
    filters: [{ column: "is_debt", value: true }],
  });
  const { data: allInstallments = [] } = useRows<any>("sale_installments" as any, { 
    select: "id, sale_id, amount, paid_amount, due_date, status",
  });

  const queryClient = useQueryClient();
  const fetchAppSettings = useServerFn(getAppSettings);
  const saveAppSetting = useServerFn(updateAppSetting);

  // Meta diária única da loja (carregada do banco de dados e compartilhada por todo o sistema)
  const { data: rawSettings = [] } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      try {
        const res = await fetchAppSettings();
        return res || [];
      } catch {
        const { data } = await supabase.from("app_settings").select("*");
        return data || [];
      }
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const dailyGoal = useMemo(() => {
    const goalItem = rawSettings.find((s: any) => s.key === "daily_goal");
    if (goalItem && goalItem.value !== undefined && goalItem.value !== null) {
      const parsed = typeof goalItem.value === "string" ? parseFloat(goalItem.value) : Number(goalItem.value);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 2000;
  }, [rawSettings]);

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoalInput, setTempGoalInput] = useState(String(dailyGoal));

  // Mantém o input temporário atualizado quando a meta global da loja mudar no banco
  useEffect(() => {
    setTempGoalInput(String(dailyGoal));
  }, [dailyGoal]);

  // Remove qualquer resquício de localStorage de versões anteriores
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("amstore_daily_goal");
    }
  }, []);

  // Nome do administrador logado (configurado em Configurações / Usuários)
  const [adminName, setAdminName] = useState<string>("");
  const syncProfile = useServerFn(syncCurrentAdminProfile);

  // Aba de alerta de estoque: Produtos de Loja ou Materiais de Produção
  const [stockAlertTab, setStockAlertTab] = useState<"products" | "materials">("products");

  useEffect(() => {
    supabase.rpc('check_sale_installments_alerts').then(() => {
      // Alerts checked
    });

    // Obtém o perfil e nome configurado do administrador atual para a saudação
    syncProfile()
      .then((res) => {
        if (res?.displayName) {
          setAdminName(res.displayName);
        }
      })
      .catch(() => {
        supabase.auth.getSession().then(({ data }) => {
          const user = data.session?.user;
          if (user) {
            const metaName = (user.user_metadata as any)?.display_name;
            if (metaName) {
              setAdminName(metaName);
            } else {
              supabase
                .from("user_profiles")
                .select("display_name")
                .eq("id", user.id)
                .maybeSingle()
                .then(({ data: p }) => {
                  if (p?.display_name) setAdminName(p.display_name);
                });
            }
          }
        });
      });
  }, []);

  const criticalMaterials = useMemo(
    () => materials.filter((m: any) => Number(m.current_stock) <= Number(m.min_stock)).length,
    [materials]
  );

  const activeOrders = useMemo(
    () => orders.filter((o: any) => {
      const st = String(o.status || "").toLowerCase();
      return st === "pending" || st === "ongoing" || st === "pendente" || st === "em_producao";
    }).length,
    [orders]
  );

  const lowStockProductsList = useMemo(
    () => products.filter((p: any) => Number(p.current_stock) <= Number(p.min_stock)),
    [products]
  );

  const lowStockProducts = lowStockProductsList.length;

  const today = new Date().toDateString();
  const salesToday = useMemo(
    () => sales.filter((s: any) => s.created_at && new Date(s.created_at).toDateString() === today),
    [sales, today]
  );

  const totalRevenueToday = useMemo(
    () => salesToday.reduce((sum, s: any) => sum + Number(s.total_amount), 0),
    [salesToday]
  );

  const ticketMedioToday = useMemo(() => {
    return salesToday.length > 0 ? totalRevenueToday / salesToday.length : 0;
  }, [salesToday, totalRevenueToday]);

  const goalPercent = useMemo(() => {
    if (dailyGoal <= 0) return 0;
    return Math.min(100, Math.round((totalRevenueToday / dailyGoal) * 100));
  }, [totalRevenueToday, dailyGoal]);

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);
  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);

  // Cálculo fiel dos fiados vencidos por cliente
  const overdueFiados = useMemo(() => {
    const installmentsBySale = new Map<string, any[]>();
    allInstallments.forEach((inst: any) => {
      const list = installmentsBySale.get(inst.sale_id) || [];
      list.push(inst);
      installmentsBySale.set(inst.sale_id, list);
    });

    const stats = new Map<string, {
      clientId: string;
      clientName: string;
      totalDue: number;
      overdueDue: number;
      overdueDate: string | null;
      salesCount: number;
    }>();

    fiadoSales.forEach((s: any) => {
      if (!s.client_id) return;
      const status = String(s.status || "").toLowerCase();
      if (["paid", "pago", "quitado", "cancelado", "cancelled"].includes(status)) return;

      const remaining = Number(s.total_amount || 0) - Number(s.paid_amount || 0);
      if (remaining <= 0.009) return;

      const client = clientById.get(s.client_id);
      if (!client) return;

      const saleInstallments = installmentsBySale.get(s.id) || [];
      const pendingSaleInsts = saleInstallments.filter(
        (i: any) => !["paid", "pago", "quitado"].includes(String(i.status || "").toLowerCase()) &&
             (Number(i.amount || 0) - Number(i.paid_amount || 0)) > 0.009
      );

      let isSaleOverdue = false;
      let saleOverdueAmount = 0;
      let earliestOverdueDate: string | null = null;

      if (pendingSaleInsts.length > 0) {
        pendingSaleInsts.forEach((i: any) => {
          const instRem = Math.max(0, Number(i.amount || 0) - Number(i.paid_amount || 0));
          const iDueIso = i.due_date ? String(i.due_date).split("T")[0] : null;
          if (iDueIso && iDueIso < todayIso) {
            isSaleOverdue = true;
            saleOverdueAmount += instRem;
            if (!earliestOverdueDate || new Date(i.due_date).getTime() < new Date(earliestOverdueDate).getTime()) {
              earliestOverdueDate = i.due_date;
            }
          }
        });
      } else {
        const fallbackDate = s.created_at || null;
        if (fallbackDate) {
          const sDateIso = String(fallbackDate).split("T")[0];
          if (sDateIso < todayIso) {
            isSaleOverdue = true;
            saleOverdueAmount = remaining;
            earliestOverdueDate = fallbackDate;
          }
        }
      }

      if (isSaleOverdue) {
        const current = stats.get(s.client_id) || {
          clientId: s.client_id,
          clientName: client.name,
          totalDue: 0,
          overdueDue: 0,
          overdueDate: null,
          salesCount: 0,
        };
        current.salesCount += 1;
        current.totalDue += remaining;
        current.overdueDue += saleOverdueAmount;
        if (!current.overdueDate || (earliestOverdueDate && new Date(earliestOverdueDate).getTime() < new Date(current.overdueDate).getTime())) {
          current.overdueDate = earliestOverdueDate;
        }
        stats.set(s.client_id, current);
      }
    });

    stats.forEach((c) => {
      c.overdueDue = Math.min(c.totalDue, c.overdueDue);
    });

    return Array.from(stats.values()).sort((a, b) => {
      if (a.overdueDate && b.overdueDate) {
        return new Date(a.overdueDate).getTime() - new Date(b.overdueDate).getTime();
      }
      return b.overdueDue - a.overdueDue;
    });
  }, [fiadoSales, allInstallments, clientById, todayIso]);

  const totalOverdueAmount = useMemo(() => {
    return overdueFiados.reduce((acc, f) => acc + f.overdueDue, 0);
  }, [overdueFiados]);

  // Saudação e Data em tempo real
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const formattedDate = useMemo(() => {
    const d = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    return d.charAt(0).toUpperCase() + d.slice(1);
  }, []);

  const getDaysOverdue = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const due = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleWhatsAppCobrar = (e: React.MouseEvent, fiado: any) => {
    e.preventDefault();
    e.stopPropagation();
    const client = clientById.get(fiado.clientId);
    const rawPhone = client?.phone ? String(client.phone).replace(/\D/g, "") : "";
    if (!rawPhone) {
      toast.error(`Cliente ${fiado.clientName} não possui telefone cadastrado.`);
      return;
    }
    const dateFormatted = fiado.overdueDate ? new Date(fiado.overdueDate).toLocaleDateString("pt-BR") : "";
    const msg = `Olá ${fiado.clientName}, tudo bem? Aqui é da Amstore. Notamos uma pendência no valor de ${brl(fiado.overdueDue)}${dateFormatted ? ` com vencimento em ${dateFormatted}` : ""}. Podemos combinar a melhor forma de acerto? Se preferir via Pix, podemos te enviar a chave. Ficamos no aguardo e à disposição!`;
    window.open(`https://wa.me/55${rawPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleSaveGoal = async () => {
    const parsed = Number(tempGoalInput.replace(",", "."));
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Informe um valor válido para a meta diária da loja.");
      return;
    }
    try {
      await saveAppSetting({ data: { key: "daily_goal", value: String(parsed) } });
      await queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success(`Meta diária geral da loja atualizada para ${brl(parsed)}!`);
    } catch {
      toast.error("Erro ao atualizar a meta da loja no banco de dados.");
    }
    setIsGoalModalOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* Cabeçalho com Saudação e Data */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4 sm:pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">
              {formattedDate}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Loja em Operação
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight bg-gradient-gold bg-clip-text text-transparent mt-1">
            {greeting}, {adminName || "Amstore"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Aqui está o resumo instantâneo da sua loja e produção hoje.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Link to="/live-metrics">
              <Zap className="size-3.5 text-gold" />
              <span>Métricas ao Vivo</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-95">
            <Link to="/sales">
              <ShoppingCart className="size-3.5" />
              <span>Nova Venda (PDV)</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Cartão de Alerta de Aniversariantes de Hoje */}
      <BirthdayAlertCard />

      {/* BARRA DE PULSO DO DIA (Meta Diária, Ritmo e Ticket Médio) */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card/90 to-background p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-gold/15 text-gold">
                  <Target className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Meta Diária Geral da Loja
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {brl(totalRevenueToday)} / <span className="text-muted-foreground">{brl(dailyGoal)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTempGoalInput(String(dailyGoal));
                    setIsGoalModalOpen(true);
                  }}
                  className="p-1 text-muted-foreground hover:text-gold transition-colors rounded-md hover:bg-muted/40"
                  title="Alterar meta diária geral da loja"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60 border border-border/40">
                <div 
                  className="h-full rounded-full bg-gradient-gold transition-all duration-700 ease-out"
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span>
                  {goalPercent >= 100 
                    ? "🎉 Parabéns! Meta do dia alcançada!" 
                    : `Faltam ${brl(Math.max(0, dailyGoal - totalRevenueToday))} para a meta`}
                </span>
                <span className="font-bold text-foreground">{goalPercent}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 border-t md:border-t-0 md:border-l border-border/60 pt-3 md:pt-0 md:pl-6 shrink-0">
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Vendas Hoje
              </p>
              <p className="text-lg sm:text-xl font-bold font-display text-foreground mt-0.5">
                {salesToday.length} <span className="text-xs font-normal text-muted-foreground">pedidos</span>
              </p>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Ticket Médio
              </p>
              <p className="text-lg sm:text-xl font-bold font-display text-gold mt-0.5">
                {brl(ticketMedioToday)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CENTRAL DE AÇÕES RÁPIDAS (Atalhos de 1 Clique) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Button asChild variant="outline" className="justify-start gap-2 h-11 text-xs sm:text-sm border-border/70 hover:border-gold/50 hover:bg-gold/5 transition-all">
          <Link to="/sales">
            <ShoppingCart className="size-4 text-gold shrink-0" />
            <span className="truncate font-medium">Nova Venda (PDV)</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start gap-2 h-11 text-xs sm:text-sm border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-all">
          <Link to="/stock">
            <Search className="size-4 text-blue-400 shrink-0" />
            <span className="truncate font-medium">Consultar Estoque</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start gap-2 h-11 text-xs sm:text-sm border-border/70 hover:border-destructive/40 hover:bg-destructive/5 transition-all">
          <Link to="/credit">
            <HandCoins className="size-4 text-amber-500 shrink-0" />
            <span className="truncate font-medium">Receber Fiado</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start gap-2 h-11 text-xs sm:text-sm border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all">
          <Link to="/whatsapp-billing">
            <MessageSquare className="size-4 text-emerald-500 shrink-0" />
            <span className="truncate font-medium">Cobrança WhatsApp</span>
          </Link>
        </Button>
      </div>

      {/* OS 4 CARDS PRINCIPAIS (MANTIDOS E APRIMORADOS COM TO E VISUAL ELEGANCE) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard 
          title="Total de Materiais" 
          value={materials.length} 
          sub={criticalMaterials > 0 ? `${criticalMaterials} em nível crítico` : "Estoque de fábrica normal"} 
          icon={Boxes} 
          tone="dark" 
          to="/materials"
        />
        <StatCard 
          title="Ordens Ativas" 
          value={activeOrders} 
          sub={`De um total de ${orders.length} ordens`} 
          icon={Factory} 
          tone="gold" 
          to="/production"
        />
        <StatCard 
          title="Produtos em Estoque" 
          value={products.reduce((s, p: any) => s + Number(p.current_stock), 0)} 
          sub={lowStockProducts > 0 ? `${lowStockProducts} com estoque baixo` : "Todos os produtos com estoque"} 
          icon={Package} 
          tone="dark" 
          to="/stock"
        />
        <StatCard 
          title="Vendas Hoje" 
          value={salesToday.length} 
          sub={`${brl(totalRevenueToday)} faturado`} 
          icon={ShoppingCart} 
          tone="success" 
          to="/sales"
        />
      </div>

      {/* SEÇÃO PRINCIPAL: FIADOS EM ATRASO & ALERTAS DE ESTOQUE LADO A LADO */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* CARD 1: FIADOS EM ATRASO (Com valor total, dias de atraso e WhatsApp 1-clique) */}
        <div className="rounded-2xl sm:rounded-3xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6 shadow-sm backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                    <AlertTriangle className="size-4" />
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-destructive">
                    Fiados em Atraso
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                  Clientes com parcelas vencidas que necessitam de cobrança.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="rounded-full px-2.5 py-0.5 text-xs font-bold shrink-0 shadow-xs">
                  {overdueFiados.length} {overdueFiados.length === 1 ? "cliente" : "clientes"}
                </Badge>
                {totalOverdueAmount > 0 && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive text-xs font-bold">
                    {brl(totalOverdueAmount)}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              {overdueFiados.slice(0, 5).map((fiado) => {
                const days = getDaysOverdue(fiado.overdueDate);
                return (
                  <div
                    key={fiado.clientId}
                    className="flex items-center justify-between gap-2.5 rounded-xl sm:rounded-2xl border border-destructive/20 bg-card/95 p-3 sm:p-3.5 transition-all hover:border-destructive/40 hover:shadow-xs group"
                  >
                    <Link
                      to="/credit"
                      className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0 group-hover:scale-105 transition-transform">
                        <User className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold truncate text-foreground group-hover:text-destructive transition-colors">
                          {fiado.clientName}
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="size-3 text-destructive/80" />
                          <span className="text-destructive font-medium">
                            {days > 0 ? `Venceu há ${days} dia(s)` : "Venceu hoje"}
                          </span>
                          <span>•</span>
                          <span>{fiado.salesCount} venda(s)</span>
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs sm:text-sm font-black text-destructive tabular-nums">
                          {brl(fiado.overdueDue)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Total: {brl(fiado.totalDue)}
                        </p>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleWhatsAppCobrar(e, fiado)}
                        title="Enviar cobrança pelo WhatsApp"
                        className="size-8 rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                      >
                        <MessageSquare className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {overdueFiados.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="mb-2 size-8 text-success opacity-40" />
                  <p className="text-xs sm:text-sm italic font-medium">
                    Nenhum fiado em atraso no momento. Todos os recebimentos estão em dia!
                  </p>
                </div>
              )}
            </div>
          </div>

          {overdueFiados.length > 5 && (
            <div className="pt-3 text-center border-t border-destructive/15 mt-3">
              <Button asChild size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive gap-1">
                <Link to="/credit">
                  Ver todos os {overdueFiados.length} fiados vencidos <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* CARD 2: ALERTAS DE ESTOQUE (Com abas: Produtos da Loja vs. Materiais de Fábrica) */}
        <div className="rounded-2xl sm:rounded-3xl border border-border bg-card/60 p-4 sm:p-6 shadow-sm backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                    <AlertTriangle className="size-4" />
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold">
                    Alertas de Estoque
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                  Itens no limite ou abaixo do estoque mínimo de segurança.
                </p>
              </div>

              {/* Seletor de abas Produtos vs Materiais */}
              <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setStockAlertTab("products")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    stockAlertTab === "products"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Package className="size-3.5" />
                  Loja ({lowStockProducts})
                </button>
                <button
                  type="button"
                  onClick={() => setStockAlertTab("materials")}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    stockAlertTab === "materials"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Boxes className="size-3.5" />
                  Fábrica ({criticalMaterials})
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* ABA PRODUTOS DE LOJA */}
              {stockAlertTab === "products" && (
                <>
                  {lowStockProductsList.slice(0, 5).map((prod: any) => (
                    <Link
                      key={prod.id}
                      to="/stock"
                      className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-border/60 bg-background/60 p-3 sm:p-3.5 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
                          <Package className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium truncate text-foreground">
                            {prod.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {prod.sku ? `SKU: ${prod.sku}` : "Produto Acabado"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-xs sm:text-sm font-bold text-destructive">
                          {prod.current_stock} un
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          mín: {prod.min_stock ?? 0} un
                        </p>
                      </div>
                    </Link>
                  ))}

                  {lowStockProducts === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <CheckCircle2 className="mb-2 size-8 text-success opacity-30" />
                      <p className="text-xs sm:text-sm italic">
                        Todos os calçados, bolsas e produtos da loja estão com estoque seguro!
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ABA MATERIAIS DE FÁBRICA */}
              {stockAlertTab === "materials" && (
                <>
                  {materials
                    .filter((m: any) => Number(m.current_stock) <= Number(m.min_stock))
                    .slice(0, 5)
                    .map((material: any) => (
                      <Link
                        key={material.id}
                        to="/materials"
                        className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-border/60 bg-background/60 p-3 sm:p-3.5 transition-colors hover:bg-muted/20"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
                            <Boxes className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium truncate text-foreground">
                              {material.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {material.type || "Insumo"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <p className="text-xs sm:text-sm font-bold text-destructive">
                            {material.current_stock} {material.unit}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            mín: {material.min_stock} {material.unit}
                          </p>
                        </div>
                      </Link>
                    ))}

                  {criticalMaterials === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <CheckCircle2 className="mb-2 size-8 text-success opacity-30" />
                      <p className="text-xs sm:text-sm italic">
                        Nenhum insumo de fábrica em nível crítico. Produção abastecida!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="pt-3 text-center border-t border-border/40 mt-3">
            <Button asChild size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-foreground gap-1">
              <Link to={stockAlertTab === "products" ? "/stock" : "/materials"}>
                Gerenciar estoque completo <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

      </div>

      {/* PRODUÇÃO RECENTE (ORDENS ATIVAS COM TIMELINE E STATUS COLORIDO) */}
      <div className="rounded-2xl sm:rounded-3xl border border-border bg-card/50 p-4 sm:p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-4 sm:mb-6 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Factory className="size-4 text-gold" />
              <h3 className="font-display text-base sm:text-lg font-bold">Produção Recente</h3>
            </div>
            <p className="text-xs text-muted-foreground">Status e acompanhamento das últimas ordens fabris.</p>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Link to="/production">Ver todas as ordens</Link>
          </Button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {orders.slice(0, 6).map((order: any) => {
            const st = String(order.status || "").toLowerCase();
            const isPending = st === "pending" || st === "pendente";
            const isOngoing = st === "ongoing" || st === "em_producao";
            const isCompleted = st === "completed" || st === "concluida" || st === "finished";

            return (
              <div 
                key={order.id} 
                className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-border/60 bg-background/50 p-3 sm:p-3.5 transition-colors hover:bg-background"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-gold/10 text-gold shrink-0">
                    <Factory className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate text-foreground">
                      {products.find((p: any) => p.id === order.product_id)?.name || "Produto"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`size-1.5 rounded-full ${
                        isPending ? "bg-amber-500" : isOngoing ? "bg-blue-400" : isCompleted ? "bg-emerald-500" : "bg-muted-foreground"
                      }`} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {isPending ? "Pendente" : isOngoing ? "Em Produção" : isCompleted ? "Concluída" : st}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <p className="text-xs sm:text-sm font-bold text-foreground">{order.quantity} un</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Factory className="mb-2 size-8 opacity-20" />
              <p className="text-xs sm:text-sm italic">Nenhuma ordem de produção recente encontrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* BANNER INSTITUCIONAL E SINCRONIZAÇÃO */}
      <div className="rounded-2xl sm:rounded-3xl border border-border bg-gradient-to-br from-gold/5 via-transparent to-transparent p-4 sm:p-6">
        <div className="flex flex-col items-start sm:items-center justify-between gap-4 md:flex-row">
          <div className="space-y-1">
            <h2 className="font-display text-base sm:text-xl font-bold text-foreground">Gestão Integrada Amstore</h2>
            <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
              O sistema sincroniza automaticamente a produção com a baixa de matéria-prima, controle de estoque da loja e recebimentos de fiado.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button asChild size="sm" variant="outline" className="text-xs gap-1">
              <Link to="/store">Painel da Loja <ArrowUpRight className="size-3.5" /></Link>
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-[11px] font-semibold text-gold">
              <div className="size-2 animate-pulse rounded-full bg-gold" />
              ONLINE
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PARA EDITAR META DIÁRIA GERAL DA LOJA */}
      <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="size-5 text-gold" /> Meta Diária Geral da Loja
            </DialogTitle>
            <DialogDescription>
              Defina a meta diária global de faturamento da loja. Essa meta é única para todo o sistema e compartilhada por todos os administradores.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Valor da Meta Diária da Loja (R$)
            </label>
            <Input
              type="number"
              step="50"
              value={tempGoalInput}
              onChange={(e) => setTempGoalInput(e.target.value)}
              placeholder="Ex: 2500"
              className="font-bold text-lg"
            />
            <p className="text-[11px] text-muted-foreground">
              A meta da loja é única e é atualizada em tempo real para todos os administradores.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsGoalModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGoal} className="bg-gradient-gold text-primary-foreground font-semibold">
              Salvar Meta Geral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
