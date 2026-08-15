import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { brl } from "@/lib/format";

interface DebtAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  debtAmount: number;
  pendingSalesCount: number;
}

export function DebtAlertModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  clientName, 
  debtAmount, 
  pendingSalesCount 
}: DebtAlertModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl bg-white">
        <div className="flex flex-col items-center p-8 text-center space-y-4">
          <div className="size-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
            <AlertTriangle className="size-10" />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-xl font-black flex items-center justify-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Cliente com Pendências
            </h2>
          </div>

          <div className="w-full bg-amber-50/50 rounded-2xl p-6 border border-amber-100 text-left space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cliente:</span>
              <span className="text-sm font-black text-foreground">{clientName}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Vendas Pendentes:</span>
              <span className="text-sm font-black text-foreground">{pendingSalesCount}</span>
            </div>
            <div className="pt-2">
              <h3 className="text-xl font-black text-destructive">
                Valor em Aberto: {brl(debtAmount)}
              </h3>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            Este cliente possui débitos em aberto. Deseja liberar esta nova venda mesmo assim?
          </p>
        </div>

        <DialogFooter className="p-6 bg-gray-50 flex gap-3 sm:gap-0 mt-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-white"
          >
            <XCircle className="size-4 mr-2" />
            Cancelar Venda
          </Button>
          <Button 
            onClick={onConfirm}
            className="flex-1 h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold uppercase tracking-widest text-[10px] border-none shadow-lg shadow-green-100"
          >
            <CheckCircle2 className="size-4 mr-2" />
            Liberar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
