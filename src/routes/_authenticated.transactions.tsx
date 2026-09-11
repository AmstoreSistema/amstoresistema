import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  ArrowLeftRight, 
  TrendingDown, 
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  FileText,
  DollarSign,
  ChevronRight,
  Download,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Eye,
  Pencil
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { deleteTransaction, updateAccountBalance } from "@/lib/finance.functions.ts";
import { cn } from "@/lib/utils";
import { TransactionDetailsModal } from "@/components/finance/TransactionDetailsModal";
import { TransactionModal } from "@/components/finance/TransactionModal";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transações — Amstore Gestão" },
      { name: "description", content: "Todos os lançamentos financeiros: entradas de vendas, recebimentos de fiado e saídas." },
    ],
  }),
  component: TransactionsPage,
});

/**
 * Remove o nome do cliente da primeira linha da descrição da venda,
 * exibindo apenas "Pagamento Venda [CÓDIGO]" ou similar, visto que
 * o nome completo do cliente já é exibido logo abaixo.
 */
function formatTransactionTitle(description: string | null | undefined, clientName?: string | null): string {
  if (!description) return "Sem descrição";

  // Se houver nome do cliente informado e ele estiver no final como " - Nome"
  if (clientName && clientName.trim()) {
    const escaped = clientName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\s*-\\s*${escaped}\\s*$`, "i");
    if (regex.test(description)) {
      return description.replace(regex, "").trim();
    }
  }

  // Padrão: "Pagamento Venda [CÓDIGO] - [Nome do Cliente]" -> "Pagamento Venda [CÓDIGO]"
  const paymentSaleMatch = description.match(/^(Pagamento\s+Venda\s+[A-Za-z0-9_-]+)\s*-\s*.+$/i);
  if (paymentSaleMatch && paymentSaleMatch[1]) {
    return paymentSaleMatch[1].trim();
  }

  // Padrão: "Venda [CÓDIGO] - [Nome do Cliente]" -> "Venda [CÓDIGO]"
  const saleMatch = description.match(/^(Venda\s+[A-Za-z0-9_-]+)\s*-\s*.+$/i);
  if (saleMatch && saleMatch[1]) {
    return saleMatch[1].trim();
  }

  return description;
}

function TransactionsPage() {
  const qc = useQueryClient();
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | "receita" | "despesa">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pago" | "pendente" | "atrasado" | "cancelado">("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Reinicia a paginação para a página 1 ao aplicar ou alterar qualquer filtro/busca
  useEffect(() => {
    setPage(1);
  }, [term, typeFilter, statusFilter, startDate, endDate]);

  const { data: accounts = [] } = useRows("financial_accounts", { filters: [{ column: "active", value: true }] });
  const { data: clients = [] } = useRows("clients");
  const { data: suppliers = [] } = useRows("suppliers");

  // Cálculo de limites .range(from, to) baseado na página atual
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Busca paginada no Supabase
  const { data: transResult, isLoading } = useQuery({
    queryKey: ["transactions", page, term, typeFilter, statusFilter, startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*, financial_accounts(name), clients(name), suppliers(name)", { count: "exact" })
        .order("created_at", { ascending: false });

      // Filtro de tipo
      if (typeFilter === "receita") {
        q = q.in("type", ["entrada", "income"]);
      } else if (typeFilter === "despesa") {
        q = q.in("type", ["saida", "expense"]);
      }

      // Filtro de status
      if (statusFilter === "pago") {
        q = q.in("status", ["pago", "paid"]);
      } else if (statusFilter === "cancelado") {
        q = q.in("status", ["cancelado", "cancelled", "canceled"]);
      } else if (statusFilter === "pendente") {
        q = q.in("status", ["pendente", "pending", "aberto"]);
      } else if (statusFilter === "atrasado") {
        const todayStr = new Date().toISOString().split("T")[0];
        q = q.in("status", ["pendente", "pending", "aberto"]).lt("due_date", todayStr);
      }

      // Filtro por período
      if (startDate) {
        q = q.gte("created_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        q = q.lte("created_at", `${endDate}T23:59:59.999`);
      }

      // Filtro de busca textual (descrição, categoria, cliente ou fornecedor)
      if (term.trim()) {
        const cleanTerm = term.trim();
        const matchingClientIds = (clients as any[])
          .filter(c => c.name?.toLowerCase().includes(cleanTerm.toLowerCase()))
          .map(c => c.id);
        const matchingSupplierIds = (suppliers as any[])
          .filter(s => s.name?.toLowerCase().includes(cleanTerm.toLowerCase()))
          .map(s => s.id);

        const orFilters = [
          `description.ilike.%${cleanTerm}%`,
          `category.ilike.%${cleanTerm}%`
        ];
        if (matchingClientIds.length > 0) {
          orFilters.push(`client_id.in.(${matchingClientIds.join(",")})`);
        }
        if (matchingSupplierIds.length > 0) {
          orFilters.push(`supplier_id.in.(${matchingSupplierIds.join(",")})`);
        }
        q = q.or(orFilters.join(","));
      }

      q = q.range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return {
        transactions: (data as any[]) || [],
        totalCount: count || 0,
      };
    },
  });

  const transactions = transResult?.transactions || [];
  const totalCount = transResult?.totalCount || 0;

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [viewingTransaction, setViewingTransaction] = useState<any>(null);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [newBalance, setNewBalance] = useState("");
  const isOpenModal = isNewModalOpen || !!editingTransaction;

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Deseja realmente excluir este lançamento? Esta ação pode afetar o saldo das contas.")) return;
    try {
      await deleteTransaction({ data: id });
      toast.success("Lançamento excluído");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdateAccountBalance = async () => {
    if (!editingAccount) return;
    try {
      await updateAccountBalance({ data: { id: editingAccount.id, current_balance: Number(newBalance) } });
      toast.success("Saldo inicial atualizado");
      setEditingAccount(null);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    transactions.forEach(t => {
      const d = dateBR(t.created_at ? String(t.created_at) : (t.due_date ? String(t.due_date) : ""));
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });
    return groups;
  }, [transactions]);

  // Consulta consolidada para os 4 StatCards de topo no período selecionado
  const { data: statsData } = useQuery({
    queryKey: ["transactions-stats", startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("type, amount, status, created_at");

      if (startDate) q = q.gte("created_at", `${startDate}T00:00:00`);
      if (endDate) q = q.lte("created_at", `${endDate}T23:59:59.999`);

      const { data } = await q;
      const all = (data as any[]) || [];
      const paid = all.filter(t => ["pago", "paid"].includes(String(t.status || "").toLowerCase()));
      const inflow = paid.filter(r => (r.type === "entrada" || r.type === "income")).reduce((s, r) => s + Number(r.amount || 0), 0);
      const outflow = paid.filter(r => (r.type === "saida" || r.type === "expense")).reduce((s, r) => s + Math.abs(Number(r.amount || 0)), 0);
      const pending = all.filter(t => ["pendente", "pending", "aberto"].includes(String(t.status || "").toLowerCase())).length;
      return { inflow, outflow, pending, balance: inflow - outflow };
    },
  });

  const stats = statsData || { inflow: 0, outflow: 0, pending: 0, balance: 0 };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pago': return <CheckCircle2 className="size-3 text-success" />;
      case 'pendente': return <Clock className="size-3 text-warning" />;
      case 'cancelado': return <XCircle className="size-3 text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Transações" 
        description="Gerencie receitas e adições"
        icon={ArrowLeftRight}
        actions={
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2 rounded-xl"
              onClick={() => {
                const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                const end = new Date().toISOString().split('T')[0];
                
                const csvContent = transactions.map(t => ({
                  Data: dateBR(t.created_at),
                  Descricao: t.description || "",
                  Tipo: t.type || "",
                  Valor: Math.abs(t.amount || 0),
                  Status: t.status || "",
                  Categoria: t.category || "",
                  Conta: t.financial_accounts?.name || ""
                }));
                
                if (csvContent.length === 0) return;

                const firstItem = csvContent[0] as Record<string, any>;
                const header = Object.keys(firstItem).join(",");
                const rows = csvContent.map(row => Object.values(row).join(",")).join("\n");
                const csv = `${header}\n${rows}`;
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `extrato_financeiro_${start}_${end}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="size-4" /> Exportar CSV
            </Button>
            <Button onClick={() => setIsNewModalOpen(true)} className="gap-2 bg-green-500 border-none shadow-lg shadow-green-100 font-bold rounded-xl h-11">
              <Plus className="size-4" /> Nova Transação
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Receitas totais" value={brl(stats.inflow)} icon={TrendingUp} tone="success" />
        <StatCard title="Total Despesas" value={brl(stats.outflow)} icon={TrendingDown} tone="destructive" />
        <StatCard title="Saldo" value={brl(stats.balance)} icon={DollarSign} tone="gold" />
        <StatCard title="Pendentes" value={stats.pending.toString()} icon={Clock} tone="warning" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por descrição ou categoria..." 
            className="pl-10 h-10 sm:h-11 rounded-xl bg-card border-border/40 text-xs sm:text-sm"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 rounded-2xl border border-border/40 bg-card p-3 sm:p-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data início</label>
          <Input
            type="date"
            lang="pt-BR"
            className="h-10 sm:h-11 rounded-xl text-xs sm:text-sm"
            value={startDate}
            max={endDate || undefined}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data fim</label>
          <Input
            type="date"
            lang="pt-BR"
            className="h-10 sm:h-11 rounded-xl text-xs sm:text-sm"
            value={endDate}
            min={startDate || undefined}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        {(startDate || endDate || typeFilter !== "todos" || statusFilter !== "todos" || term) && (
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {totalCount} {totalCount === 1 ? "lançamento encontrado" : "lançamentos encontrados"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-[10px] sm:text-[11px] font-bold uppercase h-7 sm:h-8"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setTypeFilter("todos");
                setStatusFilter("todos");
                setTerm("");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {([
          { key: "todos", label: "Todos" },
          { key: "receita", label: "Receita" },
          { key: "despesa", label: "Despesa" },
        ] as const).map(o => (
          <Button
            key={`type-${o.key}`}
            variant={typeFilter === o.key ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "rounded-lg text-[11px] font-bold uppercase h-8",
              typeFilter === o.key && "bg-green-500 text-white hover:bg-green-600"
            )}
            onClick={() => setTypeFilter(o.key)}
          >
            {o.label}
          </Button>
        ))}
        <span className="w-px bg-border/60 mx-1 shrink-0" />
        {([
          { key: "todos", label: "Todos" },
          { key: "pago", label: "Pago" },
          { key: "pendente", label: "Pendente" },
          { key: "atrasado", label: "Atrasado" },
          { key: "cancelado", label: "Cancelado" },
        ] as const).map(o => (
          <Button
            key={`status-${o.key}`}
            variant={statusFilter === o.key ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "rounded-lg text-[11px] font-bold uppercase h-8",
              statusFilter === o.key && "bg-blue-500 text-white hover:bg-blue-600"
            )}
            onClick={() => setStatusFilter(o.key)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-10">
          {Object.entries(grouped).map(([date, items]) => {
            const dateRevenue = items.filter(t => t.type === 'entrada' || t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
            const dateExpense = items.filter(t => t.type === 'saida' || t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
            
            return (
              <div key={date} className="space-y-1 overflow-hidden rounded-2xl sm:rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="bg-blue-600 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-white">
                  <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar className="size-4 sm:size-5 shrink-0" />
                      <h3 className="font-bold text-xs sm:text-sm tracking-tight">{date}</h3>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white border-none text-[9px] sm:text-[10px] uppercase font-black">{items.length} {items.length === 1 ? 'transação' : 'transações'}</Badge>
                  </div>
                  <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-6 pt-1 sm:pt-0 border-t border-white/15 sm:border-t-0">
                    <div className="text-left sm:text-right">
                       <p className="text-[8px] sm:text-[9px] uppercase font-black opacity-80">Receitas</p>
                       <p className="font-bold text-[11px] sm:text-xs truncate">{brl(dateRevenue)}</p>
                    </div>
                    <div className="text-center sm:text-right">
                       <p className="text-[8px] sm:text-[9px] uppercase font-black opacity-80">Despesas</p>
                       <p className="font-bold text-[11px] sm:text-xs truncate">-{brl(dateExpense)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] sm:text-[9px] uppercase font-black opacity-80">Saldo do Dia</p>
                       <p className="font-bold text-[11px] sm:text-sm truncate">{brl(dateRevenue - dateExpense)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white divide-y divide-gray-50">
                  {items.map(t => {
                    const isIncome = t.type === 'entrada' || t.type === 'income';
                    return (
                      <div 
                        key={t.id} 
                        className="group p-3 sm:p-4 hover:bg-gray-50/70 transition-colors cursor-pointer active:bg-gray-100/60"
                        onClick={() => setViewingTransaction(t)}
                      >
                        {/* Linha Principal: Ícone + Detalhes + Valor + Menu/Ações */}
                        <div className="flex items-start sm:items-center justify-between gap-2.5 sm:gap-4">
                          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                            <div className={cn(
                              "size-8 sm:size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0",
                              isIncome ? "bg-green-50 text-green-500" : "bg-red-50 text-red-500"
                            )}>
                              {isIncome ? <TrendingUp className="size-4 sm:size-5" /> : <TrendingDown className="size-4 sm:size-5" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                                <h4 className="font-semibold text-xs sm:text-sm text-gray-900 leading-snug break-words line-clamp-2 sm:line-clamp-none">
                                  {formatTransactionTitle(t.description, t.clients?.name)}
                                </h4>
                                <Badge variant="secondary" className={cn(
                                  "text-[9px] font-black uppercase h-4 sm:h-5 px-1 sm:px-1.5 border-none shrink-0",
                                  t.status === 'pago' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                )}>
                                  {t.status}
                                </Badge>
                              </div>
                              
                              {t.clients?.name ? (
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5 truncate">
                                  {t.clients.name}
                                </p>
                              ) : (t.suppliers?.name || t.supplier_name) ? (
                                <p className="text-xs sm:text-sm font-bold text-gray-800 mt-0.5 truncate">
                                  {t.suppliers?.name || t.supplier_name}
                                </p>
                              ) : null}

                              {/* Metadados no Desktop */}
                              <div className="hidden sm:flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-normal uppercase tracking-tight">
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 font-semibold text-[9px] text-gray-600">
                                  {t.category || "Vendas"}
                                </span>
                                <span className="size-1 rounded-full bg-gray-300" />
                                <span>
                                  {t.financial_accounts?.name || "Caixa Principal"}
                                </span>
                                <span className="size-1 rounded-full bg-gray-300" />
                                <span>
                                  {dateBR(t.created_at || t.due_date)}
                                </span>
                                {t.payment_method && (
                                  <>
                                    <span className="size-1 rounded-full bg-gray-300" />
                                    <span>{t.payment_method}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Lado Direito: Valor + Ações */}
                          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                            <div className="text-right">
                              <p className={cn(
                                "font-black text-xs sm:text-lg font-display whitespace-nowrap",
                                isIncome ? "text-green-600" : "text-red-600"
                              )}>
                                {isIncome ? '+' : '-'} {brl(Math.abs(t.amount))}
                              </p>
                            </div>

                            {/* Menu mobile (3 pontinhos) */}
                            <div className="sm:hidden" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                                  <DropdownMenuItem onClick={() => setViewingTransaction(t)} className="gap-2 text-xs font-semibold py-2">
                                    <Eye className="size-3.5 text-gray-500" /> Ver Detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingTransaction(t)} className="gap-2 text-xs font-semibold py-2">
                                    <Pencil className="size-3.5 text-blue-500" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteItem(t.id)} className="gap-2 text-xs font-semibold py-2 text-red-600 focus:text-red-600 focus:bg-red-50">
                                    <Trash2 className="size-3.5 text-red-500" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Botões no Desktop */}
                            <div className="hidden sm:flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-gray-100" onClick={() => setViewingTransaction(t)}>
                                <Eye className="size-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-gray-100" onClick={() => setEditingTransaction(t)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-red-50 text-red-500 hover:bg-red-50" onClick={() => handleDeleteItem(t.id)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Metadados no Mobile: alinhado ao texto ao lado do ícone */}
                        <div className="sm:hidden flex items-center gap-1.5 pl-10.5 mt-2 flex-wrap text-[10px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 font-semibold uppercase text-[9px] text-gray-700 tracking-wider">
                            {t.category || "Vendas"}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="font-medium text-gray-600 truncate max-w-[130px]">
                            {t.financial_accounts?.name || "Caixa Principal"}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="font-medium text-gray-500">
                            {dateBR(t.created_at || t.due_date)}
                          </span>
                          {t.payment_method && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="font-medium text-gray-500">{t.payment_method}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barra de Paginação */}
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={totalCount}
        itemName="transações"
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Existing Account Modal preserved */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Editar Saldo da Conta</DialogTitle>
            <DialogDescription>
              Ajuste o saldo inicial da conta "{editingAccount?.name}". O saldo atual será recalculado com base nas transações.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Saldo Inicial</label>
              <Input 
                type="number" 
                step="0.01" 
                value={newBalance} 
                onChange={(e) => setNewBalance(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleUpdateAccountBalance}
              className="w-full bg-gradient-gold border-none shadow-gold font-bold h-12 rounded-xl"
            >
              Salvar Novo Saldo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionDetailsModal 
        isOpen={!!viewingTransaction}
        onClose={() => setViewingTransaction(null)}
        transaction={viewingTransaction}
      />

      {isOpenModal && (
        <TransactionModal 
          isOpen={isOpenModal}
          onClose={() => {
              setIsNewModalOpen(false);
              setEditingTransaction(null);
          }}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
}
