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
  Box
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["Bolsa", "Sandália", "Carteira", "Mochila", "Cinto", "Acessório", "Geral"];
const SIZES = ["33", "34", "35", "36", "37", "38", "39", "40"];

export function AddProductDirectModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [sku, setSku] = React.useState(() => `PROD-${Date.now().toString(36).toUpperCase()}`);
  
  const [formData, setFormData] = React.useState({
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
          active: true
        })
        .select()
        .single();

      if (pError) throw pError;

      const totalQty = Object.values(quantities).reduce((a, b) => a + (Number(b) || 0), 0);

      const { error: sError } = await supabase
        .from("stock_products")
        .insert({
          produto_id: product.id,
          produto_nome: product.name,
          quantidade_disponivel: formData.category === "Sandália" ? totalQty : 1,
          numeracoes: (formData.category === "Sandália" ? quantities : null) as any,
          preco_custo: formData.preco_custo,
          preco_venda: formData.preco_venda,
          data_entrada: formData.data_entrada || null,
          lote: formData.lote,
          localizacao: formData.localizacao
        });

      if (sError) throw sError;

      toast.success("Produto adicionado diretamente ao estoque!");
      qc.invalidateQueries();
      onOpenChange(false);
      
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
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0 rounded-[2rem] border-none shadow-2xl">
        <DialogHeader className="bg-success p-6 text-white sticky top-0 z-10 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
             <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Package className="size-6" />
             </div>
             <DialogTitle className="text-xl font-display font-black">Adicionar Produto Direto ao Estoque</DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8">
          <section className="space-y-4">
             <div className="flex items-center gap-2 text-success">
                <Info className="size-4" />
                <h3 className="font-bold uppercase text-[10px] tracking-widest">Informações do Produto</h3>
             </div>
             
             <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Nome do Produto *</Label>
                   <Input 
                      placeholder="Ex: Bolsa Marrom Importada" 
                      className="rounded-xl h-11 bg-muted/30 border-none"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Código / SKU</Label>
                   <div className="flex gap-2">
                      <Input 
                        value={sku} 
                        readOnly 
                        className="rounded-xl h-11 bg-muted/50 border-none font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" className="shrink-0 h-11 w-11 rounded-xl" onClick={generateSku}>
                         <RefreshCw className="size-4" />
                      </Button>
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Categoria *</Label>
                   <Select value={formData.category} onValueChange={val => setFormData({...formData, category: val})}>
                      <SelectTrigger className="rounded-xl h-11 bg-muted/30 border-none font-bold">
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                   </Select>
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-xs font-bold pl-1">Cor / Especificação</Label>
                <Input 
                   placeholder="Ex: Marrom, Preto, Verniz..." 
                   className="rounded-xl h-11 bg-muted/30 border-none"
                   value={formData.color}
                   onChange={e => setFormData({...formData, color: e.target.value})}
                />
             </div>

             {formData.category === "Sandália" && (
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

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Data de Entrada *</Label>
                   <Input 
                      type="date"
                      className="rounded-xl h-11 bg-muted/30 border-none"
                      value={formData.data_entrada}
                      onChange={e => setFormData({...formData, data_entrada: e.target.value})}
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Lote</Label>
                   <Input 
                      className="rounded-xl h-11 bg-muted/30 border-none"
                      value={formData.lote}
                      onChange={e => setFormData({...formData, lote: e.target.value})}
                   />
                </div>
             </div>

             <div className="space-y-2">
                <Label className="text-xs font-bold pl-1">Localização no Estoque</Label>
                <Input 
                   placeholder="Ex: Prateleira A1, Seção B" 
                   className="rounded-xl h-11 bg-muted/30 border-none"
                   value={formData.localizacao}
                   onChange={e => setFormData({...formData, localizacao: e.target.value})}
                />
             </div>

             <div className="space-y-2">
                <Label className="text-xs font-bold pl-1">Observações</Label>
                <Textarea 
                   placeholder="Ex: Produto importado, origem..." 
                   className="rounded-xl bg-muted/30 border-none min-h-[80px]"
                   value={formData.notes}
                   onChange={e => setFormData({...formData, notes: e.target.value})}
                />
             </div>
          </section>

          <Separator className="bg-muted/50" />

          <section className="space-y-4">
             <div className="flex items-center gap-2 text-success">
                <DollarSign className="size-4" />
                <h3 className="font-bold uppercase text-[10px] tracking-widest">Precificação</h3>
             </div>
             
             <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Preço de Custo</Label>
                   <Input 
                      type="number"
                      className="rounded-xl h-11 bg-muted/30 border-none font-bold"
                      value={formData.preco_custo}
                      onChange={e => setFormData({...formData, preco_custo: Number(e.target.value)})}
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Venda (Varejo)</Label>
                   <Input 
                      type="number"
                      className="rounded-xl h-11 bg-muted/30 border-none font-bold text-success"
                      value={formData.preco_venda}
                      onChange={e => setFormData({...formData, preco_venda: Number(e.target.value)})}
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-bold pl-1">Venda (Atacado)</Label>
                   <Input 
                      type="number"
                      className="rounded-xl h-11 bg-muted/30 border-none font-bold text-primary"
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

        <DialogFooter className="p-6 bg-muted/10 border-t border-muted/20 gap-3">
           <Button variant="outline" className="rounded-xl h-12 px-8" onClick={() => onOpenChange(false)}>Cancelar</Button>
           <Button 
              className="rounded-xl h-12 px-8 bg-success hover:bg-success/90 text-white font-bold gap-2 shadow-lg shadow-success/20"
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
