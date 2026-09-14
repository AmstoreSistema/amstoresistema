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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  DollarSign, 
  RefreshCw,
  Upload,
  X,
  Save,
  Loader2,
  Info,
  Barcode,
  MapPin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { brl, num } from "@/lib/format";
import { logAudit } from "@/lib/data";

const PRODUCT_CATEGORIES = ["Bolsa", "Sandálias", "Carteiras", "perfumes", "Geral"];

export type StockProductEditable = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  current_stock: number;
  min_stock: number;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  wholesale_price: number;
  updated_at?: string | null;
  color?: string | null;
};

export type StockRecordEditable = {
  id: string;
  produto_id: string;
  lote?: string | null;
  localizacao?: string | null;
  data_entrada?: string | null;
};

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: StockProductEditable | null;
  stockRecord?: StockRecordEditable | null;
  onSuccess?: () => void;
}

export function EditProductModal({
  open,
  onOpenChange,
  product,
  stockRecord,
  onSuccess,
}: EditProductModalProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    sku: "",
    category: "Bolsa",
    color: "",
    cost_price: 0,
    sale_price: 0,
    wholesale_price: 0,
    min_stock: 5,
    image_url: null as string | null,
    lote: "",
    localizacao: "",
    data_entrada: "",
  });

  // Carrega os dados do produto quando o modal abrir
  React.useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        category: product.category || "Bolsa",
        color: product.color || "",
        cost_price: Number(product.cost_price) || 0,
        sale_price: Number(product.sale_price) || 0,
        wholesale_price: Number(product.wholesale_price) || 0,
        min_stock: Number(product.min_stock) || 5,
        image_url: product.image_url || null,
        lote: stockRecord?.lote || "",
        localizacao: stockRecord?.localizacao || "",
        data_entrada: stockRecord?.data_entrada
          ? (stockRecord.data_entrada.split("T")[0] || "")
          : "",
      });
    }
  }, [product, stockRecord, open]);

  const generateSku = () => {
    setFormData((prev) => ({
      ...prev,
      sku: `PROD-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`,
    }));
  };

  // Cálculos automáticos de margem para auxílio visual
  const cost = Number(formData.cost_price) || 0;
  const retail = Number(formData.sale_price) || 0;
  const wholesale = Number(formData.wholesale_price) || 0;

  const retailMargin = retail - cost;
  const retailPercent = cost > 0 ? (retailMargin / cost) * 100 : 0;

  const wholesaleMargin = wholesale - cost;
  const wholesalePercent = cost > 0 ? (wholesaleMargin / cost) * 100 : 0;

  const handleSave = async () => {
    if (!product) return;
    if (!formData.name.trim()) {
      toast.error("O nome do produto é obrigatório");
      return;
    }

    setLoading(true);
    try {
      // 1. Atualizar tabela products
      const { error: pError } = await supabase
        .from("products")
        .update({
          name: formData.name.trim(),
          sku: formData.sku.trim() || null,
          category: formData.category,
          color: formData.color.trim() || null,
          cost_price: cost,
          sale_price: retail,
          wholesale_price: wholesale,
          min_stock: Number(formData.min_stock) || 0,
          image_url: formData.image_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (pError) throw pError;

      // 2. Atualizar registro correspondente em stock_products
      if (stockRecord?.id) {
        const { error: sError } = await supabase
          .from("stock_products")
          .update({
            produto_nome: formData.name.trim(),
            preco_custo: cost,
            preco_venda: retail,
            categoria: formData.category,
            lote: formData.lote.trim() || null,
            localizacao: formData.localizacao.trim() || null,
            data_entrada: formData.data_entrada || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", stockRecord.id);

        if (sError) console.warn("Aviso ao atualizar stock_products:", sError);
      } else {
        // Se não tinha stockRecord no momento, atualiza qualquer linha vinculada ao produto_id
        await supabase
          .from("stock_products")
          .update({
            produto_nome: formData.name.trim(),
            preco_custo: cost,
            preco_venda: retail,
            categoria: formData.category,
            lote: formData.lote.trim() || null,
            localizacao: formData.localizacao.trim() || null,
            data_entrada: formData.data_entrada || null,
            updated_at: new Date().toISOString(),
          })
          .eq("produto_id", product.id);
      }

      // 3. Auditoria
      await logAudit(
        "atualizar",
        "products",
        `Preços e dados editados: Custo ${brl(cost)}, Varejo ${brl(retail)}, Atacado ${brl(wholesale)}`,
        product.id
      );

      toast.success("Produto e valores atualizados com sucesso!");
      onOpenChange(false);
      onSuccess?.();

      // 4. Invalidação de cache cirúrgica para atualização instantânea
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["stock-products"] }),
        qc.invalidateQueries({ queryKey: ["stock_products"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["stock-stats"] }),
      ]);
    } catch (error: any) {
      console.error("Erro ao salvar produto:", error);
      toast.error(`Erro ao salvar: ${error.message || "Tente novamente"}`);
    } finally {
      setLoading(false);
    }
  };

  const categoriesList = React.useMemo(() => {
    if (formData.category && !PRODUCT_CATEGORIES.includes(formData.category)) {
      return [...PRODUCT_CATEGORIES, formData.category];
    }
    return PRODUCT_CATEGORIES;
  }, [formData.category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-hidden p-0 rounded-[1.5rem] border-none shadow-2xl flex flex-col">
        <DialogHeader className="bg-gradient-gold px-5 py-4 text-white shrink-0 z-10 rounded-t-[1.5rem]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <DollarSign className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-display font-black leading-tight">
                Editar Produto &amp; Preços
              </DialogTitle>
              <p className="text-xs text-white/80 font-medium line-clamp-1 mt-0.5">
                {product?.name || "Atualize valores de custo, varejo, atacado e informações"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ================= SEÇÃO 1: PRECIFICAÇÃO (VALORES UNITÁRIOS) ================= */}
          <section className="space-y-3.5 bg-muted/20 p-4 rounded-2xl border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <DollarSign className="size-4" />
                <h3 className="font-bold uppercase text-[11px] tracking-wider text-foreground">
                  Valores Unitários &amp; Precificação
                </h3>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Estoque atual: <strong className="text-foreground">{product?.current_stock ?? 0} un</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Preço de Custo */}
              <div className="space-y-1.5 bg-background p-3 rounded-xl border border-orange-200 dark:border-orange-950/40">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Preço de Custo
                  </Label>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-8 h-10 font-bold text-sm text-orange-600 bg-muted/20 border-border/60"
                    value={formData.cost_price || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cost_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Custo de compra/fabricação</p>
              </div>

              {/* Preço de Venda / Varejo */}
              <div className="space-y-1.5 bg-background p-3 rounded-xl border border-emerald-200 dark:border-emerald-950/40">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Preço Varejo
                  </Label>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-8 h-10 font-bold text-sm text-emerald-600 bg-muted/20 border-border/60"
                    value={formData.sale_price || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sale_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Preço final no PDV / loja</p>
              </div>

              {/* Preço de Atacado */}
              <div className="space-y-1.5 bg-background p-3 rounded-xl border border-blue-200 dark:border-blue-950/40">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Preço Atacado
                  </Label>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-8 h-10 font-bold text-sm text-blue-600 bg-muted/20 border-border/60"
                    value={formData.wholesale_price || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wholesale_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Preço para revenda/volume</p>
              </div>
            </div>

            {/* Painel de Margem e Lucro em Tempo Real */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/40 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Lucro Varejo (un)
                  </p>
                  <p className={`font-display font-black text-xs sm:text-sm ${retailMargin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {brl(retailMargin)}
                  </p>
                </div>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${retailMargin >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
                  {num(retailPercent, 0)}%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-background/80 border border-border/40 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Lucro Atacado (un)
                  </p>
                  <p className={`font-display font-black text-xs sm:text-sm ${wholesaleMargin >= 0 ? "text-blue-600" : "text-destructive"}`}>
                    {brl(wholesaleMargin)}
                  </p>
                </div>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${wholesaleMargin >= 0 ? "bg-blue-50 text-blue-700" : "bg-destructive/10 text-destructive"}`}>
                  {num(wholesalePercent, 0)}%
                </span>
              </div>
            </div>
          </section>

          <Separator className="bg-border/60" />

          {/* ================= SEÇÃO 2: DADOS DO PRODUTO ================= */}
          <section className="space-y-3.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="size-4 text-primary" />
              <h3 className="font-bold uppercase text-[10px] tracking-widest text-foreground">
                Dados Principais do Produto
              </h3>
            </div>

            {/* Upload de Imagem */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Imagem do Produto
              </Label>
              <div 
                className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-3 transition-colors hover:bg-muted/20 cursor-pointer"
                onClick={() => document.getElementById("edit-product-image-upload")?.click()}
              >
                <input 
                  type="file" 
                  id="edit-product-image-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData((prev) => ({ ...prev, image_url: reader.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {formData.image_url ? (
                  <div className="group relative w-full overflow-hidden rounded-lg aspect-[16/9] max-h-36 flex items-center justify-center bg-black/5">
                    <img src={formData.image_url} alt="Preview" className="h-full w-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        type="button"
                        variant="destructive" 
                        size="sm" 
                        className="h-8 text-xs font-bold gap-1 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData((prev) => ({ ...prev, image_url: null }));
                        }}
                      >
                        <X className="size-3.5" /> Remover Imagem
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2">
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                      <Upload className="size-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Clique para alterar ou adicionar foto
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Nome do Produto */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Nome do Produto *
              </Label>
              <Input 
                placeholder="Ex: Sandália Rasteira Conforto Dourada" 
                className="rounded-xl h-10 font-bold bg-muted/20 border-border/60"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SKU */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Barcode className="size-3" /> Código / SKU
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={formData.sku} 
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="rounded-xl h-10 bg-muted/20 border-border/60 font-mono text-xs font-bold"
                    placeholder="Código do produto"
                  />
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 h-10 w-10 rounded-xl border-border/60" 
                    onClick={generateSku}
                    title="Gerar código aleatório"
                  >
                    <RefreshCw className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Categoria *
                </Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="rounded-xl h-10 bg-muted/20 border-border/60 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesList.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs font-medium">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cor */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Cor / Variação
                </Label>
                <Input 
                  placeholder="Ex: Dourado, Preto, Nude..." 
                  className="rounded-xl h-10 bg-muted/20 border-border/60 text-xs"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>

              {/* Estoque Mínimo */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Estoque Mínimo (Alerta)
                </Label>
                <Input 
                  type="number"
                  min="0"
                  placeholder="Ex: 5" 
                  className="rounded-xl h-10 bg-muted/20 border-border/60 text-xs font-bold"
                  value={formData.min_stock}
                  onChange={(e) =>
                    setFormData({ ...formData, min_stock: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            </div>

            {/* Armazenamento / Lote e Localização */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Lote
                </Label>
                <Input 
                  placeholder="Ex: LOTE-2026-01" 
                  className="rounded-xl h-10 bg-muted/20 border-border/60 font-mono text-xs"
                  value={formData.lote}
                  onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3" /> Localização
                </Label>
                <Input 
                  placeholder="Ex: Prateleira B2" 
                  className="rounded-xl h-10 bg-muted/20 border-border/60 text-xs"
                  value={formData.localizacao}
                  onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Data de Entrada
                </Label>
                <Input 
                  type="date"
                  className="rounded-xl h-10 bg-muted/20 border-border/60 text-xs"
                  value={formData.data_entrada}
                  onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="p-4 bg-muted/15 border-t border-border/40 gap-2 shrink-0">
          <Button 
            type="button"
            variant="outline" 
            className="rounded-xl h-10 px-5 text-xs font-bold" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            type="button"
            className="rounded-xl h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-lg shadow-primary/20 text-xs"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
