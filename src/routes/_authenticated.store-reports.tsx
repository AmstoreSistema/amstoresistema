import { useMemo, useState, useEffect } from "react";
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
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReportLayout } from "@/components/report-layout";
import { getAppSettings } from "@/lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";


export const Route = createFileRoute("/_authenticated/store-reports")({
  head: () => ({
    meta: [
      { title: "Relatórios da Loja — Amstore Gestão" },
      {
        name: "description",
        content: "Relatórios detalhados de vendas, clientes, caixa e estoque da loja.",
      },
      { property: "og:title", content: "Relatórios da Loja — Amstore Gestão" },
      {
        property: "og:description",
        content: "Relatórios detalhados de vendas, clientes, caixa e estoque da loja.",
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
  { id: "sales-general", label: "Vendas Geral", icon: FileText },
  { id: "pending", label: "Fiados/Pendentes", icon: FileText },
  { id: "sandal-sizes", label: "Numerações Sandálias", icon: Footprints },
  { id: "sizes-available", label: "Numerações Disponíveis", icon: Boxes },
  { id: "sales-full", label: "Vendas Completo", icon: Users },
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

type Column = { key: string; label: string; align?: "right" };
type Result = { columns: Column[]; rows: Record<string, string | number>[] };

function periodKey(iso: string, grouping: string) {
  if (grouping === "daily") return dateBR(iso);
  const formatted = dateBR(iso);
  if (formatted === "—") return "—";
  const parts = formatted.split("/").map(Number);
  if (parts.length < 3) return formatted;
  const [day, month, year] = parts;
  if (grouping === "yearly") return String(year);
  if (grouping === "weekly") {
    const d = new Date(year, month - 1, day);
    const first = new Date(d);
    first.setDate(d.getDate() - d.getDay());
    return `Semana de ${dateBR(first)}`;
  }
  return `${String(month).padStart(2, "0")}/${year}`;
}

function toCsv(result: Result) {
  const head = result.columns.map((c) => `"${c.label}"`).join(";");
  const body = result.rows
    .map((r) => result.columns.map((c) => `"${String(r[c.key] ?? "")}"`).join(";"))
    .join("\n");
  return `${head}\n${body}`;
}

function StoreReportsPage() {
  const [selected, setSelected] = useState<ReportId>("period");
  const [grouping, setGrouping] = useState("monthly");
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

  const { data: sales = [], isLoading: l1 } = useRows<any>("sales");
  const { data: saleItems = [], isLoading: l2 } = useRows<any>("sale_items");
  const { data: products = [] } = useRows<any>("products");
  const { data: clients = [] } = useRows<any>("clients");
  const { data: installments = [] } = useRows<any>("sale_installments");
  const { data: transactions = [] } = useRows<any>("transactions");
  const { data: stock = [] } = useRows<any>("stock_products");
  const { data: profiles = [] } = useRows<any>("user_profiles");
  const { data: materials = [] } = useRows<any>("materials");
  const { data: suppliers = [] } = useRows<any>("suppliers");
  const { data: productionOrders = [] } = useRows<any>("production_orders");


  const isLoading = l1 || l2;
  const current = REPORTS.find((r) => r.id === selected)!;

  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    if (!range.start && !range.end) return true;
    const isoDateStr = toISODate(iso);
    if (range.start && isoDateStr < range.start) return false;
    if (range.end && isoDateStr > range.end) return false;
    return true;
  };

  const productName = (id?: string | null) =>
    products.find((p: any) => p.id === id)?.name ?? "—";
  const productCategory = (id?: string | null) =>
    products.find((p: any) => p.id === id)?.category ?? "Sem categoria";
  const clientName = (id?: string | null) =>
    clients.find((c: any) => c.id === id)?.name ?? "Consumidor final";
  const sellerName = (id?: string | null) =>
    profiles.find((p: any) => p.id === id)?.display_name ??
    profiles.find((p: any) => p.id === id)?.email ??
    "Não informado";

  const result = useMemo<Result>(() => {
    const validSales = sales.filter(
      (s: any) => inRange(s.created_at) && !["cancelled", "cancelada", "estornado"].includes(String(s.status || "").toLowerCase()),
    );
    const itemsOfValidSales = saleItems.filter((i: any) =>
      validSales.some((s: any) => s.id === i.sale_id),
    );
    const itemTotal = (i: any) =>
      Number(i.quantity ?? 0) * Number(i.unit_price ?? 0) - Number(i.discount ?? 0);

    switch (selected) {
      case "period": {
        const map = new Map<string, { count: number; total: number; discount: number }>();
        validSales.forEach((s: any) => {
          const k = periodKey(s.created_at, grouping);
          const acc = map.get(k) ?? { count: 0, total: 0, discount: 0 };
          acc.count += 1;
          acc.total += Number(s.total_amount ?? 0);
          acc.discount += Number(s.discount_amount ?? s.discount ?? 0);
          map.set(k, acc);
        });
        return {
          columns: [
            { key: "period", label: "Período" },
            { key: "count", label: "Vendas", align: "right" },
            { key: "discount", label: "Descontos", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "ticket", label: "Ticket médio", align: "right" },
          ],
          rows: [...map.entries()].map(([period, v]) => ({
            period,
            count: v.count,
            discount: brl(v.discount),
            total: brl(v.total),
            ticket: brl(v.count ? v.total / v.count : 0),
          })),
        };
      }
      case "top-products":
      case "sales-by-product": {
        const map = new Map<string, { qty: number; total: number }>();
        itemsOfValidSales.forEach((i: any) => {
          const k = productName(i.product_id);
          const acc = map.get(k) ?? { qty: 0, total: 0 };
          acc.qty += Number(i.quantity ?? 0);
          acc.total += itemTotal(i);
          map.set(k, acc);
        });
        const rows = [...map.entries()]
          .sort((a, b) =>
            selected === "top-products" ? b[1].qty - a[1].qty : a[0].localeCompare(b[0]),
          )
          .map(([product, v]) => ({
            product,
            qty: num(v.qty, 0),
            total: brl(v.total),
            avg: brl(v.qty ? v.total / v.qty : 0),
          }));
        return {
          columns: [
            { key: "product", label: "Produto" },
            { key: "qty", label: "Qtd. vendida", align: "right" },
            { key: "total", label: "Total", align: "right" },
            { key: "avg", label: "Preço médio", align: "right" },
          ],
          rows,
        };
      }
      case "clients": {
        const map = new Map<string, { count: number; total: number; last: string }>();
        validSales.forEach((s: any) => {
          const k = clientName(s.client_id);
          const acc = map.get(k) ?? { count: 0, total: 0, last: s.created_at };
          acc.count += 1;
          acc.total += Number(s.total_amount ?? 0);
          if (new Date(s.created_at) > new Date(acc.last)) acc.last = s.created_at;
          map.set(k, acc);
        });
        return {
          columns: [
            { key: "client", label: "Cliente" },
            { key: "count", label: "Compras", align: "right" },
            { key: "total", label: "Total gasto", align: "right" },
            { key: "ticket", label: "Ticket médio", align: "right" },
            { key: "last", label: "Última compra" },
          ],
          rows: [...map.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([client, v]) => ({
              client,
              count: v.count,
              total: brl(v.total),
              ticket: brl(v.count ? v.total / v.count : 0),
              last: dateBR(v.last),
            })),
        };
      }
      case "cashflow": {
        const map = new Map<string, { income: number; expense: number }>();
        transactions
          .filter((t: any) => inRange(t.created_at || t.due_date))
          .forEach((t: any) => {
            const dateRef = t.created_at || t.due_date;
            const k = periodKey(dateRef, grouping);
            const acc = map.get(k) ?? { income: 0, expense: 0 };
            const isIncome = t.type === "income" || t.type === "entrada";
            const isExpense = t.type === "expense" || t.type === "saida";
            const val = Math.abs(Number(t.amount ?? 0));
            if (isIncome) acc.income += val;
            else if (isExpense) acc.expense += val;
            map.set(k, acc);
          });
        return {
          columns: [
            { key: "period", label: "Período" },
            { key: "income", label: "Entradas", align: "right" },
            { key: "expense", label: "Saídas", align: "right" },
            { key: "balance", label: "Saldo", align: "right" },
          ],
          rows: [...map.entries()].map(([period, v]) => ({
            period,
            income: brl(v.income),
            expense: brl(v.expense),
            balance: brl(v.income - v.expense),
          })),
        };
      }
      case "sales-general": {
        return {
          columns: [
            { key: "code", label: "Venda" },
            { key: "date", label: "Data" },
            { key: "client", label: "Cliente" },
            { key: "method", label: "Pagamento" },
            { key: "total", label: "Total", align: "right" },
          ],
          rows: validSales.map((s: any) => ({
            code: s.sale_code ?? s.id?.slice(0, 8),
            date: dateTimeBR(s.created_at),
            client: clientName(s.client_id),
            method: s.payment_method ?? "—",
            total: brl(s.total_amount),
          })),
        };
      }
      case "sales-full": {
        return {
          columns: [
            { key: "code", label: "Venda" },
            { key: "date", label: "Data" },
            { key: "client", label: "Cliente" },
            { key: "product", label: "Produto" },
            { key: "size", label: "Num." },
            { key: "qty", label: "Qtd", align: "right" },
            { key: "unit", label: "Unitário", align: "right" },
            { key: "total", label: "Total", align: "right" },
          ],
          rows: itemsOfValidSales.map((i: any) => {
            const sale = validSales.find((s: any) => s.id === i.sale_id);
            return {
              code: sale?.sale_code ?? sale?.id?.slice(0, 8) ?? "—",
              date: dateTimeBR(sale?.created_at),
              client: clientName(sale?.client_id),
              product: productName(i.product_id),
              size: i.numeracao ?? "—",
              qty: num(i.quantity, 0),
              unit: brl(i.unit_price),
              total: brl(itemTotal(i)),
            };
          }),
        };
      }
      case "pending": {
        const pend = installments.filter(
          (i: any) => i.status !== "paid" && inRange(i.due_date),
        );
        return {
          columns: [
            { key: "client", label: "Cliente" },
            { key: "installment", label: "Parcela" },
            { key: "due", label: "Vencimento" },
            { key: "amount", label: "Valor", align: "right" },
            { key: "remaining", label: "Em aberto", align: "right" },
            { key: "status", label: "Situação" },
          ],
          rows: pend.map((i: any) => {
            const sale = sales.find((s: any) => s.id === i.sale_id);
            const overdue = new Date(i.due_date) < new Date();
            return {
              client: clientName(sale?.client_id),
              installment: `${i.installment_number}/${sale?.installments_count ?? "—"}`,
              due: dateBR(i.due_date),
              amount: brl(i.amount),
              remaining: brl(i.remaining_amount ?? i.amount - (i.paid_amount ?? 0)),
              status: overdue ? "ATRASADO" : "A VENCER",
            };
          }),
        };
      }
      case "sandal-sizes": {
        const map = new Map<string, number>();
        itemsOfValidSales
          .filter((i: any) => {
            const cat = productCategory(i.product_id).toLowerCase();
            return cat.includes("sandal") || cat.includes("sandál");
          })
          .forEach((i: any) => {
            const k = i.numeracao ?? "Sem numeração";
            map.set(k, (map.get(k) ?? 0) + Number(i.quantity ?? 0));
          });
        return {
          columns: [
            { key: "size", label: "Numeração" },
            { key: "qty", label: "Vendidas", align: "right" },
          ],
          rows: [...map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([size, qty]) => ({ size, qty: num(qty, 0) })),
        };
      }
      case "sizes-available": {
        const map = new Map<string, number>();
        stock.forEach((s: any) => {
          const numeracoes = s.numeracoes;
          if (numeracoes && typeof numeracoes === "object") {
            Object.entries(numeracoes as Record<string, any>).forEach(([size, qty]) => {
              map.set(size, (map.get(size) ?? 0) + Number(qty ?? 0));
            });
          } else {
            map.set(
              "Sem numeração",
              (map.get("Sem numeração") ?? 0) + Number(s.quantidade_disponivel ?? 0),
            );
          }
        });
        return {
          columns: [
            { key: "size", label: "Numeração" },
            { key: "qty", label: "Disponível", align: "right" },
          ],
          rows: [...map.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([size, qty]) => ({ size, qty: num(qty, 0) })),
        };
      }
      case "by-seller": {
        const map = new Map<string, { count: number; total: number }>();
        validSales.forEach((s: any) => {
          const k = sellerName(s.seller_id);
          const acc = map.get(k) ?? { count: 0, total: 0 };
          acc.count += 1;
          acc.total += Number(s.total_amount ?? 0);
          map.set(k, acc);
        });
        return {
          columns: [
            { key: "seller", label: "Vendedor" },
            { key: "count", label: "Vendas", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
            { key: "ticket", label: "Ticket médio", align: "right" },
          ],
          rows: [...map.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([seller, v]) => ({
              seller,
              count: v.count,
              total: brl(v.total),
              ticket: brl(v.count ? v.total / v.count : 0),
            })),
        };
      }
      case "by-category": {
        const map = new Map<string, { qty: number; total: number }>();
        itemsOfValidSales.forEach((i: any) => {
          const k = productCategory(i.product_id);
          const acc = map.get(k) ?? { qty: 0, total: 0 };
          acc.qty += Number(i.quantity ?? 0);
          acc.total += itemTotal(i);
          map.set(k, acc);
        });
        return {
          columns: [
            { key: "category", label: "Categoria" },
            { key: "qty", label: "Itens", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
          ],
          rows: [...map.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([category, v]) => ({
              category,
              qty: num(v.qty, 0),
              total: brl(v.total),
            })),
        };
      }
      case "by-hour": {
        const map = new Map<number, { count: number; total: number }>();
        validSales.forEach((s: any) => {
          const h = new Date(s.created_at).getHours();
          const acc = map.get(h) ?? { count: 0, total: 0 };
          acc.count += 1;
          acc.total += Number(s.total_amount ?? 0);
          map.set(h, acc);
        });
        return {
          columns: [
            { key: "hour", label: "Faixa horária" },
            { key: "count", label: "Vendas", align: "right" },
            { key: "total", label: "Faturamento", align: "right" },
          ],
          rows: [...map.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([h, v]) => ({
              hour: `${String(h).padStart(2, "0")}:00 — ${String(h).padStart(2, "0")}:59`,
              count: v.count,
              total: brl(v.total),
            })),
        };
      }
      case "cancelled": {
        const cancelled = sales.filter(
          (s: any) => ["cancelled", "cancelada", "estornado"].includes(String(s.status || "").toLowerCase()) && inRange(s.created_at),
        );
        return {
          columns: [
            { key: "code", label: "Venda" },
            { key: "date", label: "Data" },
            { key: "client", label: "Cliente" },
            { key: "method", label: "Pagamento" },
            { key: "notes", label: "Observações" },
            { key: "total", label: "Valor", align: "right" },
          ],
          rows: cancelled.map((s: any) => ({
            code: s.sale_code ?? s.id?.slice(0, 8),
            date: dateTimeBR(s.created_at),
            client: clientName(s.client_id),
            method: s.payment_method ?? "—",
            notes: s.notes ?? "—",
            total: brl(s.total_amount),
          })),
        };
      }
      case "stock-general": {
        return {
          columns: [
            { key: "sku", label: "SKU" },
            { key: "product", label: "Produto" },
            { key: "qty", label: "Disponível", align: "right" },
            { key: "min", label: "Mínimo", align: "right" },
            { key: "status", label: "Status" },
          ],
          rows: stock.map((s: any) => {
            const p = products.find((prod: any) => prod.id === (s.produto_id || s.product_id));
            const qty = Number(s.quantidade_disponivel ?? p?.current_stock ?? 0);
            const min = Number(p?.min_stock ?? p?.estoque_minimo ?? 0);
            return {
              sku: p?.sku ?? "—",
              product: p?.name ?? "—",
              qty: num(qty, 0),
              min: num(min, 0),
              status: qty <= min ? "ABAIXO DO MÍNIMO" : "OK",
            };
          }),
        };
      }
      case "production-general": {
        return {
          columns: [
            { key: "code", label: "Código" },
            { key: "product", label: "Produto" },
            { key: "qty", label: "Qtd", align: "right" },
            { key: "status", label: "Status" },
            { key: "start", label: "Início" },
            { key: "end", label: "Fim" },
          ],
          rows: productionOrders.map((o: any) => ({
            code: o.codigo_ordem ?? "—",
            product: o.produto_nome ?? "—",
            qty: num(o.quantidade, 0),
            status: o.status?.toUpperCase() ?? "PENDENTE",
            start: dateBR(o.started_at),
            end: dateBR(o.completed_at),
          })),
        };
      }
      case "materials-general": {
        return {
          columns: [
            { key: "name", label: "Material" },
            { key: "unit", label: "Unidade" },
            { key: "price", label: "Preço", align: "right" },
            { key: "category", label: "Categoria" },
          ],
          rows: materials.map((m: any) => ({
            name: m.name ?? "—",
            unit: m.unit ?? "—",
            price: brl(m.cost_price ?? m.preco_unitario),
            category: m.type ?? m.category ?? "—",
          })),
        };
      }
      case "suppliers-general": {
        return {
          columns: [
            { key: "name", label: "Fornecedor" },
            { key: "contact", label: "Contato" },
            { key: "email", label: "E-mail" },
            { key: "category", label: "Ramo" },
          ],
          rows: suppliers.map((s: any) => ({
            name: s.name ?? "—",
            contact: s.contact ?? s.phone ?? "—",
            email: s.email ?? "—",
            category: s.category ?? "—",
          })),
        };
      }
      case "products-general": {
        return {
          columns: [
            { key: "sku", label: "SKU" },
            { key: "name", label: "Produto" },
            { key: "category", label: "Categoria" },
            { key: "retail", label: "Varejo", align: "right" },
            { key: "wholesale", label: "Atacado", align: "right" },
          ],
          rows: products.map((p: any) => ({
            sku: p.sku ?? "—",
            name: p.name ?? "—",
            category: p.category ?? "—",
            retail: brl(p.sale_price ?? p.price_retail),
            wholesale: brl(p.wholesale_price ?? p.price_wholesale),
          })),
        };
      }
      default:
        return { columns: [], rows: [] };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  ]);

  const handleExport = () => {
    if (!result.rows.length) {
      toast.error("Nada para exportar.");
      return;
    }
    const blob = new Blob([`\uFEFF${toCsv(result)}`], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${selected}-${range.start}-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Relatório exportado.");
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Gere relatórios detalhados de vendas e finanças
        </p>
      </div>

      <Card className="rounded-3xl border-border/50">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Selecione o tipo de relatório
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {REPORTS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r.id);
                    setGenerated(null);
                  }}
                  className={cn(
                    "flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all",
                    selected === r.id
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border/50 bg-muted/20 hover:border-primary/40",
                  )}
                >
                  <r.icon className="size-5" />
                  <span className="text-[10px] font-bold uppercase leading-tight">
                    {r.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!current.noFilter && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Data início
                  </p>
                  <Input
                    type="date"
                    value={range.start}
                    onChange={(e) => setRange({ ...range, start: e.target.value })}
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Data fim
                  </p>
                  <Input
                    type="date"
                    value={range.end}
                    onChange={(e) => setRange({ ...range, end: e.target.value })}
                    className="h-12 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setRange({ start: "", end: "" })}
                className="h-10 w-full rounded-xl text-xs font-bold uppercase"
              >
                Limpar datas
              </Button>
            </>
          )}

          {current.grouping && (
            <div className="space-y-2 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Agrupamento
              </p>
              <Select value={grouping} onValueChange={setGrouping}>
                <SelectTrigger className="h-12 rounded-xl bg-background font-semibold">
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

          <Button
            onClick={() => {
              setGenerated(selected);
              toast.success(`Relatório "${current.label}" gerado.`);
            }}
            disabled={isLoading}
            className="h-12 w-full gap-2 rounded-xl font-black uppercase"
          >
            <FileBarChart className="size-5" /> Gerar relatório
          </Button>
        </CardContent>
      </Card>

      {generated && (
        <Card className="rounded-3xl border-border/50">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-5 print:hidden">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-black">{current.label}</h2>
                <Badge variant="outline" className="font-bold">
                  {result.rows.length} registros
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-2 rounded-xl font-bold"
                >
                  <FileDown className="size-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-2 rounded-xl font-bold"
                >
                  <Printer className="size-4" /> Imprimir
                </Button>
              </div>
            </div>

            <ReportLayout 
              id="printable-report"
              title={current.label}
              startDate={range.start}
              endDate={range.end}
              storeInfo={storeInfo}
              columns={result.columns}
              rows={result.rows}
            />
          </CardContent>
        </Card>
      )}

    </div>
  );
}
