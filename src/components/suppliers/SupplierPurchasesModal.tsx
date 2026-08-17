import { X, ShoppingCart, Calendar, Package, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SupplierPurchasesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: any;
}

export function SupplierPurchasesModal({ open, onOpenChange, supplier }: SupplierPurchasesModalProps) {
  const { data: purchases = [], isLoading: loadingPurchases } = useRows<any>("purchases", {
    filters: supplier ? [{ column: "supplier_id", value: supplier.id }] : undefined,
    order: { column: "created_at", ascending: false }
  });

  const { data: priceHistory = [], isLoading: loadingHistory } = useRows<any>("purchase_items", {
    filters: supplier && purchases.length > 0 ? [{ column: "purchase_id", value: purchases.map((p: any) => p.id) }] : undefined,
    order: { column: "created_at", ascending: false }
  });

  const { data: materials = [] } = useRows<any>("materials");

  const getMaterialName = (id: string) => materials.find(m => m.id === id)?.name || "Material não encontrado";
  const getMaterialUnit = (id: string) => materials.find(m => m.id === id)?.unit || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-hidden sm:max-w-3xl rounded-[1.5rem] p-0 border-none bg-white [&>button]:hidden shadow-2xl flex flex-col">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/80 backdrop-blur-md px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
              <ShoppingCart className="size-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Painel do Fornecedor: {supplier?.name}</h2>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{supplier?.category}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full hover:bg-muted">
            <X className="size-4" />
          </Button>
        </div>

        <Tabs defaultValue="purchases" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-2 border-b bg-muted/20">
            <TabsList className="bg-transparent gap-4">
              <TabsTrigger value="purchases" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2">
                Histórico de Compras
              </TabsTrigger>
              <TabsTrigger value="prices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4 py-2">
                Variação de Preços
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="purchases" className="m-0 p-6 pb-12 outline-none">
              {loadingPurchases ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}
                </div>
              ) : purchases.length > 0 ? (
                <div className="space-y-4">
                  {purchases.map((purchase: any) => (
                    <div key={purchase.id} className="flex flex-col gap-4 rounded-2xl border border-border/50 p-4 transition-colors hover:bg-muted/10">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <ShoppingCart className="size-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">Compra #{purchase.id.slice(0, 8)}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                              <Calendar className="size-3" />
                              {dateBR(purchase.created_at)}
                            </div>
                          </div>
                        </div>
                        <Badge 
                          variant={purchase.status === 'recebido' ? 'default' : 'secondary'} 
                          className={purchase.status === 'recebido' ? 'bg-success text-white' : ''}
                        >
                          {purchase.status === 'recebido' ? 'Recebido' : 'Pendente'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-2">
                          <Package className="size-4 text-muted-foreground" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Itens da Compra</p>
                            <p className="text-xs font-medium text-muted-foreground">
                              {priceHistory.filter((i: any) => i.purchase_id === purchase.id).map((i: any) => `${i.quantity}${getMaterialUnit(i.material_id)} ${getMaterialName(i.material_id)}`).join(', ') || 'Ver detalhes'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase">Valor Total</p>
                          <p className="text-sm font-bold text-success">{brl(purchase.total_amount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <ShoppingCart className="mx-auto size-12 text-muted-foreground/20" />
                  <p className="mt-4 text-muted-foreground">Nenhuma compra registrada para este fornecedor.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="prices" className="m-0 p-6 pb-12 outline-none">
              <div className="mb-4 rounded-xl bg-blue-50/50 p-4 border border-blue-100/50">
                <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <TrendingUp className="size-4" /> Inteligência de Custos
                </h4>
                <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
                  Abaixo você acompanha a variação dos preços pagos por material. O sistema destaca reajustes e inflação nos seus insumos.
                </p>
              </div>

              {loadingHistory ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />)}
                </div>
              ) : priceHistory.length > 0 ? (
                <div className="rounded-2xl border border-border/50 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30 border-b border-border/50">
                      <tr>
                        <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Data</th>
                        <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Material</th>
                        <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Preço Unit.</th>
                        <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-widest text-muted-foreground text-right">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {priceHistory.map((item: any) => {
                        const diff = item.previous_cost ? item.unit_cost - item.previous_cost : 0;
                        const percent = item.previous_cost ? (diff / item.previous_cost) * 100 : 0;
                        
                        return (
                          <tr key={item.id} className="hover:bg-muted/5 transition-colors">
                            <td className="px-4 py-3 text-xs text-muted-foreground">{dateBR(item.created_at)}</td>
                            <td className="px-4 py-3 font-medium">{getMaterialName(item.material_id)}</td>
                            <td className="px-4 py-3 font-bold">{brl(item.unit_cost)}</td>
                            <td className="px-4 py-3 text-right">
                              {diff > 0 ? (
                                <div className="flex items-center justify-end gap-1 text-destructive font-bold text-xs">
                                  <TrendingUp className="size-3" />
                                  +{brl(diff)} ({percent.toFixed(1)}%)
                                </div>
                              ) : diff < 0 ? (
                                <div className="flex items-center justify-end gap-1 text-success font-bold text-xs">
                                  <TrendingDown className="size-3" />
                                  {brl(diff)} ({percent.toFixed(1)}%)
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1 text-muted-foreground text-xs">
                                  <Minus className="size-3" />
                                  Mantido
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <TrendingUp className="mx-auto size-12 text-muted-foreground/20" />
                  <p className="mt-4 text-muted-foreground">Sem histórico de variação de preços disponível.</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
