import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  brl, 
  dateTimeBR 
} from "@/lib/format";
import { 
  FileText,
  User,
  ShoppingBag,
  CreditCard,
  History,
  Info
} from "lucide-react";
import { useRows } from "@/lib/data";

export function SaleDetailsModal({ 
  open, 
  onOpenChange, 
  saleId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}) {
  const { data: sales = [] } = useRows<any>("sales", {
    filters: saleId ? [{ column: "id", value: saleId }] : undefined
  });
  const sale = sales[0];

  const { data: items = [] } = useRows<any>("sale_items", {
    filters: saleId ? [{ column: "sale_id", value: saleId }] : undefined
  });

  const { data: payments = [] } = useRows<any>("sale_payments", {
    filters: saleId ? [{ column: "sale_id", value: saleId }] : undefined,
    order: { column: "created_at", ascending: true }
  });

  const { data: clients = [] } = useRows<any>("clients");
  const client = sale?.client_id ? clients.find((c: any) => c.id === sale.client_id) : null;

  if (!saleId || !sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl flex flex-col h-[85vh]">
        <DialogHeader className="px-8 py-6 border-b border-border/40 bg-card/50 backdrop-blur-xl flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="size-10 rounded-2xl bg-gold/10 flex items-center justify-center">
                <FileText className="size-5 text-gold" />
             </div>
             <div>
                <DialogTitle className="font-display font-black text-xl">Detalhes da Venda</DialogTitle>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Código: {sale.sale_code || sale.id.slice(0,8)} • {dateTimeBR(sale.created_at)}</p>
             </div>
          </div>
          <Badge className={sale.status === 'paid' ? 'bg-success/10 text-success border-none' : 'bg-warning/10 text-warning border-none'}>
            {sale.status === 'paid' ? 'PAGO' : sale.status === 'partial' ? 'PARCIAL' : 'PENDENTE'}
          </Badge>
        </DialogHeader>

        <ScrollArea className="flex-1 p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Esquerda: Informações Gerais e Itens */}
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                  <User className="size-3" /> Informações do Cliente
                </h3>
                <div className="p-4 rounded-3xl bg-muted/20 border border-border/40">
                  <p className="font-bold text-lg">{client?.name || "Consumidor Final"}</p>
                  {client?.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                  <ShoppingBag className="size-3" /> Itens do Pedido
                </h3>
                <div className="space-y-3">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/30">
                      <div className="flex-1 pr-4">
                        <p className="font-bold text-sm">{(item.product_name || "Produto").toUpperCase()}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">
                          {item.quantity}un x {brl(item.unit_price)}
                          {item.numeracao && ` • TAM: ${item.numeracao}`}
                        </p>
                      </div>
                      <span className="font-black text-gold">{brl(item.quantity * item.unit_price)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Direita: Financeiro e Pagamentos */}
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                  <CreditCard className="size-3" /> Resumo Financeiro
                </h3>
                <div className="p-6 rounded-[2rem] bg-gradient-dark border-none shadow-elegant text-white space-y-3">
                  <div className="flex justify-between text-sm opacity-60">
                    <span>Subtotal</span>
                    <span>{brl(Number(sale.total_amount) + Number(sale.discount || 0))}</span>
                  </div>
                  {Number(sale.discount) > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Desconto</span>
                      <span>-{brl(sale.discount)}</span>
                    </div>
                  )}
                  <Separator className="bg-white/10" />
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold">TOTAL GERAL</span>
                    <span className="text-2xl font-display font-black text-gold">{brl(sale.total_amount)}</span>
                  </div>
                  <Separator className="bg-white/10" />
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-[9px] uppercase font-bold opacity-40">Já Pago</p>
                      <p className="text-sm font-black text-success">{brl(sale.paid_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold opacity-40">Restante</p>
                      <p className="text-sm font-black text-destructive">{brl(Number(sale.total_amount) - Number(sale.paid_amount))}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                  <History className="size-3" /> Histórico de Pagamentos
                </h3>
                <div className="space-y-2">
                  {payments.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-muted/10 border border-dashed border-border/40 text-center text-[10px] text-muted-foreground">
                      Nenhum pagamento registrado ainda.
                    </div>
                  ) : payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-3 rounded-2xl bg-success/5 border border-success/20">
                      <div>
                        <p className="text-xs font-bold">{p.payment_method || "Pagamento"}</p>
                        <p className="text-[9px] text-muted-foreground">{dateTimeBR(p.created_at)}</p>
                      </div>
                      <p className="font-black text-success">{brl(p.amount)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {sale.notes && (
                <section className="space-y-4">
                  <h3 className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                    <Info className="size-3" /> Observações
                  </h3>
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 text-xs italic text-muted-foreground">
                    {sale.notes}
                  </div>
                </section>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-border/40 bg-muted/5 sticky bottom-0 z-10 shrink-0">
          <Button variant="outline" className="w-full rounded-2xl h-12 font-bold" onClick={() => onOpenChange(false)}>
            FECHAR DETALHES
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
