import * as React from "react";
import { useSaveRow } from "@/lib/data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

interface QuickAddClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (client: any) => void;
}

export function QuickAddClientModal({ open, onOpenChange, onSuccess }: QuickAddClientModalProps) {
  const saveClient = useSaveRow("clients", "cliente");
  const [values, setValues] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  });

  const handleSave = async () => {
    if (!values.name) {
      toast.error("O nome do cliente é obrigatório");
      return;
    }

    try {
      const result = await saveClient.mutateAsync({ values });
      onSuccess(result);
      setValues({ name: "", phone: "", email: "", address: "" });
    } catch (error) {
      console.error("Error adding client:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[1.5rem] border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
              <UserPlus className="size-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="font-display font-black text-lg">Novo Cliente</DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-widest font-bold">Cadastro Rápido</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 p-5">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Nome Completo</Label>
            <Input 
              value={values.name}
              onChange={(e) => setValues(v => ({ ...v, name: e.target.value }))}
              placeholder="Ex: João Silva"
              className="h-10 rounded-xl bg-muted/30 border-border/40 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">WhatsApp / Telefone</Label>
            <Input 
              value={values.phone}
              onChange={(e) => setValues(v => ({ ...v, phone: e.target.value }))}
              placeholder="Ex: 5511999999999"
              className="h-10 rounded-xl bg-muted/30 border-border/40 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">E-mail</Label>
            <Input 
              value={values.email}
              onChange={(e) => setValues(v => ({ ...v, email: e.target.value }))}
              placeholder="cliente@email.com"
              className="h-10 rounded-xl bg-muted/30 border-border/40 font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Endereço</Label>
            <Input 
              value={values.address}
              onChange={(e) => setValues(v => ({ ...v, address: e.target.value }))}
              placeholder="Rua, Número, Bairro, Cidade"
              className="h-10 rounded-xl bg-muted/30 border-border/40 font-bold"
            />
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10 px-6 font-bold text-xs">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveClient.isPending}
            className="rounded-xl h-10 px-6 font-black bg-gradient-gold border-none shadow-gold hover:opacity-90 text-xs"
          >
            {saveClient.isPending ? "Salvando..." : "Cadastrar Cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
