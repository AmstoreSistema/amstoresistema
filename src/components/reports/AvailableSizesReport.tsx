import React, { useMemo, useState } from "react";
import { Printer, Search, Check, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { printReport } from "@/lib/print-report";
import { brl } from "@/lib/format";

export interface AvailableSizesReportProps {
  stock: any[];
  products: any[];
  storeInfo?: {
    name?: string;
    cnpj?: string;
    contact?: string;
    logo?: string;
    address?: string;
  };
}

interface SandalItem {
  sandalia: string;
  cor: string;
  numeracao: string;
  qtdDisponivel: number;
  precoVenda: number;
}

// Normalizador tolerante para categorias
const normalizeCat = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

// Identifica se o produto é calçado/sandália ou se tem controle de numerações
const isSandalProduct = (product?: any, stockItem?: any) => {
  const normCat = normalizeCat(product?.category || stockItem?.categoria || "");
  const normName = normalizeCat(product?.name || stockItem?.produto_nome || "");
  const isFootwear =
    normCat.includes("sandali") ||
    normCat.includes("calcad") ||
    normCat.includes("sapato") ||
    normCat.includes("rasteir") ||
    normCat.includes("tamanco") ||
    normName.includes("sandali") ||
    normName.includes("rasteir") ||
    normName.includes("tamanco");
  const hasNumeracoes = Boolean(
    stockItem?.numeracoes &&
      typeof stockItem.numeracoes === "object" &&
      Object.keys(stockItem.numeracoes).length > 0
  );
  return isFootwear || hasNumeracoes;
};

// Formata data por extenso em português (ex: "18 de setembro de 2026")
const getExtendDateBR = (date: Date) => {
  const day = date.getDate();
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
};

export function AvailableSizesReport({ stock, products }: AvailableSizesReportProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  const productMap = useMemo(() => {
    const map = new Map<string, any>();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [products]);

  // 1. Extrair e agrupar itens de estoque de sandálias com quantidade > 0
  const allSandalItems = useMemo(() => {
    const aggregated = new Map<string, SandalItem>();

    stock.forEach((s: any) => {
      const product = s.produto_id ? productMap.get(s.produto_id) : null;
      if (!isSandalProduct(product, s)) return;

      const sandaliaName = (product?.name || s.produto_nome || "Sandália").trim();
      const rawColor = product?.color?.trim() || "";
      const cor = rawColor ? rawColor : "-";
      const precoVenda = Number(product?.sale_price ?? s.preco_venda ?? 0);

      const numeracoes = s.numeracoes;
      if (numeracoes && typeof numeracoes === "object") {
        Object.entries(numeracoes as Record<string, any>).forEach(([sizeKey, rawQty]) => {
          const qty = Number(rawQty ?? 0);
          if (qty > 0) {
            const numeracao = String(sizeKey).trim();
            const key = `${numeracao}___${sandaliaName.toLowerCase()}___${cor.toLowerCase()}`;
            const existing = aggregated.get(key);
            if (existing) {
              existing.qtdDisponivel += qty;
            } else {
              aggregated.set(key, {
                sandalia: sandaliaName,
                cor,
                numeracao,
                qtdDisponivel: qty,
                precoVenda,
              });
            }
          }
        });
      } else {
        const qty = Number(s.quantidade_disponivel ?? 0);
        if (qty > 0) {
          // Se não há objeto de numerações específico, verificar se há numeração no produto ou padrão
          const numeracao = "Padrão";
          const key = `${numeracao}___${sandaliaName.toLowerCase()}___${cor.toLowerCase()}`;
          const existing = aggregated.get(key);
          if (existing) {
            existing.qtdDisponivel += qty;
          } else {
            aggregated.set(key, {
              sandalia: sandaliaName,
              cor,
              numeracao,
              qtdDisponivel: qty,
              precoVenda,
            });
          }
        }
      }
    });

    return Array.from(aggregated.values());
  }, [stock, productMap]);

  // 2. Obter todas as numerações disponíveis ordenadas numericamente
  const availableSizesList = useMemo(() => {
    const set = new Set<string>();
    allSandalItems.forEach((item) => set.add(item.numeracao));
    return Array.from(set).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [allSandalItems]);

  // 3. Filtrar por busca e numerações selecionadas
  const filteredItems = useMemo(() => {
    let result = allSandalItems;

    // Filtro por numeração (múltipla seleção)
    if (selectedSizes.length > 0) {
      result = result.filter((item) => selectedSizes.includes(item.numeracao));
    }

    // Campo de busca por nome da sandália ou cor
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.sandalia.toLowerCase().includes(term) ||
          item.cor.toLowerCase().includes(term) ||
          item.numeracao.toLowerCase().includes(term)
      );
    }

    return result;
  }, [allSandalItems, selectedSizes, searchTerm]);

  // 4. Agrupamento por numeração (ordem crescente)
  const groupedSections = useMemo(() => {
    const map = new Map<string, SandalItem[]>();

    filteredItems.forEach((item) => {
      const list = map.get(item.numeracao) || [];
      list.push(item);
      map.set(item.numeracao, list);
    });

    // Ordena as numerações de forma crescente (34, 35, 36...)
    const sortedSizes = Array.from(map.keys()).sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });

    return sortedSizes.map((size) => {
      const items = map.get(size)!;
      // Linhas ordenadas por nome da sandália (A-Z)
      items.sort((a, b) => a.sandalia.localeCompare(b.sandalia));
      const totalParesSecao = items.reduce((sum, i) => sum + i.qtdDisponivel, 0);
      const totalValorSecao = items.reduce(
        (sum, i) => sum + i.qtdDisponivel * i.precoVenda,
        0
      );
      return {
        numeracao: size,
        totalPares: totalParesSecao,
        totalValor: totalValorSecao,
        items,
      };
    });
  }, [filteredItems]);

  // 5. Indicadores para o Card de Resumo
  // 1. Numerações Distintas: quantidade de numerações com estoque.
  // 2. Total de Pares: soma de todas as quantidades disponíveis.
  // 3. Valor Total de Venda: soma total do valor dos pares disponíveis.
  // 4. Maior Numeração: ex: "Nº 39".
  const summaryIndicators = useMemo(() => {
    const distinctSizes = groupedSections.map((g) => g.numeracao);
    const totalPares = filteredItems.reduce((acc, curr) => acc + curr.qtdDisponivel, 0);
    const totalValor = filteredItems.reduce(
      (acc, curr) => acc + curr.qtdDisponivel * curr.precoVenda,
      0
    );

    let maiorNumStr = "—";
    if (distinctSizes.length > 0) {
      // Filtrar tamanhos numéricos para determinar a maior numeração
      const numericSizes = distinctSizes
        .map((s) => ({ raw: s, val: parseFloat(s) }))
        .filter((s) => !isNaN(s.val));

      if (numericSizes.length > 0) {
        numericSizes.sort((a, b) => b.val - a.val);
        maiorNumStr = `Nº ${numericSizes[0].raw}`;
      } else {
        maiorNumStr = distinctSizes[distinctSizes.length - 1];
      }
    }

    return {
      distinctCount: distinctSizes.length,
      totalPares,
      totalValor,
      maiorNumeracao: maiorNumStr,
    };
  }, [groupedSections, filteredItems]);

  const currentDateExtensive = useMemo(() => getExtendDateBR(new Date()), []);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const selectAllSizes = () => {
    setSelectedSizes([]);
  };

  const handlePrint = () => {
    printReport("available-sizes-printable-area", "portrait");
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      {/* FILTROS (acima do relatório, ocultos na impressão) */}
      <div className="print:hidden bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800">
            <Filter className="size-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Filtros do Relatório
            </span>
          </div>

          <Button
            onClick={handlePrint}
            size="sm"
            className="h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black gap-2 text-xs shadow-sm cursor-pointer self-start sm:self-auto"
          >
            <Printer className="size-4 shrink-0" />
            <span>Imprimir / Exportar PDF</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Campo de busca por nome da sandália ou cor */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por sandália ou cor..."
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium placeholder:text-slate-400 focus-visible:ring-amber-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filtro por numeração (múltipla seleção) */}
          <div className="md:col-span-7 flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              variant={selectedSizes.length === 0 ? "default" : "outline"}
              size="sm"
              onClick={selectAllSizes}
              className={`h-8 rounded-lg text-xs font-bold px-3 transition-colors ${
                selectedSizes.length === 0
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Todas
            </Button>

            {availableSizesList.map((size) => {
              const isSelected = selectedSizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 border-amber-500 text-slate-950 shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:border-amber-400 hover:bg-amber-50/50"
                  }`}
                >
                  {isSelected && <Check className="size-3 stroke-[3]" />}
                  <span>{size}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedSizes.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 font-medium">Numerações filtradas:</span>
            <div className="flex flex-wrap gap-1">
              {selectedSizes.map((s) => (
                <Badge
                  key={s}
                  variant="secondary"
                  className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] cursor-pointer"
                  onClick={() => toggleSize(s)}
                >
                  Nº {s} ×
                </Badge>
              ))}
              <button
                onClick={selectAllSizes}
                className="text-[10px] text-amber-700 underline font-semibold ml-1 hover:text-amber-800"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ÁREA IMPRESSA / VISUAL DO RELATÓRIO */}
      <div
        id="available-sizes-printable-area"
        className="report-container print-only bg-white text-slate-900 font-sans p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none"
      >
        {/* CABEÇALHO */}
        <div className="report-header text-center space-y-1.5 mb-5 pb-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
            Relatório de Numerações Disponíveis
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600">
            Estoque de Sandálias • {currentDateExtensive}
          </p>
          <hr className="mt-3 border-t border-slate-300 w-full" />
        </div>

        {/* CARD DE RESUMO (4 indicadores) */}
        <div className="report-summary mb-6 rounded-xl border border-slate-300 bg-slate-50/50 p-4 print:bg-white print:border-slate-400">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-300 text-center">
            {/* 1. Numerações Distintas */}
            <div className="px-2 sm:px-4">
              <span className="block text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {summaryIndicators.distinctCount}
              </span>
              <span className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                Numerações Distintas
              </span>
            </div>

            {/* 2. Total de Pares */}
            <div className="px-2 sm:px-4">
              <span className="block text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {summaryIndicators.totalPares}
              </span>
              <span className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                Total de Pares
              </span>
            </div>

            {/* 3. Valor Total de Venda */}
            <div className="px-2 sm:px-4 pt-3 sm:pt-0">
              <span className="block text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {brl(summaryIndicators.totalValor)}
              </span>
              <span className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                Valor Total Venda
              </span>
            </div>

            {/* 4. Maior Numeração */}
            <div className="px-2 sm:px-4 pt-3 sm:pt-0">
              <span className="block text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {summaryIndicators.maiorNumeracao}
              </span>
              <span className="block text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                Maior Numeração
              </span>
            </div>
          </div>
        </div>

        {/* SEÇÕES POR NUMERAÇÃO */}
        {groupedSections.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
            <p className="text-sm font-bold text-slate-600">
              Nenhuma sandália com estoque disponível encontrada com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSections.map((section) => (
              <section
                key={section.numeracao}
                className="size-section border border-slate-300 rounded-lg overflow-hidden bg-white print:border-slate-400 print:overflow-visible"
                style={{ breakInside: "auto" }}
              >
                {/* Barra de título da seção */}
                <div
                  className="section-header flex items-center justify-between px-3.5 py-2.5 bg-slate-100 border-b border-slate-300 print:bg-slate-200 print:border-slate-400"
                  style={{ breakAfter: "avoid", pageBreakAfter: "avoid" }}
                >
                  <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                    Numeração {section.numeracao}
                  </span>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                    <span className="font-bold text-slate-700">
                      {section.totalPares} {section.totalPares === 1 ? "par" : "pares"}
                    </span>
                    <span className="text-slate-400 font-bold">•</span>
                    <span className="font-black text-slate-950 bg-white/80 px-2 py-0.5 rounded border border-slate-300/80 shadow-xs print:bg-transparent print:border-none print:shadow-none print:p-0">
                      Total: {brl(section.totalValor)}
                    </span>
                  </div>
                </div>

                {/* Tabela com as colunas: Sandália | Cor | Qtd. Disponível | Preço Venda */}
                <div className="overflow-x-auto w-full print:overflow-visible">
                  <table className="w-full text-left border-collapse min-w-[500px] sm:min-w-full">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 text-[11px] uppercase tracking-wider">
                        <th className="py-2 px-3 font-bold border-r border-slate-300">Sandália</th>
                        <th className="py-2 px-3 font-bold border-r border-slate-300 w-32 sm:w-40">
                          Cor
                        </th>
                        <th className="py-2 px-3 font-bold border-r border-slate-300 text-center w-32 sm:w-36">
                          Qtd. Disponível
                        </th>
                        <th className="py-2 px-3 font-bold text-right w-28 sm:w-36">
                          Preço Venda
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {section.items.map((item, idx) => (
                        <tr
                          key={`${section.numeracao}-${item.sandalia}-${item.cor}-${idx}`}
                          className="hover:bg-slate-50/70 transition-colors"
                          style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                        >
                          <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-900">
                            {item.sandalia}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                            {item.cor}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center font-black text-slate-900">
                            {item.qtdDisponivel}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            <div>{brl(item.precoVenda)}</div>
                            {item.qtdDisponivel > 1 && (
                              <div className="text-[10px] text-slate-500 font-semibold print:text-slate-600">
                                Subtotal: {brl(item.precoVenda * item.qtdDisponivel)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr
                        className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs"
                        style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                      >
                        <td
                          colSpan={2}
                          className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-black border-r border-slate-300 text-slate-900"
                        >
                          Total Numeração {section.numeracao}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black border-r border-slate-300 text-slate-900">
                          {section.totalPares} {section.totalPares === 1 ? "par" : "pares"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-950 whitespace-nowrap">
                          {brl(section.totalValor)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Estilos específicos de impressão integrados no container imprimível */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 6mm 8mm 6mm;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
            body, body * {
              visibility: visible !important;
            }
            .print\\:hidden {
              display: none !important;
              visibility: hidden !important;
            }
            .size-section {
              border: 1px solid #cbd5e1 !important;
              margin-bottom: 14px !important;
              page-break-inside: auto !important;
              break-inside: auto !important;
              overflow: visible !important;
            }
            .section-header {
              break-after: avoid !important;
              page-break-after: avoid !important;
              background-color: #e2e8f0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
            }
            thead {
              display: table-header-group !important;
            }
            thead tr {
              background-color: #f1f5f9 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
            tfoot tr {
              background-color: #f1f5f9 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            tbody tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            th, td {
              border: 1px solid #cbd5e1 !important;
              padding: 5px 8px !important;
            }
            .overflow-x-auto,
            .overflow-hidden {
              overflow: visible !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
