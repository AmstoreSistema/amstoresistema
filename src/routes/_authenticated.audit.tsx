import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useRows } from "@/lib/data";
import { 
  FileText, 
  Eye, 
  Calendar, 
  User, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  Printer, 
  FileDown, 
  AlertTriangle, 
  Loader2,
  ShoppingCart,
  Users,
  Package,
  Warehouse,
  Layers,
  ShoppingBag,
  Truck,
  ArrowLeftRight,
  Wallet,
  Hammer,
  Gift,
  Coins,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Tag
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ReportLayout } from "@/components/report-layout";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/settings.functions";
import { getAuditYearsSummary, purgeAuditLogsByYear } from "@/lib/audit-cleanup.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Histórico de Auditoria — Amstore Gestão" },
      { name: "description", content: "Rastreamento detalhado de todas as alterações realizadas no sistema Amstore." },
      { property: "og:title", content: "Histórico de Auditoria — Amstore Gestão" },
      { property: "og:description", content: "Rastreamento detalhado de todas as alterações realizadas no sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

const ENTITY_LABELS: Record<string, string> = {
  sales: "Venda",
  sale_items: "Item de Venda",
  sale_installments: "Parcela",
  clients: "Cliente",
  products: "Produto",
  materials: "Material",
  stock_products: "Estoque",
  purchases: "Compra",
  suppliers: "Fornecedor",
  transactions: "Transação",
  financial_accounts: "Conta",
  production_orders: "Ordem de Produção",
  promotions: "Promoção",
  cashback_config: "Cashback",
  user_profiles: "Usuário",
};

function entityLabel(entity: string) {
  return ENTITY_LABELS[entity] ?? entity;
}

type ActionKind = "criacao" | "edicao" | "exclusao" | "outro";

function actionKind(action: string): ActionKind {
  const a = (action || "").toLowerCase();
  if (a.includes("criar") || a.includes("criacao") || a.includes("criação") || a.includes("insert")) return "criacao";
  if (a.includes("atualizar") || a.includes("edicao") || a.includes("edição") || a.includes("update")) return "edicao";
  if (a.includes("excluir") || a.includes("exclusao") || a.includes("exclusão") || a.includes("delete")) return "exclusao";
  return "outro";
}

const ACTION_META: Record<ActionKind, { label: string; className: string; dataTitle: string }> = {
  criacao: {
    label: "Criação",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    dataTitle: "Dados Cadastrados",
  },
  edicao: {
    label: "Edição",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    dataTitle: "Campos Alterados",
  },
  exclusao: {
    label: "Exclusão / Estorno",
    className: "bg-rose-500/10 text-rose-600 border-rose-500/30",
    dataTitle: "Dados Removidos",
  },
  outro: {
    label: "Registro",
    className: "bg-muted text-muted-foreground border-border",
    dataTitle: "Informações da Operação",
  },
};

const ENTITY_ICONS: Record<string, any> = {
  sales: ShoppingCart,
  sale_items: ShoppingCart,
  sale_installments: ShoppingCart,
  clients: Users,
  products: Package,
  materials: Layers,
  stock_products: Warehouse,
  purchases: ShoppingBag,
  suppliers: Truck,
  transactions: ArrowLeftRight,
  financial_accounts: Wallet,
  production_orders: Hammer,
  promotions: Gift,
  cashback_config: Coins,
  user_profiles: UserCheck,
  audit_log: ShieldCheck,
};

const ENTITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  sales: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  clients: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  products: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/30" },
  stock_products: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  transactions: { bg: "bg-indigo-500/10", text: "text-indigo-600", border: "border-indigo-500/30" },
  financial_accounts: { bg: "bg-cyan-500/10", text: "text-cyan-600", border: "border-cyan-500/30" },
};

export interface AuditLookupContext {
  clientsMap: Map<string, any>;
  productsMap: Map<string, any>;
  salesMap: Map<string, any>;
  suppliersMap?: Map<string, any>;
  materialsMap?: Map<string, any>;
}

