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
  Plus
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
  const { data: transactions = [], isLoading } = useRows("transactions", { order: { column: "created_at", ascending: false } });
  const [term, setTerm] = useState("");

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
    const data = transactions as any[];
    const inflow = data.filter(r => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0);
    const outflow = data.filter(r => r.type === "saida").reduce((s, r) => s + Number(r.amount), 0);
    const credit = data.filter(r => r.type === "fiado").reduce((s, r) => s + Number(r.amount), 0);
    return { inflow, outflow, credit, balance: inflow - outflow };
  }, [transactions]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "entrada":
        return <Badge className="bg-success/10 text-success border-none">Entrada</Badge>;
      case "saida":
        return <Badge className="bg-destructive/10 text-destructive border-none">Saída</Badge>;
      case "fiado":
        return <Badge className="bg-warning/10 text-warning border-none">Fiado</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
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
            <Button variant="outline" className="gap-2 rounded-xl">
              <Download className="size-4" /> Exportar
            </Button>
            <Button onClick={() => window.location.href = "/sales"} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
              <Plus className="size-4" /> Nova Venda
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Entradas" value={brl(stats.inflow)} icon={TrendingUp} tone="success" />
        <StatCard title="Total Saídas" value={brl(stats.outflow)} icon={TrendingDown} tone="destructive" />
        <StatCard title="Total em Fiado" value={brl(stats.credit)} icon={FileText} tone="warning" />
        <StatCard title="Saldo em Caixa" value={brl(stats.balance)} icon={DollarSign} tone="gold" />
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
                  <Card key={t.id} className="group overflow-hidden rounded-3xl border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="flex items-center p-4 gap-4">
                        <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          t.type === 'entrada' ? 'bg-success/10 text-success' : 
                          t.type === 'saida' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                        }`}>
                           {t.type === 'entrada' ? <TrendingUp className="size-6" /> : 
                            t.type === 'saida' ? <TrendingDown className="size-6" /> : <ArrowLeftRight className="size-6" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start">
                              <div>
                                 <h4 className="font-bold truncate">{t.description || "Sem descrição"}</h4>
                                 <div className="mt-1">{getTypeBadge(t.type)}</div>
                              </div>
                              <div className="text-right">
                                 <p className={`font-black text-lg font-display ${t.type === 'saida' ? 'text-destructive' : 'text-success'}`}>
                                    {t.type === 'saida' ? '-' : '+'} {brl(t.amount)}
                                 </p>
                                 <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                                    ID #{t.id.slice(0,8)}
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
                                 <DropdownMenuItem className="rounded-xl gap-2 text-destructive"><MoreVertical className="size-4" /> Excluir Lançamento</DropdownMenuItem>
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
