import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  FileBarChart, 
  Search,
  ArrowRight,
  TrendingUp,
  Tag,
  AlertTriangle,
  Boxes,
  Layers,
  ShoppingBag,
  CircleDollarSign,
  Users,
  Wallet,
  Package,
  Calendar,
  Truck,
  FileText
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios — Amstore Gestão" },
      { name: "description", content: "Central de relatórios e métricas do sistema." },
    ],
  }),
  component: ReportsPage,
});

const REPORT_GROUPS = [
  {
    title: "Vendas e Loja",
    icon: ShoppingBag,
    items: [
      { name: "Vendas por Período", icon: Calendar, color: "text-blue-500" },
      { name: "Produtos Mais Vendidos", icon: TrendingUp, color: "text-gold" },
      { name: "Desempenho de Clientes", icon: Users, color: "text-purple-500" },
      { name: "Comissões de Vendas", icon: CircleDollarSign, color: "text-success" },
    ]
  },
  {
    title: "Financeiro",
    icon: Wallet,
    items: [
      { name: "Fluxo de Caixa", icon: TrendingUp, color: "text-success" },
      { name: "Contas a Pagar/Receber", icon: FileText, color: "text-blue-500" },
      { name: "Relatório de Fiado", icon: AlertTriangle, color: "text-destructive" },
      { name: "DRE Simplificado", icon: FileBarChart, color: "text-gold" },
    ]
  },
  {
    title: "Estoque e Produção",
    icon: Package,
    items: [
      { name: "Posição de Estoque", icon: Boxes, color: "text-gold" },
      { name: "Necessidade de Compra", icon: AlertTriangle, color: "text-destructive" },
      { name: "Custo de Produção", icon: Layers, color: "text-blue-500" },
      { name: "Eficiência Produtiva", icon: TrendingUp, color: "text-success" },
    ]
  },
  {
    title: "Materiais e Compras",
    icon: Truck,
    items: [
      { name: "Histórico de Compras", icon: Calendar, color: "text-blue-500" },
      { name: "Consumo de Materiais", icon: Layers, color: "text-gold" },
      { name: "Giro de Matéria-prima", icon: TrendingUp, color: "text-success" },
    ]
  }
];

function ReportsPage() {
  const [dateRange, setDateRange] = useState("Mês Atual");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Central de Relatórios" 
        description="Analise o desempenho de todas as áreas do seu negócio"
        icon={FileBarChart}
      />

      <Card className="rounded-[2rem] border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden shadow-elegant">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4 flex-1">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Search className="size-5 text-gold" /> Filtros Globais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-1">Período</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="h-11 rounded-xl bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hoje">Hoje</SelectItem>
                      <SelectItem value="Ontem">Ontem</SelectItem>
                      <SelectItem value="Últimos 7 dias">Últimos 7 dias</SelectItem>
                      <SelectItem value="Mês Atual">Mês Atual</SelectItem>
                      <SelectItem value="Mês Anterior">Mês Anterior</SelectItem>
                      <SelectItem value="Personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold ml-1">Unidade / Loja</Label>
                  <Select defaultValue="Todas">
                    <SelectTrigger className="h-11 rounded-xl bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas as Unidades</SelectItem>
                      <SelectItem value="Principal">Matriz Amstore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button size="lg" className="rounded-xl px-8 h-11 bg-gradient-gold border-none font-bold shadow-gold">
              Gerar Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 md:grid-cols-2">
        {REPORT_GROUPS.map((group) => (
          <div key={group.title} className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">
              <group.icon className="size-4 text-gold" /> {group.title}
            </h3>
            <div className="grid gap-4">
              {group.items.map((report) => (
                <button
                  key={report.name}
                  className="group flex items-center justify-between p-5 rounded-3xl border border-border/40 bg-card hover:border-gold/40 hover:bg-gold/5 transition-all text-left shadow-sm hover:shadow-gold/5"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl bg-muted/50 group-hover:bg-background transition-colors`}>
                      <report.icon className={`size-6 ${report.color}`} />
                    </div>
                    <div>
                      <h4 className="font-bold group-hover:text-gold transition-colors">{report.name}</h4>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Clique para visualizar</p>
                    </div>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground group-hover:text-gold transition-all group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
