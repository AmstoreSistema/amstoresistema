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
  Trash2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { createTransaction, updateTransactionStatus, deleteTransaction } from "@/lib/finance.functions.ts";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transações — Amstore Gestão" },
      { name: "description", content: "Todos os lançamentos financeiros: entradas de vendas, recebimentos de fiado e saídas." },
    ],
  }),
  component: TransactionsPage,
});

const transactionSchema = z.object({
  type: z.enum(["entrada", "saida"]),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  account_id: z.string().min(1, "Conta é obrigatória"),
  category: z.string().optional().nullable(),
  status: z.enum(["pago", "pendente"]),
  due_date: z.string().optional().nullable(),
});

function TransactionsPage() {
  const qc = useQueryClient();
  const { data: transactions = [], isLoading } = useRows("transactions", { order: { column: "created_at", ascending: false } });
  const { data: accounts = [] } = useRows("financial_accounts", { filters: [{ column: "active", value: true }] });
  
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "entrada",
      amount: 0,
      description: "",
      account_id: "",
      category: "Outros",
      status: "pago",
      due_date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (values: z.infer<typeof transactionSchema>) => {
    try {
      await createTransaction({ data: values });
      toast.success("Lançamento realizado com sucesso");
      setOpen(false);
      form.reset();
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: "pago" | "pendente" | "cancelado") => {
    try {
      await updateTransactionStatus({ data: { id, status } });
      toast.success("Status atualizado");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

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

  const filtered = useMemo(() => {
    return (transactions as any[]).filter(t => {
      const desc = (t.description || "").toLowerCase();
      const type = (t.type || "").toLowerCase();
      const search = term.toLowerCase();
      return desc.includes(search) || type.includes(search);
    });
  }, [transactions, term]);

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
    const data = (transactions as any[]).filter(t => t.status === 'pago');
    const inflow = data.filter(r => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0);
    const outflow = data.filter(r => r.type === "saida").reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    const pending = (transactions as any[]).filter(t => t.status === 'pendente').reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    return { inflow, outflow, pending, balance: inflow - outflow };
  }, [transactions]);

  const getTypeBadge = (t: any) => {
    if (t.status === 'cancelado') return <Badge variant="outline" className="opacity-50">Cancelado</Badge>;
    
    switch (t.type) {
      case "entrada":
        return <Badge className="bg-success/10 text-success border-none">Entrada</Badge>;
      case "saida":
        return <Badge className="bg-destructive/10 text-destructive border-none">Saída</Badge>;
      case "transferencia":
        return <Badge className="bg-info/10 text-info border-none">Transferência</Badge>;
      default:
        return <Badge variant="outline">{t.type}</Badge>;
    }
  };

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
        description="Livro caixa com todos os lançamentos financeiros"
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
                  Descricao: t.description,
                  Tipo: t.type,
                  Valor: Math.abs(t.amount),
                  Status: t.status,
                  Categoria: t.category,
                  Conta: t.financial_accounts?.name
                }));
                
                const header = Object.keys(csvContent[0]).join(",");
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
            <Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
              <Plus className="size-4" /> Novo Lançamento
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Entradas (Pagas)" value={brl(stats.inflow)} icon={TrendingUp} tone="success" />
        <StatCard title="Saídas (Pagas)" value={brl(stats.outflow)} icon={TrendingDown} tone="destructive" />
        <StatCard title="Total Pendente" value={brl(stats.pending)} icon={Clock} tone="warning" />
        <StatCard title="Saldo Consolidado" value={brl(stats.balance)} icon={DollarSign} tone="gold" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por descrição ou tipo..." 
            className="pl-10 h-11 rounded-2xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl"><Filter className="size-4" /></Button>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                 <Calendar className="size-4 text-gold" />
                 <h3 className="font-display font-black text-lg tracking-tight uppercase text-muted-foreground/80">{date}</h3>
                 <div className="h-px flex-1 bg-border/30 ml-2" />
              </div>
              
              <div className="space-y-3">
                {items.map(t => (
                  <Card key={t.id} className={cn(
                    "group overflow-hidden rounded-3xl border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm hover:shadow-md",
                    t.status === 'cancelado' && "opacity-60 grayscale"
                  )}>
                    <CardContent className="p-0">
                      <div className="flex items-center p-4 gap-4">
                        <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          t.type === 'entrada' ? 'bg-success/10 text-success' : 
                          t.type === 'saida' ? 'bg-destructive/10 text-destructive' : 'bg-info/10 text-info'
                        }`}>
                           {t.type === 'entrada' ? <TrendingUp className="size-6" /> : 
                            t.type === 'saida' ? <TrendingDown className="size-6" /> : <ArrowLeftRight className="size-6" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start">
                              <div>
                                 <div className="flex items-center gap-2">
                                    <h4 className="font-bold truncate">{t.description || "Sem descrição"}</h4>
                                    <div className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-full">
                                       {getStatusIcon(t.status)}
                                       <span className="text-[10px] uppercase font-black tracking-widest">{t.status}</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2 mt-1">
                                    {getTypeBadge(t)}
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                       {t.financial_accounts?.name || "Sem conta"}
                                    </span>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className={`font-black text-lg font-display ${t.type === 'saida' ? 'text-destructive' : 'text-success'}`}>
                                    {t.type === 'saida' ? '-' : '+'} {brl(Math.abs(t.amount))}
                                 </p>
                                 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                                    {t.category || "Outros"}
                                 </p>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center gap-1">
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                    <MoreVertical className="size-4" />
                                 </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2">
                                 <DropdownMenuItem className="rounded-xl gap-2"><FileText className="size-4" /> Detalhes</DropdownMenuItem>
                                 {t.status === 'pendente' && (
                                   <DropdownMenuItem 
                                     onClick={() => handleUpdateStatus(t.id, 'pago')}
                                     className="rounded-xl gap-2 text-success"
                                   >
                                     <CheckCircle2 className="size-4" /> Marcar como Pago
                                   </DropdownMenuItem>
                                 )}
                                 {t.status !== 'cancelado' && (
                                   <DropdownMenuItem 
                                     onClick={() => handleUpdateStatus(t.id, 'cancelado')}
                                     className="rounded-xl gap-2 text-warning"
                                   >
                                     <XCircle className="size-4" /> Estornar/Cancelar
                                   </DropdownMenuItem>
                                 )}
                                 <DropdownMenuItem 
                                   onClick={() => handleDeleteItem(t.id)}
                                   className="rounded-xl gap-2 text-destructive"
                                 >
                                   <Trash2 className="size-4" /> Excluir permanentemente
                                 </DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                           <ChevronRight className="size-5 text-muted-foreground/30 group-hover:text-gold transition-colors ml-1" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Transaction Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
            <DialogDescription>
              Registre entradas ou saídas manuais no seu livro caixa.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="entrada">Receita (Entrada)</SelectItem>
                          <SelectItem value="saida">Despesa (Saída)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Aluguel, Compra de material, Venda direta..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta Financeira</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(accounts as any[]).map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "Outros"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Venda">Venda</SelectItem>
                          <SelectItem value="Suprimentos">Suprimentos</SelectItem>
                          <SelectItem value="Infraestrutura">Infraestrutura</SelectItem>
                          <SelectItem value="Pessoal">Pessoal</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pago">Confirmado (Pago)</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do Lançamento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="mt-6">
                <Button type="submit" className="w-full bg-gradient-gold border-none shadow-gold font-bold">
                  Confirmar Lançamento
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
