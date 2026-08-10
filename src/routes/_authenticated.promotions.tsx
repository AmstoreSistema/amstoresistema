import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, CheckCircle2 } from "lucide-react";

import { CrudPage } from "@/components/crud-page";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({
    meta: [
      { title: "Promoções — Amstore Gestão" },
      { name: "description", content: "Crie promoções com cupom, percentual de desconto e período de validade." },
      { property: "og:title", content: "Promoções — Amstore Gestão" },
      { property: "og:description", content: "Campanhas e cupons de desconto para a loja Amstore." },
    ],
  }),
  component: PromotionsPage,
});

type Promotion = {
  id: string;
  name: string;
  code: string | null;
  discount_percent: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

function PromotionsPage() {
  return (
    <CrudPage<Promotion>
      table="promotions"
      label="promoção"
      title="Promoções"
      description="Cupons e campanhas de desconto aplicáveis nas vendas."
      icon={BadgePercent}
      order={{ column: "created_at", ascending: false }}
      searchKeys={["name", "code"]}
      fields={[
        { name: "name", label: "Nome da promoção", span: 2 },
        { name: "code", label: "Cupom", placeholder: "AMSTORE10" },
        { name: "discount_percent", label: "Desconto (%)", type: "number", step: "0.01" },
        { name: "starts_at", label: "Início", type: "date" },
        { name: "ends_at", label: "Fim", type: "date" },
        { name: "active", label: "Ativa", type: "switch", default: true },
      ]}
      columns={[
        { key: "name", header: "Promoção", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "code", header: "Cupom", render: (r) => r.code ? <Badge variant="outline" className="font-mono">{r.code}</Badge> : "—" },
        { key: "discount", header: "Desconto", render: (r) => <span className="tabular-nums text-gold">{Number(r.discount_percent)}%</span> },
        { key: "period", header: "Período", render: (r) => `${dateBR(r.starts_at)} → ${dateBR(r.ends_at)}` },
        { key: "active", header: "Status", render: (r) => (
          <Badge className={r.active ? "bg-success/12 text-success hover:bg-success/12" : "bg-muted text-muted-foreground hover:bg-muted"}>
            {r.active ? "Ativa" : "Inativa"}
          </Badge>
        ) },
      ]}
      summary={(rows) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="Promoções cadastradas" value={rows.length} icon={BadgePercent} tone="dark" />
          <StatCard title="Ativas agora" value={rows.filter((r) => r.active).length} icon={CheckCircle2} tone="success" />
        </div>
      )}
    />
  );
}