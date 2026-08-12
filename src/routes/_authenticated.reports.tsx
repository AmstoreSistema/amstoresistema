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
  FileBarChart,
  X
} from "lucide-react";
import { Link } from "@tanstack/react-router";

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

const REPORT_CONFIG = {
  sales: { 
    table: "sales", 
    url: "/sales", 
    dateColumn: "created_at" 
  },
  installments: { 
    table: "sale_installments", 
    url: "/credit", 
    dateColumn: "due_date" 
  },
  whatsapp: { 
    table: "sale_installments", 
    url: "/whatsapp-billing", 
    dateColumn: "due_date",
    filters: [{ column: "status", value: "pending" }]
  },
  stock: { 
    table: "stock_products", 
    url: "/stock", 
    dateColumn: "created_at" 
  },
  financial: { 
    table: "financial_accounts", 
    url: "/accounts", 
    dateColumn: "created_at" 
  },
  production: { 
    table: "production_orders", 
    url: "/production", 
    dateColumn: "created_at" 
  },
  clients: { 
    table: "clients", 
    url: "/clients", 
    dateColumn: "created_at" 
  },
  materials: { 
    table: "materials", 
    url: "/materials", 
    dateColumn: "created_at" 
  },
  products: { 
    table: "products", 
    url: "/products", 
    dateColumn: "created_at" 
  },
  suppliers: { 
    table: "suppliers", 
    url: "/purchase-board", 
    dateColumn: "created_at" 
  },
  purchases: { 
    table: "purchases", 
    url: "/purchases", 
    dateColumn: "created_at" 
  },
  general: { 
    table: "transactions", 
    url: "/transactions", 
    dateColumn: "created_at" 
  },
};

function ReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType>("sales");
  const [showResults, setShowResults] = useState(false);
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

  const config = REPORT_CONFIG[selectedType];
  
  const { data: reportData = [], isLoading } = useRows(config.table, {
    filters: config.filters,
    order: { column: config.dateColumn, ascending: false }
  });

  const filteredData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return reportData;
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return reportData.filter((row: any) => {
      const rowDate = new Date(row[config.dateColumn] || row.created_at);
      return rowDate >= start && rowDate <= end;
    });
  }, [reportData, dateRange, config]);

  const handleGenerateReport = () => {
    setShowResults(true);
    toast.success(`Relatório de ${reportButtons.find(b => b.id === selectedType)?.label} carregado.`);
  };

  const renderDataRow = (row: any) => {
    switch (selectedType) {
      case "sales":
        return (
          <div className="flex justify-between items-center py-3 border-b border-border/20 last:border-0 px-4 hover:bg-muted/5 transition-colors">
            <div className="flex-1">
              <p className="font-bold text-sm">#{row.id?.slice(0, 8)}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{dateBR(row.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-gold">{brl(row.total_amount)}</p>
              <p className="text-[10px] text-muted-foreground font-bold">{row.payment_method}</p>
            </div>
          </div>
        );
      case "stock":
        return (
          <div className="flex justify-between items-center py-3 border-b border-border/20 last:border-0 px-4 hover:bg-muted/5 transition-colors">
            <div className="flex-1">
              <p className="font-bold text-sm">{row.produto_nome}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Lote: {row.lote || "—"}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-primary">{row.quantidade_disponivel} un</p>
              <p className="text-[10px] text-muted-foreground font-bold">{row.categoria}</p>
            </div>
          </div>
        );
      case "production":
        return (
          <div className="flex justify-between items-center py-3 border-b border-border/20 last:border-0 px-4 hover:bg-muted/5 transition-colors">
            <div className="flex-1">
              <p className="font-bold text-sm">{row.produto_nome}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{row.codigo_ordem}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-gold">{row.quantity} un</p>
              <p className={cn("text-[10px] font-black uppercase", row.status === 'completed' ? 'text-success' : 'text-warning')}>
                {row.status}
              </p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex justify-between items-center py-3 border-b border-border/20 last:border-0 px-4 hover:bg-muted/5 transition-colors">
            <div className="flex-1">
              <p className="font-bold text-sm">{row.name || row.description || row.id?.slice(0, 8)}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">{dateBR(row.created_at || row.due_date)}</p>
            </div>
            {row.amount || row.total_amount || row.current_stock ? (
              <div className="text-right">
                <p className="font-black text-gold">
                  {row.amount || row.total_amount ? brl(row.amount || row.total_amount) : `${row.current_stock} un`}
                </p>
              </div>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden shadow-sm">
        <CardContent className="p-8 space-y-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <FileBarChart className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-black tracking-tight">Central de Relatórios</h1>
                <p className="text-muted-foreground text-sm">Gere relatórios tabulares completos para o seu negócio.</p>
              </div>
            </div>
            <Button 
              asChild 
              variant="outline" 
              className="rounded-xl border-border/40 hover:bg-muted/50 gap-2 font-bold"
            >
              <Link to={config.url}>
                IR PARA MÓDULO <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span className="text-primary">1.</span> Escolha o Tipo de Relatório
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {reportButtons.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => {
                    setSelectedType(btn.id as ReportType);
                    setShowResults(false);
                  }}
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
                disabled={isLoading}
                className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 gap-3 shadow-lg shadow-primary/20 md:w-auto w-full"
              >
                {isLoading ? <RefreshCw className="size-5 animate-spin" /> : <FileBarChart className="size-5" />}
                GERAR RELATÓRIO
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span className="text-primary">3.</span> Filtro Específico (Opcional)
              </h2>
              {config.filters && (
                <Badge variant="outline" className="rounded-full bg-primary/5 border-primary/20 text-primary font-black uppercase text-[10px]">
                  Filtros ativos
                </Badge>
              )}
            </div>
            <div className="h-12 flex items-center justify-center border-2 border-dashed border-border/40 rounded-2xl text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
              {config.filters ? "Filtros pré-configurados aplicados automaticamente" : "Nenhum filtro adicional para este tipo de relatório"}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-display font-black text-lg">Visualização do Relatório: {reportButtons.find(b => b.id === selectedType)?.label}</h2>
          {showResults && (
            <Badge className="bg-success text-white border-none font-black uppercase text-[10px]">
              {filteredData.length} Registros encontrados
            </Badge>
          )}
        </div>
        
        {!showResults ? (
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
        ) : (
          <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 text-center space-y-4">
                  <RefreshCw className="size-8 text-primary animate-spin mx-auto" />
                  <p className="font-bold text-muted-foreground">Carregando dados...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <X className="size-8 text-destructive/30 mx-auto" />
                  <p className="font-bold text-muted-foreground">Nenhum dado encontrado para este período</p>
                  <Button variant="outline" size="sm" onClick={() => setShowResults(false)} className="rounded-xl">Limpar</Button>
                </div>
              ) : (
                <div className="divide-y divide-border/10 max-h-[500px] overflow-y-auto scrollbar-hide">
                  {filteredData.map((row, idx) => (
                    <div key={idx}>
                      {renderDataRow(row)}
                    </div>
                  ))}
                </div>
              )}
              {filteredData.length > 0 && (
                <div className="bg-muted/10 p-4 text-center border-t border-border/20">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Fim do relatório</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

