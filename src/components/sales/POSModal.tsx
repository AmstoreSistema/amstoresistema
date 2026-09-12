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
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl, toISODate, formatSaleDateISO } from "@/lib/format";
import { 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Wallet, 
  Banknote,
  Percent,
  Coins,
  ReceiptText,
  Shield,
  User,
  Tag,
  Building2,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRows } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

import { ClientSearch } from "./ClientSearch";
import { ProductSearch } from "./ProductSearch";
import { ReceiptModal } from "./ReceiptModal";
import { DebtAlertModal } from "./DebtAlertModal";
import { createSale } from "@/lib/sales.functions";
import { getClientDetails } from "@/lib/clients.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";


export interface POSCartItem {
  id: string; // key
  stock_id?: string | null;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  numeracao: string | null;
  discount: number;
  imagem_url?: string | null;
  /** Se true, o estoque já foi debitado na saída do condicional — não debitar novamente */
  skipStockDecrement?: boolean;
}

interface POSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cliente pré-selecionado vindo de um Condicional */
  initialClient?: any;
  /** Itens pré-carregados vindos de um Condicional */
  initialItems?: POSCartItem[];
}

export function POSModal({ open, onOpenChange, initialClient, initialItems }: POSModalProps) {
  if (!open) return null;
  return (
    <POSModalInner
      open={open}
      onOpenChange={onOpenChange}
      initialClient={initialClient}
      initialItems={initialItems}
    />
  );
}

