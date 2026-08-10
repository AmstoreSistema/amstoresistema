import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Receipt, ShoppingCart, Trash2, Wallet } from "lucide-react";
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
import { brl, dateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Vendas — Amstore Gestão" },
      { name: "description", content: "Registre vendas escolhendo cliente e produtos, com baixa automática de estoque e lançamento no caixa." },
      { property: "og:title", content: "Vendas — Amstore Gestão" },
      { property: "og:description", content: "PDV da Amstore: venda à vista, no cartão, no pix ou no fiado." },
    ],
  }),
  component: SalesPage,
});

type Product = { id: string; name: string; sale_price: number | null; current_stock: number | null };
type Client = { id: string; name: string; cashback_balance: number };
type Sale = {
  id: string;
  client_id: string | null;
  total_amount: number;
  discount: number;
  payment_method: string;
  is_debt: boolean | null;
  paid_amount: number;
  status: string | null;
  created_at: string | null;
};
type Setting = { key: string; value: string | null };

type CartItem = { product_id: string; quantity: number; unit_price: number };

const PAYMENTS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "fiado", label: "Fiado" },
];

function SalesPage() {
  const qc = useQueryClient();
  const { data: sales = [], isLoading } = useRows<Sale>("sales", { order: { column: "created_at", ascending: false } });
  const { data: products = [] } = useRows<Product>("products", { order: { column: "name", ascending: true } });
  const { data: clients = [] } = useRows<Client>("clients", { order: { column: "name", ascending: true } });
  const { data: settings = [] } = useRows<Setting>("app_settings");

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [payment, setPayment] = useState("dinheiro");
  const [discount, setDiscount] = useState("0");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const cashbackPercent = Number(settings.find((s) => s.key === "cashback_percent")?.value ?? 0);

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const addToCart = () => {
    const product = productById.get(pick);
    if (!product) {
      toast.error("Escolha um produto");
      return;
    }
    setCart((current) => {
      const found = current.find((i) => i.product_id === product.id);
      if (found) {
        return current.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...current, { product_id: product.id, quantity: 1, unit_price: Number(product.sale_price ?? 0) }];
    });
    setPick("");
  };

  const changeQty = (id: string, delta: number) =>
    setCart((current) =>
      current
        .map((i) => (i.product_id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );

  const resetForm = () => {
    setCart([]);
    setClientId("");
    setPayment("dinheiro");
    setDiscount("0");
    setPick("");
  };

  const finalize = async () => {
    if (cart.length === 0) {
      toast.error("Adicione ao menos um produto");
      return;
    }
    const isDebt = payment === "fiado";
    if (isDebt && !clientId) {
      toast.error("Venda no fiado exige um cliente selecionado");
      return;
    }
    const insufficient = cart.find((i) => Number(productById.get(i.product_id)?.current_stock ?? 0) < i.quantity);
    if (insufficient) {
      toast.error(`Estoque insuficiente para ${productById.get(insufficient.product_id)?.name}`);
      return;
    }

    setSaving(true);
    try {
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          client_id: clientId || null,
          total_amount: total,
          discount: Number(discount || 0),
          payment_method: payment,
          is_debt: isDebt,
          paid_amount: isDebt ? 0 : total,
          status: isDebt ? "pendente" : "pago",
        })
        .select()
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("sale_items").insert(
        cart.map((i) => ({
          sale_id: sale.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      );
      if (itemsError) throw itemsError;

      for (const item of cart) {
        const product = productById.get(item.product_id);
        const next = Number(product?.current_stock ?? 0) - item.quantity;
        const { error: stockError } = await supabase
          .from("products")
          .update({ current_stock: next < 0 ? 0 : next })
          .eq("id", item.product_id);
        if (stockError) throw stockError;
      }

      const clientName = clientId ? clientById.get(clientId)?.name ?? "Cliente" : "Consumidor final";
      const { error: txError } = await supabase.from("transactions").insert({
        sale_id: sale.id,
        amount: total,
        type: isDebt ? "fiado" : "entrada",
        description: isDebt ? `Venda no fiado — ${clientName}` : `Venda ${PAYMENTS.find((p) => p.value === payment)?.label} — ${clientName}`,
      });
      if (txError) throw txError;

      if (!isDebt && clientId && cashbackPercent > 0) {
        const credit = (total * cashbackPercent) / 100;
        await supabase.from("cashback_entries").insert({
          client_id: clientId,
          amount: credit,
          kind: "credito",
          description: `Cashback de ${cashbackPercent}% sobre a venda`,
        });
        await supabase
          .from("clients")
          .update({ cashback_balance: Number(clientById.get(clientId)?.cashback_balance ?? 0) + credit })
          .eq("id", clientId);
      }

      await logAudit("venda", "sales", `Venda finalizada (${payment}) de ${brl(total)} para ${clientName}`, sale.id);
      toast.success(isDebt ? "Venda lançada no fiado e nas transações" : "Venda finalizada e estoque atualizado");
      setOpen(false);
      resetForm();
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao finalizar a venda");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toDateString();
  const salesToday = sales.filter((s) => s.created_at && new Date(s.created_at).toDateString() === today);
  const debtOpen = sales.filter((s) => s.is_debt && s.status !== "pago");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Finalize vendas com baixa de estoque e lançamento automático no caixa."
        icon={ShoppingCart}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" /> Nova venda
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Vendas hoje" value={salesToday.length} icon={ShoppingCart} tone="gold" />
        <StatCard title="Faturado hoje" value={brl(salesToday.reduce((s, v) => s + Number(v.total_amount), 0))} icon={Receipt} tone="success" />
        <StatCard title="Total de vendas" value={sales.length} icon={Receipt} tone="dark" />
        <StatCard title="Fiado em aberto" value={brl(debtOpen.reduce((s, v) => s + (Number(v.total_amount) - Number(v.paid_amount)), 0))} icon={Wallet} tone="warning" />
      </div>

      <DataTable
        rows={sales}
        loading={isLoading}
        empty="Nenhuma venda registrada ainda."
        columns={[
          { key: "date", header: "Data", render: (s) => dateTimeBR(s.created_at) },
          { key: "client", header: "Cliente", render: (s) => (
            <span className="font-medium">{s.client_id ? clientById.get(s.client_id)?.name ?? "—" : "Consumidor final"}</span>
          ) },
          { key: "payment", header: "Pagamento", render: (s) => (
            <Badge variant="secondary">{PAYMENTS.find((p) => p.value === s.payment_method)?.label ?? s.payment_method}</Badge>
          ) },
          { key: "status", header: "Status", render: (s) => (
            <Badge className={s.status === "pago" ? "bg-success/12 text-success hover:bg-success/12" : "bg-warning/15 text-warning-foreground hover:bg-warning/15"}>
              {s.status === "pago" ? "Pago" : "Pendente"}
            </Badge>
          ) },
          { key: "total", header: "Total", className: "text-right", render: (s) => (
            <span className="tabular-nums font-semibold">{brl(s.total_amount)}</span>
          ) },
        ]}
      />

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova venda</DialogTitle>
            <DialogDescription>Escolha o cliente, os produtos e finalize para dar baixa no estoque.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Consumidor final" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Forma de pagamento</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <div className="min-w-[200px] flex-1">
              <Label className="mb-1.5 block text-xs">Produto</Label>
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {brl(p.sale_price ?? 0)} · estoque {Number(p.current_stock ?? 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addToCart} className="gap-1">
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>

          <div className="max-h-60 overflow-auto">
            <DataTable
              rows={cart}
              rowKey={(i) => i.product_id}
              empty="Carrinho vazio."
              columns={[
                { key: "product", header: "Produto", render: (i) => productById.get(i.product_id)?.name ?? "—" },
                { key: "qty", header: "Qtd", render: (i) => (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="size-7" onClick={() => changeQty(i.product_id, -1)}>
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-8 text-center tabular-nums">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="size-7" onClick={() => changeQty(i.product_id, 1)}>
                      <Plus className="size-3" />
                    </Button>
                  </div>
                ) },
                { key: "price", header: "Unitário", render: (i) => brl(i.unit_price) },
                { key: "subtotal", header: "Subtotal", render: (i) => <span className="tabular-nums font-medium">{brl(i.quantity * i.unit_price)}</span> },
                { key: "actions", header: "", className: "w-12 text-right", render: (i) => (
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setCart((c) => c.filter((x) => x.product_id !== i.product_id))}>
                    <Trash2 className="size-4" />
                  </Button>
                ) },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs">Desconto (R$)</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-gold">{brl(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={finalize} disabled={saving}>
              {payment === "fiado" ? "Finalizar no fiado" : "Finalizar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}