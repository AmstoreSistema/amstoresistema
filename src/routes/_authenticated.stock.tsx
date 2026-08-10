import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Package, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useRows } from "@/lib/data";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({
    meta: [
      { title: "Estoque — Amstore Gestão" },
      { name: "description", content: "Acompanhe o estoque de produtos acabados e de matéria-prima, com alertas de nível crítico." },
      { property: "og:title", content: "Estoque — Amstore Gestão" },
      { property: "og:description", content: "Saldo de produtos e materiais em tempo real, com ajuste manual." },
    ],
  }),
  component: StockPage,
});

type Product = { id: string; name: string; sku: string | null; category: string; current_stock: number | null; min_stock: number; sale_price: number | null; cost_price: number };
type Material = { id: string; name: string; type: string; unit: string; current_stock: number | null; min_stock: number; cost_price: number | null };

function StockPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: materials = [] } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const [edit, setEdit] = useState<{ table: string; id: string; value: string } | null>(null);

  const adjust = async (table: "products" | "materials", id: string, value: string, name: string) => {
    const { error } = await supabase.from(table).update({ current_stock: Number(value || 0) }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit("ajuste_estoque", table, `Estoque de ${name} ajustado para ${value}`, id);
    setEdit(null);
    toast.success("Estoque ajustado");
    qc.invalidateQueries();
  };

  const lowProducts = products.filter((p) => Number(p.current_stock ?? 0) <= Number(p.min_stock));
  const lowMaterials = materials.filter((m) => Number(m.current_stock ?? 0) <= Number(m.min_stock));

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" description="Produtos acabados e matéria-prima em um só lugar." icon={Warehouse} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Produtos em estoque" value={products.reduce((s, p) => s + Number(p.current_stock ?? 0), 0)} icon={Package} tone="gold" />
        <StatCard title="Valor de venda" value={brl(products.reduce((s, p) => s + Number(p.current_stock ?? 0) * Number(p.sale_price ?? 0), 0))} icon={Package} tone="success" />
        <StatCard title="Materiais cadastrados" value={materials.length} icon={Boxes} tone="dark" />
        <StatCard title="Itens em nível crítico" value={lowProducts.length + lowMaterials.length} icon={AlertTriangle} tone="destructive" />
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="materiais">Matéria-prima</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
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
              { key: "stock", header: "Saldo", render: (p) =>
                edit?.table === "products" && edit.id === p.id ? (
                  <div className="flex items-center gap-1">
                    <Input className="h-8 w-24" type="number" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
                    <Button size="sm" onClick={() => adjust("products", p.id, edit.value, p.name)}>Ok</Button>
                  </div>
                ) : (
                  <span className="tabular-nums font-semibold">{num(p.current_stock ?? 0, 0)}</span>
                ) },
              { key: "min", header: "Mínimo", render: (p) => <span className="tabular-nums text-muted-foreground">{num(p.min_stock, 0)}</span> },
              { key: "status", header: "Situação", render: (p) =>
                Number(p.current_stock ?? 0) <= Number(p.min_stock) ? (
                  <Badge className="bg-destructive/12 text-destructive hover:bg-destructive/12">Repor</Badge>
                ) : (
                  <Badge className="bg-success/12 text-success hover:bg-success/12">Ok</Badge>
                ) },
              { key: "actions", header: "", className: "text-right", render: (p) => (
                <Button size="sm" variant="outline" onClick={() => setEdit({ table: "products", id: p.id, value: String(p.current_stock ?? 0) })}>
                  Ajustar
                </Button>
              ) },
            ]}
          />
        </TabsContent>

        <TabsContent value="materiais" className="mt-4">
          <DataTable
            rows={materials}
            columns={[
              { key: "name", header: "Material", render: (m) => (
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.type}</p>
                </div>
              ) },
              { key: "stock", header: "Saldo", render: (m) =>
                edit?.table === "materials" && edit.id === m.id ? (
                  <div className="flex items-center gap-1">
                    <Input className="h-8 w-24" type="number" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
                    <Button size="sm" onClick={() => adjust("materials", m.id, edit.value, m.name)}>Ok</Button>
                  </div>
                ) : (
                  <span className="tabular-nums font-semibold">{num(m.current_stock ?? 0)} {m.unit}</span>
                ) },
              { key: "min", header: "Mínimo", render: (m) => <span className="tabular-nums text-muted-foreground">{num(m.min_stock)}</span> },
              { key: "value", header: "Valor", render: (m) => brl(Number(m.current_stock ?? 0) * Number(m.cost_price ?? 0)) },
              { key: "actions", header: "", className: "text-right", render: (m) => (
                <Button size="sm" variant="outline" onClick={() => setEdit({ table: "materials", id: m.id, value: String(m.current_stock ?? 0) })}>
                  Ajustar
                </Button>
              ) },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}