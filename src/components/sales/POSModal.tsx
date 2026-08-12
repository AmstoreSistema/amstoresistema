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
import { Separator } from "@/components/ui/separator";
import { brl } from "@/lib/format";
import { 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Wallet, 
  Banknote,
  Percent,
  Coins,
  ReceiptText
} from "lucide-react";
import { ClientSearch } from "./ClientSearch";
import { ProductSearch } from "./ProductSearch";
import { createSale } from "@/lib/sales.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface CartItem {
  id: string; // key
  stock_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  numeracao: string | null;
  discount: number;
}

export function POSModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [client, setClient] = React.useState<any>(null);
  const [paymentMethod, setPaymentMethod] = React.useState("Dinheiro");
  const [discount, setDiscount] = React.useState(0);
  const [cashbackToUse, setCashbackToUse] = React.useState(0);
  const [isDebt, setIsDebt] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Totals
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const itemsDiscount = items.reduce((acc, item) => acc + (item.discount || 0), 0);
  const finalTotal = Math.max(0, subtotal - itemsDiscount - discount - cashbackToUse);
  
  // Cashback earn (example 5%)
  const cashbackEarned = Math.floor(finalTotal * 0.05);

  const addItem = (stock: any, size: string | null) => {
    const key = `${stock.id}-${size || 'default'}`;
    setItems(prev => {
      const existing = prev.find(i => i.id === key);
      if (existing) {
        return prev.map(i => i.id === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: key,
        stock_id: stock.id,
        product_id: stock.produto_id,
        name: stock.produto_nome,
        price: Number(stock.preco_venda),
        quantity: 1,
        numeracao: size,
        discount: 0
      }];
    });
    toast.success(`${stock.produto_nome} adicionado`);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleFinish = async () => {
    if (items.length === 0) {
      toast.error("Adicione itens à venda");
      return;
    }

    setIsSubmitting(true);
    try {
      const saleData = {
        client_id: client?.id || null,
        payment_method: paymentMethod,
        total_amount: finalTotal,
        discount: discount + itemsDiscount,
        paid_amount: isDebt ? 0 : finalTotal,
        is_debt: isDebt,
        cashback_used: cashbackToUse,
        cashback_earned: cashbackEarned,
        notes: "",
        items: items.map(i => ({
          stock_id: i.stock_id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.price,
          numeracao: i.numeracao,
          discount: i.discount
        }))
      };

      await createSale(saleData);
      toast.success("Venda realizada com sucesso!");
      
      // Reset POS
      setItems([]);
      setClient(null);
      setDiscount(0);
      setCashbackToUse(0);
      setIsDebt(false);
      onOpenChange(false);
      qc.invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar venda");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 flex flex-col gap-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
        <DialogHeader className="px-8 py-5 border-b border-border/40 bg-card/50 backdrop-blur-xl flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="size-10 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold">
                <ShoppingCart className="size-5 text-primary-foreground" />
             </div>
             <div>
                <DialogTitle className="font-display font-black text-xl">PDV Amstore</DialogTitle>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Ponto de Venda Inteligente</p>
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Data</p>
                <p className="text-sm font-black">{new Date().toLocaleDateString('pt-BR')}</p>
             </div>
             <Separator orientation="vertical" className="h-8" />
             <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Itens</p>
                <p className="text-sm font-black">{items.length}</p>
             </div>
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden bg-background">
          {/* Main Area: Items selection and Cart */}
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
            <ProductSearch onAdd={addItem} />
            
            <div className="flex-1 flex flex-col min-h-0 bg-card/40 rounded-[2rem] border border-border/40 overflow-hidden">
               <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                  <h3 className="font-display font-black text-sm uppercase tracking-wider flex items-center gap-2">
                     <ReceiptText className="size-4 text-gold" /> Itens do Pedido
                  </h3>
                  <Badge variant="outline" className="rounded-full px-3 font-bold border-gold/30 text-gold bg-gold/5">
                     Total: {items.reduce((s, i) => s + i.quantity, 0)} un.
                  </Badge>
               </div>
               
               <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                     {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 gap-3">
                           <ShoppingCart className="size-12" />
                           <p className="font-bold text-sm uppercase tracking-widest">Carrinho Vazio</p>
                        </div>
                     ) : items.map((item) => (
                       <div key={item.id} className="group flex items-center gap-4 p-4 rounded-3xl border border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm">
                          <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 font-display font-black text-xs text-muted-foreground">
                             {item.name.charAt(0)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                                <h4 className="font-bold truncate">{item.name}</h4>
                                {item.numeracao && (
                                   <Badge variant="secondary" className="h-5 px-1.5 rounded-md font-black text-[9px] bg-gold/10 text-gold border-none">
                                      TAM: {item.numeracao}
                                   </Badge>
                                )}
                             </div>
                             <p className="text-[10px] text-muted-foreground font-medium">Preço Unit: {brl(item.price)}</p>
                          </div>
                          
                          <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/40">
                                <Button 
                                   variant="ghost" size="icon" className="size-7 rounded-lg"
                                   onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                                >-</Button>
                                <span className="w-6 text-center font-black text-sm">{item.quantity}</span>
                                <Button 
                                   variant="ghost" size="icon" className="size-7 rounded-lg"
                                   onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}
                                >+</Button>
                             </div>
                             
                             <div className="text-right w-24">
                                <p className="font-black text-gold">{brl(item.price * item.quantity)}</p>
                             </div>
                             
                             <Button 
                                variant="ghost" size="icon" 
                                className="size-9 rounded-xl text-destructive hover:bg-destructive/10"
                                onClick={() => removeItem(item.id)}
                             >
                                <Trash2 className="size-4" />
                             </Button>
                          </div>
                       </div>
                     ))}
                  </div>
               </ScrollArea>
            </div>
          </div>
          
          {/* Sidebar: Checkout */}
          <div className="w-[380px] border-l border-border/40 bg-muted/10 p-8 flex flex-col gap-6">
            <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Cliente</Label>
               <ClientSearch selectedClient={client} onSelect={setClient} />
            </div>

            <Separator className="bg-border/40" />

            <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Pagamento & Ajustes</Label>
               
               <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "Dinheiro", icon: Banknote },
                    { id: "Cartão", icon: CreditCard },
                    { id: "PIX", icon: Wallet },
                    { id: "Crédito", icon: Coins }
                  ].map((m) => (
                    <Button
                      key={m.id}
                      variant={paymentMethod === m.id ? "default" : "outline"}
                      className={cn(
                        "h-12 rounded-2xl flex flex-col gap-1 items-center justify-center transition-all",
                        paymentMethod === m.id ? "bg-gradient-dark border-none shadow-elegant" : "bg-card"
                      )}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      <m.icon className="size-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{m.id}</span>
                    </Button>
                  ))}
               </div>

               <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                     <Percent className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                     <Input 
                        type="number"
                        placeholder="Desconto R$" 
                        className="pl-10 h-11 rounded-xl bg-card"
                        value={discount === 0 ? "" : discount}
                        onChange={e => setDiscount(Number(e.target.value))}
                     />
                  </div>
                  
                  {client && client.cashback_balance > 0 && (
                     <Button 
                        variant={cashbackToUse > 0 ? "default" : "outline"}
                        className="h-11 rounded-xl gap-2 font-bold px-4"
                        onClick={() => setCashbackToUse(cashbackToUse > 0 ? 0 : Math.min(finalTotal, client.cashback_balance))}
                     >
                        <Coins className="size-4" /> Use Cashback
                     </Button>
                  )}
               </div>

               <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/40">
                  <div className="flex items-center gap-2">
                     <input 
                        type="checkbox" 
                        id="is_debt" 
                        className="size-4 accent-gold"
                        checked={isDebt}
                        onChange={e => setIsDebt(e.target.checked)}
                     />
                     <Label htmlFor="is_debt" className="cursor-pointer font-bold select-none">Venda no Fiado</Label>
                  </div>
                  {isDebt && <Badge className="bg-destructive/10 text-destructive border-none">A receber</Badge>}
               </div>
            </div>

            <Separator className="bg-border/40" />

            <div className="mt-auto space-y-4">
               <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground font-medium">Subtotal</span>
                     <span className="font-bold">{brl(subtotal)}</span>
                  </div>
                  {(discount > 0 || itemsDiscount > 0) && (
                    <div className="flex justify-between text-sm text-destructive">
                       <span className="font-medium">Descontos</span>
                       <span className="font-bold">-{brl(discount + itemsDiscount)}</span>
                    </div>
                  )}
                  {cashbackToUse > 0 && (
                    <div className="flex justify-between text-sm text-success">
                       <span className="font-medium">Cashback Utilizado</span>
                       <span className="font-bold">-{brl(cashbackToUse)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border/40 my-2" />
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total a Pagar</p>
                        <h2 className="text-3xl font-display font-black text-gold">{brl(finalTotal)}</h2>
                     </div>
                     {client && (
                       <div className="text-right mb-1">
                          <p className="text-[8px] uppercase font-bold text-success tracking-tighter">Ganhará Cashback</p>
                          <p className="text-xs font-black text-success">+{brl(cashbackEarned)}</p>
                       </div>
                     )}
                  </div>
               </div>

               <Button 
                  className="w-full bg-gradient-gold h-16 rounded-[1.5rem] font-display font-black text-lg shadow-gold hover:shadow-gold/60 transition-all border-none"
                  onClick={handleFinish}
                  disabled={isSubmitting || items.length === 0}
               >
                  {isSubmitting ? "Finalizando..." : "FINALIZAR VENDA"}
               </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
