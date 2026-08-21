import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useRows } from "@/lib/data";
import { FileText, Eye, Calendar, User, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
    label: "Criacao",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dataTitle: "Dados Criados",
  },
  edicao: {
    label: "Edicao",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dataTitle: "Dados Alterados",
  },
  exclusao: {
    label: "Exclusao",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    dataTitle: "Dados Excluídos",
  },
  outro: {
    label: "Registro",
    className: "bg-muted text-muted-foreground border-border",
    dataTitle: "Dados do Registro",
  },
};

function parseDetails(details: string | null): { json: any | null; text: string | null } {
  if (!details) return { json: null, text: null };
  const trimmed = details.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { json: JSON.parse(trimmed), text: null };
    } catch {
      return { json: null, text: details };
    }
  }
  return { json: null, text: details };
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

  const [search, setSearch] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("all");
  const [actionFilter, setActionFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<any>(null);

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
      const haystack = [
        log.entity,
        entityLabel(log.entity),
        log.entity_id,
        log.details,
        log.user_email,
        displayName(log.user_email),
        log.action,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [logs, search, entityFilter, actionFilter, displayName]);

  const statCards = [
    { label: "Total de Registros", value: stats.total, icon: FileText, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Criações", value: stats.criacoes, icon: Plus, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Edições", value: stats.edicoes, icon: Pencil, tone: "bg-blue-50 text-blue-600" },
    { label: "Exclusões", value: stats.exclusoes, icon: Trash2, tone: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <FileText className="size-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Histórico de Auditoria</h1>
          <p className="text-sm text-muted-foreground">Rastreamento detalhado de todas as alterações no sistema</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="flex flex-col gap-3 lg:flex-row">
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

      <div className="space-y-3">
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
          const parsed = parseDetails(log.details);
          const changedFields = parsed.json && !Array.isArray(parsed.json) ? Object.keys(parsed.json).length : null;
          return (
            <Card key={log.id} className="border-border/60 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("font-semibold", meta.className)}>
                        {meta.label}
                      </Badge>
                      <Badge variant="outline" className="font-medium">
                        {entityLabel(log.entity)}
                      </Badge>
                      <span className="font-black tracking-tight">{log.entity_id || "—"}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-10 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="size-4" />
                        {displayName(log.user_email)}
                        {log.user_email ? ` (${log.user_email})` : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-4" />
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    {kind === "edicao" && changedFields !== null && (
                      <p className="text-sm font-medium">{changedFields} campo(s) alterado(s)</p>
                    )}
                    {parsed.text && <p className="text-sm italic text-muted-foreground">{parsed.text}</p>}
                  </div>
                  <Button variant="outline" className="gap-2 shrink-0" onClick={() => setSelected(log)}>
                    <Eye className="size-4" /> Ver Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AuditDetailsModal log={selected} onClose={() => setSelected(null)} displayName={displayName} />
    </div>
  );
}

function AuditDetailsModal({
  log,
  onClose,
  displayName,
}: {
  log: any | null;
  onClose: () => void;
  displayName: (email: string | null) => string;
}) {
  if (!log) return null;
  const kind = actionKind(log.action);
  const meta = ACTION_META[kind];
  const parsed = parseDetails(log.details);

  return (
    <Dialog open={!!log} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <FileText className="size-5 text-primary" />
            Detalhes da Auditoria
          </DialogTitle>
          <DialogDescription>Registro completo da alteração</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Entidade</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-medium">
                {entityLabel(log.entity)}
              </Badge>
              <span className="font-black">{log.entity_id || "—"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Ação</p>
            <Badge variant="outline" className={cn("font-semibold", meta.className)}>
              {meta.label}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Usuário</p>
            <p className="flex items-center gap-1.5 font-bold">
              <User className="size-4 text-muted-foreground" />
              {displayName(log.user_email)}
              {log.user_email && (
                <span className="font-normal text-muted-foreground">({log.user_email})</span>
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Data e Hora</p>
            <p className="flex items-center gap-1.5 font-bold">
              <Calendar className="size-4 text-muted-foreground" />
              {formatDateTimeFull(log.created_at)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-black">{meta.dataTitle}</h3>
          <ScrollArea
            className={cn(
              "h-64 rounded-xl border p-4",
              kind === "exclusao" ? "bg-rose-50/60 border-rose-100" : "bg-muted/40",
            )}
          >
            {parsed.json ? (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(parsed.json, null, 2)}
              </pre>
            ) : (
              <p className="text-sm">{parsed.text || "Nenhum detalhe adicional registrado."}</p>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
