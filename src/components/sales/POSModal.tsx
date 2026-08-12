import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { brl } from "@/lib/format";
import { Plus, Trash2, Search, User } from "lucide-react";

export function POSModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>PDV - Nova Venda</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4 border-r overflow-y-auto">
            <div className="mb-4">
              <Label>Buscar Produto</Label>
              <div className="flex gap-2">
                 <Input placeholder="Código ou nome..." />
                 <Button variant="outline" size="icon"><Search /></Button>
              </div>
            </div>
            
            <div className="space-y-2">
               {items.map((item, i) => (
                 <div key={i} className="flex items-center gap-2 p-2 border rounded-lg">
                    <span className="flex-1">{item.name}</span>
                    <span className="font-bold">{brl(item.price)}</span>
                    <Button variant="ghost" size="icon" className="text-destructive"><Trash2 /></Button>
                 </div>
               ))}
            </div>
          </div>
          
          <div className="w-80 p-4 bg-muted/20 flex flex-col gap-4">
            <div className="space-y-2">
               <Label>Cliente</Label>
               <Button variant="outline" className="w-full justify-start gap-2"><User /> Selecionar</Button>
            </div>
            <Separator />
            <div className="flex justify-between items-center text-xl font-black font-display">
               <span>Total</span>
               <span className="text-gold">{brl(total)}</span>
            </div>
            <Button className="w-full bg-gradient-gold h-12 mt-auto font-bold">Finalizar Venda</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
