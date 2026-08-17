import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl, dateTimeBR, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Calendar,
  Wallet,
  Tag,
  ShoppingBag,
  User,
  Hash,
  CreditCard,
  Package,
  Truck
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSaleDetails } from "@/lib/sales.functions";
import { getPurchaseDetails } from "@/lib/purchases.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useRows } from "@/lib/data";

interface TransactionDetailsModalProps {
  transaction: any;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionDetailsModal({ 
  transaction, 
  isOpen, 
  onClose 
}: TransactionDetailsModalProps) {
  const fetchSale = useServerFn(getSaleDetails);
  const fetchPurchase = useServerFn(getPurchaseDetails);
  
  const isRevenue = transaction?.type === 'entrada' || transaction?.type === 'income';
  
  const { data: saleData, isLoading: loadingSale } = useQuery({
    queryKey: ['sale-details', transaction?.sale_id],
    queryFn: () => fetchSale({ data: { sale_id: transaction.sale_id! } }),
    enabled: !!transaction?.sale_id && isOpen,
  });

  const { data: purchaseData, isLoading: loadingPurchase } = useQuery({
    queryKey: ['purchase-details', transaction?.purchase_id],
    queryFn: () => fetchPurchase({ data: { purchase_id: transaction.purchase_id! } }),
    enabled: !!transaction?.purchase_id && isOpen,
  });

  const { data: materials = [] } = useRows("materials");
  const getMaterialName = (id: string) => materials.find((m: any) => m.id === id)?.name || "Material não encontrado";
  const getMaterialUnit = (id: string) => materials.find((m: any) => m.id === id)?.unit || "";

  if (!transaction) return null;

  const sale = saleData?.sale as any;
  const items = saleData?.items || [];
  const clientName = transaction.clients?.name || sale?.clients?.name || (transaction.supplier_id || transaction.purchase_id ? null : "Consumidor");
  const supplierName = transaction.suppliers?.name || purchaseData?.purchase?.suppliers?.name || purchaseData?.purchase?.supplier_name || "Fornecedor não identificado";

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col h-[90vh] max-h-[90vh] sm:rounded-xl">
        {/* Header - ID and Badges */}
        <div className="px-6 py-4 bg-white border-b shrink-0">
          <h2 className="text-xl font-bold text-foreground mb-2">
            {sale?.sale_code || transaction.description || "Transação"}
          </h2>
          <div className="flex gap-2">
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
              transaction.status === 'pago' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
            )}>
              {transaction.status === 'pago' ? 'Pago' : 'Pendente'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-green-50 text-green-700">
              {isRevenue ? 'Receita' : 'Despesa'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-[#F8F9FB]">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Value Highlight */}
              <div className={cn(
                "p-5 rounded-xl border flex flex-col items-start justify-center gap-0.5",
                isRevenue ? "bg-[#F2FCF5] border-green-100" : "bg-red-50 border-red-100"
              )}>
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Valor</span>
                <h2 className={cn(
                  "text-3xl font-black",
                  isRevenue ? "text-green-600" : "text-red-600"
                )}>
                  {isRevenue ? '+' : '-'} {brl(Math.abs(transaction.amount))}
                </h2>
              </div>

              {/* Linked Sale Details Card */}
              {transaction.sale_id && (
                <div className="bg-[#EFF4FF] rounded-xl border border-blue-100 overflow-hidden shadow-sm">
                   <div className="px-4 py-3 border-b border-blue-100 flex items-center gap-2">
                      <ShoppingBag className="size-4 text-blue-600" />
                      <h3 className="text-sm font-bold text-blue-900">Detalhes da Venda</h3>
                   </div>
                   
                   <div className="p-3 space-y-3">
                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2.5 rounded-lg border border-blue-50">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cliente</label>
                          <span className="text-sm font-bold text-foreground">{clientName}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-blue-50">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Código da Venda</label>
                          <span className="text-sm font-bold text-foreground">#{sale?.sale_code || transaction.sale_id.slice(0, 8)}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-blue-50">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Data da Venda</label>
                          <span className="text-sm text-foreground">
                            {sale?.created_at ? dateTimeBR(sale.created_at) : "—"}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-blue-50">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Forma de Pagamento</label>
                          <span className="text-sm text-foreground">
                            {sale?.payment_method || "Dinheiro"}
                          </span>
                        </div>
                      </div>

                      {/* Products List */}
                      <div className="bg-white rounded-lg border border-blue-50 overflow-hidden">
                        <div className="px-3 py-2 bg-blue-50/30 border-b flex items-center gap-2">
                          <Package className="size-3 text-blue-500" />
                          <span className="text-[10px] font-bold text-blue-700 uppercase">Produtos Vendidos ({items.length})</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {loadingSale ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">Carregando itens...</div>
                          ) : items.map((item: any, i: number) => (
                            <div key={i} className="p-3 space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <div>
                                  <div className="font-bold text-foreground uppercase text-xs">
                                    {item.products?.name}
                                    {item.numeracao ? ` (Nº ${item.numeracao})` : ''}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">{item.quantity}x {brl(item.unit_price)}</div>
                                </div>
                                <span className="font-bold text-green-600">{brl((item.quantity * item.unit_price) - (item.discount || 0))}</span>
                              </div>
                              {item.discount > 0 && (
                                <div className="flex justify-between text-[9px] text-muted-foreground italic px-1">
                                  <span>Desconto Item:</span>
                                  <span>- {brl(item.discount)}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="px-3 py-3 bg-gray-50 flex flex-col gap-0.5 border-t">
                          {(sale?.discount > 0 || sale?.cashback_used > 0) && (
                            <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                              <span>Total Descontos:</span>
                              <span>- {brl((sale?.discount || 0) + (sale?.cashback_used || 0))}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-foreground">Total Líquido:</span>
                            <span className="text-lg font-black text-green-600">{brl(sale?.total_amount)}</span>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
              )}
              
              {/* Linked Purchase Details Card */}
              {transaction.purchase_id && (
                <div className="bg-orange-50 rounded-xl border border-orange-100 overflow-hidden shadow-sm">
                   <div className="px-4 py-3 border-b border-orange-100 flex items-center gap-2">
                      <Truck className="size-4 text-orange-600" />
                      <h3 className="text-sm font-bold text-orange-900">Detalhes da Compra</h3>
                   </div>
                   
                   <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2.5 rounded-lg border border-orange-50">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Fornecedor</label>
                          <span className="text-sm font-bold text-foreground">{supplierName}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-orange-50">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Código da Compra</label>
                          <span className="text-sm font-bold text-foreground">#{transaction.purchase_id.slice(0, 8)}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-orange-50 overflow-hidden">
                        <div className="px-3 py-2 bg-orange-50/30 border-b flex items-center gap-2">
                          <Package className="size-3 text-orange-500" />
                          <span className="text-[10px] font-bold text-orange-700 uppercase">Materiais Adquiridos ({purchaseData?.items?.length || 0})</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {loadingPurchase ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">Carregando itens...</div>
                          ) : purchaseData?.items?.map((item: any, i: number) => (
                            <div key={i} className="p-3 flex justify-between items-center text-sm">
                              <div>
                                <div className="font-bold text-foreground uppercase text-xs">
                                  {getMaterialName(item.material_id)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {item.quantity}{getMaterialUnit(item.material_id)} x {brl(item.unit_cost)}
                                </div>
                              </div>
                              <span className="font-bold text-orange-600">{brl(item.quantity * item.unit_cost)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="px-3 py-3 bg-gray-50 flex flex-col gap-0.5 border-t">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-foreground">Total da Compra:</span>
                            <span className="text-lg font-black text-orange-600">{brl(purchaseData?.purchase?.total_amount)}</span>
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Bottom Metadata Grid */}
              <div className="grid grid-cols-2 gap-3">
                {clientName && (
                  <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <User className="size-4" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block">Cliente</label>
                      <span className="text-xs font-bold text-blue-700">{clientName}</span>
                    </div>
                  </div>
                )}
                
                {(!clientName && supplierName && (transaction.supplier_id || transaction.purchase_id)) && (
                  <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Truck className="size-4" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block">Fornecedor</label>
                      <span className="text-xs font-bold text-orange-700">{supplierName}</span>
                    </div>
                  </div>
                )}
                
                <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center">
                    <Tag className="size-4" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Categoria</label>
                    <span className="text-xs font-bold">{transaction.category || "Vendas"}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center">
                    <Wallet className="size-4" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Conta</label>
                    <span className="text-xs font-bold">{transaction.financial_accounts?.name || "Caixa Principal"}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center">
                    <Calendar className="size-4" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Data da Transação</label>
                    <span className="text-xs font-bold">{dateBR(transaction.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-white border-t shrink-0">
          <Button 
            className="w-full h-10 rounded-lg bg-black text-white hover:bg-black/90 font-bold uppercase tracking-widest text-[10px]" 
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
