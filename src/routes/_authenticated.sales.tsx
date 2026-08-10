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
  FileDown
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

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Vendas — Amstore Gestão" },
      { name: "description", content: "Histórico de vendas e PDV." },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const { data: sales = [], isLoading } = useRows("sales", { order: { column: "created_at", ascending: false } });
  const { data: clients = [] } = useRows("clients");

  const [term, setTerm] = useState("");

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
      const d = dateBR(s.created_at ? String(s.created_at) : "");
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return groups;
  }, [filtered]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = (sales as any[]).filter(s => {
      const dateStr = s.created_at ? String(s.created_at) : "";
      return dateStr.startsWith(today);
    });
    const fiados = (sales as any[]).filter(s => !!s.is_debt && (s.status ? String(s.status) : "") !== "paid");
    
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
          <Button className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
            <Plus className="size-4" /> Nova Venda (PDV)
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Vendas Hoje" value={stats.countToday} icon={ShoppingCart} tone="dark" />
        <StatCard title="Faturamento Hoje" value={brl(stats.totalToday)} icon={TrendingUpIcon} tone="gold" />
        <StatCard title="Fiados em Aberto" value={stats.pendingFiado} icon={AlertTriangleIcon} tone="destructive" />
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
                                 <DropdownMenuItem className="rounded-xl gap-2 text-destructive"><MoreVertical className="size-4" /> Estornar Venda</DropdownMenuItem>
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
    </div>
  );
}

function TrendingUpIcon(props: any) {
   return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
   )
}

function AlertTriangleIcon(props: any) {
   return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
   )
}
