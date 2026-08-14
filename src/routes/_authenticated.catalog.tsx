import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Package, 
  Search,
  ArrowRight,
  ShoppingBag,
  Barcode
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
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { useRows } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/catalog")({
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
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: stockRecords = [] } = useRows<StockRecord>("stock_products");
  
  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [selectedSizeFilter, setSelectedSizeFilter] = useState("Todas");
  const [sizeDetailOpen, setSizeDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<{ size: string; quantity: number } | null>(null);

  // Indexing stock records by produto_id for O(1) lookup
  const stockMap = useMemo(() => {
    const map = new Map<string, StockRecord>();
    stockRecords.forEach(record => {
      map.set(record.produto_id, record);
    });
    return map;
  }, [stockRecords]);

  const categories = useMemo(() => ["Todos", ...new Set(products.map(p => p.category))], [products]);

  const allAvailableSizes = useMemo(() => {
    const sizes = new Set<string>();
    stockRecords.forEach(record => {
      if (record.numeracoes) {
        Object.entries(record.numeracoes).forEach(([size, qty]) => {
          if (Number(qty) > 0) sizes.add(size);
        });
      }
    });
    return ["Todas", ...Array.from(sizes).sort((a, b) => a.localeCompare(b))];
  }, [stockRecords]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesTerm = (p.name || "").toLowerCase().includes(term.toLowerCase()) || (p.sku?.toLowerCase().includes(term.toLowerCase()));
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      
      let matchesSize = selectedSizeFilter === "Todas";
      if (!matchesSize) {
        const stockRecord = stockMap.get(p.id);
        if (stockRecord?.numeracoes) {
          matchesSize = (stockRecord.numeracoes[selectedSizeFilter] || 0) > 0;
        }
      }

      return matchesTerm && matchesCategory && matchesSize;
    });
  }, [products, term, activeCategory, selectedSizeFilter, stockMap]);

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
          {filtered.map(p => {
            const stockRecord = stockMap.get(p.id);
            const numeracoes = stockRecord?.numeracoes || {};
            const allSizes = Object.entries(numeracoes as Record<string, number>)
              .map(([size, qty]) => ({ size, qty: Number(qty) }))
              .sort((a, b) => a.size.localeCompare(b.size));
            const availableSizes = allSizes.filter(s => s.qty > 0);

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

                  <div className="space-y-4 flex-1">
                    {p.category === "Sandália" && availableSizes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Numerações:</p>
                        <div className="flex flex-wrap gap-1">
                          {availableSizes.map(({ size, qty }) => (
                            <Badge 
                              key={size} 
                              className="bg-black text-white px-2 py-0 h-6 text-xs font-black border-none cursor-pointer hover:bg-black/80 transition-all"
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
            <div className="size-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 border border-white/30">
              <Package className="size-8" />
            </div>
            <h3 className="font-display font-black text-lg leading-tight">{selectedProduct?.name}</h3>
            <p className="text-[10px] uppercase tracking-tighter opacity-80 font-bold mt-1">Gradeado de Estoque</p>
          </div>
          
          <div className="p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Tamanho</span>
              <div className="size-16 rounded-2xl bg-black flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-black">{selectedSizeInfo?.size}</span>
              </div>
            </div>

            <div className="w-full h-px bg-border/40" />

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Qtd Disponível</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-display font-black text-success">{selectedSizeInfo?.quantity}</span>
                <span className="text-[10px] font-black text-muted-foreground uppercase">Unidades</span>
              </div>
            </div>

            <Button 
              className="w-full bg-muted/50 hover:bg-muted text-foreground font-black text-[10px] uppercase tracking-widest h-10 rounded-xl mt-2 border-none"
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


