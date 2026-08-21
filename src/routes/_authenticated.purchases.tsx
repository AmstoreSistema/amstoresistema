import { createFileRoute } from "@tanstack/react-router";
import { Truck, ShoppingCart, Plus, CheckCircle2, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { SupplierPurchasesModal } from "@/components/suppliers/SupplierPurchasesModal";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({
    meta: [
      { title: "Compras de Materiais — Amstore Gestão" },
      { name: "description", content: "Registre a compra de matéria-prima, aumentando o estoque e gerando contas a pagar." },
      { property: "og:title", content: "Compras — Amstore Gestão" },
      { property: "og:description", content: "Gestão de compras: entrada de materiais e lançamento financeiro automático." },
    ],
  }),
  component: PurchasesPage,
});

type Material = { id: string; name: string; unit: string; current_stock: number; cost_price: number };
type Purchase = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  supplier_name: string | null;
};

function PurchasesPage() {
  const qc = useQueryClient();
  const { data: purchases = [], isLoading } = useRows<Purchase>("purchases", { order: { column: "created_at", ascending: false } });
  const { data: materials = [] } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const { data: suppliers = [] } = useRows<any>("suppliers", { order: { column: "name", ascending: true } });
  const { data: accounts = [] } = useRows<{ id: string; active: boolean }>("financial_accounts");

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<{ material_id: string; quantity: number; cost: number }[]>([]);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);

  const addItem = () => {
    const mat = materials.find((m) => m.id === pick);
    if (!mat) return;
    setItems((curr) => [...curr, { material_id: pick, quantity: Number(qty), cost: Number(cost || mat.cost_price) }]);
    setPick("");
    setQty("1");
    setCost("0");
  };

  const handleCancelPurchase = async (purchaseId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta compra? O estoque será estornado.")) return;
    
    try {
      const { error } = await supabase.rpc("cancel_purchase", { p_purchase_id: purchaseId });
      if (error) throw error;
      
      toast.success("Compra excluída e estoque estornado");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir compra");
    }
  };

  const finalize = async () => {
    if (items.length === 0) {
      toast.error("Adicione itens à compra");
      return;
    }
    setSaving(true);
    try {
      const selectedSupplier = suppliers.find(s => s.id === supplierId);
      const supplierName = selectedSupplier?.name || "Fornecedor não informado";
      const activeAccount = accounts.find(a => a.active);

      if (!activeAccount) {
        toast.error("Nenhuma conta financeira ativa encontrada para lançar a despesa");
        setSaving(false);
        return;
      }

      const total = items.reduce((s, i) => s + i.quantity * i.cost, 0);
      
      const { data: purchase, error } = await supabase
        .from("purchases")
        .insert({
          total_amount: total,
          supplier_name: supplierName,
          supplier_id: supplierId || null,
          status: "recebido",
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar itens da compra e atualizar estoque
      for (const item of items) {
        const mat = materials.find((m) => m.id === item.material_id);
        if (!mat) continue;
        
        // Inserir item da compra (isso dispara a trigger de atualização de custo se for maior)
        const { error: itemError } = await supabase
          .from("purchase_items")
          .insert({
            purchase_id: purchase.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit_cost: item.cost,
            previous_cost: mat.cost_price || 0
          });

        if (itemError) throw itemError;

        // Atualizar estoque
        const nextStock = Number(mat.current_stock) + item.quantity;
        const { error: matError } = await supabase
          .from("materials")
          .update({ current_stock: nextStock })
          .eq("id", item.material_id);
        
        if (matError) throw matError;
      }

      const itemsSummary = items
        .map(i => {
          const m = materials.find(mat => mat.id === i.material_id);
          return `${i.quantity}${m?.unit || 'un'} ${m?.name || 'Item'}`;
        })
        .join(", ");

      const { error: txError } = await supabase.from("transactions").insert({
        amount: Math.abs(total),
        type: "saida",
        description: `Compra: ${itemsSummary}`,
        account_id: activeAccount.id,
        category: "Compra de Materiais",
        status: "pago",
        due_date: new Date().toISOString().split('T')[0],
        client_id: null,
        supplier_id: supplierId || null,
        purchase_id: purchase.id
      } as any);

      if (txError) throw txError;

      await logAudit("compra", "purchases", `Compra recebida: ${supplierName} - Total ${brl(total)}`, purchase.id);
      
      toast.success("Compra registrada, estoque atualizado (custo ajustado se maior) e despesa lançada");
      setOpen(false);
      setItems([]);
      setSupplierId("");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compras"
        description="Recebimento de matéria-prima e atualização de custos."
        icon={Truck}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="size-4" /> Nova compra
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Compras este mês" value={purchases.length} icon={Truck} tone="gold" />
        <StatCard title="Investido em materiais" value={brl(purchases.reduce((s, p) => s + Number(p.total_amount), 0))} icon={ShoppingCart} tone="dark" />
        <StatCard title="Status Médio" value="Ativo" icon={CheckCircle2} tone="success" />
      </div>

      <DataTable
        rows={purchases}
        loading={isLoading}
        columns={[
          { key: "created_at", header: "Data", render: (p) => dateTimeBR(p.created_at) },
          { key: "supplier", header: "Fornecedor", render: (p) => p.supplier_name || "—" },
          { key: "status", header: "Status", render: (p) => <Badge variant="secondary">{p.status}</Badge> },
          { key: "total", header: "Total", className: "text-right", render: (p) => <span className="font-semibold tabular-nums">{brl(p.total_amount)}</span> },
          { 
            key: "actions", 
            header: "", 
            className: "text-right",
            render: (p) => (
              <div className="flex justify-end gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => {
                    const sup = suppliers.find(s => s.id === (p as any).supplier_id || s.name === (p as any).supplier_name);
                    setViewingPurchase({ ...p, supplier: sup || { name: (p as any).supplier_name, id: (p as any).supplier_id } });
                  }}
                >
                  <Eye className="size-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="text-destructive" 
                  onClick={() => handleCancelPurchase(p.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) 
          },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Compra</DialogTitle>
            <DialogDescription>A entrada de materiais aumentará o estoque automaticamente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs">Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <div className="min-w-[200px] flex-1">
                <Label className="mb-1.5 block text-xs">Material</Label>
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="mb-1.5 block text-xs">Qtd</Label>
                <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="w-28">
                <Label className="mb-1.5 block text-xs">Custo Unit.</Label>
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <Button onClick={addItem} type="button" variant="outline">Adicionar</Button>
            </div>

            <div className="max-h-48 overflow-auto">
              <DataTable
                rows={items}
                rowKey={(i) => i.material_id}
                columns={[
                  { key: "name", header: "Material", render: (i) => materials.find(m => m.id === i.material_id)?.name },
                  { key: "qty", header: "Qtd", render: (i) => i.quantity },
                  { key: "total", header: "Total", render: (i) => brl(i.quantity * i.cost) },
                  { key: "actions", header: "", render: (i) => (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setItems(curr => curr.filter(x => x.material_id !== i.material_id))}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                ]}
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex flex-1 items-center font-semibold text-gold">
              Total: {brl(items.reduce((s, i) => s + i.quantity * i.cost, 0))}
            </div>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={finalize} disabled={saving}>Finalizar Compra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierPurchasesModal 
        open={!!viewingPurchase}
        onOpenChange={(open) => !open && setViewingPurchase(null)}
        supplier={viewingPurchase?.supplier}
      />
    </div>
  );
}
