import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Factory, Play, Plus, Trash2, XCircle } from "lucide-react";
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
import { logAudit, useRows } from "@/lib/data";
import { brl, dateTimeBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({
    meta: [
      { title: "Produção — Amstore Gestão" },
      { name: "description", content: "Crie ordens de produção, inicie a fabricação e conclua dando baixa automática na matéria-prima." },
      { property: "og:title", content: "Produção — Amstore Gestão" },
      { property: "og:description", content: "Ordens de produção com baixa de materiais e entrada automática em estoque." },
    ],
  }),
  component: ProductionPage,
});

type Product = { id: string; name: string; sku: string | null; current_stock: number | null };
type Material = { id: string; name: string; unit: string; current_stock: number | null; cost_price: number | null };
type Composition = { id: string; product_id: string | null; material_id: string | null; quantity: number };
type Order = {
  id: string;
  product_id: string | null;
  quantity: number;
  status: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_producao: "Em produção",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function statusClass(status: string) {
  if (status === "concluido") return "bg-success/12 text-success hover:bg-success/12";
  if (status === "em_producao") return "bg-gold/15 text-gold hover:bg-gold/15";
  if (status === "cancelado") return "bg-destructive/12 text-destructive hover:bg-destructive/12";
  return "bg-muted text-muted-foreground hover:bg-muted";
}

function ProductionPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useRows<Order>("production_orders", { order: { column: "created_at", ascending: false } });
  const { data: products = [] } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: materials = [] } = useRows<Material>("materials");
  const { data: compositions = [] } = useRows<Composition>("product_materials");

  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const bomFor = (pid: string) => compositions.filter((c) => c.product_id === pid);

  const previewBom = productId ? bomFor(productId) : [];
  const previewQty = Number(quantity || 0);

  const createOrder = async () => {
    if (!productId) {
      toast.error("Escolha o produto que deseja produzir");
      return;
    }
    if (previewQty <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }
    const { error } = await supabase.from("production_orders").insert({
      product_id: productId,
      quantity: previewQty,
      status: "pendente",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("criar", "production_orders", `Ordem de produção criada: ${productById.get(productId)?.name} x${previewQty}`);
    toast.success("Ordem de produção criada");
    setOpen(false);
    setProductId("");
    setQuantity("1");
    qc.invalidateQueries();
  };

  const startOrder = async (order: Order) => {
    if (!order.product_id) return;
    const bom = bomFor(order.product_id);
    if (bom.length === 0) {
      toast.error("Defina a composição de materiais do produto antes de produzir");
      return;
    }
    const missing = bom.filter((c) => {
      const m = c.material_id ? materialById.get(c.material_id) : undefined;
      return !m || Number(m.current_stock ?? 0) < Number(c.quantity) * Number(order.quantity);
    });
    if (missing.length > 0) {
      const names = missing.map((c) => (c.material_id ? materialById.get(c.material_id)?.name : "material")).join(", ");
      toast.error(`Matéria-prima insuficiente: ${names}`);
      return;
    }
    setBusy(order.id);
    const { error } = await supabase
      .from("production_orders")
      .update({ status: "em_producao", started_at: new Date().toISOString() })
      .eq("id", order.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("iniciar", "production_orders", `Produção iniciada: ${productById.get(order.product_id)?.name}`, order.id);
    toast.success("Produção iniciada");
    qc.invalidateQueries();
  };

  const completeOrder = async (order: Order) => {
    if (!order.product_id) return;
    const bom = bomFor(order.product_id);
    setBusy(order.id);
    try {
      for (const item of bom) {
        if (!item.material_id) continue;
        const material = materialById.get(item.material_id);
        if (!material) continue;
        const consumed = Number(item.quantity) * Number(order.quantity);
        const next = Number(material.current_stock ?? 0) - consumed;
        const { error } = await supabase
          .from("materials")
          .update({ current_stock: next < 0 ? 0 : next })
          .eq("id", item.material_id);
        if (error) throw error;
      }

      const product = productById.get(order.product_id);
      const unitCost = bom.reduce(
        (s, c) => s + Number(c.quantity) * Number((c.material_id ? materialById.get(c.material_id)?.cost_price : 0) ?? 0),
        0,
      );
      const { error: prodError } = await supabase
        .from("products")
        .update({
          current_stock: Number(product?.current_stock ?? 0) + Number(order.quantity),
          cost_price: unitCost,
        })
        .eq("id", order.product_id);
      if (prodError) throw prodError;

      const { error: orderError } = await supabase
        .from("production_orders")
        .update({ status: "concluido", completed_at: new Date().toISOString() })
        .eq("id", order.id);
      if (orderError) throw orderError;

      await logAudit(
        "concluir",
        "production_orders",
        `Produção concluída: ${product?.name} x${order.quantity} — materiais baixados e estoque atualizado`,
        order.id,
      );
      toast.success("Produção concluída, materiais baixados e produto lançado em estoque");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao concluir a produção");
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    const { error } = await supabase.from("production_orders").update({ status: "cancelado" }).eq("id", order.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ordem cancelada");
    qc.invalidateQueries();
  };

  const deleteOrder = async (order: Order) => {
    const { error } = await supabase.from("production_orders").delete().eq("id", order.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ordem removida");
    qc.invalidateQueries();
  };

  const active = orders.filter((o) => o.status === "pendente" || o.status === "em_producao").length;
  const done = orders.filter((o) => o.status === "concluido");
  const producedUnits = done.reduce((s, o) => s + Number(o.quantity), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produção"
        description="Escolha o produto, inicie a produção e conclua para dar baixa na matéria-prima."
        icon={Factory}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" /> Nova ordem
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Ordens ativas" value={active} icon={Factory} tone="gold" />
        <StatCard title="Ordens concluídas" value={done.length} icon={CheckCircle2} tone="success" />
        <StatCard title="Peças produzidas" value={producedUnits} icon={Factory} tone="dark" />
      </div>

      <DataTable
        rows={orders}
        loading={isLoading}
        empty="Nenhuma ordem de produção ainda."
        columns={[
          { key: "product", header: "Produto", render: (o) => (
            <div>
              <p className="font-medium">{o.product_id ? productById.get(o.product_id)?.name ?? "—" : "—"}</p>
              <p className="text-xs text-muted-foreground">Criada em {dateTimeBR(o.created_at)}</p>
            </div>
          ) },
          { key: "qty", header: "Quantidade", render: (o) => <span className="tabular-nums">{num(o.quantity, 0)}</span> },
          { key: "status", header: "Status", render: (o) => (
            <Badge className={statusClass(o.status ?? "pendente")}>{STATUS_LABEL[o.status ?? "pendente"]}</Badge>
          ) },
          { key: "materials", header: "Materiais", render: (o) => {
            if (!o.product_id) return "—";
            const bom = bomFor(o.product_id);
            const cost = bom.reduce(
              (s, c) => s + Number(c.quantity) * Number((c.material_id ? materialById.get(c.material_id)?.cost_price : 0) ?? 0),
              0,
            );
            return (
              <span className="text-xs text-muted-foreground">
                {bom.length} itens · {brl(cost * Number(o.quantity))}
              </span>
            );
          } },
          { key: "actions", header: "", className: "text-right", render: (o) => (
            <div className="flex justify-end gap-1">
              {o.status === "pendente" && (
                <Button size="sm" variant="outline" className="gap-1" disabled={busy === o.id} onClick={() => startOrder(o)}>
                  <Play className="size-3.5" /> Iniciar produção
                </Button>
              )}
              {o.status === "em_producao" && (
                <Button size="sm" className="gap-1" disabled={busy === o.id} onClick={() => completeOrder(o)}>
                  <CheckCircle2 className="size-3.5" /> Concluir
                </Button>
              )}
              {(o.status === "pendente" || o.status === "em_producao") && (
                <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelOrder(o)}>
                  <XCircle className="size-4" />
                </Button>
              )}
              {(o.status === "concluido" || o.status === "cancelado") && (
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteOrder(o)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ) },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova ordem de produção</DialogTitle>
            <DialogDescription>
              Ao concluir a ordem, a matéria-prima é baixada e o produto entra no estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs">Produto a produzir</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Quantidade</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>

            {productId && (
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Matéria-prima necessária
                </p>
                {previewBom.length === 0 ? (
                  <p className="text-sm text-warning-foreground">
                    Este produto ainda não tem composição. Cadastre em Produtos › Composição.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {previewBom.map((c) => {
                      const m = c.material_id ? materialById.get(c.material_id) : undefined;
                      const need = Number(c.quantity) * previewQty;
                      const enough = Number(m?.current_stock ?? 0) >= need;
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-2">
                          <span>{m?.name ?? "—"}</span>
                          <span className={`tabular-nums ${enough ? "text-muted-foreground" : "text-destructive"}`}>
                            {num(need)} {m?.unit} (tem {num(m?.current_stock ?? 0)})
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={createOrder}>Criar ordem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}