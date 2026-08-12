import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  ShoppingCart, 
  Search,
  Plus,
  Filter,
  MoreVertical,
  Calendar,
  User,
  CreditCard,
  ChevronRight,
  Printer,
  FileDown,
  TrendingUp,
  AlertTriangle,
  CreditCard as InstallmentsIcon,
  PieChart,
  ArrowLeftRight,
  Landmark,
  FileText
} from "lucide-react";


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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { POSModal } from "@/components/sales/POSModal";
import { SaleInstallmentsModal } from "@/components/sales/SaleInstallmentsModal";



export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios Financeiros — Amstore Gestão" },
      { name: "description", content: "Relatórios e estatísticas da loja." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: sales = [], isLoading: salesLoading } = useRows("sales");
  const { data: installments = [], isLoading: instLoading } = useRows<any>("sale_installments" as any);
  const { data: clients = [] } = useRows("clients");
  const { data: transactions = [] } = useRows("transactions");

  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);

  const reportData = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59);

    const periodSales = (sales as any[]).filter(s => {
      const d = new Date(s.created_at);
      return d >= start && d <= end;
    });

    const periodTransactions = (transactions as any[]).filter(t => {
      const d = new Date(t.created_at);
      return d >= start && d <= end;
    });

    const income = periodTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

    // Debt reports
    const pendingInstallments = (installments as any[]).filter(i => {
      const d = new Date(i.due_date);
      return i.status !== 'paid' && d >= start && d <= end;
    });

    const receivedInstallments = (installments as any[]).filter(i => {
      if (!i.paid_at) return false;
      const d = new Date(i.paid_at);
      return d >= start && d <= end;
    });

    const totalToReceive = pendingInstallments.reduce((sum, i) => sum + Number(i.remaining_amount ?? i.amount), 0);
    const totalReceived = receivedInstallments.reduce((sum, i) => sum + Number(i.paid_amount), 0);

    // Group by client
    const clientStats: Record<string, { name: string, total: number, paid: number, pending: number }> = {};
    
    periodSales.forEach(s => {
      const clientName = clientById.get(s.client_id || "")?.name || "Consumidor Final";
      if (!clientStats[clientName]) {
        clientStats[clientName] = { name: clientName, total: 0, paid: 0, pending: 0 };
      }
      clientStats[clientName].total += Number(s.total_amount);
      clientStats[clientName].paid += Number(s.paid_amount);
      clientStats[clientName].pending += (Number(s.total_amount) - Number(s.paid_amount));
    });

    return {
      income,
      expense,
      balance: income - expense,
      totalSales: periodSales.length,
      salesValue: periodSales.reduce((sum, s) => sum + Number(s.total_amount), 0),
      totalToReceive,
      totalReceived,
      clientStats: Object.values(clientStats).sort((a, b) => b.total - a.total)
    };
  }, [sales, installments, transactions, dateRange, clientById]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Relatórios Financeiros" 
        description="Acompanhamento detalhado de vendas, fiados e transações"
        icon={PieChart}
      />

      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-card rounded-[2rem] border border-border/40 shadow-sm items-end">
        <div className="space-y-2 flex-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-2">Data Início</label>
          <Input 
            type="date" 
            value={dateRange.start} 
            onChange={e => setDateRange({...dateRange, start: e.target.value})}
            className="h-12 rounded-2xl bg-muted/20 border-none font-bold"
          />
        </div>
        <div className="space-y-2 flex-1">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-2">Data Fim</label>
          <Input 
            type="date" 
            value={dateRange.end} 
            onChange={e => setDateRange({...dateRange, end: e.target.value})}
            className="h-12 rounded-2xl bg-muted/20 border-none font-bold"
          />
        </div>
        <Button className="h-12 rounded-2xl bg-gold text-black font-bold hover:bg-gold/90 px-8 gap-2">
          <Filter className="size-4" /> FILTRAR PERÍODO
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard title="Total Vendas" value={reportData.totalSales} icon={ShoppingCart} tone="dark" />
        <StatCard title="Valor em Vendas" value={brl(reportData.salesValue)} icon={TrendingUp} tone="gold" />
        <StatCard title="Recebido (Fiado)" value={brl(reportData.totalReceived)} icon={Landmark} tone="success" />
        <StatCard title="A Receber (Fiado)" value={brl(reportData.totalToReceive)} icon={AlertTriangle} tone="warning" />
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-card p-1 rounded-2xl border border-border/40 h-14 w-full sm:w-auto">
          <TabsTrigger value="general" className="rounded-xl h-full font-bold px-6 data-[state=active]:bg-gold data-[state=active]:text-black">
            Resumo Geral
          </TabsTrigger>
          <TabsTrigger value="clients" className="rounded-xl h-full font-bold px-6 data-[state=active]:bg-gold data-[state=active]:text-black">
            Por Cliente (Fiado)
          </TabsTrigger>
          <TabsTrigger value="installments" className="rounded-xl h-full font-bold px-6 data-[state=active]:bg-gold data-[state=active]:text-black">
            Fluxo de Parcelas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card className="rounded-[2.5rem] border-border/40 bg-card overflow-hidden">
            <CardContent className="p-8">
              <div className="grid sm:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <h3 className="font-display font-black text-xl text-success flex items-center gap-2">
                    <TrendingUp className="size-5" /> ENTRADAS
                  </h3>
                  <p className="text-4xl font-display font-black">{brl(reportData.income)}</p>
                  <div className="h-2 w-full bg-success/10 rounded-full overflow-hidden">
                    <div className="h-full bg-success w-full" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-display font-black text-xl text-destructive flex items-center gap-2">
                    <ArrowLeftRight className="size-5" /> SAÍDAS
                  </h3>
                  <p className="text-4xl font-display font-black">{brl(reportData.expense)}</p>
                  <div className="h-2 w-full bg-destructive/10 rounded-full overflow-hidden">
                    <div className="h-full bg-destructive" style={{ width: `${Math.min(100, (reportData.expense / (reportData.income || 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-display font-black text-xl text-gold flex items-center gap-2">
                    <Landmark className="size-5" /> SALDO FINAL
                  </h3>
                  <p className="text-4xl font-display font-black">{brl(reportData.balance)}</p>
                  <div className="h-2 w-full bg-gold/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gold w-full" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <Card className="rounded-[2.5rem] border-border/40 bg-card overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-left">
                <thead className="bg-muted/30 border-b border-border/40">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Comprado</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Pago</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo Pendente</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {reportData.clientStats.map((c, i) => (
                    <tr key={i} className="hover:bg-muted/5 transition-colors group">
                      <td className="px-6 py-5 font-bold">{c.name}</td>
                      <td className="px-6 py-5 font-display font-black text-gold">{brl(c.total)}</td>
                      <td className="px-6 py-5 font-bold text-success">{brl(c.paid)}</td>
                      <td className="px-6 py-5 font-bold text-destructive">{brl(c.pending)}</td>
                      <td className="px-6 py-5 text-right">
                        <Button variant="ghost" size="sm" className="rounded-xl gap-2 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileText className="size-4" /> Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installments" className="mt-6">
           <div className="grid gap-6 sm:grid-cols-2">
              <Card className="rounded-[2.5rem] border-border/40 bg-card">
                 <CardContent className="p-8 space-y-6">
                    <h3 className="font-display font-black text-xl flex items-center gap-2">
                       <CheckCircle2 className="size-5 text-success" /> Recebimentos do Período
                    </h3>
                    <div className="space-y-4">
                       { (installments as any[]).filter(i => {
                          if (!i.paid_at) return false;
                          const d = new Date(i.paid_at);
                          return d >= new Date(dateRange.start) && d <= new Date(dateRange.end);
                       }).slice(0, 5).map((inst, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-2xl">
                             <div>
                                <p className="text-xs font-bold">Venda #{inst.sale_id.slice(0, 8)}</p>
                                <p className="text-[9px] uppercase font-bold text-muted-foreground">{dateBR(inst.paid_at)}</p>
                             </div>
                             <p className="font-black text-success">{brl(inst.paid_amount)}</p>
                          </div>
                       ))}
                    </div>
                 </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-border/40 bg-card">
                 <CardContent className="p-8 space-y-6">
                    <h3 className="font-display font-black text-xl flex items-center gap-2">
                       <AlertTriangle className="size-5 text-warning" /> Pendências no Período
                    </h3>
                    <div className="space-y-4">
                       { (installments as any[]).filter(i => {
                          const d = new Date(i.due_date);
                          return i.status !== 'paid' && d >= new Date(dateRange.start) && d <= new Date(dateRange.end);
                       }).slice(0, 5).map((inst, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-muted/20 rounded-2xl">
                             <div>
                                <p className="text-xs font-bold">Venda #{inst.sale_id.slice(0, 8)}</p>
                                <p className="text-[9px] uppercase font-bold text-muted-foreground">Vence {dateBR(inst.due_date)}</p>
                             </div>
                             <p className="font-black text-destructive">{brl(inst.remaining_amount ?? inst.amount)}</p>
                          </div>
                       ))}
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { CheckCircle2 } from "lucide-react";
