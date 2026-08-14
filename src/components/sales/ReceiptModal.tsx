import * as React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brl, dateTimeBR } from "@/lib/format";
import { 
  Printer, 
  Share2,
  X,
  Smartphone,
  Loader2,
  Gift
} from "lucide-react";
import { toPng } from 'html-to-image';
import { toast } from "sonner";
import { useRows } from "@/lib/data";
import logoAsset from "@/assets/amstore-logo-receipt.png.asset.json";

declare global {
  interface Window {
    QRCode: any;
  }
}

export function ReceiptModal({ 
  open, 
  onOpenChange, 
  sale,
  client,
  isPreview = false
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  sale: any;
  client: any;
  isPreview?: boolean;
}) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const qrcodeRef = React.useRef<HTMLDivElement>(null);
  const [qrLoaded, setQrLoaded] = React.useState(false);

  // Load QR Library dynamically
  React.useEffect(() => {
    if (!open || isPreview || sale?.status === 'cancelado') return;

    const loadQRLibrary = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.QRCode) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    loadQRLibrary().then(() => {
      setQrLoaded(true);
    }).catch(err => {
      console.error("Failed to load QR library", err);
    });
  }, [open, isPreview, sale?.status]);

  // Generate QR Code once library is loaded and sale exists
  React.useEffect(() => {
    if (qrLoaded && qrcodeRef.current && sale && !isPreview && sale.status !== 'cancelado') {
      // Clear previous
      qrcodeRef.current.innerHTML = "";
      
      const codigoUnico = sale.promo_qr || `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const checkUrl = `${window.location.origin}/api/public/qr-check?code=${codigoUnico}`;
      
      new window.QRCode(qrcodeRef.current, {
        text: checkUrl,
        width: 160,
        height: 160,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  }, [qrLoaded, sale, isPreview]);

  if (!sale || !sale.id) {
    if (open) {
      console.error("ReceiptModal Error: Venda não encontrada ou incompleta.", { sale });
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md p-10 text-center bg-background rounded-[2rem]">
            <div className="flex flex-col items-center gap-4">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="size-6 text-destructive" />
              </div>
              <h3 className="text-lg font-black font-display">Erro ao Carregar Recibo</h3>
              <p className="text-sm text-muted-foreground">
                A venda foi processada com sucesso, mas os dados para exibição do cupom estão incompletos ou não puderam ser carregados.
              </p>
              <Button 
                className="mt-2 w-full font-bold rounded-xl" 
                onClick={() => onOpenChange(false)}
              >
                Voltar ao PDV
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    return null;
  }


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
      const link = document.createElement('a');
      link.download = `cupom-${sale.sale_code || sale.id?.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagem gerada! Compartilhe no WhatsApp.");
      if (client?.phone) {
        const phone = client.phone.replace(/\D/g, '');
        const text = encodeURIComponent(`Olá ${client.name}, segue seu cupom da Amstore!`);
        window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
      }
    } catch (err) {
      toast.error("Erro ao gerar imagem");
    }
  };

  const items = sale.items || [];
  const subtotal = (sale?.total_amount || 0) + (sale?.discount || 0) + (sale?.cashback_used || 0);
  const isCancelled = sale?.status === 'cancelado';
  const isAwarded = sale?.is_awarded === true;

  const { data: promoConfigs = [] } = useRows<any>("qr_promo_config");
  const promoConfig = promoConfigs?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background sm:rounded-[2rem] border-none shadow-2xl flex flex-col h-[95vh] sm:max-h-[90vh] [&>button]:hidden">
        
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">{isPreview ? "Prévia do Cupom" : "Cupom de Venda"}</h3>
            <span className="text-[10px] text-muted-foreground uppercase font-medium font-mono tracking-tighter">Padrao Fiscal 80mm</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0">
          <div className="flex flex-col gap-4 print:hidden mb-6">
            <Button onClick={handleShareWhatsApp} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 font-bold h-12 rounded-xl shadow-lg">
              <Share2 className="size-4" /> Gerar Imagem para WhatsApp
            </Button>
            <div className="grid grid-cols-2 gap-3">
               <Button variant="outline" className="gap-2 font-bold h-12 rounded-xl bg-[#6B46C1] text-white hover:bg-[#553C9A] border-none shadow-md" onClick={() => window.location.href = `intent://...`}>
                <Smartphone className="size-4" /> ESC/POS
              </Button>
              <Button variant="outline" className="gap-2 font-bold h-12 rounded-xl shadow-sm" onClick={handlePrint}>
                <Printer className="size-4" /> Imprimir
              </Button>
            </div>
          </div>

          <div 
            ref={receiptRef}
            className="print-only bg-white text-black p-4 sm:p-6 border-2 border-dashed border-gray-400 font-mono text-[11px] leading-tight mx-auto max-w-[400px] print:border-none"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* --- CABEÇALHO DA LOJA --- */}
            <div className="text-center space-y-1 mb-4">
              <h2 className="font-bold text-base uppercase">AMSTORE BAGSHOES</h2>
              <div className="text-[9px]">
                <p>CNPJ: XX.XXX.XXX/XXXX-XX</p>
                <p>Tel: (73) 99120-0426</p>
                <p>Rua Waldeiza Rosa, 42 - A - Jequié - BA</p>
              </div>
              {isCancelled && <p className="text-destructive font-bold text-lg border-2 border-destructive py-1 my-2 rotate-[-5deg]">CANCELADA</p>}
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            {/* --- DADOS DA VENDA --- */}
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Cupom:</span><span>{sale?.sale_code || sale?.id?.slice(0, 8)}</span></div>
              <div className="flex justify-between"><span>Data:</span><span>{dateTimeBR(sale?.created_at || new Date().toISOString())}</span></div>
              <div className="flex justify-between"><span>Cliente:</span><span className="font-bold">{(client?.name || "CONSUMIDOR").toUpperCase()}</span></div>
              <div className="flex justify-between"><span>Tipo:</span><span>{sale?.sale_type || "Varejo"}</span></div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="font-bold mb-1">ITENS</div>
            
            <div className="space-y-2">
              {items.map((item: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <span className="flex-1 truncate pr-2">{(item.name || item.product_name || "PRODUTO").toUpperCase()} {item.numeracao ? `- TAM ${item.numeracao}` : ''}</span>
                    <span>{brl((item.quantity || 0) * (item.unit_price || 0))}</span>
                  </div>
                  <div className="text-[10px] pl-2">{item.quantity || 0}x {brl(item.unit_price || 0)}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />
            
            <div className="space-y-0.5">
              <div className="flex justify-between"><span>Subtotal:</span><span>{brl(subtotal || 0)}</span></div>
              {(sale?.discount > 0) && <div className="flex justify-between"><span>Desconto:</span><span>-{brl(sale.discount)}</span></div>}
              {(sale?.cashback_used > 0) && <div className="flex justify-between"><span>Cashback:</span><span>-{brl(sale.cashback_used)}</span></div>}
              <div className="flex justify-between font-bold text-sm pt-1"><span>TOTAL:</span><span>{brl(sale?.total_amount || 0)}</span></div>
              <div className="flex justify-between"><span>Pago:</span><span>{brl(sale?.paid_amount ?? (sale?.is_debt ? 0 : (sale?.total_amount || 0)))}</span></div>
              {sale?.is_debt && sale?.installments && Array.isArray(sale.installments) && sale.installments.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-dashed border-gray-200 pt-1">
                  <div className="text-[9px] font-bold text-gray-500 uppercase">Detalhamento das Parcelas (Fiado)</div>
                  {sale.installments.map((inst: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span>{inst.number}ª Parcela ({inst.due_date ? new Date(inst.due_date).toLocaleDateString('pt-BR') : 'N/A'})</span>
                      <span>{brl(inst.amount || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
              {((sale?.total_amount || 0) - (sale?.paid_amount ?? (sale?.is_debt ? 0 : (sale?.total_amount || 0)))) > 0.01 && !sale?.is_debt && (
                <div className="flex justify-between font-bold"><span>Restante:</span><span>{brl((sale.total_amount || 0) - (sale.paid_amount ?? (sale.total_amount || 0)))}</span></div>
              )}
              <div className="flex justify-between"><span>Forma Pagto:</span><span>{sale?.payment_method?.toUpperCase() || "N/A"}</span></div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            {/* --- QR CODE PROMOCIONAL --- */}
            {!isPreview && !isCancelled && promoConfig && promoConfig.active && (
              <div className="text-center py-2">
                <p className="font-bold mb-2 flex items-center justify-center gap-2">
                   <Gift className="size-3" /> PROMOÇÃO: {promoConfig.name || "QR Code Premiado"}
                </p>
                <div className="flex justify-center my-3 min-h-[160px]">
                  {!qrLoaded ? <Loader2 className="size-8 animate-spin text-muted-foreground/20 self-center" /> : <div ref={qrcodeRef} id="qrcode-cupom" />}
                </div>
                <p className="text-[8px] text-muted-foreground mb-2">Código: {sale.promo_qr || "GERANDO..."}</p>
                
                {isAwarded ? (
                  <p className="text-green-700 font-bold leading-tight px-2">
                    {promoConfig.awarded_message || "PARABÉNS! Você foi sorteado!"}
                  </p>
                ) : (
                  <p className="text-gray-500 text-[9px] leading-tight px-4">
                    {promoConfig.standard_message || "Que pena! Continue comprando para concorrer."}
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-dashed border-gray-300 my-2" />

            {/* --- RODAPÉ --- */}
            <div className="text-center text-[9px] space-y-1 mt-2">
              <p>Obrigado pela preferência! 🌟</p>
              <p className="font-bold">AmStore Bagshoes</p>
              <p>{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            .print-only, .print-only * { visibility: visible !important; }
            .print-only { 
              position: absolute !important; 
              left: 0 !important; 
              top: 0 !important; 
              width: 100% !important;
              margin: 0 !important;
              padding: 4mm !important;
              border: none !important;
            }
            @page { size: auto; margin: 0; }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
