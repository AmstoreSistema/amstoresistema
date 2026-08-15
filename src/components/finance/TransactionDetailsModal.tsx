import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl, dateTimeBR, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  X,
  Calendar,
  Wallet,
  Tag,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ShoppingBag
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSaleDetails } from "@/lib/sales.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

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
  
  const isRevenue = transaction?.type === 'entrada' || transaction?.type === 'income';
  
  const { data: saleData, isLoading: loadingSale } = useQuery({
    queryKey: ['sale-details', transaction?.sale_id],
    queryFn: () => fetchSale({ data: { sale_id: transaction.sale_id! } }),
    enabled: !!transaction?.sale_id && isOpen,
  });

  if (!transaction) return null;

  const sale = saleData?.sale;
  const items = saleData?.items || [];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl flex flex-col h-[90vh] sm:rounded-[2rem]">
        <div className="flex items-center justify-between p-6 bg-white border-b relative shrink-0">
          <div className="flex items-center gap-4">
            <div className={cn(
              "size-10 rounded-xl flex items-center justify-center",
              isRevenue ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
            )}>
              {isRevenue ? <ArrowUpCircle className="size-5" /> : <ArrowDownCircle className="size-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {transaction.description || "Transação"}
              </DialogTitle>
              <div className="flex gap-2 mt-1">
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                  transaction.status === 'pago' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                )}>
                  {transaction.status === 'pago' ? 'Pago' : 'Pendente'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-blue-100 text-blue-700">
                  {isRevenue ? 'Receita' : 'Despesa'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Main Amount Card */}
              <div className={cn(
                "p-8 rounded-[2rem] border flex flex-col items-center justify-center text-center gap-2",
                isRevenue ? "bg-green-50/50 border-green-100" : "bg-red-50/50 border-red-100"
              )}>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor da Transação</span>
                <h2 className={cn(
                  "text-4xl font-black font-display tracking-tight",
                  isRevenue ? "text-green-600" : "text-red-600"
                )}>
                  {isRevenue ? '+' : '-'} {brl(Math.abs(transaction.amount))}
                </h2>
              </div>

              {/* Linked Sale Details */}
              {transaction.sale_id && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <ShoppingBag className="size-4 text-blue-500" />
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Detalhes da Venda</h3>
                  </div>
                  
                  <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Venda</label>
                        <div className="font-bold text-foreground text-sm">
                          #{sale?.sale_code || transaction.sale_id.slice(0, 8)}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Data da Venda</label>
                        <div className="text-sm text-foreground">
                          {sale?.created_at ? dateTimeBR(sale.created_at) : "—"}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Forma de Proteção</label>
                        <div className="text-sm text-foreground">
                          {sale?.protection_method || "Dinheiro"}
                        </div>
                      </div>
                    </div>

                    {/* Sale Items */}
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Produtos Vendidos ({items.length})</p>
                      <div className="divide-y divide-gray-50 border-t border-b py-2">
                        {loadingSale ? (
                          <div className="py-4 text-center text-xs text-muted-foreground">Carregando itens...</div>
                        ) : items.map((item: any, i: number) => (
                          <div key={i} className="py-3 flex justify-between items-center text-sm">
                            <div>
                              <span className="font-bold uppercase">{item.products?.name}</span>
                              <span className="text-muted-foreground ml-2">{item.quantity}x {brl(item.unit_price)}</span>
                            </div>
                            <span className="font-bold">{brl(item.quantity * item.unit_price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-3">
                        <span className="text-sm font-bold uppercase text-muted-foreground">Total da Venda</span>
                        <span className="text-xl font-black text-foreground">{brl(sale?.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Wallet className="size-4" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block">Conta</label>
                        <span className="text-sm font-bold">{transaction.financial_accounts?.name || "Caixa Principal"}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
                        <Tag className="size-4" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block">Categoria</label>
                        <span className="text-sm font-bold">{transaction.category || "Vendas"}</span>
                      </div>
                   </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="size-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                        <Calendar className="size-4" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block">Data da Transação</label>
                        <span className="text-sm font-bold">{dateBR(transaction.created_at)}</span>
                      </div>
                   </div>
                   {transaction.due_date && (
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center">
                          <Clock className="size-4" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block">Data de Vencimento</label>
                          <span className="text-sm font-bold">{dateBR(transaction.due_date)}</span>
                        </div>
                    </div>
                   )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 bg-white border-t shrink-0">
          <Button className="w-full h-12 rounded-xl bg-black text-white hover:bg-black/90 font-bold uppercase tracking-widest text-xs" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
