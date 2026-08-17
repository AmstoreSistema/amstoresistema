import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tags, Plus, Trash2, Printer, Grid3X3, Search, Package, X, Barcode, QrCode, Settings, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRows } from "@/lib/data";
import { generateLabelGrid, clearLabels, getPrintSettings, savePrintSettings } from "@/lib/labels.functions";

export const Route = createFileRoute("/_authenticated/labels")({
  component: LabelsPage,
});

function LabelsPage() {
  const qc = useQueryClient();
  const { data: labels = [] } = useRows<any>("etiqueta_gerada", { order: { column: "id", ascending: true } });
  const { data: products = [] } = useRows<any>("products", { order: { column: "name", ascending: true } });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [type, setType] = useState<'CODE128' | 'QR'>('CODE128');
  const [exporting, setExporting] = useState(false);

  const [printSettings, setPrintSettings] = useState({
    margin_top: 0,
    margin_left: 0,
    column_spacing: 0,
    row_spacing: 0,
    label_width: 63.5,
    label_height: 38.1
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getPrintSettings() as any;
        if (settings && typeof settings === 'object' && !('error' in settings)) {
          setPrintSettings({
            margin_top: Number(settings.margin_top || 0),
            margin_left: Number(settings.margin_left || 0),
            column_spacing: Number(settings.column_spacing || 0),
            row_spacing: Number(settings.row_spacing || 0),
            label_width: Number(settings.label_width || 63.5),
            label_height: Number(settings.label_height || 38.1)
          });
        }
      } catch (e) {
        console.error("Erro ao carregar configs", e);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    labels.forEach(label => {
      if (label.tipo_codigo === 'CODE128') {
        const element = document.getElementById(`barcode-${label.id}`);
        if (element) {
          try {
            JsBarcode(element, label.codigo_barras, { 
              format: "CODE128", 
              width: 1.5, 
              height: 40, 
              displayValue: true, 
              fontSize: 10, 
              margin: 0 
            });
          } catch (e) {
            console.error("Erro ao gerar barcode", e);
          }
        }
      }
    });
  }, [labels]);

  const handleGenerate = async () => {
    const isSandalia = selectedProduct?.category === 'Sandálias';
    
    let prodItems;
    if (isSandalia) {
      prodItems = Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([size, qty]) => ({
          id: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku,
          numeracao: size,
          quantity: qty,
          tipo_codigo: type
        }));
    } else {
      const totalQty = quantities['total'] || 0;
      if (totalQty <= 0) {
        toast.error("Informe a quantidade");
        return;
      }
      prodItems = [{
        id: selectedProduct.id,
        name: selectedProduct.name,
        sku: selectedProduct.sku,
        numeracao: undefined,
        quantity: totalQty,
        tipo_codigo: type
      }];
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
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExportPDF = async () => {
    const element = document.querySelector(".print-grid") as HTMLElement;
    if (!element) return;

    setExporting(true);
    const loadingToast = toast.loading("Gerando PDF...");

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      // A4 dimensions in mm: 210 x 297
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      pdf.save(`etiquetas-${Date.now()}.pdf`);
      
      toast.success("PDF gerado com sucesso!");
    } catch (e) {
      console.error("Erro ao gerar PDF", e);
      toast.error("Erro ao gerar PDF");
    } finally {
      toast.dismiss(loadingToast);
      setExporting(false);
    }
  };

  const saveSettings = async () => {
    try {
      await savePrintSettings({ data: printSettings });
      setSettingsModalOpen(false);
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const usedSlots = labels.length;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader 
          title="Gerador de Etiquetas" 
          description="Grade 3 colunas padrão Pimaco/A4"
          icon={Tags}
          actions={
            <div className="flex gap-2">
              <Button onClick={() => setAddModalOpen(true)} className="bg-gradient-gold border-none shadow-gold font-bold">
                <Plus className="size-4 mr-2" /> Adicionar
              </Button>
              <Button variant="outline" onClick={() => setSettingsModalOpen(true)}>
                <Settings className="size-4 mr-2" /> Ajustes
              </Button>
              <Button variant="outline" onClick={async () => { 
                if (!confirm("Limpar todas as etiquetas?")) return;
                await clearLabels(); 
                qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] }); 
                toast.success("Grade limpa");
              }} className="text-destructive border-destructive/20">
                <Trash2 className="size-4 mr-2" /> Limpar
              </Button>
              <Button onClick={handleExportPDF} variant="secondary" disabled={exporting}>
                <FileDown className="size-4 mr-2" /> PDF
              </Button>
              <Button onClick={() => window.print()} variant="secondary">
                <Printer className="size-4 mr-2" /> Imprimir
              </Button>
            </div>
          } 
        />
        
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card><CardContent className="pt-6 text-center"><p className="text-sm font-bold">Folha</p><p className="text-2xl">{usedSlots}/30</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm font-bold">Total</p><p className="text-2xl">{usedSlots}</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-sm font-bold">Restante</p><p className="text-2xl">{Math.max(0, 30 - (usedSlots % 30 || (usedSlots > 0 ? 30 : 0)))}</p></CardContent></Card>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-inner min-h-[800px] flex flex-col items-center overflow-x-auto print:p-0 print:shadow-none print:bg-transparent">
        <div 
          className="grid grid-cols-3 gap-0 w-[210mm] print-grid bg-white"
          style={{
            paddingTop: `${printSettings.margin_top}mm`,
            paddingLeft: `${printSettings.margin_left}mm`,
            columnGap: `${printSettings.column_spacing}mm`,
            rowGap: `${printSettings.row_spacing}mm`,
          }}
        >
          {labels.map(l => (
            <div 
              key={l.id} 
              className="border border-slate-100 p-2 flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                width: `${printSettings.label_width}mm`,
                height: `${printSettings.label_height}mm`,
              }}
            >
              <span className="text-[9px] font-bold uppercase truncate w-full mb-1">{l.produto_nome}</span>
              <div className="flex items-center justify-center min-h-[45px] w-full overflow-hidden">
                {l.tipo_codigo === 'QR' ? <QRCodeSVG value={l.codigo_barras} size={45} /> : <svg id={`barcode-${l.id}`} className="max-w-full" />}
              </div>
              <span className="text-[8px] mt-1 font-mono">{l.numeracao ? `TAM: ${l.numeracao}` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={addModalOpen} onOpenChange={(open) => {
        setAddModalOpen(open);
        if (!open) {
          setSelectedProduct(null);
          setQuantities({});
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Adicionar Etiquetas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!selectedProduct ? (
              <div className="space-y-2">
                <Search className="absolute ml-3 mt-2.5 size-4" />
                <Input placeholder="Buscar produto..." className="pl-9" onChange={e => setSearchTerm(e.target.value)} />
                <div className="max-h-60 overflow-y-auto mt-2">
                  {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                    <div key={p.id} className="p-2 border rounded cursor-pointer hover:bg-slate-100 mb-1 flex justify-between" onClick={() => setSelectedProduct(p)}>
                      <span>{p.name}</span>
                      <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="font-bold">{selectedProduct.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}><X className="size-4 mr-1"/> Trocar</Button>
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo de Código</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant={type === 'CODE128' ? 'default' : 'outline'} 
                      onClick={() => setType('CODE128')}
                      className="flex-1"
                    >
                      <Barcode className="mr-2 size-4"/>Barras
                    </Button>
                    <Button 
                      type="button"
                      variant={type === 'QR' ? 'default' : 'outline'} 
                      onClick={() => setType('QR')}
                      className="flex-1"
                    >
                      <QrCode className="mr-2 size-4"/>QR Code
                    </Button>
                  </div>
                </div>

                {selectedProduct.category === 'Sandálias' ? (
                  <div className="space-y-2">
                    <Label>Quantidades por Tamanho</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {['33', '34', '35', '36', '37', '38', '39', '40'].map(size => (
                        <div key={size}>
                          <Label className="text-[10px]">{size}</Label>
                          <Input 
                            type="number" 
                            min={0} 
                            value={quantities[size] || ""}
                            onChange={e => setQuantities({...quantities, [size]: parseInt(e.target.value)||0})} 
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
                      value={quantities['total'] || ""}
                      onChange={e => setQuantities({...quantities, ['total']: parseInt(e.target.value)||0})} 
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate} className="w-full">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajustes de Impressão (mm)</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Margem Topo</Label>
              <Input type="number" step="0.1" value={printSettings.margin_top} onChange={e => setPrintSettings({...printSettings, margin_top: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Margem Esquerda</Label>
              <Input type="number" step="0.1" value={printSettings.margin_left} onChange={e => setPrintSettings({...printSettings, margin_left: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Espaçamento Colunas</Label>
              <Input type="number" step="0.1" value={printSettings.column_spacing} onChange={e => setPrintSettings({...printSettings, column_spacing: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Espaçamento Linhas</Label>
              <Input type="number" step="0.1" value={printSettings.row_spacing} onChange={e => setPrintSettings({...printSettings, row_spacing: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Largura Etiqueta</Label>
              <Input type="number" step="0.1" value={printSettings.label_width} onChange={e => setPrintSettings({...printSettings, label_width: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Altura Etiqueta</Label>
              <Input type="number" step="0.1" value={printSettings.label_height} onChange={e => setPrintSettings({...printSettings, label_height: Number(e.target.value)})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSettings} className="w-full">Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-grid, .print-grid * { visibility: visible; }
          .print-grid {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            border: none !important;
            padding-top: ${printSettings.margin_top}mm !important;
            padding-left: ${printSettings.margin_left}mm !important;
            margin: 0 !important;
            background: white !important;
          }
          .print-grid > div {
            border: none !important;
            width: ${printSettings.label_width}mm !important;
            height: ${printSettings.label_height}mm !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
