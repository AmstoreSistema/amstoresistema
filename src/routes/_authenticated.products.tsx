import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Layers, 
  Package, 
  Pencil, 
  Plus, 
  Trash2, 
  Search,
  Clock,
  CircleDollarSign,
  TrendingUp,
  Tag
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useDeleteRow, useRows, useSaveRow } from "@/lib/data";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Produtos — Amstore Gestão" },
      { name: "description", content: "Catálogo completo com fichas técnicas." },
    ],
  }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  sale_price: number;
  wholesale_price: number;
  cost_price: number;
  current_stock: number;
  min_stock: number;
  active: boolean;
  image_url: string | null;
  production_time_hours: number;
};

type Material = { 
  id: string; 
  name: string; 
  unit: string; 
  cost_price: number;
  type: string;
};

type MaterialVariation = {
  id: string;
  material_id: string;
  name: string;
  current_stock: number;
  cost_price: number;
};

type MaterialCut = {
  id: string;
  material_id: string;
  name: string;
  width: number;
  height: number;
  status: string;
};

type Composition = { 
  id: string; 
  product_id: string; 
  material_id: string; 
  material_variation_id: string | null;
  material_cut_id: string | null;
  quantity: number 
};

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: materials = [] } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const { data: compositions = [] } = useRows<Composition>("product_materials");
  const save = useSaveRow("products", "produto");
  const remove = useDeleteRow("products", "produto");

  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Partial<Product>>({});
  const [bomProduct, setBomProduct] = useState<Product | null>(null);
  const [newMaterial, setNewMaterial] = useState("");
  const [newVariation, setNewVariation] = useState("");
  const [newCut, setNewCut] = useState("");
  const [newQty, setNewQty] = useState("1");

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const bomCost = (productId: string) =>
    compositions
      .filter((c) => c.product_id === productId)
      .reduce((s, c) => s + Number(c.quantity) * Number(materialById.get(c.material_id)?.cost_price ?? 0), 0);

  const categories = useMemo(() => ["Todos", ...new Set(products.map(p => p.category))], [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesTerm = p.name.toLowerCase().includes(term.toLowerCase()) || (p.sku?.toLowerCase().includes(term.toLowerCase()));
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      return matchesTerm && matchesCategory;
    });
  }, [products, term, activeCategory]);

  const openNew = () => {
    setEditing(null);
    setForm({ category: "Bolsa", sale_price: 0, wholesale_price: 0, min_stock: 0, current_stock: 0, production_time_hours: 1 });
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(p);
    setFormOpen(true);
  };

  const submit = () => {
    if (!form.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    save.mutate({
      id: editing?.id,
      values: form
    }, {
      onSuccess: () => setFormOpen(false)
    });
  };

  const addComposition = async () => {
    if (!bomProduct || !newMaterial) {
      toast.error("Escolha o material");
      return;
    }
    const { error } = await supabase.from("product_materials").insert({
      product_id: bomProduct.id,
      material_id: newMaterial,
      quantity: Number(newQty || 0),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("composicao", "products", `Material adicionado ao produto ${bomProduct.name}`, bomProduct.id);
    setNewMaterial("");
    setNewQty("1");
    qc.invalidateQueries();
    toast.success("Material adicionado à composição");
  };

  const removeComposition = async (id: string) => {
    const { error } = await supabase.from("product_materials").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries();
    toast.success("Material removido da composição");
  };

  const bomRows = bomProduct ? compositions.filter((c) => c.product_id === bomProduct.id) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Produtos"
        description="Catálogo completo com fichas técnicas"
        icon={Package}
        actions={
          <Button onClick={openNew} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
            <Plus className="size-4" /> Novo Produto
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <Button 
              key={c}
              variant={activeCategory === c ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(c)}
              className="rounded-full px-4"
            >
              {c}
            </Button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar produto..." 
            className="pl-10"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-96 animate-pulse rounded-3xl bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const cost = bomCost(p.id);
            const margin = Number(p.sale_price) - cost;
            const marginWholesale = Number(p.wholesale_price) - cost;
            const marginPercent = cost > 0 ? (margin / cost) * 100 : 0;
            
            return (
              <Card key={p.id} className="group overflow-hidden rounded-3xl border-border/50 bg-card transition-all hover:shadow-xl hover:shadow-gold/5">
                <div className="relative aspect-video bg-muted/30">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/20">
                      <Package className="size-16" />
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute left-3 top-3 uppercase tracking-wider">{p.category}</Badge>
                </div>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="line-clamp-1 font-display text-xl font-bold">{p.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>Código: {p.sku || "—"}</span>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-gold" />
                      <div className="text-xs">
                        <p className="text-muted-foreground">Produção:</p>
                        <p className="font-bold">{p.production_time_hours} horas</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-muted/30 p-4 text-xs">
                    <p className="mb-2 font-bold uppercase tracking-wider text-muted-foreground">Valores Unitários</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo Produto:</span>
                      <span className="font-bold text-destructive">{brl(cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-semibold">Preço Varejo:</span>
                      <span className="font-bold text-success">{brl(p.sale_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço Atacado:</span>
                      <span className="font-bold text-primary">{brl(p.wholesale_price)}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-border/50 pt-2 text-[10px]">
                      <div>
                        <span className="text-muted-foreground">Lucro Varejo: </span>
                        <span className={margin >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                          {brl(margin)} ({num(marginPercent, 1)}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lucro Atacado: </span>
                        <span className={marginWholesale >= 0 ? "text-primary font-bold" : "text-destructive font-bold"}>
                          {brl(marginWholesale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-border/50 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setBomProduct(p)}>
                        <Layers className="size-4" /> Materiais
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Dados básicos do produto e preços.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome do produto</Label>
              <Input 
                value={form.name || ""} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder="Ex: Bolsa de Luxo Eclipse Marrom"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Código / SKU</Label>
                <Input value={form.sku || ""} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Input value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Preço Varejo</Label>
                <Input type="number" step="0.01" value={form.sale_price || 0} onChange={e => setForm({ ...form, sale_price: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Preço Atacado</Label>
                <Input type="number" step="0.01" value={form.wholesale_price || 0} onChange={e => setForm({ ...form, wholesale_price: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Tempo Prod. (h)</Label>
                <Input type="number" value={form.production_time_hours || 0} onChange={e => setForm({ ...form, production_time_hours: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Estoque Atual</Label>
                <Input type="number" value={form.current_stock || 0} onChange={e => setForm({ ...form, current_stock: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Estoque Mínimo</Label>
                <Input type="number" value={form.min_stock || 0} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>URL da Imagem</Label>
              <Input value={form.image_url || ""} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bomProduct} onOpenChange={(o) => !o && setBomProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Composição · {bomProduct?.name}</DialogTitle>
            <DialogDescription>
              Materiais e quantidades consumidas para produzir 1 unidade deste produto.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="min-w-[200px] flex-1">
              <Label className="mb-1.5 block text-xs">Material</Label>
              <Select value={newMaterial} onValueChange={setNewMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label className="mb-1.5 block text-xs">Quantidade</Label>
              <Input type="number" step="0.01" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
            </div>
            <Button onClick={addComposition} className="gap-2">
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>

          <div className="mt-4 max-h-72 overflow-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Material</th>
                  <th className="px-4 py-3 text-left font-semibold">Qtd</th>
                  <th className="px-4 py-3 text-left font-semibold">Custo</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bomRows.map((c) => {
                  const m = materialById.get(c.material_id);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3">{m?.name ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{num(c.quantity)} {m?.unit ?? ""}</td>
                      <td className="px-4 py-3 font-bold text-destructive">{brl(Number(c.quantity) * Number(m?.cost_price ?? 0))}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeComposition(c.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {bomRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                      Nenhum material na composição ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {bomProduct && (
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-muted-foreground">
                Custo total de materiais: <span className="font-bold text-destructive">{brl(bomCost(bomProduct.id))}</span>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
