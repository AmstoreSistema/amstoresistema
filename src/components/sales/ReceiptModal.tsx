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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/amstore-symbol.png.asset.json";

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
  isPreview = false,
  installments = [],
  payments = []
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  sale: any;
  client: any;
  isPreview?: boolean;
  installments?: any[];
  payments?: any[];
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

  // Fallback seguro: se displaySale não trouxer itens pré-carregados, busca os itens da venda no Supabase
  const { data: fetchedItems = [] } = useQuery({
    queryKey: ["receipt-sale-items", displaySale?.id],
    queryFn: async () => {
      if (!displaySale?.id || String(displaySale.id).startsWith("temp-") || String(displaySale.id).startsWith("PREVIA-")) {
        return [];
      }
      const { data } = await supabase
        .from("sale_items")
        .select("*, products(name)")
        .eq("sale_id", displaySale.id);
      return data || [];
    },
    enabled: open && (!displaySale?.items || displaySale.items.length === 0) && !!displaySale?.id && !String(displaySale.id).startsWith("PREVIA-"),
  });

  const rawItems = (displaySale?.items && displaySale.items.length > 0) ? displaySale.items : fetchedItems;
  const items = (rawItems || []).map((it: any) => ({
    ...it,
    name: it.name || it.product_name || it.products?.name || "PRODUTO",
  }));

  // 1. Soma de todos os produtos com seu preço original sem nenhum desconto (VALOR TOTAL)
  const itemsGrossTotal = items.reduce(
    (acc: number, item: any) => acc + (Number(item.quantity || 1) * Number(item.unit_price || 0)),
    0
  );

  // 2. Descontos aplicados nos itens
  const itemsDiscountTotal = items.reduce(
    (acc: number, item: any) => acc + Number(item.discount || 0),
    0
  );

  const saleDiscount = Number(displaySale?.discount || displaySale?.discount_amount || 0);
  const cashbackUsed = Number(displaySale?.cashback_used || 0);
  const totalLiquido = Number(displaySale?.total_amount || 0);

  // VALOR TOTAL: soma dos produtos sem desconto
  const valorTotalSemDesconto = itemsGrossTotal > 0
    ? itemsGrossTotal
    : (totalLiquido + itemsDiscountTotal + saleDiscount + cashbackUsed);

  // DESCONTO TOTAL: soma de todos os descontos (descontos nos itens + desconto de cashback acumulado + descontos gerais)
  const totalDescontos = Math.max(0, valorTotalSemDesconto - totalLiquido);

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

  const rawAddress = getSetting("store_address") || "Rua Medeiros Neto, 12-A - Centro";
  const storeCity = getSetting("store_city") || "Jequié - BA";
  const storePhone = getSetting("store_phone") || "73999269136";

  // Garante que cidade e estado nunca fiquem concatenados na linha do endereço
  // Cidade e estado aparecem apenas embaixo de "Rua Medeiros Neto, 12-A - Centro"
  const storeAddress = (rawAddress || "")
    .replace(/\s*-\s*Jequi[eé]\s*-\s*Ba(hia)?/gi, "")
    .replace(/\s*-\s*Jequi[eé]\s*-\s*BA/gi, "")
    .replace(/\s*-\s*Jequi[eé]/gi, "")
    .replace(/\s*-\s*Ba(hia)?/gi, "")
    .replace(/\s*-\s*$/g, "")
    .trim() || "Rua Medeiros Neto, 12-A - Centro";

  const [printingThermal, setPrintingThermal] = React.useState(false);

  // Converte imagem em mapa de bits 1-bit raster ESC/POS centralizado para 80mm (576 pontos)
  const imageToEscPosRaster = (imageUrl: string, targetWidth = 384, totalWidth = 576): Promise<number[]> => {
    if (!imageUrl) return Promise.resolve([]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const scale = targetWidth / img.width;
          const width = targetWidth - (targetWidth % 8);
          const height = Math.round(img.height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve([]); return; }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          const totalBytesPerRow = Math.floor(totalWidth / 8); // 72 bytes em 80mm
          const imgBytesPerRow = Math.floor(width / 8);
          const leftPadBytes = Math.floor((totalBytesPerRow - imgBytesPerRow) / 2);
          const rightPadBytes = totalBytesPerRow - imgBytesPerRow - leftPadBytes;

          const bytes: number[] = [];

          // Comando GS v 0 0 xL xH yL yH
          const xL = totalBytesPerRow & 0xff;
          const xH = (totalBytesPerRow >> 8) & 0xff;
          const yL = height & 0xff;
          const yH = (height >> 8) & 0xff;

          bytes.push(0x1d, 0x76, 0x30, 0, xL, xH, yL, yH);

          for (let y = 0; y < height; y++) {
            for (let p = 0; p < leftPadBytes; p++) bytes.push(0);

            for (let xByte = 0; xByte < imgBytesPerRow; xByte++) {
              let byteVal = 0;
              for (let bit = 0; bit < 8; bit++) {
                const px = (xByte * 8) + bit;
                const idx = (y * width + px) * 4;
                const r = data[idx] ?? 255;
                const g = data[idx + 1] ?? 255;
                const b = data[idx + 2] ?? 255;
                const a = data[idx + 3] ?? 0;
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                if (a > 128 && brightness < 170) {
                  byteVal |= (1 << (7 - bit));
                }
              }
              bytes.push(byteVal);
            }

            for (let p = 0; p < rightPadBytes; p++) bytes.push(0);
          }

          resolve(bytes);
        } catch (e) {
          console.warn("Falha ao rasterizar logo:", e);
          resolve([]);
        }
      };
      img.onerror = () => resolve([]);
      img.src = imageUrl;
    });
  };

  const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
  };

  // Converte um data URL (captura fiel da tela) em blocos raster ESC/POS de 576 pontos (80mm)
  const dataUrlToEscPosBlocks = (dataUrl: string, printWidth = 576): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const width = printWidth - (printWidth % 8);
          const height = Math.max(1, Math.round((img.height * width) / img.width));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas indisponível")); return; }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, width, height);

          const data = ctx.getImageData(0, 0, width, height).data;
          const bytesPerRow = width / 8;

          // Escala de cinza + dithering Floyd-Steinberg para preservar fielmente tons e cores da tela
          const gray = new Float32Array(width * height);
          for (let i = 0; i < width * height; i++) {
            const r = data[i * 4] ?? 255;
            const g = data[i * 4 + 1] ?? 255;
            const b = data[i * 4 + 2] ?? 255;
            const a = data[i * 4 + 3] ?? 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            gray[i] = a < 128 ? 255 : lum;
          }
          const mono = new Uint8Array(width * height);
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = y * width + x;
              const old = gray[i] ?? 255;
              const newVal = old < 150 ? 0 : 255;
              mono[i] = newVal === 0 ? 1 : 0;
              const err = old - newVal;
              const spread = (dx: number, dy: number, f: number) => {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= width || ny >= height) return;
                const ni = ny * width + nx;
                gray[ni] = (gray[ni] ?? 255) + err * f;
              };
              spread(1, 0, 7 / 16);
              spread(-1, 1, 3 / 16);
              spread(0, 1, 5 / 16);
              spread(1, 1, 1 / 16);
            }
          }

          const bytes: number[] = [];
          // Divide em blocos para não exceder o buffer da impressora térmica
          const BLOCK = 128;
          for (let yStart = 0; yStart < height; yStart += BLOCK) {
            const blockHeight = Math.min(BLOCK, height - yStart);
            bytes.push(
              0x1d, 0x76, 0x30, 0x00,
              bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
              blockHeight & 0xff, (blockHeight >> 8) & 0xff,
            );
            for (let y = yStart; y < yStart + blockHeight; y++) {
              for (let xByte = 0; xByte < bytesPerRow; xByte++) {
                let byteVal = 0;
                for (let bit = 0; bit < 8; bit++) {
                  if (mono[y * width + xByte * 8 + bit] === 1) byteVal |= 1 << (7 - bit);
                }
                bytes.push(byteVal);
              }
            }
          }
          resolve(bytes);
        } catch (e) {
          reject(e as Error);
        }
      };
      img.onerror = () => reject(new Error("Falha ao carregar a imagem do cupom"));
      img.src = dataUrl;
    });
  };

  // Gera o cupom exatamente como aparece na tela, em raster ESC/POS, com corte da guilhotina
  const generateEscPosFromScreen = async (): Promise<Uint8Array> => {
    if (!receiptRef.current) throw new Error("Cupom não disponível");
    const node = receiptRef.current;
    const dataUrl = await toPng(node, {
      backgroundColor: "#ffffff",
      pixelRatio: Math.min(3, Math.max(1.5, 576 / (node.offsetWidth || 380))),
      cacheBust: true,
    });
    const imageBytes = await dataUrlToEscPosBlocks(dataUrl, 576);
    const bytes: number[] = [];
    bytes.push(0x1b, 0x40); // init
    bytes.push(0x1b, 0x61, 0x00); // alinhamento à esquerda (imagem já ocupa 80mm)
    bytes.push(...imageBytes);
    bytes.push(0x0a, 0x0a, 0x0a, 0x0a); // avanço para a lâmina
    bytes.push(0x1d, 0x56, 0x00); // corte total (guilhotina) - único
    return new Uint8Array(bytes);
  };

  const generateEscPosBinary = async (): Promise<Uint8Array> => {
    const W = 48; // 80mm = 48 colunas padrão Font A
    const cleanStr = (str: string) => {
      return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .trim();
    };

    const center = (str: string) => {
      const s = cleanStr(str);
      if (s.length >= W) return s.slice(0, W);
      const pad = Math.floor((W - s.length) / 2);
      return " ".repeat(pad) + s;
    };

    const leftRight = (left: string, right: string) => {
      const l = cleanStr(left);
      const r = cleanStr(right);
      const maxL = Math.max(0, W - r.length - 1);
      const truncatedL = l.length > maxL ? l.slice(0, maxL) : l;
      const spaces = Math.max(1, W - truncatedL.length - r.length);
      return truncatedL + " ".repeat(spaces) + r;
    };

    const div = (char = "-") => char.repeat(W);

    const bytes: number[] = [];

    // 1. Inicializar impressora (ESC @) e selecionar tabela de caracteres
    bytes.push(0x1B, 0x40);

    // 2. Alinhamento central para o topo
    bytes.push(0x1B, 0x61, 0x01);

    // 3. Imprimir Logomarca em formato nativo ESC/POS Raster se cadastrada
    let hasLogo = false;
    if (storeLogo) {
      try {
        const logoBytes = await imageToEscPosRaster(storeLogo, 384, 576);
        if (logoBytes.length > 0) {
          bytes.push(...logoBytes);
          bytes.push(0x0A, 0x0A);
          hasLogo = true;
        }
      } catch (e) {
        console.warn("Logo não pôde ser gerada para ESC/POS:", e);
      }
    }

    const appendText = (t: string) => {
      const c = cleanStr(t);
      for (let i = 0; i < c.length; i++) {
        bytes.push(c.charCodeAt(i));
      }
      bytes.push(0x0A);
    };

    // 4. Se não tiver logo, imprime nome em Negrito e Tamanho Duplo
    if (!hasLogo) {
      bytes.push(0x1D, 0x21, 0x11, 0x1B, 0x45, 0x01);
      appendText("AMSTORE BAGSHOES");
      bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00);
    }

    appendText(storeAddress);
    appendText(storeCity);
    appendText(`Telefone: ${storePhone}`);

    // Alinhamento à esquerda
    bytes.push(0x1B, 0x61, 0x00);
    appendText(div("="));

    // Título Centralizado
    bytes.push(0x1B, 0x61, 0x01, 0x1B, 0x45, 0x01);
    appendText(isCancelled ? "*** CANCELADA ***" : "CUPOM FISCAL");
    bytes.push(0x1B, 0x61, 0x00, 0x1B, 0x45, 0x00);
    appendText(div("="));

    // Dados da Venda
    const saleCode = displaySale?.sale_code || displaySale?.id?.toString().slice(0, 8);
    appendText(leftRight("Pedido:", `#${saleCode}`));
    const saleDate = new Date(displaySale?.created_at || new Date()).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    appendText(leftRight("Data:", saleDate));
    appendText(leftRight("Cliente:", (displayClient?.name || "CONSUMIDOR").toUpperCase()));
    if (displayClient?.cpf) {
      appendText(leftRight("CPF:", displayClient.cpf));
    }
    appendText(leftRight("Vendedor:", displaySale?.seller_name || "amstorebagshoes"));
    appendText(div("-"));

    // Itens
    bytes.push(0x1B, 0x61, 0x01, 0x1B, 0x45, 0x01);
    appendText("ITENS");
    bytes.push(0x1B, 0x61, 0x00, 0x1B, 0x45, 0x00);
    appendText(div("-"));

    items.forEach((item: any) => {
      const q = Number(item.quantity || 1);
      const name = (item.name || item.product_name || "PRODUTO").toUpperCase();
      const num = item.numeracao ? ` (N. ${item.numeracao})` : '';
      const itemTitle = `${q}x ${name}${num}`;
      const itemTotal = brl(q * (item.unit_price || 0) - (item.discount || 0));
      appendText(leftRight(itemTitle, itemTotal));

      const unitPriceStr = `(${brl(item.unit_price || 0)})`;
      if (item.discount > 0) {
        appendText(leftRight(` ${unitPriceStr} Desc:`, `- ${brl(item.discount)}`));
      }
    });
    appendText(div("-"));

    // Totais
    bytes.push(0x1B, 0x45, 0x01);
    appendText(leftRight("VALOR TOTAL:", brl(valorTotalSemDesconto || 0)));
    if (totalDescontos > 0) {
      appendText(leftRight("Desconto:", `- ${brl(totalDescontos)}`));
    }
    if (cashbackUsed > 0) {
      appendText(leftRight("Cashback Usado:", `- ${brl(cashbackUsed)}`));
    }

    // Total Líquido em Dupla Altura
    bytes.push(0x1D, 0x21, 0x01);
    appendText(leftRight("TOTAL LIQUIDO:", brl(totalLiquido || 0)));
    bytes.push(0x1D, 0x21, 0x00);

    const totalQtd = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
    appendText(leftRight("Qtd Itens:", `${totalQtd}`));
    bytes.push(0x1B, 0x45, 0x00);
    appendText(div("-"));

    // Pagamento
    bytes.push(0x1B, 0x61, 0x01, 0x1B, 0x45, 0x01);
    appendText("PAGAMENTO");
    bytes.push(0x1B, 0x61, 0x00, 0x1B, 0x45, 0x00);
    appendText(div("-"));

    const isDebt = displaySale?.payment_method === 'Fiado' || displaySale?.is_debt;
    if (isDebt) {
      bytes.push(0x1B, 0x61, 0x01, 0x1B, 0x45, 0x01);
      appendText("VENDA A PRAZO (FIADO)");
      bytes.push(0x1B, 0x61, 0x00, 0x1B, 0x45, 0x00);

      const paid = Number(displaySale.paid_amount || 0);
      const remaining = Math.max(0, (displaySale.total_amount || 0) - paid);
      appendText(leftRight("Total Venda:", brl(totalLiquido)));
      appendText(leftRight("Total Ja Pago:", brl(paid)));
      appendText(leftRight("Saldo Devedor:", brl(remaining)));
      appendText(leftRight("Status:", displaySale.status === 'paid' || displaySale.status === 'pago' ? 'QUITADO' : (paid > 0 ? 'PARCIAL' : 'PENDENTE')));

      if (payments && payments.length > 0) {
        appendText(div("."));
        bytes.push(0x1B, 0x61, 0x01);
        appendText("HISTORICO DE PAGAMENTOS");
        bytes.push(0x1B, 0x61, 0x00);
        payments.forEach((pay: any) => {
          const payDate = new Date(pay.created_at).toLocaleDateString('pt-BR');
          appendText(leftRight(`${payDate} (${pay.payment_method || 'Pgto'}):`, brl(pay.amount)));
        });
      }

      const parcels = (installments && installments.length > 0) 
        ? installments 
        : (displaySale.installments || displaySale.parcelas || []);
      if (parcels.length > 0) {
        appendText(div("."));
        bytes.push(0x1B, 0x61, 0x01);
        appendText("PLANO DE PARCELAMENTO");
        bytes.push(0x1B, 0x61, 0x00);
        parcels.forEach((inst: any, idx: number) => {
          const num = inst.installment_number || inst.number || (idx + 1);
          const dDate = inst.due_date ? new Date(inst.due_date).toLocaleDateString('pt-BR') : '';
          const isPaid = inst.status === 'paid' || inst.status === 'pago';
          appendText(leftRight(`${num}a Parc ${dDate}:`, `${brl(inst.amount)}${isPaid ? ' (PAGO)' : ''}`));
        });
      }
    } else {
      appendText(leftRight("Forma:", (displaySale?.payment_method || "DINHEIRO").toUpperCase()));
      appendText(leftRight("Total Pago:", brl(displaySale?.total_amount || 0)));
    }

    // Cashback
    if (displaySale?.cashback_earned > 0) {
      appendText(div("-"));
      bytes.push(0x1B, 0x61, 0x01);
      appendText("CASHBACK DESTA VENDA:");
      bytes.push(0x1D, 0x21, 0x01, 0x1B, 0x45, 0x01);
      appendText(brl(displaySale.cashback_earned));
      bytes.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00);
      appendText(isDebt ? "* Liberado com pgto das parcelas" : "Saldo liberado e disponivel!");
      bytes.push(0x1B, 0x61, 0x00);
    }

    // Promoção
    if (!isPreview && !isCancelled && promoConfig && promoConfig.active && displaySale.promo_qr) {
      appendText(div("-"));
      bytes.push(0x1B, 0x61, 0x01);
      appendText(promoConfig.name || "PROMOCAO AMSTORE");
      appendText(`Cod Promo: ${displaySale.promo_qr}`);
      bytes.push(0x1B, 0x61, 0x00);
    }

    // Rodapé
    appendText(div("="));
    bytes.push(0x1B, 0x61, 0x01);
    appendText(storeWebsite || "www.amstorebagshoes.com.br");
    if (storeInstagram) appendText(storeInstagram);
    appendText("Obrigado! Volte sempre!");
    appendText(new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    appendText(div("="));

    // 5. AVANÇO DE PAPEL E DISPARO DE CORTE ÚNICO (GUILHOTINA)
    // Avançar linhas suficientes para o rodapé passar da lâmina de corte
    bytes.push(0x0A, 0x0A, 0x0A, 0x0A);
    // GS V 0 (Comando universal ESC/POS de corte total da guilhotina - APENAS UM CORTE)
    bytes.push(0x1D, 0x56, 0x00);

    return new Uint8Array(bytes);
  };

  // Disparo direto de ESC/POS em Bytes Base64 (Hardware nativo 80mm com Logomarca e Guilhotina)
  const handleDirectThermalPrint80mm = async () => {
    setPrintingThermal(true);
    try {
      toast.info("Gerando impressão fiel ao cupom da tela (80mm + guilhotina)...");
      let binaryBytes: Uint8Array;
      try {
        binaryBytes = await generateEscPosFromScreen();
      } catch (imgErr) {
        console.warn("Falha na captura fiel do cupom, usando modo texto:", imgErr);
        binaryBytes = await generateEscPosBinary();
      }
      const base64Data = uint8ArrayToBase64(binaryBytes);

      // Intent oficial do RawBT para envio de bytes puros ESC/POS
      const intentUrl = `intent:base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dru.a402d.rawbtprinter;end;`;

      const isAndroid = /android/i.test(navigator.userAgent);
      if (!isAndroid) {
        toast.info("Enviando comandos ESC/POS. No computador, utilize também o botão 'Imprimir (Navegador)'.", { duration: 5000 });
      } else {
        toast.success("Cupom 80mm enviado com corte automático para a impressora!");
      }

      window.location.href = intentUrl;
    } catch (err) {
      console.error("Erro ao gerar ESC/POS 80mm:", err);
      toast.error("Erro ao preparar comandos de impressão");
    } finally {
      setPrintingThermal(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden bg-background sm:rounded-[2rem] border-none shadow-2xl flex flex-col h-[95vh] sm:max-h-[90vh] [&>button]:hidden">
        
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">{isPreview ? "Prévia do Cupom" : "Cupom de Venda"}</h3>
            <span className="text-[10px] text-muted-foreground uppercase font-medium font-mono tracking-tighter">Padrão Fiscal 80mm</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0">
          <div className="flex flex-col gap-3 print:hidden mb-6">
            <Button 
              className="w-full bg-[#6B46C1] hover:bg-[#553C9A] text-white font-bold h-14 rounded-xl shadow-lg gap-2 text-sm sm:text-base"
              onClick={handleDirectThermalPrint80mm}
              disabled={printingThermal}
            >
              {printingThermal ? <Loader2 className="size-5 animate-spin" /> : <Printer className="size-5" />}
              Imprimir Cupom 80mm (ESC/POS Direto + Guilhotina)
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleShareWhatsApp} variant="outline" className="gap-2 font-bold h-11 rounded-xl shadow-sm text-xs">
                <Share2 className="size-4 text-[#25D366]" /> WhatsApp
              </Button>
              <Button variant="outline" className="gap-2 font-bold h-11 rounded-xl shadow-sm text-xs" onClick={handlePrint}>
                <Printer className="size-4" /> Imprimir (Navegador)
              </Button>
            </div>
          </div>

          <div className="print-only w-full">
            <div 
              ref={receiptRef}
              className="cupom-container bg-white text-black p-4 sm:p-6 border-2 border-black font-mono text-xs sm:text-[13px] leading-snug mx-auto w-full max-w-[380px] shadow-md"
              style={{ fontFamily: "'Courier New', Consolas, monospace" }}
            >
            {/* --- CABEÇALHO DA LOJA --- */}
            <div className="text-center space-y-2 mb-4">
              {storeLogo ? (
                <div className="flex justify-center items-center py-2">
                  <img 
                    src={storeLogo} 
                    alt="Logomarca da loja" 
                    className="max-h-24 max-w-[240px] object-contain" 
                  />
                </div>
              ) : (
                <h2 className="font-black text-xl uppercase tracking-[0.2em] py-2">
                  AMSTORE BAGSHOES
                </h2>
              )}
              <div className="text-xs space-y-0.5 font-bold">
                <p>{storeAddress}</p>
                <p>{storeCity}</p>
                <p>Telefone: {storePhone}</p>
              </div>
              
              <div className="border-t-2 border-black my-2" />
              <h3 className="font-black text-sm uppercase tracking-wider">CUPOM FISCAL</h3>
              <div className="border-t-2 border-black my-2" />
              
              {isCancelled && <p className="text-destructive font-black text-xl border-4 border-destructive py-1 my-2 rotate-[-5deg]">CANCELADA</p>}
            </div>

            {/* --- DADOS DA VENDA --- */}
            <div className="space-y-1.5 mb-4 text-xs font-bold">
              <div className="flex justify-between">
                <span className="w-20">Pedido:</span>
                <span className="flex-1 text-right">#{displaySale?.sale_code || displaySale?.id?.toString().slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="w-20">Data:</span>
                <span className="flex-1 text-right">
                  {new Date(displaySale?.created_at || new Date()).toLocaleDateString('pt-BR')} {new Date(displaySale?.created_at || new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
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

            <div className="border-t-2 border-black my-2" />
            <div className="text-center font-black text-sm mb-2">ITENS</div>
            <div className="border-t-2 border-black my-2" />
            
            <div className="space-y-3 mb-4">
              {items.map((item: any, i: number) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between font-black text-xs">
                    <span className="flex-1 truncate pr-2">
                      {item.quantity || 0} x {(item.name || item.product_name || "PRODUTO").toUpperCase()} 
                      {item.numeracao ? ` (Nº ${item.numeracao})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span>({brl(item.unit_price || 0)})</span>
                    <span className="font-black">{brl((item.quantity || 0) * (item.unit_price || 0) - (item.discount || 0))}</span>
                  </div>
                  {item.discount > 0 && (
                    <div className="flex justify-between text-xs font-bold">
                      <span>Desconto Item:</span>
                      <span>- {brl(item.discount)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t-2 border-black my-2" />
            
            <div className="space-y-1.5 mb-4 text-xs font-bold">
              <div className="flex justify-between font-black">
                <span>VALOR TOTAL:</span>
                <span>{brl(valorTotalSemDesconto || 0)}</span>
              </div>
              {totalDescontos > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Desconto:</span>
                  <span>- {brl(totalDescontos)}</span>
                </div>
              )}
              {cashbackUsed > 0 && (
                <div className="flex justify-between font-bold">
                  <span>(Cashback Utilizado:</span>
                  <span>- {brl(cashbackUsed)})</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base pt-1 border-t-2 border-black">
                <span>TOTAL LÍQUIDO:</span>
                <span>{brl(totalLiquido || 0)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span>Qtd Total:</span>
                <span>{items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} itens</span>
              </div>
            </div>

            <div className="border-t-2 border-black my-2" />
            <div className="text-center font-black text-sm mb-2">PAGAMENTO</div>
            <div className="border-t-2 border-black my-2" />

            <div className="space-y-1 mb-4 text-xs font-bold">
              {displaySale?.payment_method === 'Fiado' || displaySale?.is_debt ? (
                <>
                  <div className="flex justify-between font-black border-2 border-black p-1 text-center my-1">
                    <span className="w-full">VENDA A PRAZO (FIADO)</span>
                  </div>
                  
                  {/* --- HISTÓRICO DE PAGAMENTOS / FIADO --- */}
                  {(payments.length > 0 || (displaySale.paid_amount > 0 && payments.length === 0)) && (
                    <div className="mt-2 space-y-1 border-t-2 border-dashed border-black pt-2">
                      <p className="font-black text-xs text-center mb-1">HISTÓRICO DE PAGAMENTOS / FIADO</p>
                      
                      <div className="flex justify-between text-xs font-bold">
                        <span>Total da Venda:</span>
                        <span>{brl(totalLiquido)}</span>
                      </div>

                      <div className="space-y-0.5 my-1">
                        {payments.map((pay: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span>{new Date(pay.created_at).toLocaleDateString('pt-BR')} ({pay.payment_method}):</span>
                            <span className="font-bold">{brl(pay.amount)}</span>
                          </div>
                        ))}
                        {payments.length === 0 && displaySale.paid_amount > 0 && (
                          <div className="flex justify-between text-xs">
                            <span>Pagamento Inicial:</span>
                            <span className="font-bold">{brl(displaySale.paid_amount)}</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t-2 border-dotted border-black my-1" />
                      
                      <div className="flex justify-between text-xs font-black">
                        <span>Total Já Pago:</span>
                        <span>{brl(displaySale.paid_amount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black">
                        <span>Saldo Devedor:</span>
                        <span>{brl(Math.max(0, (displaySale.total_amount || 0) - (displaySale.paid_amount || 0)))}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-xs font-black mt-2">
                    <span>Status:</span>
                    <span>
                      {displaySale.status === 'paid' || displaySale.status === 'pago' 
                        ? 'QUITADO' 
                        : (displaySale.paid_amount > 0 ? 'PARCIALMENTE PAGO' : 'PENDENTE')}
                    </span>
                  </div>

                  {(installments.length > 0 || displaySale.installments?.length > 0 || displaySale.parcelas?.length > 0) && (
                    <div className="mt-2 space-y-1 border-t-2 border-dashed border-black pt-1 text-xs">
                      <p className="font-black">PLANO DE PARCELAMENTO:</p>
                      {(installments.length > 0 ? installments : (displaySale.installments || displaySale.parcelas)).map((inst: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{inst.installment_number || inst.number || (idx + 1)}ª Parcela ({new Date(inst.due_date).toLocaleDateString('pt-BR')}):</span>
                          <span className="font-bold">
                            {brl(inst.amount)} 
                            {inst.status === 'paid' || inst.status === 'pago' ? ' (PAGO)' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs font-bold">
                    <span>Data:</span>
                    <span>{new Date(displaySale?.created_at || new Date()).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between font-black text-xs">
                    <span>{displaySale?.payment_method?.toUpperCase() || "DINHEIRO"} :</span>
                    <span>{brl(displaySale?.total_amount || 0)}</span>
                  </div>
                  
                  <div className="border-t-2 border-black my-1" />
                  <div className="flex justify-between font-black text-sm">
                    <span>Total Pago:</span>
                    <span>{brl(displaySale?.total_amount || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t-2 border-black my-2" />

            {/* --- CASHBACK DISPONÍVEL --- */}
            {displaySale?.cashback_earned > 0 && (
              <div className="text-center py-2 space-y-2">
                <div className="bg-[#FFF9C4] border border-[#FBC02D] p-3 rounded-md text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-xs text-orange-800 uppercase">
                    <Gift className="size-3.5 text-orange-600" /> CASHBACK DESTA VENDA
                  </div>
                  <div className="text-base font-black my-1 text-black">{brl(displaySale.cashback_earned)}</div>
                  {displaySale?.payment_method === 'Fiado' || displaySale?.is_debt ? (
                    <p className="text-xs font-bold text-orange-800 italic">
                      * O cashback será liberado proporcionalmente aos pagamentos das parcelas.
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-orange-900">Saldo liberado e disponível!</p>
                  )}
                </div>
              </div>
            )}

            {/* --- QR CODE PROMOCIONAL (CAIXA PONTILHADA) --- */}
            {!isPreview && !isCancelled && promoConfig && promoConfig.active && (
              <div className="border-2 border-dashed border-[#D53F8C] bg-[#FDF2F8] p-3 rounded-xl text-center space-y-2">
                <div className="flex items-center justify-center gap-1 font-black text-xs uppercase text-[#D53F8C]">
                  <Gift className="size-4 text-[#D53F8C]" /> {promoConfig.name || "PROMOÇÃO AMSTORE"}
                </div>
                <div className="flex justify-center my-2">
                  {!qrLoaded ? (
                    <Loader2 className="size-8 animate-spin text-[#D53F8C]" />
                  ) : (
                    <div ref={qrcodeRef} className="bg-white p-2 rounded-lg shadow-sm border border-pink-200 inline-block" />
                  )}
                </div>
                <p className="text-xs font-black text-black">Escaneie e veja sua surpresa!</p>
                <p className="text-xs font-mono font-bold text-gray-700">código: {displaySale.promo_qr || "QR-PROM-ERROR"}</p>
              </div>
            )}

            {/* --- RODAPÉ FINAL --- */}
            <div className="mt-4 pt-2 border-t-2 border-black text-center">
              <p className="text-[10px] font-bold">{storeWebsite || "www.amstorebagshoes.com.br"}</p>
              {storeInstagram && <p className="text-[10px] font-bold mt-0.5">{storeInstagram}</p>}
              
              <div className="mt-5 text-[10px]">
                <p className="font-semibold">Obrigado! Volte sempre!</p>
                <p className="mt-1 font-bold">{new Date(displaySale?.created_at || new Date()).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* 1. Oculta TODOS os elementos da tela exceto a área de impressão */
            body * {
              visibility: hidden !important;
            }

            /* 2. Exibe apenas o container do cupom e seus elementos */
            .print-only,
            .print-only * {
              visibility: visible !important;
            }

            /* 3. Posiciona no topo esquerdo da página/rolo térmico */
            .print-only {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              display: flex !important;
              justify-content: center !important;
              background: transparent !important;
            }

            /* 4. Fidelidade total da largura 80mm com bordas 2px pretas, cores e tipografia idênticas à tela */
            .cupom-container {
              width: 78mm !important;
              max-width: 78mm !important;
              min-width: 78mm !important;
              box-sizing: border-box !important;
              margin: 0 auto !important;
              padding: 3.5mm 4mm !important;
              font-family: 'Courier New', Consolas, monospace !important;
              font-size: 11px !important;
              color: #000000 !important;
              line-height: 1.35 !important;
              border: 2px solid #000000 !important;
              background-color: #ffffff !important;
              box-shadow: none !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            /* 5. Força a impressão exata de todas as cores de fundo, bordas coloridas e textos */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            /* 6. Remove margens automáticas da impressora para corte perfeito no rolo de 80mm */
            @page {
              size: 80mm auto;
              margin: 0mm !important;
            }
          }
        `}} />
      </DialogContent>
    </Dialog>
  );
}
