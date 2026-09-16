import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useRows } from "@/lib/data";
import { FileText, Eye, Calendar, User, Search, Plus, Pencil, Trash2, Printer, FileDown, AlertTriangle, Loader2 } from "lucide-react";
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

  const reportData = React.useMemo(() => {
    const columns = [
      { key: "date", label: "Data/Hora" },
      { key: "user", label: "Usuário" },
      { key: "action", label: "Ação" },
      { key: "entity", label: "Entidade" },
      { key: "entity_id", label: "ID Entidade" },
    ];

    const rows = filtered.map((log: any) => ({
      date: formatDateTime(log.created_at),
      user: displayName(log.user_email),
      action: actionKind(log.action).toUpperCase(),
      entity: entityLabel(log.entity),
      entity_id: log.entity_id || "—",
    }));

    return { columns, rows };
  }, [filtered, displayName]);

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

      <AuditDetailsModal log={selected} onClose={() => setSelected(null)} displayName={displayName} />
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

