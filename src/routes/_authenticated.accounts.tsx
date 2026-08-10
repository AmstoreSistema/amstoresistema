import { createFileRoute } from "@tanstack/react-router";
import { Landmark, TrendingDown, TrendingUp } from "lucide-react";

import { CrudPage } from "@/components/crud-page";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Contas a Pagar e Receber — Amstore Gestão" },
      { name: "description", content: "Controle contas a pagar e a receber com vencimento, categoria e status de pagamento." },
      { property: "og:title", content: "Contas — Amstore Gestão" },
      { property: "og:description", content: "Organize as contas da loja e acompanhe o que vence." },
    ],
  }),
  component: AccountsPage,
});

type Account = {
  id: string;
  description: string;
  kind: string;
  amount: number;
  due_date: string | null;
  status: string;
  category: string | null;
};

function AccountsPage() {
  return (
    <CrudPage<Account>
      table="accounts"
      label="conta"
      title="Contas"
      description="Contas a pagar e a receber da loja."
      icon={Landmark}
      order={{ column: "due_date", ascending: true }}
      searchKeys={["description", "category"]}
      fields={[
        { name: "description", label: "Descrição", span: 2 },
        { name: "kind", label: "Tipo", type: "select", default: "pagar", options: [
          { value: "pagar", label: "A pagar" },
          { value: "receber", label: "A receber" },
        ] },
        { name: "amount", label: "Valor (R$)", type: "number", step: "0.01" },
        { name: "due_date", label: "Vencimento", type: "date" },
        { name: "status", label: "Situação", type: "select", default: "pendente", options: [
          { value: "pendente", label: "Pendente" },
          { value: "pago", label: "Pago" },
          { value: "atrasado", label: "Atrasado" },
        ] },
        { name: "category", label: "Categoria", placeholder: "Aluguel, insumos..." },
      ]}
      columns={[
        { key: "description", header: "Descrição", render: (r) => <span className="font-medium">{r.description}</span> },
        { key: "kind", header: "Tipo", render: (r) => (
          <Badge className={r.kind === "pagar" ? "bg-destructive/12 text-destructive hover:bg-destructive/12" : "bg-success/12 text-success hover:bg-success/12"}>
            {r.kind === "pagar" ? "A pagar" : "A receber"}
          </Badge>
        ) },
        { key: "amount", header: "Valor", render: (r) => <span className="tabular-nums">{brl(r.amount)}</span> },
        { key: "due", header: "Vencimento", render: (r) => dateBR(r.due_date) },
        { key: "status", header: "Situação", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
      ]}
      summary={(rows) => {
        const pay = rows.filter((r) => r.kind === "pagar" && r.status !== "pago").reduce((s, r) => s + Number(r.amount), 0);
        const rec = rows.filter((r) => r.kind === "receber" && r.status !== "pago").reduce((s, r) => s + Number(r.amount), 0);
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="A pagar em aberto" value={brl(pay)} icon={TrendingDown} tone="destructive" />
            <StatCard title="A receber em aberto" value={brl(rec)} icon={TrendingUp} tone="success" />
            <StatCard title="Saldo previsto" value={brl(rec - pay)} icon={Landmark} tone="gold" />
          </div>
        );
      }}
    />
  );
}