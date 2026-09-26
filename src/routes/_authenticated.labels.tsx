import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Tags,
  Plus,
  Trash2,
  Printer,
  Grid3X3,
  Search,
  X,
  Barcode,
  QrCode,
  Settings,
  FileDown,
  Layers,
  Ruler,
  AlertTriangle,
  Eye,
  Info,
  Hash,
  Minus,
  RotateCcw,
  Sparkles,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { brl } from "@/lib/format";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRows } from "@/lib/data";
import {
  generateLabelGrid,
  clearLabels,
} from "@/lib/labels.functions";
import { useLabelSettings } from "@/hooks/use-label-settings";
import { LabelSettingsPanel } from "@/components/labels/LabelSettingsPanel";
import {
  A4SheetPreview,
  ThermalStripPreview,
} from "@/components/labels/LabelPreview";
import {
  computeCompleteLabelLayout,
  generateHighResBarcode,
} from "@/lib/label-layout-engine";

export const Route = createFileRoute("/_authenticated/labels")({
  component: LabelsPage,
});

function LabelsPage() {
  const qc = useQueryClient();
  const { data: labels = [] } = useRows<any>("etiqueta_gerada", {
    order: { column: "id", ascending: true },
  });
  const { data: products = [] } = useRows<any>("products", {
    order: { column: "name", ascending: true },
  });
  const { data: stockProducts = [] } = useRows<any>("stock_products");

  const productMap = useMemo(() => new Map<string, any>(products.map((p: any) => [p.id, p])), [products]);

  const stockByProductId = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of stockProducts) {
      if (s.produto_id) {
        map.set(s.produto_id, s);
      }
      if (s.produto_nome) {
        map.set(`name:${s.produto_nome.trim().toLowerCase()}`, s);
      }
    }
    return map;
  }, [stockProducts]);

  const enrichedLabels = useMemo(() => {
    return labels.map((l: any) => {
      const prod = l.produto_id ? productMap.get(l.produto_id) : null;
      return {
        ...l,
        preco: l.preco ?? prod?.sale_price ?? null,
      };
    });
  }, [labels, productMap]);

  const {
    settings,
    setActiveProfile,
    updateA4,
    updateThermal,
    updateA4Content,
    updateThermalContent,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
    resetToDefaults,
    labelsPerSheet,
    validation,
  } = useLabelSettings();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);
  const [cleaningAndAdding, setCleaningAndAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testSheetMode, setTestSheetMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [type, setType] = useState<"CODE128" | "QR">("CODE128");
  const [exporting, setExporting] = useState(false);

  // Helper para identificar numerações do produto no estoque detalhado (stock_products)
  const getProductStockData = useCallback(
    (prod: any) => {
      if (!prod) {
        return { hasSizes: false, numeracoes: {} as Record<string, number>, stockQty: 0, stockRecord: null };
      }
      const stock =
        stockByProductId.get(prod.id) ||
        stockByProductId.get(`name:${prod.name?.trim().toLowerCase()}`) ||
        null;

      let nums: Record<string, any> = {};
      if (stock?.numeracoes) {
        if (typeof stock.numeracoes === "object") {
          nums = { ...stock.numeracoes };
        } else if (typeof stock.numeracoes === "string") {
          try {
            nums = JSON.parse(stock.numeracoes);
          } catch {}
        }
      }

      const isSandalia = prod.category === "Sandálias";
      const hasRegisteredSizes = Object.keys(nums).length > 0;

      // Grade padrão caso o produto seja calçado mas ainda não tenha tamanhos cadastrados
      if (isSandalia && !hasRegisteredSizes) {
        nums = { "33": 0, "34": 0, "35": 0, "36": 0, "37": 0, "38": 0, "39": 0, "40": 0 };
      }

      const hasSizes = isSandalia || hasRegisteredSizes;
      const stockQty = Number(prod.current_stock ?? stock?.quantidade_disponivel ?? 0);

      return { hasSizes, numeracoes: nums as Record<string, number>, stockQty, stockRecord: stock };
    },
    [stockByProductId]
  );

  const handleSelectProduct = (prod: any) => {
    setSelectedProduct(prod);
    const { hasSizes, numeracoes: nums, stockQty } = getProductStockData(prod);

    if (hasSizes) {
      // Pré-preenche sugestivamente com a quantidade disponível em estoque de cada numeração
      const initial: Record<string, number> = {};
      Object.entries(nums).forEach(([size, qty]) => {
        const n = Number(qty) || 0;
        initial[size] = n > 0 ? n : 0;
      });
      setQuantities(initial);
    } else {
      // Para produtos sem numeração (bolsas, carteiras), pré-preenche com o estoque disponível ou 1
      setQuantities({ total: stockQty > 0 ? stockQty : 1 });
    }
  };

  const handleFillStockQuantities = () => {
    if (!selectedProduct) return;
    const { numeracoes: nums } = getProductStockData(selectedProduct);
    const updated: Record<string, number> = {};
    Object.entries(nums).forEach(([size, qty]) => {
      const n = Number(qty) || 0;
      updated[size] = n > 0 ? n : 0;
    });
    setQuantities(updated);
  };

  const handleSetOneOfEach = () => {
    if (!selectedProduct) return;
    const { numeracoes: nums } = getProductStockData(selectedProduct);
    const updated: Record<string, number> = {};
    Object.keys(nums).forEach((size) => {
      updated[size] = 1;
    });
    setQuantities(updated);
  };

  const handleZeroAll = () => {
    if (!selectedProduct) return;
    const { numeracoes: nums } = getProductStockData(selectedProduct);
    const updated: Record<string, number> = {};
    Object.keys(nums).forEach((size) => {
      updated[size] = 0;
    });
    setQuantities(updated);
  };

  const totalLabelsToGenerate = useMemo(() => {
    if (!selectedProduct) return 0;
    const { hasSizes } = getProductStockData(selectedProduct);
    if (hasSizes) {
      return Object.entries(quantities)
        .filter(([k]) => k !== "total")
        .reduce((acc, [_, qty]) => acc + (Math.max(0, Number(qty)) || 0), 0);
    }
    return Math.max(0, Number(quantities["total"]) || 0);
  }, [selectedProduct, quantities, getProductStockData]);

  const handleOpenAddModal = () => {
    if (labels.length > 0) {
      setConfirmCleanOpen(true);
    } else {
      setAddModalOpen(true);
    }
  };

  const handleCleanAndAdd = async () => {
    setCleaningAndAdding(true);
    try {
      await clearLabels();
      qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] });
      toast.success("Grade anterior limpa");
      setConfirmCleanOpen(false);
      setAddModalOpen(true);
    } catch (err: any) {
      toast.error("Erro ao limpar etiquetas: " + (err.message || err));
    } finally {
      setCleaningAndAdding(false);
    }
  };

  const handleKeepAndAdd = () => {
    setConfirmCleanOpen(false);
    setAddModalOpen(true);
  };

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Measure preview container for accurate scaling
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleGenerate = async () => {
    if (!selectedProduct) return;

    const { hasSizes } = getProductStockData(selectedProduct);
    const baseSku = (selectedProduct.sku || `PROD-${selectedProduct.id.slice(0, 8)}`).trim();

    let prodItems: any[];
    if (hasSizes) {
      prodItems = Object.entries(quantities)
        .filter(([k, qty]) => k !== "total" && Number(qty) > 0)
        .map(([size, qty]) => {
          // CÓDIGO DE BARRAS ÚNICO POR TAMANHO: {sku}-{numeracao} (ex: "PROD1234-36")
          const sizeSku = baseSku.endsWith(`-${size}`) ? baseSku : `${baseSku}-${size}`;
          return {
            id: selectedProduct.id,
            name: selectedProduct.name,
            sku: sizeSku,
            numeracao: size,
            quantity: Number(qty),
            tipo_codigo: type,
          };
        });
    } else {
      const totalQty = Number(quantities["total"]) || 0;
      if (totalQty <= 0) {
        toast.error("Informe a quantidade de etiquetas");
        return;
      }
      prodItems = [
        {
          id: selectedProduct.id,
          name: selectedProduct.name,
          sku: baseSku,
          numeracao: undefined,
          quantity: totalQty,
          tipo_codigo: type,
        },
      ];
    }

    if (prodItems.length === 0) {
      toast.error("Informe a quantidade para pelo menos uma numeração");
      return;
    }

    try {
      await generateLabelGrid({ data: { products: prodItems } });
      qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] });
      setAddModalOpen(false);
      setQuantities({});
      toast.success("Etiquetas adicionadas");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── PDF Export (Powered by Unified Layout Engine) ─────────────────────
  const handleExportPDF = async () => {
    if (labels.length === 0) {
      toast.error("Nenhuma etiqueta para exportar");
      return;
    }

    setExporting(true);
    const loadingToast = toast.loading("Gerando PDF em alta definição (600 DPI)...");

    try {
      const isA4 = settings.activeProfile === "a4";
      const layout = computeCompleteLabelLayout({
        profileType: settings.activeProfile,
        a4: settings.a4,
        thermal: settings.thermal,
        labels: enrichedLabels,
        isTestSheet: false,
      });

      const pdf = new jsPDF(
        "p",
        "mm",
        [layout.pageWidthMm, layout.pageHeightMm]
      );

      for (let pageIdx = 0; pageIdx < layout.pages.length; pageIdx++) {
        if (pageIdx > 0) {
          pdf.addPage(
            [layout.pageWidthMm, layout.pageHeightMm],
            "p"
          );
        }

        const page = layout.pages[pageIdx];
        if (!page) continue;

        for (const labelLayout of page.labels) {
          if (!labelLayout.label || labelLayout.label.id?.startsWith("empty-")) {
            continue;
          }

          const originX = labelLayout.xMm;
          const originY = labelLayout.yMm;

          // Header
          if (labelLayout.header?.show && labelLayout.header.text) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(labelLayout.header.fontSizePt);
            const tx = originX + labelLayout.header.xMm;
            const ty = originY + labelLayout.header.yMm + labelLayout.header.fontSizeMm * 0.85;
            pdf.text(labelLayout.header.text, tx, ty, {
              align: labelLayout.header.align,
            });
          }

          // Product Name
          if (labelLayout.productName?.show && labelLayout.productName.text) {
            pdf.setFont("helvetica", labelLayout.productName.isBold ? "bold" : "normal");
            pdf.setFontSize(labelLayout.productName.fontSizePt);
            const tx = originX + labelLayout.productName.xMm;
            const ty = originY + labelLayout.productName.yMm + labelLayout.productName.fontSizeMm * 0.85;
            pdf.text(labelLayout.productName.text, tx, ty, {
              align: labelLayout.productName.align,
            });
          }

          // Reference
          if (labelLayout.reference?.show && labelLayout.reference.text) {
            pdf.setFont("courier", labelLayout.reference.isBold ? "bold" : "normal");
            pdf.setFontSize(labelLayout.reference.fontSizePt);
            const tx = originX + labelLayout.reference.xMm;
            const ty = originY + labelLayout.reference.yMm + labelLayout.reference.fontSizeMm * 0.85;
            pdf.text(labelLayout.reference.text, tx, ty, {
              align: labelLayout.reference.align,
            });
          }

          // Barcode / QR (High resolution 600 DPI)
          if (labelLayout.barcode?.show && labelLayout.barcode.barcodeValue) {
            const b = labelLayout.barcode;
            const barcodePng = generateHighResBarcode(
              b.barcodeValue,
              b.showValueText,
              b.widthMm,
              b.heightMm,
              600
            );
            if (barcodePng) {
              pdf.addImage(
                barcodePng,
                "PNG",
                originX + b.xMm,
                originY + b.yMm,
                b.widthMm,
                b.heightMm,
                undefined,
                "FAST"
              );
            }
          }

          // Price & Size
          if (labelLayout.priceAndSize?.show && labelLayout.priceAndSize.text) {
            pdf.setFont("helvetica", labelLayout.priceAndSize.isBold ? "bold" : "normal");
            pdf.setFontSize(labelLayout.priceAndSize.fontSizePt);
            const tx = originX + labelLayout.priceAndSize.xMm;
            const ty = originY + labelLayout.priceAndSize.yMm + labelLayout.priceAndSize.fontSizeMm * 0.85;
            pdf.text(labelLayout.priceAndSize.text, tx, ty, {
              align: labelLayout.priceAndSize.align,
            });
          }

          // Extra Info
          if (labelLayout.extraInfo?.show && labelLayout.extraInfo.text) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(labelLayout.extraInfo.fontSizePt);
            const tx = originX + labelLayout.extraInfo.xMm;
            const ty = originY + labelLayout.extraInfo.yMm + labelLayout.extraInfo.fontSizeMm * 0.85;
            pdf.text(labelLayout.extraInfo.text, tx, ty, {
              align: labelLayout.extraInfo.align,
            });
          }
        }
      }

      pdf.save(`etiquetas-${settings.activeProfile}-${Date.now()}.pdf`);
      toast.success("PDF gerado com sucesso em 600 DPI!");
    } catch (e) {
      console.error("Erro ao gerar PDF", e);
      toast.error("Erro ao gerar PDF");
    } finally {
      toast.dismiss(loadingToast);
      setExporting(false);
    }
  };

  // ─── Test Sheet PDF Generation ──────────────────────────────────────
  const handleExportTestPDF = () => {
    const isA4 = settings.activeProfile === "a4";
    const layout = computeCompleteLabelLayout({
      profileType: settings.activeProfile,
      a4: settings.a4,
      thermal: settings.thermal,
      labels,
      isTestSheet: true,
    });

    const pdf = new jsPDF(
      "p",
      "mm",
      [layout.pageWidthMm, layout.pageHeightMm]
    );

    if (isA4) {
      const a4 = settings.a4;
      const paperLabel =
        a4.paperType === "letter"
          ? "Carta / Letter"
          : a4.paperType === "a4"
          ? "A4"
          : "Personalizado";

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(
        `FOLHA DE TESTE E CALIBRAÇÃO — ${a4.presetName} (${paperLabel} ${a4.paperWidth}×${a4.paperHeight}mm)`,
        10,
        7
      );
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(
        `Offset X: ${a4.offsetX}mm | Offset Y: ${a4.offsetY}mm | Grade: ${a4.columns} col × ${a4.rows} lin (${a4.labelWidth} × ${a4.labelHeight} mm)`,
        10,
        10.5
      );

      // Top Ruler (0 to a4.paperWidth mm)
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.line(0, 12, a4.paperWidth, 12);
      for (let mm = 0; mm <= a4.paperWidth; mm += 10) {
        const tickH = mm % 50 === 0 ? 3 : mm % 20 === 0 ? 2 : 1;
        pdf.line(mm, 12 - tickH, mm, 12);
        if (mm % 20 === 0) {
          pdf.setFontSize(5);
          pdf.text(String(mm), mm, 12 - tickH - 0.5, { align: "center" });
        }
      }

      // Left Ruler (0 to a4.paperHeight mm)
      pdf.line(5, 0, 5, a4.paperHeight);
      for (let mm = 0; mm <= a4.paperHeight; mm += 10) {
        const tickW = mm % 50 === 0 ? 3 : mm % 20 === 0 ? 2 : 1;
        pdf.line(5 - tickW, mm, 5, mm);
        if (mm % 20 === 0) {
          pdf.setFontSize(5);
          pdf.text(String(mm), 5 - tickW - 0.5, mm + 1, { align: "right" });
        }
      }
    } else {
      // Thermal top ruler
      const w = layout.pageWidthMm;
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.line(0, 4, w, 4);
      for (let mm = 0; mm <= w; mm += 10) {
        pdf.line(mm, 2, mm, 4);
        if (mm % 20 === 0) {
          pdf.setFontSize(5);
          pdf.text(String(mm), mm, 1.5, { align: "center" });
        }
      }
    }

    // Draw test cells for page 0
    const page = layout.pages[0];
    if (page) {
      for (const lbl of page.labels) {
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.25);
        pdf.rect(lbl.xMm, lbl.yMm, lbl.widthMm, lbl.heightMm);

        // Center crosshair (+)
        const cx = lbl.xMm + lbl.widthMm / 2;
        const cy = lbl.yMm + lbl.heightMm / 2;
        pdf.setDrawColor(180);
        pdf.setLineDashPattern([1, 1], 0);
        pdf.line(lbl.xMm, cy, lbl.xMm + lbl.widthMm, cy);
        pdf.line(cx, lbl.yMm, cx, lbl.yMm + lbl.heightMm);
        pdf.setLineDashPattern([], 0);

        // Center label info
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text(`#${lbl.index + 1}`, cx, cy - 1.5, { align: "center" });
        pdf.setFont("courier", "normal");
        pdf.setFontSize(6);
        pdf.text(`L${lbl.row + 1} C${lbl.col + 1}`, cx, cy + 1.5, { align: "center" });
        pdf.setFontSize(5);
        pdf.text(
          `${lbl.widthMm.toFixed(1)}×${lbl.heightMm.toFixed(1)}mm`,
          cx,
          cy + 3.8,
          { align: "center" }
        );
      }
    }

    pdf.save(`folha-teste-${settings.activeProfile}-${Date.now()}.pdf`);
    toast.success("PDF de teste gerado!");
  };

  const [printNoticeOpen, setPrintNoticeOpen] = useState(false);
  const [pendingPrintIsTest, setPendingPrintIsTest] = useState(false);

  const handlePrintRequest = (isTest: boolean = false) => {
    setPendingPrintIsTest(isTest);
    setPrintNoticeOpen(true);
  };

  const executePrint = (isTest: boolean) => {
    setPrintNoticeOpen(false);
    if (isTest) {
      setTestSheetMode(true);
      setTimeout(() => {
        window.print();
        setTimeout(() => setTestSheetMode(false), 1000);
      }, 300);
    } else {
      setTestSheetMode(false);
      window.print();
    }
  };

  const usedSlots = labels.length;
  const isA4 = settings.activeProfile === "a4";
  const sheetsNeeded = isA4
    ? Math.ceil(usedSlots / labelsPerSheet) || 0
    : usedSlots;
  const slotsOnCurrentSheet = isA4
    ? usedSlots % labelsPerSheet || (usedSlots > 0 ? labelsPerSheet : 0)
    : usedSlots;
  const remaining = isA4
    ? Math.max(0, labelsPerSheet - slotsOnCurrentSheet)
    : 0;

  // ─── Millimetric Print CSS ──────────────────────────────────────────
  const printCSS = useMemo(() => {
    if (isA4) {
      return `
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * { visibility: hidden !important; }
          .print-zone, .print-zone * { visibility: visible !important; }
          .print-zone {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${settings.a4.paperWidth}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-page {
            width: ${settings.a4.paperWidth}mm !important;
            height: ${settings.a4.paperHeight}mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
          }
          @page {
            size: ${settings.a4.paperWidth}mm ${settings.a4.paperHeight}mm;
            margin: 0;
          }
        }
      `;
    } else {
      const h = settings.thermal.labelHeight || 40;
      return `
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * { visibility: hidden !important; }
          .print-zone, .print-zone * { visibility: visible !important; }
          .print-zone {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${settings.thermal.paperWidth}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-page {
            width: ${settings.thermal.paperWidth}mm !important;
            height: ${h}mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
          }
          @page {
            size: ${settings.thermal.paperWidth}mm ${h}mm;
            margin: 0;
          }
        }
      `;
    }
  }, [isA4, settings.a4.paperWidth, settings.a4.paperHeight, settings.thermal]);

  const selectedProductStockInfo = useMemo(() => {
    return getProductStockData(selectedProduct);
  }, [selectedProduct, getProductStockData]);

  return (
    <div className="space-y-6">
      {/* ─── Header (hidden on print) ─── */}
      <div className="print:hidden">
        <PageHeader
          title="Gerador de Etiquetas"
          description={
            isA4
              ? `${settings.a4.presetName} — ${settings.a4.columns}×${settings.a4.rows} (${labelsPerSheet} etiquetas/folha) [${settings.a4.paperType === "letter" ? "Carta" : settings.a4.paperType === "a4" ? "A4" : "Personalizado"}]`
              : `Térmica ${settings.thermal.paperWidth}mm — ${settings.thermal.columns === 2 ? "2 colunas" : "1 coluna"} — ${settings.thermal.labelHeight > 0 ? settings.thermal.labelHeight + "mm" : "Contínua"}`
          }
          icon={Tags}
          actions={
            <div className="flex flex-wrap gap-2">
              {/* Profile Toggle */}
              <Tabs
                value={settings.activeProfile}
                onValueChange={(v) => setActiveProfile(v as any)}
              >
                <TabsList className="h-8">
                  <TabsTrigger
                    value="a4"
                    className="text-[10px] font-bold gap-1 px-2.5 h-6"
                  >
                    <Grid3X3 className="size-3" /> Folha (A4 / Carta)
                  </TabsTrigger>
                  <TabsTrigger
                    value="thermal"
                    className="text-[10px] font-bold gap-1 px-2.5 h-6"
                  >
                    <Layers className="size-3" /> 80mm
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                onClick={handleOpenAddModal}
                className="bg-gradient-gold border-none shadow-gold font-bold"
              >
                <Plus className="size-4 mr-2" /> Adicionar
              </Button>

              <Button
                variant="outline"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4 mr-2" /> Ajustes
              </Button>

              {/* Folha de Teste Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-blue-400/40 text-blue-600 hover:bg-blue-50/50 font-bold"
                  >
                    <Ruler className="size-4 mr-1.5" /> Folha de Teste
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => handlePrintRequest(true)}
                    className="font-bold cursor-pointer"
                  >
                    <Printer className="size-4 mr-2 text-blue-600" />
                    Imprimir Folha de Teste
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportTestPDF}
                    className="font-bold cursor-pointer"
                  >
                    <FileDown className="size-4 mr-2 text-blue-600" />
                    Baixar PDF de Teste
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTestSheetMode(!testSheetMode)}
                    className="cursor-pointer"
                  >
                    <Eye className="size-4 mr-2 text-muted-foreground" />
                    {testSheetMode ? "Voltar às Etiquetas" : "Visualizar Teste na Tela"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={async () => {
                  if (!confirm("Limpar todas as etiquetas?")) return;
                  await clearLabels();
                  qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] });
                  toast.success("Grade limpa");
                }}
                className="text-destructive border-destructive/20"
              >
                <Trash2 className="size-4 mr-2" /> Limpar
              </Button>

              <Button
                onClick={handleExportPDF}
                variant="secondary"
                disabled={exporting}
              >
                <FileDown className="size-4 mr-2" /> PDF
              </Button>

              <Button onClick={() => handlePrintRequest(false)} variant="secondary">
                <Printer className="size-4 mr-2" /> Imprimir
              </Button>
            </div>
          }
        />

        {/* ─── Validation Error Alert ─── */}
        {!validation.valid && (
          <div className="bg-destructive/15 border-2 border-destructive/40 rounded-xl p-4 text-destructive space-y-1 mt-4 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="size-5 shrink-0" />
              <span>Atenção: A configuração excede as dimensões do papel!</span>
            </div>
            {validation.errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive/90 ml-7">
                • {err}
              </p>
            ))}
          </div>
        )}

        {/* ─── Test Sheet Banner (when active on screen) ─── */}
        {testSheetMode && (
          <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-3 flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
              <Ruler className="size-4 shrink-0" />
              <span>Modo Folha de Teste e Calibração Ativo na Tela</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleExportTestPDF}
              >
                <FileDown className="size-3 mr-1" /> PDF de Teste
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => handlePrintRequest(true)}
              >
                <Printer className="size-3 mr-1" /> Imprimir Teste
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setTestSheetMode(false)}
              >
                Fechar Modo Teste
              </Button>
            </div>
          </div>
        )}

        {/* ─── Stats Cards ─── */}
        <div className="grid grid-cols-3 gap-4 mb-4 mt-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                {isA4 ? "Folha Atual" : "Etiquetas"}
              </p>
              <p className="text-2xl font-bold">
                {isA4
                  ? `${slotsOnCurrentSheet}/${labelsPerSheet}`
                  : usedSlots}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                {isA4 ? "Total de Folhas" : "Total de Etiquetas"}
              </p>
              <p className="text-2xl font-bold">
                {isA4 ? sheetsNeeded : usedSlots}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                Restante na Folha
              </p>
              <p className="text-2xl font-bold">{remaining}</p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Printer Driver Hint Banner ─── */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Info className="size-4 text-primary shrink-0" />
            <span>
              <strong>Driver de impressão:</strong> Papel a selecionar:{" "}
              <Badge variant="outline" className="font-bold border-primary/40 text-primary">
                {isA4
                  ? settings.a4.paperType === "letter"
                    ? "Carta / Letter (215,9 × 279,4 mm)"
                    : settings.a4.paperType === "a4"
                    ? "A4 (210 × 297 mm)"
                    : `Personalizado (${settings.a4.paperWidth}×${settings.a4.paperHeight} mm)`
                  : `Bobina ${settings.thermal.paperWidth}mm`}
              </Badge>
              {" • "}
              Escala: <strong>100% (Tamanho Real)</strong>
              {" • "}
              Margens: <strong>Nenhuma</strong>
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-muted-foreground hover:text-foreground self-start sm:self-auto shrink-0"
            onClick={() => handlePrintRequest(testSheetMode)}
          >
            Instruções do Driver
          </Button>
        </div>
      </div>

      {/* ─── Preview Area ─── */}
      <div
        ref={previewContainerRef}
        className="bg-muted/30 p-4 sm:p-8 rounded-xl shadow-inner min-h-[400px] flex flex-col items-center overflow-x-auto print:p-0 print:shadow-none print:bg-transparent"
      >
        {labels.length === 0 && !testSheetMode ? (
          <div className="flex flex-col items-center justify-center py-20 text-center print:hidden">
            <div className="size-16 rounded-2xl bg-gradient-dark flex items-center justify-center mb-4">
              <Tags className="size-7 text-gold" />
            </div>
            <h3 className="text-lg font-bold mb-1">Nenhuma etiqueta gerada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Clique em "Adicionar" para criar etiquetas ou use a "Folha de Teste" para calibrar
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleOpenAddModal}
                className="bg-gradient-gold border-none shadow-gold font-bold"
              >
                <Plus className="size-4 mr-2" /> Adicionar Etiquetas
              </Button>
              <Button
                variant="outline"
                onClick={() => setTestSheetMode(true)}
              >
                <Ruler className="size-4 mr-2" /> Ver Folha de Teste
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Screen preview */}
            <div className="print:hidden w-full">
              {isA4 ? (
                <A4SheetPreview
                  profile={settings.a4}
                  labels={enrichedLabels}
                  containerWidth={containerWidth}
                  isTestSheet={testSheetMode}
                />
              ) : (
                <ThermalStripPreview
                  profile={settings.thermal}
                  labels={enrichedLabels}
                  containerWidth={containerWidth}
                  isTestSheet={testSheetMode}
                />
              )}
            </div>

            {/* Print zone (hidden on screen, activated on window.print) */}
            <div className="hidden print:block print-zone">
              {isA4 ? (
                <A4SheetPreview
                  profile={settings.a4}
                  labels={enrichedLabels}
                  containerWidth={settings.a4.paperWidth * 3.7795275591}
                  isPrint
                  isTestSheet={testSheetMode}
                />
              ) : (
                <ThermalStripPreview
                  profile={settings.thermal}
                  labels={enrichedLabels}
                  containerWidth={settings.thermal.paperWidth * 3.7795275591}
                  isPrint
                  isTestSheet={testSheetMode}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Confirm Clean Existing Labels Dialog ─── */}
      <Dialog open={confirmCleanOpen} onOpenChange={setConfirmCleanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tags className="size-5 text-gold" />
              Etiquetas Existentes na Grade
            </DialogTitle>
            <DialogDescription className="pt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Você já possui <strong className="text-foreground">{labels.length}</strong> etiqueta{labels.length > 1 ? "s" : ""} na grade atual.
              <br /><br />
              Deseja limpar as etiquetas atuais antes de adicionar novas, ou adicionar junto às existentes?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
            <Button
              variant="outline"
              onClick={() => setConfirmCleanOpen(false)}
              disabled={cleaningAndAdding}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleKeepAndAdd}
              disabled={cleaningAndAdding}
              className="w-full sm:w-auto"
            >
              Adicionar às Existentes
            </Button>
            <Button
              onClick={handleCleanAndAdd}
              disabled={cleaningAndAdding}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              <Trash2 className="size-4 mr-1.5" />
              Limpar e Adicionar Novas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Labels Modal ─── */}
      <Dialog
        open={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open);
          if (!open) {
            setSelectedProduct(null);
            setQuantities({});
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-gold" />
              Adicionar Etiquetas de Produto
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o produto e defina as quantidades de etiquetas por tamanho ou total.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {!selectedProduct ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome, código ou categoria..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="max-h-[380px] overflow-y-auto space-y-1.5 pt-1">
                  {products
                    .filter((p: any) => {
                      const term = searchTerm.toLowerCase();
                      const matchName = (p.name || "").toLowerCase().includes(term);
                      const matchSku = (p.sku || "").toLowerCase().includes(term);
                      const matchCat = (p.category || "").toLowerCase().includes(term);
                      return matchName || matchSku || matchCat;
                    })
                    .map((p: any) => {
                      const stockInfo = getProductStockData(p);
                      return (
                        <div
                          key={p.id}
                          className="p-3 border rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all flex items-center justify-between gap-3 bg-card"
                          onClick={() => handleSelectProduct(p)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm truncate">{p.name}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0 font-medium">
                                {p.category || "Geral"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="font-mono text-[11px] opacity-80">
                                {p.sku ? `SKU: ${p.sku}` : "Sem SKU"}
                              </span>
                              {p.sale_price ? (
                                <span className="font-bold text-primary">{brl(p.sale_price)}</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {stockInfo.hasSizes ? (
                              <Badge variant="secondary" className="text-[10px] font-bold gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                <Hash className="size-3" />
                                {Object.keys(stockInfo.numeracoes).length} tamanhos
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-semibold">
                                {stockInfo.stockQty} em estoque
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Produto Selecionado Banner (estilo PDV) */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-foreground truncate">
                        {selectedProduct.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {selectedProduct.category || "Geral"}
                      </Badge>
                      {selectedProduct.sale_price ? (
                        <Badge variant="outline" className="text-xs font-bold text-primary border-primary/20">
                          {brl(selectedProduct.sale_price)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      SKU Base: <strong>{selectedProduct.sku || `PROD-${selectedProduct.id.slice(0, 8)}`}</strong>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                      setSelectedProduct(null);
                      setQuantities({});
                    }}
                  >
                    <X className="size-3.5 mr-1" /> Trocar
                  </Button>
                </div>

                {/* Formato de Código */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Tipo de Código</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={type === "CODE128" ? "default" : "outline"}
                      onClick={() => setType("CODE128")}
                      className="flex-1 h-9 text-xs font-bold"
                    >
                      <Barcode className="mr-2 size-4" />
                      Código de Barras (CODE128)
                    </Button>
                    <Button
                      type="button"
                      variant={type === "QR" ? "default" : "outline"}
                      onClick={() => setType("QR")}
                      className="flex-1 h-9 text-xs font-bold"
                    >
                      <QrCode className="mr-2 size-4" />
                      QR Code
                    </Button>
                  </div>
                </div>

                {/* Fluxo com Grade de Numerações (Sandálias / Produtos com Tamanho) */}
                {selectedProductStockInfo.hasSizes ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/40">
                      <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                        <Hash className="size-3.5 text-primary" /> Numerações & Quantidades por Tamanho:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2 font-bold text-muted-foreground hover:text-foreground gap-1"
                          onClick={handleFillStockQuantities}
                        >
                          <RotateCcw className="size-3" />
                          Estoque Atual
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2 font-bold text-muted-foreground hover:text-foreground"
                          onClick={handleSetOneOfEach}
                        >
                          1 de Cada
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2 font-bold text-destructive hover:bg-destructive/10"
                          onClick={handleZeroAll}
                        >
                          Zerar
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {Object.entries(selectedProductStockInfo.numeracoes).map(([size, rawStockQty]: [string, any]) => {
                        const stockQty = Number(rawStockQty) || 0;
                        const currentVal = quantities[size] || 0;
                        const isAvailable = stockQty > 0;
                        const baseSku = (selectedProduct.sku || `PROD-${selectedProduct.id.slice(0, 8)}`).trim();
                        const barcodePreview = baseSku.endsWith(`-${size}`) ? baseSku : `${baseSku}-${size}`;

                        return (
                          <div
                            key={size}
                            className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                              currentVal > 0
                                ? "border-primary/60 bg-primary/5 shadow-sm"
                                : "border-border/60 bg-card hover:border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-black tracking-tight">Tam {size}</span>
                              <Badge
                                variant={isAvailable ? "secondary" : "outline"}
                                className={`text-[9px] px-1.5 py-0 h-4 ${
                                  isAvailable
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold"
                                    : "text-muted-foreground opacity-60 font-medium"
                                }`}
                              >
                                {stockQty > 0 ? `${stockQty} un` : "0 un"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-7 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [size]: Math.max(0, (prev[size] || 0) - 1),
                                  }))
                                }
                                disabled={currentVal <= 0}
                              >
                                <Minus className="size-3" />
                              </Button>
                              <Input
                                type="number"
                                min={0}
                                className="h-7 text-xs text-center font-bold px-1"
                                value={quantities[size] !== undefined ? quantities[size] : ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [size]: isNaN(val) ? 0 : Math.max(0, val),
                                  }));
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-7 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [size]: (prev[size] || 0) + 1,
                                  }))
                                }
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>

                            <div
                              className="text-[9px] text-muted-foreground font-mono truncate"
                              title={`Código de barras único: ${barcodePreview}`}
                            >
                              {barcodePreview}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-muted/30 border border-border/40 rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-gold shrink-0" />
                        Cada tamanho possui seu próprio código de barras exclusivo (<strong>SKU-TAM</strong>).
                      </span>
                      <Badge className="bg-gradient-gold border-none shadow-sm text-foreground font-black text-xs px-2.5 py-0.5 shrink-0">
                        Total: {totalLabelsToGenerate} {totalLabelsToGenerate === 1 ? "etiqueta" : "etiquetas"}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  /* Fluxo simples para produtos sem numeração (Bolsas, Carteiras, etc.) */
                  <div className="space-y-3">
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold">Quantidade Total de Etiquetas</Label>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          Estoque disponível: {selectedProductStockInfo.stockQty} un
                        </Badge>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Ex: 10"
                        value={quantities["total"] || ""}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            total: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="h-10 text-base font-bold"
                      />
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Código de barras: <strong>{selectedProduct.sku || `PROD-${selectedProduct.id.slice(0, 8)}`}</strong>
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-muted/40 rounded-xl border border-border/50 text-xs">
                      <span className="text-muted-foreground font-medium">Total de etiquetas a gerar:</span>
                      <Badge className="bg-gradient-gold border-none shadow-sm text-foreground font-black text-xs px-2.5 py-0.5">
                        {totalLabelsToGenerate} {totalLabelsToGenerate === 1 ? "etiqueta" : "etiquetas"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border/40">
            <Button
              onClick={handleGenerate}
              className="w-full bg-gradient-gold border-none shadow-gold font-bold h-10"
              disabled={!selectedProduct || totalLabelsToGenerate <= 0}
            >
              <Plus className="size-4 mr-2" />
              {totalLabelsToGenerate > 0
                ? `Gerar ${totalLabelsToGenerate} ${totalLabelsToGenerate === 1 ? "Etiqueta" : "Etiquetas"}`
                : "Selecione as Quantidades"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Pre-Print Driver Advice Modal ─── */}
      <Dialog open={printNoticeOpen} onOpenChange={setPrintNoticeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Printer className="size-5 text-gold" />
              Configuração do Driver de Impressão
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Para que as etiquetas saiam perfeitamente alinhadas nos adesivos da folha, configure os seguintes parâmetros na janela de impressão do seu navegador/sistema:
            </p>

            <div className="bg-muted/50 rounded-xl p-3.5 space-y-3 border border-border/50">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  1. Tamanho do Papel a Selecionar no Driver
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  <Badge className="bg-gold text-black font-bold text-xs hover:bg-gold/90">
                    {isA4
                      ? settings.a4.paperType === "letter"
                        ? "Carta / Letter (215,9 × 279,4 mm / 8,5 × 11 pol)"
                        : settings.a4.paperType === "a4"
                        ? "A4 (210 × 297 mm)"
                        : `Personalizado (${settings.a4.paperWidth} × ${settings.a4.paperHeight} mm)`
                      : `Bobina ${settings.thermal.paperWidth} mm`}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  {isA4 && settings.a4.paperType === "letter"
                    ? "Certifique-se de que a impressora está em 'Carta' ou 'Letter', não em 'A4', para não deslocar as margens."
                    : isA4 && settings.a4.paperType === "a4"
                    ? "Certifique-se de que a impressora está em 'A4', não em 'Carta'."
                    : "Configure a largura e altura exatas nas propriedades do driver."}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  2. Escala de Impressão
                </span>
                <p className="font-bold text-foreground">
                  100% (Tamanho Real / Padrão)
                </p>
                <p className="text-[10px] text-muted-foreground">
                  ⚠️ Nunca selecione "Ajustar à página" ou "Ajustar à área de impressão", pois isso altera os milímetros exatos das etiquetas.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  3. Margens
                </span>
                <p className="font-bold text-foreground">
                  Nenhuma (Zero / Mínimas)
                </p>
                <p className="text-[10px] text-muted-foreground">
                  O sistema já calculou as margens exatas em milímetros no layout.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setPrintNoticeOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => executePrint(pendingPrintIsTest)}
              className="bg-gradient-gold border-none shadow-gold font-bold text-xs"
            >
              <Printer className="size-3.5 mr-1.5" />
              {pendingPrintIsTest ? "Imprimir Folha de Teste" : "Imprimir Etiquetas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Settings Panel ─── */}
      <LabelSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        validation={validation}
        setActiveProfile={setActiveProfile}
        updateA4={updateA4}
        updateThermal={updateThermal}
        updateA4Content={updateA4Content}
        updateThermalContent={updateThermalContent}
        applyPreset={applyPreset}
        saveCustomPreset={saveCustomPreset}
        deleteCustomPreset={deleteCustomPreset}
        resetToDefaults={resetToDefaults}
        onOpenTestSheet={() => handlePrintRequest(true)}
      />

      {/* ─── Dynamic Millimetric Print CSS ─── */}
      <style>{printCSS}</style>
    </div>
  );
}
