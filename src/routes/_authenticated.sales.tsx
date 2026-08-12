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
  CreditCard as InstallmentsIcon
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
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { POSModal } from "@/components/sales/POSModal";
import { SaleInstallmentsModal } from "@/components/sales/SaleInstallmentsModal";



export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Vendas — Amstore Gestão" },
      { name: "description", content: "Histórico de vendas e PDV." },
      { property: "og:title", content: "Vendas — Amstore Gestão" },
      { property: "og:description", content: "Histórico de vendas e PDV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const qc = useQueryClient();
  const { data: sales = [], isLoading } = useRows("sales", { order: { column: "created_at", ascending: false } });

  const { data: clients = [] } = useRows("clients");

  const [term, setTerm] = useState("");
  const [posOpen, setPosOpen] = useState(false);
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);


  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);

  const filtered = useMemo(() => {
    return (sales as any[]).filter(s => {
      const clientName = clientById.get(s.client_id || "")?.name || "Consumidor";
      return clientName.toLowerCase().includes(term.toLowerCase()) || s.id.toLowerCase().includes(term.toLowerCase());
    });
  }, [sales, term, clientById]);

  const groupedSales = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(s => {
      const createdAt = s.created_at;
      const d = dateBR(typeof createdAt === 'string' ? createdAt : "");
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return groups;
  }, [filtered]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const data = sales as any[];
    const todaySales = data.filter(s => {
      const createdAt = s.created_at;
      const dateStr = typeof createdAt === 'string' ? createdAt : "";
      return dateStr.slice(0, 10) === today;
    });
    const fiados = data.filter(s => !!s.is_debt && (s.status ? String(s.status) : "") !== "paid");
    
    return {
      countToday: todaySales.length,
      totalToday: todaySales.reduce((sum, s) => sum + Number(s.total_amount), 0),
      pendingFiado: fiados.length,
    };
  }, [sales]);

  const getStatusBadge = (s: any) => {
    if (s.is_debt && String(s.status || "") !== "paid") return <Badge className="bg-destructive/10 text-destructive border-none">Pendente (Fiado)</Badge>;
    return <Badge className="bg-success/10 text-success border-none">Pago</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Vendas" 
        description="Histórico completo de vendas e recebimentos"
        icon={ShoppingCart}
        actions={
          <Button 
            className="gap-2 bg-gradient-gold border-none shadow-gold font-bold"
            onClick={() => setPosOpen(true)}
          >
            <Plus className="size-4" /> Nova Venda (PDV)
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Vendas Hoje" value={stats.countToday} icon={ShoppingCart} tone="dark" />
        <StatCard title="Faturamento Hoje" value={brl(stats.totalToday)} icon={TrendingUp} tone="gold" />
        <StatCard title="Fiados em Aberto" value={stats.pendingFiado} icon={AlertTriangle} tone="warning" />

      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente ou código da venda..." 
            className="pl-10 h-11 rounded-2xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl"><Filter className="size-4" /></Button>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2].map(i => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-32 bg-muted/40 animate-pulse rounded-md" />
              <div className="space-y-3">
                {[1, 2, 3].map(j => <div key={j} className="h-20 bg-card animate-pulse rounded-3xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedSales).map(([date, items]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                 <Calendar className="size-4 text-gold" />
                 <h3 className="font-display font-black text-lg tracking-tight uppercase text-muted-foreground/80">{date}</h3>
                 <div className="h-px flex-1 bg-border/30 ml-2" />
              </div>
              
              <div className="space-y-3">
                {items.map(sale => (
                  <Card key={sale.id} className="group overflow-hidden rounded-3xl border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="flex items-center p-4 gap-4">
                        <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0">
                           <User className="size-6 text-muted-foreground" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start">
                              <div>
                                 <h4 className="font-bold truncate">{clientById.get(sale.client_id || "")?.name || "Consumidor Final"}</h4>
                                 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Venda #{sale.id.slice(0,8)}</p>
                              </div>
                              <div className="text-right">
                                 <p className="font-black text-lg font-display text-gold">{brl(sale.total_amount)}</p>
                                 <div className="flex items-center gap-1 justify-end text-[10px] text-muted-foreground font-bold">
                                    <CreditCard className="size-3" /> {sale.payment_method}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 px-4 border-l border-border/40">
                           {getStatusBadge(sale)}
                        </div>

                        <div className="flex items-center gap-1">
                           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                              <Printer className="size-4" />
                           </Button>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                    <MoreVertical className="size-4" />
                                 </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2">
                                 <DropdownMenuItem className="rounded-xl gap-2"><FileDown className="size-4" /> Baixar PDF</DropdownMenuItem>
                                 <DropdownMenuItem className="rounded-xl gap-2"><Printer className="size-4" /> Imprimir Cupom</DropdownMenuItem>
                                 {sale.is_debt && (
                                   <DropdownMenuItem 
                                     className="rounded-xl gap-2"
                                     onClick={() => {
                                       setSelectedSaleId(sale.id);
                                       setInstallmentsOpen(true);
                                     }}
                                   >
                                      <InstallmentsIcon className="size-4" /> Ver Parcelas
                                   </DropdownMenuItem>
                                 )}

                                 <DropdownMenuItem 
                                    className="rounded-xl gap-2 text-destructive"
                                    onClick={async () => {
                                       if (confirm("Deseja realmente estornar esta venda? O estoque será devolvido.")) {
                                          try {
                                             const { cancelSale } = await import("@/lib/sales.functions");
                                             await cancelSale({ data: { sale_id: sale.id } });
                                             toast.success("Venda estornada com sucesso");
                                             qc.invalidateQueries();
                                          } catch (err: any) {
                                             toast.error(err.message);
                                          }
                                       }
                                    }}
                                 >
                                    <MoreVertical className="size-4" /> Estornar Venda
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

      <POSModal open={posOpen} onOpenChange={setPosOpen} />
      <SaleInstallmentsModal 
        open={installmentsOpen} 
        onOpenChange={setInstallmentsOpen} 
        saleId={selectedSaleId}
      />
    </div>

  );
}

