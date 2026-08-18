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
import { getSaleDetails, registerSalePayment } from "@/lib/sales.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRows } from "@/lib/data";
import { ReceiptModal } from "./ReceiptModal";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  const qc = useQueryClient();
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = React.useState<string | null>(null);
  const [paymentType, setPaymentType] = React.useState<'quitar' | 'parcial'>('quitar');
  const [payAmount, setPayAmount] = React.useState<string>("");
  const [payMethod, setPayMethod] = React.useState("Dinheiro");
  const [payAccountId, setPayAccountId] = React.useState<string>("");
  const [isPaying, setIsPaying] = React.useState(false);

  const { data: accounts = [] } = useRows("financial_accounts");

  React.useEffect(() => {
    if (accounts.length > 0 && !payAccountId) {
      const main = accounts.find((a: any) => a.name.toLowerCase().includes('principal') || a.active);
      if (main) setPayAccountId(main.id);
      else setPayAccountId(accounts[0].id);
    }
  }, [accounts, payAccountId]);

  const handleQuickPayment = async (installment: any) => {
    const val = paymentType === 'quitar' ? Number(installment.remaining_amount ?? installment.amount) : Number(payAmount);
    if (val <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setIsPaying(true);
    try {
      await registerSalePayment({
        data: {
          installment_id: installment.id,
          sale_id: saleId!,
          amount: val,
          payment_method: payMethod,
          account_id: payAccountId,
        }
      });
      toast.success("Pagamento registrado!");
      setExpandedPaymentId(null);
      setPayAmount("");
      qc.invalidateQueries({ queryKey: ['sale-details', saleId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsPaying(false);
    }
  };
  
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
  const openInstallments = installments.filter((installment: any) =>
    !['paid', 'pago'].includes(String(installment.status || '').toLowerCase())
  );
  const remainingBalance = Math.max(0, Number(sale?.total_amount || 0) - Number(sale?.paid_amount || 0));
  const isCreditSale = Boolean(sale?.is_debt) || sale?.payment_method === 'Fiado' || installments.length > 0;
  const hasOutstandingDebt = isCreditSale && (remainingBalance > 0.009 || openInstallments.length > 0);

  const subtotal = sale ? (Number(sale.total_amount) + Number(sale.discount || 0) + Number(sale.cashback_used || 0)) : 0;

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl flex flex-col h-[90vh] sm:rounded-[1.5rem]">
          <div className="flex items-center justify-between p-4 bg-white border-b relative shrink-0">
            <div className="flex items-center gap-4">
              <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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
                        (sale.status === 'paid' || sale.status === 'completed' || sale.status === 'finalizado' || Number(sale.paid_amount) >= Number(sale.total_amount)) && installments.every((i: any) => i.status === 'paid' || i.status === 'pago') ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {!hasOutstandingDebt && (sale.status === 'paid' || sale.status === 'completed' || sale.status === 'finalizado' || Number(sale.paid_amount) >= Number(sale.total_amount)) ? 'Pago' : isCreditSale ? 'Pendente / Fiado' : 'Pendente'}
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
                className="rounded-xl font-bold h-8 text-[10px] gap-2 shadow-sm"
                onClick={() => setReceiptOpen(true)}
              >
                <Printer className="size-4" /> Cupom
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-xl font-bold h-8 text-[10px] gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (confirm("Deseja realmente estornar esta venda? O estoque será devolvido, o saldo das contas financeiras será ajustado e o cashback liberado será estornado.")) {
                    try {
                      const { cancelSale } = await import("@/lib/sales.functions");
                      await cancelSale({ data: { sale_id: saleId! } });
                      toast.success("Venda estornada com sucesso");
                      qc.invalidateQueries();
                      handleClose();
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }
                }}
              >
                Estornar
              </Button>
            </div>
            {/* Removed redundant DialogClose here as standard DialogContent includes one */}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-6">
                {/* Sale Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
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
                    <div className="bg-blue-50/50 p-3 rounded-xl flex justify-between items-center border border-blue-100">
                      <span className="text-xs text-blue-700 font-medium">Subtotal</span>
                      <span className="font-bold text-blue-900 text-base">{brl(subtotal)}</span>
                    </div>
                    <div className="bg-purple-50/50 p-3 rounded-xl flex justify-between items-center border border-purple-100">
                      <span className="text-xs text-purple-700 font-medium">desconto</span>
                      <span className="font-bold text-purple-900 text-base">{brl(Number(sale?.discount || 0) + Number(sale?.cashback_used || 0))}</span>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl flex justify-between items-center border border-green-200">
                      <span className="text-xs text-green-700 font-bold">Valor Total</span>
                      <span className="font-black text-green-900 text-xl">{brl(sale?.total_amount || 0)}</span>
                    </div>
                    <div className="bg-yellow-50/50 p-3 rounded-xl flex justify-between items-center border border-yellow-100">
                      <div className="flex items-center gap-2 text-yellow-700 text-xs font-medium">
                        <History className="size-3.5" /> Cashback Gerado
                      </div>
                      <span className="font-bold text-yellow-900 text-base">{brl(sale?.cashback_earned || 0)}</span>
                    </div>
                    {isCreditSale && Number(sale?.cashback_earned) > 0 && (
                      <div className="text-[10px] text-muted-foreground px-3 py-1 bg-yellow-50/30 rounded-lg italic border border-yellow-100/50">
                        * Liberado proporcionalmente a cada pagamento.
                      </div>
                    )}
                    <div className="bg-cyan-50/50 p-3 rounded-xl flex justify-between items-center border border-cyan-100">
                      <span className="text-xs text-cyan-700 font-medium">Valor Pago</span>
                      <span className="font-bold text-cyan-900 text-base">{brl(sale?.paid_amount || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Items Table-like View */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2 uppercase tracking-tight">
                    Itens da Venda
                  </h3>
                  <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                    {isLoading ? (
                      <div className="py-8 text-center text-muted-foreground">Carregando itens...</div>
                    ) : items.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">Nenhum item encontrado.</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                         {items.map((item: any, i: number) => (
                          <div key={i} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex-1">
                              <div className="font-bold text-foreground text-sm uppercase">{item.products?.name || "Produto"}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.numeracao && (
                                  <div className="text-[10px] font-bold text-blue-600">Nº {item.numeracao}</div>
                                )}
                                <div className="text-[11px] text-muted-foreground">
                                  {item.quantity} x {brl(item.unit_price)}
                                </div>
                              </div>
                              {item.discount > 0 && (
                                <div className="text-[10px] text-muted-foreground italic mt-0.5">
                                  Desconto Item: - {brl(item.discount)}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-foreground">
                                {brl((item.quantity * item.unit_price) - (item.discount || 0))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payments History */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-tight">
                      Histórico de Pagamentos
                    </h3>
                    {hasOutstandingDebt && (
                      <div className="flex items-center gap-2">
                        {remainingBalance > 0.009 && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 rounded-xl bg-gold/10 border-gold/20 text-gold hover:bg-gold/20 font-bold text-[10px] gap-2 shadow-sm"
                            onClick={() => {
                              setExpandedPaymentId('bulk');
                              setPaymentType('parcial');
                              setPayAmount(remainingBalance.toString());
                            }}
                          >
                            <DollarSign className="size-3.5" /> Quitar Total
                          </Button>
                        )}
                        <div className="text-right ml-4">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase leading-tight">Saldo Devedor</div>
                          <div className="text-lg font-black text-gold leading-none">{brl(remainingBalance)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">

                    {/* Quick Bulk Payment Row */}
                    {expandedPaymentId === 'bulk' && (
                      <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 mb-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-gold uppercase">Quitação Total da Venda</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={() => setExpandedPaymentId(null)}>
                            <X className="size-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">Valor</label>
                            <Input 
                              type="number" 
                              value={payAmount} 
                              onChange={(e) => setPayAmount(e.target.value)} 
                              className="h-9 text-sm font-bold rounded-lg border-gold/20"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">Forma</label>
                            <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-9 text-sm font-bold rounded-lg" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">Conta</label>
                            <Select value={payAccountId} onValueChange={setPayAccountId}>
                              <SelectTrigger className="h-9 text-sm font-bold rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((acc: any) => (
                                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button 
                          className="w-full mt-3 h-9 bg-gold text-white font-bold rounded-lg"
                          disabled={isPaying}
                          onClick={async () => {
                            setIsPaying(true);
                            try {
                              const { processBulkPayment } = await import("@/lib/sales.functions");
                              await processBulkPayment({
                                data: {
                                  sale_id: saleId!,
                                  amount: Number(payAmount),
                                  payment_method: payMethod,
                                  account_id: payAccountId
                                }
                              });
                              toast.success("Pagamento total processado!");
                              setExpandedPaymentId(null);
                              qc.invalidateQueries({ queryKey: ['sale-details', saleId] });
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setIsPaying(false);
                            }
                          }}
                        >
                          {isPaying ? "Processando..." : "Confirmar Quitação Total"}
                        </Button>
                      </div>
                    )}

                    {/* Installments for Credit Sales */}
                    {installments.length > 0 && (
                      <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Plano de Parcelamento</p>
                        <div className="space-y-2">
                          {installments.map((inst: any, i: number) => {
                            const isPaid = inst.status === 'paid' || inst.status === 'pago';
                            const isPartial = inst.status === 'parcial' || (Number(inst.paid_amount) > 0 && !isPaid);
                            const isOverdue = !isPaid && new Date(inst.due_date) < new Date();
                            const remaining = Number(inst.remaining_amount ?? (Number(inst.amount) - Number(inst.paid_amount || 0)));
                            const isExpanded = expandedPaymentId === inst.id;

                            return (
                              <div key={i} className="flex flex-col py-2 border-b border-gray-50 last:border-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "size-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                      isPaid ? "bg-green-100 text-green-700" : 
                                      isPartial ? "bg-blue-100 text-blue-700" :
                                      isOverdue ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                                    )}>
                                      {inst.installment_number}
                                    </div>
                                    <div className="text-[11px]">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold">Vence em {new Date(inst.due_date).toLocaleDateString('pt-BR')}</span>
                                        {isPartial && (
                                          <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Parcial</span>
                                        )}
                                      </div>
                                      <div className="uppercase text-[10px] font-bold">
                                        {isPaid ? (
                                          <span className="text-green-600">PAGO • {brl(inst.paid_amount)}</span>
                                        ) : isPartial ? (
                                          <span className="text-blue-600">RESTANTE: {brl(remaining)} • Pago: {brl(inst.paid_amount)}</span>
                                        ) : (
                                          <span className={isOverdue ? "text-destructive" : "text-orange-600"}>
                                            {isOverdue ? "ATRASADA" : "PENDENTE"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <div className={cn(
                                        "font-black text-sm",
                                        isPaid ? "text-green-600" : isPartial ? "text-blue-600" : "text-foreground"
                                      )}>
                                        {brl(inst.amount)}
                                      </div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-medium">Parcela {inst.installment_number}</div>
                                    </div>
                                    {!isPaid && !isExpanded && (
                                      <div className="flex gap-1">
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-7 text-[9px] font-black uppercase text-green-600 hover:bg-green-50 px-2"
                                          onClick={() => {
                                            setExpandedPaymentId(inst.id);
                                            setPaymentType('quitar');
                                          }}
                                        >
                                          Quitar
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-7 text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 px-2"
                                          onClick={() => {
                                            setExpandedPaymentId(inst.id);
                                            setPaymentType('parcial');
                                            setPayAmount("");
                                          }}
                                        >
                                          Parcial
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div className="mt-3 bg-muted/30 p-3 rounded-lg border border-border/40 animate-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-black uppercase text-muted-foreground">
                                        {paymentType === 'quitar' ? 'Quitar Parcela' : 'Pagamento Parcial'}
                                      </span>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setExpandedPaymentId(null)}>
                                        <X className="size-3" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold uppercase text-muted-foreground">Valor</label>
                                        <Input 
                                          type="number" 
                                          value={paymentType === 'quitar' ? remaining : payAmount} 
                                          onChange={(e) => setPayAmount(e.target.value)}
                                          disabled={paymentType === 'quitar'}
                                          className="h-8 text-xs font-bold"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold uppercase text-muted-foreground">Forma</label>
                                        <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-8 text-xs font-bold" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold uppercase text-muted-foreground">Conta</label>
                                        <Select value={payAccountId} onValueChange={setPayAccountId}>
                                          <SelectTrigger className="h-8 text-xs font-bold">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {accounts.map((acc: any) => (
                                              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <Button 
                                      className="w-full mt-2 h-8 text-[10px] font-black uppercase bg-primary text-white"
                                      disabled={isPaying}
                                      onClick={() => handleQuickPayment(inst)}
                                    >
                                      {isPaying ? "Processando..." : "Confirmar Pagamento"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                        <div key={i} className="bg-white rounded-xl p-3 flex items-center justify-between border border-gray-100 shadow-sm">
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
                          <div className="font-bold text-green-600 text-base">{brl(pay.amount)}</div>
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

      {/* Modal removido em favor da gestão unificada na própria tela */}
    </>
  );
}
