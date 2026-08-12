import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { brl, dateTimeBR } from "@/lib/format";
import { 
  CheckCircle2,
  Calendar,
  CreditCard,
  Banknote,
  MoreVertical
} from "lucide-react";
import { useRows } from "@/lib/data";
import { registerSalePayment } from "@/lib/sales.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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



  const handlePay = async (inst: any) => {
    try {
      await registerSalePayment({
        data: {
          sale_id: inst.sale_id,
          amount: Number(inst.amount),
          payment_method: "Dinheiro" // Default, could be a select
        }
      });
      
      // Update installment status
      const { supabase } = await import("@/integrations/supabase/client");
      await (supabase.from("sale_installments" as any) as any)
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: "Dinheiro"
        })
        .eq("id", inst.id);


      toast.success("Parcela baixada com sucesso!");
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!saleId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="px-8 py-5 border-b border-border/40 bg-card/50 backdrop-blur-xl">
          <div className="flex items-center gap-3">
             <div className="size-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <Calendar className="size-5 text-destructive" />
             </div>
             <div>
                <DialogTitle className="font-display font-black text-xl">Parcelas do Fiado</DialogTitle>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Venda #{saleId.slice(0,8)}</p>
             </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
             <div className="py-10 text-center text-muted-foreground animate-pulse">Carregando parcelas...</div>
          ) : installments.length === 0 ? (
             <div className="py-10 text-center text-muted-foreground">Nenhuma parcela encontrada.</div>
          ) : (
            installments.map((inst: any) => (
              <div key={inst.id} className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-card">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{inst.installment_number}ª Parcela</span>
                    {inst.status === 'paid' ? (
                      <Badge className="bg-success/10 text-success border-none text-[9px] h-4">Pago</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-none text-[9px] h-4">Pendente</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Vencimento: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</p>
                </div>
                
                <div className="text-right flex items-center gap-4">
                  <span className="font-black text-destructive">{brl(inst.amount)}</span>
                  {inst.status !== 'paid' && (
                    <Button 
                      size="sm" 
                      className="rounded-xl h-8 text-[10px] font-black bg-success hover:bg-success/90"
                      onClick={() => handlePay(inst)}
                    >
                      BAIXAR
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-6 border-t border-border/40 bg-muted/5">
          <Button variant="outline" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
