import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Info, 
  DollarSign, 
  RefreshCw,
  AlertCircle,
  Box,
  Upload,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { brl } from "@/lib/format";

const PRODUCT_CATEGORIES = ["Bolsa", "Sandálias", "Carteiras", "perfumes"];
const SIZES = ["33", "34", "35", "36", "37", "38", "39", "40"];

export function AddProductDirectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [sku, setSku] = React.useState(() => `PROD-${Date.now().toString(36).toUpperCase()}`);
  
  const [formData, setFormData] = React.useState({
    name: "",
    category: "Bolsa",
    color: "",
    data_entrada: new Date().toISOString().split('T')[0],
    lote: `LOTE-DIR-${Date.now()}`,
    localizacao: "",
    notes: "",
    preco_custo: 0,
    preco_venda: 0,
    preco_atacado: 0,
    min_stock: 5,
    image_url: "" as string | null,
  });

  const [quantities, setQuantities] = React.useState<Record<string, number>>({});

  const generateSku = () => {
    setSku(`PROD-${Date.now().toString(36).toUpperCase()}`);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const isSandalia = formData.category.toLowerCase().includes("sandali") || formData.category.toLowerCase().includes("calcad");
      const totalQty = isSandalia 
        ? Object.values(quantities).reduce((a, b) => a + (Number(b) || 0), 0)
        : 1;

      const { data: product, error: pError } = await supabase
        .from("products")
        .insert({
          name: formData.name,
          sku: sku,
          category: formData.category,
          color: formData.color,
          cost_price: formData.preco_custo,
          sale_price: formData.preco_venda,
          wholesale_price: formData.preco_atacado,
          min_stock: formData.min_stock,
          image_url: formData.image_url,
          current_stock: totalQty,
          active: true
        })
        .select()
        .single();

      if (pError) throw pError;

      const { error: sError } = await supabase
        .from("stock_products")
        .insert({
          produto_id: product.id,
          produto_nome: product.name,
          quantidade_disponivel: totalQty,
          numeracoes: (isSandalia ? quantities : null) as any,
          preco_custo: formData.preco_custo,
          preco_venda: formData.preco_venda,
          data_entrada: formData.data_entrada || null,
          lote: formData.lote,
          localizacao: formData.localizacao,
          categoria: formData.category
        });

      if (sError) throw sError;

      toast.success("Produto adicionado diretamente ao estoque!");
      onOpenChange(false);
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["stock-products"] }),
        qc.invalidateQueries({ queryKey: ["stock_products"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["stock-stats"] }),
      ]);
      
      setFormData({
        name: "",
        category: "Geral",
        color: "",
        data_entrada: new Date().toISOString().split('T')[0],
        lote: `LOTE-DIR-${Date.now()}`,
        localizacao: "",
        notes: "",
        preco_custo: 0,
        preco_venda: 0,
        preco_atacado: 0,
        min_stock: 5,
        image_url: null,
      });
      setQuantities({});
      generateSku();

    } catch (error: any) {
      toast.error(`Erro ao adicionar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden p-0 rounded-[1.5rem] border-none shadow-2xl flex flex-col">
        <DialogHeader className="bg-success px-5 py-3 text-white shrink-0 z-10 rounded-t-[1.5rem]">
          <div className="flex items-center gap-3">
             <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Package className="size-5" />
             </div>
             <DialogTitle className="text-lg font-display font-black">Adicionar Produto Direto</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <section className="space-y-3">
             <div className="flex items-center gap-2 text-success">
                <Info className="size-4" />
                <h3 className="font-bold uppercase text-[10px] tracking-widest">Informações do Produto</h3>
             </div>
             
             {/* Upload de Imagem */}
             <div className="space-y-1.5">
                <Label className="text-[10px] font-bold pl-1 uppercase tracking-wider text-muted-foreground">Imagem do Produto</Label>
                <div 
                  className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 p-4 transition-colors hover:bg-muted/10 cursor-pointer"
                  onClick={() => document.getElementById('product-direct-image-upload')?.click()}
                >
                  <input 
                    type="file" 
                    id="product-direct-image-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, image_url: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {formData.image_url ? (
                    <div className="group relative w-full overflow-hidden rounded-xl aspect-video max-h-40">
                      <img src={formData.image_url} alt="Preview" className="h-full w-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({ ...formData, image_url: null });
                          }}
                        >
                          <X className="size-4 mr-1" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm mb-1.5">
                        <Upload className="size-4 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium">Clique para fazer upload da imagem</p>
                    </>
                  )}
                </div>
             </div>
             
             <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Nome do Produto *</Label>
                   <Input 
                      placeholder="Ex: Bolsa Marrom Importada" 
                      className="rounded-xl h-10 bg-muted/30 border-none"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Código / SKU</Label>
                   <div className="flex gap-2">
                      <Input 
                        value={sku} 
                        readOnly 
                        className="rounded-xl h-10 bg-muted/50 border-none font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 rounded-xl" onClick={generateSku}>
                         <RefreshCw className="size-4" />
                      </Button>
                   </div>
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Categoria *</Label>
                   <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                      <SelectTrigger className="rounded-xl h-10 bg-muted/30 border-none font-bold">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="space-y-1.5">
                <Label className="text-[10px] font-bold pl-1">Cor / Especificação</Label>
                <Input 
                   placeholder="Ex: Marrom, Preto, Verniz..." 
                   className="rounded-xl h-10 bg-muted/30 border-none"
                   value={formData.color}
                   onChange={e => setFormData({...formData, color: e.target.value})}
                />
             </div>

             {(formData.category === "Sandálias" || formData.category.toLowerCase().includes("sandali") || formData.category.toLowerCase().includes("calcad")) && (
                <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-dashed border-muted-foreground/20 animate-in fade-in slide-in-from-top-2">
                   <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Numerações Disponíveis</Label>
                   <div className="grid grid-cols-8 gap-2">
                      {SIZES.map(size => (
                         <div key={size} className="space-y-1 text-center">
                            <span className="text-[10px] font-bold text-muted-foreground">{size}</span>
                            <Input 
                               type="number"
                               className="h-9 px-1 text-center rounded-lg border-none bg-background text-xs"
                               value={quantities[size] || 0}
                               onChange={e => setQuantities({...quantities, [size]: Number(e.target.value)})}
                            />
                         </div>
                      ))}
                   </div>
                   <p className="text-[10px] text-right font-bold text-muted-foreground">Total: {Object.values(quantities).reduce((a, b) => a + (Number(b) || 0), 0)} pares</p>
                </div>
             )}

             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Data de Entrada *</Label>
                   <Input 
                      type="date"
                      className="rounded-xl h-10 bg-muted/30 border-none text-xs"
                      value={formData.data_entrada}
                      onChange={e => setFormData({...formData, data_entrada: e.target.value})}
                   />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Lote</Label>
                   <Input 
                      className="rounded-xl h-10 bg-muted/30 border-none"
                      value={formData.lote}
                      onChange={e => setFormData({...formData, lote: e.target.value})}
                   />
                </div>
             </div>

             <div className="space-y-1.5">
                <Label className="text-[10px] font-bold pl-1">Localização no Estoque</Label>
                <Input 
                   placeholder="Ex: Prateleira A1, Seção B" 
                   className="rounded-xl h-10 bg-muted/30 border-none"
                   value={formData.localizacao}
                   onChange={e => setFormData({...formData, localizacao: e.target.value})}
                />
             </div>

             <div className="space-y-1.5">
                <Label className="text-[10px] font-bold pl-1">Observações</Label>
                <Textarea 
                   placeholder="Ex: Produto importado, origem..." 
                   className="rounded-xl bg-muted/30 border-none min-h-[80px]"
                   value={formData.notes}
                   onChange={e => setFormData({...formData, notes: e.target.value})}
                />
             </div>
          </section>

          <Separator className="bg-muted/50" />

          <section className="space-y-3">
             <div className="flex items-center gap-2 text-success">
                <DollarSign className="size-4" />
                <h3 className="font-bold uppercase text-[10px] tracking-widest">Precificação</h3>
             </div>
             
             <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Preço de Custo</Label>
                   <Input 
                      type="number"
                      className="rounded-xl h-10 bg-muted/30 border-none font-bold"
                      value={formData.preco_custo}
                      onChange={e => setFormData({...formData, preco_custo: Number(e.target.value)})}
                   />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Venda (Varejo)</Label>
                   <Input 
                      type="number"
                      className="rounded-xl h-10 bg-muted/30 border-none font-bold text-success"
                      value={formData.preco_venda}
                      onChange={e => setFormData({...formData, preco_venda: Number(e.target.value)})}
                   />
                </div>
                <div className="space-y-1.5">
                   <Label className="text-[10px] font-bold pl-1">Venda (Atacado)</Label>
                   <Input 
                      type="number"
                      className="rounded-xl h-10 bg-muted/30 border-none font-bold text-primary"
                      value={formData.preco_atacado}
                      onChange={e => setFormData({...formData, preco_atacado: Number(e.target.value)})}
                   />
                </div>
             </div>

             <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex gap-3">
                <AlertCircle className="size-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   <strong>Atenção:</strong> Este produto será adicionado diretamente ao estoque, sem passar pela produção. Use esta opção apenas para produtos que já existem antes ou foram comprados prontos.
                </p>
             </div>
          </section>
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t border-muted/20 gap-2">
           <Button variant="outline" className="rounded-xl h-10 px-6 text-xs font-bold" onClick={() => onOpenChange(false)}>Cancelar</Button>
           <Button 
              className="rounded-xl h-10 px-6 bg-success hover:bg-success/90 text-white font-bold gap-2 shadow-lg shadow-success/20 text-xs"
              onClick={handleSave}
              disabled={loading}
           >
              {loading ? "ADICIONANDO..." : <><Box className="size-4" /> ADICIONAR AO ESTOQUE</>}
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
