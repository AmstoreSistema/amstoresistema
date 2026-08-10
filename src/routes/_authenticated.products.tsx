import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Clock,
  DollarSign,
  ImageIcon,
  Info,
  Layers,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { logAudit, useDeleteRow, useRows } from "@/lib/data";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Produtos — Amstore Gestão" },
      { name: "description", content: "Catálogo completo com fichas técnicas." },
      { property: "og:title", content: "Produtos — Amstore Gestão" },
      { property: "og:description", content: "Catálogo completo com fichas técnicas e composição de materiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  color: string | null;
  description: string | null;
  sale_price: number;
  wholesale_price: number;
  cost_price: number;
  labor_cost: number;
  overhead_cost: number;
  retail_margin: number;
  wholesale_margin: number;
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
  width?: number | null;
  height?: number | null;
};

type MaterialVariation = {
  id: string;
  material_id: string;
  name: string;
  specification: string | null;
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
  material_name: string | null;
  material_type: string | null;
  variation_name: string | null;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  validated: boolean;
  allows_scrap: boolean;
};

type BomLine = {
  key: string;
  id?: string | undefined;
  material_id: string;
  material_variation_id: string;
  material_cut_id: string;
  quantity: string;
  notes: string;
};

const CATEGORIES = ["Bolsa", "Sandália", "Carteira", "Mochila", "Cinto", "Acessório", "Geral"];

const emptyLine = (): BomLine => ({
  key: Math.random().toString(36).slice(2),
  material_id: "",
  material_variation_id: "",
  material_cut_id: "",
  quantity: "0",
  notes: "",
});

