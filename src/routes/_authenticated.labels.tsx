import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Tags, 
  Plus, 
  Trash2, 
  Printer, 
  Grid3X3, 
  LayoutGrid,
  Search,
  Package,
  X,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";

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
import { Label } from "@/components/ui/label";
import { useRows, logAudit } from "@/lib/data";
import { generateLabelGrid, clearLabels } from "@/lib/labels.functions";

export const Route = createFileRoute("/_authenticated/labels")({
  head: () => ({
    meta: [
      { title: "Gerador de Etiquetas — Amstore Gestão" },
      { name: "description", content: "Gere etiquetas para produtos em grade 3 colunas." },
    ],
  }),
  component: LabelsPage,
});

type LabelItem = {
  id: number;
  produto_nome: string;
  codigo_barras: string;
  linha: number;
  coluna: number;
};

function LabelsPage() {
  const qc = useQueryClient();
  const { data: labels = [], isLoading } = useRows<LabelItem>("etiqueta_gerada", {
    order: { column: "id", ascending: true }
  });
  const { data: products = [] } = useRows<any>("products", {
    order: { column: "name", ascending: true }
  });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [startPos, setStartPos] = useState({ line: 1, col: 1 });

  // Renderiza os códigos de barras após o carregamento
  useEffect(() => {
    if (labels.length > 0) {
      labels.forEach(label => {
        const element = document.getElementById(`barcode-${label.id}`);
        if (element) {
          try {
            JsBarcode(element, label.codigo_barras, {
              format: "CODE128",
              width: 1.5,
              height: 40,
              displayValue: true,
              fontSize: 12,
              margin: 0
            });
          } catch (e) {
            console.error("Erro ao gerar barcode", e);
          }
        }
      });
    }
  }, [labels]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  const handleAddProduct = (product: any) => {
    const existing = selectedProducts.find(p => p.id === product.id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => 
        p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} adicionado`);
  };

  const handleRemoveSelected = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const handleGenerate = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Selecione ao menos um produto");
      return;
    }

    const t = toast.loading("Gerando grade de etiquetas...");
    try {
      await generateLabelGrid({
        data: {
          products: selectedProducts.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku || "SEM-SKU",
            quantity: p.quantity
          })),
          startLine: startPos.line,
          startColumn: startPos.col
        }
      });
      await logAudit("etiquetas", "etiqueta_gerada", `Geradas ${selectedProducts.length} etiquetas`);
      qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] });
      setAddModalOpen(false);
      setSelectedProducts([]);
      toast.success("Etiquetas geradas com sucesso!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      toast.dismiss(t);
    }
  };

  const handleClear = async () => {
    if (!confirm("Deseja limpar todas as etiquetas da grade?")) return;
    try {
      await clearLabels();
      qc.invalidateQueries({ queryKey: ["etiqueta_gerada"] });
      toast.success("Grade limpa");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Agrupa etiquetas por linha para visualização
  const rows = useMemo(() => {
    const map = new Map<number, LabelItem[]>();
    labels.forEach(l => {
      const row = map.get(l.linha) || [];
      row.push(l);
      map.set(l.linha, row);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [labels]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="print:hidden">
        <PageHeader 
          title="Etiquetas Geradas" 
          description="Gerenciamento de impressão de etiquetas em grade 3xN"
          icon={Tags}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClear} className="text-destructive border-destructive/30">
                <Trash2 className="size-4 mr-2" /> Limpar Grade
              </Button>
              <Button onClick={() => setAddModalOpen(true)} className="bg-gradient-gold border-none shadow-gold font-bold">
                <Plus className="size-4 mr-2" /> Adicionar Produtos
              </Button>
              <Button onClick={handlePrint} variant="secondary">
                <Printer className="size-4 mr-2" /> Imprimir
              </Button>
            </div>
          }
        />
      </div>

      {/* Preview da Grade */}
      <div className="bg-white p-8 rounded-xl shadow-inner min-h-[800px] flex flex-col items-center overflow-x-auto print:p-0 print:shadow-none print:rounded-none print:w-full print:bg-transparent">
        <div className="grid-labels-container w-[210mm] bg-white border border-dashed border-slate-200 print:border-none print:m-0">
          {/* Definição de grade: 3 colunas */}
          <div className="grid grid-cols-3 gap-0 w-full min-h-[297mm]">
            {labels.map((label) => (
              <div 
                key={label.id}
                className="label-box border border-slate-100 p-2 flex flex-col items-center justify-center text-center h-[38mm] w-full print:border-none"
                style={{
                  gridRow: label.linha,
                  gridColumn: label.coluna
                }}
              >
                <span className="text-[10px] font-bold uppercase truncate w-full mb-1">{label.produto_nome}</span>
                <svg id={`barcode-${label.id}`} className="max-w-full h-auto"></svg>
                <span className="text-[8px] mt-1 text-slate-500 font-mono">AMSTORE - L:{label.linha} C:{label.coluna}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Adição */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="size-5 text-gold" />
              Gerar Grade de Etiquetas
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 flex-1 overflow-hidden">
            {/* Esquerda: Seleção de Produtos */}
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar produto..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {filteredProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">SKU: {p.sku || 'N/A'}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleAddProduct(p)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Direita: Configuração e Lista */}
            <div className="flex flex-col gap-4 overflow-hidden border-l pl-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Linha Inicial</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={startPos.line}
                    onChange={e => setStartPos({ ...startPos, line: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coluna Inicial (1-3)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={3} 
                    value={startPos.col}
                    onChange={e => setStartPos({ ...startPos, col: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                <Label className="mb-2 block">Selecionados:</Label>
                {selectedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border border-dashed rounded-xl">
                    <Package className="size-8 mb-2 opacity-20" />
                    <span className="text-xs">Nenhum produto selecionado</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedProducts.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                        </div>
                        <Input 
                          type="number" 
                          min={1} 
                          className="w-16 h-8 text-xs" 
                          value={p.quantity}
                          onChange={e => setSelectedProducts(selectedProducts.map(sp => 
                            sp.id === p.id ? { ...sp, quantity: parseInt(e.target.value) || 1 } : sp
                          ))}
                        />
                        <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => handleRemoveSelected(p.id)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerate} className="bg-gold hover:bg-gold/90 text-black font-bold">
              Gerar Etiquetas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .grid-labels-container, .grid-labels-container * {
            visibility: visible;
          }
          .grid-labels-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
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
