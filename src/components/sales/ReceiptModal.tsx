import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { brl, dateTimeBR } from "@/lib/format";
import { 
  Printer, 
  Download, 
  CheckCircle2,
  ExternalLink
} from "lucide-react";

export function ReceiptModal({ 
  open, 
  onOpenChange, 
  sale,
  client 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  sale: any;
  client: any;
}) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <div className="bg-success p-8 text-center text-white">
           <div className="size-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-10" />
           </div>
           <h3 className="font-display font-black text-2xl">Venda Concluída!</h3>
           <p className="text-sm opacity-90 mt-1">O pedido {sale.sale_code || `#${sale.id.slice(0, 8)}`} foi registrado.</p>
        </div>

        <div className="p-8 space-y-6 bg-background print:p-0">
           <div className="space-y-4">
              <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground tracking-widest">
                 <span>Cupom Fiscal Não Oficial</span>
                 <span>{dateTimeBR(new Date().toISOString())}</span>
              </div>
              <Separator />
              
              <div className="text-sm space-y-1">
                 <p className="font-bold">Cliente: {client?.name || "Consumidor Final"}</p>
                 {client?.phone && <p className="text-muted-foreground">{client.phone}</p>}
              </div>

              <div className="space-y-3 py-2">
                 {sale.items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-start text-sm">
                       <div className="flex-1 pr-4">
                          <p className="font-bold">{item.name || item.product_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                             {item.quantity}un x {brl(item.unit_price)}
                             {item.numeracao && ` · TAM: ${item.numeracao}`}
                          </p>
                       </div>
                       <span className="font-bold">{brl(item.quantity * item.unit_price)}</span>
                    </div>
                 ))}
              </div>

              <Separator />

              <div className="space-y-2">
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-bold">{brl(sale.total_amount + (sale.discount || 0))}</span>
                 </div>
                 {sale.discount > 0 && (
                   <div className="flex justify-between text-sm text-destructive">
                      <span>Desconto</span>
                      <span className="font-bold">-{brl(sale.discount)}</span>
                   </div>
                 )}
                 {sale.cashback_used > 0 && (
                   <div className="flex justify-between text-sm text-success">
                      <span>Cashback</span>
                      <span className="font-bold">-{brl(sale.cashback_used)}</span>
                   </div>
                 )}
                 <div className="flex justify-between text-lg font-display font-black pt-2">
                    <span>Total</span>
                    <span className="text-gold">{brl(sale.total_amount)}</span>
                 </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4 text-center">
                 <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pagamento</p>
                    <p className="text-sm font-black">{sale.payment_method}</p>
                 </div>
                 {sale.sale_type && (
                    <div className="space-y-1 border-l border-border/40">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Tipo</p>
                       <p className="text-sm font-black">{sale.sale_type}</p>
                    </div>
                 )}
              </div>
              {sale.notes && (
                <div className="pt-2 text-center">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Observações</p>
                   <p className="text-[11px] italic text-muted-foreground">{sale.notes}</p>
                </div>
              )}
           </div>

           <div className="flex gap-2 print:hidden">
              <Button 
                variant="outline" 
                className="flex-1 gap-2 rounded-xl h-12"
                onClick={handlePrint}
              >
                 <Printer className="size-4" /> Imprimir
              </Button>
              <Button 
                className="flex-1 gap-2 rounded-xl h-12 bg-gradient-dark border-none text-gold"
                onClick={() => onOpenChange(false)}
              >
                 Fechar
              </Button>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
