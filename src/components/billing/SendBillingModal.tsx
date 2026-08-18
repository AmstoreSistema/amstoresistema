import { useState, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Copy, Send, RotateCcw, Pencil, FileText, AlertTriangle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SendBillingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtor: any;
}

export function SendBillingModal({ open, onOpenChange, debtor }: SendBillingModalProps) {
  if (!debtor) return null;

  const defaultMessage = useMemo(() => {
    const overdue = debtor.installments.filter((i: any) => new Date(i.due_date) < new Date());
    const upcoming = debtor.installments.filter((i: any) => new Date(i.due_date) >= new Date());

    let msg = `Olá, ${debtor.name}!\n\nGostaríamos de lembrá-lo(a) de sua situação financeira na AmStore:\n\n`;
    msg += `• Total em aberto: R$ ${debtor.totalDue.toFixed(2)}\n`;
    
    if (debtor.totalOverdue > 0) {
      msg += `• Valor vencido: R$ ${debtor.totalOverdue.toFixed(2)}\n`;
    }

    if (overdue.length > 0) {
      msg += `\nParcelas Vencidas:\n`;
      overdue.forEach((i: any) => {
        msg += `- Venda ${i.sale_code}: R$ ${(i.amount - i.paid_amount).toFixed(2)} (Vencimento: ${format(new Date(i.due_date), "dd/MM/yyyy")})\n`;
      });
    }

    if (upcoming.length > 0) {
      msg += `\nPróximos Vencimentos:\n`;
      upcoming.slice(0, 3).forEach((i: any) => {
        msg += `- R$ ${(i.amount - i.paid_amount).toFixed(2)} (${format(new Date(i.due_date), "dd/MM/yyyy")})\n`;
      });
    }

    msg += `\nQualquer dúvida, estamos à disposição. Atenciosamente, Equipe AmStore.`;
    return msg;
  }, [debtor]);

  const [message, setMessage] = useState(defaultMessage);
  const [isEditing, setIsEditing] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  };

  const handleSend = () => {
    if (!debtor.phone) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    const phone = debtor.phone.replace(/\D/g, "");
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] rounded-[2rem] p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 bg-muted/30 border-b">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-black">{debtor.name}</DialogTitle>
              <p className="text-muted-foreground font-medium">{debtor.phone || "Sem telefone"}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Devido</p>
              <p className="text-xl font-black text-primary">R$ {debtor.totalDue.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total Vencido</p>
              <p className={cn("text-xl font-black", debtor.totalOverdue > 0 ? "text-destructive" : "text-success")}>
                R$ {debtor.totalOverdue.toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-border/50">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Vendas Pendentes</p>
              <p className="text-xl font-black">{debtor.salesCount}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* Message Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">Mensagem WhatsApp</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[10px] font-bold uppercase"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Pencil className="size-3 mr-1" /> {isEditing ? "Concluir" : "Editar"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[10px] font-bold uppercase"
                    onClick={() => setMessage(defaultMessage)}
                  >
                    <RotateCcw className="size-3 mr-1" /> Restaurar
                  </Button>
                </div>
              </div>
              
              <Textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                readOnly={!isEditing}
                className={cn(
                  "min-h-[200px] rounded-2xl bg-muted/20 border-none font-medium text-sm leading-relaxed",
                  !isEditing && "focus-visible:ring-0"
                )}
              />
            </div>

            {/* Installments Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <span className="text-sm font-bold uppercase tracking-wider">Detalhamento de Parcelas</span>
              </div>

              <div className="space-y-2">
                {debtor.installments.map((inst: any) => {
                  const isOverdue = new Date(inst.due_date) < new Date();
                  return (
                    <div 
                      key={inst.id} 
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "size-8 rounded-lg flex items-center justify-center",
                          isOverdue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        )}>
                          {isOverdue ? <AlertTriangle className="size-4" /> : <Calendar className="size-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold">Venda {inst.sale_code} (Parc. {inst.installment_number})</p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            Vencimento: {format(new Date(inst.due_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <p className={cn("font-black", isOverdue ? "text-destructive" : "")}>
                        R$ {(inst.amount - inst.paid_amount).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/30 border-t flex-row gap-2">
          <Button 
            variant="outline" 
            className="flex-1 rounded-2xl h-12 font-bold"
            onClick={handleCopy}
          >
            <Copy className="size-4 mr-2" /> Copiar Mensagem
          </Button>
          <Button 
            className="flex-1 rounded-2xl h-12 bg-green-500 hover:bg-green-600 shadow-green-500/20 font-black"
            onClick={handleSend}
          >
            <Send className="size-4 mr-2" /> Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
