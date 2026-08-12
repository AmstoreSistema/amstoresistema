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
  PieChart,
  ArrowLeftRight,
  Landmark,
  FileText,
  CheckCircle2,
  MessageCircle,
  Warehouse,
  Factory,
  Users,
  Boxes,
  Package,
  KanbanSquare,
  Truck,
  LayoutDashboard,
  FileBarChart
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Central de Relatórios — Amstore Gestão" },
      { name: "description", content: "Gere relatórios tabulares completos para o seu negócio." },
      { property: "og:title", content: "Central de Relatórios — Amstore Gestão" },
      { property: "og:description", content: "Gere relatórios tabulares completos para o seu negócio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type ReportType = 
  | "sales" | "installments" | "whatsapp" | "stock" | "financial" 
  | "production" | "clients" | "materials" | "products" | "suppliers" 
  | "purchases" | "general";

function ReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType>("sales");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const reportButtons = [
    { id: "sales", label: "Vendas", icon: ShoppingCart },
    { id: "installments", label: "Fiados/Parcelas", icon: Calendar },
    { id: "whatsapp", label: "Cobrança WhatsApp", icon: MessageCircle },
    { id: "stock", label: "Estoque", icon: Warehouse },
    { id: "financial", label: "Financeiro", icon: Landmark },
    { id: "production", label: "Produção", icon: Factory },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "materials", label: "Materiais", icon: Boxes },
    { id: "products", label: "Produtos", icon: Package },
    { id: "suppliers", label: "Fornecedores", icon: KanbanSquare },
    { id: "purchases", label: "Compras de Materiais", icon: Truck },
    { id: "general", label: "Geral Completo", icon: LayoutDashboard },
  ];

  const handleGenerateReport = () => {
    toast.info(`Gerando relatório de ${reportButtons.find(b => b.id === selectedType)?.label}...`);
    // Aqui viria a lógica de exportação/visualização detalhada
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden shadow-sm">
        <CardContent className="p-8 space-y-8">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <FileBarChart className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black tracking-tight">Central de Relatórios</h1>
              <p className="text-muted-foreground text-sm">Gere relatórios tabulares completos para o seu negócio.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span className="text-primary">1.</span> Escolha o Tipo de Relatório
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {reportButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setSelectedType(btn.id as ReportType)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all gap-3 text-center group h-28",
                    selectedType === btn.id 
                      ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "bg-muted/30 border-border/40 hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <btn.icon className={cn(
                    "size-6",
                    selectedType === btn.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                  )} />
                  <span className="text-[10px] font-bold uppercase leading-tight">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span className="text-primary">2.</span> Filtro por Período
            </h2>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="relative">
                  <Input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                    className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold px-4"
                  />
                </div>
                <div className="relative">
                  <Input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                    className="h-14 rounded-2xl bg-muted/20 border-border/40 font-bold px-4"
                  />
                </div>
              </div>
              <Button 
                onClick={handleGenerateReport}
                className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 gap-3 shadow-lg shadow-primary/20 md:w-auto w-full"
              >
                <FileBarChart className="size-5" />
                GERAR RELATÓRIO
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span className="text-primary">3.</span> Filtro Específico (Opcional)
            </h2>
            <div className="h-12 flex items-center justify-center border-2 border-dashed border-border/40 rounded-2xl text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
              Nenhum filtro adicional para este tipo de relatório
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section - Opcional, mas útil para o usuário ver algo acontecendo */}
      <div className="grid gap-6">
        <h2 className="font-display font-black text-lg px-2">Visualização Prévia</h2>
        <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden">
          <CardContent className="p-12 text-center space-y-4">
            <div className="size-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
              <Search className="size-8 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-muted-foreground">Selecione os filtros e clique em gerar</p>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/40">Os dados serão exibidos nesta área</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
