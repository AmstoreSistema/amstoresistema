import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tags, Plus, Trash2, Printer, Grid3X3, Search, Package, X, Barcode, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRows, logAudit } from "@/lib/data";
import { generateLabelGrid, clearLabels } from "@/lib/labels.functions";

export const Route = createFileRoute("/_authenticated/labels")({
  component: LabelsPage,
});

function LabelsPage() {
  const qc = useQueryClient();
  const { data: labels = [] } = useRows<any>("etiqueta_gerada", { order: { column: "id", ascending: true } });
  const { data: products = [] } = useRows<any>("products", { order: { column: "name", ascending: true } });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [type, setType] = useState<'CODE128' | 'QR'>('CODE128');

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
    const prodItems = Object.entries(quantities).filter(([_, qty]) => qty > 0).map(([size, qty]) => ({
      id: selectedProduct.id,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      numeracao: size,
      quantity: qty,
      tipo_codigo: type
    }));

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
              <Button variant="outline" onClick={async () => { 
                if (!confirm("Limpar todas as etiquetas?")) return;
                await clearLabels(); 
                qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] }); 
                toast.success("Grade limpa");
              }} className="text-destructive border-destructive/20">
                <Trash2 className="size-4 mr-2" /> Limpar
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
          <Card><CardContent className="pt-6 text-center"><p className="text-sm font-bold">Restante</p><p className="text-2xl">{30 - (usedSlots % 30)}</p></CardContent></Card>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-inner min-h-[800px] print:p-0">
        <div className="grid grid-cols-3 gap-0 w-[210mm] print-grid">
          {labels.map(l => (
            <div key={l.id} className="border border-slate-200 p-2 flex flex-col items-center justify-center h-[38mm]">
              <span className="text-[10px] font-bold uppercase truncate w-full">{l.produto_nome}</span>
              {l.tipo_codigo === 'QR' ? <QRCodeSVG value={l.codigo_barras} size={40} /> : <svg id={`barcode-${l.id}`} />}
              <span className="text-[8px] mt-1">{l.numeracao || ''}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={addModalOpen} onOpenChange={(open) => {
        setAddModalOpen(open);
        if (!open) setSelectedProduct(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Adicionar Etiquetas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!selectedProduct ? (
              <div className="space-y-2">
                <Search className="absolute ml-3 mt-2.5 size-4" />
                <Input placeholder="Buscar produto..." className="pl-9" onChange={e => setSearchTerm(e.target.value)} />
                <div className="max-h-60 overflow-y-auto">
                  {products.filter(p => p.name.includes(searchTerm)).map(p => (
                    <div key={p.id} className="p-2 border rounded cursor-pointer hover:bg-slate-100" onClick={() => setSelectedProduct(p)}>{p.name}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-bold">{selectedProduct.name}</p>
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant={type === 'CODE128' ? 'default' : 'outline'} 
                    onClick={() => setType('CODE128')}
                  >
                    <Barcode className="mr-2 size-4"/>Barras
                  </Button>
                  <Button 
                    type="button"
                    variant={type === 'QR' ? 'default' : 'outline'} 
                    onClick={() => setType('QR')}
                  >
                    <QrCode className="mr-2 size-4"/>QR Code
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['33', '34', '35', '36', '37', '38', '39', '40'].map(size => (
                    <div key={size}>
                      <Label>{size}</Label>
                      <Input type="number" min={0} onChange={e => setQuantities({...quantities, [size]: parseInt(e.target.value)||0})} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate}>Confirmar</Button>
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
            padding: 0 !important;
            margin: 0 !important;
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
