import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Boxes } from "lucide-react";

import { CrudPage } from "@/components/crud-page";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Materiais — Amstore Gestão" },
      { name: "description", content: "Cadastre e controle a matéria-prima usada na produção: couro, ferragens, forros, linhas e mais." },
      { property: "og:title", content: "Materiais — Amstore Gestão" },
      { property: "og:description", content: "Cadastro completo de matéria-prima com custo, unidade e estoque mínimo." },
    ],
  }),
  component: MaterialsPage,
});

export const MATERIAL_TYPES = ["Couro", "Ferragem", "Forros", "Cola", "Linha", "Almoxarifado", "Outros"];

type Material = {
  id: string;
  name: string;
  type: string;
  unit: string;
  cost_price: number;
  current_stock: number;
  min_stock: number;
  supplier: string | null;
};

function MaterialsPage() {
  return (
    <CrudPage<Material>
      table="materials"
      label="material"
      title="Materiais"
      description="Matéria-prima disponível para compor seus produtos."
      icon={Boxes}
      order={{ column: "name", ascending: true }}
      searchKeys={["name", "type", "supplier"]}
      fields={[
        { name: "name", label: "Nome do material", span: 2 },
        { name: "type", label: "Tipo", type: "select", options: MATERIAL_TYPES.map((t) => ({ value: t, label: t })), default: "Couro" },
        { name: "unit", label: "Unidade (m, kg, un...)", default: "un" },
        { name: "cost_price", label: "Custo unitário (R$)", type: "number", step: "0.01" },
        { name: "current_stock", label: "Estoque atual", type: "number", step: "0.01" },
        { name: "min_stock", label: "Estoque mínimo", type: "number", step: "0.01" },
        { name: "supplier", label: "Fornecedor" },
      ]}
      columns={[
        { key: "name", header: "Material", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "type", header: "Tipo", render: (r) => <Badge variant="secondary">{r.type}</Badge> },
        { key: "stock", header: "Estoque", render: (r) => (
          <span className="tabular-nums">
            {num(r.current_stock)} {r.unit}
          </span>
        ) },
        { key: "cost", header: "Custo", render: (r) => <span className="tabular-nums">{brl(r.cost_price)}</span> },
        { key: "supplier", header: "Fornecedor", render: (r) => r.supplier || "—" },
        { key: "status", header: "Situação", render: (r) =>
          Number(r.current_stock) <= Number(r.min_stock) ? (
            <Badge className="bg-destructive/12 text-destructive hover:bg-destructive/12">Crítico</Badge>
          ) : (
            <Badge className="bg-success/12 text-success hover:bg-success/12">Ok</Badge>
          ) },
      ]}
      summary={(rows) => {
        const critical = rows.filter((r) => Number(r.current_stock) <= Number(r.min_stock)).length;
        const value = rows.reduce((s, r) => s + Number(r.current_stock) * Number(r.cost_price), 0);
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total de materiais" value={rows.length} icon={Boxes} tone="dark" />
            <StatCard title="Em nível crítico" value={critical} icon={AlertTriangle} tone="destructive" />
            <StatCard title="Valor em estoque" value={brl(value)} icon={Boxes} tone="gold" />
          </div>
        );
      }}
    />
  );
}