import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { 
  Package, 
  Search,
  ArrowRight,
  ShoppingBag,
  Barcode,
  Loader2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { useRows } from "@/lib/data";

// Normalizador tolerante para categorias de sandálias
const normalizeCat = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/s$/, "");

const isSandaliaCat = (category: unknown) => {
  const norm = normalizeCat(category);
  return norm.includes("sandalia") || norm.includes("calcado") || norm.includes("rasteira") || norm.includes("chinelo");
};

import { z } from "zod";

const catalogSearchSchema = z.object({
  size: z.string().optional().catch("Todas"),
  category: z.string().optional().catch("Todos"),
  term: z.string().optional().catch(""),
});

export const Route = createFileRoute("/_authenticated/catalog")({
  validateSearch: (search) => catalogSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Catálogo — Amstore Gestão" },
      { name: "description", content: "Catálogo visual de produtos para consulta." },
    ],
  }),
  component: CatalogPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  sale_price: number;
  current_stock: number;
  image_url: string | null;
  color: string | null;
};

type StockRecord = {
  id: string;
  produto_id: string;
  numeracoes: Record<string, number> | null;
};

function CatalogPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = useSearch({ from: "/_authenticated/catalog" });

  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: stockRecords = [] } = useRows<StockRecord>("stock_products");
  
  const [term, setTerm] = useState(search.term || "");
  const [activeCategory, setActiveCategory] = useState(search.category || "Todos");
  const [selectedSizeFilter, setSelectedSizeFilter] = useState(search.size || "Todas");
  const [sizeDetailOpen, setSizeDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<{ size: string; quantity: number } | null>(null);
  
  // Pagination state
  const ITEMS_PER_PAGE = 12;
  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);

  // Sync filters with URL
  useEffect(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        term: term || undefined,
        category: activeCategory !== "Todos" ? activeCategory : undefined,
        size: selectedSizeFilter !== "Todas" ? selectedSizeFilter : undefined,
      }),
      replace: true,
    });
    // Reset pagination when filters change
    setVisibleItems(ITEMS_PER_PAGE);
  }, [term, activeCategory, selectedSizeFilter, navigate]);

  // Agrupa e soma as numerações por produto_id (caso haja múltiplos lotes ou registros de estoque)
  const stockNumeracoesMap = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    stockRecords.forEach(record => {
      if (!record.produto_id) return;
      const current = map.get(record.produto_id) || {};
      if (record.numeracoes && typeof record.numeracoes === "object") {
        Object.entries(record.numeracoes).forEach(([size, qty]) => {
          current[size] = (current[size] || 0) + (Number(qty) || 0);
        });
      }
      map.set(record.produto_id, current);
    });
    return map;
  }, [stockRecords]);

  const categories = useMemo(() => ["Todos", ...new Set(products.map(p => p.category))], [products]);

  const allAvailableSizes = useMemo(() => {
    const sizes = new Set<string>();
    stockRecords.forEach(record => {
      if (record.numeracoes && typeof record.numeracoes === "object") {
        Object.entries(record.numeracoes).forEach(([size, qty]) => {
          if (Number(qty) > 0) sizes.add(size);
        });
      }
    });
    return ["Todas", ...Array.from(sizes).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    })];
  }, [stockRecords]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesTerm = (p.name || "").toLowerCase().includes(term.toLowerCase()) || (p.sku?.toLowerCase().includes(term.toLowerCase()));
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      
      let matchesSize = selectedSizeFilter === "Todas";
      if (!matchesSize) {
        const numeracoes = stockNumeracoesMap.get(p.id);
        if (numeracoes) {
          matchesSize = (numeracoes[selectedSizeFilter] || 0) > 0;
        } else {
          matchesSize = false;
        }
      }

      return matchesTerm && matchesCategory && matchesSize;
    });
  }, [products, term, activeCategory, selectedSizeFilter, stockNumeracoesMap]);

  const paginatedItems = useMemo(() => {
    return filtered.slice(0, visibleItems);
  }, [filtered, visibleItems]);

  const hasMore = visibleItems < filtered.length;

  const loadMore = () => {
    setVisibleItems(prev => prev + ITEMS_PER_PAGE);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Catálogo de Produtos" 
        description="Navegue pelos produtos com estoque atualizado"
        icon={ShoppingBag}
      />

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou código..." 
            className="pl-10 h-11 rounded-xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={activeCategory} onValueChange={setActiveCategory}>
            <SelectTrigger className="w-[180px] h-11 rounded-xl">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedSizeFilter} onValueChange={setSelectedSizeFilter}>
            <SelectTrigger className="w-[150px] h-11 rounded-xl">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              {allAvailableSizes.map(s => <SelectItem key={s} value={s}>{s === "Todas" ? "Todos Tamanhos" : `Tamanho ${s}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-96 animate-pulse rounded-[2rem] bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedItems.map(p => {
            const numeracoes = stockNumeracoesMap.get(p.id) || {};
            const allSizes = Object.entries(numeracoes)
              .map(([size, qty]) => ({ size, qty: Number(qty) || 0 }))
              .sort((a, b) => {
                const numA = Number(a.size);
                const numB = Number(b.size);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.size.localeCompare(b.size, undefined, { numeric: true });
              });
            const availableSizes = allSizes.filter(s => s.qty > 0);
            const isSandalia = isSandaliaCat(p.category) || allSizes.length > 0;

            return (
              <Card key={p.id} className="group overflow-hidden rounded-[2rem] border-border/30 bg-card transition-all hover:shadow-xl shadow-elegant flex flex-col">
                <div className="relative aspect-square overflow-hidden bg-muted/20 shrink-0">
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      alt={p.name} 
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/10">
                      <Package className="size-20" />
                    </div>
                  )}
                </div>
                
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="mb-4">
                    <h3 className="line-clamp-1 font-display font-black text-lg leading-tight group-hover:text-gold transition-colors">{p.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground border-border/40">
                        {p.category}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        Estoque: {p.current_stock}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1 flex flex-col">
                    {isSandalia && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Numerações:</p>
                          {availableSizes.length > 0 && (
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {availableSizes.length} {availableSizes.length === 1 ? "disp." : "disp."}
                            </span>
                          )}
                        </div>
                        {allSizes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {allSizes.map(({ size, qty }) => (
                              <Badge 
                                key={size} 
                                className={`px-2 py-0 h-5 text-[10px] font-black border-none cursor-pointer transition-all ${
                                  qty > 0 
                                    ? "bg-black text-white hover:bg-black/80 hover:scale-105 active:scale-95 shadow-sm" 
                                    : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-40"
                                }`}
                                title={qty > 0 ? `Tamanho ${size}: ${qty} unid. disponíveis (clique para ver detalhes)` : `Tamanho ${size}: Esgotado`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProduct(p);
                                  setSelectedSizeInfo({ size, quantity: qty });
                                  setSizeDetailOpen(true);
                                }}
                              >
                                {size}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">
                            {p.current_stock > 0 ? "Grade não detalhada no estoque" : "Esgotado"}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-border/30">
                       <div className="bg-muted/30 rounded-2xl p-4 text-center">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Valor de Varejo</p>
                          <p className="text-2xl font-black text-slate-800 font-display">{brl(p.sale_price)}</p>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-8">
          <Button 
            variant="outline" 
            className="rounded-2xl px-12 h-14 font-black uppercase tracking-widest border-border/40 hover:bg-gold hover:text-white transition-all gap-2"
            onClick={loadMore}
          >
            Carregar Mais Produtos
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
      
      {filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
           <div className="size-20 bg-muted/30 rounded-full flex items-center justify-center mb-6">
              <Search className="size-10 text-muted-foreground/30" />
           </div>
           <h3 className="text-xl font-bold mb-2">Nenhum produto encontrado</h3>
           <p className="text-muted-foreground max-w-sm">Tente ajustar seus filtros ou busca para encontrar o que deseja.</p>
        </div>
      )}

      <Dialog open={sizeDetailOpen} onOpenChange={setSizeDetailOpen}>
        <DialogContent className="sm:max-w-[320px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-gold p-6 flex flex-col items-center text-white text-center">
            {selectedProduct?.image_url ? (
              <img 
                src={selectedProduct.image_url} 
                alt={selectedProduct.name} 
                className="size-16 rounded-2xl object-cover mb-4 border border-white/40 shadow-md"
              />
            ) : (
              <div className="size-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 border border-white/30">
                <Package className="size-8" />
              </div>
            )}
            <DialogHeader className="space-y-1 text-center">
              <DialogTitle className="font-display font-black text-lg leading-tight text-white">
                {selectedProduct?.name}
              </DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-wider text-white/80 font-bold">
                Grade de Estoque
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-6 sm:p-8 flex flex-col items-center gap-5">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1.5">Tamanho</span>
              <div className="size-16 rounded-2xl bg-black flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-black">{selectedSizeInfo?.size}</span>
              </div>
            </div>

            <div className="w-full h-px bg-border/40" />

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1.5">Qtd Disponível</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl font-display font-black ${(selectedSizeInfo?.quantity || 0) > 0 ? "text-success" : "text-destructive"}`}>
                  {selectedSizeInfo?.quantity || 0}
                </span>
                <span className="text-[10px] font-black text-muted-foreground uppercase">
                  {(selectedSizeInfo?.quantity || 0) === 1 ? "Unidade" : "Unidades"}
                </span>
              </div>
            </div>

            <Button 
              className="w-full bg-muted/60 hover:bg-muted text-foreground font-black text-xs uppercase tracking-wider h-11 rounded-xl mt-1 border-none"
              onClick={() => setSizeDetailOpen(false)}
            >
              FECHAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


