import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PaginationBarProps {
  /** Página atual (1-indexada) */
  page: number;
  /** Quantidade de itens por página (ex: 25) */
  pageSize: number;
  /** Total de itens encontrados */
  totalItems: number;
  /** Nome no plural para exibição (ex: "vendas", "transações", "itens") */
  itemName?: string;
  /** Callback ao mudar de página */
  onPageChange: (newPage: number) => void;
  /** Desabilita controles durante carregamento */
  isLoading?: boolean;
}

export function PaginationBar({
  page,
  pageSize,
  totalItems,
  itemName = "itens",
  onPageChange,
  isLoading = false,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  // Gera a lista de botões numéricos com elipses se houver muitas páginas
  const pageNumbers = React.useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    if (page <= 4) {
      // Início: [1, 2, 3, 4, 5, '...', totalPages]
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      // Fim: [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      // Meio: [1, '...', page - 1, page, page + 1, '...', totalPages]
      pages.push(1);
      pages.push("...");
      pages.push(page - 1);
      pages.push(page);
      pages.push(page + 1);
      pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-3 rounded-2xl bg-card/60 border border-border/40 text-sm text-muted-foreground mt-4 shadow-sm">
      {/* Texto de resumo */}
      <div className="text-xs sm:text-sm font-medium">
        {totalItems === 0 ? (
          <span>Nenhum registro encontrado</span>
        ) : (
          <span>
            Exibindo <strong className="text-foreground font-bold">{from}-{to}</strong> de{" "}
            <strong className="text-foreground font-bold">{totalItems}</strong> {itemName}
          </span>
        )}
      </div>

      {/* Controles de navegação */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* Primeira página (visível se muitas páginas) */}
        {totalPages > 5 && (
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg border-border/40 hidden sm:inline-flex"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(1)}
            title="Primeira página"
          >
            <ChevronsLeft className="size-4" />
          </Button>
        )}

        {/* Botão Anterior */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 rounded-lg border-border/40 gap-1 font-semibold text-xs"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-3.5" />
          <span>Anterior</span>
        </Button>

        {/* Indicadores numéricos de página */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (typeof p === "string") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-xs text-muted-foreground select-none"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <Button
                key={p}
                variant={isCurrent ? "default" : "outline"}
                size="sm"
                className={`size-8 p-0 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-gradient-gold text-primary-foreground border-none shadow-gold"
                    : "border-border/40 hover:bg-muted/40 hover:text-foreground"
                }`}
                disabled={isLoading}
                onClick={() => onPageChange(p)}
                aria-current={isCurrent ? "page" : undefined}
              >
                {p}
              </Button>
            );
          })}
        </div>

        {/* Botão Próximo */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 rounded-lg border-border/40 gap-1 font-semibold text-xs"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          <span>Próximo</span>
          <ChevronRight className="size-3.5" />
        </Button>

        {/* Última página (visível se muitas páginas) */}
        {totalPages > 5 && (
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg border-border/40 hidden sm:inline-flex"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(totalPages)}
            title="Última página"
          >
            <ChevronsRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
