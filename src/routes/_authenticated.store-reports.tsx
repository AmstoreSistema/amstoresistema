import React, { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  TrendingUp,
  Package,
  Users,
  DollarSign,
  FileText,
  Footprints,
  Boxes,
  User,
  Tag,
  Clock,
  XCircle,
  ShoppingBag,
  FileBarChart,
  FileDown,
  Printer,
  MessageCircle,
  ArrowLeftRight,
} from "lucide-react";
import {
  extractTransactionDetails,
  buildTransactionReportData,
  exportTransactionsToCSV,
  isValidClientName,
  extractClientFromDescription,
  resolveSaleClientInfo,
  buildTxBySaleCodeMap,
  buildClientByNameMap,
} from "@/lib/transaction-report.helpers";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, dateBR, dateTimeBR, num, toISODate } from "@/lib/format";
import { useRows } from "@/lib/data";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReportLayout } from "@/components/report-layout";
import { AvailableSizesReport } from "@/components/reports/AvailableSizesReport";
import { getAppSettings } from "@/lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { printReport } from "@/lib/print-report";

export const Route = createFileRoute("/_authenticated/store-reports")({
  head: () => ({
    meta: [
      { title: "Relatórios da Loja — Amstore Gestão" },
      {
        name: "description",
        content: "Relatórios detalhados e analíticos de vendas, clientes, caixa e estoque da loja.",
      },
      { property: "og:title", content: "Relatórios da Loja — Amstore Gestão" },
      {
        property: "og:description",
        content: "Relatórios detalhados e analíticos de vendas, clientes, caixa e estoque da loja.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreReportsPage,
});

type ReportId =
  | "period"
  | "top-products"
  | "clients"
  | "cashflow"
  | "transactions"
  | "sales-general"
  | "pending"
  | "sandal-sizes"
  | "sizes-available"
  | "sales-full"
  | "by-seller"
  | "by-category"
  | "by-hour"
  | "cancelled"
  | "sales-by-product"
  | "stock-general"
  | "production-general"
  | "materials-general"
  | "suppliers-general"
  | "products-general";

const REPORTS: { id: ReportId; label: string; icon: any; grouping?: boolean; noFilter?: boolean }[] = [
  { id: "period", label: "Vendas por Período", icon: TrendingUp, grouping: true },
  { id: "top-products", label: "Produtos Mais Vendidos", icon: Package },
  { id: "clients", label: "Desempenho Clientes", icon: Users },
  { id: "cashflow", label: "Fluxo de Caixa", icon: DollarSign, grouping: true },
  { id: "transactions", label: "Relatório de Transações", icon: ArrowLeftRight },
  { id: "sales-general", label: "Vendas Geral", icon: FileText },
  { id: "pending", label: "Fiados/Pendentes", icon: FileText },
  { id: "sandal-sizes", label: "Numerações Sandálias", icon: Footprints },
  { id: "sizes-available", label: "Numerações Disponíveis", icon: Boxes, noFilter: true },
  { id: "sales-full", label: "Vendas Completo (Itens)", icon: Users },
  { id: "by-seller", label: "Por Vendedor", icon: User },
  { id: "by-category", label: "Por Categoria", icon: Tag },
  { id: "by-hour", label: "Por Horário", icon: Clock },
  { id: "cancelled", label: "Canceladas Detalhado", icon: XCircle },
  { id: "sales-by-product", label: "Vendas por Produto", icon: ShoppingBag },
  { id: "stock-general", label: "Relatório de Estoque", icon: Boxes, noFilter: true },
  { id: "production-general", label: "Relatório de Produção", icon: Footprints, noFilter: true },
  { id: "materials-general", label: "Relatório de Materiais", icon: Package, noFilter: true },
  { id: "suppliers-general", label: "Relatório de Fornecedores", icon: Users, noFilter: true },
  { id: "products-general", label: "Relatório de Produtos", icon: ShoppingBag, noFilter: true },
];

const QUICK_PERIODS = [
  {
    label: "Hoje",
    fn: () => {
      const today = new Date().toISOString().slice(0, 10);
      return { start: today, end: today };
    },
  },
  {
    label: "7 dias",
    fn: () => {
      const end = new Date().toISOString().slice(0, 10);
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { start: d.toISOString().slice(0, 10), end };
    },
  },
  {
    label: "Este Mês",
    fn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      return { start, end };
    },
  },
  {
    label: "Mês Anterior",
    fn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { start, end };
    },
  },
  {
    label: "Este Ano",
    fn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      return { start, end };
    },
  },
];

type Column = { key: string; label: string; align?: "right" | "left" | "center"; className?: string };
type SummaryCard = { label: string; value: string | number; helper?: string };
type Result = { columns: Column[]; rows: Record<string, any>[]; summaryCards: SummaryCard[] };

function periodKey(iso: string, grouping: string) {
  if (grouping === "daily") return dateBR(iso);
  const formatted = dateBR(iso);
  if (formatted === "—") return "—";
  const parts = formatted.split("/").map(Number);
  const day = parts[0];
  const month = parts[1];
  const year = parts[2];
  if (day === undefined || month === undefined || year === undefined || isNaN(day) || isNaN(month) || isNaN(year)) {
    return formatted;
  }
  if (grouping === "yearly") return String(year);
  if (grouping === "weekly") {
    const d = new Date(year, month - 1, day);
    const first = new Date(d);
    first.setDate(d.getDate() - d.getDay());
    return `Semana de ${dateBR(first)}`;
  }
  return `${String(month).padStart(2, "0")}/${year}`;
}

function StoreReportsPage() {
  const [selected, setSelected] = useState<ReportId>("period");
  const [grouping, setGrouping] = useState("monthly");
  const [txTypeFilter, setTxTypeFilter] = useState<"todos" | "receita" | "despesa">("todos");
  const [range, setRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  const [generated, setGenerated] = useState<ReportId | null>(null);
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

  const current = REPORTS.find((r) => r.id === selected)!;
  const isNoFilter = current?.noFilter ?? false;

  const { data: sales = [], isLoading: l1 } = useRows<any>("sales", {
    select: "*, clients(name, phone)",
    dateRange: !isNoFilter && selected !== "pending" && (range.start || range.end) ? {
      column: "created_at",
      gte: range.start ? `${range.start}T00:00:00` : undefined,
      lte: range.end ? `${range.end}T23:59:59` : undefined,
    } : undefined,
    limit: 5000,
    order: { column: "created_at", ascending: false },
  });

  const periodSaleIds = useMemo(() => sales.map((s: any) => s.id), [sales]);

  // Carrega itens sob demanda exclusivamente vinculados às vendas filtradas no período
  const { data: saleItems = [], isLoading: l2 } = useQuery({
    queryKey: ["store-reports-items", range.start, range.end, periodSaleIds.slice(0, 50).join(",")],
    enabled: periodSaleIds.length > 0,
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < periodSaleIds.length; i += 100) {
        chunks.push(periodSaleIds.slice(i, i + 100));
      }
      const results: any[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("sale_items")
          .select("*")
          .in("sale_id", chunk);
        if (error) throw error;
        if (data) results.push(...data);
      }
      return results;
    },
    staleTime: 60_000,
  });

  const { data: products = [] } = useRows<any>("products", { limit: 3000 });
  const { data: clients = [] } = useRows<any>("clients", { limit: 3000 });
  const { data: installments = [] } = useRows<any>("sale_installments", { 
    select: "*, sales(id, sale_code, client_id, installments_count, notes, clients(id, name, phone))",
    limit: 5000 
  });
  const { data: transactions = [] } = useRows<any>("transactions", {
    select: "*, financial_accounts(name), clients(name, phone), suppliers(name), sales(id, sale_code, client_id, notes, clients(name, phone))",
    dateRange: !isNoFilter && (range.start || range.end) ? {
      column: "created_at",
      gte: range.start ? `${range.start}T00:00:00` : undefined,
      lte: range.end ? `${range.end}T23:59:59.999` : undefined,
    } : undefined,
    limit: 5000,
  });
  const { data: stock = [] } = useRows<any>("stock_products", { limit: 3000 });
  const { data: profiles = [] } = useRows<any>("user_profiles", { limit: 500 });
  const { data: materials = [] } = useRows<any>("materials", { limit: 2000 });
  const { data: suppliers = [] } = useRows<any>("suppliers", { limit: 2000 });
  const { data: productionOrders = [] } = useRows<any>("production_orders", { limit: 2000 });

  const isLoading = l1 || (periodSaleIds.length > 0 && l2);

  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    if (!range.start && !range.end) return true;
    const isoDateStr = toISODate(iso);
    if (range.start && isoDateStr < range.start) return false;
    if (range.end && isoDateStr > range.end) return false;
    return true;
  };

  const productMap = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);
  const clientMap = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const clientByNameMap = useMemo(() => buildClientByNameMap(clients), [clients]);
  const saleMap = useMemo(() => new Map(sales.map((s: any) => [s.id, s])), [sales]);
  const profileMap = useMemo(() => new Map(profiles.map((pr: any) => [pr.id, pr])), [profiles]);

  const txBySaleIdMap = useMemo(() => {
    const map = new Map<string, any>();
    transactions.forEach((tx: any) => {
      if (tx.sale_id && !map.has(tx.sale_id)) map.set(tx.sale_id, tx);
    });
    return map;
  }, [transactions]);

  const txBySaleCodeMap = useMemo(() => buildTxBySaleCodeMap(transactions), [transactions]);

  const clientResolutionContext = useMemo(() => ({
    clients,
    clientMap,
    clientByNameMap,
    sales,
    saleMap,
    transactions,
    txBySaleIdMap,
    txBySaleCodeMap,
  }), [clients, clientMap, clientByNameMap, sales, saleMap, transactions, txBySaleIdMap, txBySaleCodeMap]);

  const productName = (id?: string | null) => productMap.get(id)?.name ?? "—";
  const productCategory = (id?: string | null) => productMap.get(id)?.category ?? "Sem categoria";
  const clientName = (id?: string | null) => clientMap.get(id)?.name ?? "Consumidor final";
  const clientPhone = (id?: string | null) => clientMap.get(id)?.phone ?? "—";
  const sellerName = (id?: string | null) => {
    const prof = profileMap.get(id);
    return prof?.display_name || prof?.email || "Balcão Loja";
  };

  const resolveSaleClientDetails = (saleOrId: any, saleCodeFallback?: string, fallbackClientId?: string) => {
    return resolveSaleClientInfo(saleOrId, clientResolutionContext, saleCodeFallback, fallbackClientId);
  };

  const resolveSaleClient = (sale: any) => resolveSaleClientDetails(sale).name;

  const result = useMemo<Result>(() => {
    const todayIso = toISODate(new Date());

    const validSales = sales.filter(
      (s: any) => inRange(s.created_at) && !["cancelled", "cancelada", "estornado"].includes(String(s.status || "").toLowerCase()),
    );
    const validSaleIds = new Set(validSales.map((s: any) => s.id));
    const itemsOfValidSales = saleItems.filter((i: any) => validSaleIds.has(i.sale_id));
    const itemTotal = (i: any) => Number(i.quantity ?? 0) * Number(i.unit_price ?? 0) - Number(i.discount ?? 0);

    const summaryCards: SummaryCard[] = [];

    switch (selected) {
      case "period": {
        const map = new Map<string, { count: number; total: number; discount: number }>();
        let sumRevenue = 0;
        let sumDiscount = 0;

        validSales.forEach((s: any) => {
          const k = periodKey(s.created_at, grouping);
          const acc = map.get(k) ?? { count: 0, total: 0, discount: 0 };
          const val = Number(s.total_amount ?? 0);
          const disc = Number(s.discount_amount ?? s.discount ?? 0);
          acc.count += 1;
          acc.total += val;
          acc.discount += disc;
          sumRevenue += val;
          sumDiscount += disc;
          map.set(k, acc);
        });

        summaryCards.push(
          { label: "Faturamento Total", value: brl(sumRevenue), helper: "Período selecionado" },
          { label: "Total de Vendas", value: num(validSales.length, 0), helper: "Pedidos concluídos" },
          { label: "Descontos Concedidos", value: brl(sumDiscount), helper: "Total de abatimentos" },
          { label: "Ticket Médio Global", value: brl(validSales.length > 0 ? sumRevenue / validSales.length : 0), helper: "Média por pedido" }
        );

        return {
          columns: [
            { key: "period", label: "Período" },
            { key: "count", label: "Vendas", align: "right" },
            { key: "discount", label: "Descontos", align: "right" },
            { key: "total", label: "Faturamento Líquido", align: "right" },
            { key: "ticket", label: "Ticket Médio", align: "right" },
          ],
          rows: [...map.entries()].map(([period, v]) => ({
            period,
            count: v.count,
            discount: brl(v.discount),
            total: brl(v.total),
            ticket: brl(v.count ? v.total / v.count : 0),
          })),
          summaryCards,
        };
      }

      case "top-products":
      case "sales-by-product": {
        const map = new Map<string, { id: string; qty: number; total: number }>();
        let sumQty = 0;
        let sumTotal = 0;

        itemsOfValidSales.forEach((i: any) => {
          const k = productName(i.product_id);
          const acc = map.get(k) ?? { id: i.product_id, qty: 0, total: 0 };
          const q = Number(i.quantity ?? 0);
          const t = itemTotal(i);
          acc.qty += q;
          acc.total += t;
          sumQty += q;
          sumTotal += t;
          map.set(k, acc);
        });

        const rows = [...map.entries()]
          .sort((a, b) =>
            selected === "top-products" ? b[1].qty - a[1].qty : a[0].localeCompare(b[0]),
          )
          .map(([product, v]) => {
            const pct = sumTotal > 0 ? ((v.total / sumTotal) * 100).toFixed(1) + "%" : "0%";
            return {
              product,
              category: productCategory(v.id),
              qty: num(v.qty, 0),
              avg: brl(v.qty ? v.total / v.qty : 0),
              total: brl(v.total),
              share: pct,
            };
          });

        const top1 = rows[0]?.product || "Nenhum";

        summaryCards.push(
          { label: "Volume Total Vendido", value: num(sumQty, 0), helper: "Total de unidades" },
          { label: "Faturamento Total", value: brl(sumTotal), helper: "Receita de produtos" },
          { label: "Produto Mais Vendido", value: top1, helper: "Líder de vendas" }
        );

        return {
          columns: [
            { key: "product", label: "Produto" },
            { key: "category", label: "Categoria" },
            { key: "qty", label: "Qtd. Vendida", align: "right" },
            { key: "avg", label: "Preço Médio", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "share", label: "Participação", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "clients": {
        const map = new Map<string, { id: string; phone: string; count: number; total: number; last: string }>();
        let sumTotalGasto = 0;

        validSales.forEach((s: any) => {
          const clientDetails = resolveSaleClientDetails(s);
          const k = clientDetails.name;
          const acc = map.get(k) ?? { id: s.client_id, phone: clientDetails.phone, count: 0, total: 0, last: s.created_at };
          const val = Number(s.total_amount ?? 0);
          acc.count += 1;
          acc.total += val;
          sumTotalGasto += val;
          if (new Date(s.created_at) > new Date(acc.last)) acc.last = s.created_at;
          if ((!acc.phone || acc.phone === "—") && clientDetails.phone && clientDetails.phone !== "—") {
            acc.phone = clientDetails.phone;
          }
          map.set(k, acc);
        });

        const rows = [...map.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([client, v]) => ({
            client,
            phone: v.phone && v.phone !== "—" ? v.phone : clientPhone(v.id),
            count: v.count,
            total: brl(v.total),
            ticket: brl(v.count ? v.total / v.count : 0),
            last: dateBR(v.last),
          }));

        summaryCards.push(
          { label: "Clientes Compradores", value: num(rows.length, 0), helper: "Compraram no período" },
          { label: "Faturamento da Carteira", value: brl(sumTotalGasto), helper: "Total gasto por clientes" },
          { label: "Maior Comprador", value: rows[0]?.client || "—", helper: rows[0]?.total ? `${rows[0].total}` : "" }
        );

        return {
          columns: [
            { key: "client", label: "Cliente" },
            { key: "phone", label: "Telefone" },
            { key: "count", label: "Compras", align: "right" },
            { key: "total", label: "Total Gasto", align: "right" },
            { key: "ticket", label: "Ticket Médio", align: "right" },
            { key: "last", label: "Última Compra" },
          ],
          rows,
          summaryCards,
        };
      }

      case "cashflow": {
        const map = new Map<string, { income: number; expense: number }>();
        let totalIncome = 0;
        let totalExpense = 0;

        transactions
          .filter((t: any) => inRange(t.created_at || t.due_date))
          .forEach((t: any) => {
            const dateRef = t.created_at || t.due_date;
            const k = periodKey(dateRef, grouping);
            const acc = map.get(k) ?? { income: 0, expense: 0 };
            const isIncome = t.type === "income" || t.type === "entrada";
            const isExpense = t.type === "expense" || t.type === "saida";
            const val = Math.abs(Number(t.amount ?? 0));
            if (isIncome) {
              acc.income += val;
              totalIncome += val;
            } else if (isExpense) {
              acc.expense += val;
              totalExpense += val;
            }
            map.set(k, acc);
          });

        const balanceLiquido = totalIncome - totalExpense;

        summaryCards.push(
          { label: "Entradas (+)", value: brl(totalIncome), helper: "Receitas do período" },
          { label: "Saídas (-)", value: brl(totalExpense), helper: "Despesas e pagamentos" },
          { label: "Saldo Operacional", value: brl(balanceLiquido), helper: balanceLiquido >= 0 ? "Superávit do período" : "Déficit do período" }
        );

        let runningBalance = 0;
        const rows = [...map.entries()].map(([period, v]) => {
          const diff = v.income - v.expense;
          runningBalance += diff;
          return {
            period,
            income: brl(v.income),
            expense: brl(v.expense),
            balance: brl(diff),
            accumulated: brl(runningBalance),
          };
        });

        return {
          columns: [
            { key: "period", label: "Período" },
            { key: "income", label: "Entradas (+)", align: "right" },
            { key: "expense", label: "Saídas (-)", align: "right" },
            { key: "balance", label: "Saldo Período", align: "right" },
            { key: "accumulated", label: "Saldo Acumulado", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "transactions": {
        const gen = buildTransactionReportData(
          transactions.filter((t: any) => inRange(t.created_at || t.due_date)),
          txTypeFilter,
          {
            clients,
            sales,
            suppliers,
            clientMap,
            saleMap,
          }
        );

        return {
          columns: gen.columns,
          rows: gen.rows,
          summaryCards: gen.summaryCards,
        };
      }

      case "sales-general": {
        let sum = 0;
        validSales.forEach((s: any) => sum += Number(s.total_amount ?? 0));

        summaryCards.push(
          { label: "Faturamento Total", value: brl(sum), helper: `${validSales.length} vendas ativas` },
          { label: "Ticket Médio", value: brl(validSales.length > 0 ? sum / validSales.length : 0), helper: "Média por pedido" }
        );

        return {
          columns: [
            { key: "code", label: "Venda" },
            { key: "date", label: "Data/Hora" },
            { key: "client", label: "Cliente" },
            { key: "type", label: "Tipo" },
            { key: "method", label: "Pagamento" },
            { key: "total", label: "Total", align: "right" },
          ],
          rows: validSales.map((s: any) => ({
            code: s.sale_code ?? s.id?.slice(0, 8),
            date: dateTimeBR(s.created_at),
            client: resolveSaleClient(s),
            type: s.is_debt ? "Fiado" : "À Vista",
            method: (s.payment_method ?? "—").toUpperCase(),
            total: brl(s.total_amount),
          })),
          summaryCards,
        };
      }

      case "sales-full": {
        let sum = 0;
        let sumPecas = 0;

        // Agrupar itens por venda
        const itemsBySale = new Map<string, any[]>();
        itemsOfValidSales.forEach((i: any) => {
          const sid = i.sale_id;
          if (!sid) return;
          const list = itemsBySale.get(sid) || [];
          list.push(i);
          itemsBySale.set(sid, list);
        });

        // Iterar sobre cada venda válida para gerar uma única linha consolidada por venda
        const rows = validSales
          .filter((s: any) => itemsBySale.has(s.id) || Number(s.total_amount ?? 0) > 0)
          .map((sale: any) => {
            const saleItemsList = itemsBySale.get(sale.id) || [];
            let saleTotalPecas = 0;
            let saleTotalAmount = 0;

            const itemsDetailed = saleItemsList.map((i: any) => {
              const q = Number(i.quantity ?? 1);
              const t = itemTotal(i);
              saleTotalPecas += q;
              saleTotalAmount += t;
              return {
                name: productName(i.product_id),
                size: i.numeracao && i.numeracao !== "—" ? i.numeracao : null,
                qty: q,
                unit_price: Number(i.unit_price ?? 0),
                discount: Number(i.discount ?? 0),
                total: t,
              };
            });

            // Se a venda não tiver itens discriminados em sale_items, usar total_amount da venda
            if (saleItemsList.length === 0) {
              saleTotalAmount = Number(sale.total_amount ?? 0);
              saleTotalPecas = 1;
            }

            sum += saleTotalAmount;
            sumPecas += saleTotalPecas;

            // Texto limpo e organizado para a exportação CSV
            const rawProductsText = itemsDetailed.length > 0
              ? itemsDetailed
                  .map(
                    (it: any, idx: number) =>
                      `#${idx + 1} ${it.name}${it.size ? ` (Tam: ${it.size})` : ""} - ${it.qty}un x ${brl(it.unit_price)}${it.discount > 0 ? ` [Desc: ${brl(it.discount)}]` : ""} = ${brl(it.total)}`
                  )
                  .join(" | ")
              : "Venda registrada";

            // Visualização elaborada, explicativa e empilhada de todos os produtos na mesma linha
            const productsElement = (
              <div className="flex flex-col gap-1.5 py-1 text-left min-w-[280px]">
                {itemsDetailed.length > 0 ? (
                  itemsDetailed.map((it: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-x-3 gap-y-0.5 border-b border-slate-100 last:border-0 pb-1.5 last:pb-0 text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="inline-flex items-center justify-center size-4 rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-700 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 tracking-tight">
                          {it.name}
                        </span>
                        {it.size && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-bold text-amber-800 border border-amber-200/60 shrink-0">
                            Tam {it.size}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium whitespace-nowrap shrink-0 pl-5 sm:pl-0">
                        <span>{it.qty} un × {brl(it.unit_price)}</span>
                        {it.discount > 0 && (
                          <span className="text-rose-600 text-[10px] font-semibold">
                            (-{brl(it.discount)})
                          </span>
                        )}
                        <span className="font-extrabold text-slate-900 ml-1">
                          = {brl(it.total)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">Venda registrada sem itens discriminados</span>
                )}
              </div>
            );

            return {
              code: sale.sale_code ?? sale.id?.slice(0, 8) ?? "—",
              date: dateTimeBR(sale.created_at),
              client: resolveSaleClient(sale),
              products: productsElement,
              _rawProductsText: rawProductsText,
              items_count: `${saleTotalPecas} ${saleTotalPecas === 1 ? "item" : "itens"}`,
              total: brl(saleTotalAmount),
              seller: sellerName(sale.seller_id),
            };
          });

        summaryCards.push(
          { label: "Total Faturado", value: brl(sum), helper: `${rows.length} vendas analisadas` },
          { label: "Peças Vendidas", value: num(sumPecas, 0), helper: "Volume total de itens" },
          { label: "Ticket Médio", value: brl(rows.length > 0 ? sum / rows.length : 0), helper: "Média por pedido" }
        );

        return {
          columns: [
            { key: "code", label: "Venda" },
            { key: "date", label: "Data/Hora" },
            { key: "client", label: "Cliente" },
            { key: "products", label: "Itens / Produtos da Venda" },
            { key: "items_count", label: "Qtd Peças", align: "center" },
            { key: "total", label: "Total Venda", align: "right" },
            { key: "seller", label: "Vendedor" },
          ],
          rows,
          summaryCards,
        };
      }

      case "pending": {
        const pend = installments.filter(
          (i: any) => i.status !== "paid" && inRange(i.due_date),
        );

        let totalAberto = 0;
        let totalAtrasado = 0;
        let countAtrasado = 0;

        const rows = pend.map((i: any) => {
          const sale = (i.sales ? (Array.isArray(i.sales) ? i.sales[0] : i.sales) : null) || sales.find((s: any) => s.id === i.sale_id);
          const saleCode = sale?.sale_code || i.sale_code;
          const clientDetails = resolveSaleClientDetails(sale || i.sale_id, saleCode, sale?.client_id);
          const dueIso = toISODate(i.due_date);
          const overdue = dueIso < todayIso;
          const rem = Number(i.remaining_amount ?? i.amount - (i.paid_amount ?? 0));

          totalAberto += rem;
          if (overdue) {
            totalAtrasado += rem;
            countAtrasado++;
          }

          let diffDays = 0;
          if (dueIso) {
            const diffTime = new Date(todayIso).getTime() - new Date(dueIso).getTime();
            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }

          const rawPhone = (clientDetails.phone || "").replace(/\D/g, "");
          const phoneFormatted = rawPhone.length >= 10 ? (rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`) : "";
          const msg = encodeURIComponent(
            `Olá, ${clientDetails.isConsumidor ? "Cliente" : clientDetails.name}! Tudo bem? Passando para lembrar da parcela ${i.installment_number || 1}/${sale?.installments_count || 1} com vencimento em ${dateBR(i.due_date)} no valor de ${brl(rem)}. Caso já tenha pago, por favor desconsidere.`
          );

          return {
            client: clientDetails.name,
            phone: clientDetails.phone || "—",
            installment: `${i.installment_number}/${sale?.installments_count ?? "—"}`,
            due: dateBR(i.due_date),
            overdue_days: overdue ? `+${diffDays} dias` : "A vencer",
            amount: brl(i.amount),
            remaining: brl(rem),
            status: overdue ? "ATRASADO" : "A VENCER",
            action: phoneFormatted ? (
              <a
                href={`https://wa.me/${phoneFormatted}?text=${msg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                <MessageCircle className="size-3.5" /> Cobrar
              </a>
            ) : (
              <span className="text-xs text-muted-foreground italic">Sem WhatsApp</span>
            ),
          };
        });

        summaryCards.push(
          { label: "Fiado em Aberto", value: brl(totalAberto), helper: `${pend.length} parcelas` },
          { label: "Total Atrasado", value: brl(totalAtrasado), helper: `${countAtrasado} parcelas vencidas` },
          { label: "Inadimplência", value: totalAberto > 0 ? `${((totalAtrasado / totalAberto) * 100).toFixed(1)}%` : "0%", helper: "Sobre o saldo aberto" }
        );

        return {
          columns: [
            { key: "client", label: "Cliente" },
            { key: "phone", label: "Telefone" },
            { key: "installment", label: "Parcela" },
            { key: "due", label: "Vencimento" },
            { key: "overdue_days", label: "Atraso" },
            { key: "amount", label: "Valor Parcela", align: "right" },
            { key: "remaining", label: "Em Aberto", align: "right" },
            { key: "action", label: "Ação Rápida", className: "print:hidden" },
          ],
          rows,
          summaryCards,
        };
      }

      case "sandal-sizes": {
        const map = new Map<string, { qty: number; total: number }>();
        let totalPares = 0;
        let totalFat = 0;

        itemsOfValidSales
          .filter((i: any) => {
            const cat = productCategory(i.product_id).toLowerCase();
            return cat.includes("sandal") || cat.includes("sandál") || cat.includes("calcado") || cat.includes("calçado");
          })
          .forEach((i: any) => {
            const k = i.numeracao ?? "Sem numeração";
            const q = Number(i.quantity ?? 0);
            const t = itemTotal(i);
            const acc = map.get(k) ?? { qty: 0, total: 0 };
            acc.qty += q;
            acc.total += t;
            totalPares += q;
            totalFat += t;
            map.set(k, acc);
          });

        const rows = [...map.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
          .map(([size, v]) => ({
            size,
            qty: num(v.qty, 0),
            total: brl(v.total),
            share: totalPares > 0 ? `${((v.qty / totalPares) * 100).toFixed(1)}%` : "0%",
          }));

        summaryCards.push(
          { label: "Pares de Sandálias", value: num(totalPares, 0), helper: "Vendidos no período" },
          { label: "Faturamento Sandálias", value: brl(totalFat), helper: "Receita das grades" }
        );

        return {
          columns: [
            { key: "size", label: "Numeração" },
            { key: "qty", label: "Qtd. Vendida", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "share", label: "Participação", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "sizes-available": {
        const map = new Map<string, number>();
        let totalDisponivel = 0;

        stock.forEach((s: any) => {
          const numeracoes = s.numeracoes;
          if (numeracoes && typeof numeracoes === "object") {
            Object.entries(numeracoes as Record<string, any>).forEach(([size, qty]) => {
              const q = Number(qty ?? 0);
              map.set(size, (map.get(size) ?? 0) + q);
              totalDisponivel += q;
            });
          } else {
            const q = Number(s.quantidade_disponivel ?? 0);
            map.set("Padrão", (map.get("Padrão") ?? 0) + q);
            totalDisponivel += q;
          }
        });

        const rows = [...map.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
          .map(([size, qty]) => ({
            size,
            qty: num(qty, 0),
            share: totalDisponivel > 0 ? `${((qty / totalDisponivel) * 100).toFixed(1)}%` : "0%",
          }));

        summaryCards.push(
          { label: "Total em Estoque", value: num(totalDisponivel, 0), helper: "Pares disponíveis" }
        );

        return {
          columns: [
            { key: "size", label: "Numeração" },
            { key: "qty", label: "Qtd. Disponível", align: "right" },
            { key: "share", label: "Distribuição", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "by-seller": {
        const map = new Map<string, { count: number; total: number }>();
        let sumRevenue = 0;

        validSales.forEach((s: any) => {
          const k = sellerName(s.seller_id);
          const acc = map.get(k) ?? { count: 0, total: 0 };
          const val = Number(s.total_amount ?? 0);
          acc.count += 1;
          acc.total += val;
          sumRevenue += val;
          map.set(k, acc);
        });

        const rows = [...map.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([seller, v]) => ({
            seller,
            count: v.count,
            total: brl(v.total),
            ticket: brl(v.count ? v.total / v.count : 0),
            share: sumRevenue > 0 ? `${((v.total / sumRevenue) * 100).toFixed(1)}%` : "0%",
          }));

        summaryCards.push(
          { label: "Faturamento Vendedores", value: brl(sumRevenue), helper: "Vendas realizadas" },
          { label: "Melhor Vendedor", value: rows[0]?.seller || "—", helper: rows[0]?.total ? `${rows[0].total}` : "" }
        );

        return {
          columns: [
            { key: "seller", label: "Vendedor" },
            { key: "count", label: "Vendas", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "ticket", label: "Ticket Médio", align: "right" },
            { key: "share", label: "Participação", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "by-category": {
        const map = new Map<string, { qty: number; total: number }>();
        let sumTotal = 0;

        itemsOfValidSales.forEach((i: any) => {
          const k = productCategory(i.product_id);
          const acc = map.get(k) ?? { qty: 0, total: 0 };
          const q = Number(i.quantity ?? 0);
          const t = itemTotal(i);
          acc.qty += q;
          acc.total += t;
          sumTotal += t;
          map.set(k, acc);
        });

        const rows = [...map.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([category, v]) => ({
            category,
            qty: num(v.qty, 0),
            total: brl(v.total),
            share: sumTotal > 0 ? `${((v.total / sumTotal) * 100).toFixed(1)}%` : "0%",
          }));

        summaryCards.push(
          { label: "Faturamento Total", value: brl(sumTotal), helper: "Todas as categorias" },
          { label: "Categoria Líder", value: rows[0]?.category || "—", helper: rows[0]?.total ? `${rows[0].total}` : "" }
        );

        return {
          columns: [
            { key: "category", label: "Categoria" },
            { key: "qty", label: "Itens Vendidos", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "share", label: "Participação", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "by-hour": {
        const map = new Map<number, { count: number; total: number }>();
        let sumRevenue = 0;

        validSales.forEach((s: any) => {
          const h = new Date(s.created_at).getHours();
          const acc = map.get(h) ?? { count: 0, total: 0 };
          const val = Number(s.total_amount ?? 0);
          acc.count += 1;
          acc.total += val;
          sumRevenue += val;
          map.set(h, acc);
        });

        const rows = [...map.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([h, v]) => ({
            hour: `${String(h).padStart(2, "0")}:00 às ${String(h).padStart(2, "0")}:59`,
            count: v.count,
            total: brl(v.total),
            ticket: brl(v.count ? v.total / v.count : 0),
            share: sumRevenue > 0 ? `${((v.total / sumRevenue) * 100).toFixed(1)}%` : "0%",
          }));

        const sortedByRevenue = [...rows].sort((a, b) => {
          const valA = parseFloat(a.total.replace(/[R$\s.]/g, "").replace(",", "."));
          const valB = parseFloat(b.total.replace(/[R$\s.]/g, "").replace(",", "."));
          return valB - valA;
        });

        summaryCards.push(
          { label: "Horário de Pico", value: sortedByRevenue[0]?.hour || "—", helper: sortedByRevenue[0]?.total ? `Faturamento: ${sortedByRevenue[0].total}` : "" },
          { label: "Faturamento Total", value: brl(sumRevenue), helper: `${validSales.length} vendas` }
        );

        return {
          columns: [
            { key: "hour", label: "Faixa Horária" },
            { key: "count", label: "Qtd Vendas", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "ticket", label: "Ticket Médio", align: "right" },
            { key: "share", label: "Participação", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "cancelled": {
        const cancelled = sales.filter(
          (s: any) => ["cancelled", "cancelada", "estornado"].includes(String(s.status || "").toLowerCase()) && inRange(s.created_at),
        );

        let sumCancelado = 0;
        cancelled.forEach((s: any) => sumCancelado += Number(s.total_amount ?? 0));

        summaryCards.push(
          { label: "Total Cancelado", value: brl(sumCancelado), helper: "Receita estornada" },
          { label: "Vendas Canceladas", value: num(cancelled.length, 0), helper: "Pedidos não concluídos" }
        );

        return {
          columns: [
            { key: "code", label: "Venda" },
            { key: "date", label: "Data" },
            { key: "client", label: "Cliente" },
            { key: "method", label: "Pagamento" },
            { key: "notes", label: "Motivo / Observações" },
            { key: "total", label: "Valor Estornado", align: "right" },
          ],
          rows: cancelled.map((s: any) => ({
            code: s.sale_code ?? s.id?.slice(0, 8),
            date: dateTimeBR(s.created_at),
            client: resolveSaleClient(s),
            method: (s.payment_method ?? "—").toUpperCase(),
            notes: s.notes ?? "Cancelamento registrado",
            total: brl(s.total_amount),
          })),
          summaryCards,
        };
      }

      case "stock-general": {
        let totalPecas = 0;
        let totalCusto = 0;

        const rows = stock.map((s: any) => {
          const p = productMap.get(s.produto_id || s.product_id);
          const qty = Number(s.quantidade_disponivel ?? p?.current_stock ?? 0);
          const cost = Number(s.preco_custo ?? p?.cost_price ?? 0);
          const price = Number(s.preco_venda ?? p?.sale_price ?? p?.price_retail ?? 0);

          totalPecas += qty;
          totalCusto += qty * cost;

          return {
            sku: p?.sku ?? "—",
            product: s.produto_nome ?? p?.name ?? "—",
            category: s.categoria ?? p?.category ?? "—",
            qty: num(qty, 0),
            cost: brl(cost),
            price: brl(price),
            total_cost: brl(qty * cost),
            status: qty <= 0 ? "ESGOTADO" : "NORMAL",
          };
        });

        summaryCards.push(
          { label: "Total de Peças", value: num(totalPecas, 0), helper: "Estoque físico disponível" },
          { label: "Patrimônio a Custo", value: brl(totalCusto), helper: "Valor imobilizado" }
        );

        return {
          columns: [
            { key: "product", label: "Produto" },
            { key: "category", label: "Categoria" },
            { key: "qty", label: "Disponível", align: "right" },
            { key: "cost", label: "Custo Unit.", align: "right" },
            { key: "price", label: "Venda Unit.", align: "right" },
            { key: "total_cost", label: "Total Custo", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "production-general": {
        let totalPecas = 0;
        let concluidas = 0;

        const rows = productionOrders.map((o: any) => {
          const q = Number(o.quantidade ?? o.quantity ?? 0);
          totalPecas += q;
          const st = String(o.status || "").toLowerCase();
          if (st === "concluida" || st === "concluído" || st === "finalizada") concluidas++;

          return {
            code: o.codigo_ordem ?? "—",
            product: o.produto_nome ?? "—",
            qty: num(q, 0),
            start: dateBR(o.started_at || o.created_at),
            due: dateBR(o.data_prevista),
            end: dateBR(o.completed_at),
            materials: o.materiais_baixados ? "SIM" : "NÃO",
            status: (o.status ?? "PENDENTE").toUpperCase(),
          };
        });

        summaryCards.push(
          { label: "Ordens de Produção", value: num(productionOrders.length, 0), helper: "Total registradas" },
          { label: "Peças Programadas", value: num(totalPecas, 0), helper: "Volume em fabricação" },
          { label: "Concluídas", value: num(concluidas, 0), helper: "Ordens finalizadas" }
        );

        return {
          columns: [
            { key: "code", label: "Código Ordem" },
            { key: "product", label: "Produto" },
            { key: "qty", label: "Qtd Peças", align: "right" },
            { key: "start", label: "Início" },
            { key: "due", label: "Previsão" },
            { key: "end", label: "Conclusão" },
            { key: "materials", label: "Baixa Insumos" },
          ],
          rows,
          summaryCards,
        };
      }

      case "materials-general": {
        let totalValor = 0;
        let criticos = 0;

        const rows = materials.map((m: any) => {
          const q = Number(m.current_stock ?? 0);
          const c = Number(m.cost_price ?? m.preco_unitario ?? 0);
          const min = Number(m.min_stock ?? 0);
          totalValor += q * c;
          if (q <= min && min > 0) criticos++;

          return {
            sku: m.sku || "—",
            name: m.name ?? "—",
            unit: (m.unit ?? "UN").toUpperCase(),
            price: brl(c),
            qty: num(q, 2),
            total: brl(q * c),
            min: num(min, 2),
            status: q <= min && min > 0 ? "REPOR ESTOQUE" : "NORMAL",
          };
        });

        summaryCards.push(
          { label: "Insumos Cadastrados", value: num(materials.length, 0), helper: "Matérias-primas" },
          { label: "Capital em Insumos", value: brl(totalValor), helper: "Estoque a custo" },
          { label: "Estoque Crítico", value: num(criticos, 0), helper: "Abaixo do mínimo" }
        );

        return {
          columns: [
            { key: "name", label: "Material / Insumo" },
            { key: "unit", label: "Unidade" },
            { key: "price", label: "Custo Unit.", align: "right" },
            { key: "qty", label: "Estoque Atual", align: "right" },
            { key: "total", label: "Valor Total", align: "right" },
            { key: "min", label: "Mínimo", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      case "suppliers-general": {
        const supMap = new Map<string, any>();
        suppliers.forEach((s: any) => {
          if (!s.name) return;
          supMap.set(s.name.trim().toLowerCase(), {
            name: s.name,
            document: s.document ?? "—",
            contact: s.contact ?? "—",
            phone: s.phone ?? s.phone_secondary ?? "—",
            email: s.email ?? "—",
            category: s.category ?? "Geral",
            location: s.city && s.state ? `${s.city}/${s.state}` : s.city ?? "—",
            status: s.active !== false ? "ATIVO" : "INATIVO",
          });
        });

        materials.forEach((m: any) => {
          if (!m.supplier) return;
          const key = m.supplier.trim().toLowerCase();
          if (!supMap.has(key)) {
            supMap.set(key, {
              name: m.supplier.trim(),
              document: "—",
              contact: "—",
              phone: "—",
              email: "—",
              category: m.type ?? m.category ?? "Insumos",
              location: "—",
              status: "ATIVO",
            });
          }
        });

        const rows = [...supMap.values()].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })
        );

        summaryCards.push(
          { label: "Fornecedores", value: num(rows.length, 0), helper: "Parceiros cadastrados" }
        );

        return {
          columns: [
            { key: "name", label: "Fornecedor" },
            { key: "document", label: "CNPJ / CPF" },
            { key: "contact", label: "Contato" },
            { key: "phone", label: "Telefone / WhatsApp" },
            { key: "email", label: "E-mail" },
            { key: "category", label: "Ramo de Atuação" },
            { key: "location", label: "Cidade / UF" },
          ],
          rows,
          summaryCards,
        };
      }

      case "products-general": {
        let sumPrice = 0;
        let count = 0;

        const rows = products.map((p: any) => {
          const cost = Number(p.cost_price ?? 0);
          const retail = Number(p.sale_price ?? p.price_retail ?? 0);
          const wholesale = Number(p.wholesale_price ?? p.price_wholesale ?? 0);
          const marginBrl = retail - cost;
          const marginPct = retail > 0 ? ((retail - cost) / retail) * 100 : 0;

          if (p.active !== false) {
            sumPrice += retail;
            count++;
          }

          return {
            sku: p.sku ?? "—",
            name: p.name ?? "—",
            category: p.category ?? "—",
            cost: brl(cost),
            retail: brl(retail),
            wholesale: brl(wholesale),
            margin_brl: brl(marginBrl),
            margin_pct: `${marginPct.toFixed(1)}%`,
            stock: num(p.current_stock ?? 0, 0),
            status: p.active !== false ? "ATIVO" : "INATIVO",
          };
        });

        summaryCards.push(
          { label: "Produtos Ativos", value: num(count, 0), helper: "Catálogo comercial" },
          { label: "Preço Médio Varejo", value: brl(count > 0 ? sumPrice / count : 0), helper: "Média geral" }
        );

        return {
          columns: [
            { key: "name", label: "Produto" },
            { key: "category", label: "Categoria" },
            { key: "cost", label: "Custo Unit.", align: "right" },
            { key: "retail", label: "Preço Varejo", align: "right" },
            { key: "wholesale", label: "Preço Atacado", align: "right" },
            { key: "margin_brl", label: "Margem (R$)", align: "right" },
            { key: "margin_pct", label: "Margem (%)", align: "right" },
            { key: "stock", label: "Estoque", align: "right" },
          ],
          rows,
          summaryCards,
        };
      }

      default:
        return { columns: [], rows: [], summaryCards: [] };
    }
  }, [
    selected,
    grouping,
    range,
    sales,
    saleItems,
    products,
    clients,
    installments,
    transactions,
    stock,
    profiles,
    materials,
    suppliers,
    productionOrders,
    productMap,
    clientMap,
    profileMap,
  ]);

  const handleExport = () => {
    if (!result.rows.length) {
      toast.error("Nada para exportar.");
      return;
    }

    if (selected === "transactions") {
      const csv = exportTransactionsToCSV(
        transactions.filter((t: any) => inRange(t.created_at || t.due_date)),
        txTypeFilter,
        { clients, sales, suppliers }
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio-transacoes-${txTypeFilter}-${range.start}-${range.end}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Relatório de transações exportado em CSV.");
      return;
    }

    const exportCols = result.columns.filter((c) => c.key !== "action" && c.className !== "print:hidden");
    const head = exportCols.map((c) => `"${c.label}"`).join(";");

    const getCleanString = (val: any, row?: any, colKey?: string) => {
      if (colKey === "products" && row?._rawProductsText) {
        return row._rawProductsText;
      }
      if (val === null || val === undefined) return "";
      if (typeof val === "string" || typeof val === "number") return String(val);
      if (React.isValidElement(val)) {
        const props: any = val.props;
        if (typeof props?.children === "string" || typeof props?.children === "number") {
          return String(props.children);
        }
        if (Array.isArray(props?.children)) {
          return props.children.map((c: any) => (typeof c === "string" || typeof c === "number" ? c : "")).join("");
        }
      }
      return "";
    };

    const body = result.rows
      .map((r) => exportCols.map((c) => `"${getCleanString(r[c.key], r, c.key)}"`).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${head}\n${body}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${selected}-${range.start}-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Relatório exportado em CSV.");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileBarChart className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight">
              Relatórios da Loja
            </h1>
            <p className="text-sm text-muted-foreground">
              Análises completas de vendas, faturamento, clientes, caixa e estoque da loja.
            </p>
          </div>
        </div>
      </div>

      {/* Tipo de Relatório */}
      <Card className="rounded-3xl border-border/50 print:hidden shadow-xs">
        <CardContent className="space-y-4 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Selecione o Relatório Desejado
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {REPORTS.map((r) => {
              const Icon = r.icon;
              const is = selected === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r.id);
                    setGenerated(null);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all",
                    is
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border/40 bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <Icon className={cn("size-5", is ? "text-primary-foreground" : "text-muted-foreground")} />
                  <span className="text-[11px] font-bold leading-tight line-clamp-2">
                    {r.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="rounded-3xl border-border/50 print:hidden shadow-xs">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {current.noFilter ? "Relatório Sem Filtro de Data (Cadastral Geral)" : "Filtro de Período"}
            </p>
            {!current.noFilter && (
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PERIODS.map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant="outline"
                    onClick={() => setRange(p.fn())}
                    className="h-8 rounded-lg text-xs font-bold border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {!current.noFilter && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground">
                  Data Inicial
                </label>
                <Input
                  type="date"
                  value={range.start}
                  onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                  className="h-11 rounded-xl bg-muted/20 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={range.end}
                  onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                  className="h-11 rounded-xl bg-muted/20 font-bold"
                />
              </div>
            </div>
          )}

          {current.grouping && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted-foreground">
                Agrupamento
              </label>
              <Select value={grouping} onValueChange={(v: any) => setGrouping(v)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/20 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {selected === "transactions" && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <label className="text-[10px] font-black uppercase text-muted-foreground block">
                Tipo de Transação
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "todos", label: "Todos os Tipos" },
                  { key: "receita", label: "Receitas (Vendas)" },
                  { key: "despesa", label: "Despesas (Saídas)" },
                ] as const).map((t) => (
                  <Button
                    key={t.key}
                    type="button"
                    variant={txTypeFilter === t.key ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-xl text-xs font-bold h-9 px-3",
                      txTypeFilter === t.key && t.key === "receita" && "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent",
                      txTypeFilter === t.key && t.key === "despesa" && "bg-rose-600 hover:bg-rose-700 text-white border-transparent"
                    )}
                    onClick={() => setTxTypeFilter(t.key)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={() => {
              setGenerated(selected);
              toast.success(`Relatório "${current.label}" gerado.`);
              setTimeout(() => {
                document.getElementById("store-report-results-section")?.scrollIntoView({ behavior: "smooth" });
              }, 150);
            }}
            disabled={isLoading}
            className="w-full gap-2 rounded-xl font-black h-12 text-sm shadow-md cursor-pointer"
          >
            <FileBarChart className="size-4" /> Gerar Relatório
          </Button>
        </CardContent>
      </Card>

      {/* Relatório Renderizado */}
      {generated && (
        <div id="store-report-results-section" className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          {selected === "sizes-available" ? (
            <AvailableSizesReport
              stock={stock}
              products={products}
              storeInfo={storeInfo}
            />
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 sm:px-2 print:hidden">
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <h2 className="font-display text-base sm:text-lg font-black text-foreground truncate">
                    Visualização: {selected === "transactions"
                      ? (txTypeFilter === "receita"
                          ? "Receitas (Vendas)"
                          : txTypeFilter === "despesa"
                          ? "Despesas (Saídas)"
                          : "Transações Financeiras")
                      : current.label}
                  </h2>
                  <Badge variant="outline" className="font-bold border-border/60 shrink-0 text-[10px]">
                    {result.rows.length} registros
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="h-10 rounded-xl font-bold border-border/60 hover:bg-muted/50 gap-2 text-xs"
                  >
                    <FileDown className="size-4 text-amber-500 shrink-0" />
                    <span>EXPORTAR CSV</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => printReport("printable-report", selected === "transactions" ? "landscape" : "portrait")}
                    className="h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black gap-2 text-xs shadow-sm"
                  >
                    <Printer className="size-4 shrink-0" />
                    <span>IMPRIMIR A4</span>
                  </Button>
                </div>
              </div>

              <ReportLayout 
                id="printable-report"
                title={selected === "transactions"
                  ? (txTypeFilter === "receita"
                      ? "Relatório de Receitas (Vendas)"
                      : txTypeFilter === "despesa"
                      ? "Relatório de Despesas (Saídas)"
                      : "Relatório de Transações Financeiras")
                  : current.label}
                startDate={current.noFilter ? undefined : range.start}
                endDate={current.noFilter ? undefined : range.end}
                storeInfo={storeInfo}
                columns={result.columns}
                rows={result.rows}
                summaryCards={result.summaryCards}
                summaryPosition="top"
                orientation={selected === "transactions" ? "landscape" : undefined}
                showTableTotals={selected !== "transactions"}
                onPrint={() => printReport("printable-report", selected === "transactions" ? "landscape" : "portrait")}
                onExportCsv={handleExport}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
