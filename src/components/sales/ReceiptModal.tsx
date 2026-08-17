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
import logoAsset from "@/assets/store-logo.png.asset.json";

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

  // If no sale object, we might be in a preview or something went wrong.
  // We provide a basic fallback structure to avoid the error screen.
  const displaySale = sale || {
    id: "temp-id",
    sale_code: "PREVIA",
    created_at: new Date().toISOString(),
    items: [],
    total_amount: 0,
    discount: 0,
    cashback_used: 0,
    status: 'pago',
    payment_method: 'DINHEIRO',
    sale_type: 'VAREJO'
  };

  const displayClient = client || { name: "CONSUMIDOR", phone: "" };
  const items = displaySale.items || [];
  const subtotal = (displaySale?.total_amount || 0) + (displaySale?.discount || 0) + (displaySale?.cashback_used || 0);
  const isCancelled = displaySale?.status === 'cancelado';
  const isAwarded = displaySale?.is_awarded === true;

  // Load QR Library dynamically
  React.useEffect(() => {
    if (!open || isPreview || isCancelled) return;

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
  }, [open, isPreview, isCancelled]);

  // Generate QR Code once library is loaded and sale exists
  React.useEffect(() => {
    if (qrLoaded && qrcodeRef.current && displaySale && !isPreview && !isCancelled) {
      // Clear previous
      qrcodeRef.current.innerHTML = "";
      
      const codigoUnico = displaySale.promo_qr || `QR-PROM-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const checkUrl = `${window.location.origin}/sorteio?codigo=${codigoUnico}`;
      
      new window.QRCode(qrcodeRef.current, {
        text: checkUrl,
        width: 160,
        height: 160,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  }, [qrLoaded, displaySale, isPreview, isCancelled]);



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
      link.download = `cupom-${displaySale.sale_code || displaySale.id?.toString().slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagem gerada! Compartilhe no WhatsApp.");
      if (displayClient?.phone) {
        const phone = displayClient.phone.replace(/\D/g, '');
        const text = encodeURIComponent(`Olá ${displayClient.name}, segue seu cupom da Amstore!`);
        window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
      }
    } catch (err) {
      toast.error("Erro ao gerar imagem");
    }
  };


  const { data: promoConfigs = [] } = useRows<any>("qr_promo_config");
  const { data: appSettings = [] } = useRows<any>("app_settings");
  const promoConfig = promoConfigs?.[0];

  const getSetting = (key: string) => {
    const setting = appSettings?.find((s: any) => s.key === key);
    if (!setting) return null;
    try {
      return JSON.parse(setting.value);
    } catch {
      return setting.value;
    }
  };

  const storeWebsite = getSetting("store_website");
  const storeInstagram = getSetting("store_instagram");
  const storeLogo = getSetting("store_logo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background sm:rounded-[2rem] border-none shadow-2xl flex flex-col h-[95vh] sm:max-h-[90vh] [&>button]:hidden">
        
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">{isPreview ? "Prévia do Cupom" : "Cupom de Venda"}</h3>
            <span className="text-[10px] text-muted-foreground uppercase font-medium font-mono tracking-tighter">Padrao Fiscal 80mm</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
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
            className="print-only bg-white text-black p-4 sm:p-6 border border-gray-300 font-mono text-[11px] leading-tight mx-auto max-w-[400px] print:border-none"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* --- CABEÇALHO DA LOJA --- */}
            <div className="text-center space-y-2 mb-4">
              <h2 className="font-bold text-lg uppercase tracking-[0.2em] py-2">
                AMSTORE BAGSHOES
              </h2>
              <div className="text-[10px] space-y-0.5">
                <p>Rua Medeiros Neto, 12-A - Centro</p>
                <p>Jequié - Ba</p>
                <p>Telefone: {getSetting("store_phone") || "73999269136"}</p>
              </div>
              
              <div className="border-t border-black my-2" />
              <h3 className="font-bold text-[11px] uppercase">CUPOM FISCAL</h3>
              <div className="border-t border-black my-2" />
              
              {isCancelled && <p className="text-destructive font-bold text-lg border-2 border-destructive py-1 my-2 rotate-[-5deg]">CANCELADA</p>}
            </div>

            {/* --- DADOS DA VENDA --- */}
            <div className="space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="w-20">Pedido:</span>
                <span className="flex-1 text-right">{displaySale?.sale_code || displaySale?.id?.toString().slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="w-20">Cliente:</span>
                <span className="flex-1 text-right font-bold truncate">{(displayClient?.name || "CONSUMIDOR").toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="w-20">Vendedor:</span>
                <span className="flex-1 text-right">{displaySale?.seller_name || "amstorebagshoes"}</span>
              </div>
            </div>

            <div className="border-t border-black my-2" />
            <div className="text-center font-bold mb-2">ITENS</div>
            
            <div className="space-y-3 mb-4">
              {items.map((item: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="flex-1 truncate pr-2">
                      {item.quantity || 0} x {(item.name || item.product_name || "PRODUTO").toUpperCase()} 
                      {item.numeracao ? ` (Nº ${item.numeracao} )` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>({brl(item.unit_price || 0)} )</span>
                    <span className="font-bold">{brl((item.quantity || 0) * (item.unit_price || 0) - (item.discount || 0))}</span>
                  </div>
                  {item.discount > 0 && (
                    <div className="flex justify-between text-[9px] text-gray-600 italic">
                      <span>Desconto Item:</span>
                      <span>- {brl(item.discount)}</span>
                    </div>
                  )}

                </div>
              ))}
            </div>

            <div className="border-t border-black my-2" />
            
            <div className="space-y-1 mb-4">
              <div className="flex justify-between font-bold">
                <span>Subtotal:</span>
                <span>{brl(subtotal || 0)}</span>
              </div>
              {(displaySale?.discount > 0) && (
                <div className="flex justify-between font-bold">
                  <span>Desconto:</span>
                  <span>{brl(displaySale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL LÍQUIDO:</span>
                <span>{brl(displaySale?.total_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Qtadd:</span>
                <span>{items.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0)} itens</span>
              </div>
            </div>

            <div className="border-t border-black my-2" />
            <div className="text-center font-bold mb-2">PAGAMENTO</div>
            <div className="border-t border-black my-2" />

            <div className="space-y-1 mb-4">
              <p className="font-bold">Pagamento:</p>
              
              {displaySale?.payment_method === 'Fiado' || displaySale?.is_debt ? (
                <>
                  <div className="flex justify-between font-bold border-2 border-black p-1 text-center my-1">
                    <span className="w-full">VENDA A PRAZO (FIADO)</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Status:</span>
                    <span className="font-bold">PENDENTE</span>
                  </div>
                  {(displaySale.installments?.length > 0 || displaySale.parcelas?.length > 0) && (
                    <div className="mt-2 space-y-1 border-t border-dashed border-black pt-1">
                      <p className="font-bold text-[9px]">PLANO DE PARCELAMENTO:</p>
                      {(displaySale.installments || displaySale.parcelas).map((inst: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[9px]">
                          <span>{inst.installment_number || inst.number || (idx + 1)}ª Parcela ({new Date(inst.due_date).toLocaleDateString('pt-BR')}):</span>
                          <span>{brl(inst.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span>Data:</span>
                    <span>{new Date(displaySale?.created_at || new Date()).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{displaySale?.payment_method?.toUpperCase() || "DINHEIRO"} :</span>
                    <span>{brl(displaySale?.total_amount || 0)}</span>
                  </div>
                  
                  <div className="border-t border-gray-300 my-1" />
                  <div className="flex justify-between font-bold">
                    <span>Total Pago:</span>
                    <span>{brl(displaySale?.total_amount || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-black my-2" />

            {/* --- CASHBACK DISPONÍVEL --- */}
            {displaySale?.cashback_earned > 0 && (
              <div className="text-center py-2 space-y-2">
                <div className="bg-[#FFF9C4] border border-[#FBC02D] p-3 rounded-md text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-[10px]">
                    <Gift className="size-3 text-orange-500" /> CASHBACK DESTA VENDA
                  </div>
                  <div className="text-sm font-black my-1">{brl(displaySale.cashback_earned)}</div>
                  {displaySale?.payment_method === 'Fiado' || displaySale?.is_debt ? (
                    <p className="text-[9px] font-bold text-orange-700 italic">
                      * O cashback será liberado proporcionalmente aos pagamentos das parcelas.
                    </p>
                  ) : (
                    <p className="text-[9px] font-bold">Saldo liberado e disponível!</p>
                  )}
                </div>
              </div>
            )}


            {/* --- QR CODE PROMOCIONAL (CAIXA PONTILHADA) --- */}
            {!isPreview && !isCancelled && promoConfig && promoConfig.active && (
              <div className="border-2 border-dashed border-[#D53F8C] bg-[#FDF2F8] p-4 rounded-2xl text-center space-y-2">
                <div className="flex items-center justify-center gap-1 font-bold text-[#D53F8C] uppercase">
                  <Gift className="size-4" /> {promoConfig.name || "PROMOÇÃO AMSTORE"}
                </div>
                <div className="flex justify-center my-2">
                  {!qrLoaded ? (
                    <Loader2 className="size-8 animate-spin text-muted-foreground/20" />
                  ) : (
                    <div ref={qrcodeRef} className="bg-white p-2 rounded-lg" />
                  )}
                </div>
                <p className="text-[10px] font-bold text-black">Escaneie e veja sua surpresa!</p>
                <p className="text-[9px] font-mono text-gray-600">código: {displaySale.promo_qr || "QR-PROM-ERROR"}</p>
              </div>
            )}

            {/* --- RODAPÉ FINAL --- */}
            <div className="mt-4 pt-2 border-t border-black text-center">
              <p className="text-[10px] font-bold">{storeWebsite || "www.amstorebagshoes.com.br"}</p>
              {storeInstagram && <p className="text-[10px] font-bold mt-0.5">{storeInstagram}</p>}
              
              <div className="mt-6 text-[10px]">
                <p>Obrigado! Volte sempre!</p>
                <p className="mt-1 font-bold">{new Date(displaySale?.created_at || new Date()).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
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
