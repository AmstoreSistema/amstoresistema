import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { brl } from "@/lib/format";
import { Receipt } from "lucide-react";
import { registerSalePayment } from "@/lib/sales.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
export function PaymentSecretaryModal({ open, onOpenChange, saleId, clientName, totalAmount, remainingAmount, installments = [] }) {
    const qc = useQueryClient();
    const [selectedInstIds, setSelectedInstIds] = React.useState([]);
    const [amount, setAmount] = React.useState(0);
    const [paymentMethod, setPaymentMethod] = React.useState("Dinheiro");
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => {
        const sum = installments
            .filter(i => selectedInstIds.includes(i.id))
            .reduce((acc, curr) => acc + Number(curr.remaining_amount ?? curr.amount), 0);
        setAmount(sum);
    }, [selectedInstIds, installments]);
    const handleConfirm = async () => {
        if (selectedInstIds.length === 0) {
            toast.error("Selecione pelo menos uma parcela");
            return;
        }
        setSaving(true);
        try {
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
            toast.success("Pagamentos registrados!");
            onOpenChange(false);
            qc.invalidateQueries();
        }
        catch (e) {
            toast.error(e.message);
        }
        finally {
            setSaving(false);
        }
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="p-6 bg-card border-b border-border/40">
           <DialogTitle className="font-display font-black text-xl flex items-center gap-2">
              <Receipt className="size-5 text-gold"/> Secretário de Pagamento
           </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
           <div className="bg-muted/30 p-4 rounded-2xl space-y-1">
              <div className="flex justify-between text-sm font-bold">
                 <span>Cliente:</span>
                 <span className="text-foreground">{clientName}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                 <span>Venda ID:</span>
                 <span className="text-foreground">{saleId?.slice(0, 8)}</span>
              </div>
           </div>

           <div className="space-y-3">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Parcelas Pendentes</Label>
              <div className="space-y-2">
                {installments.filter(i => i.status !== 'paid').map(inst => (<div key={inst.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/10">
                      <Checkbox checked={selectedInstIds.includes(inst.id)} onCheckedChange={(checked) => {
                setSelectedInstIds(checked ? [...selectedInstIds, inst.id] : selectedInstIds.filter(id => id !== inst.id));
            }}/>
                      <div className="flex-1 text-sm font-bold">
                         {inst.installment_number}ª Parcela - {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="font-black text-gold">{brl(inst.remaining_amount ?? inst.amount)}</div>
                   </div>))}
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Valor a Pagar Agora</Label>
              <Input value={brl(amount)} disabled className="h-12 rounded-2xl font-black text-lg bg-card"/>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Forma</Label>
                 <Input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="h-10 rounded-xl"/>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Data</Label>
                 <Input type="date" className="h-10 rounded-xl" defaultValue={new Date().toISOString().split('T')[0]}/>
              </div>
           </div>
        </div>

        <DialogFooter className="p-6 pt-0">
           <Button className="w-full h-12 rounded-2xl bg-gradient-gold shadow-gold font-black" onClick={handleConfirm} disabled={saving}>
              Confirmar Pagamento
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
