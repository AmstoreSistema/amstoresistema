import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Package, 
  Search,
  Filter,
  Plus,
  History,
  AlertTriangle,
  Warehouse,
  Barcode,
  Calendar,
  Pencil,
  Settings2,
  CircleDollarSign,
  TrendingUp,
  DollarSign,
  Trash2
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
import { useRows, useSaveRow, useDeleteRow } from "@/lib/data";
import { AddProductDirectModal } from "@/components/stock/AddProductDirectModal";

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
  color: string | null;
};

type StockRecord = {
  id: string;
  produto_id: string;
  lote: string | null;
  localizacao: string | null;
  data_entrada: string | null;
  numeracoes: Record<string, number> | null;
};

function StockPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: stockRecords = [] } = useRows<StockRecord>("stock_products");
  const save = useSaveRow("products", "estoque");
  const remove = useDeleteRow("products", "estoque");
  const saveStock = useSaveRow("stock_products", "estoque detalhado");
  const removeStock = useDeleteRow("stock_products", "estoque detalhado");

  const [term, setTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [sizeDetailOpen, setSizeDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<{ size: string; quantity: number } | null>(null);
  const [newQty, setNewQty] = useState("");
  const [adjustQuantities, setAdjustQuantities] = useState<Record<string, number>>({});
  const [addDirectOpen, setAddDirectOpen] = useState(false);

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

  const handleAdjust = async () => {
    if (!selectedProduct) return;

    const stockRecord = stockRecords.find(s => s.produto_id === selectedProduct.id);
    const isSandalia = selectedProduct.category === "Sandálias";

    try {
      let totalQty = 0;
      if (isSandalia) {
        totalQty = Object.values(adjustQuantities).reduce((a, b) => a + (Number(b) || 0), 0);
      } else {
        totalQty = Number(newQty);
      }

      // Update product table
      await save.mutateAsync({
        id: selectedProduct.id,
        values: { 
          current_stock: totalQty, 
          updated_at: new Date().toISOString() 
        }
      });

      // Update stock_products table if record exists
      if (stockRecord) {
        await saveStock.mutateAsync({
          id: stockRecord.id,
          values: {
            quantidade_disponivel: totalQty,
            numeracoes: isSandalia ? adjustQuantities : null
          }
        });
      }

      setAdjustOpen(false);
      setNewQty("");
      setAdjustQuantities({});
      toast.success("Estoque ajustado com sucesso");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ajustar estoque");
    }
  };

  const handleDeleteItem = async (productId: string) => {
    if (!confirm("Deseja realmente excluir este item do estoque? Esta ação é irreversível.")) return;

    try {
      const stockRecord = stockRecords.find(s => s.produto_id === productId);
      
      // Delete from stock_products first (foreign key)
      if (stockRecord) {
        await removeStock.mutateAsync(stockRecord.id);
      }
      
      // Delete from products
      await remove.mutateAsync(productId);
      
      toast.success("Item removido do estoque");
      qc.invalidateQueries();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover item");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Estoque" 
        description="Produtos acabados prontos para venda"
        icon={Warehouse}
        actions={
          <div className="flex gap-2">
             <Button variant="outline" className="gap-2">
                <History className="size-4" /> Histórico
             </Button>
             <Button onClick={() => setAddDirectOpen(true)} className="gap-2 bg-success hover:bg-success/90 border-none shadow-lg shadow-success/20 font-bold text-white">
                <Plus className="size-4" /> Adicionar Produto Direto
             </Button>
             <Button onClick={() => window.location.href = "/production"} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
                <Plus className="size-4" /> Nova Produção
             </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total de Itens" value={stats.total} icon={Package} tone="dark" sub="0 produto(s)" />
        <StatCard title="Estoque baixo" value={stats.low} icon={AlertTriangle} tone="destructive" />
        <StatCard title="Custo Total" value={brl(0)} icon={CircleDollarSign} tone="destructive" />
        <StatCard title="Valor Varejo" value={brl(0)} icon={TrendingUp} tone="success" />
        <StatCard title="Valor Atacado" value={brl(0)} icon={DollarSign} tone="gold" />
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
          {filtered.map(p => {
            const stockRecord = stockRecords.find(s => s.produto_id === p.id);
            const numeracoes = stockRecord?.numeracoes || {};
            const allSizes = Object.entries(numeracoes as Record<string, number>)
              .map(([size, qty]) => ({ size, qty: Number(qty) }));
            const availableSizes = allSizes.filter(s => s.qty > 0).map(s => s.size);

            return (
              <Card key={p.id} className="group overflow-hidden rounded-[2rem] border-border/30 bg-card transition-all hover:shadow-xl shadow-elegant flex flex-col">
                <div className="relative aspect-video bg-muted/20 shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/10">
                      <Package className="size-16" />
                    </div>
                  )}
                </div>
                
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="mb-4">
                    <div className="flex justify-between items-start gap-2">
                       <h3 className="line-clamp-2 font-display font-black leading-tight flex-1 text-sm md:text-base">{p.name}</h3>
                       <div className="bg-success/10 text-success text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                          {p.current_stock}
                       </div>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1 flex items-center gap-1">
                      <Barcode className="size-3" /> {p.sku || "—"}
                    </p>
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Data de Entrada:</span>
                        <span className="font-medium text-right">{dateBR(stockRecord?.data_entrada || p.updated_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Categoria:</span>
                        <span className="font-medium text-right">{p.category}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground font-medium">Lote:</span>
                        <span className="font-mono text-[9px] truncate max-w-[150px] text-right">{stockRecord?.lote || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Cor:</span>
                        <span className="font-medium text-right">{p.color || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Localização:</span>
                        <span className="font-medium text-primary text-right">{stockRecord?.localizacao || "—"}</span>
                      </div>
                    </div>

                    {availableSizes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Numerações:</p>
                        <div className="flex flex-wrap gap-1">
                          {allSizes.length > 0 ? allSizes.map(({ size, qty }) => (
                            <Badge 
                              key={size} 
                              className={`px-2 py-0 h-5 text-[10px] font-black border-none cursor-pointer transition-all ${
                                qty > 0 ? "bg-black text-white hover:bg-black/80" : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-40"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(p);
                                setSelectedSizeInfo({ size, quantity: qty });
                                setSizeDetailOpen(true);
                              }}
                            >
                              {size}
                            </Badge>
                          )) : availableSizes.map(size => (
                            <Badge 
                              key={size} 
                              className="bg-black text-white hover:bg-black px-2 py-0 h-5 text-[10px] font-black border-none cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(p);
                                setSelectedSizeInfo({ size, quantity: numeracoes[size] as number });
                                setSizeDetailOpen(true);
                              }}
                            >
                              {size}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/30">
                      <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest mb-2">Valores Unitários</p>
                      <div className="grid grid-cols-3 gap-2">
                         <div className="text-left">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Custo</p>
                            <p className="font-bold text-[11px] text-orange-500">{brl(p.cost_price)}</p>
                         </div>
                         <div className="text-left border-x border-border/40 px-2">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Varejo</p>
                            <p className="font-bold text-[11px] text-success">{brl(p.sale_price)}</p>
                         </div>
                         <div className="text-left pl-2">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Atacado</p>
                            <p className="font-bold text-[11px] text-blue-600">{brl(p.wholesale_price)}</p>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg flex-1">
                      <TrendingUp className="size-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Disponível para venda</span>
                    </div>
                    <Button 
                       variant="outline" 
                       size="icon"
                       className="size-9 rounded-lg border-border/40 hover:bg-muted"
                       onClick={() => {
                          setSelectedProduct(p);
                          setNewQty(p.current_stock.toString());
                          setAdjustQuantities(stockRecord?.numeracoes || {});
                          setAdjustOpen(true);
                       }}
                    >
                       <Pencil className="size-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <Button 
                      variant="ghost" 
                      className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 font-bold h-7 gap-1"
                      onClick={() => handleDeleteItem(p.id)}
                    >
                      <Trash2 className="size-3" /> Excluir Item do Estoque
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
             {selectedProduct?.category === "Sandálias" ? (
               <div className="space-y-4">
                 <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Numerações</Label>
                 <div className="grid grid-cols-4 gap-3">
                   {["33", "34", "35", "36", "37", "38", "39", "40"].map(size => (
                     <div key={size} className="space-y-1.5">
                       <Label className="text-[10px] font-bold block text-center">{size}</Label>
                       <Input 
                         type="number" 
                         value={adjustQuantities[size] || 0}
                         onChange={e => setAdjustQuantities({...adjustQuantities, [size]: Number(e.target.value)})}
                         className="h-10 text-center font-bold"
                       />
                     </div>
                   ))}
                 </div>
                 <div className="pt-2 border-t text-right">
                   <span className="text-xs font-bold">Total: {Object.values(adjustQuantities).reduce((a, b) => a + (Number(b) || 0), 0)}</span>
                 </div>
               </div>
             ) : (
               <>
                 <Label className="mb-2 block">Novo saldo disponível</Label>
                 <Input 
                    type="number" 
                    value={newQty} 
                    onChange={e => setNewQty(e.target.value)}
                    placeholder={`Saldo atual: ${selectedProduct?.current_stock}`}
                    className="h-12 text-lg font-bold"
                 />
               </>
             )}
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
             <Button onClick={handleAdjust} disabled={save.isPending}>Salvar Ajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
      <AddProductDirectModal open={addDirectOpen} onOpenChange={setAddDirectOpen} />
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
