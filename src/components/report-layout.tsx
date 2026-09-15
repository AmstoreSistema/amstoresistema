import * as React from "react";
import { brl, dateBR, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Calendar, Store, FileText, Calculator, DollarSign, Package, FileDown, Printer, ArrowRightLeft } from "lucide-react";

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
  /** Orientação da folha para impressão: 'portrait' | 'landscape' | 'auto' (padrão: 'auto', se >= 7 colunas usa landscape) */
  orientation?: "portrait" | "landscape" | "auto";
  /** Botões ou elementos de ação customizados para a barra de topo */
  actions?: React.ReactNode;
  /** Callback para botão de impressão direta */
  onPrint?: () => void;
  /** Callback para botão de exportação CSV direta */
  onExportCsv?: () => void;
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
  orientation = "auto",
  actions,
  onPrint,
  onExportCsv,
}: ReportLayoutProps) {
  const isLandscape = orientation === "landscape" || (orientation === "auto" && Boolean(columns && columns.length >= 7));
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
        "report-summary rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-5 print:bg-white print:border-slate-300 print:p-3 print:break-inside-avoid",
        position === "top" ? "mb-4 sm:mb-6 print:mb-3" : "mt-4 sm:mt-6 print:mt-3"
      )}>
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 mb-3 sm:mb-4">
          <Calculator className="size-4 text-slate-600 print:text-slate-800" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 font-display">
            Resumo dos Indicadores Principais
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 gap-2 sm:gap-3">
          {summaryCards.map((card, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3.5 shadow-xs print:border-slate-300 print:shadow-none"
            >
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
                {card.label}
              </p>
              <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-black text-slate-900 font-display tracking-tight print:text-base truncate">
                {card.value}
              </p>
              {card.helper && (
                <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 print:hidden truncate">
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
        "report-container report-corporate-layout w-full max-w-5xl mx-auto bg-white text-slate-900 p-3 sm:p-6 md:p-10 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200/80 animate-in fade-in duration-300 pb-24 sm:pb-8",
        // Regras estritas de impressão folha A4 (sem cortes, bordas perfeitas)
        "print:p-0 print:m-0 print:max-w-none print:w-full print:border-none print:shadow-none print:bg-white print:rounded-none",
        // Herança automática de estilo corporativo para qualquer tabela ou planilha inserida
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm print:[&_table]:text-[9.5px] print:[&_table]:leading-snug",
        "[&_thead]:bg-slate-100/75 [&_thead]:border-b [&_thead]:border-slate-200",
        "[&_th]:px-2.5 sm:[&_th]:px-3 [&_th]:py-2 print:[&_th]:px-1 print:[&_th]:py-1 [&_th]:text-[10px] sm:[&_th]:text-xs print:[&_th]:text-[8.5px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-tight [&_th]:text-slate-700 [&_th]:border-b [&_th]:border-slate-200",
        "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100 [&_tbody_tr]:transition-colors print:[&_tbody_tr]:break-inside-avoid",
        "[&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:hover]:bg-slate-100/60",
        "[&_td]:px-2.5 sm:[&_td]:px-3 [&_td]:py-2 print:[&_td]:px-1 print:[&_td]:py-1 [&_td]:text-xs print:[&_td]:text-[9px] [&_td]:text-slate-800 [&_td]:font-medium [&_td]:border-b [&_td]:border-slate-100",
        "[&_tfoot]:bg-slate-100/90 [&_tfoot_td]:font-bold [&_tfoot_td]:text-slate-900 print:[&_tfoot_td]:px-1 print:[&_tfoot_td]:py-1 print:[&_tfoot_td]:text-[9.5px]",
        className
      )}
    >
      <style>{`
        @media print {
          @page {
            size: A4 ${isLandscape ? "landscape" : "portrait"} !important;
            margin: 5mm 5mm 5mm 5mm !important;
          }
          .report-container,
          #printable-report,
          #printable-transactions-report {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .report-container table,
          #printable-report table,
          #printable-transactions-report table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            table-layout: auto !important;
          }
          .report-container th,
          .report-container td,
          #printable-report th,
          #printable-report td,
          #printable-transactions-report th,
          #printable-transactions-report td {
            padding: 2.5px 3.5px !important;
            word-break: normal !important;
          }
          /* Garante que a coluna de Valor nunca seja cortada ou sofra quebra */
          .report-container th:last-child,
          .report-container td:last-child,
          #printable-report th:last-child,
          #printable-report td:last-child,
          #printable-transactions-report th:last-child,
          #printable-transactions-report td:last-child {
            white-space: nowrap !important;
            text-align: right !important;
            min-width: 95px !important;
            padding-right: 4px !important;
          }
        }
      `}</style>

      {/* ============================================================ */}
      {/* BARRA DE AÇÕES INTEGRADA NO TOPO (TELA / DESKTOP / MOBILE)   */}
      {/* ============================================================ */}
      {(actions || onPrint || onExportCsv) && (
        <div className="print:hidden w-full mb-5 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-200 truncate">
              Relatório Pronto ({rows?.length ?? 0} registros)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {actions}
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition-colors shadow-sm cursor-pointer active:scale-95"
              >
                <FileDown className="size-4 text-amber-400 shrink-0" />
                <span>Exportar CSV</span>
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors shadow-sm cursor-pointer active:scale-95"
              >
                <Printer className="size-4 shrink-0" />
                <span>Imprimir A4</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* BARRA FLUTUANTE FIXA NO RODAPÉ (EXCLUSIVA MOBILE)           */}
      {/* Garante que 'Imprimir A4' NUNCA fique escondido no celular    */}
      {/* ============================================================ */}
      {(onPrint || onExportCsv) && (
        <div className="sm:hidden fixed bottom-3 left-3 right-3 z-50 p-2.5 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-slate-700/80 shadow-2xl flex items-center gap-2 print:hidden animate-in slide-in-from-bottom-5 duration-300">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 text-xs font-bold border border-slate-600 transition-all shadow-sm cursor-pointer"
            >
              <FileDown className="size-4 text-amber-400 shrink-0" />
              <span>Exportar CSV</span>
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <Printer className="size-4 shrink-0" />
              <span>Imprimir A4</span>
            </button>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* CABEÇALHO TOTALMENTE CENTRALIZADO                           */}
      {/* ============================================================ */}
      <header className="report-header mb-6 sm:mb-8 flex flex-col items-center justify-center text-center px-1">
        {/* 1. Logomarca (ou Placeholder Elegante) */}
        <div className="flex flex-col items-center justify-center mb-2.5">
          {storeInfo?.logo ? (
            <img
              src={storeInfo.logo}
              alt={storeName}
              className="max-h-16 sm:max-h-20 max-w-[200px] sm:max-w-[240px] object-contain print:max-h-16 transition-all"
            />
          ) : (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex size-10 sm:size-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-amber-400 shadow-md border border-slate-700/40 print:bg-slate-900 print:text-amber-400">
                <Store className="size-5 sm:size-6" />
              </div>
              <div className="text-left">
                <span className="block font-display text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase">
                  {storeName}
                </span>
                <span className="block text-[8px] sm:text-[9px] font-bold tracking-[0.25em] text-slate-400 uppercase -mt-0.5">
                  Sistema de Gestão
                </span>
              </div>
            </div>
          )}

          {/* Dados secundários da empresa (CNPJ, Contato, Endereço) */}
          {(storeInfo?.cnpj || storeInfo?.contact || storeInfo?.address) && (
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 gap-y-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
              {storeInfo.cnpj && <span>CNPJ: {storeInfo.cnpj}</span>}
              {storeInfo.cnpj && storeInfo.contact && <span className="text-slate-300">•</span>}
              {storeInfo.contact && <span>{storeInfo.contact}</span>}
              {storeInfo.address && <span className="text-slate-300">•</span>}
              {storeInfo.address && <span>{storeInfo.address}</span>}
            </div>
          )}
        </div>

        {/* Separador minimalista e refinado */}
        <div className="my-1.5 h-0.5 w-12 sm:w-16 rounded-full bg-gradient-to-r from-amber-400/80 via-amber-500 to-amber-400/80 print:bg-slate-300" />

        {/* 2. Nome do Relatório */}
        <h1 className="mt-1.5 text-base sm:text-2xl md:text-3xl font-black uppercase tracking-wide text-slate-900 font-display break-words max-w-full">
          {title}
        </h1>

        {/* 3. Dados do Filtro com a Data */}
        <div className="mt-2.5 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-slate-100/90 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 border border-slate-200/80 print:bg-slate-50 print:border-slate-300">
            <Calendar className="size-3 sm:size-3.5 text-slate-500 print:text-slate-700 shrink-0" />
            <span className="truncate">{periodText}</span>
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
          // Tabela corporativa com suporte a totais/subtotais automáticos e rolagem fluida e suave no mobile
          <div 
            className="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200/90 shadow-xs print:overflow-visible print:border-slate-300 print:shadow-none"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x pan-y",
            }}
          >
            {/* Indicador visual de rolagem horizontal para mobile */}
            <div className="sm:hidden flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] font-bold text-amber-900 select-none">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="size-3.5 text-amber-600 animate-pulse shrink-0" />
                <span>Arraste para os lados para ver colunas &rarr;</span>
              </span>
              <span className="font-black text-amber-700 shrink-0">{rows.length} itens</span>
            </div>

            <table 
              className={cn(
                "w-full caption-bottom text-sm border-collapse print:min-w-0 print:w-full",
                columns.length >= 7 ? "min-w-[880px] print:min-w-0" : "min-w-[700px] print:min-w-0"
              )}
            >
              <thead className="bg-slate-100/80 hover:bg-slate-100/80 print:bg-slate-100 border-b border-slate-200">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "h-9 px-3 py-2 print:px-1 print:py-0.5 text-[11px] print:text-[8.5px] font-black uppercase tracking-tight text-slate-700 print:text-slate-900 border-b border-slate-200 whitespace-nowrap",
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left",
                        col.className
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="h-32 text-center text-sm font-medium text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="size-8 text-slate-300" />
                        <span>Nenhum dado encontrado para o período selecionado.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 even:bg-slate-50/50 hover:bg-slate-100/50 print:even:bg-slate-50 print:break-inside-avoid transition-colors"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2.5 print:px-1 print:py-0.5 text-xs print:text-[9px] font-medium text-slate-700",
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left",
                            col.className
                          )}
                        >
                          {row[col.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>

              {/* LINHA DE TOTAIS / SUBTOTAIS NA TABELA */}
              {rows.length > 0 && finalTotals && showTotals && (
                <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 text-slate-900 print:bg-slate-100 font-medium">
                  {/* Linha de Subtotal opcional */}
                  {customSubtotals && (
                    <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-800">
                      {columns.map((col, idx) => (
                        <td
                          key={`subtotal-${col.key}`}
                          className={cn(
                            "px-4 py-2.5 print:px-1 print:py-0.5 text-xs print:text-[8.5px] font-bold uppercase",
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left",
                            col.className
                          )}
                        >
                          {idx === 0 ? "Subtotal" : customSubtotals[col.key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  )}

                  {/* Linha de Total Geral */}
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300 print:bg-slate-100">
                    {columns.map((col, idx) => (
                      <td
                        key={`total-${col.key}`}
                        className={cn(
                          "px-4 py-3.5 print:px-1 print:py-1 text-sm print:text-[9.5px] font-black uppercase tracking-tight",
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
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : null}

        {/* Cards de Resumo na Parte Inferior se configurado */}
        {summaryPosition === "bottom" && renderSummarySection("bottom")}
      </main>

      {/* ============================================================ */}
      {/* RODAPÉ CORPORATIVO (DATA/HORA DE EMISSÃO E METADADOS)        */}
      {/* ============================================================ */}
      {!hideFooter && (
        <footer className="mt-8 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-[11px] font-medium text-slate-500 gap-2 print:border-slate-300 print:text-slate-600 print:mt-4 print:break-inside-avoid">
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
