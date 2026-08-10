import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, TrendingDown, TrendingUp } from "lucide-react";

import { CrudPage } from "@/components/crud-page";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transações — Amstore Gestão" },
      { name: "description", content: "Todos os lançamentos financeiros: entradas de vendas, recebimentos de fiado e saídas." },
      { property: "og:title", content: "Transações — Amstore Gestão" },
      { property: "og:description", content: "Livro caixa da loja com entradas e saídas lançadas automaticamente." },
    ],
  }),
  component: TransactionsPage,
});

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
};

function TransactionsPage() {
  return (
    <CrudPage<Transaction>
      table="transactions"
      label="lançamento"
      title="Transações"
      description="Entradas e saídas do caixa, incluindo vendas e fiado."
      icon={ArrowLeftRight}
      order={{ column: "created_at", ascending: false }}
      searchKeys={["description", "type"]}
      fields={[
        { name: "description", label: "Descrição", span: 2 },
        { name: "type", label: "Tipo", type: "select", default: "entrada", options: [
          { value: "entrada", label: "Entrada" },
          { value: "saida", label: "Saída" },
          { value: "fiado", label: "Fiado (a receber)" },
        ] },
        { name: "amount", label: "Valor (R$)", type: "number", step: "0.01" },
      ]}
      columns={[
        { key: "date", header: "Data", render: (r) => dateTimeBR(r.created_at) },
        { key: "description", header: "Descrição", render: (r) => <span className="font-medium">{r.description || "—"}</span> },
        { key: "type", header: "Tipo", render: (r) => (
          <Badge className={
            r.type === "entrada"
              ? "bg-success/12 text-success hover:bg-success/12"
              : r.type === "saida"
                ? "bg-destructive/12 text-destructive hover:bg-destructive/12"
                : "bg-warning/15 text-warning-foreground hover:bg-warning/15"
          }>
            {r.type}
          </Badge>
        ) },
        { key: "amount", header: "Valor", className: "text-right", render: (r) => (
          <span className={`tabular-nums font-semibold ${r.type === "saida" ? "text-destructive" : "text-success"}`}>
            {r.type === "saida" ? "-" : "+"} {brl(r.amount)}
          </span>
        ) },
      ]}
      summary={(rows) => {
        const inflow = rows.filter((r) => r.type === "entrada").reduce((s, r) => s + Number(r.amount), 0);
        const outflow = rows.filter((r) => r.type === "saida").reduce((s, r) => s + Number(r.amount), 0);
        const credit = rows.filter((r) => r.type === "fiado").reduce((s, r) => s + Number(r.amount), 0);
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Entradas" value={brl(inflow)} icon={TrendingUp} tone="success" />
            <StatCard title="Saídas" value={brl(outflow)} icon={TrendingDown} tone="destructive" />
            <StatCard title="Em fiado" value={brl(credit)} icon={ArrowLeftRight} tone="warning" />
            <StatCard title="Saldo do caixa" value={brl(inflow - outflow)} icon={ArrowLeftRight} tone="gold" />
          </div>
        );
      }}
    />
  );
}