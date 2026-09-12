import * as React from "react";
import { brl, dateBR, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Calendar, Store, FileText, Calculator, DollarSign, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./ui/table";

export interface ReportLayoutProps {
  /** Nome ou título principal do relatório */
  title: string;
  /** Data inicial do filtro */
  startDate?: string | undefined;
  /** Data final do filtro */
  endDate?: string | undefined;
  /** Informações cadastrais da empresa/loja */
  storeInfo?: {
    name?: string;
    cnpj?: string;
    contact?: string;
    logo?: string;
    address?: string;
  };
  /** Conteúdo customizado / tabelas / planilhas / gráficos do relatório */
  children?: React.ReactNode;
  /** Colunas para renderização automática de tabela (opcional) */
  columns?: { key: string; label: string; align?: "right" | "left" | "center"; className?: string }[];
  /** Linhas de dados para renderização automática de tabela (opcional) */
  rows?: Record<string, any>[];
  /** Totais explícitos por coluna (opcional - se omitido, calcula automaticamente) */
  totals?: Record<string, string | number>;
  /** Subtotais explícitos por coluna (opcional) */
  subtotals?: Record<string, string | number>;
  /** Cards de resumo personalizados (opcional) */
  summaryCards?: { label: string; value: string | number; helper?: string; icon?: any }[];
  /** Posição dos cards de resumo: 'top' | 'bottom' | 'both' (padrão: 'top') */
  summaryPosition?: "top" | "bottom" | "both";
  /** Se false, oculta a somatória de totais e subtotais */
  showTotals?: boolean;
  /** Identificador HTML para controle de impressão */
  id?: string;
  /** Classes CSS adicionais no container */
  className?: string;
  /** Se true, oculta o rodapé de emissão */
  hideFooter?: boolean;
}

export function ReportLayout({
  title,
  startDate,
  endDate,
  storeInfo,
  children,
  columns,
  rows,
  totals: customTotals,
  subtotals: customSubtotals,
  summaryCards: customSummaryCards,
  summaryPosition = "top",
  showTotals = true,
  id = "printable-report",
  className,
  hideFooter = false,
}: ReportLayoutProps) {
  // 1. Formatação exclusiva do filtro de datas (sem contagem de registros no cabeçalho)
  const periodText = React.useMemo(() => {
    if (startDate && endDate) {
      return `Período: ${dateBR(startDate)} até ${dateBR(endDate)}`;
    }
    if (startDate) {
      return `A partir de: ${dateBR(startDate)}`;
    }
    if (endDate) {
      return `Até: ${dateBR(endDate)}`;
    }
    return "Período: Geral / Sem restrição de data";
  }, [startDate, endDate]);

  const storeName = storeInfo?.name || "Amstore";

  // 2. Cálculo automático inteligente de totais e subtotais para colunas numéricas / monetárias
  const calculatedSums = React.useMemo(() => {
    if (!columns || !rows || rows.length === 0 || !showTotals) return null;

    // Colunas que NÃO devem ser somadas (identificadores, códigos, datas, contatos, categorias, etc.)
    const ignoredKeys = new Set([
      "id", "code", "sku", "date", "created_at", "due", "due_date",
      "phone", "email", "client", "customer", "product", "material",
      "supplier", "name", "seller", "user", "type", "category",
      "status", "action", "installment", "method", "notes", "description",
      "unit", "hour", "entity", "entity_id", "ticket", "actions", "action_btn"
    ]);

    const sums: Record<string, { total: number; isCurrency: boolean; count: number; label: string }> = {};

    columns.forEach((col) => {
      const k = col.key.toLowerCase();
      if (ignoredKeys.has(k) || k.includes("date") || k.includes("hora") || k.includes("data") || k.includes("action")) {
        return;
      }

      let isCurrency = false;
      let sum = 0;
      let validCount = 0;

      for (const row of rows) {
        const val = row[col.key];
        if (val === undefined || val === null || val === "" || val === "—") continue;

        if (typeof val === "number") {
          sum += val;
          validCount++;
        } else if (typeof val === "string") {
          const trimmed = val.trim();
          if (trimmed.startsWith("R$") || trimmed.includes("R$")) {
            isCurrency = true;
            // Parse BRL: "R$ 1.250,50" -> 1250.50
            const clean = trimmed.replace(/[R$\s.]/g, "").replace(",", ".");
            const numVal = parseFloat(clean);
            if (!isNaN(numVal)) {
              sum += numVal;
              validCount++;
            }
          } else if (/^-?\d+([.,]\d+)?$/.test(trimmed)) {
            const clean = trimmed.replace(",", ".");
            const numVal = parseFloat(clean);
            if (!isNaN(numVal)) {
              sum += numVal;
              validCount++;
            }
          }
        }
      }

      // Se encontrou dados válidos somáveis
      if (validCount > 0) {
        sums[col.key] = {
          total: sum,
          isCurrency,
          count: validCount,
          label: col.label,
        };
      }
    });

    return Object.keys(sums).length > 0 ? sums : null;
  }, [columns, rows, showTotals]);

  // Totais consolidados para a linha da tabela (tfoot)
  const finalTotals = React.useMemo(() => {
    if (customTotals) return customTotals;
    if (!calculatedSums) return null;

    const res: Record<string, string> = {};
    for (const [key, val] of Object.entries(calculatedSums)) {
      res[key] = val.isCurrency ? brl(val.total) : num(val.total, 0);
    }
    return res;
  }, [customTotals, calculatedSums]);

  // Cards de resumo de totais e subtotais no relatório
  const summaryCards = React.useMemo(() => {
    if (customSummaryCards && customSummaryCards.length > 0) return customSummaryCards;
    if (!calculatedSums) return [];

    const cards: { label: string; value: string | number; helper?: string }[] = [];

    // Prioridade de exibição: Faturamento/Total, Subtotal, Descontos, Quantidades
    for (const [key, val] of Object.entries(calculatedSums)) {
      const formattedVal = val.isCurrency ? brl(val.total) : num(val.total, 0);
      cards.push({
        label: `Total de ${val.label}`,
        value: formattedVal,
        helper: val.isCurrency ? "Somatória monetária" : "Quantidade acumulada",
      });
    }

    return cards;
  }, [customSummaryCards, calculatedSums]);

  const renderSummarySection = (position: "top" | "bottom") => {
    if (!showTotals || summaryCards.length === 0) return null;
    return (
      <section className={cn(
        "report-summary rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 print:bg-white print:border-slate-300 print:p-4",
        position === "top" ? "mb-6 print:mb-4" : "mt-6 print:mt-4"
      )}>
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
          <Calculator className="size-4 text-slate-600 print:text-slate-800" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 font-display">
            Resumo dos Indicadores Principais
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-2">
          {summaryCards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs print:border-slate-300 print:shadow-none"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {card.label}
              </p>
              <p className="mt-1 text-lg font-black text-slate-900 font-display tracking-tight print:text-base">
                {card.value}
              </p>
              {card.helper && (
                <p className="text-[10px] font-medium text-slate-400 print:hidden">
                  {card.helper}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div
      id={id}
      className={cn(
        // Container do relatório compatível com tela e folha A4 perfeita
        "report-container report-corporate-layout w-full max-w-5xl mx-auto bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 animate-in fade-in duration-300",
        // Regras estritas de impressão folha A4 (sem cortes, bordas perfeitas)
        "print:p-0 print:m-0 print:max-w-none print:w-full print:border-none print:shadow-none print:bg-white print:rounded-none",
        // Herança automática de estilo corporativo para qualquer tabela ou planilha inserida
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_thead]:bg-slate-100/75 [&_thead]:border-b [&_thead]:border-slate-200",
        "[&_th]:px-4 [&_th]:py-3.5 [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-slate-600 [&_th]:border-b [&_th]:border-slate-200",
        "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100 [&_tbody_tr]:transition-colors print:[&_tbody_tr]:break-inside-avoid",
        "[&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:hover]:bg-slate-100/60",
        "[&_td]:px-4 [&_td]:py-3 [&_td]:text-sm [&_td]:text-slate-700 [&_td]:font-medium [&_td]:border-b [&_td]:border-slate-100",
        "[&_tfoot]:bg-slate-100/90 [&_tfoot_td]:font-bold [&_tfoot_td]:text-slate-900",
        className
      )}
    >
      {/* ============================================================ */}
      {/* CABEÇALHO TOTALMENTE CENTRALIZADO                           */}
      {/* ============================================================ */}
      <header className="report-header mb-8 flex flex-col items-center justify-center text-center">
        {/* 1. Logomarca (ou Placeholder Elegante) */}
        <div className="flex flex-col items-center justify-center mb-3">
          {storeInfo?.logo ? (
            <img
              src={storeInfo.logo}
              alt={storeName}
              className="max-h-20 max-w-[240px] object-contain print:max-h-16 transition-all"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-amber-400 shadow-md border border-slate-700/40 print:bg-slate-900 print:text-amber-400">
                <Store className="size-6" />
              </div>
              <div className="text-left">
                <span className="block font-display text-lg font-black tracking-widest text-slate-900 uppercase">
                  {storeName}
                </span>
                <span className="block text-[9px] font-bold tracking-[0.25em] text-slate-400 uppercase -mt-0.5">
                  Sistema de Gestão
                </span>
              </div>
            </div>
          )}

          {/* Dados secundários da empresa (CNPJ, Contato, Endereço) */}
          {(storeInfo?.cnpj || storeInfo?.contact || storeInfo?.address) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-slate-500">
              {storeInfo.cnpj && <span>CNPJ: {storeInfo.cnpj}</span>}
              {storeInfo.cnpj && storeInfo.contact && <span className="text-slate-300">•</span>}
              {storeInfo.contact && <span>{storeInfo.contact}</span>}
              {storeInfo.address && <span className="text-slate-300">•</span>}
              {storeInfo.address && <span>{storeInfo.address}</span>}
            </div>
          )}
        </div>

        {/* Separador minimalista e refinado */}
        <div className="my-2 h-0.5 w-16 rounded-full bg-gradient-to-r from-amber-400/80 via-amber-500 to-amber-400/80 print:bg-slate-300" />

        {/* 2. Nome do Relatório */}
        <h1 className="mt-2 text-2xl font-black uppercase tracking-wider text-slate-900 font-display sm:text-3xl">
          {title}
        </h1>

        {/* 3. Dados do Filtro com a Data (APENAS O FILTRO DAS DATAS) */}
        <div className="mt-3 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-4 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200/80 print:bg-slate-50 print:border-slate-300">
            <Calendar className="size-3.5 text-slate-500 print:text-slate-700" />
            <span>{periodText}</span>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* CONTEÚDO PRINCIPAL (CHILDREN OU TABELA AUTOMÁTICA)          */}
      {/* ============================================================ */}
      <main className="report-content w-full">
        {/* Cards de Resumo no Topo se configurado */}
        {(summaryPosition === "top" || summaryPosition === "both") && renderSummarySection("top")}

        {children ? (
          // Conteúdo passado diretamente como children
          children
        ) : columns && rows ? (
          // Tabela corporativa com suporte a totais/subtotais automáticos
          <div className="overflow-x-auto rounded-xl border border-slate-200/90 shadow-sm print:overflow-visible print:border-slate-300 print:shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 hover:bg-slate-100/80 print:bg-slate-100">
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "h-11 px-4 text-[11px] font-black uppercase tracking-wider text-slate-700 print:text-slate-900",
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left",
                        col.className
                      )}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center text-sm font-medium text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="size-8 text-slate-300" />
                        <span>Nenhum dado encontrado para o período selecionado.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-slate-100 even:bg-slate-50/50 hover:bg-slate-100/50 print:even:bg-slate-50 print:break-inside-avoid"
                    >
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "px-4 py-3 text-sm font-semibold text-slate-700",
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left",
                            col.className
                          )}
                        >
                          {row[col.key] ?? "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* LINHA DE TOTAIS / SUBTOTAIS NA TABELA */}
              {rows.length > 0 && finalTotals && showTotals && (
                <TableFooter className="bg-slate-100/90 border-t-2 border-slate-300 text-slate-900 print:bg-slate-100">
                  {/* Linha de Subtotal opcional */}
                  {customSubtotals && (
                    <TableRow className="border-b border-slate-200 bg-slate-50 font-bold text-slate-800">
                      {columns.map((col, idx) => (
                        <TableCell
                          key={`subtotal-${col.key}`}
                          className={cn(
                            "px-4 py-2.5 text-xs font-bold uppercase",
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left",
                            col.className
                          )}
                        >
                          {idx === 0 ? "Subtotal" : customSubtotals[col.key] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}

                  {/* Linha de Total Geral */}
                  <TableRow className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300 print:bg-slate-100">
                    {columns.map((col, idx) => (
                      <TableCell
                        key={`total-${col.key}`}
                        className={cn(
                          "px-4 py-3.5 text-sm font-black uppercase tracking-tight",
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left",
                          idx === 0 ? "text-slate-900" : "",
                          col.className
                        )}
                      >
                        {idx === 0 ? "TOTAL GERAL" : finalTotals[col.key] ?? ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        ) : null}

        {/* Cards de Resumo na Parte Inferior se configurado */}
        {summaryPosition === "bottom" && renderSummarySection("bottom")}
      </main>

      {/* ============================================================ */}
      {/* RODAPÉ CORPORATIVO (DATA/HORA DE EMISSÃO E METADADOS)        */}
      {/* ============================================================ */}
      {!hideFooter && (
        <footer className="mt-8 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-[11px] font-medium text-slate-500 gap-2 print:border-slate-300 print:text-slate-600 print:mt-6">
          <span>
            Relatório emitido em: <strong className="font-semibold text-slate-700">{new Date().toLocaleString("pt-BR")}</strong>
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {storeName} • Folha A4 • Amstore Gestão
          </span>
        </footer>
      )}
    </div>
  );
}
