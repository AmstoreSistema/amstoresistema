import * as React from "react";
import { Search, Package, Hash, ArrowLeft, X, Loader2, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export interface StockProduct {
  id: string;
  produto_id: string;
  produto_nome: string;
  quantidade_disponivel: number;
  preco_venda: number;
  numeracoes: any;
  categoria: string | null;
  sku?: string | null;
  imagem_url?: string | null;
}

export function ProductSearch({ 
  onAdd 
}: { 
  onAdd: (product: StockProduct, numeracao: string | null) => void 
}) {
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedStock, setSelectedStock] = React.useState<StockProduct | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 1. Busca produtos em stock_products com dados sincronizados da tabela mestre products
  const { data: stockItems = [], isLoading: isLoadingStock } = useQuery({
    queryKey: ["stock_products_with_images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_products")
        .select(`
          id,
          produto_id,
          produto_nome,
          quantidade_disponivel,
          preco_venda,
          numeracoes,
          categoria,
          products:produto_id (
            id,
            sku,
            image_url,
            current_stock,
            active
          )
        `)
        .gt("quantidade_disponivel", 0)
        .order("produto_nome", { ascending: true })
        .limit(400);
      
      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        sku: item.products?.sku || null,
        imagem_url: item.products?.image_url || null,
        product_current_stock: item.products?.current_stock ?? null,
        product_active: item.products?.active ?? true,
      })) as (StockProduct & { product_current_stock?: number | null; product_active?: boolean })[];
    },
    staleTime: 5_000,
    gcTime: 60_000,
  });

  // 2. Mapeia TODOS os produto_id presentes em stock_products para nunca ressuscitar produtos zerados via fallback
  const { data: registeredStockProdIds = new Set<string>() } = useQuery({
    queryKey: ["stock_products_registered_ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_products")
        .select("produto_id");
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.produto_id).filter(Boolean) as string[]);
    },
    staleTime: 5_000,
    gcTime: 60_000,
  });

  // 3. Fallback: produtos cadastrados que possuem estoque mas NUNCA tiveram linha em stock_products
  const { data: fallbackProducts = [], isLoading: isLoadingFallback } = useQuery({
    queryKey: ["products_pos_fallback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, category, sale_price, current_stock, image_url, active")
        .gt("current_stock", 0)
        .order("name", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data || []).filter((p: any) => p.active !== false && Number(p.current_stock ?? 0) > 0);
    },
    staleTime: 5_000,
    gcTime: 60_000,
  });

  // Lista unificada em memória com filtragem estrita contra estoque zerado
  const availableItems = React.useMemo(() => {
    // 1. Filtra itens do estoque detalhado
    const fromStock = stockItems
      .filter((item) => {
        // Se o produto foi inativado no sistema, descarta
        if (item.product_active === false) return false;

        // Se a tabela mestre 'products' reporta estoque <= 0, o produto está ZERADO
        if (item.product_current_stock !== null && item.product_current_stock !== undefined) {
          if (Number(item.product_current_stock) <= 0) return false;
        }

        // Se quantidade_disponivel for <= 0, o produto está ZERADO
        const stockQty = Number(item.quantidade_disponivel ?? 0);
        if (stockQty <= 0) return false;

        // Se for calçado ou possuir grade de numerações
        if (item.numeracoes && typeof item.numeracoes === "object") {
          const sizeEntries = Object.entries(item.numeracoes as Record<string, any>);
          if (sizeEntries.length > 0) {
            const sumSizes = sizeEntries.reduce((acc, [_, qty]) => {
              const n = Number(qty);
              return acc + (n > 0 ? n : 0);
            }, 0);
            // Se todas as numerações estão zeradas, descarta o produto
            if (sumSizes <= 0) return false;
          }
        }

        return true;
      })
      .map((item) => {
        // Ajusta a quantidade exibida para a quantidade real e conservadora
        let realQty = Number(item.quantidade_disponivel ?? 0);

        if (item.numeracoes && typeof item.numeracoes === "object") {
          const sizeEntries = Object.entries(item.numeracoes as Record<string, any>);
          if (sizeEntries.length > 0) {
            const sumSizes = sizeEntries.reduce((acc, [_, qty]) => {
              const n = Number(qty);
              return acc + (n > 0 ? n : 0);
            }, 0);
            if (sumSizes > 0) {
              realQty = Math.min(realQty, sumSizes);
            }
          }
        }

        if (item.product_current_stock !== null && item.product_current_stock !== undefined && Number(item.product_current_stock) > 0) {
          realQty = Math.min(realQty, Number(item.product_current_stock));
        }

        return {
          ...item,
          quantidade_disponivel: realQty,
        } as StockProduct;
      });

    // 2. Fallback: somente para produtos órfãos que NÃO existem na tabela stock_products
    const virtuals: StockProduct[] = fallbackProducts
      .filter((p: any) => {
        // Se o produto já possui registro em stock_products, o estoque oficial é de stock_products (não ressuscita)
        if (registeredStockProdIds.has(p.id)) return false;
        if (Number(p.current_stock ?? 0) <= 0) return false;
        return true;
      })
      .map((p: any) => ({
        id: `virtual:${p.id}`,
        produto_id: p.id,
        produto_nome: p.name,
        quantidade_disponivel: Number(p.current_stock ?? 0),
        preco_venda: Number(p.sale_price ?? 0),
        numeracoes: null,
        categoria: p.category ?? null,
        sku: p.sku ?? null,
        imagem_url: p.image_url ?? null,
      }));

    // 3. Garante que NENHUM produto com saldo <= 0 seja retornado
    return [...fromStock, ...virtuals]
      .filter((item) => Number(item.quantidade_disponivel ?? 0) > 0)
      .sort((a, b) => (a.produto_nome || "").localeCompare(b.produto_nome || ""));
  }, [stockItems, registeredStockProdIds, fallbackProducts]);

  // Filtro inteligente e rápido por texto (nome, SKU ou categoria)
  const filteredItems = React.useMemo(() => {
    // Filtragem estrita: somente produtos com estoque real > 0
    const inStockItems = availableItems.filter((i) => Number(i.quantidade_disponivel ?? 0) > 0);
    const clean = query.trim().toLowerCase();
    if (!clean) {
      // Quando vazio, exibe os 25 primeiros produtos disponíveis
      return inStockItems.slice(0, 25);
    }

    const matches = inStockItems.filter((item) => {
      const name = (item.produto_nome || "").toLowerCase();
      const sku = (item.sku || "").toLowerCase();
      const cat = (item.categoria || "").toLowerCase();
      return name.includes(clean) || sku.includes(clean) || cat.includes(clean);
    });

    // Ordena priorizando correspondência exata no início
    return matches.slice(0, 30);
  }, [availableItems, query]);

  // Fecha o dropdown ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedStock(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProduct = (item: StockProduct) => {
    const qty = Number(item.quantidade_disponivel ?? 0);
    if (qty <= 0) {
      toast.error(`O produto "${item.produto_nome}" está com o estoque zerado.`);
      return;
    }

    // Se o produto possui numerações cadastradas, verifica se há pelo menos um tamanho com estoque
    if (item.numeracoes && typeof item.numeracoes === "object" && Object.keys(item.numeracoes).length > 0) {
      const hasAnySizeInStock = Object.values(item.numeracoes as Record<string, any>).some((q) => Number(q) > 0);
      if (!hasAnySizeInStock) {
        toast.error(`Todas as numerações de "${item.produto_nome}" estão esgotadas.`);
        return;
      }
      setSelectedStock(item);
    } else {
      // Produto padrão: adiciona diretamente, fecha e foca o campo novamente
      onAdd(item, null);
      setIsOpen(false);
      setSelectedStock(null);
      setQuery("");
      inputRef.current?.focus();
    }
  };

  const handleSelectSize = (size: string) => {
    if (!selectedStock) return;
    const sizeQty = Number(selectedStock.numeracoes?.[size] ?? 0);
    if (sizeQty <= 0) {
      toast.error(`A numeração ${size} está sem estoque disponível.`);
      return;
    }
    onAdd(selectedStock, size);
    setIsOpen(false);
    setSelectedStock(null);
    setQuery("");
    inputRef.current?.focus();
  };

  // Suporte a leitor de código de barras ou Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedStock(null);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const clean = query.trim().toLowerCase();
      if (!clean) return;

      // 1. Procura match exato de SKU ou ID
      const exactMatch = availableItems.find(
        (i) => (i.sku || "").toLowerCase() === clean || i.id.toLowerCase() === clean
      );
      if (exactMatch) {
        handleSelectProduct(exactMatch);
        return;
      }

      // 2. Se houver apenas 1 produto filtrado, adiciona ele
      if (filteredItems.length === 1 && filteredItems[0]) {
        handleSelectProduct(filteredItems[0]);
      }
    }
  };

  const isLoading = isLoadingStock || isLoadingFallback;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Barra de Busca ÚNICA Direta */}
      <div className="relative flex items-center">
        <Search className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            if (selectedStock) setSelectedStock(null);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar produto por nome, código SKU ou bipar..."
          className="h-12 w-full pl-12 pr-10 rounded-2xl bg-card border-border/50 text-sm font-medium shadow-xs focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold transition-all"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedStock(null);
              inputRef.current?.focus();
            }}
            className="absolute right-3.5 p-1 text-muted-foreground hover:text-foreground rounded-full transition-colors"
            title="Limpar busca"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Lista Dropdown Única que abre diretamente abaixo da barra */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-popover/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {!selectedStock ? (
            <div>
              <div className="px-4 py-2 border-b border-border/40 bg-muted/20 flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>
                  {query.trim() ? `Resultados para "${query}" (${filteredItems.length})` : "Produtos Disponíveis em Estoque"}
                </span>
                {isLoading && (
                  <span className="flex items-center gap-1 text-primary lowercase">
                    <Loader2 className="size-3 animate-spin" /> carregando...
                  </span>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto divide-y divide-border/20">
                {isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span>Carregando catálogo de produtos...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
                    <p className="font-bold text-foreground">Nenhum produto encontrado</p>
                    <p className="text-xs opacity-75">Tente buscar por outra palavra-chave ou código.</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectProduct(item)}
                      className="group flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      {/* Imagem do Produto */}
                      {item.imagem_url ? (
                        <div className="size-11 rounded-xl overflow-hidden shrink-0 border border-border/30 bg-muted/10">
                          <img
                            src={item.imagem_url}
                            alt={item.produto_nome}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <div className="size-11 rounded-xl bg-muted/30 border border-border/20 flex items-center justify-center shrink-0 text-muted-foreground">
                          <Package className="size-5" />
                        </div>
                      )}

                      {/* Informações do Produto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {item.produto_nome}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {item.categoria && (
                            <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1.5 font-semibold bg-muted/60">
                              {item.categoria}
                            </Badge>
                          )}
                          {item.sku && (
                            <span className="text-[11px] font-mono opacity-80 flex items-center gap-0.5">
                              <Barcode className="size-3" /> {item.sku}
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Estoque: {item.quantidade_disponivel} un.
                          </span>
                        </div>
                      </div>

                      {/* Preço de Venda */}
                      <div className="text-right shrink-0">
                        <span className="font-display font-black text-sm text-primary">
                          {brl(item.preco_venda)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Sub-tela elegante de seleção de numeração quando aplicável */
            <div className="p-4 space-y-3.5 animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 rounded-lg text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedStock(null)}
                  >
                    <ArrowLeft className="size-3.5" /> Voltar
                  </Button>
                  <span className="font-bold text-xs truncate">
                    Tamanho para: <strong className="text-foreground">{selectedStock.produto_nome}</strong>
                  </span>
                </div>
                <Badge variant="outline" className="text-xs font-bold text-primary border-primary/20 shrink-0">
                  {brl(selectedStock.preco_venda)}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                  <Hash className="size-3" /> Numerações com estoque disponível:
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {Object.entries(selectedStock.numeracoes as Record<string, number>)
                    .filter(([_, qty]) => Number(qty) > 0)
                    .map(([size, qty]) => (
                      <Button
                        key={size}
                        type="button"
                        variant="outline"
                        className="h-12 flex flex-col gap-0 rounded-xl hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                        onClick={() => handleSelectSize(size)}
                      >
                        <span className="text-sm font-black">{size}</span>
                        <span className="text-[9px] opacity-70 font-semibold">{qty} un</span>
                      </Button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
