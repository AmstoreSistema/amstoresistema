import { createFileRoute } from "@tanstack/react-router";
import { Coins, Users } from "lucide-react";

import { CrudPage } from "@/components/crud-page";
import { StatCard } from "@/components/stat-card";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clientes — Amstore Gestão" },
      { name: "description", content: "Cadastro de clientes com contato, endereço, saldo de cashback e histórico de compras." },
      { property: "og:title", content: "Clientes — Amstore Gestão" },
      { property: "og:description", content: "Gerencie sua base de clientes, contatos e programa de cashback." },
    ],
  }),
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  cashback_balance: number;
};

function ClientsPage() {
  return (
    <CrudPage<Client>
      table="clients"
      label="cliente"
      title="Clientes"
      description="Sua base de clientes para vendas, fiado e cashback."
      icon={Users}
      order={{ column: "name", ascending: true }}
      searchKeys={["name", "phone", "email"]}
      fields={[
        { name: "name", label: "Nome", span: 2 },
        { name: "phone", label: "WhatsApp / Telefone", placeholder: "5511999999999" },
        { name: "email", label: "E-mail" },
        { name: "address", label: "Endereço", span: 2 },
        { name: "notes", label: "Observações", type: "textarea" },
      ]}
      columns={[
        { key: "name", header: "Cliente", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "phone", header: "Telefone", render: (r) => r.phone || "—" },
        { key: "email", header: "E-mail", render: (r) => r.email || "—" },
        { key: "cashback", header: "Cashback", render: (r) => <span className="tabular-nums text-gold">{brl(r.cashback_balance)}</span> },
      ]}
      summary={(rows) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard title="Clientes cadastrados" value={rows.length} icon={Users} tone="dark" />
          <StatCard
            title="Cashback acumulado"
            value={brl(rows.reduce((s, r) => s + Number(r.cashback_balance ?? 0), 0))}
            icon={Coins}
            tone="gold"
          />
        </div>
      )}
    />
  );
}