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
  isOpen?: boolean;
  onClose?: () => void;
  // Support legacy props from existing routes
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SaleDetailsModal({ 
  saleId, 
  isOpen, 
  onClose,
  open,
  onOpenChange 
}: SaleDetailsModalProps) {
  const isModalOpen = isOpen ?? open ?? false;
  const handleClose = onClose || (() => onOpenChange?.(false));

  const fetchSale = useServerFn(getSaleDetails);
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  
  const { data, isLoading } = useQuery({
    queryKey: ['sale-details', saleId],
    queryFn: () => fetchSale({ data: { sale_id: saleId! } }),
    enabled: !!saleId && isModalOpen,
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
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl flex flex-col h-[90vh] sm:rounded-[2rem]">
          <div className="flex items-center justify-between p-6 bg-white border-b relative shrink-0">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Venda # {sale?.sale_code || saleId?.slice(0, 8)}
                  </DialogTitle>
                  {sale && (
                    <div className="flex gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                        sale.status === 'paid' || sale.status === 'completed' || sale.status === 'finalizado' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {sale.status === 'paid' || sale.status === 'completed' || sale.status === 'finalizado' ? 'Pago' : sale.payment_method === 'Fiado' ? 'Pendente / Fiado' : 'Pendente'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-blue-100 text-blue-700">
                        {sale.sale_type || 'Varejo'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-8">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl font-bold h-9 gap-2 shadow-sm"
                onClick={() => setReceiptOpen(true)}
              >
                <Printer className="size-4" /> Cupom
              </Button>
            </div>
            {/* Removed redundant DialogClose here as standard DialogContent includes one */}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                {/* Sale Info Grid */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Cliente</label>
                      <div className="font-bold text-foreground text-sm">
                        {(sale as any)?.client_name || "Consumidor Final"}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Data da Venda</label>
                      <div className="text-sm flex items-center gap-2 text-foreground">
                        {sale?.created_at ? dateTimeBR(sale.created_at) : "—"}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Vendedor</label>
                      <div className="text-sm text-foreground">
                        {(sale as any)?.seller_name || "amstorebagshoes"}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Produtos</label>
                      <div className="text-sm text-foreground">
                        {items.length} {items.length === 1 ? 'produto' : 'produtos'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-blue-50/50 p-4 rounded-xl flex justify-between items-center border border-blue-100">
                      <span className="text-sm text-blue-700 font-medium">Subtotal</span>
                      <span className="font-bold text-blue-900 text-lg">{brl(subtotal)}</span>
                    </div>
                    <div className="bg-purple-50/50 p-4 rounded-xl flex justify-between items-center border border-purple-100">
                      <span className="text-sm text-purple-700 font-medium">desconto</span>
                      <span className="font-bold text-purple-900 text-lg">{brl(Number(sale?.discount || 0) + Number(sale?.cashback_used || 0))}</span>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl flex justify-between items-center border border-green-200">
                      <span className="text-sm text-green-700 font-bold">Valor Total</span>
                      <span className="font-black text-green-900 text-2xl">{brl(sale?.total_amount || 0)}</span>
                    </div>
                    <div className="bg-yellow-50/50 p-4 rounded-xl flex justify-between items-center border border-yellow-100">
                      <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium">
                        <History className="size-4" /> Cashback Gerado
                      </div>
                      <span className="font-bold text-yellow-900 text-lg">{brl(sale?.cashback_earned || 0)}</span>
                    </div>
                    <div className="bg-cyan-50/50 p-4 rounded-xl flex justify-between items-center border border-cyan-100">
                      <span className="text-sm text-cyan-700 font-medium">Valor Pago</span>
                      <span className="font-bold text-cyan-900 text-lg">{brl(sale?.paid_amount || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Items Table-like View */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 uppercase tracking-tight">
                    Itens da Venda
                  </h3>
                  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    {isLoading ? (
                      <div className="py-8 text-center text-muted-foreground">Carregando itens...</div>
                    ) : items.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">Nenhum item encontrado.</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {items.map((item: any, i: number) => (
                          <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex-1">
                              <div className="font-bold text-foreground text-sm uppercase">{item.products?.name || "Produto"}</div>
                              {item.numeracao && (
                                <div className="text-[10px] font-bold text-blue-600 mt-0.5">Nº {item.numeracao}</div>
                              )}
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {item.quantity} x {brl(item.unit_price)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-foreground">{brl(item.quantity * item.unit_price)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payments History */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-tight">
                      Histórico de Pagamentos
                    </h3>
                    {sale?.payment_method === 'Fiado' && (
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Saldo Devedor</div>
                        <div className="text-lg font-black text-gold">{brl(Number(sale.total_amount) - Number(sale.paid_amount))}</div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">

                    {/* Installments for Credit Sales */}
                    {installments.length > 0 && (
                      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 block">Plano de Parcelamento</p>
                        <div className="space-y-2">
                          {installments.map((inst: any, i: number) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "size-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                  inst.status === 'paid' || inst.status === 'pago' ? "bg-green-100 text-green-700" : 
                                  new Date(inst.due_date) < new Date() ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"

                                )}>
                                  {inst.installment_number}
                                </div>
                                <div className="text-[11px]">
                                  <span className="font-bold block">Vence em {new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                                  <span className="text-muted-foreground uppercase">
                                    {inst.status === 'paid' || inst.status === 'pago' ? 'Paga' : 
                                     new Date(inst.due_date) < new Date() ? 'Atrasada' : 'Pendente'}
                                  </span>

                                </div>
                              </div>
                              <div className="font-bold text-sm">{brl(inst.amount)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Transações Realizadas</p>
                      {isLoading ? (
                        <div className="py-4 text-center text-muted-foreground">Carregando...</div>
                      ) : payments.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground bg-white rounded-2xl border border-dashed text-xs">
                          Nenhum pagamento registrado.
                        </div>
                      ) : payments.map((pay: any, i: number) => (
                        <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between border border-gray-100 shadow-sm">
                          <div>
                            <div className="font-bold text-foreground text-sm uppercase leading-tight">
                              {pay.payment_method || pay.description || "Pagamento"}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {dateTimeBR(pay.created_at)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1 font-medium">
                              Conta: {pay.financial_accounts?.name || "Caixa Principal"}
                            </div>
                          </div>
                          <div className="font-bold text-green-600 text-lg">{brl(pay.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
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
