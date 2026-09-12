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

type Material = {
  id: string;
  name: string;
  type?: string;
  unit: string;
  current_stock: number;
  cost_price: number;
  width?: number | null;
  height?: number | null;
  thickness?: number | null;
};

type Purchase = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  supplier_name: string | null;
};

type PurchaseItemDraft = {
  material_id: string;
  quantity: number;
  cost: number;
  meters?: number;
  isMeter?: boolean;
};

const CUTTABLE_TYPES = ["Couro", "Estrutura", "Forro", "Tecido"];

const isCuttableOrMeter = (m?: Material | null) => {
  if (!m) return false;
  const typeLower = (m.type || "").toLowerCase().trim();
  const unitLower = (m.unit || "").toLowerCase().trim();
  const nameLower = (m.name || "").toLowerCase().trim();

  const isCuttableType = CUTTABLE_TYPES.some(t => typeLower.includes(t.toLowerCase()));
  const isMeterUnit = unitLower === "m" || unitLower === "metro" || unitLower === "metros";
  const hasKeyword = ["couro", "forro", "estrutura", "napa", "tecido", "sintetico", "sintético"].some(k => nameLower.includes(k));

  return isCuttableType || isMeterUnit || hasKeyword;
};

function PurchasesPage() {
  const qc = useQueryClient();
  const { data: purchases = [], isLoading } = useRows<Purchase>("purchases", { order: { column: "created_at", ascending: false } });
  const { data: materials = [] } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const { data: suppliers = [] } = useRows<any>("suppliers", { order: { column: "name", ascending: true } });
  const { data: accounts = [] } = useRows<{ id: string; active: boolean }>("financial_accounts");

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseItemDraft[]>([]);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("1");
  const [meters, setMeters] = useState("1");
  const [cost, setCost] = useState("0");
  const [saving, setSaving] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);

  const selectedMat = materials.find((m) => m.id === pick);

  const handleSelectMaterial = (id: string) => {
    setPick(id);
    const m = materials.find((mat) => mat.id === id);
    if (m) {
      if (m.cost_price && m.cost_price > 0) {
        setCost(m.cost_price.toString());
      }
      if (isCuttableOrMeter(m)) {
        setMeters("1");
      } else {
        setQty("1");
      }
    }
  };

  const addItem = () => {
    const mat = materials.find((m) => m.id === pick);
    if (!mat) {
      toast.error("Selecione um material");
      return;
    }

    const isMeter = isCuttableOrMeter(mat);
    const parsedCost = Number(cost) > 0 ? Number(cost) : (mat.cost_price || 0);

    if (isMeter) {
      const parsedMeters = Number(meters);
      if (!parsedMeters || parsedMeters <= 0) {
        toast.error("Informe a metragem comprada (em metros)");
        return;
      }

      setItems((curr) => [
        ...curr,
        {
          material_id: pick,
          quantity: parsedMeters,
          cost: parsedCost,
          meters: parsedMeters,
          isMeter: true,
        },
      ]);
      setMeters("1");
    } else {
      const parsedQty = Number(qty);
      if (!parsedQty || parsedQty <= 0) {
        toast.error("Informe a quantidade");
        return;
      }

      setItems((curr) => [
        ...curr,
        {
          material_id: pick,
          quantity: parsedQty,
          cost: parsedCost,
          isMeter: false,
        },
      ]);
      setQty("1");
    }

    setPick("");
    setCost("0");
  };

  const handleCancelPurchase = async (purchaseId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta compra? O estoque será estornado.")) return;
    
    try {
      const { error } = await supabase.rpc("cancel_purchase", { p_purchase_id: purchaseId });
      if (error) throw error;
      
      toast.success("Compra excluída e estoque estornado");
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["purchases"] }),
        qc.invalidateQueries({ queryKey: ["materials"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
        qc.invalidateQueries({ queryKey: ["financial_accounts"] }),
      ]);
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

      const itemsSummary = items
        .map(i => {
          const m = materials.find(mat => mat.id === i.material_id);
          return i.isMeter
            ? `${i.meters}m ${m?.name || 'Material'}`
            : `${i.quantity}${m?.unit || 'un'} ${m?.name || 'Item'}`;
        })
        .join(", ");

      // Transação atômica: compra + itens + estoque + lançamento financeiro
      const { data: purchaseId, error } = await supabase.rpc("create_complete_purchase", {
        p_items: items.map(i => ({
          material_id: i.material_id,
          quantity: i.quantity,
          unit_cost: i.cost,
        })) as any,
        p_supplier_id: supplierId || null,
        p_supplier_name: supplierName,
        p_account_id: activeAccount.id,
        p_category: selectedSupplier?.category || "Compra de Materiais",
        p_description: `Compra: ${itemsSummary}`,
      } as any);

      if (error) throw error;

      // Atualiza a medida do comprimento nos materiais de corte (Couro, Forro, Estrutura, Tecido)
      // Somando o tamanho comprado ao que já existe, sem alterar os cortes existentes.
      for (const item of items) {
        if (item.isMeter && item.meters && item.meters > 0) {
          const mat = materials.find(m => m.id === item.material_id);
          if (mat) {
            const isCm = (mat.height && mat.height > 20) || (mat.width && mat.width > 20);
            const addedLength = isCm ? item.meters * 100 : item.meters;
            const currentHeight = Number(mat.height) || 0;
            const newHeight = Number((currentHeight + addedLength).toFixed(2));

            const updatePayload: Record<string, any> = {
              height: newHeight,
              cost_price: item.cost,
            };

            // Se o material não tinha largura cadastrada, define uma padrão de 140cm (ou 1.40m)
            if (!mat.width) {
              updatePayload.width = isCm ? 140 : 1.4;
            }

            // Se a unidade estava como 'un' ou 'unidade', atualiza para 'm'
            if (mat.unit === "un" || mat.unit === "unidade") {
              updatePayload.unit = "m";
            }

            await supabase
              .from("materials")
              .update(updatePayload)
              .eq("id", mat.id);
          }
        }
      }

      await logAudit("compra", "purchases", `Compra recebida: ${supplierName} - Total ${brl(total)}`, purchaseId as unknown as string);

      toast.success("Compra registrada! O tamanho foi somado ao material e todos os cortes existentes foram preservados.");
      setOpen(false);
      setItems([]);
      setSupplierId("");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["financial_accounts"] });
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
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Compra</DialogTitle>
            <DialogDescription>A entrada de materiais aumentará o estoque e o tamanho disponível automaticamente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full h-11 rounded-xl">
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bloco de Adicionar Item à Compra */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Material</Label>
                <Select value={pick} onValueChange={handleSelectMaterial}>
                  <SelectTrigger className="w-full h-11 rounded-xl bg-background">
                    <SelectValue placeholder="Selecione o material a comprar..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {isCuttableOrMeter(m) ? `(por metro · ${m.type || "Corte"})` : `(${m.unit})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMat && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                  {isCuttableOrMeter(selectedMat) ? (
                    /* Bloco específico para materiais por metro (Couro, Forro, Estrutura, Tecido, etc.) */
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[10px] uppercase font-bold px-2 py-0.5">
                            Material por Metro / Corte
                          </Badge>
                          <span className="text-xs text-blue-950 font-bold">{selectedMat.name}</span>
                        </div>
                        {selectedMat.width ? (
                          <span className="text-[11px] font-medium text-blue-800">
                            Largura padrão da peça: <strong>{selectedMat.width > 20 ? `${selectedMat.width} cm` : `${selectedMat.width} m`}</strong>
                          </span>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <Label className="mb-1.5 block text-xs font-bold text-gray-800">
                            Metros comprados (m) *
                          </Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            placeholder="Ex: 5 ou 2.5" 
                            value={meters} 
                            onChange={(e) => setMeters(e.target.value)}
                            className="h-10 bg-white rounded-lg border-blue-200 focus-visible:ring-blue-500 font-semibold"
                            autoFocus
                          />
                        </div>

                        <div>
                          <Label className="mb-1.5 block text-xs font-bold text-gray-800">
                            Custo por Metro (R$) *
                          </Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={cost} 
                            onChange={(e) => setCost(e.target.value)}
                            className="h-10 bg-white rounded-lg border-blue-200 focus-visible:ring-blue-500 font-semibold"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                              Subtotal
                            </Label>
                            <div className="h-10 flex items-center px-3 rounded-lg bg-white border border-blue-200 font-bold text-sm text-green-600">
                              {brl((Number(meters) || 0) * (Number(cost) || 0))}
                            </div>
                          </div>
                          <Button 
                            onClick={addItem} 
                            type="button" 
                            className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg px-4"
                          >
                            Adicionar
                          </Button>
                        </div>
                      </div>

                      {/* Notificação visual garantindo a preservação dos cortes */}
                      <div className="text-[11px] text-blue-900 bg-white/90 p-2.5 rounded-lg border border-blue-100 flex items-start gap-2">
                        <CheckCircle2 className="size-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span>
                            A metragem informada (<strong className="font-bold">{Number(meters) || 0} metros</strong>) será somada ao comprimento da peça e ao estoque. 
                          </span>
                          <span className="block text-blue-700 font-medium mt-0.5">
                            ✓ Todos os cortes existentes (utilizados e disponíveis) serão 100% preservados intactos.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Bloco padrão para materiais convencionais (unidades, pares, etc.) */
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <Label className="mb-1.5 block text-xs font-bold">
                          Quantidade ({selectedMat.unit || 'un'}) *
                        </Label>
                        <Input 
                          type="number" 
                          step="1" 
                          min="1" 
                          value={qty} 
                          onChange={(e) => setQty(e.target.value)}
                          className="h-10 bg-background rounded-lg" 
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs font-bold">
                          Custo Unitário (R$) *
                        </Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          value={cost} 
                          onChange={(e) => setCost(e.target.value)}
                          className="h-10 bg-background rounded-lg" 
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                            Subtotal
                          </Label>
                          <div className="h-10 flex items-center px-3 rounded-lg bg-background border font-bold text-sm text-green-600">
                            {brl((Number(qty) || 0) * (Number(cost) || 0))}
                          </div>
                        </div>
                        <Button 
                          onClick={addItem} 
                          type="button" 
                          variant="outline" 
                          className="h-10 font-bold rounded-lg px-4"
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="max-h-56 overflow-auto border rounded-xl">
              <DataTable
                rows={items}
                rowKey={(i) => i.material_id}
                columns={[
                  { 
                    key: "name", 
                    header: "Material", 
                    render: (i) => {
                      const mat = materials.find(m => m.id === i.material_id);
                      return (
                        <div>
                          <p className="font-semibold text-xs text-foreground">{mat?.name || "Item"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{mat?.type || mat?.unit}</p>
                        </div>
                      );
                    }
                  },
                  { 
                    key: "qty", 
                    header: "Medida / Qtd", 
                    render: (i) => {
                      if (i.isMeter) {
                        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-bold">{i.meters} m</Badge>;
                      }
                      const mat = materials.find(m => m.id === i.material_id);
                      return <span className="font-medium text-xs">{i.quantity} {mat?.unit || 'un'}</span>;
                    } 
                  },
                  { 
                    key: "cost", 
                    header: "Custo Unit.", 
                    render: (i) => <span className="text-xs text-muted-foreground">{brl(i.cost)}{i.isMeter ? '/m' : ''}</span> 
                  },
                  { 
                    key: "total", 
                    header: "Total", 
                    render: (i) => <span className="font-bold text-xs text-foreground">{brl(i.quantity * i.cost)}</span> 
                  },
                  { 
                    key: "actions", 
                    header: "", 
                    className: "text-right",
                    render: (i) => (
                      <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => setItems(curr => curr.filter(x => x.material_id !== i.material_id))}>
                        <Trash2 className="size-4" />
                      </Button>
                    )
                  }
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
