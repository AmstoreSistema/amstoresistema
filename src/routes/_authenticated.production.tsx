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
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRows, logAudit } from "@/lib/data";
import { dateBR, num } from "@/lib/format";
import { processProductionCompletion, deleteProductionOrder, startProduction, cancelProduction } from "@/lib/production.functions";
import { ProductionDocument } from "@/components/production/ProductionDocument";


export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({
    meta: [
      { title: "Produção — Amstore Gestão" },
      { name: "description", content: "Gerencie ordens de produção e estoque de materiais." },
    ],
  }),
  component: ProductionPage,
});

type ProductionOrder = {
  id: string;
  product_id: string | null;
  produto_nome: string | null;
  codigo_ordem: string | null;
  quantity: number;
  status: "pending" | "ongoing" | "completed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  data_prevista: string | null;
  created_at: string;
  priority: "Baixa" | "Normal" | "Alta" | "Urgente";
  notes: string | null;
  materiais_baixados: boolean;
};

type Product = { id: string; name: string; category: string; image_url: string | null };

function ProductionPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useRows<ProductionOrder>("production_orders", { 
    order: { column: "created_at", ascending: false } 
  });
  const { data: products = [] } = useRows<Product>("products");

  const [term, setTerm] = useState("");
  const [activeStatus, setActiveStatus] = useState("Todos");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrder, setNewOrder] = useState<{
    product_id: string;
    quantity: number;
    priority: "Normal" | "Baixa" | "Alta" | "Urgente";
    data_prevista: string | null;
    notes: string;
  }>({ 
    product_id: "", 
    quantity: 1, 
    priority: "Normal",
    data_prevista: new Date().toISOString().split('T')[0] as string | null,
    notes: "" 
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrder | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [selectedOrderDoc, setSelectedOrderDoc] = useState<ProductionOrder | null>(null);
  const [orderComposition, setOrderComposition] = useState<any[]>([]);
  const [nextCode, setNextCode] = useState("");

  const openNewOrder = () => {
    setNextCode(`OP-${Date.now()}`);
    setNewOrderOpen(true);
  };


  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const productName = productById.get(o.product_id as string)?.name || "";
      const matchesTerm = productName.toLowerCase().includes(term.toLowerCase());
      const matchesStatus = activeStatus === "Todos" || 
        (activeStatus === "Ativas" && ["pending", "ongoing"].includes(o.status)) ||
        (activeStatus === "Concluídas" && o.status === "completed");
      return matchesTerm && matchesStatus;
    });
  }, [orders, term, activeStatus, productById]);

  const stats = useMemo(() => {
    return {
      pending: orders.filter(o => o.status === "pending").length,
      ongoing: orders.filter(o => o.status === "ongoing").length,
      completedToday: orders.filter(o => o.status === "completed" && (o.completed_at || "").split('T')[0] === new Date().toISOString().split('T')[0]).length,
    };
  }, [orders]);

  const createOrder = async () => {
    if (!newOrder.product_id) {
      toast.error("Selecione um produto");
      return;
    }

    const product = productById.get(newOrder.product_id);
    const codigo_ordem = nextCode || `OP-${Date.now()}`;

    const { error } = await supabase.from("production_orders").insert({
      product_id: newOrder.product_id,
      produto_nome: product?.name || "Produto",
      quantity: newOrder.quantity,
      priority: newOrder.priority,
      status: "pending",
      codigo_ordem,
      data_prevista: newOrder.data_prevista,
      notes: newOrder.notes,
      materiais_baixados: false
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    
    await logAudit("producao", "production_orders", `Nova ordem ${codigo_ordem} criada para ${product?.name}`, newOrder.product_id);
    setNewOrderOpen(false);
    qc.invalidateQueries();
    toast.success("Ordem de produção criada!");
  };

  const updateStatus = async (order: any, newStatus: string) => {
    if (newStatus === "ongoing") {
      try {
        toast.loading("Iniciando produção e baixando materiais...", { id: "prod-action" });
        await startProduction({ data: { orderId: order.id } });
        toast.success("Produção iniciada!", { id: "prod-action" });
        qc.invalidateQueries();
      } catch (err: any) {
        toast.error(err.message || "Erro ao iniciar", { id: "prod-action" });
      }
      return;
    }

    if (newStatus === "completed") {
      try {
        toast.loading("Processando baixa de materiais e entrada de estoque...", { id: "production-loading" });
        await processProductionCompletion({ data: { orderId: order.id } });
        toast.success(`Produção de ${order.quantity} unidade(s) concluída com sucesso!`, { id: "production-loading" });
        qc.invalidateQueries();
        await logAudit("producao", "production_orders", `Ordem ${order.id} concluída. Estoque atualizado.`);
        
        // Abrir o DANFE automaticamente ao concluir
        const { data: composition } = await supabase
          .from("product_materials")
          .select("*")
          .eq("product_id", order.product_id);
        
        setSelectedOrderDoc({ ...order, status: 'completed', completed_at: new Date().toISOString() });
        setOrderComposition(composition || []);
        setDocumentOpen(true);
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Erro ao concluir produção", { id: "production-loading" });
      }
      return;
    }

    const updates: Partial<ProductionOrder> = { status: newStatus as any };
    if (newStatus === "ongoing") updates.started_at = new Date().toISOString();

    const { error } = await supabase.from("production_orders").update(updates).eq("id", order.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit("producao", "production_orders", `Status da ordem ${order.id} alterado para ${newStatus}`);
    qc.invalidateQueries();
    toast.success(`Ordem atualizada para ${newStatus}`);
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      toast.loading("Excluindo ordem e estornando materiais...", { id: "delete-loading" });
      await deleteProductionOrder({ data: { orderId: orderToDelete.id } });
      
      const productName = productById.get(orderToDelete.product_id as string)?.name || "Produto";
      await logAudit("producao", "production_orders", `Ordem de produção de ${productName} excluída/estornada`);
      
      qc.invalidateQueries();
      toast.success("Ordem excluída com sucesso!", { id: "delete-loading" });
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao excluir ordem", { id: "delete-loading" });
    }
  };

  const openDocument = async (order: ProductionOrder) => {
    setSelectedOrderDoc(order);
    
    // Buscar a composição do produto no momento da ordem
    if (order.product_id) {
      const { data } = await supabase
        .from("product_materials")
        .select("*")
        .eq("product_id", order.product_id);
      
      setOrderComposition(data || []);
    }
    
    setDocumentOpen(true);
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="border-gold/50 text-gold bg-gold/5">Pendente</Badge>;
      case "ongoing": return <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Em Produção</Badge>;
      case "completed": return <Badge variant="outline" className="border-success/50 text-success bg-success/5">Concluído</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (p: string) => {
    const colors: Record<string, string> = {
      "Baixa": "bg-slate-100 text-slate-600",
      "Normal": "bg-blue-100 text-blue-600",
      "Alta": "bg-orange-100 text-orange-600",
      "Urgente": "bg-red-100 text-red-600",
    };
    return <Badge className={`border-none ${colors[p] || colors['Normal']}`}>{p}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Produção" 
        description="Gerência de produção"
        icon={Package}
        actions={
          <Button onClick={openNewOrder} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
            <Plus className="size-4" /> Nova Ordem
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Ordens Pendentes" value={stats.pending} icon={Clock} tone="gold" />
        <StatCard title="Em Execução" value={stats.ongoing} icon={Play} tone="gold" />
        <StatCard title="Concluídas Hoje" value={stats.completedToday} icon={CheckCircle2} tone="success" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {["Todos", "Ativas", "Concluídas"].map(s => (
            <Button 
              key={s} 
              variant={activeStatus === s ? "default" : "outline"} 
              size="sm"
              onClick={() => setActiveStatus(s)}
              className="rounded-full px-4"
            >
              {s}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar ordem..." 
            className="pl-10"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-3xl bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(order => {
            const product = productById.get(order.product_id as string);
            return (
              <Card key={order.id} className="overflow-hidden rounded-3xl border-border/50 bg-card transition-all hover:shadow-lg">
                <CardContent className="p-0">
                  <div className="flex p-5 gap-4">
                    <div className="size-16 rounded-2xl bg-muted overflow-hidden flex-shrink-0">
                      {product?.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                          <Package className="size-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold truncate text-lg">{product?.name || "Produto excluído"}</h3>
                          <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <span className="font-bold text-gold/80">#</span> {order.codigo_ordem}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">{product?.category}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Ordem:</span>
                          <span className="font-mono font-bold text-xs">{order.codigo_ordem}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Qtd:</span>
                          <span className="font-bold">{num(order.quantity, 0)} un</span>
                        </div>
                      {getPriorityBadge(order.priority)}
                    </div>

                    <div className="space-y-2 rounded-2xl bg-muted/30 p-3 text-[11px]">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="size-3" /> Previsão:
                        </div>
                        <span className="font-medium">{order.data_prevista ? dateBR(order.data_prevista) : "Não definida"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Plus className="size-3" /> Criada:
                        </div>
                        <span className="font-medium text-muted-foreground/70">{dateBR(order.created_at)}</span>
                      </div>
                      {order.started_at && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="size-3" /> Iniciada:
                          </div>
                          <span className="font-medium">{dateBR(order.started_at)}</span>
                        </div>
                      )}
                      {order.completed_at && (
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-success">
                            <CheckCircle2 className="size-3" /> Concluída:
                          </div>
                          <span className="font-medium text-success">{dateBR(order.completed_at)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {getStatusBadge(order.status)}
                      <div className="flex gap-1">
                        {order.status === "pending" && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider border-gold/30 hover:bg-gold/10"
                            onClick={() => updateStatus(order, "ongoing")}
                          >
                            <Play className="size-3" /> Iniciar
                          </Button>
                        )}
                        {order.status === "ongoing" && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-wider border-success/30 hover:bg-success/10 text-success"
                            onClick={() => updateStatus(order, "completed")}
                          >
                            <CheckCircle2 className="size-3" /> Concluir
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-gold hover:bg-gold/10"
                          onClick={() => openDocument(order)}
                          title="DANFE de Produção"
                        >
                          <FileText className="size-4" />
                        </Button>

                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ordem de Produção</DialogTitle>
            <DialogDescription>Inicie a produção de um produto do catálogo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Produto</Label>
              <Select value={newOrder.product_id} onValueChange={v => setNewOrder({ ...newOrder, product_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={newOrder.quantity} onChange={e => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={newOrder.priority} onValueChange={(v: any) => setNewOrder({ ...newOrder, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Data Prevista de Conclusão</Label>
              <Input type="date" value={newOrder.data_prevista || ""} onChange={e => setNewOrder({ ...newOrder, data_prevista: e.target.value })} />
            </div>
            {newOrder.product_id && (
              <div className="bg-gold/5 border border-gold/20 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gold tracking-widest">Código da Ordem Sugerido</p>
                  <p className="font-mono text-sm font-bold">{nextCode}</p>
                </div>
                <Badge variant="outline" className="border-gold/30 text-gold text-[10px]">AUTO-GERADO</Badge>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Input value={newOrder.notes} onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} placeholder="Notas livres do operador..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOrderOpen(false)}>Cancelar</Button>
            <Button onClick={createOrder} className="bg-gradient-gold border-none shadow-gold font-bold">Criar Ordem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductionDocument 
        order={selectedOrderDoc}
        product={productById.get(selectedOrderDoc?.product_id as string)}
        composition={orderComposition}
        open={documentOpen}
        onOpenChange={setDocumentOpen}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" /> Excluir Ordem de Produção
            </DialogTitle>
            <DialogDescription>
              {orderToDelete?.status === "completed" 
                ? "Esta ordem já foi concluída. Ao excluir, o sistema irá ESTORNAR as matérias-primas e REMOVER o produto do estoque. Esta ação não pode ser desfeita."
                : "Deseja realmente cancelar e excluir esta ordem de produção? Os materiais não serão afetados se a produção não foi concluída."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Manter Ordem</Button>
            <Button variant="destructive" onClick={handleDeleteOrder}>Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

