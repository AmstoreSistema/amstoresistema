import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search,
  MoreVertical,
  Package,
  Calendar,
  Construction
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useRows, logAudit } from "@/lib/data";
import { dateBR, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/production-orders")({
  component: ProductionOrdersPage,
});

type ProductionOrder = {
  id: string;
  codigo_ordem: string;
  product_id: string;
  product_name: string;
  quantity: number;
  status: "rascunho" | "em_producao" | "concluida" | "cancelado";
  priority: "baixa" | "media" | "alta";
  expected_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  materials_deducted: boolean;
  notes: string | null;
  created_at: string;
};

type Product = { id: string; name: string };

function ProductionOrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useRows<ProductionOrder>("production_orders", { 
    order: { column: "created_at", ascending: false } 
  });
  const { data: products = [] } = useRows<Product>("products");

  const [term, setTerm] = useState("");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({ 
    product_id: "", 
    quantity: 1, 
    priority: "media" as const,
    expected_date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const filtered = useMemo(() => {
    return orders.filter(o => o.codigo_ordem.toLowerCase().includes(term.toLowerCase()) || o.product_name.toLowerCase().includes(term.toLowerCase()));
  }, [orders, term]);

  const stats = useMemo(() => ({
    total: orders.length,
    inProduction: orders.filter(o => o.status === "em_producao").length,
    completed: orders.filter(o => o.status === "concluida").length,
  }), [orders]);

  const createOrder = async () => {
    if (!newOrder.product_id) { toast.error("Selecione um produto"); return; }
    
    const product = products.find(p => p.id === newOrder.product_id);
    
    const { error } = await supabase.from("production_orders").insert({
      codigo_ordem: `OP-${Date.now()}`,
      product_id: newOrder.product_id,
      product_name: product?.name || "Produto",
      quantity: newOrder.quantity,
      priority: newOrder.priority,
      expected_date: newOrder.expected_date,
      notes: newOrder.notes,
      status: "rascunho"
    });

    if (error) { toast.error(error.message); return; }
    setNewOrderOpen(false);
    qc.invalidateQueries();
    toast.success("Ordem criada!");
  };

  const updateStatus = async (order: ProductionOrder, status: ProductionOrder["status"]) => {
    // Logic for state transitions and material deduction would go here (or in a server function for atomicity)
    const { error } = await supabase.from("production_orders").update({ status }).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
    toast.success("Status atualizado");
  };

  const getPriorityBadge = (p: string) => {
    const colors: Record<string, string> = { "baixa": "bg-blue-100 text-blue-600", "media": "bg-yellow-100 text-yellow-600", "alta": "bg-red-100 text-red-600" };
    return <Badge className={`border-none ${colors[p]}`}>{p.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Ordens de Produção" 
        description="Gestão de fluxo de fábrica"
        icon={Construction}
        actions={
          <Button onClick={() => setNewOrderOpen(true)} className="gap-2 bg-orange-500 text-white hover:bg-orange-600 font-bold">
            <Plus className="size-4" /> Nova Ordem
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total" value={stats.total} icon={Package} tone="dark" />
        <StatCard title="Em Produção" value={stats.inProduction} icon={Play} tone="warning" />
        <StatCard title="Concluídas" value={stats.completed} icon={CheckCircle2} tone="success" />
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por código ou produto..." className="pl-10" value={term} onChange={e => setTerm(e.target.value)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(order => (
          <Card key={order.id} className="rounded-3xl border-border/50 bg-card">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{order.codigo_ordem}</h3>
                  <p className="text-sm text-muted-foreground">{order.product_name}</p>
                </div>
                {getPriorityBadge(order.priority)}
              </div>
              
              <div className="flex justify-between items-center text-sm mb-4">
                <span className="text-muted-foreground">Qtd: {num(order.quantity)}</span>
                <Badge variant="outline" className="text-orange-500 border-orange-500/20 bg-orange-500/5">{order.status.toUpperCase()}</Badge>
              </div>

              <div className="flex justify-end gap-2">
                {order.status === "rascunho" && <Button size="sm" variant="outline" onClick={() => updateStatus(order, "em_producao")}>Iniciar</Button>}
                {order.status === "em_producao" && <Button size="sm" onClick={() => updateStatus(order, "concluida")}>Concluir</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Ordem</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Produto</Label>
              <Select value={newOrder.product_id} onValueChange={v => setNewOrder({ ...newOrder, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantidade</Label>
                <Input type="number" value={newOrder.quantity} onChange={e => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={newOrder.priority} onValueChange={(v: any) => setNewOrder({ ...newOrder, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={newOrder.notes} onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createOrder}>Salvar Ordem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
