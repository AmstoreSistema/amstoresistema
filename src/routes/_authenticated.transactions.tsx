import { useState, useMemo } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
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

function TransactionsPage() {
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useRows("transactions", { 
    select: "*, financial_accounts(name), clients(name), suppliers(name)",
    order: { column: "created_at", ascending: false } 
  });
  const { data: accounts = [] } = useRows("financial_accounts", { filters: [{ column: "active", value: true }] });
  
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"todos" | "receita" | "despesa">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pago" | "pendente" | "atrasado" | "cancelado">("todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  const filtered = useMemo(() => {
    const search = term.toLowerCase();
    const startTs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endTs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return (transactions as any[]).filter(t => {
      const desc = (t.description || "").toLowerCase();
      const type = String(t.type || "").toLowerCase();
      const status = String(t.status || "").toLowerCase();
      const category = (t.category || "").toLowerCase();
      const client = (t.clients?.name || "").toLowerCase();
      const supplier = (t.suppliers?.name || t.supplier_name || "").toLowerCase();

      const matchesSearch =
        !search ||
        desc.includes(search) ||
        category.includes(search) ||
        client.includes(search) ||
        supplier.includes(search);
      if (!matchesSearch) return false;

      const isIncome = type === "entrada" || type === "income";
      if (typeFilter === "receita" && !isIncome) return false;
      if (typeFilter === "despesa" && isIncome) return false;

      if (statusFilter === "pago" && !["pago", "paid"].includes(status)) return false;
      if (statusFilter === "cancelado" && !["cancelado", "cancelled", "canceled"].includes(status)) return false;
      if (statusFilter === "pendente" || statusFilter === "atrasado") {
        const isPending = ["pendente", "pending", "aberto"].includes(status);
        if (!isPending) return false;
        const due = t.due_date ? new Date(`${String(t.due_date).slice(0, 10)}T23:59:59`).getTime() : null;
        const late = due !== null && due < Date.now();
        if (statusFilter === "atrasado" && !late) return false;
        if (statusFilter === "pendente" && late) return false;
      }

      const ts = t.created_at ? new Date(t.created_at).getTime() : null;
      if (startTs !== null && (ts === null || ts < startTs)) return false;
      if (endTs !== null && (ts === null || ts > endTs)) return false;

      return true;
    });
  }, [transactions, term, typeFilter, statusFilter, startDate, endDate]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(t => {
      const d = dateBR(t.created_at ? String(t.created_at) : "");
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });
    return groups;
  }, [filtered]);

  const stats = useMemo(() => {
    const data = filtered.filter(t => ["pago", "paid"].includes(String(t.status || "").toLowerCase()));
    const inflow = data.filter(r => (r.type === "entrada" || r.type === 'income')).reduce((s, r) => s + Number(r.amount), 0);
    const outflow = data.filter(r => (r.type === "saida" || r.type === 'expense')).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    const pending = filtered.filter(t => ["pendente", "pending"].includes(String(t.status || "").toLowerCase())).length;
    return { inflow, outflow, pending, balance: inflow - outflow };
  }, [filtered]);

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
                
                const csvContent = filtered.map(t => ({
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            className="pl-10 h-11 rounded-xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border/40 bg-card p-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data início</label>
          <Input
            type="date"
            lang="pt-BR"
            className="h-11 rounded-xl"
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
            className="h-11 rounded-xl"
            value={endDate}
            min={startDate || undefined}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        {(startDate || endDate || typeFilter !== "todos" || statusFilter !== "todos" || term) && (
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-[11px] font-bold uppercase h-8"
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
        <div className="space-y-10">
          {Object.entries(grouped).map(([date, items]) => {
            const dateRevenue = items.filter(t => t.type === 'entrada' || t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
            const dateExpense = items.filter(t => t.type === 'saida' || t.type === 'expense').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
            
            return (
              <div key={date} className="space-y-1 overflow-hidden rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="bg-blue-600 p-4 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <Calendar className="size-5" />
                    <h3 className="font-bold text-sm tracking-tight">{date}</h3>
                    <Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px] uppercase font-black">{items.length} {items.length === 1 ? 'transação' : 'transações'}</Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                       <p className="text-[9px] uppercase font-black opacity-80">Receitas</p>
                       <p className="font-bold text-xs">{brl(dateRevenue)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] uppercase font-black opacity-80">Despesas</p>
                       <p className="font-bold text-xs">-{brl(dateExpense)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] uppercase font-black opacity-80">Saldo do Dia</p>
                       <p className="font-bold text-sm">{brl(dateRevenue - dateExpense)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white divide-y divide-gray-50">
                  {items.map(t => {
                    const isIncome = t.type === 'entrada' || t.type === 'income';
                    return (
                      <div key={t.id} className="group p-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                        <div className={cn(
                          "size-10 rounded-xl flex items-center justify-center shrink-0",
                          isIncome ? "bg-green-50 text-green-500" : "bg-red-50 text-red-500"
                        )}>
                           {isIncome ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2">
                              <h4 className="font-normal text-sm text-gray-800 truncate">{t.description || "Sem descrição"}</h4>
                              <Badge variant="secondary" className={cn(
                                "text-[9px] font-black uppercase h-5 px-1.5 border-none",
                                t.status === 'pago' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                              )}>
                                {t.status}
                              </Badge>
                           </div>
                           
                           {t.clients?.name ? (
                             <div className="mt-0.5">
                               <p className="text-sm font-bold text-gray-900">{t.clients.name}</p>
                             </div>
                           ) : (t.suppliers?.name || t.supplier_name) ? (
                             <div className="mt-0.5">
                               <p className="text-sm font-bold text-gray-900">{t.suppliers?.name || t.supplier_name}</p>
                             </div>
                           ) : null}

                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-tight">
                                {t.category || "Vendas"}
                              </span>
                              <span className="size-1 rounded-full bg-gray-300" />
                              <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-tight">
                                 {t.financial_accounts?.name || "Caixa Principal"}
                              </span>
                              <span className="size-1 rounded-full bg-gray-300" />
                              <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-tight">
                                 {dateBR(t.created_at)}
                              </span>
                           </div>
                        </div>

                        <div className="text-right mr-4">
                           <p className={cn(
                             "font-black text-lg font-display",
                             isIncome ? "text-green-600" : "text-red-600"
                           )}>
                              {isIncome ? '+' : '-'} {brl(Math.abs(t.amount))}
                           </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
