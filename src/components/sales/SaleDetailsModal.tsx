import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl, dateTimeBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { 
  ShoppingBag, 
  DollarSign, 
  CheckCircle2, 
  X,
  Printer,
  Calendar,
  CreditCard,
  History
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSaleDetails } from "@/lib/sales.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ReceiptModal } from "./ReceiptModal";

interface SaleDetailsModalProps {
  saleId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SaleDetailsModal({ saleId, isOpen, onClose }: SaleDetailsModalProps) {
  const fetchSale = useServerFn(getSaleDetails);
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  
  const { data, isLoading } = useQuery({
    queryKey: ['sale-details', saleId],
    queryFn: () => fetchSale({ data: { sale_id: saleId! } }),
    enabled: !!saleId && isOpen,
  });

  if (!saleId) return null;

  const sale = data?.sale;
  const items = data?.items || [];
  const payments = data?.payments || [];
  const installments = data?.installments || [];

  const subtotal = sale ? (Number(sale.total_amount) + Number(sale.discount || 0) + Number(sale.cashback_used || 0)) : 0;

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl">
          <div className="flex items-center justify-between p-6 bg-white border-b relative">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Detalhes da Venda {sale?.sale_code}
                  </DialogTitle>
                  {sale && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                      sale.status === 'paid' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    )}>
                      {sale.status === 'paid' ? 'pago' : 'parcial'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">ID: {saleId}</p>
              </div>
            </div>
            <DialogClose className="absolute right-4 top-4 p-2 rounded-full hover:bg-muted transition-colors">
              <X className="size-4" />
            </DialogClose>
          </div>

          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 space-y-6">
              {/* Payment Info */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Forma de Pagamento</label>
                <div className="font-medium text-foreground capitalize flex items-center gap-2">
                  <CreditCard className="size-4 text-muted-foreground" />
                  {sale?.payment_method || "—"}
                </div>
              </div>

              {/* Items Section */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <ShoppingBag className="size-4" /> Itens da Venda
                </h3>
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="py-4 text-center text-muted-foreground">Carregando itens...</div>
                  ) : items.map((item: any, i: number) => (
                    <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-50">
                      <div>
                        <div className="font-bold text-foreground text-sm">{item.products?.name || "Produto Removido"}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {item.quantity}x {brl(item.unit_price)}
                        </div>
                      </div>
                      <div className="font-bold text-green-600">{brl(item.quantity * item.unit_price)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payments Made Section */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <History className="size-4" /> Pagamentos Realizados
                </h3>
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="py-4 text-center text-muted-foreground">Carregando pagamentos...</div>
                  ) : payments.length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground bg-white rounded-xl border border-dashed text-xs">Nenhum pagamento registrado.</div>
                  ) : payments.map((pay: any, i: number) => (
                    <div key={i} className="bg-green-50/50 rounded-xl p-4 flex items-center justify-between border border-green-100">
                      <div>
                        <div className="flex items-center gap-2 text-green-700 font-bold text-xs">
                          <Calendar className="size-3" />
                          {dateTimeBR(pay.created_at)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-tighter">
                          {pay.payment_method} - {pay.financial_accounts?.name || "Caixa Principal"}
                        </div>
                      </div>
                      <div className="font-bold text-green-700">{brl(pay.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-[#EEF2FF] rounded-2xl p-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-bold text-foreground">{brl(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Desconto:</span>
                  <span className="font-bold text-orange-600">- {brl(Number(sale?.discount || 0) + Number(sale?.cashback_used || 0))}</span>
                </div>
                <div className="pt-3 border-t border-blue-200/50 flex justify-between items-center">
                  <span className="text-lg font-bold text-foreground">Total:</span>
                  <span className="text-3xl font-black text-green-600">{brl(sale?.total_amount || 0)}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-xl bg-white hover:bg-gray-50 border-gray-200 text-primary font-bold shadow-sm"
                  onClick={() => setReceiptOpen(true)}
                >
                  <Printer className="size-4 mr-2" /> Ver Cupom Fiscal
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {sale && (
        <ReceiptModal 
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          sale={{
            ...sale,
            items: items.map((it: any) => ({
              ...it,
              product_name: it.products?.name
            })),
            installments
          }}
          client={null} // We'd need to fetch client details or pass them if available
        />
      )}
    </>
  );
}
