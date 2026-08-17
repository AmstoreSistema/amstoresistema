import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Truck, 
  Plus, 
  Search, 
  TrendingUp,
  Activity,
  DollarSign
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/data";
import { SupplierCard } from "@/components/suppliers/SupplierCard";
import { SupplierFormModal } from "@/components/suppliers/SupplierFormModal";
import { SupplierPurchasesModal } from "@/components/suppliers/SupplierPurchasesModal";

export const Route = createFileRoute("/_authenticated/purchase-board")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Amstore Gestão" },
      { name: "description", content: "Gerencie seus fornecedores de materiais e acompanhe compras." },
    ],
  }),
  component: SuppliersPage,
});

const CATEGORIES = ["Todos", "Couros", "Tecidos", "Ferragens", "Linhas", "Diversos"];

function SuppliersPage() {
  const { data: suppliers = [], isLoading } = useRows<any>("suppliers", { 
    order: { column: "name", ascending: true } 
  });
  
  const { data: purchases = [] } = useRows<any>("purchases");

  const save = useSaveRow("suppliers", "Fornecedor");
  const remove = useDeleteRow("suppliers", "Fornecedor");

  const [term, setTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [activeStatus, setActiveStatus] = useState<"Ativo" | "Inativo" | "Todos">("Ativo");
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  
  const [viewingSupplier, setViewingSupplier] = useState<any>(null);
  const [purchasesOpen, setPurchasesOpen] = useState(false);

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const matchesTerm = (s.name || "").toLowerCase().includes(term.toLowerCase()) || 
                          (s.document || "").toLowerCase().includes(term.toLowerCase());
      const matchesCategory = activeCategory === "Todos" || s.category === activeCategory;
      const matchesStatus = activeStatus === "Todos" || 
                           (activeStatus === "Ativo" && s.active !== false) ||
                           (activeStatus === "Inativo" && s.active === false);
      
      return matchesTerm && matchesCategory && matchesStatus;
    });
  }, [suppliers, term, activeCategory, activeStatus]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s.active !== false).length;
    const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.unit_cost)), 0);
    return { total, active, totalPurchases };
  }, [suppliers, purchases]);

  const handleOpenNew = () => {
    setEditingSupplier(null);
    setFormOpen(true);
  };

  const handleEdit = (s: any) => {
    setEditingSupplier(s);
    setFormOpen(true);
  };

  const handleView = (s: any) => {
    setViewingSupplier(s);
    setPurchasesOpen(true);
  };

  const handleSubmit = (values: any) => {
    save.mutate({
      id: editingSupplier?.id,
      values
    }, {
      onSuccess: () => setFormOpen(false)
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Deseja realmente excluir este fornecedor?")) {
      remove.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Fornecedores" 
        description="Gerencie seus fornecedores de materiais"
        icon={Truck}
        actions={
          <Button onClick={handleOpenNew} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="size-4" /> Novo Fornecedor
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Fornecedores" value={stats.total} icon={Truck} tone="dark" />
        <StatCard title="Fornecedores Ativos" value={stats.active} icon={TrendingUp} tone="success" />
        <StatCard title="Total em Compras" value={brl(stats.totalPurchases)} icon={DollarSign} tone="gold" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou CPF/CNPJ..." 
            className="pl-10 rounded-xl"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <Button 
                key={c}
                variant={activeCategory === c ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveCategory(c)}
                className="rounded-full px-4"
              >
                {c}
              </Button>
            ))}
          </div>

          <div className="flex rounded-xl bg-muted p-1">
            {["Ativo", "Inativo", "Todos"].map((s: any) => (
              <Button
                key={s}
                variant={activeStatus === s ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "rounded-lg px-4 text-xs font-semibold",
                  activeStatus === s && "bg-white shadow-sm hover:bg-white"
                )}
                onClick={() => setActiveStatus(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 animate-pulse rounded-3xl bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <SupplierCard 
              key={s.id} 
              supplier={s} 
              onEdit={handleEdit}
              onView={handleView}
              onDelete={handleDelete}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Truck className="mx-auto size-12 text-muted-foreground/20" />
              <p className="mt-4 text-muted-foreground">Nenhum fornecedor encontrado.</p>
            </div>
          )}
        </div>
      )}

      <SupplierFormModal 
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editingSupplier}
      />

      <SupplierPurchasesModal
        open={purchasesOpen}
        onOpenChange={setPurchasesOpen}
        supplier={viewingSupplier}
      />
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
