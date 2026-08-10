import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Package, 
  Search,
  Filter,
  Plus,
  ArrowRight,
  History,
  AlertTriangle,
  Boxes,
  Barcode,
  Calendar,
  Pencil,
  Settings2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { brl, num, dateBR } from "@/lib/format";
import { useRows, useSaveRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({
    meta: [
      { title: "Estoque — Amstore Gestão" },
      { name: "description", content: "Controle de estoque de produtos e materiais." },
    ],
  }),
  component: StockPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  current_stock: number;
  min_stock: number;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  wholesale_price: number;
  updated_at: string | null;
};

function StockPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const save = useSaveRow("products", "estoque");

  const [term, setTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newQty, setNewQty] = useState("");

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesTerm = (p.name || "").toLowerCase().includes(term.toLowerCase()) || (p.sku || "").toLowerCase().includes(term.toLowerCase());
      const matchesTab = activeTab === "Todos" || (activeTab === "Crítico" && Number(p.current_stock) <= Number(p.min_stock));
      return matchesTerm && matchesTab;
    });
  }, [products, term, activeTab]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      low: products.filter(p => Number(p.current_stock) <= Number(p.min_stock)).length,
      totalValue: products.reduce((s, p) => s + (Number(p.current_stock) * Number(p.cost_price)), 0),
    };
  }, [products]);

  const handleAdjust = () => {
    if (!selectedProduct || !newQty) return;
    save.mutate({
      id: selectedProduct.id,
      values: { current_stock: Number(newQty), updated_at: new Date().toISOString() }
    }, {
      onSuccess: () => {
        setAdjustOpen(false);
        setNewQty("");
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Controle de Estoque" 
        description="Gestão de saldos, localizações e ajustes"
        icon={WarehouseIcon}
        actions={
          <div className="flex gap-2">
             <Button variant="outline" className="gap-2">
                <History className="size-4" /> Histórico
             </Button>
             <Button className="gap-2">
                <Plus className="size-4" /> Produto Direto
             </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Itens em Estoque" value={stats.total} icon={Package} tone="dark" />
        <StatCard title="Abaixo do Mínimo" value={stats.low} icon={AlertTriangle} tone="destructive" />
        <StatCard title="Investimento" value={brl(stats.totalValue)} icon={CircleDollarSign} tone="gold" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {["Todos", "Crítico", "Disponível"].map(t => (
            <Button 
              key={t}
              variant={activeTab === t ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(t)}
              className="rounded-full px-6"
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
           <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
             <Input 
               placeholder="Buscar por código de barras ou nome..." 
               className="pl-10 h-11 rounded-2xl bg-card border-border/40"
               value={term}
               onChange={e => setTerm(e.target.value)}
             />
           </div>
           <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl"><Filter className="size-4" /></Button>
           <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl"><Settings2 className="size-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-72 animate-pulse rounded-[2rem] bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <Card key={p.id} className="group overflow-hidden rounded-[2rem] border-border/30 bg-card transition-all hover:shadow-xl shadow-elegant">
              <div className="relative aspect-video bg-muted/20">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/10">
                    <Package className="size-16" />
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex gap-1">
                   <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm border-none text-[10px] py-0 px-2 uppercase tracking-tighter">
                      Geral
                   </Badge>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="mb-4">
                  <div className="flex justify-between items-start gap-2">
                     <h3 className="line-clamp-1 font-display font-black leading-tight flex-1">{p.name}</h3>
                     <Barcode className="size-5 text-muted-foreground/50 shrink-0" />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Ref: {p.sku || "—"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                   <div className="bg-muted/30 rounded-2xl p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Estoque</p>
                      <p className={cn("text-xl font-black", Number(p.current_stock) <= Number(p.min_stock) ? "text-destructive" : "text-success")}>
                         {p.current_stock}
                      </p>
                   </div>
                   <div className="bg-muted/30 rounded-2xl p-3">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Mínimo</p>
                      <p className="text-xl font-black text-muted-foreground">
                         {p.min_stock}
                      </p>
                   </div>
                </div>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Entrada:</span>
                    <span>{dateBR(p.updated_at)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Local:</span>
                    <span className="text-gold">Prateleira A1</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/30 pt-4">
                   <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Custo</p>
                      <p className="font-bold text-[11px]">{brl(p.cost_price)}</p>
                   </div>
                   <div className="text-center border-x border-border/40">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Varejo</p>
                      <p className="font-bold text-[11px] text-success">{brl(p.sale_price)}</p>
                   </div>
                   <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Atacado</p>
                      <p className="font-bold text-[11px] text-primary">{brl(p.wholesale_price)}</p>
                   </div>
                </div>

                <Button 
                   variant="ghost" 
                   className="w-full mt-4 rounded-xl h-10 gap-2 border border-border/40 hover:bg-gold hover:text-white transition-colors"
                   onClick={() => {
                      setSelectedProduct(p);
                      setAdjustOpen(true);
                   }}
                >
                   <Pencil className="size-4" /> Ajustar Estoque
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque</DialogTitle>
            <DialogDescription>
               Alterando saldo de <span className="font-bold text-foreground">{selectedProduct?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <Label className="mb-2 block">Novo saldo disponível</Label>
             <Input 
                type="number" 
                value={newQty} 
                onChange={e => setNewQty(e.target.value)}
                placeholder={`Saldo atual: ${selectedProduct?.current_stock}`}
                className="h-12 text-lg font-bold"
             />
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
             <Button onClick={handleAdjust} disabled={save.isPending}>Salvar Ajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WarehouseIcon(props: any) {
   return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 10v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10" />
        <path d="M2 10l10-8 10 8" />
        <path d="M6 22V10" />
        <path d="M14 22V10" />
        <path d="M18 22V10" />
      </svg>
   )
}

function CircleDollarSign(props: any) {
   return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
   )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
