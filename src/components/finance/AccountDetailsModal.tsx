import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  X, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Landmark, 
  PiggyBank, 
  CreditCard, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  CheckCircle2,
  Clock,
  Ban
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AccountDetailsModalProps {
  account: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDetailsModal({ account, open, onOpenChange }: AccountDetailsModalProps) {
  const [tab, setTab] = useState<"todas" | "receitas" | "despesas">("todas");
  const [search, setSearch] = useState("");

  const accountId = account?.id;

  // Busca de todas as transações vinculadas a esta conta
  const { data: rawTransactions = [], isLoading } = useQuery({
    queryKey: ["account-details-transactions", accountId],
    enabled: !!accountId && open,
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*, clients(name), suppliers(name), sales(id, sale_code)")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Estatísticas globais da conta
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    rawTransactions.forEach((t) => {
      const isPaid = ["pago", "paid"].includes(String(t.status || "").toLowerCase());
      if (!isPaid) return;

      const amt = Number(t.amount || 0);
      const isIncome = t.type === "entrada" || t.type === "income";
      const isExpense = t.type === "saida" || t.type === "expense";

      if (isIncome) income += amt;
      if (isExpense) expense += Math.abs(amt);
    });

    return {
      currentBalance: Number(account?.current_balance ?? 0),
      totalIncome: income,
      totalExpense: expense,
    };
  }, [rawTransactions, account]);

  // Gráfico de movimentações dos últimos 30 dias
  const chartData = useMemo(() => {
    const today = new Date();
    const days: { dateKey: string; label: string; dateObj: Date; receitas: number; despesas: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = subDays(today, i);
      days.push({
        dateKey: format(d, "yyyy-MM-dd"),
        label: format(d, "dd/MM"),
        dateObj: d,
        receitas: 0,
        despesas: 0,
      });
    }

    const dayMap = new Map(days.map((d) => [d.dateKey, d]));

    rawTransactions.forEach((t) => {
      const isPaid = ["pago", "paid"].includes(String(t.status || "").toLowerCase());
      if (!isPaid) return;

      const dateStr = t.created_at || t.due_date;
      if (!dateStr) return;

      const key = dateStr.slice(0, 10);
      const dayItem = dayMap.get(key);
      if (!dayItem) return;

      const amt = Number(t.amount || 0);
      const isIncome = t.type === "entrada" || t.type === "income";
      const isExpense = t.type === "saida" || t.type === "expense";

      if (isIncome) dayItem.receitas += amt;
      if (isExpense) dayItem.despesas += Math.abs(amt);
    });

    return days;
  }, [rawTransactions]);

  // Filtro de transações por aba e busca
  const filteredTransactions = useMemo(() => {
    return rawTransactions.filter((t) => {
      const isIncome = t.type === "entrada" || t.type === "income";
      const isExpense = t.type === "saida" || t.type === "expense";

      if (tab === "receitas" && !isIncome) return false;
      if (tab === "despesas" && !isExpense) return false;

      if (search.trim()) {
        const term = search.toLowerCase();
        const descMatch = String(t.description || "").toLowerCase().includes(term);
        const catMatch = String(t.category || "").toLowerCase().includes(term);
        const clientMatch = String(t.clients?.name || "").toLowerCase().includes(term);
        const supplierMatch = String(t.suppliers?.name || "").toLowerCase().includes(term);
        const codeMatch = String(t.sales?.sale_code || "").toLowerCase().includes(term);

        if (!descMatch && !catMatch && !clientMatch && !supplierMatch && !codeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rawTransactions, tab, search]);

  const countAll = rawTransactions.length;
  const countIncome = rawTransactions.filter((t) => t.type === "entrada" || t.type === "income").length;
  const countExpense = rawTransactions.filter((t) => t.type === "saida" || t.type === "expense").length;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "banco": return Landmark;
      case "caixa": return PiggyBank;
      case "carteira": return Wallet;
      default: return CreditCard;
    }
  };

  if (!account) return null;

  const Icon = getAccountIcon(account.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-[#F8F9FB] flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="p-6 bg-card border-b border-border/40 relative shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div 
                className="size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: `${account.color || '#D4AF37'}15`, color: account.color || '#D4AF37' }}
              >
                <Icon className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl font-display font-black text-foreground truncate">
                    {account.name}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border-muted-foreground/30">
                    {account.type}
                  </Badge>
                  {account.active ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[10px] font-bold">
                      Ativa
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] font-bold text-muted-foreground">
                      Inativa
                    </Badge>
                  )}
                </div>
                {account.type === "banco" && account.bank_name && (
                  <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                    {account.bank_name} • Agência {account.agency || "—"} • Conta {account.account_number || "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Topo do Modal: 3 Cards de Resumo da Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Saldo Atual */}
            <div className="p-5 rounded-2xl bg-card border border-border/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Saldo Atual
                </span>
                <div className="size-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
                  <Wallet className="size-4" />
                </div>
              </div>
              <p className={cn(
                "text-2xl font-black font-display mt-2",
                stats.currentBalance < 0 ? "text-destructive" : "text-gold"
              )}>
                {brl(stats.currentBalance)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Disponível nesta conta
              </p>
            </div>

            {/* Total Receitas */}
            <div className="p-5 rounded-2xl bg-card border border-border/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Total Receitas
                </span>
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <p className="text-2xl font-black font-display text-emerald-600 mt-2">
                {brl(stats.totalIncome)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Entradas efetivadas na conta
              </p>
            </div>

            {/* Total Despesas */}
            <div className="p-5 rounded-2xl bg-card border border-border/40 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Total Despesas
                </span>
                <div className="size-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                  <TrendingDown className="size-4" />
                </div>
              </div>
              <p className="text-2xl font-black font-display text-destructive mt-2">
                {brl(stats.totalExpense)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Saídas pagas por esta conta
              </p>
            </div>
          </div>

          {/* Gráfico de Movimentações dos Últimos 30 Dias */}
          <div className="p-5 rounded-2xl bg-card border border-border/40 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display font-black text-sm text-foreground flex items-center gap-2">
                  <Calendar className="size-4 text-gold" />
                  Movimentações dos Últimos 30 Dias
                </h4>
                <p className="text-xs text-muted-foreground">
                  Comparativo diário de entradas e saídas realizadas nesta conta
                </p>
              </div>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis 
                    dataKey="label" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 10, fill: "#888888" }}
                    interval={3}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 10, fill: "#888888" }}
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip 
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover text-popover-foreground p-3 rounded-xl shadow-xl border border-border/50 text-xs space-y-1">
                            <p className="font-bold text-muted-foreground mb-1">Dia {label}</p>
                            <p className="text-emerald-600 font-bold flex items-center justify-between gap-4">
                              <span>Entradas:</span> <span>{brl(Number(payload[0]?.value || 0))}</span>
                            </p>
                            <p className="text-destructive font-bold flex items-center justify-between gap-4">
                              <span>Saídas:</span> <span>{brl(Number(payload[1]?.value || 0))}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right"
                    wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
                    formatter={(val) => (val === "receitas" ? "Entradas (Receitas)" : "Saídas (Despesas)")}
                  />
                  <Bar dataKey="receitas" name="receitas" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="despesas" name="despesas" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Histórico de Transações com Abas */}
          <div className="p-5 rounded-2xl bg-card border border-border/40 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-display font-black text-sm text-foreground">
                  Histórico de Transações da Conta
                </h4>
                <p className="text-xs text-muted-foreground">
                  Lançamentos vinculados diretamente a esta conta financeira
                </p>
              </div>

              {/* Abas */}
              <div className="flex bg-muted/40 p-1 rounded-xl gap-1 self-start sm:self-auto">
                <button
                  onClick={() => setTab("todas")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    tab === "todas" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todas ({countAll})
                </button>
                <button
                  onClick={() => setTab("receitas")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    tab === "receitas" ? "bg-card text-emerald-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Receitas ({countIncome})
                </button>
                <button
                  onClick={() => setTab("despesas")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    tab === "despesas" ? "bg-card text-destructive shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Despesas ({countExpense})
                </button>
              </div>
            </div>

            {/* Busca Rápida */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por descrição, categoria, cliente ou fornecedor..."
                className="pl-9 h-10 rounded-xl bg-muted/20 border-border/40 text-xs"
              />
            </div>

            {/* Lista de Transações */}
            {isLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Carregando transações da conta...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-border/40 text-muted-foreground space-y-1">
                <p className="text-xs font-bold">Nenhuma transação encontrada</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {search ? "Tente buscar com outros termos." : "Esta conta ainda não possui movimentações nesta categoria."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-80 overflow-y-auto pr-1">
                {filteredTransactions.map((t) => {
                  const isIncome = t.type === "entrada" || t.type === "income";
                  const isPaid = ["pago", "paid"].includes(String(t.status || "").toLowerCase());
                  const isPending = ["pendente", "pending", "aberto"].includes(String(t.status || "").toLowerCase());
                  const dateStr = t.created_at || t.due_date;
                  const formattedDate = dateStr 
                    ? format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "—";

                  const partyName = t.clients?.name || t.suppliers?.name || (t.sales?.sale_code ? `Venda #${t.sales.sale_code}` : null);

                  return (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3 hover:bg-muted/10 px-2 rounded-xl transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "size-8 rounded-xl flex items-center justify-center shrink-0",
                          isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                        )}>
                          {isIncome ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {t.description || (isIncome ? "Receita" : "Despesa")}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                            <span>{formattedDate}</span>
                            {t.category && (
                              <span className="bg-muted px-1.5 py-0.2 rounded font-medium">
                                {t.category}
                              </span>
                            )}
                            {partyName && (
                              <span className="text-foreground/80 font-medium truncate">
                                • {partyName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-xs sm:text-sm font-black font-display",
                          isIncome ? "text-emerald-600" : "text-destructive"
                        )}>
                          {isIncome ? "+" : "-"} {brl(t.amount)}
                        </p>
                        <div className="mt-0.5">
                          {isPaid ? (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase">Pago</span>
                          ) : isPending ? (
                            <span className="text-[9px] font-bold text-amber-600 uppercase">Pendente</span>
                          ) : (
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{t.status || "—"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
