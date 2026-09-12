import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  ShoppingCart, 
  Search,
  Calendar,
  ChevronRight,
  Printer,
  FileDown,
  Landmark,
  FileText,
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
  RefreshCw,
  ExternalLink,
  Phone
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, dateBR, dateTimeBR, num, toISODate } from "@/lib/format";
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
      { name: "description", content: "Relatórios completos e profissionais para gestão da sua fábrica e loja." },
      { property: "og:title", content: "Central de Relatórios — Amstore Gestão" },
      { property: "og:description", content: "Relatórios completos e profissionais para gestão da sua fábrica e loja." },
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
    table: "products", 
    url: "/stock", 
    dateColumn: "created_at",
    noFilter: true
  },
  financial: { 
    table: "financial_accounts", 
    url: "/accounts", 
    dateColumn: "created_at",
    noFilter: true
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
    address?: string;
  }>({});

  const fetchSettings = useServerFn(getAppSettings);

  useEffect(() => {
    fetchSettings().then((data: any) => {
      const info: any = {};
      data?.forEach((s: any) => {
        if (s.key === "store_name") info.name = s.value;
        if (s.key === "store_cnpj") info.cnpj = s.value;
        if (s.key === "store_contact") info.contact = s.value;
        if (s.key === "store_logo") info.logo = s.value;
        if (s.key === "store_address") info.address = s.value;
      });
      setStoreInfo(info);
    }).catch(() => {});
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
    { id: "general", label: "Geral / DRE", icon: LayoutDashboard },
  ];

  const config = REPORT_CONFIG[selectedType];
  
  // Consultas principais com limites expandidos para relatórios corporativos completos
  const { data: reportData = [], isLoading: isMainLoading } = useRows(config.table, {
    filters: config.filters,
    order: { column: config.dateColumn, ascending: false },
    limit: 5000
  });

  const { data: allClients = [] } = useRows<any>("clients", { limit: 3000 });
  const { data: allSales = [] } = useRows<any>("sales", { limit: 5000 });
  const { data: allSaleItems = [] } = useRows<any>("sale_items", { limit: 10000 });
  const { data: allProducts = [] } = useRows<any>("products", { limit: 3000 });
  const { data: allSuppliers = [] } = useRows<any>("suppliers", { limit: 2000 });
  const { data: allAccounts = [] } = useRows<any>("financial_accounts", { limit: 200 });

  const clientMap = useMemo(() => new Map(allClients.map((c: any) => [c.id, c])), [allClients]);
  const saleMap = useMemo(() => new Map(allSales.map((s: any) => [s.id, s])), [allSales]);
  const productMap = useMemo(() => new Map(allProducts.map((p: any) => [p.id, p])), [allProducts]);
  const supplierMap = useMemo(() => new Map(allSuppliers.map((sup: any) => [sup.id, sup])), [allSuppliers]);
  const accountMap = useMemo(() => new Map(allAccounts.map((a: any) => [a.id, a])), [allAccounts]);

  // Contagem de itens por venda
  const saleItemsCountMap = useMemo(() => {
    const map = new Map<string, number>();
    allSaleItems.forEach((it: any) => {
      if (it.sale_id) {
        map.set(it.sale_id, (map.get(it.sale_id) ?? 0) + Number(it.quantity ?? 1));
      }
    });
    return map;
  }, [allSaleItems]);

  const filteredData = useMemo(() => {
    if (config.noFilter) return reportData;
    if (!dateRange.start || !dateRange.end) return reportData;

    return reportData.filter((row: any) => {
      const raw = row[config.dateColumn] || row.created_at || row.due_date;
      if (!raw) return true;
      const iso = toISODate(raw);
      if (dateRange.start && iso < dateRange.start) return false;
      if (dateRange.end && iso > dateRange.end) return false;
      return true;
    });
  }, [reportData, dateRange, config]);

  const reportResult = useMemo(() => {
    const columns: { key: string; label: string; align?: "right" | "left" | "center"; className?: string }[] = [];
    const summaryCards: { label: string; value: string | number; helper?: string }[] = [];
    const todayIso = toISODate(new Date());

    switch (selectedType) {
      case "sales": {
        columns.push(
          { key: "code", label: "Código" },
          { key: "date", label: "Data" },
          { key: "client", label: "Cliente" },
          { key: "type", label: "Tipo" },
          { key: "method", label: "Pagamento" },
          { key: "items_count", label: "Itens", align: "right" },
          { key: "discount", label: "Desconto", align: "right" },
          { key: "total", label: "Total Líquido", align: "right" }
        );

        let grossRevenue = 0;
        let totalDiscount = 0;
        let validSalesCount = 0;

        filteredData.forEach((s: any) => {
          const isCancelled = ["cancelled", "cancelada", "estornado"].includes(String(s.status || "").toLowerCase());
          if (!isCancelled) {
            grossRevenue += Number(s.total_amount ?? 0);
            totalDiscount += Number(s.discount_amount ?? s.discount ?? 0);
            validSalesCount++;
          }
        });

        summaryCards.push(
          { label: "Faturamento Líquido", value: brl(grossRevenue), helper: `${validSalesCount} vendas concluídas` },
          { label: "Total de Descontos", value: brl(totalDiscount), helper: "Concedidos no período" },
          { label: "Vendas Registradas", value: num(filteredData.length, 0), helper: "Total de pedidos" },
          { label: "Ticket Médio", value: brl(validSalesCount > 0 ? grossRevenue / validSalesCount : 0), helper: "Média por pedido" }
        );
        break;
      }

      case "installments": {
        columns.push(
          { key: "code", label: "Venda" },
          { key: "client", label: "Cliente" },
          { key: "phone", label: "Telefone" },
          { key: "installment", label: "Parcela" },
          { key: "due", label: "Vencimento" },
          { key: "overdue_days", label: "Dias / Atraso" },
          { key: "amount", label: "Valor Parcela", align: "right" },
          { key: "remaining", label: "Em Aberto", align: "right" }
        );

        let totalParcelado = 0;
        let totalEmAberto = 0;
        let totalAtrasado = 0;
        let countAtrasadas = 0;

        filteredData.forEach((row: any) => {
          const amt = Number(row.amount ?? 0);
          const rem = Number(row.remaining_amount ?? (amt - (row.paid_amount ?? 0)));
          const isPaid = row.status === "paid" || rem <= 0.009;
          const isOverdue = !isPaid && toISODate(row.due_date) < todayIso;

          totalParcelado += amt;
          totalEmAberto += rem;
          if (isOverdue) {
            totalAtrasado += rem;
            countAtrasadas++;
          }
        });

        const pctInadimplencia = totalEmAberto > 0 ? (totalAtrasado / totalEmAberto) * 100 : 0;

        summaryCards.push(
          { label: "Total Parcelado", value: brl(totalParcelado), helper: `${filteredData.length} parcelas` },
          { label: "Total em Aberto", value: brl(totalEmAberto), helper: "Saldo a receber" },
          { label: "Total em Atraso", value: brl(totalAtrasado), helper: `${countAtrasadas} parcelas vencidas` },
          { label: "Inadimplência", value: `${pctInadimplencia.toFixed(1)}%`, helper: "Sobre o saldo aberto" }
        );
        break;
      }

      case "whatsapp": {
        columns.push(
          { key: "client", label: "Cliente" },
          { key: "phone", label: "WhatsApp" },
          { key: "installment", label: "Parcela" },
          { key: "due", label: "Vencimento" },
          { key: "overdue_days", label: "Atraso" },
          { key: "remaining", label: "Valor Pendente", align: "right" },
          { key: "action", label: "Ação Rápida", className: "print:hidden" }
        );

        let totalCobrar = 0;
        let clientesCount = new Set<string>();

        filteredData.forEach((row: any) => {
          const s = saleMap.get(row.sale_id);
          const rem = Number(row.remaining_amount ?? (row.amount - (row.paid_amount ?? 0)));
          totalCobrar += rem;
          if (s?.client_id) clientesCount.add(s.client_id);
        });

        summaryCards.push(
          { label: "Total a Cobrar", value: brl(totalCobrar), helper: "Parcelas em aberto" },
          { label: "Clientes a Contatar", value: num(clientesCount.size, 0), helper: "Com pendência" },
          { label: "Qtd de Parcelas", value: num(filteredData.length, 0), helper: "Pendentes de quitação" }
        );
        break;
      }

      case "stock": {
        columns.push(
          { key: "name", label: "Produto" },
          { key: "category", label: "Categoria" },
          { key: "qty", label: "Estoque", align: "right" },
          { key: "cost", label: "Custo Unit.", align: "right" },
          { key: "price", label: "Venda Unit.", align: "right" },
          { key: "total_cost", label: "Patrimônio Custo", align: "right" },
          { key: "total_sale", label: "Potencial Venda", align: "right" },
          { key: "min", label: "Mínimo", align: "right" }
        );

        let totalPecas = 0;
        let totalValorCusto = 0;
        let totalValorVenda = 0;
        let totalAbaixoMinimo = 0;

        filteredData.forEach((row: any) => {
          const q = Number(row.current_stock ?? row.quantidade_disponivel ?? 0);
          const cost = Number(row.cost_price ?? 0);
          const price = Number(row.sale_price ?? row.price_retail ?? 0);
          const min = Number(row.min_stock ?? 0);

          totalPecas += q;
          totalValorCusto += q * cost;
          totalValorVenda += q * price;
          if (q <= min && min > 0) totalAbaixoMinimo++;
        });

        summaryCards.push(
          { label: "Peças em Estoque", value: num(totalPecas, 0), helper: "Total físico disponível" },
          { label: "Capital Estocado (Custo)", value: brl(totalValorCusto), helper: "Custo de aquisição/fabricação" },
          { label: "Potencial de Venda", value: brl(totalValorVenda), helper: "Receita bruta projetada" },
          { label: "Abaixo do Mínimo", value: num(totalAbaixoMinimo, 0), helper: "Itens que requerem reposição" }
        );
        break;
      }

      case "financial": {
        columns.push(
          { key: "name", label: "Conta / Caixa" },
          { key: "bank", label: "Instituição / Banco" },
          { key: "type", label: "Tipo" },
          { key: "agency_account", label: "Agência / Conta" },
          { key: "initial_balance", label: "Saldo Inicial", align: "right" },
          { key: "balance", label: "Saldo Atual", align: "right" }
        );

        let saldoTotal = 0;
        let saldoCaixaFisico = 0;
        let saldoBancos = 0;

        filteredData.forEach((row: any) => {
          const bal = Number(row.current_balance ?? row.balance ?? 0);
          saldoTotal += bal;
          const tipo = String(row.type || "").toLowerCase();
          if (tipo.includes("caixa") || tipo.includes("dinheiro") || tipo.includes("físico")) {
            saldoCaixaFisico += bal;
          } else {
            saldoBancos += bal;
          }
        });

        summaryCards.push(
          { label: "Saldo Consolidado", value: brl(saldoTotal), helper: "Total em caixa e contas" },
          { label: "Caixa Físico", value: brl(saldoCaixaFisico), helper: "Dinheiro em espécie" },
          { label: "Bancos & Digitais", value: brl(saldoBancos), helper: "Contas bancárias ativas" },
          { label: "Contas Cadastradas", value: num(filteredData.length, 0), helper: "Contas financeiras" }
        );
        break;
      }

      case "production": {
        columns.push(
          { key: "code", label: "Código Ordem" },
          { key: "product", label: "Produto" },
          { key: "qty", label: "Qtd Peças", align: "right" },
          { key: "started", label: "Início" },
          { key: "due", label: "Previsão" },
          { key: "completed", label: "Conclusão" },
          { key: "materials_down", label: "Baixa Insumos" },
          { key: "quality", label: "Inspeção" }
        );

        let totalPecas = 0;
        let emAndamento = 0;
        let concluidas = 0;

        filteredData.forEach((row: any) => {
          totalPecas += Number(row.quantity ?? row.quantidade ?? 0);
          const st = String(row.status || "").toLowerCase();
          if (st === "concluida" || st === "concluído" || st === "finalizada") concluidas++;
          else emAndamento++;
        });

        summaryCards.push(
          { label: "Total de Ordens", value: num(filteredData.length, 0), helper: "Ordens no período" },
          { label: "Peças Programadas", value: num(totalPecas, 0), helper: "Volume total de produção" },
          { label: "Concluídas", value: num(concluidas, 0), helper: "Finalizadas com sucesso" },
          { label: "Em Fabricação", value: num(emAndamento, 0), helper: "Em linha de montagem" }
        );
        break;
      }

      case "clients": {
        columns.push(
          { key: "name", label: "Cliente" },
          { key: "document", label: "CPF / CNPJ" },
          { key: "phone", label: "Telefone" },
          { key: "city", label: "Cidade / UF" },
          { key: "purchases_count", label: "Compras", align: "right" },
          { key: "total_spent", label: "Total Comprado", align: "right" },
          { key: "cashback", label: "Saldo Cashback", align: "right" },
          { key: "date", label: "Cadastro" }
        );

        let totalCashback = 0;
        let totalVendidoClientes = 0;

        filteredData.forEach((c: any) => {
          totalCashback += Number(c.cashback_balance ?? 0);
          totalVendidoClientes += Number(c.total_spent ?? 0);
        });

        summaryCards.push(
          { label: "Clientes Cadastrados", value: num(filteredData.length, 0), helper: "Base total de clientes" },
          { label: "Cashback em Aberto", value: brl(totalCashback), helper: "Créditos concedidos" }
        );
        break;
      }

      case "materials": {
        columns.push(
          { key: "name", label: "Material / Insumo" },
          { key: "type", label: "Tipo / Ramo" },
          { key: "unit", label: "Unidade" },
          { key: "cost", label: "Custo Unit.", align: "right" },
          { key: "qty", label: "Estoque Atual", align: "right" },
          { key: "total_cost", label: "Valor Total", align: "right" },
          { key: "min", label: "Mínimo", align: "right" }
        );

        let totalInsumosValor = 0;
        let itensAbaixoMinimo = 0;

        filteredData.forEach((m: any) => {
          const q = Number(m.current_stock ?? 0);
          const c = Number(m.cost_price ?? m.preco_unitario ?? 0);
          const min = Number(m.min_stock ?? 0);
          totalInsumosValor += q * c;
          if (q <= min && min > 0) itensAbaixoMinimo++;
        });

        summaryCards.push(
          { label: "Insumos Cadastrados", value: num(filteredData.length, 0), helper: "Matérias-primas cadastradas" },
          { label: "Capital em Insumos", value: brl(totalInsumosValor), helper: "Estoque a preço de custo" },
          { label: "Estoque Crítico", value: num(itensAbaixoMinimo, 0), helper: "Abaixo do estoque mínimo" }
        );
        break;
      }

      case "products": {
        columns.push(
          { key: "name", label: "Produto" },
          { key: "category", label: "Categoria" },
          { key: "cost", label: "Custo Unit.", align: "right" },
          { key: "retail", label: "Preço Varejo", align: "right" },
          { key: "wholesale", label: "Preço Atacado", align: "right" },
          { key: "margin_brl", label: "Margem Bruta (R$)", align: "right" },
          { key: "margin_pct", label: "Margem (%)", align: "right" },
          { key: "stock", label: "Estoque", align: "right" }
        );

        let sumPrice = 0;
        let countActive = 0;

        filteredData.forEach((p: any) => {
          if (p.active !== false) {
            sumPrice += Number(p.sale_price ?? p.price_retail ?? 0);
            countActive++;
          }
        });

        summaryCards.push(
          { label: "Produtos Ativos", value: num(countActive, 0), helper: "Disponíveis para venda" },
          { label: "Preço Médio de Venda", value: brl(countActive > 0 ? sumPrice / countActive : 0), helper: "Média no catálogo" }
        );
        break;
      }

      case "suppliers": {
        columns.push(
          { key: "name", label: "Fornecedor" },
          { key: "document", label: "CNPJ / CPF" },
          { key: "category", label: "Ramo de Atuação" },
          { key: "contact", label: "Contato" },
          { key: "phone", label: "Telefone / WhatsApp" },
          { key: "email", label: "E-mail" },
          { key: "location", label: "Cidade / UF" }
        );

        summaryCards.push(
          { label: "Fornecedores Cadastrados", value: num(filteredData.length, 0), helper: "Parceiros comerciais" }
        );
        break;
      }

      case "purchases": {
        columns.push(
          { key: "id", label: "Pedido / Cód." },
          { key: "date", label: "Data Compra" },
          { key: "supplier", label: "Fornecedor" },
          { key: "qty", label: "Qtd Itens", align: "right" },
          { key: "unit_cost", label: "Custo Médio", align: "right" },
          { key: "total", label: "Total Pedido", align: "right" },
          { key: "received_at", label: "Recebido em" }
        );

        let totalCompras = 0;
        let comprasRecebidas = 0;

        filteredData.forEach((pc: any) => {
          totalCompras += Number(pc.total_amount ?? 0);
          const st = String(pc.status || "").toLowerCase();
          if (st === "recebido" || st === "concluido" || pc.received_at) comprasRecebidas++;
        });

        summaryCards.push(
          { label: "Total em Compras", value: brl(totalCompras), helper: "Período selecionado" },
          { label: "Pedidos Realizados", value: num(filteredData.length, 0), helper: "Ordens de compra" },
          { label: "Pedidos Recebidos", value: num(comprasRecebidas, 0), helper: "Entregues e estocados" }
        );
        break;
      }

      case "general": {
        columns.push(
          { key: "date", label: "Data" },
          { key: "desc", label: "Descrição" },
          { key: "category", label: "Categoria" },
          { key: "type", label: "Tipo" },
          { key: "account", label: "Conta Origem/Destino" },
          { key: "method", label: "Forma Pagamento" },
          { key: "amount", label: "Valor", align: "right" }
        );

        let totalReceitas = 0;
        let totalDespesas = 0;

        filteredData.forEach((t: any) => {
          const isIncome = t.type === "income" || t.type === "entrada";
          const isExpense = t.type === "expense" || t.type === "saida";
          const val = Math.abs(Number(t.amount || 0));
          if (isIncome) totalReceitas += val;
          else if (isExpense) totalDespesas += val;
        });

        const resultadoLiquido = totalReceitas - totalDespesas;

        summaryCards.push(
          { label: "Receitas (+)", value: brl(totalReceitas), helper: "Entradas financeiras" },
          { label: "Despesas (-)", value: brl(totalDespesas), helper: "Saídas e custos" },
          { label: "Resultado Líquido", value: brl(resultadoLiquido), helper: resultadoLiquido >= 0 ? "Superávit do período" : "Déficit do período" }
        );
        break;
      }
    }

    const rows = filteredData.map((row: any) => {
      const data: any = {};

      switch (selectedType) {
        case "sales": {
          const c = clientMap.get(row.client_id);
          const isCancelled = ["cancelled", "cancelada", "estornado"].includes(String(row.status || "").toLowerCase());
          const disc = Number(row.discount_amount ?? row.discount ?? 0);
          data.code = row.sale_code || row.id?.slice(0, 8) || "—";
          data.date = dateTimeBR(row.created_at);
          data.client = row.clients?.name || c?.name || "Consumidor Final";
          data.type = row.is_debt ? "Fiado / Parcela" : "Venda Direta";
          data.method = (row.payment_method || "—").toUpperCase();
          data.items_count = num(saleItemsCountMap.get(row.id) ?? 1, 0);
          data.discount = disc > 0 ? brl(disc) : "—";
          data.total = brl(row.total_amount);
          data.status = isCancelled ? "CANCELADA" : "CONCLUÍDA";
          break;
        }

        case "installments": {
          const s = saleMap.get(row.sale_id);
          const c = s ? clientMap.get(s.client_id) : null;
          const amt = Number(row.amount ?? 0);
          const rem = Number(row.remaining_amount ?? (amt - (row.paid_amount ?? 0)));
          const isPaid = row.status === "paid" || rem <= 0.009;
          const dueIso = toISODate(row.due_date);
          const isOverdue = !isPaid && dueIso < todayIso;

          let diffDays = 0;
          if (dueIso) {
            const diffTime = new Date(todayIso).getTime() - new Date(dueIso).getTime();
            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }

          data.code = s?.sale_code || row.sale_id?.slice(0, 8) || "—";
          data.client = c?.name || "Consumidor";
          data.phone = c?.phone || "—";
          data.installment = `${row.installment_number || 1}/${s?.installments_count || "—"}`;
          data.due = dateBR(row.due_date);
          data.overdue_days = isPaid 
            ? "Quitada" 
            : isOverdue 
            ? `+${diffDays} dias atraso` 
            : "No prazo";
          data.amount = brl(amt);
          data.remaining = brl(rem);
          data.status = isPaid ? "PAGO" : (isOverdue ? "ATRASADO" : "EM DIA");
          break;
        }

        case "whatsapp": {
          const s = saleMap.get(row.sale_id);
          const c = s ? clientMap.get(s.client_id) : null;
          const amt = Number(row.amount ?? 0);
          const rem = Number(row.remaining_amount ?? (amt - (row.paid_amount ?? 0)));
          const dueIso = toISODate(row.due_date);
          const isOverdue = dueIso < todayIso;

          let diffDays = 0;
          if (dueIso) {
            const diffTime = new Date(todayIso).getTime() - new Date(dueIso).getTime();
            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }

          const rawPhone = (c?.phone || "").replace(/\D/g, "");
          const phoneFormatted = rawPhone.length >= 10 ? (rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`) : "";
          const msg = encodeURIComponent(
            `Olá, ${c?.name || "Cliente"}! Tudo bem? Passando para lembrar da parcela ${row.installment_number || 1}/${s?.installments_count || 1} com vencimento em ${dateBR(row.due_date)} no valor de ${brl(rem)}. Caso já tenha efetuado o pagamento, por favor desconsidere.`
          );

          data.client = c?.name || "Consumidor";
          data.phone = c?.phone || "—";
          data.installment = `${row.installment_number || 1}/${s?.installments_count || "—"}`;
          data.due = dateBR(row.due_date);
          data.overdue_days = isOverdue ? `${diffDays} dias` : "Hoje / A vencer";
          data.remaining = brl(rem);
          data.status = isOverdue ? "ATRASADO" : "A VENCER";
          data.action = phoneFormatted ? (
            <a
              href={`https://wa.me/${phoneFormatted}?text=${msg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              <MessageCircle className="size-3.5" /> Cobrar
            </a>
          ) : (
            <span className="text-xs text-muted-foreground italic">Sem telefone</span>
          );
          break;
        }

        case "stock": {
          const q = Number(row.current_stock ?? row.quantidade_disponivel ?? 0);
          const cost = Number(row.cost_price ?? 0);
          const price = Number(row.sale_price ?? row.price_retail ?? 0);
          const min = Number(row.min_stock ?? 0);
          const isCritical = q <= min && min > 0;
          const isZero = q <= 0;

          data.sku = row.sku || "—";
          data.name = row.name || row.produto_nome || "—";
          data.category = row.category || row.categoria || "Geral";
          data.qty = num(q, 0);
          data.cost = brl(cost);
          data.price = brl(price);
          data.total_cost = brl(q * cost);
          data.total_sale = brl(q * price);
          data.min = num(min, 0);
          data.status = isZero ? "ESGOTADO" : isCritical ? "ESTOQUE CRÍTICO" : "NORMAL";
          break;
        }

        case "financial": {
          const bal = Number(row.current_balance ?? row.balance ?? 0);
          const init = Number(row.initial_balance ?? 0);
          data.name = row.name || "—";
          data.bank = row.bank_name || "Caixa Interno";
          data.type = row.type || "Conta Corrente";
          data.agency_account = row.agency || row.account_number ? `${row.agency || ""} / ${row.account_number || ""}` : "—";
          data.initial_balance = brl(init);
          data.balance = brl(bal);
          data.status = row.active !== false ? "ATIVA" : "INATIVA";
          break;
        }

        case "production": {
          const p = productMap.get(row.product_id);
          data.code = row.codigo_ordem || row.id?.slice(0, 8) || "—";
          data.product = row.produto_nome || p?.name || "—";
          data.qty = num(row.quantity ?? row.quantidade ?? 0, 0);
          data.started = dateBR(row.started_at || row.created_at);
          data.due = dateBR(row.data_prevista);
          data.completed = dateBR(row.completed_at);
          data.materials_down = row.materiais_baixados ? "SIM" : "NÃO";
          data.quality = row.qualidade_inspecionada ? "APROVADO" : "PENDENTE";
          data.status = (row.status || "PENDENTE").toUpperCase();
          break;
        }

        case "clients": {
          data.name = row.name || "—";
          data.document = row.document || "—";
          data.phone = row.phone || "—";
          data.city = row.city && row.state ? `${row.city}/${row.state}` : row.city || "—";
          data.purchases_count = num(row.purchases_count ?? 0, 0);
          data.total_spent = brl(row.total_spent ?? 0);
          data.cashback = brl(row.cashback_balance ?? 0);
          data.date = dateBR(row.created_at);
          break;
        }

        case "materials": {
          const q = Number(row.current_stock ?? 0);
          const c = Number(row.cost_price ?? row.preco_unitario ?? 0);
          const min = Number(row.min_stock ?? 0);
          data.sku = row.sku || row.id?.slice(0, 6) || "—";
          data.name = row.name || "—";
          data.type = row.type || row.category || "Insumo";
          data.unit = (row.unit || "UN").toUpperCase();
          data.cost = brl(c);
          data.qty = num(q, 2);
          data.total_cost = brl(q * c);
          data.min = num(min, 2);
          data.status = q <= min && min > 0 ? "REPOR ESTOQUE" : "OK";
          break;
        }

        case "products": {
          const cost = Number(row.cost_price ?? 0);
          const retail = Number(row.sale_price ?? row.price_retail ?? 0);
          const wholesale = Number(row.wholesale_price ?? row.price_wholesale ?? 0);
          const marginBrl = retail - cost;
          const marginPct = retail > 0 ? ((retail - cost) / retail) * 100 : 0;
          data.sku = row.sku || "—";
          data.name = row.name || "—";
          data.category = row.category || "—";
          data.cost = brl(cost);
          data.retail = brl(retail);
          data.wholesale = brl(wholesale);
          data.margin_brl = brl(marginBrl);
          data.margin_pct = `${marginPct.toFixed(1)}%`;
          data.stock = num(row.current_stock ?? 0, 0);
          data.status = row.active !== false ? "ATIVO" : "INATIVO";
          break;
        }

        case "suppliers": {
          data.name = row.name || "—";
          data.document = row.document || "—";
          data.category = row.category || row.type || "Geral";
          data.contact = row.contact || "—";
          data.phone = row.phone || row.phone_secondary || "—";
          data.email = row.email || "—";
          data.location = row.city && row.state ? `${row.city}/${row.state}` : row.city || "—";
          data.status = row.active !== false ? "ATIVO" : "INATIVO";
          break;
        }

        case "purchases": {
          const sup = supplierMap.get(row.supplier_id);
          data.id = row.id?.slice(0, 8);
          data.date = dateBR(row.created_at);
          data.supplier = row.supplier_name || sup?.name || row.supplier || "—";
          data.qty = num(row.quantity ?? 1, 0);
          data.unit_cost = brl(row.unit_cost ?? 0);
          data.total = brl(row.total_amount ?? 0);
          data.received_at = dateBR(row.received_at);
          data.status = (row.status || (row.received_at ? "RECEBIDO" : "PENDENTE")).toUpperCase();
          break;
        }

        case "general": {
          const isIncome = row.type === "income" || row.type === "entrada";
          const acc = accountMap.get(row.account_id);
          data.date = dateBR(row.created_at || row.due_date);
          data.desc = row.description || "—";
          data.category = row.category || "Operacional";
          data.type = isIncome ? "ENTRADA (+)" : "SAÍDA (-)";
          data.account = acc?.name || "Caixa Geral";
          data.method = (row.payment_method || "—").toUpperCase();
          data.amount = brl(Math.abs(Number(row.amount || 0)));
          break;
        }

        default:
          data.id = row.id?.slice(0, 8);
          data.date = dateBR(row.created_at || row.due_date);
          data.description = row.description || row.name || "—";
          data.amount = brl(Math.abs(Number(row.amount || row.total_amount || 0)));
      }
      return data;
    });

    return { columns, rows, summaryCards };
  }, [filteredData, selectedType, clientMap, saleMap, productMap, supplierMap, accountMap, saleItemsCountMap]);

  const handleGenerateReport = () => {
    setShowResults(true);
    toast.success(`Relatório de ${reportButtons.find(b => b.id === selectedType)?.label} carregado.`);
  };

  const handleExportCsv = () => {
    const { columns, rows } = reportResult;
    // Filtrar colunas de ação que não pertencem ao CSV (ex.: botões interativos)
    const exportCols = columns.filter(c => c.key !== "action" && c.className !== "print:hidden");
    const header = exportCols.map(c => `"${c.label}"`).join(";");

    const getCleanString = (val: any) => {
      if (val === null || val === undefined) return "";
      if (typeof val === "string" || typeof val === "number") return String(val);
      return "";
    };

    const body = rows.map(r => exportCols.map(c => `"${getCleanString(r[c.key])}"`).join(";")).join("\n");
    const csv = `\uFEFF${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${selectedType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Relatório exportado em CSV.");
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
                <h1 className="text-2xl font-display font-black tracking-tight">Central de Relatórios Corporativos</h1>
                <p className="text-muted-foreground text-sm">Gere relatórios gerenciais, operacionais e financeiros completos com padrão executivo.</p>
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
                  <span className="text-[11px] font-bold uppercase leading-tight">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span className="text-primary">2.</span> {config.noFilter ? "Relatório Cadastral Completo (sem restrição de data)" : "Filtro por Período"}
            </h2>
            <div className="flex flex-col md:flex-row gap-4">
              {config.noFilter ? (
                <div className="flex-1 h-14 flex items-center justify-center border-2 border-dashed border-border/40 rounded-2xl text-muted-foreground text-[11px] uppercase font-bold tracking-widest bg-muted/10">
                  Este relatório exibe todos os registros cadastrais ativos na base de dados
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Data Inicial</label>
                    <Input 
                      type="date" 
                      value={dateRange.start}
                      onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                      className="h-12 rounded-xl bg-muted/20 border-border/40 font-bold px-4"
                    />
                  </div>
                  <div className="relative">
                    <label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">Data Final</label>
                    <Input 
                      type="date" 
                      value={dateRange.end}
                      onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                      className="h-12 rounded-xl bg-muted/20 border-border/40 font-bold px-4"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-end">
                <Button 
                  onClick={handleGenerateReport}
                  disabled={isMainLoading}
                  className="h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black px-10 gap-3 shadow-lg shadow-primary/20 md:w-auto w-full"
                >
                  {isMainLoading ? <RefreshCw className="size-5 animate-spin" /> : <FileBarChart className="size-5" />}
                  GERAR RELATÓRIO
                </Button>
              </div>
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
                  <FileDown className="size-4" /> EXPORTAR CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="rounded-xl border-border/40 hover:bg-muted/50 gap-2 font-bold"
                >
                  <Printer className="size-4" /> IMPRIMIR A4
                </Button>
              </>
            )}
            {showResults && (
              <Badge className="bg-primary text-primary-foreground border-none font-black uppercase text-[10px]">
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
                <p className="font-bold text-muted-foreground">Selecione o tipo de relatório e clique em Gerar</p>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/40">Os dados e indicadores gerenciais serão exibidos nesta área</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {isMainLoading ? (
              <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden shadow-sm print:hidden">
                <CardContent className="p-12 text-center space-y-4">
                  <RefreshCw className="size-8 text-primary animate-spin mx-auto" />
                  <p className="font-bold text-muted-foreground">Carregando dados do relatório...</p>
                </CardContent>
              </Card>
            ) : filteredData.length === 0 ? (
              <Card className="rounded-[2rem] border-border/40 bg-card overflow-hidden shadow-sm print:hidden">
                <CardContent className="p-12 text-center space-y-4">
                  <X className="size-8 text-destructive/30 mx-auto" />
                  <p className="font-bold text-muted-foreground">Nenhum dado encontrado para os critérios selecionados</p>
                  <Button variant="outline" size="sm" onClick={() => setShowResults(false)} className="rounded-xl">Limpar</Button>
                </CardContent>
              </Card>
            ) : (
              <ReportLayout 
                id="printable-report"
                title={`Relatório de ${reportButtons.find(b => b.id === selectedType)?.label || "Geral"}`}
                startDate={config.noFilter ? undefined : dateRange.start}
                endDate={config.noFilter ? undefined : dateRange.end}
                storeInfo={storeInfo}
                columns={reportResult.columns}
                rows={reportResult.rows}
                summaryCards={reportResult.summaryCards}
                summaryPosition="top"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
