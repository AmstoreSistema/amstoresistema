import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Package, 
  Search,
  ArrowRight,
  TrendingUp,
  Tag,
  AlertTriangle,
  Boxes,
  Layers,
  ShoppingBag
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { brl, num } from "@/lib/format";
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
};

function CatalogPage() {
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  
  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  const categories = useMemo(() => ["Todos", ...new Set(products.map(p => p.category))], [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesTerm = p.name.toLowerCase().includes(term.toLowerCase()) || (p.sku?.toLowerCase().includes(term.toLowerCase()));
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      return matchesTerm && matchesCategory;
    });
  }, [products, term, activeCategory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Catálogo de Produtos" 
        description="Visualize todos os produtos ativos do seu catálogo"
        icon={ShoppingBag}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <Button 
              key={c}
              variant={activeCategory === c ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(c)}
              className="rounded-full px-4"
            >
              {c}
            </Button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar no catálogo..." 
            className="pl-10 h-11 rounded-2xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-80 animate-pulse rounded-3xl bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <Card key={p.id} className="group overflow-hidden rounded-[2.5rem] border-border/30 bg-card transition-all hover:shadow-2xl hover:shadow-gold/10 hover:-translate-y-1">
              <div className="relative aspect-square overflow-hidden bg-muted/30">
                {p.image_url ? (
                  <img 
                    src={p.image_url} 
                    alt={p.name} 
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/10">
                    <Package className="size-24" />
                  </div>
                )}
                <div className="absolute top-4 left-4">
                   <Badge className="bg-white/80 text-black border-none backdrop-blur-md px-3 py-1 font-bold text-xs uppercase tracking-wider">
                      {p.category}
                   </Badge>
                </div>
                {p.current_stock <= 2 && (
                   <div className="absolute top-4 right-4">
                      <Badge variant="destructive" className="animate-pulse">
                         Últimas peças
                      </Badge>
                   </div>
                )}
              </div>
              <CardContent className="p-6">
                <div className="mb-4">
                   <h3 className="line-clamp-1 font-display text-lg font-extrabold group-hover:text-gold transition-colors">{p.name}</h3>
                   <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Ref: {p.sku || "—"}</p>
                </div>

                <div className="flex items-end justify-between mt-6">
                   <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Estoque</p>
                      <p className={cn("text-sm font-bold", p.current_stock > 0 ? "text-success" : "text-destructive")}>
                         {p.current_stock} un disponíveis
                      </p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Valor Unitário</p>
                      <p className="text-2xl font-black text-gold font-display">{brl(p.sale_price)}</p>
                   </div>
                </div>

                <Button className="w-full mt-6 rounded-2xl h-12 font-bold gap-2 group/btn bg-gradient-gold border-none shadow-gold hover:shadow-gold/40">
                   Ver Detalhes <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
