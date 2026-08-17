import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  brl, 
  dateTimeBR 
} from "@/lib/format";
import { 
  Calendar,
  CreditCard,
  Banknote,
  MoreVertical,
  Plus,
  Trash2,
  Save,
  Edit,
  AlertCircle
} from "lucide-react";
import { useRows } from "@/lib/data";
import { registerSalePayment, updateInstallments } from "@/lib/sales.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentSecretaryModal } from "./PaymentSecretaryModal";


export function SaleInstallmentsModal({ 
  open, 
  onOpenChange, 
  saleId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}) {
  const qc = useQueryClient();
  const { data: installments = [], isLoading } = useRows<any>("sale_installments" as any, {
    filters: saleId ? [{ column: "sale_id", value: saleId }] : undefined,
    order: { column: "installment_number", ascending: true }
  });

  const { data: sales = [] } = useRows<any>("sales", {
    filters: saleId ? [{ column: "id", value: saleId }] : undefined
  });
  const sale = sales[0];

  const [isEditing, setIsEditing] = React.useState(false);
  const [editList, setEditList] = React.useState<any[]>([]);
  const [payModal, setPayModal] = React.useState<{open: boolean, inst: any, amount: string}>({
    open: false,
    inst: null,
    amount: ""
  });
  const [secretaryOpen, setSecretaryOpen] = React.useState(false);


  React.useEffect(() => {
    if (isEditing && installments.length > 0) {
      setEditList(installments.map((i: any) => ({
        ...i,
        due_date: new Date(i.due_date).toISOString().split('T')[0]
      })));
    }
  }, [isEditing, installments]);

  const handlePartialPay = async () => {
    const { inst, amount } = payModal;
    if (!inst || !amount || Number(amount) <= 0) return;

    try {
      await registerSalePayment({
        data: {
          installment_id: inst.id,
          sale_id: inst.sale_id,
          amount: Number(amount),
          payment_method: "Dinheiro"
        }
      });
      
      toast.success("Pagamento registrado com sucesso!");
      setPayModal({ open: false, inst: null, amount: "" });
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveEdits = async () => {
    if (!saleId) return;
    
    const total = editList.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const saleTotal = Number(sale?.total_amount || 0);
    
    // Check if total matches (ignoring paid amounts if we were more complex, but here we reset unpaid)
    // For now, let's just warn if it doesn't match the remaining balance
    
    try {
      await updateInstallments({
        data: {
          sale_id: saleId,
          installments: editList.map((i, idx) => ({
            number: idx + 1,
            amount: Number(i.amount),
            due_date: i.due_date
          }))
        }
      });
      toast.success("Parcelas atualizadas com sucesso!");
      setIsEditing(false);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!saleId) return null;

  const unpaidInstallments = installments.filter((i: any) => !['paid', 'pago'].includes(String(i.status || '').toLowerCase()));
  const remainingTotal = unpaidInstallments.reduce((acc: number, curr: any) => acc + Number(curr.remaining_amount ?? curr.amount), 0);

  return (
    <>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          <DialogHeader className="px-8 py-5 border-b border-border/40 bg-card/50 backdrop-blur-xl flex-row items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <Calendar className="size-5 text-destructive" />
               </div>
               <div>
                  <DialogTitle className="font-display font-black text-xl">Gestão de Fiado</DialogTitle>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Venda #{saleId.slice(0,8)} • Total {brl(sale?.total_amount)}</p>
               </div>
            </div>
            {!isEditing && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-xl gap-2 font-bold"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="size-4" /> Ajustar Parcelas
              </Button>
            )}
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
               <div className="py-10 text-center text-muted-foreground animate-pulse">Carregando parcelas...</div>
            ) : isEditing ? (
              <div className="space-y-4">
                <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20 flex gap-3 items-center mb-4">
                  <AlertCircle className="size-5 text-warning shrink-0" />
                  <p className="text-xs text-warning-foreground font-medium">
                    Ajustar parcelas irá remover as parcelas pendentes atuais e criar novas conforme configurado abaixo.
                  </p>
                </div>
                
                {editList.map((inst, idx) => (
                  <div key={idx} className="flex gap-3 items-end p-4 rounded-2xl border border-border/40 bg-card/50">
                    <div className="w-12">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Parc.</Label>
                      <Input value={idx + 1} disabled className="h-10 rounded-xl text-center font-bold" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Vencimento</Label>
                      <Input 
                        type="date" 
                        value={inst.due_date} 
                        onChange={e => {
                          const newList = [...editList];
                          newList[idx].due_date = e.target.value;
                          setEditList(newList);
                        }}
                        className="h-10 rounded-xl" 
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Valor</Label>
                      <Input 
                        type="number" 
                        value={inst.amount} 
                        onChange={e => {
                          const newList = [...editList];
                          newList[idx].amount = e.target.value;
                          setEditList(newList);
                        }}
                        className="h-10 rounded-xl font-bold text-gold" 
                      />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 text-destructive rounded-xl"
                      onClick={() => setEditList(editList.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  className="w-full rounded-2xl border-dashed border-2 gap-2 h-12"
                  onClick={() => setEditList([...editList, {
                    installment_number: editList.length + 1,
                    amount: 0,
                    due_date: new Date().toISOString().split('T')[0]
                  }])}
                >
                  <Plus className="size-4" /> Adicionar Parcela
                </Button>

                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" className="flex-1 rounded-2xl" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  <Button 
                    className="flex-1 rounded-2xl bg-gold text-black font-bold hover:bg-gold/90 gap-2"
                    onClick={handleSaveEdits}
                  >
                    <Save className="size-4" /> Salvar Alterações
                  </Button>
                </div>
              </div>
            ) : installments.length === 0 ? (
               <div className="py-10 text-center text-muted-foreground">Nenhuma parcela encontrada.</div>
            ) : (
              installments.map((inst: any) => {
                const isOverdue = inst.status !== 'paid' && new Date(inst.due_date) < new Date();
                return (
                  <div key={inst.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border/40 bg-card hover:bg-muted/5'}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm">{inst.installment_number}ª Parcela</span>
                        {inst.status === 'paid' ? (
                          <Badge className="bg-success/10 text-success border-none text-[9px] h-4">Pago</Badge>
                        ) : inst.status === 'partial' ? (
                          <Badge className="bg-warning/10 text-warning border-none text-[9px] h-4">Parcial</Badge>
                        ) : isOverdue ? (
                          <Badge className="bg-destructive text-white border-none text-[9px] h-4 animate-pulse">Atrasado</Badge>
                        ) : (
                          <Badge className="bg-muted/20 text-muted-foreground border-none text-[9px] h-4">Pendente</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                        Vencimento: {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-[9px] text-blue-600 font-bold uppercase">
                        Valor Original: {brl(inst.amount)} | Pago: {brl(inst.paid_amount || 0)} | Restante: {brl(inst.remaining_amount ?? (Number(inst.amount) - Number(inst.paid_amount || 0)))}
                      </p>
                    </div>
                    
                    <div className="text-right flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "font-black text-lg",
                          inst.status === 'paid' || inst.status === 'pago' ? 'text-success' : 
                          inst.status === 'partial' ? 'text-blue-600' :
                          isOverdue ? 'text-destructive' : 'text-gold'
                        )}>
                          {brl(inst.amount)}
                        </span>
                        
                        {inst.status !== 'paid' && inst.status !== 'pago' && (
                          <div className="text-[9px] font-bold text-muted-foreground uppercase">
                            {inst.status === 'partial' ? `Restante: ${brl(inst.remaining_amount)}` : 'Pendente'}
                          </div>
                        )}

                        {inst.status !== 'paid' && inst.status !== 'pago' && Number(sale?.cashback_earned) > 0 && (
                          <div className="text-[9px] text-yellow-600 font-bold mt-1">
                            Liberará {brl((Number(sale.cashback_earned) * Number(inst.remaining_amount ?? inst.amount)) / Number(sale.total_amount))} cashback
                          </div>
                        )}
                      </div>

                      {inst.status !== 'paid' && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="rounded-xl h-8 text-[9px] font-black border-success/30 text-success hover:bg-success/10"
                            onClick={() => setPayModal({ open: true, inst, amount: String(inst.remaining_amount ?? inst.amount) })}
                          >
                            PAG. PARCIAL
                          </Button>
                          <Button 
                            size="sm" 
                            className="rounded-xl h-8 text-[10px] font-black bg-success hover:bg-success/90"
                            onClick={() => {
                              setPayModal({ 
                                open: true, 
                                inst, 
                                amount: String(inst.remaining_amount ?? inst.amount) 
                              });
                            }}
                          >
                            QUITAR
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="p-6 border-t border-border/40 bg-muted/5 flex gap-3">
             <Button 
               className="flex-1 rounded-xl bg-gold text-black font-black hover:bg-gold/90 gap-2"
               onClick={() => setSecretaryOpen(true)}
               disabled={Number(sale?.paid_amount || 0) >= Number(sale?.total_amount || 0)}
             >
               <Banknote className="size-4" /> Registrar Pagamento
             </Button>
             <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>

        </DialogContent>
      </Dialog>

      <Dialog open={payModal.open} onOpenChange={(o) => !o && setPayModal({open: false, inst: null, amount: ""})}>
        <DialogContent className="max-w-xs rounded-[2rem] p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-center">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Valor do Pagamento</Label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-success" />
                <Input 
                  type="number" 
                  value={payModal.amount} 
                  onChange={e => setPayModal({...payModal, amount: e.target.value})}
                  className="pl-10 h-12 rounded-2xl text-lg font-black text-success border-success/20 bg-success/5" 
                />
              </div>
              <p className="text-[10px] text-center text-muted-foreground">
                Total da Parcela: <span className="font-bold">{brl(payModal.inst?.remaining_amount ?? payModal.inst?.amount)}</span>
              </p>
            </div>
            
            <Button 
              className="w-full h-12 rounded-2xl bg-success text-white font-black hover:bg-success/90 shadow-lg shadow-success/20"
              onClick={handlePartialPay}
            >
              CONFIRMAR PAGAMENTO
            </Button>
            <Button variant="ghost" className="w-full rounded-2xl" onClick={() => setPayModal({open: false, inst: null, amount: ""})}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentSecretaryModal 
        open={secretaryOpen}
        onOpenChange={setSecretaryOpen}
        saleId={saleId}
        clientName={sale?.client_name || "Cliente"}
        totalAmount={Number(sale?.total_amount || 0)}
        remainingAmount={remainingTotal}
        installments={installments}
      />
    </>
  );
}

