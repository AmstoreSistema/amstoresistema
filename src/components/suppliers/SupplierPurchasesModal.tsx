import { X, ShoppingCart, Calendar, Package } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { Badge } from "@/components/ui/badge";

interface SupplierPurchasesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: any;
}

export function SupplierPurchasesModal({ open, onOpenChange, supplier }: SupplierPurchasesModalProps) {
  const { data: purchases = [], isLoading } = useRows<any>("purchases", {
    filters: supplier ? [{ column: "supplier", value: supplier.name }] : undefined,
    order: { column: "created_at", ascending: false }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[95vw] overflow-y-auto sm:max-w-2xl rounded-3xl p-0 border-none bg-white [&>button]:hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Compras: {supplier?.name}</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{supplier?.category}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-6">
          {isLoading ? (
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
                      variant={purchase.status === 'received' ? 'default' : 'secondary'} 
                      className={purchase.status === 'received' ? 'bg-success text-white' : ''}
                    >
                      {purchase.status === 'received' ? 'Recebido' : 'Pendente'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-3">
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Quantidade</p>
                        <p className="text-sm font-bold">{purchase.quantity}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase">Valor Total</p>
                      <p className="text-sm font-bold text-success">{brl(purchase.quantity * purchase.unit_cost)}</p>
                    </div>
                  </div>
                  
                  {purchase.notes && (
                    <div className="rounded-lg bg-muted/30 p-2 text-xs text-muted-foreground">
                      {purchase.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <ShoppingCart className="mx-auto size-12 text-muted-foreground/20" />
              <p className="mt-4 text-muted-foreground">Nenhuma compra registrada para este fornecedor.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
