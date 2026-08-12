import * as React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { brl, dateTimeBR } from "@/lib/format";
import { 
  Printer, 
  Share2,
  X,
  Smartphone,
  CheckCircle2
} from "lucide-react";
import { toPng } from 'html-to-image';
import { toast } from "sonner";
import logoAsset from "@/assets/amstore-logo-receipt.png.asset.json";

export function ReceiptModal({ 
  open, 
  onOpenChange, 
  sale,
  client 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  sale: any;
  client: any;
}) {
  const receiptRef = React.useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    if (!receiptRef.current) return;
    
    try {
      const dataUrl = await toPng(receiptRef.current, { 
        backgroundColor: '#fff',
        pixelRatio: 2,
      });
      
      // Since we can't directly "share" an image file to WhatsApp from a web browser without a backend or specialized API,
      // we'll download it and provide the link, or just download it for the user to share.
      const link = document.createElement('a');
      link.download = `cupom-${sale.sale_code || sale.id.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success("Imagem gerada! Agora você pode enviá-la via WhatsApp.");
      
      if (client?.phone) {
        const phone = client.phone.replace(/\D/g, '');
        const text = encodeURIComponent(`Olá ${client.name}, segue o cupom da sua compra na Amstore!`);
        window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
      }
    } catch (err) {
      toast.error("Erro ao gerar imagem para WhatsApp");
    }
  };

  const handleRawBT = () => {
    // RAWBT uses a custom protocol to trigger printing from Android apps
    // This is a common pattern for 80mm thermal printers
    window.location.href = `intent://com.rawbt.print/print#Intent;scheme=rawbt;package=com.rawbt.print;S.data=${encodeURIComponent(receiptRef.current?.innerText || "")};end`;
  };

  const items = sale.items || [];
  const subtotal = sale.total_amount + (sale.discount || 0) + (sale.cashback_used || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background sm:rounded-[2rem] border-none shadow-2xl flex flex-col h-[95vh] sm:max-h-[90vh]">
        
        {/* Header Actions */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">Cupom de Venda</h3>
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Impressora Térmica 80mm</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0">
          <div className="flex flex-col gap-4 print:hidden mb-6">
            <Button 
              onClick={handleShareWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 font-bold h-12 rounded-xl"
            >
              <Share2 className="size-4" /> Gerar Imagem para WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-3">
               <Button 
                variant="outline" 
                className="gap-2 font-bold h-12 rounded-xl bg-[#6B46C1] text-white hover:bg-[#553C9A] border-none"
                onClick={handleRawBT}
              >
                <Smartphone className="size-4" /> RECIBO
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 font-bold h-12 rounded-xl"
                onClick={handlePrint}
              >
                <Printer className="size-4" /> Imprimir
              </Button>
            </div>
          </div>

          {/* The Actual Receipt Content - Formatted for Thermal 80mm */}
          <div 
            ref={receiptRef}
            className="bg-white text-black p-4 sm:p-8 rounded-lg shadow-inner font-mono text-[14px] leading-relaxed mx-auto max-w-[380px] print:shadow-none print:p-0"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            <div className="flex flex-col items-center text-center gap-2 mb-4">
              <img src={logoAsset.url} alt="Amstore" className="h-12 w-auto grayscale" />
              <h2 className="font-bold text-lg uppercase tracking-tighter">Amstore Calcados</h2>
              <p className="text-[10px] leading-tight">
                Rua Waldeiza Rosa, 42 - A - Aurora<br />
                Jequié - BA<br />
                TEL: 73991200426
              </p>
            </div>

            <div className="border-t-2 border-dashed border-black my-2" />
            <div className="text-center font-bold uppercase py-1">Cupom Fiscal</div>
            <div className="border-t-2 border-dashed border-black my-2" />

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>PEDIDO:</span>
                <span className="font-bold">{sale.sale_code || sale.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span>DATA:</span>
                <span>{dateTimeBR(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold">{client?.name || "CONSUMIDOR FINAL"}</span>
              </div>
              <div className="flex justify-between">
                <span>VENDEDOR:</span>
                <span>SISTEMA AUTOMATICO</span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-black my-4" />
            <div className="text-center font-bold uppercase mb-2">ITENS</div>
            
            <div className="space-y-2">
              {items.map((item: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="font-bold">{(item.name || item.product_name || "PRODUTO").toUpperCase()} {item.numeracao ? `(Nº ${item.numeracao})` : ''}</div>
                  <div className="flex justify-between pl-2">
                    <span>{item.quantity}un x {brl(item.unit_price)}</span>
                    <span className="font-bold">{brl(item.quantity * item.unit_price)}</span>
                  </div>
                  {item.discount > 0 && (
                    <div className="flex justify-between pl-2 text-[10px] italic">
                      <span>Desconto</span>
                      <span>-{brl(item.discount)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-black my-4" />
            
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>{brl(subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between font-bold">
                  <span>DESCONTO:</span>
                  <span>-{brl(sale.discount)}</span>
                </div>
              )}
              {sale.cashback_used > 0 && (
                <div className="flex justify-between font-bold">
                  <span>CASHBACK:</span>
                  <span>-{brl(sale.cashback_used)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-y-2 border-black py-1 my-1">
                <span>TOTAL:</span>
                <span>{brl(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>QTD:</span>
                <span>{items.reduce((acc: number, item: any) => acc + item.quantity, 0)} ITENS</span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-black my-4" />
            <div className="text-center font-bold uppercase mb-2">PAGAMENTO</div>
            
            <div className="space-y-1">
               <p className="font-bold">PAGAMENTOS REALIZADOS:</p>
               <div className="flex justify-between pl-2">
                  <span>DATA: {dateTimeBR(new Date().toISOString()).split(' ')[0]}</span>
               </div>
               <div className="flex justify-between pl-2">
                  <span>{sale.payment_method?.toUpperCase() || "DINHEIRO"}</span>
                  <span className="font-bold">{brl(sale.total_amount)}</span>
               </div>
               <div className="border-t border-black my-1" />
               <div className="flex justify-between font-bold">
                  <span>TOTAL PAGO:</span>
                  <span>{brl(sale.total_amount)}</span>
               </div>
            </div>

            {sale.cashback_earned > 0 && (
               <div className="mt-4 p-2 border-2 border-black border-dotted text-center">
                  <p className="font-bold uppercase text-[10px]">Parabéns! Você ganhou</p>
                  <p className="text-lg font-bold">{brl(sale.cashback_earned)}</p>
                  <p className="text-[9px]">de cashback para sua próxima compra!</p>
               </div>
            )}

            <div className="text-center mt-6 space-y-2">
              <p className="font-bold">{dateTimeBR(new Date().toISOString())}</p>
              <p className="uppercase font-bold">Obrigado! Volte Sempre!</p>
              
              {/* Promo QR Code - Only shows if mock promotion logic is "active" */}
              {/* In a real app, this would check a DB setting like app_settings.key = 'promo_qrcode_active' */}
              {false && ( // Disabled by default per user request: "só deve mostrar se configurar e ativar"
                <div className="flex flex-col items-center gap-2 pt-2 border-t border-dotted border-black">
                  <p className="text-[10px]">Você tem um qr-code especial!</p>
                  <div className="size-24 border-2 border-black p-1">
                    <div className="size-full bg-[radial-gradient(black_2px,transparent_0)] bg-[length:4px_4px]" />
                  </div>
                  <p className="text-[9px] uppercase font-bold">Parabéns! Você foi sorteado! Use QR-Code e VERIFIQUE! Você ganhou um bônus especial de cashback!</p>
                  <p className="font-bold mt-1">{brl(20.00)} de cashback!</p>
                  <p className="text-[8px] opacity-60">Código: CB-${Math.random().toString(36).substring(7).toUpperCase()}</p>
                </div>
              )}
              
              <div className="pt-4 text-[9px]">
                www.amstorecalcados.com.br
              </div>
              <div className="border-t-2 border-dashed border-black w-full my-2" />
              <div className="border-t-2 border-dashed border-black w-full" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
