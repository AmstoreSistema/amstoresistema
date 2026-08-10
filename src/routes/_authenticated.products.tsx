import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      { title: "Produtos e Composição — Amstore Gestão" },
      { name: "description", content: "Cadastre produtos e monte a composição com a matéria-prima usada em cada peça." },
      { property: "og:title", content: "Produtos — Amstore Gestão" },
      { property: "og:description", content: "Produtos com ficha técnica de materiais, custo calculado e preço de venda." },
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
  cost_price: number;
  current_stock: number;
  min_stock: number;
  active: boolean;
};

type Material = { id: string; name: string; unit: string; cost_price: number };
type Composition = { id: string; product_id: string; material_id: string; quantity: number };

type ProductForm = {
  name: string;
  sku: string;
  category: string;
  sale_price: number | string;
  min_stock: number | string;
  current_stock: number | string;
};

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: materials = [] } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const { data: compositions = [] } = useRows<Composition>("product_materials");
  const save = useSaveRow("products", "produto");
  const remove = useDeleteRow("products", "produto");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>({
    name: "",
    sku: "",
    category: "Geral",
    sale_price: 0,
    min_stock: 0,
    current_stock: 0,
  });
  const [bomProduct, setBomProduct] = useState<Product | null>(null);
  const [newMaterial, setNewMaterial] = useState("");
  const [newQty, setNewQty] = useState("1");

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const bomCost = (productId: string) =>
    compositions
      .filter((c) => c.product_id === productId)
      .reduce((s, c) => s + Number(c.quantity) * Number(materialById.get(c.material_id)?.cost_price ?? 0), 0);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", sku: "", category: "Geral", sale_price: 0, min_stock: 0, current_stock: 0 });
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      category: p.category,
      sale_price: p.sale_price,
      min_stock: p.min_stock,
      current_stock: p.current_stock,
    });
    setFormOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do produto");
      return;
    }
    save.mutate(
      {
        id: editing?.id ?? undefined,
        values: {
          name: form.name,
          sku: form.sku || null,
          category: form.category || "Geral",
          sale_price: Number(form.sale_price || 0),
          min_stock: Number(form.min_stock || 0),
          current_stock: Number(form.current_stock || 0),
        },
      },
      { onSuccess: () => setFormOpen(false) },
    );
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
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Produtos finais e a matéria-prima que compõe cada peça."
        icon={Package}
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="size-4" /> Novo produto
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Produtos cadastrados" value={products.length} icon={Package} tone="dark" />
        <StatCard title="Com composição definida" value={new Set(compositions.map((c) => c.product_id)).size} icon={Layers} tone="gold" />
        <StatCard
          title="Valor de venda em estoque"
          value={brl(products.reduce((s, p) => s + Number(p.current_stock) * Number(p.sale_price), 0))}
          icon={Package}
          tone="success"
        />
      </div>

      <DataTable
        rows={products}
        loading={isLoading}
        columns={[
          { key: "name", header: "Produto", render: (p) => (
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.sku || "sem código"} · {p.category}</p>
            </div>
          ) },
          { key: "bom", header: "Materiais", render: (p) => {
            const count = compositions.filter((c) => c.product_id === p.id).length;
            return count ? (
              <Badge variant="secondary">{count} itens</Badge>
            ) : (
              <Badge className="bg-warning/15 text-warning-foreground hover:bg-warning/15">sem composição</Badge>
            );
          } },
          { key: "cost", header: "Custo (materiais)", render: (p) => <span className="tabular-nums">{brl(bomCost(p.id))}</span> },
          { key: "price", header: "Preço venda", render: (p) => <span className="tabular-nums font-semibold">{brl(p.sale_price)}</span> },
          { key: "margin", header: "Margem", render: (p) => {
            const cost = bomCost(p.id);
            const margin = Number(p.sale_price) - cost;
            return <span className={`tabular-nums ${margin >= 0 ? "text-success" : "text-destructive"}`}>{brl(margin)}</span>;
          } },
          { key: "stock", header: "Estoque", render: (p) => <span className="tabular-nums">{num(p.current_stock, 0)}</span> },
          { key: "actions", header: "", className: "w-40 text-right", render: (p) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setBomProduct(p)}>
                <Layers className="size-3.5" /> Composição
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove.mutate(p.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) },
        ]}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>Dados básicos do produto final.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs">Nome</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Código / SKU</Label>
              <Input value={form.sku ?? ""} onChange={(e) => setForm((s) => ({ ...s, sku: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Categoria</Label>
              <Input value={form.category ?? ""} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Preço de venda (R$)</Label>
              <Input type="number" step="0.01" value={form.sale_price ?? 0} onChange={(e) => setForm((s) => ({ ...s, sale_price: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Estoque mínimo</Label>
              <Input type="number" value={form.min_stock ?? 0} onChange={(e) => setForm((s) => ({ ...s, min_stock: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Estoque atual</Label>
              <Input type="number" value={form.current_stock ?? 0} onChange={(e) => setForm((s) => ({ ...s, current_stock: e.target.value }))} />
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

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/40 p-3">
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
            <Button onClick={addComposition} className="gap-1">
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>

          <div className="max-h-72 overflow-auto">
            <DataTable
              rows={bomRows}
              empty="Nenhum material na composição ainda."
              columns={[
                { key: "material", header: "Material", render: (c) => materialById.get(c.material_id)?.name ?? "—" },
                { key: "qty", header: "Qtd", render: (c) => `${num(c.quantity)} ${materialById.get(c.material_id)?.unit ?? ""}` },
                { key: "cost", header: "Custo", render: (c) => brl(Number(c.quantity) * Number(materialById.get(c.material_id)?.cost_price ?? 0)) },
                { key: "actions", header: "", className: "w-12 text-right", render: (c) => (
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeComposition(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) },
              ]}
            />
          </div>

          {bomProduct && (
            <p className="text-sm text-muted-foreground">
              Custo total de materiais: <span className="font-semibold text-foreground">{brl(bomCost(bomProduct.id))}</span>
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}