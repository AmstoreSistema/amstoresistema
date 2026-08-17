import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { brl } from "@/lib/format";
import { Banknote, Receipt } from "lucide-react";
import { registerSalePayment, processBulkPayment } from "@/lib/sales.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function PaymentSecretaryModal({ 
  open, 
  onOpenChange, 
  saleId,
  clientName,
  totalAmount,
  remainingAmount,
  installments = []
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
  clientName: string;
  totalAmount: number;
  remainingAmount: number;
  installments: any[];
}) {
  const qc = useQueryClient();
  const [selectedInstIds, setSelectedInstIds] = React.useState<string[]>([]);
  const [amount, setAmount] = React.useState<number | string>("");
  const [manualAmount, setManualAmount] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState("Dinheiro");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!manualAmount) {
      const sum = installments
        .filter(i => selectedInstIds.includes(i.id))
        .reduce((acc, curr) => acc + Number(curr.remaining_amount ?? curr.amount), 0);
      setAmount(sum);
    }
  }, [selectedInstIds, installments, manualAmount]);

  const handleConfirm = async () => {
    const paymentVal = Number(amount);
    if (!saleId) {
      toast.error("Venda não encontrada");
      return;
    }
    if (paymentVal <= 0) {
      toast.error("Informe um valor válido para o pagamento");
      return;
    }

    setSaving(true);
    try {
      if (manualAmount) {
        // Use bulk payment logic (FIFO - First In First Out for installments)
        await processBulkPayment({
          data: {
            sale_id: saleId,
            amount: paymentVal,
            payment_method: paymentMethod
          }
        });
      } else {
        // Pay specific selected installments
        for (const instId of selectedInstIds) {
          const inst = installments.find(i => i.id === instId);
          await registerSalePayment({
            data: {
              installment_id: instId,
              sale_id: saleId,
              amount: Number(inst.remaining_amount ?? inst.amount),
              payment_method: paymentMethod
            }
          });
        }
      }
      toast.success("Pagamentos registrados!");
      onOpenChange(false);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-lg border-none p-0 shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="border-b border-border/40 bg-card px-4 py-3.5 sm:px-5">
           <DialogTitle className="flex items-center gap-2 font-display text-lg font-black">
              <Receipt className="size-5 text-gold" /> Registrar Pagamento
           </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
           <div className="space-y-1 rounded-md bg-muted/30 px-3 py-2.5">
              <div className="flex justify-between text-sm font-bold">
                 <span>Cliente:</span>
                 <span className="text-foreground">{clientName}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                 <span>Venda ID:</span>
                 <span className="text-foreground">{saleId?.slice(0, 8)}</span>
              </div>
           </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Parcelas Pendentes</Label>
               <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                 {installments.filter(i => !['paid', 'pago'].includes(String(i.status || '').toLowerCase())).map(inst => (
                    <label key={inst.id} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border bg-card px-3 py-2.5 hover:bg-muted/10">
                      <Checkbox 
                        checked={selectedInstIds.includes(inst.id)}
                        onCheckedChange={(checked: boolean) => {
                          setSelectedInstIds(checked ? [...selectedInstIds, inst.id] : selectedInstIds.filter(id => id !== inst.id));
                        }}
                      />
                       <span className="min-w-0 truncate text-sm font-bold">
                         {inst.installment_number}ª Parcela - {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                       </span>
                       <span className="shrink-0 text-sm font-black text-gold">{brl(inst.remaining_amount ?? inst.amount)}</span>
                    </label>
                ))}
              </div>
           </div>

           <div className="space-y-2">
               <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Valor a Pagar Agora</Label>
                 <Button
                   variant="ghost"
                   size="sm"
                  type="button"
                  onClick={() => {
                    setManualAmount(!manualAmount);
                    if (manualAmount) setSelectedInstIds([]);
                  }}
                   className="h-auto px-1 py-0 text-[9px] font-black uppercase text-primary hover:bg-transparent hover:underline"
                >
                  {manualAmount ? "Selecionar Parcelas" : "Digitar Valor Manual"}
                 </Button>
              </div>
              {manualAmount ? (
                <div className="relative">
                  <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gold" />
                  <Input 
                    type="number"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="h-11 rounded-md bg-card pl-11 text-lg font-black border-gold/20 focus:border-gold" 
                    placeholder="0,00"
                  />
                </div>
              ) : (
                 <Input value={brl(Number(amount))} disabled className="h-11 rounded-md bg-card text-base font-black" />
              )}
              {manualAmount && (
                <p className="text-[10px] text-muted-foreground px-2 italic">
                  * O valor será aplicado automaticamente nas parcelas mais antigas.
                </p>
              )}
           </div>

            <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Forma</Label>
                  <Input value={paymentMethod} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentMethod(e.target.value)} className="h-10 rounded-md" />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Data</Label>
                  <Input type="date" className="h-10 rounded-md" defaultValue={new Date().toISOString().split('T')[0]} readOnly />
              </div>
           </div>
        </div>

         <DialogFooter className="border-t border-border/40 bg-background px-4 py-3 sm:px-5">
            <Button className="h-11 w-full rounded-md bg-gradient-gold font-black shadow-gold" onClick={handleConfirm} disabled={saving || Number(amount) <= 0}>
              Confirmar Pagamento
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
