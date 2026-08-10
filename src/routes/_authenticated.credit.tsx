import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HandCoins, Wallet } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useRows } from "@/lib/data";
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/credit")({
  head: () => ({
    meta: [
      { title: "Fiado — Amstore Gestão" },
      { name: "description", content: "Controle das vendas no fiado por cliente, com registro de pagamentos parciais e quitação." },
      { property: "og:title", content: "Fiado — Amstore Gestão" },
      { property: "og:description", content: "Quem deve, quanto deve e o histórico de pagamentos do fiado." },
    ],
  }),
  component: CreditPage,
});

type Sale = {
  id: string;
  client_id: string | null;
  total_amount: number;
  paid_amount: number;
  status: string | null;
  is_debt: boolean | null;
  created_at: string | null;
};
type Client = { id: string; name: string; phone: string | null };
type Payment = { id: string; sale_id: string; amount: number; created_at: string };

function CreditPage() {
  const qc = useQueryClient();
  const { data: sales = [], isLoading } = useRows<Sale>("sales", {
    order: { column: "created_at", ascending: false },
    filters: [{ column: "is_debt", value: true }],
  });
  const { data: clients = [] } = useRows<Client>("clients");
  const { data: payments = [] } = useRows<Payment>("debt_payments", { order: { column: "created_at", ascending: false } });

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const [target, setTarget] = useState<Sale | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = (s: Sale) => Number(s.total_amount) - Number(s.paid_amount);

  const openPayment = (sale: Sale) => {
    setTarget(sale);
    setAmount(String(remaining(sale).toFixed(2)));
  };

  const registerPayment = async () => {
    if (!target) return;
    const value = Number(amount || 0);
    if (value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      const paid = Number(target.paid_amount) + value;
      const settled = paid >= Number(target.total_amount) - 0.001;
      const { error } = await supabase.from("debt_payments").insert({ sale_id: target.id, amount: value });
      if (error) throw error;
      const { error: saleError } = await supabase
        .from("sales")
        .update({ paid_amount: paid, status: settled ? "pago" : "pendente" })
        .eq("id", target.id);
      if (saleError) throw saleError;
      const clientName = target.client_id ? clientById.get(target.client_id)?.name ?? "Cliente" : "Cliente";
      const { error: txError } = await supabase.from("transactions").insert({
        sale_id: target.id,
        amount: value,
        type: "entrada",
        description: `Recebimento de fiado — ${clientName}`,
      });
      if (txError) throw txError;
      await logAudit("recebimento_fiado", "sales", `Recebido ${brl(value)} de ${clientName}`, target.id);
      toast.success(settled ? "Fiado quitado" : "Pagamento parcial registrado");
      setTarget(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar o pagamento");
    } finally {
      setSaving(false);
    }
  };

  const openTotal = sales.filter((s) => s.status !== "pago").reduce((s, v) => s + remaining(v), 0);
  const receivedTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Fiado" description="Vendas a prazo, saldo devedor e recebimentos." icon={HandCoins} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total em aberto" value={brl(openTotal)} icon={Wallet} tone="warning" />
        <StatCard title="Já recebido" value={brl(receivedTotal)} icon={CheckCircle2} tone="success" />
        <StatCard title="Vendas no fiado" value={sales.length} icon={HandCoins} tone="dark" />
      </div>

      <DataTable
        rows={sales}
        loading={isLoading}
        empty="Nenhuma venda no fiado."
        columns={[
          { key: "client", header: "Cliente", render: (s) => (
            <div>
              <p className="font-medium">{s.client_id ? clientById.get(s.client_id)?.name ?? "—" : "—"}</p>
              <p className="text-xs text-muted-foreground">{dateTimeBR(s.created_at)}</p>
            </div>
          ) },
          { key: "total", header: "Total", render: (s) => <span className="tabular-nums">{brl(s.total_amount)}</span> },
          { key: "paid", header: "Pago", render: (s) => <span className="tabular-nums text-success">{brl(s.paid_amount)}</span> },
          { key: "rest", header: "Restante", render: (s) => <span className="tabular-nums font-semibold text-gold">{brl(remaining(s))}</span> },
          { key: "status", header: "Status", render: (s) => (
            <Badge className={s.status === "pago" ? "bg-success/12 text-success hover:bg-success/12" : "bg-warning/15 text-warning-foreground hover:bg-warning/15"}>
              {s.status === "pago" ? "Quitado" : "Em aberto"}
            </Badge>
          ) },
          { key: "actions", header: "", className: "text-right", render: (s) => s.status !== "pago" ? (
            <Button size="sm" onClick={() => openPayment(s)}>Registrar pagamento</Button>
          ) : null },
        ]}
      />

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Últimos recebimentos</h2>
        <DataTable
          rows={payments.slice(0, 10)}
          empty="Nenhum recebimento registrado."
          columns={[
            { key: "date", header: "Data", render: (p) => dateTimeBR(p.created_at) },
            { key: "client", header: "Cliente", render: (p) => {
              const sale = sales.find((s) => s.id === p.sale_id);
              return sale?.client_id ? clientById.get(sale.client_id)?.name ?? "—" : "—";
            } },
            { key: "amount", header: "Valor", className: "text-right", render: (p) => <span className="tabular-nums text-success">{brl(p.amount)}</span> },
          ]}
        />
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Saldo devedor: {target ? brl(remaining(target)) : ""}. O valor recebido entra nas transações.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block text-xs">Valor recebido (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button onClick={registerPayment} disabled={saving}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}