interface AuditItemDetails {
  resumo: string;
  targetName?: string;
  json: any | null;
  text: string | null;
  isVenda: boolean;
  isCliente: boolean;
  isProduto: boolean;
  venda?: {
    codigo?: string;
    cliente?: string;
    total?: number;
    forma_pagamento?: string;
    desconto?: number;
    itens?: Array<{
      produto: string;
      quantidade: number;
      preco_unitario: number;
      numeracao?: string | null;
      desconto?: number;
      subtotal: number;
    }>;
  };
  clientInfo?: {
    id: string;
    name: string;
    phone?: string;
    document?: string;
    email?: string;
    client_type?: string;
    city?: string;
    state?: string;
    address?: string;
    notes?: string;
  };
  productInfo?: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    retail_price?: number;
    cost_price?: number;
    wholesale_price?: number;
  };
  dadosGerais?: Record<string, any>;
}

function parseAuditDetails(
  details: string | null,
  entity: string,
  action: string,
  entityId: string | null,
  lookups?: AuditLookupContext
): AuditItemDetails {
  const kind = actionKind(action);
  const entLabel = entityLabel(entity);
  const isVenda = entity === "sales";
  const isCliente = entity === "clients";
  const isProduto = entity === "products" || entity === "stock_products";

  let targetName: string | undefined = undefined;
  let clientInfo: AuditItemDetails["clientInfo"] = undefined;
  let productInfo: AuditItemDetails["productInfo"] = undefined;

  // 1. Resolução pelo ID da entidade nas tabelas de referência
  if (entityId && lookups) {
    if (isCliente) {
      const c = lookups.clientsMap?.get(entityId);
      if (c) {
        targetName = c.name;
        clientInfo = {
          id: c.id,
          name: c.name,
          phone: c.phone,
          document: c.document_cpf || c.document,
          email: c.email,
          client_type: c.client_type,
          city: c.city,
          state: c.state,
          address: c.address,
          notes: c.notes,
        };
      }
    } else if (isProduto) {
      const p = lookups.productsMap?.get(entityId);
      if (p) {
        targetName = p.name;
        productInfo = {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          retail_price: p.retail_price,
          cost_price: p.cost_price,
          wholesale_price: p.wholesale_price,
        };
      }
    } else if (entity === "suppliers") {
      const sup = lookups.suppliersMap?.get(entityId);
      if (sup) targetName = sup.name;
    } else if (entity === "materials") {
      const mat = lookups.materialsMap?.get(entityId);
      if (mat) targetName = mat.name;
    } else if (isVenda) {
      const s = lookups.salesMap?.get(entityId);
      if (s) {
        const clientName = s.client_id ? lookups.clientsMap?.get(s.client_id)?.name : null;
        targetName = s.sale_code ? `${s.sale_code}${clientName ? ` (${clientName})` : ""}` : undefined;
      }
    }
  }

  // Se não houver detalhes gravados
  if (!details) {
    const nomeRef = targetName ? `: "${targetName}"` : "";
    return {
      resumo: `${ACTION_META[kind].label} em ${entLabel}${nomeRef}`,
      targetName,
      clientInfo,
      productInfo,
      json: null,
      text: null,
      isVenda,
      isCliente,
      isProduto,
    };
  }

  const trimmed = details.trim();
  let json: any = null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      json = JSON.parse(trimmed);
    } catch {
      json = null;
    }
  }

  if (json && typeof json === "object") {
    const isVendaExplicit = isVenda || json.tipo === "VENDA_REALIZADA" || json.tipo === "VENDA_ESTORNADA";

    // Tenta obter nome embutido no JSON caso não tenha vindo do mapa
    if (!targetName) {
      targetName = json.nome || json.name || json.dados?.name || json.dados?.nome || json.campos?.name || json.campos?.nome;
    }

    let resumo = json.resumo;
    if (!resumo || resumo.includes("(ID:")) {
      if (isVendaExplicit) {
        resumo = `Venda #${json.codigo_venda || entityId?.slice(0, 8) || "—"} (${json.cliente || targetName || "Consumidor"}) — Total: ${brl(json.total || 0)}`;
      } else if (targetName) {
        resumo = `${ACTION_META[kind].label} de ${entLabel}: "${targetName}"`;
      } else {
        resumo = `${ACTION_META[kind].label} de ${entLabel}`;
      }
    }

    return {
      resumo,
      targetName,
      clientInfo,
      productInfo,
      json,
      text: null,
      isVenda: isVendaExplicit,
      isCliente,
      isProduto,
      venda: isVendaExplicit ? {
        codigo: json.codigo_venda,
        cliente: json.cliente || (clientInfo?.name),
        total: json.total,
        forma_pagamento: json.forma_pagamento,
        desconto: json.desconto,
        itens: Array.isArray(json.itens) ? json.itens : undefined,
      } : undefined,
      dadosGerais: json.dados || json.campos || json.valores || json.alteracoes || json,
    };
  }

  // Texto legado (ex: "cliente criado", "Estoque ajustado para 10", "Preços e dados editados...")
  let resumo = details;
  const lower = details.toLowerCase();

  if (targetName) {
    if (lower.includes("criado") || kind === "criacao") {
      resumo = `Cadastro de ${entLabel}: "${targetName}"`;
    } else if (lower.includes("atualizado") || kind === "edicao") {
      if (lower.includes("estoque") || lower.includes("preço") || lower.includes("dados") || lower.includes("ficha")) {
        resumo = `Alteração em ${entLabel} "${targetName}": ${details}`;
      } else {
        resumo = `Alteração em ${entLabel}: "${targetName}"`;
      }
    } else if (lower.includes("excluído") || lower.includes("excluido") || kind === "exclusao") {
      resumo = `Exclusão de ${entLabel}: "${targetName}"`;
    } else {
      resumo = `${entLabel} "${targetName}": ${details}`;
    }
  } else {
    // Se o nome não foi encontrado no banco (ex: cliente/produto deletado)
    if (lower.includes("criado") || kind === "criacao") {
      resumo = `Cadastro de ${entLabel}`;
    } else if (lower.includes("atualizado") || kind === "edicao") {
      resumo = lower.length > 20 ? details : `Alteração em ${entLabel}`;
    } else if (lower.includes("excluído") || lower.includes("excluido") || kind === "exclusao") {
      resumo = `Exclusão de ${entLabel}`;
    }
  }

  return {
    resumo,
    targetName,
    clientInfo,
    productInfo,
    json: null,
    text: details,
    isVenda,
    isCliente,
    isProduto,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDateTimeFull(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR")}`;
}

function AuditPage() {
  const { data: logs = [], isLoading } = useRows<any>("audit_log", {
    order: { column: "created_at", ascending: false },
    limit: 1000,
  });
  const { data: profiles = [] } = useRows<any>("user_profiles");
  const { data: clients = [] } = useRows<any>("clients");
  const { data: products = [] } = useRows<any>("products");
  const { data: sales = [] } = useRows<any>("sales");
  const { data: suppliers = [] } = useRows<any>("suppliers");
  const { data: materials = [] } = useRows<any>("materials");

  const [search, setSearch] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("all");
  const [actionFilter, setActionFilter] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<"cards" | "report">("cards");
  const [selected, setSelected] = React.useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<{
    name?: string;
    cnpj?: string;
    contact?: string;
    logo?: string;
  }>({});

  const [cleanupOpen, setCleanupOpen] = React.useState(false);
  const qc = useQueryClient();
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

  const lookups = React.useMemo<AuditLookupContext>(() => {
    const clientsMap = new Map<string, any>();
    clients.forEach((c: any) => { if (c.id) clientsMap.set(c.id, c); });

    const productsMap = new Map<string, any>();
    products.forEach((p: any) => { if (p.id) productsMap.set(p.id, p); });

    const salesMap = new Map<string, any>();
    sales.forEach((s: any) => { if (s.id) salesMap.set(s.id, s); });

    const suppliersMap = new Map<string, any>();
    suppliers.forEach((s: any) => { if (s.id) suppliersMap.set(s.id, s); });

    const materialsMap = new Map<string, any>();
    materials.forEach((m: any) => { if (m.id) materialsMap.set(m.id, m); });

    return { clientsMap, productsMap, salesMap, suppliersMap, materialsMap };
  }, [clients, products, sales, suppliers, materials]);

  const displayName = React.useCallback(
    (email: string | null) => {
      if (!email) return "Sistema";
      const profile = profiles.find((p: any) => (p.email || "").toLowerCase() === email.toLowerCase());
      return profile?.display_name || email.split("@")[0];
    },
    [profiles],
  );

  const stats = React.useMemo(() => {
    let criacoes = 0;
    let edicoes = 0;
    let exclusoes = 0;
    for (const log of logs) {
      const kind = actionKind(log.action);
      if (kind === "criacao") criacoes++;
      else if (kind === "edicao") edicoes++;
      else if (kind === "exclusao") exclusoes++;
    }
    return { total: logs.length, criacoes, edicoes, exclusoes };
  }, [logs]);

  const entities = React.useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l: any) => l.entity && set.add(l.entity));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log: any) => {
      if (entityFilter !== "all" && log.entity !== entityFilter) return false;
      if (actionFilter !== "all" && actionKind(log.action) !== actionFilter) return false;
      if (!term) return true;
      const parsed = parseAuditDetails(log.details, log.entity, log.action, log.entity_id, lookups);
      const haystack = [
        log.entity,
        entityLabel(log.entity),
        log.entity_id,
        log.details,
        parsed.resumo,
        parsed.targetName,
        log.user_email,
        displayName(log.user_email),
        log.action,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [logs, search, entityFilter, actionFilter, displayName, lookups]);

  const reportData = React.useMemo(() => {
    const columns = [
      { key: "date", label: "Data/Hora" },
      { key: "user", label: "Usuário" },
      { key: "action", label: "Ação" },
      { key: "entity", label: "Entidade" },
      { key: "summary", label: "O que foi feito" },
      { key: "entity_id", label: "Ref / ID" },
    ];

    const rows = filtered.map((log: any) => {
      const parsed = parseAuditDetails(log.details, log.entity, log.action, log.entity_id, lookups);
      return {
        date: formatDateTime(log.created_at),
        user: displayName(log.user_email),
        action: actionKind(log.action).toUpperCase(),
        entity: entityLabel(log.entity),
        summary: parsed.resumo,
        entity_id: parsed.targetName ? `${parsed.targetName} (#${log.entity_id?.slice(0, 8)})` : (log.entity_id || "—"),
      };
    });

    return { columns, rows };
  }, [filtered, displayName, lookups]);

  const handleExportCsv = () => {
    const { columns, rows } = reportData;
    const header = columns.map(c => `"${c.label}"`).join(";");
    const body = rows.map(r => columns.map(c => `"${String((r as any)[c.key] ?? "")}"`).join(";")).join("\n");
    const csv = `\uFEFF${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const statCards = [
    { label: "Total de Registros", value: stats.total, icon: FileText, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Criações", value: stats.criacoes, icon: Plus, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Edições", value: stats.edicoes, icon: Pencil, tone: "bg-blue-50 text-blue-600" },
    { label: "Exclusões", value: stats.exclusoes, icon: Trash2, tone: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <FileText className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Histórico de Auditoria</h1>
            <p className="text-sm text-muted-foreground">Rastreamento detalhado de todas as alterações no sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border/60 p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="h-8 rounded-lg text-xs font-bold"
            >
              Cards
            </Button>
            <Button
              variant={viewMode === "report" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("report")}
              className="h-8 rounded-lg text-xs font-bold"
            >
              Relatório
            </Button>
          </div>
          <Button
            variant="outline"
            className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-2 font-bold"
            onClick={() => setCleanupOpen(true)}
          >
            <Trash2 className="size-4" /> Limpar Antigos
          </Button>
          <Button variant="outline" className="rounded-xl border-border/40 hover:bg-muted/50 gap-2 font-bold" onClick={handleExportCsv}>
            <FileDown className="size-4" /> CSV
          </Button>
          <Button variant="outline" className="rounded-xl border-border/40 hover:bg-muted/50 gap-2 font-bold" onClick={() => window.print()}>
            <Printer className="size-4" /> IMPRIMIR
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {statCards.map((card) => (
          <Card key={card.label} className="border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("size-10 rounded-xl flex items-center justify-center", card.tone)}>
                <card.icon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-black leading-tight">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, usuário ou email..."
            className="pl-9 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="h-11 lg:w-56">
            <SelectValue placeholder="Todas Entidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Entidades</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>
                {entityLabel(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-11 lg:w-48">
            <SelectValue placeholder="Todas Ações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Ações</SelectItem>
            <SelectItem value="criacao">Criações</SelectItem>
            <SelectItem value="edicao">Edições</SelectItem>
            <SelectItem value="exclusao">Exclusões</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewMode === "cards" ? (
        <div className="space-y-3 print:hidden">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando registros...</p>}
          {!isLoading && filtered.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Nenhum registro de auditoria encontrado.
              </CardContent>
            </Card>
          )}
          {filtered.map((log: any) => {
            const kind = actionKind(log.action);
            const meta = ACTION_META[kind];
            const parsed = parseAuditDetails(log.details, log.entity, log.action, log.entity_id, lookups);
            const IconComponent = ENTITY_ICONS[log.entity] || FileText;
            const style = ENTITY_STYLES[log.entity] || { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" };

            return (
              <Card key={log.id} className="border-border/60 shadow-sm hover:border-border transition-all">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3.5 sm:gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Ícone da Entidade */}
                      <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 border", style.bg, style.text, style.border)}>
                        <IconComponent className="size-5" />
                      </div>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        {/* Linha de Badges e Metadados */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("font-bold text-[11px]", meta.className)}>
                            {meta.label}
                          </Badge>
                          <Badge variant="outline" className="font-semibold text-[11px]">
                            {entityLabel(log.entity)}
                          </Badge>
                          {log.entity_id && (
                            <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                              #{log.entity_id.slice(0, 8)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto sm:ml-0 font-medium">
                            <Clock className="size-3 text-muted-foreground/70" />
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>

                        {/* Título Principal Humano e Claro */}
                        <p className="font-bold text-sm text-foreground leading-snug">
                          {parsed.resumo}
                        </p>

                        {/* Linha com Responsável e Tags Rápidas */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                          <span className="flex items-center gap-1.5 font-medium">
                            <User className="size-3.5 text-gold" />
                            <span>Operador:</span>
                            <strong className="text-foreground">{displayName(log.user_email)}</strong>
                            {log.user_email && (
                              <span className="text-[10px] text-muted-foreground/80">({log.user_email})</span>
                            )}
                          </span>

                          {parsed.venda?.forma_pagamento && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                              {parsed.venda.forma_pagamento} · {brl(parsed.venda.total || 0)}
                            </span>
                          )}

                          {parsed.venda?.itens && parsed.venda.itens.length > 0 && (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {parsed.venda.itens.length} {parsed.venda.itens.length === 1 ? "produto vendido" : "produtos vendidos"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm"
                      className="gap-2 shrink-0 rounded-xl font-bold hover:bg-muted/50 h-9" 
                      onClick={() => setSelected(log)}
                    >
                      <Eye className="size-4 text-gold" /> Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="print:hidden">
          <ReportLayout 
            id="audit-report-screen"
            title="Relatório de Auditoria"
            startDate={filtered.length > 0 ? filtered[filtered.length - 1].created_at : undefined}
            endDate={filtered.length > 0 ? filtered[0].created_at : undefined}
            storeInfo={storeInfo}
            columns={reportData.columns}
            rows={reportData.rows}
          />
        </div>
      )}

      <div className="hidden print:block">
        <ReportLayout 
          id="audit-report"
          title="Relatório de Auditoria"
          startDate={filtered.length > 0 ? filtered[filtered.length - 1].created_at : undefined}
          endDate={filtered.length > 0 ? filtered[0].created_at : undefined}
          storeInfo={storeInfo}
          columns={reportData.columns}
          rows={reportData.rows}
        />
      </div>

      <AuditDetailsModal log={selected} onClose={() => setSelected(null)} displayName={displayName} lookups={lookups} />
      <AuditCleanupModal
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["audit_log"] });
        }}
      />
    </div>
  );
}

function AuditDetailsModal({
  log,
  onClose,
  displayName,
  lookups,
}: {
  log: any | null;
  onClose: () => void;
  displayName: (email: string | null) => string;
  lookups?: AuditLookupContext;
}) {
  const [showRawJson, setShowRawJson] = useState(false);
  if (!log) return null;

  const kind = actionKind(log.action);
  const meta = ACTION_META[kind];
  const parsed = parseAuditDetails(log.details, log.entity, log.action, log.entity_id, lookups);
  const IconComponent = ENTITY_ICONS[log.entity] || FileText;
  const style = ENTITY_STYLES[log.entity] || { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" };

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="p-5 pb-4 border-b bg-card/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className={cn("size-10 rounded-xl flex items-center justify-center border shrink-0", style.bg, style.text, style.border)}>
              <IconComponent className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-black leading-snug">
                {parsed.resumo}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Rastreamento e auditoria detalhada de alteração no sistema
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-5 space-y-5">
          {/* Card Resumo do Registro */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/50 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Entidade</p>
              <div className="mt-0.5">
                <Badge variant="outline" className="font-semibold text-[11px]">
                  {entityLabel(log.entity)}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Ação</p>
              <div className="mt-0.5">
                <Badge variant="outline" className={cn("font-bold text-[11px]", meta.className)}>
                  {meta.label}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Operador</p>
              <p className="text-xs font-bold truncate mt-0.5" title={log.user_email}>
                {displayName(log.user_email)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Data e Horário</p>
              <p className="text-xs font-mono font-bold mt-0.5">
                {formatDateTimeFull(log.created_at)}
              </p>
            </div>
          </div>

          {/* Seção de Cliente Identificado */}
          {parsed.clientInfo && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 text-foreground">
                  <Users className="size-4 text-blue-500" /> Identificação do Cliente
                </h4>
                <Badge variant="outline" className="font-mono text-[11px] text-blue-600 bg-blue-50 border-blue-200">
                  #{log.entity_id?.slice(0, 8)}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-card rounded-xl border sm:col-span-2">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Nome do Cliente</span>
                  <p className="text-sm font-bold text-foreground mt-0.5">{parsed.clientInfo.name}</p>
                </div>
                {parsed.clientInfo.phone && (
                  <div className="p-3 bg-card rounded-xl border">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Telefone / WhatsApp</span>
                    <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{parsed.clientInfo.phone}</p>
                  </div>
                )}
                {parsed.clientInfo.document && (
                  <div className="p-3 bg-card rounded-xl border">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">CPF / Documento</span>
                    <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{parsed.clientInfo.document}</p>
                  </div>
                )}
                {parsed.clientInfo.client_type && (
                  <div className="p-3 bg-card rounded-xl border">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Tipo de Cadastro</span>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{parsed.clientInfo.client_type}</p>
                  </div>
                )}
                {(parsed.clientInfo.city || parsed.clientInfo.state) && (
                  <div className="p-3 bg-card rounded-xl border">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Cidade / UF</span>
                    <p className="text-xs font-semibold text-foreground mt-0.5">
                      {[parsed.clientInfo.city, parsed.clientInfo.state].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seção de Produto Identificado */}
          {parsed.productInfo && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 text-foreground">
                  <Package className="size-4 text-purple-500" /> Identificação do Produto
                </h4>
                {parsed.productInfo.sku && (
                  <Badge variant="outline" className="font-mono text-[11px] text-purple-600 bg-purple-50 border-purple-200">
                    Ref: {parsed.productInfo.sku}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-card rounded-xl border sm:col-span-2">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Produto</span>
                  <p className="text-sm font-bold text-foreground mt-0.5">{parsed.productInfo.name}</p>
                </div>
                {parsed.productInfo.category && (
                  <div className="p-3 bg-card rounded-xl border">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Categoria</span>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{parsed.productInfo.category}</p>
                  </div>
                )}
                {parsed.productInfo.retail_price !== undefined && (
                  <div className="p-3 bg-card rounded-xl border">
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Preço de Venda</span>
                    <p className="text-xs font-mono font-bold text-foreground mt-0.5">{brl(parsed.productInfo.retail_price)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seção de Venda */}
          {parsed.isVenda && parsed.venda && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-display font-black text-xs uppercase tracking-wider flex items-center gap-2 text-foreground">
                  <ShoppingCart className="size-4 text-gold" /> Detalhes da Venda
                </h4>
                <Badge variant="outline" className="font-mono font-bold text-gold border-gold/30 bg-gold/5">
                  {parsed.venda.codigo ? `#${parsed.venda.codigo}` : `#${log.entity_id?.slice(0, 8)}`}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-card rounded-xl border">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Cliente</span>
                  <p className="text-xs font-bold truncate mt-0.5">{parsed.venda.cliente || "Consumidor Balcão"}</p>
                </div>
                <div className="p-3 bg-card rounded-xl border">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Forma de Pagamento</span>
                  <p className="text-xs font-bold truncate mt-0.5">{parsed.venda.forma_pagamento || "—"}</p>
                </div>
                <div className="p-3 bg-card rounded-xl border col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Total da Venda</span>
                  <p className="text-xs font-mono font-black text-emerald-600 mt-0.5">
                    {brl(parsed.venda.total || 0)}
                  </p>
                </div>
              </div>

              {/* Tabela de Itens Vendidos */}
              {parsed.venda.itens && parsed.venda.itens.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Produtos Vendidos ({parsed.venda.itens.length}):
                  </p>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase font-bold border-b text-[10px]">
                        <tr>
                          <th className="py-2 px-3 text-left">Produto</th>
                          <th className="py-2 px-2 text-center w-14">Tam/Nº</th>
                          <th className="py-2 px-2 text-center w-12">Qtd</th>
                          <th className="py-2 px-3 text-right w-20">Unitário</th>
                          <th className="py-2 px-3 text-right w-20">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {parsed.venda.itens.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-2 px-3 font-semibold text-foreground">{it.produto}</td>
                            <td className="py-2 px-2 text-center text-muted-foreground font-mono">{it.numeracao || "—"}</td>
                            <td className="py-2 px-2 text-center font-bold">{it.quantidade}</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{brl(it.preco_unitario)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{brl(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seção de Dados Registrados / Alterações */}
          {(!parsed.isVenda || !parsed.venda) && parsed.dadosGerais && typeof parsed.dadosGerais === "object" && (
            <div className="space-y-2.5 pt-2">
              <h4 className="font-display font-black text-xs uppercase tracking-wider text-muted-foreground">
                Dados Registrados da Operação
              </h4>
              <div className="rounded-xl border divide-y overflow-hidden text-xs">
                {Object.entries(parsed.dadosGerais)
                  .filter(([k]) => !["resumo", "tipo", "itens", "alteracoes"].includes(k))
                  .map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 hover:bg-muted/20 gap-1">
                      <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">{key}:</span>
                      <span className="font-semibold text-foreground text-right break-all">
                        {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Seção de Texto explicativo */}
          {parsed.text && (
            <div className="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground italic">
              {parsed.text}
            </div>
          )}

          {/* Seção 4: Visualização Técnica Retrátil (JSON puro) */}
          {parsed.json && (
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full flex items-center justify-between text-xs text-muted-foreground h-8 font-bold"
                onClick={() => setShowRawJson(!showRawJson)}
              >
                <span>Visualização Técnica do Registro (JSON)</span>
                {showRawJson ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </Button>
              {showRawJson && (
                <div className="mt-2 p-3 bg-muted/40 rounded-xl border">
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                    {JSON.stringify(parsed.json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function AuditCleanupModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear - 1);
  const [yearsSummary, setYearsSummary] = useState<{ year: number; count: number }[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const fetchSummary = useServerFn(getAuditYearsSummary);
  const executePurge = useServerFn(purgeAuditLogsByYear);

  useEffect(() => {
    if (open) {
      setLoadingSummary(true);
      fetchSummary()
        .then((data) => {
          setYearsSummary(data);
          const priorWithLogs = data.filter((item) => item.year < currentYear && item.count > 0);
          if (priorWithLogs.length > 0 && priorWithLogs[0]) {
            setSelectedYear(priorWithLogs[0].year);
          } else if (data.length > 0 && data[0]) {
            setSelectedYear(data[0].year);
          }
        })
        .catch((err) => {
          console.error("Erro ao carregar resumo de anos:", err);
          toast.error("Falha ao consultar histórico de auditoria por ano.");
        })
        .finally(() => setLoadingSummary(false));
    }
  }, [open, currentYear, fetchSummary]);

  const selectedInfo = yearsSummary.find((item) => item.year === selectedYear);
  const recordCount = selectedInfo ? selectedInfo.count : 0;

  const handlePurge = async () => {
    if (recordCount === 0) {
      toast.info(`Não há registros de auditoria no ano de ${selectedYear} para apagar.`);
      return;
    }

    const confirmMsg = `Deseja realmente apagar os ${recordCount} registros de auditoria do ano ${selectedYear}? Esta ação não pode ser desfeita.`;
    if (!window.confirm(confirmMsg)) return;

    setIsPurging(true);
    try {
      const res = await executePurge({ data: { year: selectedYear } });
      toast.success(`${res.removedCount} registros de auditoria de ${selectedYear} foram removidos com sucesso!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro na limpeza de auditoria:", err);
      toast.error(err.message || "Erro ao excluir registros de auditoria.");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-rose-600">
            <Trash2 className="size-5" />
            Limpeza de Auditoria Antiga
          </DialogTitle>
          <DialogDescription>
            Exclua registros de auditoria antigos para otimizar o banco de dados e manter o sistema leve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Selecione o ano para apagar:
            </label>
            {loadingSummary ? (
              <div className="flex items-center justify-center p-4 border rounded-xl bg-muted/20 text-muted-foreground text-xs gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Carregando histórico por ano...
              </div>
            ) : (
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="h-11 rounded-xl font-bold">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {yearsSummary.map((item) => (
                    <SelectItem key={item.year} value={String(item.year)} className="font-medium">
                      Ano {item.year} — {item.count} {item.count === 1 ? "registro" : "registros"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 space-y-1.5 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <span>O que será apagado:</span>
            </div>
            <p>
              Todos os registros de auditoria gerados entre <strong>01/01/{selectedYear}</strong> e <strong>31/12/{selectedYear}</strong> ({recordCount} {recordCount === 1 ? "registro encontrado" : "registros encontrados"}).
            </p>
            <p className="text-[11px] text-amber-700/90 pt-1 border-t border-amber-200/60">
              🔒 <strong>Seus dados continuam seguros:</strong> Vendas, clientes, financeiro, estoque e produtos <strong>NÃO</strong> são apagados. Apenas o histórico de rastreamento de alterações do ano escolhido é limpo.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            className="rounded-xl font-bold"
            onClick={() => onOpenChange(false)}
            disabled={isPurging}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="rounded-xl font-bold gap-2 bg-rose-600 hover:bg-rose-700"
            onClick={handlePurge}
            disabled={isPurging || loadingSummary || recordCount === 0}
          >
            {isPurging ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Apagando...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Apagar Auditoria de {selectedYear}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

