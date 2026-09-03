import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  HandCoins, 
  Wallet,
  Search,
  Filter,
  User,
  Calendar,
  ChevronRight,
  Plus,
  FileText,
  AlertCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRows } from "@/lib/data";
import { brl, dateBR } from "@/lib/format";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import { ClientDetailsModal } from "@/components/clients/ClientDetailsModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/credit")({
  head: () => ({
    meta: [
      { title: "Fiado — Amstore Gestão" },
      { name: "description", content: "Controle das vendas no fiado por cliente, com registro de pagamentos parciais." },
    ],
  }),
  component: CreditPage,
});

type Sale = {
  id: string;
  client_id: string | null;
  total_amount: number;
  paid_amount: number;
  status: string | null;
  is_debt: boolean | null;
  created_at: string | null;
  sale_code?: string;
};
type Client = { id: string; name: string; phone: string | null };
type Installment = { id: string; sale_id: string; amount: number; due_date: string; status: string };

function CreditPage() {
  const { data: sales = [], isLoading: salesLoading } = useRows<Sale>("sales", {
    filters: [{ column: "is_debt", value: true }],
  });
  const { data: clients = [] } = useRows<Client>("clients");
  const { data: installments = [] } = useRows<Installment>("sale_installments" as any);

  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<'todos' | 'vencidos' | 'em_dia'>('todos');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [saleDetailsOpen, setSaleDetailsOpen] = useState(false);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  
  const clientStats = useMemo(() => {
    const stats = new Map<string, {
      name: string;
      pendingCount: number;
      totalDue: number;
      isOverdue: boolean;
      clientId: string;
    }>();

    sales.forEach(s => {
      if (!s.client_id) return;

      const status = String(s.status || "").toLowerCase();
      if (["paid", "pago", "quitado", "cancelado", "cancelled"].includes(status)) return;

      // Saldo devedor real: ignora fiados já quitados (valor zerado)
      const remaining = Number(s.total_amount || 0) - Number(s.paid_amount || 0);
      if (remaining <= 0.009) return;

      const client = clientById.get(s.client_id);
      if (!client) return;

      const current = stats.get(s.client_id) || {
        name: client.name,
        pendingCount: 0,
        totalDue: 0,
        isOverdue: false,
        clientId: s.client_id
      };

      current.pendingCount += 1;
      current.totalDue += remaining;

      // Check if any installment for this sale is overdue
      const saleInstallments = installments.filter(
        i => i.sale_id === s.id && !["paid", "pago"].includes(String(i.status || "").toLowerCase())
      );
      const hasOverdue = saleInstallments.some(i => new Date(i.due_date) < new Date());
      if (hasOverdue) current.isOverdue = true;

      stats.set(s.client_id, current);
    });

    return Array.from(stats.values());
  }, [sales, clients, installments, clientById]);

  const filteredClients = useMemo(() => {
    return clientStats.filter(c => {
      const matchesTerm = c.name.toLowerCase().includes(term.toLowerCase());
      if (filter === 'vencidos') return matchesTerm && c.isOverdue;
      if (filter === 'em_dia') return matchesTerm && !c.isOverdue;
      return matchesTerm;
    });
  }, [clientStats, term, filter]);

  const totalDueAll = clientStats.reduce((acc, c) => acc + c.totalDue, 0);
  const overdueCount = clientStats.filter(c => c.isOverdue).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Gestão de Fiado" 
        description="Controle de vendas a prazo por cliente" 
        icon={HandCoins}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total em Aberto" value={brl(totalDueAll)} icon={Wallet} tone="warning" />
        <StatCard title="Clientes com Débito" value={clientStats.length} icon={User} tone="dark" />
        <StatCard title="Clientes Atrasados" value={overdueCount} icon={AlertCircle} tone="destructive" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente..." 
            className="pl-10 h-11 rounded-2xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-muted/30 p-1 rounded-2xl gap-1">
          {(['todos', 'vencidos', 'em_dia'] as const).map((f) => (
            <Button
              key={f}
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-xl px-4 font-bold capitalize transition-all",
                filter === f ? "bg-card text-gold shadow-sm" : "text-muted-foreground"
              )}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {salesLoading ? (
           [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-card animate-pulse rounded-[2rem]" />)
        ) : filteredClients.length === 0 ? (
           <Card className="col-span-full rounded-[2rem] border-dashed bg-muted/20 border-border/40">
              <CardContent className="p-12 text-center text-muted-foreground">Nenhum cliente encontrado com os filtros atuais.</CardContent>
           </Card>
        ) : (
          filteredClients.map(c => (
            <Card key={c.clientId} className="group overflow-hidden rounded-[2rem] border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm hover:shadow-md border-t-4 border-t-gold">
              <CardContent className="p-6">
                 <div className="flex justify-between items-start mb-4">
                    <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0">
                       <User className="size-6 text-muted-foreground" />
                    </div>
                    {c.isOverdue && (
                      <Badge className="bg-destructive/10 text-destructive border-none font-black flex gap-1 items-center">
                        <Clock className="size-3" /> VENCIDO
                      </Badge>
                    )}
                 </div>

                 <div className="space-y-4">
                    <div>
                       <h4 className="font-black text-lg truncate uppercase tracking-tight">{c.name}</h4>
                       <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                          {c.pendingCount} {c.pendingCount === 1 ? 'Venda Pendente' : 'Vendas Pendentes'}
                       </p>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-2xl">
                       <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Total Devido</p>
                       <p className="text-2xl font-black text-gold font-display">{brl(c.totalDue)}</p>
                    </div>

                    <Button 
                      className="w-full rounded-xl font-bold gap-2 text-gold bg-gold/5 hover:bg-gold/10"
                      variant="ghost"
                      onClick={() => {
                        setSelectedClient(clientById.get(c.clientId));
                        setClientDetailsOpen(true);
                      }}
                    >
                       Ver Detalhes <ChevronRight className="size-4" />
                    </Button>
                 </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ClientDetailsModal 
        isOpen={clientDetailsOpen}
        onClose={() => setClientDetailsOpen(false)}
        client={selectedClient}
      />

      <SaleDetailsModal 
        saleId={selectedSaleId}
        isOpen={saleDetailsOpen}
        onClose={() => {
          setSaleDetailsOpen(false);
          setSelectedSaleId(null);
        }}
      />
    </div>
  );
}