function POSModalInner({ open, onOpenChange, initialClient, initialItems }: POSModalProps) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useRows<any>("financial_accounts");
  
  const [items, setItems] = React.useState<POSCartItem[]>([]);
  const [client, setClient] = React.useState<any>(null);
  const [paymentMethod, setPaymentMethod] = React.useState("Dinheiro");
  const [discount, setDiscount] = React.useState(0);
  const [cashbackToUse, setCashbackToUse] = React.useState(0);
  const [isDebt, setIsDebt] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [installmentsCount, setInstallmentsCount] = React.useState(1);
  const [installments, setInstallments] = React.useState<{ number: number; amount: number; due_date: string }[]>([]);
  
  // New High-Fidelity fields
  const [saleType, setSaleType] = React.useState("Varejo");
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [protectionMethod, setProtectionMethod] = React.useState("Padrão");
  const [notes, setNotes] = React.useState("");
  const [saleDate, setSaleDate] = React.useState(() => toISODate(new Date()));
  const [saleCode, setSaleCode] = React.useState(() => `V${Date.now().toString().slice(-10)}`);

  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [lastSale, setLastSale] = React.useState<any>(null);
  const [debtAlert, setDebtAlert] = React.useState<{
    isOpen: boolean;
    clientName: string;
    debtAmount: number;
    pendingSalesCount: number;
  }>({
    isOpen: false,
    clientName: "",
    debtAmount: 0,
    pendingSalesCount: 0
  });

  const [mobileTab, setMobileTab] = React.useState<"cart" | "checkout">("cart");
  const totalItemsCount = React.useMemo(() => items.reduce((acc, i) => acc + i.quantity, 0), [items]);

  const fetchClientDetails = useServerFn(getClientDetails);

  // Injeta cliente e itens vindos de um Condicional quando o modal abre
  React.useEffect(() => {
    if (open) {
      setMobileTab("cart");
      if (initialItems && initialItems.length > 0) {
        setItems(initialItems.map(i => ({ ...i, discount: (i as any).discount ?? 0 })));
        if (initialClient) setClient(initialClient);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update accountId based on active account
  React.useEffect(() => {
    if (open) {
      const activeAccount = accounts.find((a: any) => a.active);
      if (activeAccount) {
        setAccountId(activeAccount.id);
      }
    }
  }, [accounts, open]);

  // Update sale code and check for debts when client changes
  React.useEffect(() => {
    // Reset alert immediately when client changes (or is cleared)
    setDebtAlert(prev => ({ ...prev, isOpen: false }));

    if (client) {
      console.log("Cliente selecionado, verificando débitos...", client.name);
      
      const checkDebts = async () => {
        try {
          // Double check if client is still selected to avoid race conditions
          if (!client) return;
          
          const details = await fetchClientDetails({ data: { client_id: client.id } });
          console.log("Detalhes do cliente recebidos para alerta:", details);

          // Find unpaid installments explicitly
          const unpaidInstallments = details.installments.filter((i: any) => 
            !['paid', 'paga', 'pago', 'finalizado'].includes(i.status?.toLowerCase())
          );

          console.log("Parcelas em aberto encontradas:", unpaidInstallments);

          // We check total_debt from stats which is calculated from pending installments in getClientDetails
          // Only trigger if we are not currently submitting a sale
          if (!isSubmitting && details && details.stats.total_debt > 0.009 && unpaidInstallments.length > 0) {
            console.log("Disparando alerta de pendência para:", client.name);
            setDebtAlert({
              isOpen: true,
              clientName: client.name,
              debtAmount: details.stats.total_debt,
              pendingSalesCount: unpaidInstallments.length
            });
          } else {
            console.log("Nenhum débito significativo encontrado para:", client.name);
          }
        } catch (error) {
          console.error("Error checking client debts:", error);
        }
      };
      
      checkDebts();

      const initials = (client.name || "")
        .split(' ')
        .filter((n: string) => n.length > 0)
        .map((n: string) => (n[0] || "").toUpperCase())
        .join('')
        .slice(0, 3);
      
      setSaleCode(prev => {
        const base = (prev || "").split('-')[0] || "";
        return `${base}-${initials}`;
      });
    } else {
      setSaleCode(prev => (prev || "").split('-')[0] || "");
    }
  }, [client?.id]); // Only run when client ID changes to avoid unnecessary triggers


  // Totals
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const itemsDiscount = items.reduce((acc, item) => acc + (item.discount || 0), 0);
  const finalTotal = Math.max(0, subtotal - itemsDiscount - discount - cashbackToUse);
  
  // Cashback earned is now handled server-side in createSale, but we can show an estimate
  const [estimatedCashback, setEstimatedCashback] = React.useState(0);
  const [clientCashback, setClientCashback] = React.useState(0);
  const { data: stockItemsData = [] } = useRows<any>("stock_products");
  const { data: cashbackConfigs = [] } = useRows<any>("cashback_config", {
    select: "*, material_categories(name)"
  });

  // Dynamically fetch real-time cashback balance for the selected client
  React.useEffect(() => {
    const fetchRealCashback = async () => {
      if (client?.id) {
        // Fetch client directly to get the synchronized balance from the database
        const { data: clientData } = await supabase
          .from("clients")
          .select("cashback_balance")
          .eq("id", client.id)
          .single();
        
        const realBalance = Number(clientData?.cashback_balance || 0);
        setClientCashback(realBalance);
        
        // Sincroniza o objeto client local para garantir que outros componentes usem o saldo real
        if (client.cashback_balance !== realBalance) {
          setClient((prev: any) => prev ? { ...prev, cashback_balance: realBalance } : null);
        }
      } else {
        setClientCashback(0);
      }
    };
    fetchRealCashback();
  }, [client?.id]);

  React.useEffect(() => {
    if (items.length > 0 && cashbackConfigs.length > 0) {
      const normalizeCategory = (value: unknown) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/s$/, "");
      let total = 0;
      items.forEach(item => {
        // Cálculo do valor líquido do item (preço * quantidade - desconto do item)
        const itemTotal = (item.price * item.quantity) - (item.discount || 0);
        
        // Busca o produto no estoque para identificar a categoria
        const stockItem = stockItemsData.find((si: any) => si.id === item.stock_id);
        
        // Busca a configuração de cashback para a categoria do produto
        const config = cashbackConfigs.find((c: any) => 
          c.active && normalizeCategory(c.category_name) === normalizeCategory(stockItem?.categoria)
        );
        
        if (config) {
          total += (itemTotal * Number(config.cashback_percent)) / 100;
        }
      });
      setEstimatedCashback(Number(total.toFixed(2)));
    } else {
      setEstimatedCashback(0);
    }
  }, [items, cashbackConfigs, stockItemsData]);



  React.useEffect(() => {
    if (isDebt && finalTotal > 0) {
      const baseAmount = Math.floor((finalTotal / installmentsCount) * 100) / 100;
      const newInst = Array.from({ length: installmentsCount }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() + i + 1);
        return {
          number: i + 1,
          amount: i === installmentsCount - 1 ? finalTotal - (baseAmount * (installmentsCount - 1)) : baseAmount,
          due_date: date.toISOString()
        };
      });
      setInstallments(newInst);
    } else {
      setInstallments([]);
    }
  }, [isDebt, finalTotal, installmentsCount]);


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
        discount: 0,
        imagem_url: stock.imagem_url
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

    if (isDebt && (!client || !client.id)) {
      toast.error("Para vendas no fiado (crediário), é obrigatório selecionar um cliente cadastrado.");
      return;
    }

    if (!isDebt && !accountId) {
      toast.error("Selecione a conta que receberá o pagamento");
      return;
    }

    if (!Number.isFinite(finalTotal) || finalTotal < 0) {
      toast.error("Confira os valores da venda antes de finalizar");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("Iniciando finalização de venda...", { items, finalTotal, paymentMethod, isDebt });
      
      const saleData = {
        client_id: client?.id || null,
        payment_method: paymentMethod,
        total_amount: finalTotal,
        discount: 0,
        discount_amount: discount,
        paid_amount: isDebt ? 0 : finalTotal,
        is_debt: isDebt,
        cashback_used: cashbackToUse,
        cashback_earned: estimatedCashback,
        notes: notes,
        sale_type: saleType,
        financial_account_id: accountId,
        protection_method: protectionMethod,
        sale_code: saleCode,
        created_at: formatSaleDateISO(saleDate),
        items: items.map(i => ({
          // Se o item veio de condicional (skipStockDecrement), passamos stock_id=null
          // para que a stored procedure não tente decrementar o estoque novamente
          stock_id: (i as any).skipStockDecrement
            ? null
            : (i.stock_id && !i.stock_id.startsWith("virtual:") ? i.stock_id : null),
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.price,
          numeracao: i.numeracao,
          discount: i.discount
        })),
        installments: installments
      };

      console.log("Payload da venda:", saleData);

      const result = await createSale({ data: saleData });
      console.log("Resultado createSale:", result);

      const saleId = result?.saleId;
      if (!saleId) {
        throw new Error("O servidor processou a venda mas não retornou um ID válido.");
      }

      toast.success("Venda realizada com sucesso!");

      // Limpeza segura do estado do PDV
      const resetPOS = () => {
        setItems([]);
        setDiscount(0);
        setCashbackToUse(0);
        setIsDebt(false);
        setNotes("");
        setSaleType("Varejo");
        setMobileTab("cart");
        setDebtAlert({
          isOpen: false,
          clientName: "",
          debtAmount: 0,
          pendingSalesCount: 0
        });
      };

      try {
        console.log("Preparando dados do recibo...");
        let clientInfo = client;
        if (client?.id) {
          try {
            const { data: clientData, error: clientErr } = await supabase
              .from("clients")
              .select("*")
              .eq("id", client.id)
              .maybeSingle();
            
            if (clientErr) console.warn("Erro ao buscar detalhes do cliente para o recibo:", clientErr);
            if (clientData) clientInfo = clientData;
          } catch (cErr) {
            console.error("Erro na busca de cliente:", cErr);
          }
        }
        
        const lastSaleData = {
            id: saleId,
            ...saleData,
            promo_qr: result.promoQr,
            is_awarded: result.isAwarded,
            cashback_earned: result.cashbackEarned || saleData.cashback_earned,
             items: (saleData.items || []).map(item => ({
              ...item,
              name: items.find(i => i.stock_id === item.stock_id)?.name || "Produto"
            })),
            installments: installments.map(inst => ({
              installment_number: inst.number,
              due_date: inst.due_date,
              amount: inst.amount
            }))
        };

        setLastSale(lastSaleData);
        setClient(clientInfo);
        setReceiptOpen(true);
        resetPOS();
        console.log("Recibo aberto com sucesso.");
      } catch (receiptErr) {
        console.error("Erro ao preparar/abrir recibo:", receiptErr);
        toast.warning("Venda salva, mas houve um erro ao exibir o recibo.");
        resetPOS();
      }

      // Invalidação cirúrgica e paralela em segundo plano (não trava o recibo nem dispara 30+ requisições globais)
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["sales"] }),
        qc.invalidateQueries({ queryKey: ["sales-stats"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["stock-products"] }),
        qc.invalidateQueries({ queryKey: ["stock_products"] }),
        qc.invalidateQueries({ queryKey: ["stock-stats"] }),
        qc.invalidateQueries({ queryKey: ["financial_accounts"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
        qc.invalidateQueries({ queryKey: ["transactions-stats"] }),
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["sale_installments"] }),
        qc.invalidateQueries({ queryKey: ["cashback"] }),
      ]).catch((err) => console.warn("Erro ao invalidar queries da venda:", err));
    } catch (error: any) {
      console.error("ERRO CRÍTICO NA FINALIZAÇÃO DA VENDA:", error);
      const errorMessage = error.message || "Erro desconhecido ao processar venda.";
      toast.error(`Falha ao finalizar venda: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-7xl h-[100dvh] sm:h-[95vh] sm:max-h-[98vh] p-0 flex flex-col gap-0 overflow-hidden sm:rounded-[1.5rem] border-none shadow-2xl">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/40 bg-card/50 backdrop-blur-xl flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
             <div className="size-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
                <ShoppingCart className="size-4 sm:size-5 text-primary-foreground" />
             </div>
             <div className="min-w-0">
                <DialogTitle className="font-display font-black text-base sm:text-lg truncate">PDV Amstore</DialogTitle>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate">Ponto de Venda</p>
                  <Badge variant="outline" className="h-4 text-[9px] font-mono border-gold/30 text-gold bg-gold/5 shrink-0">
                    {saleCode}
                  </Badge>
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6">
             <div className="hidden sm:flex items-center gap-2 text-right">
                <div>
                   <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Vendedor</p>
                   <div className="flex items-center gap-1.5 justify-end">
                      <User className="size-3 text-gold" />
                      <p className="text-xs font-black">Sistema Automático</p>
                   </div>
                </div>
             </div>
             <Separator orientation="vertical" className="hidden sm:block h-8" />
             <div className="hidden md:flex text-right flex-col items-end">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Data da Venda</p>
                <Input 
                  type="date" 
                  value={saleDate} 
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="h-7 w-32 text-xs font-black p-1 bg-transparent border-none focus-visible:ring-0 text-right cursor-pointer hover:bg-muted/30 rounded-md"
                />
             </div>
             <Separator orientation="vertical" className="hidden md:block h-8" />
             <div className="text-right flex items-center gap-1.5">
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-bold border-gold/30 text-gold bg-gold/5 text-xs">
                   {totalItemsCount} {totalItemsCount === 1 ? "item" : "itens"}
                </Badge>
             </div>
          </div>
        </DialogHeader>

        {/* Abas exclusivas para Mobile / Telas pequenas: Alterna entre Selecionar Produtos e Finalizar Pagamento */}
        <div className="lg:hidden flex items-center border-b border-border/40 bg-muted/40 p-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("cart")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all",
              mobileTab === "cart"
                ? "bg-card text-gold shadow-sm border border-border/50 font-black"
                : "text-muted-foreground hover:bg-card/40"
            )}
          >
            <ShoppingCart className="size-3.5" />
            <span>1. Produtos e Carrinho</span>
            {totalItemsCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-gold/15 text-gold border-none font-black">
                {totalItemsCount}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileTab("checkout")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all",
              mobileTab === "checkout"
                ? "bg-card text-gold shadow-sm border border-border/50 font-black"
                : "text-muted-foreground hover:bg-card/40"
            )}
          >
            <CreditCard className="size-3.5" />
            <span>2. Cliente e Pagamento</span>
            {finalTotal > 0 && (
              <span className="text-[10px] font-black text-foreground ml-0.5">
                {brl(finalTotal)}
              </span>
            )}
          </button>
        </div>
        
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-background min-h-0">
          {/* Área 1: Seleção de Produtos e Carrinho */}
          <div className={cn(
            "flex-1 flex-col overflow-hidden p-3 sm:p-5 gap-3 sm:gap-5 min-w-0",
            mobileTab === "cart" ? "flex" : "hidden lg:flex"
          )}>
            <ProductSearch onAdd={addItem} />
            
            <div className="flex-1 flex flex-col min-h-0 bg-card/40 rounded-[1.2rem] sm:rounded-[1.5rem] border border-border/40 overflow-hidden">
               <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/40 flex items-center justify-between shrink-0">
                  <h3 className="font-display font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                     <ReceiptText className="size-4 text-gold" /> Itens do Pedido
                  </h3>
                  <Badge variant="outline" className="rounded-full px-2.5 sm:px-3 font-bold border-gold/30 text-gold bg-gold/5 text-xs">
                     Total: {totalItemsCount} un.
                  </Badge>
               </div>
               
               <ScrollArea className="flex-1 p-3 sm:p-4">
                  <div className="space-y-2.5 sm:space-y-3">
                      {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 gap-3">
                           <ShoppingCart className="size-12" />
                           <p className="font-bold text-sm uppercase tracking-widest">Carrinho Vazio</p>
                        </div>
                     ) : items.map((item) => (
                        <div key={item.id} className="group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-3 rounded-xl border border-border/40 bg-card hover:bg-muted/5 transition-all shadow-sm">
                           <div className="flex items-center gap-2.5 flex-1 min-w-0">
                             {item.imagem_url ? (
                               <div className="size-11 rounded-xl overflow-hidden shrink-0 border border-border/20">
                                 <img src={item.imagem_url} alt={item.name} className="w-full h-full object-cover" />
                               </div>
                             ) : (
                               <div className="size-11 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 font-display font-black text-xs text-muted-foreground">
                                 {item.name.charAt(0)}
                               </div>
                             )}

                             <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                   <h4 className="font-bold truncate text-xs sm:text-sm">{item.name}</h4>
                                   {item.numeracao && (
                                      <Badge variant="secondary" className="h-4 px-1.5 rounded-md font-black text-[9px] bg-gold/10 text-gold border-none shrink-0">
                                         Nº {item.numeracao}
                                      </Badge>
                                   )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <p className="text-[10px] text-muted-foreground font-medium">Unit: {brl(item.price)}</p>
                                   {item.discount > 0 && (
                                     <p className="text-[10px] text-destructive font-bold italic">(-{brl(item.discount)})</p>
                                   )}
                                </div>
                             </div>
                           </div>
                           
                           <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                              <div className="flex items-center gap-1.5">
                                 <Label className="text-[9px] uppercase font-bold text-muted-foreground tracking-tight sm:hidden">Desc:</Label>
                                 <Input 
                                   type="number" 
                                   value={item.discount || ""} 
                                   onChange={(e) => {
                                     const val = Number(e.target.value);
                                     setItems(prev => prev.map(i => i.id === item.id ? { ...i, discount: val } : i));
                                   }}
                                   className="h-8 w-16 text-[10px] font-bold px-1.5 rounded-lg border-border/40 bg-muted/20 text-center"
                                   placeholder="R$ 0"
                                 />
                              </div>

                              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg border border-border/40">
                                 <Button 
                                    variant="ghost" size="icon" className="size-7 rounded-md"
                                    onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                                 >-</Button>
                                 <span className="w-6 text-center font-black text-xs">{item.quantity}</span>
                                 <Button 
                                    variant="ghost" size="icon" className="size-7 rounded-md"
                                    onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}
                                 >+</Button>
                              </div>
                              
                              <div className="text-right min-w-[70px]">
                                 <p className="font-black text-xs sm:text-sm text-gold">{brl((item.price * item.quantity) - (item.discount || 0))}</p>
                              </div>
                              
                              <Button 
                                 variant="ghost" size="icon" 
                                 className="size-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                                 onClick={() => removeItem(item.id)}
                                 title="Remover item"
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
          
          {/* Área 2: Fechamento / Pagamento */}
          <div className={cn(
            "w-full lg:w-[420px] xl:w-[450px] border-t lg:border-t-0 lg:border-l border-border/40 bg-muted/10 p-4 sm:p-6 xl:p-8 flex-col gap-5 sm:gap-6 overflow-y-auto flex-1 min-h-0 lg:shrink-0 pb-36 sm:pb-8",
            mobileTab === "checkout" ? "flex" : "hidden lg:flex"
          )}>
            {/* Botão de retorno rápido ao carrinho exclusivo para mobile */}
            <div className="lg:hidden flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileTab("cart")}
                className="text-xs font-bold gap-1.5 text-gold -ml-2 h-8 hover:bg-gold/10"
              >
                <ArrowLeft className="size-3.5" />
                <span>Voltar aos Produtos ({totalItemsCount} un.)</span>
              </Button>
              <span className="text-xs font-black text-foreground">{brl(finalTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Tipo de Venda</Label>
                 <Select value={saleType} onValueChange={setSaleType}>
                    <SelectTrigger className="h-10 rounded-xl bg-card border-border/40 font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="size-3 text-gold" />
                        <SelectValue placeholder="Tipo" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Varejo">Varejo</SelectItem>
                       <SelectItem value="Atacado">Atacado</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Proteção</Label>
                 <Select value={protectionMethod} onValueChange={setProtectionMethod}>
                    <SelectTrigger className="h-10 rounded-xl bg-card border-border/40 font-bold text-xs">
                      <div className="flex items-center gap-2">
                        <Shield className="size-3 text-gold" />
                        <SelectValue placeholder="Proteção" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Padrão">Padrão</SelectItem>
                       <SelectItem value="Garantia Estendida">Garantia Estendida</SelectItem>
                       <SelectItem value="Sem Proteção">Sem Proteção</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            </div>

            <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Cliente da Venda</Label>
               <ClientSearch selectedClient={client} onSelect={setClient} />
            </div>

            <Separator className="bg-border/40" />

            <div className="space-y-4">
               <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Forma de Recebimento</Label>
               
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
                      disabled={isDebt}
                      className={cn(
                        "h-12 rounded-2xl flex flex-col gap-1 items-center justify-center transition-all",
                        paymentMethod === m.id ? "bg-gradient-dark border-none shadow-elegant" : "bg-card",
                        isDebt && "opacity-50 grayscale"
                      )}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      <m.icon className="size-4" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{m.id}</span>
                    </Button>
                  ))}
               </div>

               <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Conta para Recebimento</Label>
                 <Select value={accountId || ""} onValueChange={setAccountId} disabled={isDebt}>
                    <SelectTrigger className={cn("h-11 rounded-xl bg-card border-border/40 font-bold text-xs", isDebt && "opacity-50")}>
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-gold" />
                        <SelectValue placeholder="Selecione a conta" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                       {accounts.map((acc: any) => (
                         <SelectItem key={acc.id} value={acc.id}>
                           {acc.name} ({brl(acc.balance)})
                         </SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
               </div>

               <div className="flex items-center gap-3 pt-2">
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
                  
                  {client && clientCashback > 0 && (
                     <Button 
                        variant={cashbackToUse > 0 ? "default" : "outline"}
                        type="button"
                        className="h-11 rounded-xl gap-2 font-bold px-4 transition-all"
                        onClick={() => setCashbackToUse(cashbackToUse > 0 ? 0 : Math.min(finalTotal, clientCashback))}
                     >
                        <Coins className="size-4" /> Cashback: {brl(clientCashback)}
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
                        onChange={e => {
                           setIsDebt(e.target.checked);
                           if (!e.target.checked) setInstallmentsCount(1);
                        }}
                     />
                     <Label htmlFor="is_debt" className="cursor-pointer font-bold select-none text-sm">Lançar no Fiado</Label>
                  </div>
                  {isDebt && <Badge className="bg-destructive/10 text-destructive border-none text-[10px]">A receber</Badge>}
               </div>

               {isDebt && (
                  <div className="space-y-3 p-4 rounded-2xl bg-destructive/5 border border-destructive/10 animate-in fade-in slide-in-from-top-2">
                     <div className="flex justify-between items-center">
                        <Label className="text-[10px] uppercase font-bold text-destructive tracking-widest">Parcelas</Label>
                        <select 
                           className="bg-transparent border-none font-black text-destructive focus:ring-0 cursor-pointer text-sm"
                           value={installmentsCount}
                           onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                        >
                           {[1, 2, 3, 4, 5, 6, 10, 12].map(n => (
                              <option key={n} value={n} className="text-foreground">{n}x</option>
                           ))}
                        </select>
                     </div>
                     <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {installments.map((inst) => (
                            <div key={inst.number} className="flex justify-between gap-3 text-[11px] font-bold">
                               <div>
                                 <span className="text-muted-foreground">{inst.number}ª Parcela ({new Date(inst.due_date).toLocaleDateString('pt-BR')})</span>
                                 {estimatedCashback > 0 && finalTotal > 0 && (
                                   <div className="text-[9px] text-success mt-0.5">
                                     Libera {brl((estimatedCashback * inst.amount) / finalTotal)} de cashback
                                   </div>
                                 )}
                               </div>
                               <span className="text-destructive shrink-0">{brl(inst.amount)}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               <div className="space-y-2">
                 <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Observações</Label>
                 <textarea 
                    className="w-full h-20 rounded-xl bg-card border border-border/40 p-3 text-xs focus:ring-1 focus:ring-gold outline-none resize-none"
                    placeholder="Notas adicionais sobre a venda..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                 />
               </div>

            </div>

            <Separator className="bg-border/40" />

            <div className="mt-auto space-y-4 pt-4">
               <div className="space-y-2 bg-card/50 p-4 rounded-[1.5rem] border border-border/20">
                  <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground font-medium">Subtotal Bruto</span>
                     <span className="font-bold">{brl(subtotal)}</span>
                  </div>
                  {(discount > 0 || itemsDiscount > 0) && (
                    <div className="flex justify-between text-xs text-destructive">
                       <span className="font-medium">Total Descontos</span>
                       <span className="font-bold">-{brl(discount + itemsDiscount)}</span>
                    </div>
                  )}
                  {cashbackToUse > 0 && (
                    <div className="flex justify-between text-xs text-success">
                       <span className="font-medium">Cashback Aplicado</span>
                       <span className="font-bold">-{brl(cashbackToUse)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border/40 my-2" />
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Total Líquido</p>
                        <h2 className="text-4xl font-display font-black text-gold leading-none">{brl(finalTotal)}</h2>
                     </div>
                     {client && estimatedCashback > 0 && (
                       <div className="text-right mb-1">
                          <p className="text-[8px] uppercase font-bold text-success tracking-tighter">Bônus Cashback</p>
                          <p className="text-sm font-black text-success">+{brl(estimatedCashback)}</p>
                           <p className="text-[8px] text-muted-foreground mt-0.5">
                             {isDebt ? "Liberado conforme os pagamentos" : "Liberado ao finalizar"}
                           </p>
                       </div>
                     )}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                 <Button 
                    variant="outline"
                    className="h-16 rounded-[1.5rem] font-display font-black text-sm transition-all border-border/40"
                    onClick={() => {
                       if (items.length === 0) {
                          toast.error("Adicione itens à venda");
                          return;
                       }
                       setPreviewOpen(true);
                    }}
                 >
                    PRÉVIA RECIBO
                 </Button>
                 <Button 
                    className="bg-gradient-gold h-16 rounded-[1.5rem] font-display font-black text-lg shadow-gold hover:shadow-gold/60 transition-all border-none"
                    onClick={handleFinish}
                    disabled={isSubmitting || items.length === 0}
                 >
                    {isSubmitting ? "PROCESSANDO..." : "FINALIZAR"}
                 </Button>
               </div>
            </div>
          </div>
        </div>

        {/* Barra Fixa Inferior no Mobile quando estiver na aba de Produtos */}
        {mobileTab === "cart" && (
          <div className="lg:hidden p-3 border-t border-border/60 bg-card/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 shadow-lg z-10">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-tight">Total</p>
              <p className="text-lg font-display font-black text-gold leading-tight truncate">{brl(finalTotal)}</p>
              <p className="text-[10px] text-muted-foreground">{totalItemsCount} {totalItemsCount === 1 ? "item adicionado" : "itens adicionados"}</p>
            </div>
            <Button
              onClick={() => {
                if (items.length === 0) {
                  toast.info("Adicione pelo menos 1 produto antes de ir para o pagamento.");
                  return;
                }
                setMobileTab("checkout");
              }}
              className="bg-gradient-gold shadow-gold font-bold text-xs h-12 px-5 gap-2 text-primary-foreground shrink-0"
            >
              <span>Ir para Pagamento</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </DialogContent>

      <ReceiptModal 
         open={receiptOpen || previewOpen} 
         onOpenChange={(val) => {
            if (previewOpen) setPreviewOpen(false);
            if (receiptOpen) {
               setReceiptOpen(false);
               if (!val) onOpenChange(false);
            }
         }} 
         sale={receiptOpen ? lastSale : {
            id: "PREVIA-" + Date.now(),
            sale_code: saleCode,
            total_amount: finalTotal,
            discount: (discount || 0) + (itemsDiscount || 0),
            cashback_used: cashbackToUse || 0,
            cashback_earned: estimatedCashback || 0,
            payment_method: isDebt ? "Fiado" : paymentMethod,
            is_debt: isDebt,
            installments: installments || [],
            created_at: formatSaleDateISO(saleDate),
            items: items.map(i => ({
               name: i.name,
               quantity: i.quantity,
               unit_price: i.price,
               numeracao: i.numeracao,
               discount: i.discount
            }))
         }}
         client={client}
         isPreview={previewOpen}
      />

      <DebtAlertModal 
        isOpen={debtAlert.isOpen}
        clientName={debtAlert.clientName}
        debtAmount={debtAlert.debtAmount}
        pendingSalesCount={debtAlert.pendingSalesCount}
        onClose={() => {
          setDebtAlert(prev => ({ ...prev, isOpen: false }));
          setClient(null);
        }}
        onConfirm={() => {
          setDebtAlert(prev => ({ ...prev, isOpen: false }));
        }}
      />

    </Dialog>

  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