const genSku = () => `PROD-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: materials = [] } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const { data: compositions = [] } = useRows<Composition>("product_materials");
  const { data: allVariations = [] } = useRows<MaterialVariation>("material_variations");
  const { data: allCuts = [] } = useRows<MaterialCut>("material_cuts");
  const remove = useDeleteRow("products", "produto");

  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Product>>({});
  const [lines, setLines] = useState<BomLine[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const variationById = useMemo(() => new Map(allVariations.map((v) => [v.id, v])), [allVariations]);
  const cutById = useMemo(() => new Map(allCuts.map((c) => [c.id, c])), [allCuts]);

  /** Custo unitário calculado: corte (por área) > variação > material */
  const unitCostOf = (materialId: string, variationId?: string | null, cutId?: string | null) => {
    const m = materialById.get(materialId);
    if (!m) return 0;
    if (cutId) {
      const cut = cutById.get(cutId);
      const totalCm2 = Number(m.width ?? 0) * 100 * Number(m.height ?? 0) * 100;
      if (cut && totalCm2 > 0) {
        const costPerCm2 = Number(m.cost_price ?? 0) / totalCm2;
        return Number(cut.width) * Number(cut.height) * costPerCm2;
      }
    }
    if (variationId) {
      const v = variationById.get(variationId);
      if (v) return Number(v.cost_price ?? 0);
    }
    return Number(m.cost_price ?? 0);
  };

  const savedBomCost = (productId: string) =>
    compositions
      .filter((c) => c.product_id === productId)
      .reduce(
        (s, c) =>
          s +
          (Number(c.total_cost) ||
            Number(c.quantity) * unitCostOf(c.material_id, c.material_variation_id, c.material_cut_id)),
        0,
      );

  const categories = useMemo(() => ["Todos", ...new Set(products.map((p) => p.category))], [products]);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const t = term.toLowerCase();
        const matchesTerm = p.name.toLowerCase().includes(t) || (p.sku ?? "").toLowerCase().includes(t);
        const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
        return matchesTerm && matchesCategory;
      }),
    [products, term, activeCategory],
  );

  // ---------- Resumo de custos do formulário ----------
  const materialsCost = lines.reduce(
    (s, l) =>
      s +
      (l.material_id
        ? Number(l.quantity || 0) * unitCostOf(l.material_id, l.material_variation_id, l.material_cut_id)
        : 0),
    0,
  );
  const laborCost = Number(form.labor_cost ?? 0);
  const overheadCost = Number(form.overhead_cost ?? 0);
  const totalCost = materialsCost + laborCost + overheadCost;
  const retailMargin = Number(form.retail_margin ?? 0);
  const wholesaleMargin = Number(form.wholesale_margin ?? 0);
  const retailPrice = totalCost * (1 + retailMargin / 100);
  const wholesalePrice = totalCost * (1 + wholesaleMargin / 100);
  const retailProfit = retailPrice - totalCost;
  const wholesaleProfit = wholesalePrice - totalCost;

  const openNew = () => {
    setEditing(null);
    setRemovedIds([]);
    setForm({
      category: "Bolsa",
      sku: genSku(),
      production_time_hours: 0,
      labor_cost: 0,
      overhead_cost: 0,
      retail_margin: 50,
      wholesale_margin: 30,
      min_stock: 0,
      current_stock: 0,
      active: true,
    });
    setLines([emptyLine()]);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setRemovedIds([]);
    setForm({ ...p });
    const rows = compositions
      .filter((c) => c.product_id === p.id)
      .map<BomLine>((c) => ({
        key: c.id,
        id: c.id,
        material_id: c.material_id,
        material_variation_id: c.material_variation_id ?? "",
        material_cut_id: c.material_cut_id ?? "",
        quantity: String(c.quantity ?? 0),
        notes: c.notes ?? "",
      }));
    setLines(rows.length ? rows : [emptyLine()]);
    setFormOpen(true);
  };

  const patchLine = (key: string, patch: Partial<BomLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const dropLine = (line: BomLine) => {
    if (line.id) setRemovedIds((ids) => [...ids, line.id!]);
    setLines((ls) => ls.filter((l) => l.key !== line.key));
  };

  const submit = async () => {
    if (!form.name?.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }
    const valid = lines.filter((l) => l.material_id);
    for (const l of valid) {
      if (Number(l.quantity || 0) <= 0) {
        toast.error("A quantidade de cada material deve ser maior que zero");
        return;
      }
      const varsFor = allVariations.filter((v) => v.material_id === l.material_id);
      if (varsFor.length > 0 && !l.material_variation_id) {
        toast.error(`Selecione a variação de ${materialById.get(l.material_id)?.name ?? "material"}`);
        return;
      }
    }

    setSaving(true);
    try {
      const values = {
        name: form.name.trim(),
        category: form.category || "Geral",
        color: form.color || null,
        sku: form.sku || null,
        description: form.description || null,
        image_url: form.image_url || null,
        production_time_hours: Number(form.production_time_hours ?? 0),
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        retail_margin: retailMargin,
        wholesale_margin: wholesaleMargin,
        cost_price: totalCost,
        sale_price: retailPrice,
        wholesale_price: wholesalePrice,
        min_stock: Number(form.min_stock ?? 0),
        active: form.active ?? true,
        updated_at: new Date().toISOString(),
      };

      let productId = editing?.id;
      if (productId) {
        const { error } = await supabase.from("products").update(values as any).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(values as any).select("id").single();
        if (error) throw error;
        productId = (data as any).id as string;
      }

      // remove linhas excluídas e libera cortes reservados
      for (const id of removedIds) {
        const old = compositions.find((c) => c.id === id);
        await supabase.from("product_materials").delete().eq("id", id);
        if (old?.material_cut_id) {
          await supabase.from("material_cuts").update({ status: "disponivel" }).eq("id", old.material_cut_id);
        }
      }

      for (const l of valid) {
        const m = materialById.get(l.material_id);
        const v = l.material_variation_id ? variationById.get(l.material_variation_id) : null;
        const unitCost = unitCostOf(l.material_id, l.material_variation_id, l.material_cut_id);
        const qty = Number(l.quantity || 0);
        const payload = {
          product_id: productId,
          material_id: l.material_id,
          material_variation_id: l.material_variation_id || null,
          material_cut_id: l.material_cut_id || null,
          material_name: m?.name ?? null,
          material_type: m?.type ?? null,
          variation_name: v?.name ?? null,
          unit: m?.unit ?? null,
          quantity: qty,
          unit_cost: unitCost,
          total_cost: qty * unitCost,
          notes: l.notes || null,
        };
        if (l.id) {
          const previous = compositions.find((c) => c.id === l.id);
          const { error } = await supabase.from("product_materials").update(payload as any).eq("id", l.id);
          if (error) throw error;
          if (previous?.material_cut_id && previous.material_cut_id !== l.material_cut_id) {
            await supabase.from("material_cuts").update({ status: "disponivel" }).eq("id", previous.material_cut_id);
          }
        } else {
          const { error } = await supabase.from("product_materials").insert(payload as any);
          if (error) throw error;
        }
        if (l.material_cut_id) {
          await supabase.from("material_cuts").update({ status: "reservado" }).eq("id", l.material_cut_id);
        }
      }

      await logAudit(editing ? "atualizar" : "criar", "products", `Ficha técnica de ${values.name}`, productId);
      qc.invalidateQueries();
      toast.success(editing ? "Produto atualizado" : "Produto cadastrado");
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  };

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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            className="pl-10"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
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
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-3xl bg-card" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const cost = savedBomCost(p.id) + Number(p.labor_cost ?? 0) + Number(p.overhead_cost ?? 0);
            const margin = Number(p.sale_price) - cost;
            const marginWholesale = Number(p.wholesale_price) - cost;
            const marginPercent = cost > 0 ? (margin / cost) * 100 : 0;

            return (
              <Card key={p.id} className="group overflow-hidden rounded-3xl border-border/50 bg-card transition-all hover:shadow-xl hover:shadow-gold/5">
                <div className="relative aspect-video bg-muted/30">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
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
                      {p.color ? <span>· {p.color}</span> : null}
                    </div>
                  </div>

                  <div className="mb-6 flex items-center gap-2">
                    <Clock className="size-4 text-gold" />
                    <div className="text-xs">
                      <p className="text-muted-foreground">Produção:</p>
                      <p className="font-bold">{num(p.production_time_hours)} horas</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-muted/30 p-4 text-xs">
                    <p className="mb-2 font-bold uppercase tracking-wider text-muted-foreground">Valores Unitários</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Custo Produto:</span>
                      <span className="font-bold text-destructive">{brl(cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-muted-foreground">Preço Varejo:</span>
                      <span className="font-bold text-success">{brl(p.sale_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço Atacado:</span>
                      <span className="font-bold text-primary">{brl(p.wholesale_price)}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-border/50 pt-2 text-[10px]">
                      <div>
                        <span className="text-muted-foreground">Lucro Varejo: </span>
                        <span className={margin >= 0 ? "font-bold text-success" : "font-bold text-destructive"}>
                          {brl(margin)} ({num(marginPercent, 1)}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lucro Atacado: </span>
                        <span className={marginWholesale >= 0 ? "font-bold text-primary" : "font-bold text-destructive"}>
                          {brl(marginWholesale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-border/50 pt-4">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => openEdit(p)}>
                        <Layers className="size-4" /> Ficha Técnica
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

      {/* ================= MODAL FICHA TÉCNICA ================= */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-row items-center justify-between border-b border-border/60 px-6 py-4">
            <DialogTitle className="font-display text-base font-bold">
              {editing ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[72vh] space-y-5 overflow-y-auto px-6 py-5">
            {/* ---------- Informações básicas ---------- */}
            <section className="rounded-2xl border border-border/60 p-4">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold">
                <Info className="size-4 text-primary" /> Informações Básicas
              </h4>
              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block text-xs">Nome do Produto *</Label>
                  <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Categoria *</Label>
                    <Select value={form.category ?? "Bolsa"} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Cor</Label>
                    <Input
                      placeholder="Ex: Marrom, Preto, Azul..."
                      value={form.color ?? ""}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Código do Produto (SKU) *</Label>
                    <div className="flex gap-2">
                      <Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                      <Button variant="outline" size="icon" onClick={() => setForm({ ...form, sku: genSku() })} title="Gerar novo código">
                        <RefreshCw className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Tempo de Produção (horas)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.production_time_hours ?? 0}
                      onChange={(e) => setForm({ ...form, production_time_hours: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Descrição</Label>
                  <Textarea
                    rows={3}
                    value={form.description ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* ---------- Imagem ---------- */}
            <section className="rounded-2xl border border-border/60 p-4">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold">
                <ImageIcon className="size-4 text-primary" /> Imagem do Produto
              </h4>
              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setForm((f) => ({ ...f, image_url: reader.result as string }));
                  reader.readAsDataURL(file);
                }}
              />
              {form.image_url ? (
                <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/20 p-2">
                  <img src={form.image_url} alt="Pré-visualização do produto" className="mx-auto h-40 object-contain" />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-2 size-7"
                    onClick={() => setForm({ ...form, image_url: null })}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById("product-image-upload")?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center transition-colors hover:bg-muted/30"
                >
                  <UploadCloud className="size-8 text-muted-foreground/60" />
                  <span className="text-sm font-medium">Clique para fazer upload da imagem</span>
                  <span className="text-[11px] text-muted-foreground">Máximo 5MB</span>
                </button>
              )}
            </section>

            {/* ---------- Composição ---------- */}
            <section className="rounded-2xl border border-border/60 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold">
                  <Boxes className="size-4 text-primary" /> Composição do Produto
                </h4>
                <Button size="sm" className="gap-2" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                  <Plus className="size-4" /> Adicionar Material
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((l) => {
                  const m = l.material_id ? materialById.get(l.material_id) : null;
                  const varsFor = allVariations.filter((v) => v.material_id === l.material_id);
                  const cutsFor = allCuts.filter(
                    (c) => c.material_id === l.material_id && (c.status === "disponivel" || c.id === l.material_cut_id),
                  );
                  const unitCost = l.material_id ? unitCostOf(l.material_id, l.material_variation_id, l.material_cut_id) : 0;
                  const lineTotal = unitCost * Number(l.quantity || 0);
                  const needsVariation = varsFor.length > 0 && !l.material_variation_id;

                  return (
                    <div key={l.key} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="mb-3">
                        <Label className="mb-1.5 block text-xs">Material *</Label>
                        <Select
                          value={l.material_id}
                          onValueChange={(v) =>
                            patchLine(l.key, { material_id: v, material_variation_id: "", material_cut_id: "" })
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {materials.map((mm) => (
                              <SelectItem key={mm.id} value={mm.id}>
                                {mm.name} · {mm.type} ({mm.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {varsFor.length > 0 && (
                        <div className="mb-3 animate-in fade-in slide-in-from-top-1">
                          <Label className="mb-1.5 block text-xs">Variação (Cor/Tamanho) *</Label>
                          <Select
                            value={l.material_variation_id}
                            onValueChange={(v) => patchLine(l.key, { material_variation_id: v, material_cut_id: "" })}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione a variação" /></SelectTrigger>
                            <SelectContent>
                              {varsFor.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                  {v.specification ? ` · ${v.specification}` : ""} — {brl(v.cost_price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {l.material_id && cutsFor.length > 0 && (
                        <div className="mb-3 animate-in fade-in slide-in-from-top-1">
                          <Label className="mb-1.5 block text-xs">Corte Disponível</Label>
                          <Select value={l.material_cut_id} onValueChange={(v) => patchLine(l.key, { material_cut_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Sem corte vinculado" /></SelectTrigger>
                            <SelectContent>
                              {cutsFor.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} ({num(c.width)}×{num(c.height)}cm)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {l.material_id && varsFor.length > 0 && cutsFor.length === 0 && (
                        <Badge variant="outline" className="mb-3 border-gold/50 bg-gold/10 text-gold">
                          Nenhum corte disponível para esta variação
                        </Badge>
                      )}

                      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <div>
                          <Label className="mb-1.5 block text-xs">Quantidade ({m?.unit ?? "unidade"})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={l.quantity}
                            onChange={(e) => patchLine(l.key, { quantity: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-xs">Custo Unit. (R$)</Label>
                          <Input readOnly value={num(unitCost, 4)} className="bg-muted/40" />
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-xs">Custo Total</Label>
                          <Input readOnly value={brl(lineTotal)} className="bg-muted/40 font-bold" />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => dropLine(l)}
                          title="Remover material"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="mt-3">
                        <Label className="mb-1.5 block text-xs">Observações</Label>
                        <Input
                          placeholder="Etapa de uso, detalhes do corte..."
                          value={l.notes}
                          onChange={(e) => patchLine(l.key, { notes: e.target.value })}
                        />
                      </div>

                      {needsVariation && (
                        <p className="mt-2 text-[11px] font-medium text-destructive">Selecione a variação deste material.</p>
                      )}
                    </div>
                  );
                })}
                {lines.length === 0 && (
                  <p className="py-6 text-center text-sm italic text-muted-foreground">
                    Nenhum material na composição ainda.
                  </p>
                )}
              </div>
            </section>

            {/* ---------- Resumo de custos e preços ---------- */}
            <section className="rounded-2xl border border-border/60 p-4">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-bold">
                <DollarSign className="size-4 text-primary" /> Resumo de Custos &amp; Preços
              </h4>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Composição de Custos</p>
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1.5 block text-xs">Mão de Obra (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.labor_cost ?? 0}
                        onChange={(e) => setForm({ ...form, labor_cost: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Despesas Gerais (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.overhead_cost ?? 0}
                        onChange={(e) => setForm({ ...form, overhead_cost: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-success/10 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumo Financeiro</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo de Materiais:</span><span className="font-bold">{brl(materialsCost)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Mão de Obra:</span><span className="font-bold">{brl(laborCost)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Despesas Gerais:</span><span className="font-bold">{brl(overheadCost)}</span></div>
                    <div className="flex justify-between border-t border-border/50 pt-2">
                      <span className="font-semibold">Custo Total:</span>
                      <span className="font-display text-lg font-black text-primary">{brl(totalCost)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-gold/10 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Precificação Varejo</p>
                  <Label className="mb-1.5 block text-xs">Margem Varejo (%) sobre materiais</Label>
                  <Input
                    type="number"
                    step="1"
                    value={form.retail_margin ?? 0}
                    onChange={(e) => setForm({ ...form, retail_margin: Number(e.target.value) })}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">Preço Varejo</p>
                  <p className="font-display text-2xl font-black text-success">{brl(retailPrice)}</p>
                  <p className="text-[11px] text-muted-foreground">Lucro Varejo: {brl(retailProfit)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    = {brl(totalCost)} × (1 + {num(retailMargin, 0)}%)
                  </p>
                </div>

                <div className="rounded-2xl bg-primary/10 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Precificação Atacado</p>
                  <Label className="mb-1.5 block text-xs">Margem Atacado (%) sobre materiais</Label>
                  <Input
                    type="number"
                    step="1"
                    value={form.wholesale_margin ?? 0}
                    onChange={(e) => setForm({ ...form, wholesale_margin: Number(e.target.value) })}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">Preço Atacado</p>
                  <p className="font-display text-2xl font-black text-primary">{brl(wholesalePrice)}</p>
                  <p className="text-[11px] text-muted-foreground">Lucro Atacado: {brl(wholesaleProfit)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    = {brl(totalCost)} × (1 + {num(wholesaleMargin, 0)}%)
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-muted/30 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="size-4" /> Análise de Lucratividade
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Lucro Varejo</p>
                    <p className="font-display text-xl font-black text-success">{brl(retailProfit)}</p>
                    <p className="text-[11px] text-muted-foreground">Margem aplicada sobre materiais + custos fixos</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lucro Atacado</p>
                    <p className="font-display text-xl font-black text-primary">{brl(wholesaleProfit)}</p>
                    <p className="text-[11px] text-muted-foreground">Margem aplicada sobre materiais + custos fixos</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-border/60 px-6 py-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              <Package className="size-4" /> {saving ? "Salvando..." : editing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
