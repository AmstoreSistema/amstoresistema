import * as React from "react";
import { dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Calendar, Store, Filter, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export interface ReportLayoutProps {
  /** Nome ou título principal do relatório */
  title: string;
  /** Data inicial do filtro */
  startDate?: string | undefined;
  /** Data final do filtro */
  endDate?: string | undefined;
  /** Texto livre descritivo ou badge com dados dos filtros aplicados */
  filterInfo?: string | React.ReactNode;
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
  columns?: { key: string; label: string; align?: "right" | "left" | "center" }[];
  /** Linhas de dados para renderização automática de tabela (opcional) */
  rows?: Record<string, any>[];
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
  filterInfo,
  storeInfo,
  children,
  columns,
  rows,
  id = "printable-report",
  className,
  hideFooter = false,
}: ReportLayoutProps) {
  // Formatação amigável do período de datas
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

  return (
    <div
      id={id}
      className={cn(
        // Container do relatório e suporte à impressão
        "report-container report-corporate-layout w-full bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 animate-in fade-in duration-300",
        "print:p-0 print:m-0 print:border-none print:shadow-none print:bg-white print:rounded-none",
        // Herança automática de estilo corporativo para qualquer tabela ou planilha inserida
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_thead]:bg-slate-100/75 [&_thead]:border-b [&_thead]:border-slate-200",
        "[&_th]:px-4 [&_th]:py-3.5 [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-slate-600 [&_th]:border-b [&_th]:border-slate-200",
        "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100 [&_tbody_tr]:transition-colors",
        "[&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:hover]:bg-slate-100/60",
        "[&_td]:px-4 [&_td]:py-3 [&_td]:text-sm [&_td]:text-slate-700 [&_td]:font-medium [&_td]:border-b [&_td]:border-slate-100",
        "[&_tfoot]:bg-slate-100/70 [&_tfoot_td]:font-bold [&_tfoot_td]:text-slate-800",
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

        {/* 3. Dados do Filtro com a Data */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {/* Pill principal de período / data */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/80 print:bg-slate-50 print:border-slate-300">
            <Calendar className="size-3.5 text-slate-500 print:text-slate-700" />
            <span>{periodText}</span>
          </div>

          {/* Filtros adicionais se fornecidos */}
          {filterInfo && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/80 print:bg-slate-50 print:border-slate-300">
              <Filter className="size-3.5 text-slate-500 print:text-slate-700" />
              <span>{filterInfo}</span>
            </div>
          )}
        </div>
      </header>

      {/* ============================================================ */}
      {/* CONTEÚDO PRINCIPAL (CHILDREN OU TABELA AUTOMÁTICA)          */}
      {/* ============================================================ */}
      <main className="report-content w-full">
        {children ? (
          // Conteúdo passado diretamente como children
          children
        ) : columns && rows ? (
          // Tabela corporativa gerada automaticamente a partir de columns e rows
          <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-sm print:border-slate-300 print:shadow-none">
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
                          : "text-left"
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
                        <span>Nenhum dado encontrado para os critérios selecionados.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-slate-100 even:bg-slate-50/50 hover:bg-slate-100/50 print:even:bg-slate-50"
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
                              : "text-left"
                          )}
                        >
                          {row[col.key] ?? "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </main>

      {/* ============================================================ */}
      {/* RODAPÉ CORPORATIVO (DATA/HORA DE EMISSÃO E METADADOS)        */}
      {/* ============================================================ */}
      {!hideFooter && (
        <footer className="mt-8 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-[11px] font-medium text-slate-500 gap-2 print:border-slate-300 print:text-slate-600">
          <span>
            Relatório emitido em: <strong className="font-semibold text-slate-700">{new Date().toLocaleString("pt-BR")}</strong>
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {storeName} • Sistema de Gestão Empresarial
          </span>
        </footer>
      )}
    </div>
  );
}
