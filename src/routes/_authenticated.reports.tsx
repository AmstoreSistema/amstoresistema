import { useState, useMemo, useEffect } from "react";
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
  X,
  RefreshCw
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, dateBR, dateTimeBR, num } from "@/lib/format";
import { useRows } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReportLayout } from "@/components/report-layout";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/settings.functions";

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

interface ReportConfig {
  table: string;
  url: string;
  dateColumn: string;
  filters?: { column: string; value: any }[];
  noFilter?: boolean;
}

const REPORT_CONFIG: Record<ReportType, ReportConfig> = {
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
    dateColumn: "created_at",
    noFilter: true
  },
  financial: { 
    table: "financial_accounts", 
    url: "/accounts", 
    dateColumn: "created_at" 
  },
  production: { 
    table: "production_orders", 
    url: "/production", 
    dateColumn: "created_at",
    noFilter: true
  },
  clients: { 
    table: "clients", 
    url: "/clients", 
    dateColumn: "created_at",
    noFilter: true
  },
  materials: { 
    table: "materials", 
    url: "/materials", 
    dateColumn: "created_at",
    noFilter: true
  },
  products: { 
    table: "products", 
    url: "/products", 
    dateColumn: "created_at",
    noFilter: true
  },
  suppliers: { 
    table: "suppliers", 
    url: "/purchase-board", 
    dateColumn: "created_at",
    noFilter: true
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
  const [storeInfo, setStoreInfo] = useState<{
    name?: string;
    cnpj?: string;
    contact?: string;
    logo?: string;
  }>({});

  const fetchSettings = useServerFn(getAppSettings);

  useEffect(() => {
    fetchSettings().then((data: any) => {
      const info: any = {};
      data.forEach((s: any) => {
        if (s.key === "store_name") info.name = s.value;
        if (s.key === "store_cnpj") info.cnpj = s.value;
        if (s.key === "store_contact") info.contact = s.value;
        if (s.key === "store_logo") info.logo = s.value;
      });
      setStoreInfo(info);
    });
  }, [fetchSettings]);

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
    if (config.noFilter) return reportData;
    if (!dateRange.start || !dateRange.end) return reportData;
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T23:59:59');

    return reportData.filter((row: any) => {
      const rowDate = new Date(row[config.dateColumn] || row.created_at);
      return rowDate >= start && rowDate <= end;
    });
  }, [reportData, dateRange, config]);

  const reportResult = useMemo(() => {
    const columns: { key: string; label: string; align?: "right" }[] = [];
    
    switch (selectedType) {
      case "sales":
        columns.push(
          { key: "id", label: "ID" },
          { key: "date", label: "Data" },
          { key: "method", label: "Pagamento" },
          { key: "total", label: "Total", align: "right" }
        );
        break;
      case "stock":
        columns.push(
          { key: "name", label: "Produto" },
          { key: "qty", label: "Qtd", align: "right" },
          { key: "category", label: "Categoria" }
        );
        break;
      case "production":
        columns.push(
          { key: "code", label: "Código" },
          { key: "product", label: "Produto" },
          { key: "qty", label: "Qtd", align: "right" },
          { key: "status", label: "Status" }
        );
        break;
      case "clients":
        columns.push(
          { key: "name", label: "Cliente" },
          { key: "email", label: "E-mail" },
          { key: "date", label: "Cadastro" }
        );
        break;
      case "materials":
        columns.push(
          { key: "name", label: "Material" },
          { key: "unit", label: "Unidade" },
          { key: "price", label: "Preço", align: "right" }
        );
        break;
      case "products":
        columns.push(
          { key: "sku", label: "SKU" },
          { key: "name", label: "Produto" },
          { key: "price", label: "Preço", align: "right" }
        );
        break;
      case "suppliers":
        columns.push(
          { key: "name", label: "Fornecedor" },
          { key: "contact", label: "Contato" },
          { key: "category", label: "Ramo" }
        );
        break;
      case "purchases":
        columns.push(
          { key: "id", label: "ID" },
          { key: "date", label: "Data" },
          { key: "supplier", label: "Fornecedor" },
          { key: "total", label: "Total", align: "right" }
        );
        break;
      case "financial":
        columns.push(
          { key: "name", label: "Conta" },
          { key: "type", label: "Tipo" },
          { key: "balance", label: "Saldo", align: "right" }
        );
        break;
      case "general":
        columns.push(
          { key: "date", label: "Data" },
          { key: "desc", label: "Descrição" },
          { key: "type", label: "Tipo" },
          { key: "amount", label: "Valor", align: "right" }
        );
        break;
      default:
        columns.push(
          { key: "id", label: "ID" },
          { key: "date", label: "Data" },
          { key: "description", label: "Descrição" },
          { key: "amount", label: "Valor", align: "right" }
        );
    }

    const rows = filteredData.map((row: any) => {
      const data: any = {};
      switch (selectedType) {
        case "sales":
          data.id = row.id?.slice(0, 8);
          data.date = dateBR(row.created_at);
          data.method = row.payment_method || "—";
          data.total = brl(row.total_amount);
          break;
        case "stock":
          data.name = row.produto_nome || "—";
          data.qty = row.quantidade_disponivel || 0;
          data.category = row.categoria || "—";
          break;
        case "production":
          data.code = row.codigo_ordem || "—";
          data.product = row.produto_nome || "—";
          data.qty = row.quantity || 0;
          data.status = row.status?.toUpperCase() || "PENDENTE";
          break;
        case "clients":
          data.name = row.name || "—";
          data.email = row.email || "—";
          data.date = dateBR(row.created_at);
          break;
        case "materials":
          data.name = row.name || "—";
          data.unit = row.unit || "—";
          data.price = brl(row.preco_unitario);
          break;
        case "products":
          data.sku = row.sku || "—";
          data.name = row.name || "—";
          data.price = brl(row.price_retail);
          break;
        case "suppliers":
          data.name = row.name || "—";
          data.contact = row.contact_name || "—";
          data.category = row.category || "—";
          break;
        case "purchases":
          data.id = row.id?.slice(0, 8);
          data.date = dateBR(row.created_at);
          data.supplier = row.supplier_name || row.supplier_id || "—";
          data.total = brl(row.total_amount);
          break;
        case "financial":
          data.name = row.name || "—";
          data.type = row.type || "—";
          data.balance = brl(row.balance);
          break;
        case "general":
          data.date = dateBR(row.created_at);
          data.desc = row.description || "—";
          data.type = row.type === 'income' ? 'ENTRADA' : 'SAÍDA';
          data.amount = brl(row.amount);
          break;
        default:
          data.id = row.id?.slice(0, 8);
          data.date = dateBR(row.created_at || row.due_date);
          data.description = row.description || row.name || "—";
          data.amount = brl(row.amount || row.total_amount);
      }
      return data;
    });

    return { columns, rows };
  }, [filteredData, selectedType]);

  const handleGenerateReport = () => {
    setShowResults(true);
    toast.success(`Relatório de ${reportButtons.find(b => b.id === selectedType)?.label} carregado.`);
  };

  const handleExportCsv = () => {
    const { columns, rows } = reportResult;
    const header = columns.map(c => `"${c.label}"`).join(";");
    const body = rows.map(r => columns.map(c => `"${String(r[c.key] ?? "")}"`).join(";")).join("\n");
    const csv = `\uFEFF${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${selectedType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 print:hidden">
          <h2 className="font-display font-black text-lg">Visualização do Relatório: {reportButtons.find(b => b.id === selectedType)?.label}</h2>
          <div className="flex items-center gap-2">
            {showResults && filteredData.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  className="rounded-xl border-border/40 hover:bg-muted/50 gap-2 font-bold"
                >
                  <FileDown className="size-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="rounded-xl border-border/40 hover:bg-muted/50 gap-2 font-bold"
                >
                  <Printer className="size-4" /> IMPRIMIR
                </Button>
              </>
            )}
            {showResults && (
              <Badge className="bg-success text-white border-none font-black uppercase text-[10px]">
                {filteredData.length} Registros encontrados
              </Badge>
            )}
          </div>
        </div>
        
        {!showResults ? (
          <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden print:hidden">
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
          <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500 print:shadow-none print:border-none print:rounded-none">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 text-center space-y-4 print:hidden">
                  <RefreshCw className="size-8 text-primary animate-spin mx-auto" />
                  <p className="font-bold text-muted-foreground">Carregando dados...</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="p-12 text-center space-y-4 print:hidden">
                  <X className="size-8 text-destructive/30 mx-auto" />
                  <p className="font-bold text-muted-foreground">Nenhum dado encontrado para este período</p>
                  <Button variant="outline" size="sm" onClick={() => setShowResults(false)} className="rounded-xl">Limpar</Button>
                </div>
              ) : (
                <ReportLayout 
                  id="printable-report"
                  title={reportButtons.find(b => b.id === selectedType)?.label || "Relatório"}
                  startDate={dateRange.start}
                  endDate={dateRange.end}
                  storeInfo={storeInfo}
                  columns={reportResult.columns}
                  rows={reportResult.rows}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

