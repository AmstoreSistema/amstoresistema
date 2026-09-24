import { useState, useMemo, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testSheetMode, setTestSheetMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [type, setType] = useState<"CODE128" | "QR">("CODE128");
  const [exporting, setExporting] = useState(false);

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

    const isSandalia = selectedProduct?.category === "Sandálias";

    let prodItems: any[];
    if (isSandalia) {
      prodItems = Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([size, qty]) => ({
          id: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          numeracao: size,
          quantity: qty,
          tipo_codigo: type,
        }));
    } else {
      const totalQty = quantities["total"] || 0;
      if (totalQty <= 0) {
        toast.error("Informe a quantidade");
        return;
      }
      prodItems = [
        {
          id: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          numeracao: undefined,
          quantity: totalQty,
          tipo_codigo: type,
        },
      ];
    }

    if (prodItems.length === 0) {
      toast.error("Selecione quantidades");
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
        labels,
        isTestSheet: false,
      });

      const pdf = new jsPDF(
        "p",
        "mm",
        isA4 ? "a4" : [layout.pageWidthMm, layout.pageHeightMm]
      );

      for (let pageIdx = 0; pageIdx < layout.pages.length; pageIdx++) {
        if (pageIdx > 0) {
          pdf.addPage(
            isA4 ? "a4" : [layout.pageWidthMm, layout.pageHeightMm],
            "p"
          );
        }

        const page = layout.pages[pageIdx];

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
      isA4 ? "a4" : [layout.pageWidthMm, layout.pageHeightMm]
    );

    if (isA4) {
      const a4 = settings.a4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(
        `FOLHA DE TESTE E CALIBRAÇÃO — ${a4.presetName} (A4)`,
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

      // Top Ruler (0 to 210mm)
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.line(0, 12, 210, 12);
      for (let mm = 0; mm <= 210; mm += 10) {
        const tickH = mm % 50 === 0 ? 3 : mm % 20 === 0 ? 2 : 1;
        pdf.line(mm, 12 - tickH, mm, 12);
        if (mm % 20 === 0) {
          pdf.setFontSize(5);
          pdf.text(String(mm), mm, 12 - tickH - 0.5, { align: "center" });
        }
      }

      // Left Ruler (0 to 297mm)
      pdf.line(5, 0, 5, 297);
      for (let mm = 0; mm <= 297; mm += 10) {
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

  const handlePrint = (isTest: boolean = false) => {
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
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
          }
          @page {
            size: A4 portrait;
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
  }, [isA4, settings.thermal]);

  return (
    <div className="space-y-6">
      {/* ─── Header (hidden on print) ─── */}
      <div className="print:hidden">
        <PageHeader
          title="Gerador de Etiquetas"
          description={
            isA4
              ? `${settings.a4.presetName} — ${settings.a4.columns}×${settings.a4.rows} (${labelsPerSheet} etiquetas/folha)`
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
                    <Grid3X3 className="size-3" /> A4
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
                onClick={() => setAddModalOpen(true)}
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
                    onClick={() => handlePrint(true)}
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

              <Button onClick={() => handlePrint(false)} variant="secondary">
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
                onClick={() => handlePrint(true)}
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
        <div className="grid grid-cols-3 gap-4 mb-6 mt-4">
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
                onClick={() => setAddModalOpen(true)}
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
                  labels={labels}
                  containerWidth={containerWidth}
                  isTestSheet={testSheetMode}
                />
              ) : (
                <ThermalStripPreview
                  profile={settings.thermal}
                  labels={labels}
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
                  labels={labels}
                  containerWidth={210 * 3.7795275591}
                  isPrint
                  isTestSheet={testSheetMode}
                />
              ) : (
                <ThermalStripPreview
                  profile={settings.thermal}
                  labels={labels}
                  containerWidth={settings.thermal.paperWidth * 3.7795275591}
                  isPrint
                  isTestSheet={testSheetMode}
                />
              )}
            </div>
          </>
        )}
      </div>

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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Adicionar Etiquetas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedProduct ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    className="pl-9"
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto mt-2">
                  {products
                    .filter((p: any) =>
                      p.name
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                    )
                    .map((p: any) => (
                      <div
                        key={p.id}
                        className="p-2 border rounded cursor-pointer hover:bg-slate-100 mb-1 flex justify-between"
                        onClick={() => setSelectedProduct(p)}
                      >
                        <span>{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {p.category}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="font-bold">{selectedProduct.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProduct(null)}
                  >
                    <X className="size-4 mr-1" /> Trocar
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Código</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={type === "CODE128" ? "default" : "outline"}
                      onClick={() => setType("CODE128")}
                      className="flex-1"
                    >
                      <Barcode className="mr-2 size-4" />
                      Barras
                    </Button>
                    <Button
                      type="button"
                      variant={type === "QR" ? "default" : "outline"}
                      onClick={() => setType("QR")}
                      className="flex-1"
                    >
                      <QrCode className="mr-2 size-4" />
                      QR Code
                    </Button>
                  </div>
                </div>

                {selectedProduct.category === "Sandálias" ? (
                  <div className="space-y-2">
                    <Label>Quantidades por Tamanho</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        "33",
                        "34",
                        "35",
                        "36",
                        "37",
                        "38",
                        "39",
                        "40",
                      ].map((size) => (
                        <div key={size}>
                          <Label className="text-[10px]">{size}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={quantities[size] || ""}
                            onChange={(e) =>
                              setQuantities({
                                ...quantities,
                                [size]: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Quantidade Total</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 10"
                      value={quantities["total"] || ""}
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          total: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate} className="w-full">
              Confirmar
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
        onOpenTestSheet={() => handlePrint(true)}
      />

      {/* ─── Dynamic Millimetric Print CSS ─── */}
      <style>{printCSS}</style>
    </div>
  );
}
