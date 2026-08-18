import { createFileRoute } from "@tanstack/react-router";
import { 
  AlertTriangle, 
  Search, 
  Users, 
  Landmark, 
  MessageCircle,
  CheckCircle2,
  PhoneOff
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDebtorsData } from "@/lib/whatsapp-billing.functions";
import { SendBillingModal } from "@/components/billing/SendBillingModal";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/whatsapp-billing")({
  component: WhatsAppBillingPage,
});

function WhatsAppBillingPage() {
  const [filter, setFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getDebtorsFn = useServerFn(getDebtorsData);
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-billing-data"],
    queryFn: () => getDebtorsFn()
  });

  const debtors = data?.debtors || [];
  const metrics = data?.metrics || {
    totalClients: 0,
    clientsWithPhone: 0,
    clientsWithOverdue: 0,
    totalToReceive: 0,
    totalOverdueValue: 0
  };

  const filteredDebtors = useMemo(() => {
    return debtors.filter((d: any) => {
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (d.phone && d.phone.includes(searchTerm));
      
      if (!matchesSearch) return false;

      if (filter === "vencidos") return d.totalOverdue > 0;
      if (filter === "a vencer") return d.totalOverdue === 0 && d.totalDue > 0;
      
      return true;
    });
  }, [debtors, searchTerm, filter]);

  const clientsWithoutPhone = debtors.filter((d: any) => !d.phone).length;

  const handleOpenBilling = (debtor: any) => {
    setSelectedDebtor(debtor);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Cobrança WhatsApp" 
        description="Gerencie lembretes de pagamento e cobranças pendentes."
      />

      {/* Warning Alert */}
      {clientsWithoutPhone > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 flex items-start gap-4 rounded-2xl shadow-sm">
          <div className="size-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0">
            <PhoneOff className="size-5" />
          </div>
          <div>
            <h3 className="font-black text-amber-900 leading-tight">Clientes com dívidas sem telefone</h3>
            <p className="text-sm text-amber-800/80 font-medium">{clientsWithoutPhone} clientes possuem débitos ativos mas não têm um número cadastrado para envio automático.</p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard 
          title="Com Telefone / Total" 
          value={`${metrics.clientsWithPhone} / ${metrics.totalClients}`} 
          icon={Users} 
          description="Contatos disponíveis"
        />
        <StatCard 
          title="Com Parcelas Vencidas" 
          value={metrics.clientsWithOverdue.toString()} 
          icon={AlertTriangle} 
          description="Clientes em atraso"
          className="text-destructive"
        />
        <StatCard 
          title="Total a Receber" 
          value={`R$ ${metrics.totalToReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={Landmark} 
        />
        <StatCard 
          title="Total Vencido" 
          value={`R$ ${metrics.totalOverdueValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={AlertTriangle} 
          className="bg-destructive/5"
        />
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou telefone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9 h-11 rounded-2xl bg-muted/30 border-none font-medium" 
            />
          </div>
        </div>
        <div className="flex p-1 bg-muted/50 rounded-2xl gap-1">
          {["Todos", "Vencidos", "A Vencer"].map((f) => (
            <Button 
              key={f} 
              variant="ghost"
              className={cn(
                "h-9 px-6 rounded-xl text-xs font-bold uppercase transition-all",
                filter === f.toLowerCase() ? "bg-white shadow-sm text-primary" : "text-muted-foreground"
              )}
              onClick={() => setFilter(f.toLowerCase())}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <Checkbox /> <span>Selecionar todos desta página</span>
        </div>
        
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-[1.5rem]" />)
        ) : filteredDebtors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <CheckCircle2 className="size-12 mb-4 opacity-20" />
            <p className="font-bold">Nenhum devedor encontrado com os filtros atuais.</p>
          </div>
        ) : filteredDebtors.map((debtor: any) => (
          <Card key={debtor.id} className="rounded-[1.5rem] border-border/40 hover:border-gold/30 transition-all group shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between p-6 gap-6">
                <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                  <Checkbox className="rounded-md" />
                  <div>
                    <h3 className="font-black text-lg group-hover:text-primary transition-colors">{debtor.name}</h3>
                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                      {debtor.phone || "Sem telefone"}
                    </p>
                  </div>
                  {debtor.totalOverdue > 0 && (
                    <Badge variant="destructive" className="h-5 rounded-md px-1.5 font-bold text-[9px] uppercase tracking-wider">
                      Vencido
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-8 items-center">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Devido</p>
                    <p className="font-black text-primary text-xl">R$ {debtor.totalDue.toFixed(2)}</p>
                  </div>
                  
                  <div className="text-right w-24">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Vencido</p>
                    <p className={cn("font-black text-xl", debtor.totalOverdue > 0 ? "text-destructive" : "text-success")}>
                      R$ {debtor.totalOverdue.toFixed(2)}
                    </p>
                  </div>

                  <div className="hidden md:block text-right border-l border-border/50 pl-8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Vendas / Prox. Vencimento</p>
                    <p className="font-black text-sm">
                      {debtor.salesCount} Vendas • {debtor.nextDue ? format(new Date(debtor.nextDue), "dd/MM") : "-"}
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={() => handleOpenBilling(debtor)}
                  className="gap-2 bg-gradient-gold shadow-gold font-bold h-11 px-6 rounded-xl hover:scale-105 transition-transform"
                >
                  <MessageCircle className="size-4" /> Enviar Cobrança
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SendBillingModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        debtor={selectedDebtor}
      />
    </div>
  );
}
