import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  AlertTriangle, 
  Boxes, 
  Plus, 
  Search, 
  Settings2,
  Pencil,
  Trash2,
  Package,
  Layers,
  Upload,
  RefreshCw,
  X,
  PlusCircle,
  Palette,
  Info,
  CheckCircle2
} from "lucide-react";

import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
import { Card, CardContent } from "@/components/ui/card";
import { brl, num } from "@/lib/format";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Materiais — Amstore Gestão" },
      { name: "description", content: "Gerencie todos os materiais e cortes de couro." },
    ],
  }),
  component: MaterialsPage,
});

export const MATERIAL_TYPES = ["Couro", "Tecido", "Ferragem", "Forro", "Cola", "Linha", "Estrutura", "Outro"];

type Material = {
  id: string;
  name: string;
  type: string;
  unit: string;
  cost_price: number;
  current_stock: number;
  min_stock: number;
  supplier: string | null;
  image_url: string | null;
  sku: string | null;
  width: number | null;
  height: number | null;
  thickness: number | null;
  color: string | null;
  description: string | null;
  specification: string | null;
};

type MaterialVariation = {
  id: string;
  material_id: string;
  name: string;
  specification: string | null;
  current_stock: number;
  cost_price: number;
  notes: string | null;
};

function MaterialsPage() {

  const { data: materials = [], isLoading } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const { data: categories = [] } = useRows<{id: string, name: string}>("material_categories", { order: { column: "name", ascending: true } });
  const { data: suppliers = [] } = useRows<{id: string, name: string}>("suppliers", { order: { column: "name", ascending: true } });
  const { data: units = [] } = useRows<{id: string, name: string, abbreviation: string}>("units_of_measure", { order: { column: "name", ascending: true } });

  const save = useSaveRow("materials", "material");
  const remove = useDeleteRow("materials", "material");
  const saveConfig = useSaveRow("", ""); // Will be used dynamically
  const removeConfig = useDeleteRow("", ""); // Will be used dynamically

  const [term, setTerm] = useState("");
  const [activeType, setActiveType] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState<Partial<Material>>({});
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  // Variations states
  const [variationsOpen, setVariationsOpen] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const { data: variations = [] } = useRows<MaterialVariation>("material_variations", { 
    filters: activeMaterial ? [{ column: "material_id", value: activeMaterial.id }] : undefined 
  });
  const saveVariation = useSaveRow("material_variations", "Variação");
  const removeVariation = useDeleteRow("material_variations", "Variação");
  const [variationForm, setVariationForm] = useState<Partial<MaterialVariation>>({
    current_stock: 0,
    cost_price: 0
  });

  // Cuts states
  // Cuts states
  const [cutsOpen, setCutsOpen] = useState(false);
  const [newCutForm, setNewCutForm] = useState({ name: "", width: 0, height: 0 });
  const [isAddingCut, setIsAddingCut] = useState(false);
  const { data: cuts = [] } = useRows<{id: string, name: string, width: number, height: number, status: string}>("material_cuts", {
    filters: activeMaterial ? [{ column: "material_id", value: activeMaterial.id }] : undefined
  });
  const saveCut = useSaveRow("material_cuts", "Corte");
  const removeCut = useDeleteRow("material_cuts", "Corte");
  // New states for Config Modal
  const [newConfigValue, setNewConfigValue] = useState("");
  const [newConfigLabel, setNewConfigLabel] = useState("");
  const [activeConfigTab, setActiveConfigTab] = useState("categories");



  const filtered = useMemo(() => {
    return materials.filter(m => {
      const matchesTerm = (m.name || "").toLowerCase().includes(term.toLowerCase()) || 
                          (m.sku || "").toLowerCase().includes(term.toLowerCase());
      const matchesType = activeType === "Todos" || m.type === activeType;
      return matchesTerm && matchesType;
    });
  }, [materials, term, activeType]);

  const stats = useMemo(() => {
    const total = materials.length;
    const low = materials.filter(m => Number(m.current_stock) <= Number(m.min_stock)).length;
    const totalValue = materials.reduce((s, m) => s + (Number(m.current_stock) * Number(m.cost_price)), 0);
    return { total, low, totalValue };
  }, [materials]);

  const openNew = () => {
    setEditing(null);
    setForm({ type: "Couro", unit: "un", cost_price: 0, current_stock: 0, min_stock: 0 });
    setFormOpen(true);
  };

  const openEdit = (m: Material) => {
    setEditing(m);
    setForm(m);
    setFormOpen(true);
  };

  const submit = () => {
    if (!form.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    save.mutate({
      id: editing?.id,
      values: form
    }, {
      onSuccess: () => setFormOpen(false)
    });
  };

  const handleAddVariation = () => {
    if (!variationForm.name || !activeMaterial) {
      toast.error("Nome/Cor da variação é obrigatório");
      return;
    }
    saveVariation.mutate({
      values: {
        ...variationForm,
        material_id: activeMaterial.id
      }
    }, {
      onSuccess: () => {
        setVariationForm({
          current_stock: 0,
          cost_price: activeMaterial.cost_price,
          name: ""
        });
      }
    });
  };

  const openVariations = (m: Material) => {
    setActiveMaterial(m);
    setVariationForm({
      current_stock: 0,
      cost_price: m.cost_price,
      name: ""
    });
    setVariationsOpen(true);
  };

  const openCuts = (m: Material) => {
    setActiveMaterial(m);
    setCutsOpen(true);
  };


  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("suppliers").insert({ name: newSupplierName });
    
    if (error) {
      toast.error(error.message);
    } else {
      setForm({ ...form, supplier: newSupplierName });
      setNewSupplierName("");
      setSupplierDialogOpen(false);
      toast.success("Fornecedor adicionado");
      
      const queryClient = (await import("@tanstack/react-query")).useQueryClient();
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    }
  };

  const handleAddConfig = async () => {
    if (!newConfigValue.trim()) return;
    
    let table = "";
    let values = {};
    let label = "";

    if (activeConfigTab === "categories") {
      table = "material_categories";
      values = { name: newConfigValue };
      label = "Categoria";
    } else if (activeConfigTab === "suppliers") {
      table = "suppliers";
      values = { name: newConfigValue };
      label = "Fornecedor";
    } else if (activeConfigTab === "units") {
      table = "units_of_measure";
      values = { name: newConfigLabel, abbreviation: newConfigValue };
      label = "Unidade de Medida";
    }

    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from(table as any).insert(values);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${label} adicionado`);
      setNewConfigValue("");
      setNewConfigLabel("");
      
      // Invalidate queries to refresh the lists without reloading the page
      const { supabase } = await import("@/integrations/supabase/client");
      const queryClient = (await import("@tanstack/react-query")).useQueryClient();
      queryClient.invalidateQueries({ queryKey: [table] });
    }
  };

  const handleDeleteConfig = async (id: string) => {
    let table = activeConfigTab === "categories" ? "material_categories" : 
                activeConfigTab === "suppliers" ? "suppliers" : "units_of_measure";
    
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Excluído com sucesso");
      const queryClient = (await import("@tanstack/react-query")).useQueryClient();
      queryClient.invalidateQueries({ queryKey: [table] });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Materiais" 
        description="Gerencie todos os materiais e cortes de couro"
        icon={Boxes}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setConfigOpen(true)}>
              <Settings2 className="size-4" />
            </Button>
            <Button onClick={openNew} className="gap-2">
              <Plus className="size-4" /> Novo Material
            </Button>
          </div>
        }
      />


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Materiais" value={stats.total} icon={Boxes} tone="dark" sub="couros e outros" />
        <StatCard title="Estoque baixo" value={stats.low} icon={AlertTriangle} tone="destructive" sub="Materiais normais" />
        <StatCard title="Couros Alta Utilização" value={0} icon={Layers} tone="gold" sub=">80% cortado" />
        <StatCard title="Valor Total" value={brl(stats.totalValue)} icon={Package} tone="success" sub="Todos os materiais" />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {["Todos", ...categories.map(c => c.name)].map(t => (
            <Button 
              key={t}
              variant={activeType === t ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveType(t)}
              className="rounded-full px-4"
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, SKU ou fornecedor..." 
            className="pl-10"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-64 animate-pulse rounded-3xl bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(m => (
            <Card key={m.id} className="overflow-hidden rounded-3xl border-border/50 bg-card transition-all hover:shadow-xl hover:shadow-gold/5">
              <div className="relative aspect-[4/3] bg-muted/30">
                {m.image_url ? (
                  <img src={m.image_url} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/20">
                    <Boxes className="size-12" />
                  </div>
                )}
                <Badge className="absolute right-3 top-3 bg-white/90 text-success backdrop-blur-sm">Normal</Badge>
                <Badge variant="secondary" className="absolute left-3 top-3 uppercase tracking-wider">{m.type}</Badge>
              </div>
              <CardContent className="p-5">
                <div className="mb-4">
                  <h3 className="line-clamp-1 font-display text-lg font-bold">{m.name}</h3>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">SKU: {m.sku || "—"}</p>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estoque:</span>
                    <span className="font-bold text-success">{num(m.current_stock)} {m.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estoque Mínimo:</span>
                    <span className="font-medium">{num(m.min_stock)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-2">
                    <span className="text-muted-foreground">Preço unitário:</span>
                    <span className="font-bold text-success">{brl(m.cost_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-semibold">Valor Total:</span>
                    <span className="font-bold text-primary">{brl(Number(m.current_stock) * Number(m.cost_price))}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground italic">vaga:</span>
                    <span className="text-muted-foreground">{m.supplier || "—"}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {["Couro", "Estrutura", "Forro"].includes(m.type || "") && (
                      <Button variant="default" size="sm" className="h-8 gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => openCuts(m)}>
                        <Layers className="size-3" /> Ver Cortes
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => openVariations(m)}>
                      <Palette className="size-3" /> Variações
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => openEdit(m)}>
                      <Pencil className="size-3" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-full gap-1 text-destructive hover:bg-destructive/5" onClick={() => remove.mutate(m.id)}>
                      <Trash2 className="size-3" /> Excluir
                    </Button>
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] overflow-y-auto sm:max-w-3xl rounded-3xl p-0 border-none bg-white [&>button]:hidden">
          <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
            <h2 className="text-lg font-semibold">{editing ? "Editar Material" : "Novo Material"}</h2>
            <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)} className="rounded-full hover:bg-muted">
              <X className="size-4" />
            </Button>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {/* Imagem do Material */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Imagem do Material</Label>
                <div 
                  className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 p-8 transition-colors hover:bg-muted/10 cursor-pointer"
                  onClick={() => document.getElementById('material-image-upload')?.click()}
                >
                  <input 
                    type="file" 
                    id="material-image-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setForm({ ...form, image_url: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {form.image_url ? (
                    <div className="group relative w-full overflow-hidden rounded-xl aspect-video max-h-48">
                      <img src={form.image_url} alt="Preview" className="h-full w-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({ ...form, image_url: null });
                          }}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm mb-3">
                        <Upload className="size-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">Clique para fazer upload da imagem</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Máximo 5MB</p>
                      <div className="mt-4 w-full max-w-xs flex gap-2" onClick={e => e.stopPropagation()}>
                        <Input 
                          type="text" 
                          placeholder="Ou cole a URL da imagem aqui" 
                          className="text-xs h-8"
                          value={form.image_url || ""}
                          onChange={e => setForm({ ...form, image_url: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome *</Label>
                  <Input 
                    placeholder="Ex: Couro Legítimo Marrom" 
                    value={form.name || ""} 
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* SKU */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SKU *</Label>
                  <div className="relative">
                    <Input 
                      placeholder="MATEOK2BCVB" 
                      value={form.sku || ""} 
                      onChange={e => setForm({ ...form, sku: e.target.value })}
                      className="h-11 rounded-xl pr-10"
                    />
                    <button 
                      type="button"
                      onClick={() => setForm({ ...form, sku: Math.random().toString(36).substring(2, 10).toUpperCase() })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria *</Label>
                  <Select value={form.type || ""} onValueChange={v => setForm({ ...form, type: v })}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>


                {/* Fornecedor */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fornecedor</Label>
                  <div className="flex gap-2">
                    <Select value={form.supplier || ""} onValueChange={v => setForm({ ...form, supplier: v })}>
                      <SelectTrigger className="h-11 flex-1 rounded-xl">
                        <SelectValue placeholder="Selecione o fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        {form.supplier && !suppliers.some(s => s.name === form.supplier) && (
                          <SelectItem value={form.supplier}>{form.supplier}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-11 w-11 rounded-xl border-orange-200 text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                      onClick={() => setSupplierDialogOpen(true)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
                  <DialogContent className="sm:max-w-[425px] rounded-3xl">
                    <DialogHeader>
                      <DialogTitle>Novo Fornecedor</DialogTitle>
                      <DialogDescription>
                        Digite o nome do novo fornecedor para este material.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label htmlFor="supplier-name" className="text-right">Nome</Label>
                      <Input
                        id="supplier-name"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        className="col-span-3 mt-2 h-11 rounded-xl"
                        placeholder="Nome do fornecedor"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSupplier();
                        }}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSupplierDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                      <Button onClick={handleAddSupplier} className="rounded-xl bg-orange-500 hover:bg-orange-600">Adicionar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Unidade de Medida - Agora aparece sempre para facilitar */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      Unidade de Medida *
                    </Label>
                    <Select 
                      value={form.unit || "un"} 
                      onValueChange={v => setForm({ ...form, unit: v })}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-muted/5">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {units.length > 0 ? (
                          units.map(u => (
                            <SelectItem key={u.id} value={u.abbreviation}>{u.name} ({u.abbreviation})</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="un">Unidade (un)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custo */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custo por Unidade (R$)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      placeholder="0" 
                      value={form.cost_price || ""} 
                      onChange={e => setForm({ ...form, cost_price: Number(e.target.value) })}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  {/* Condicional para Ferragem */}
                  {form.type === "Ferragem" ? (
                    <>
                      {/* Estoque Atual */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estoque Atual</Label>
                        <Input 
                          type="number"
                          value={form.current_stock ?? 0} 
                          onChange={e => setForm({ ...form, current_stock: Number(e.target.value) })}
                          className="h-11 rounded-xl"
                        />
                      </div>

                      {/* Estoque Mínimo */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estoque Mínimo</Label>
                        <Input 
                          type="number"
                          value={form.min_stock ?? 0} 
                          onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })}
                          className="h-11 rounded-xl"
                        />
                      </div>

                      {/* Especificação */}
                      <div className="col-span-full space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Especificação (ex: 1.0/1.0/2.0, 4x1, 5cm, 2.8x1, 1cm)</Label>
                        <Input 
                          placeholder="Ex: 1.0/1.0/2.0 ou 4x1, 5cm" 
                          value={form.specification || ""} 
                          onChange={e => setForm({ ...form, specification: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Cor */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cor</Label>
                        <Input 
                          placeholder="Ex: Preto, Branco, Azul" 
                          value={form.color || ""} 
                          onChange={e => setForm({ ...form, color: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>

                      {/* Dimensões - Somente para categorias específicas */}
                      {["Couro", "Estrutura", "Forro", "Tecido"].includes(form.type || "") && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Largura (m) *</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={form.width || ""} 
                              onChange={e => setForm({ ...form, width: Number(e.target.value) })}
                              className="h-11 rounded-xl"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Altura (m) *</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={form.height || ""} 
                              onChange={e => setForm({ ...form, height: Number(e.target.value) })}
                              className="h-11 rounded-xl"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Espessura (cm)</Label>
                            <Input 
                              type="number"
                              step="0.1"
                              value={form.thickness || ""} 
                              onChange={e => setForm({ ...form, thickness: Number(e.target.value) })}
                              className="h-11 rounded-xl"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Área de Cálculo de Área Total (Somente para Couro, Forro, Estrutura e Tecido) */}
                {["Couro", "Forro", "Estrutura", "Tecido"].includes(form.type || "") && form.width && form.height && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 animate-in zoom-in-95 duration-300 mt-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Área Total da Peça:</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-blue-900">
                          {num(Number(form.width) * Number(form.height))} m²
                        </span>
                        <span className="text-sm text-blue-600/70">
                          ({form.width}m × {form.height}m)
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-700 font-medium bg-blue-100/50 w-fit px-3 py-1 rounded-full">
                        <CheckCircle2 className="size-3" />
                        Material será cadastrado como 1 unidade (peça única)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</Label>
                <textarea 
                  className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                  placeholder="Descrição detalhada do material"
                  value={form.description || ""} 
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-gray-50/50 rounded-b-3xl">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="h-11 rounded-xl px-8">
              Cancelar
            </Button>
            <Button onClick={submit} disabled={save.isPending} className="h-11 rounded-xl px-8 bg-blue-600 hover:bg-blue-700 gap-2">
              {save.isPending ? "Salvando..." : (
                <>
                  <Package className="size-4" /> Cadastrar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Configurações */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] overflow-y-auto sm:max-w-4xl rounded-3xl p-0 border-none bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <Settings2 className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Configurações de Materiais</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setConfigOpen(false)} className="rounded-full">
              <X className="size-4" />
            </Button>
          </div>

          <div className="p-6">
            <Tabs defaultValue="categories" onValueChange={setActiveConfigTab}>
              <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/50 p-1 mb-6">
                <TabsTrigger value="categories" className="rounded-lg">Categorias</TabsTrigger>
                <TabsTrigger value="suppliers" className="rounded-lg">Fornecedores</TabsTrigger>
                <TabsTrigger value="units" className="rounded-lg">Unidades de Medida</TabsTrigger>
              </TabsList>

              {/* Input section based on tab */}
              <div className="flex gap-4 mb-8 items-end">
                {activeConfigTab === "units" ? (
                  <>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Valor (ex: cm)</Label>
                      <Input 
                        placeholder="cm" 
                        value={newConfigValue} 
                        onChange={e => setNewConfigValue(e.target.value)} 
                        className="h-10 rounded-xl"
                      />
                    </div>
                    <div className="flex-[2] space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Label (ex: Centímetro (cm))</Label>
                      <Input 
                        placeholder="Centímetro (cm)" 
                        value={newConfigLabel} 
                        onChange={e => setNewConfigLabel(e.target.value)} 
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {activeConfigTab === "categories" ? "Nova Categoria" : "Novo Fornecedor"}
                    </Label>
                    <Input 
                      placeholder={activeConfigTab === "categories" ? "Ex: Verniz" : "Ex: Fornecedor C"} 
                      value={newConfigValue} 
                      onChange={e => setNewConfigValue(e.target.value)} 
                      className="h-10 rounded-xl"
                    />
                  </div>
                )}
                <Button onClick={handleAddConfig} className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0 rounded-xl">
                  <Plus className="size-5" />
                </Button>
              </div>

              <div className="space-y-1 border rounded-2xl overflow-hidden bg-gray-50/30">
                <TabsContent value="categories" className="m-0">
                  {categories.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-white border-b last:border-0">
                      <span className="font-medium">{c.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(c.id)} className="text-destructive h-8 w-8">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="suppliers" className="m-0">
                  {suppliers.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white border-b last:border-0">
                      <span className="font-medium">{s.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(s.id)} className="text-destructive h-8 w-8">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="units" className="m-0">
                  {units.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-white border-b last:border-0">
                      <div className="flex flex-col">
                        <span className="font-medium">{u.name} ({u.abbreviation})</span>
                        <span className="text-[10px] text-muted-foreground">{u.abbreviation}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(u.id)} className="text-destructive h-8 w-8">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-gray-50/50 rounded-b-3xl sticky bottom-0">
            <Button variant="outline" onClick={() => setConfigOpen(false)} className="h-10 rounded-xl px-6">
              Cancelar
            </Button>
            <Button onClick={() => setConfigOpen(false)} className="h-10 rounded-xl px-6 bg-blue-600 hover:bg-blue-700 gap-2">
              Salvar Configurações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Variações */}
      <Dialog open={variationsOpen} onOpenChange={setVariationsOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] overflow-y-auto sm:max-w-5xl rounded-3xl p-0 border-none bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-lg font-semibold">Variações - {activeMaterial?.name}</h2>
              <p className="text-xs text-muted-foreground">Gerencie diferentes cores, tamanhos e preços</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setVariationsOpen(false)} className="rounded-full">
              <X className="size-4" />
            </Button>
          </div>

          <div className="p-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-6 mb-8">
              <h3 className="text-sm font-bold text-blue-900 mb-4">Adicionar Nova Variação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Cor/Nome da Variação *</Label>
                  <Input 
                    placeholder="Ex: Preto, Marrom Claro" 
                    value={variationForm.name || ""} 
                    onChange={e => setVariationForm({ ...variationForm, name: e.target.value })}
                    className="h-10 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Especificação (ex: 1.0/1.0/2.0, 4x1, 5cm, Nº 8)</Label>
                  <Input 
                    placeholder="Ex: 1.0/1.0/2.0 ou 4x1, 5cm" 
                    value={variationForm.specification || ""} 
                    onChange={e => setVariationForm({ ...variationForm, specification: e.target.value })}
                    className="h-10 rounded-xl bg-white"
                  />
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="size-3 text-gold" /> Use para numeração, medidas em mm, ou dimensões específicas
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Quantidade em Estoque</Label>
                  <Input 
                    type="number"
                    value={variationForm.current_stock ?? 0} 
                    onChange={e => setVariationForm({ ...variationForm, current_stock: Number(e.target.value) })}
                    className="h-10 rounded-xl bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Preço Unitário (R$)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={variationForm.cost_price ?? 0} 
                    onChange={e => setVariationForm({ ...variationForm, cost_price: Number(e.target.value) })}
                    className="h-10 rounded-xl bg-white"
                  />
                </div>
                <div className="col-span-full space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">Observações</Label>
                  <Input 
                    placeholder="Informações adicionais" 
                    value={variationForm.notes || ""} 
                    onChange={e => setVariationForm({ ...variationForm, notes: e.target.value })}
                    className="h-10 rounded-xl bg-white"
                  />
                </div>
              </div>
              <Button 
                onClick={handleAddVariation} 
                disabled={saveVariation.isPending}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white h-10 rounded-xl gap-2"
              >
                <Plus className="size-4" /> Adicionar Variação
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-sm">Variações Cadastradas ({variations.length})</h3>
              
              {variations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-3xl">
                  <Palette className="size-12 mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma variação cadastrada ainda</p>
                  <p className="text-xs">Adicione variações acima</p>
                  <p className="text-[10px] mt-4 text-gold">💡 Se salvar sem variações, o material voltará ao modo unitário</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {variations.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-4 bg-white border rounded-2xl hover:shadow-md transition-shadow">
                      <div className="grid grid-cols-4 flex-1 gap-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Cor/Nome</p>
                          <p className="font-medium">{v.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Especificação</p>
                          <p className="font-medium text-muted-foreground">{v.specification || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Estoque</p>
                          <p className="font-bold text-success">{num(v.current_stock)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Preço</p>
                          <p className="font-bold text-primary">{brl(v.cost_price)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeVariation.mutate(v.id)} className="text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4 bg-gray-50/50 rounded-b-3xl">
            <Button variant="outline" onClick={() => setVariationsOpen(false)} className="h-10 rounded-xl px-6">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Cortes (Leather/Structure/Lining) */}
      <Dialog open={cutsOpen} onOpenChange={setCutsOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] overflow-y-auto sm:max-w-[1400px] rounded-3xl p-0 border-none bg-white">
          <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white z-20">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-blue-50 text-blue-600">
                <Layers className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{activeMaterial?.name}</h2>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">SKU: {activeMaterial?.sku || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2 text-pink-500 border-pink-100 hover:bg-pink-50">
                <div className="size-2 rounded-full bg-pink-500 animate-pulse" />
                Otimizar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCutsOpen(false)} className="rounded-full">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,350px] overflow-hidden">
            {/* Canvas Area */}
            <div className="p-8 bg-gray-50/30 flex flex-col items-center justify-center min-h-[600px] relative">
              <div className="absolute top-4 left-6 flex gap-4 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                <div className="flex items-center gap-1.5"><PlusCircle className="size-3 text-blue-500" /> Arrastar: Mover cortes</div>
                <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-blue-500" /> Handle azul: Rotacionar</div>
                <div className="flex items-center gap-1.5"><span className="text-blue-500">Ctrl+Click</span>: Seleção múltipla</div>
                <div className="flex items-center gap-1.5"><span className="text-blue-500">Shift+Drag</span>: Pan</div>
              </div>

              {/* The Material Canvas */}
              <div 
                className="relative bg-white shadow-2xl border-2 border-orange-200/50"
                style={{ 
                  width: `${(activeMaterial?.width || 100) * 4}px`, 
                  height: `${(activeMaterial?.height || 100) * 4}px`,
                  backgroundImage: 'radial-gradient(#fed7aa 0.5px, transparent 0.5px)',
                  backgroundSize: '10px 10px'
                }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-orange-400">{activeMaterial?.width} m</div>
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-orange-400">{activeMaterial?.height} m</div>
                
                {/* Render mock/real cuts */}
                {cuts.map((cut, idx) => (
                  <div 
                    key={cut.id}
                    className="absolute border-2 border-blue-600 bg-blue-500/20 flex items-center justify-center p-1 text-[8px] font-bold text-blue-900 leading-tight text-center overflow-hidden"
                    style={{
                      width: `${cut.width * 4}px`,
                      height: `${cut.height * 4}px`,
                      left: `${(idx % 10) * 30}px`,
                      top: `${Math.floor(idx / 10) * 30}px`
                    }}
                  >
                    <span className="truncate">{cut.name}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-6 p-3 bg-white rounded-2xl shadow-sm border">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Zoom</Label>
                  <Input type="range" className="w-24 accent-blue-600" />
                  <span className="text-xs font-bold text-muted-foreground">100%</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Grid</Label>
                  <Input type="range" className="w-24 accent-blue-600" />
                  <span className="text-xs font-bold text-muted-foreground">0.05m</span>
                </div>
              </div>
            </div>

            {/* Sidebar Stats Area */}
            <div className="border-l bg-white flex flex-col h-full overflow-y-auto">
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Estatísticas</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Custo por m²:</span>
                      <span className="font-bold">{brl(activeMaterial?.cost_price ? activeMaterial.cost_price / ((activeMaterial.width || 1) * (activeMaterial.height || 1)) : 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Área Total:</span>
                      <span className="font-bold">{(activeMaterial?.width || 0) * (activeMaterial?.height || 0)} m²</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-600">
                      <span className="">Área Utilizada:</span>
                      <span className="font-bold">{num(cuts.reduce((sum, c) => sum + (c.width * c.height), 0))} m²</span>
                    </div>
                    <div className="flex justify-between text-xs text-success">
                      <span className="">Área Disponível:</span>
                      <span className="font-bold">{num(((activeMaterial?.width || 0) * (activeMaterial?.height || 0)) - cuts.reduce((sum, c) => sum + (c.width * c.height), 0))} m²</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Aproveitamento:</span>
                      <span className="font-bold text-pink-500">
                        {num((cuts.reduce((sum, c) => sum + (c.width * c.height), 0) / (((activeMaterial?.width || 1) * (activeMaterial?.height || 1)) || 1)) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 bg-gray-50 p-1 rounded-xl">
                    <div className="text-center p-2 rounded-lg bg-white shadow-sm">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Disponível</p>
                      <p className="text-sm font-bold text-success">{cuts.filter(c => c.status === 'disponivel').length}</p>
                    </div>
                    <div className="text-center p-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Utilizado</p>
                      <p className="text-sm font-bold text-blue-600">{cuts.filter(c => c.status === 'utilizado').length}</p>
                    </div>
                    <div className="text-center p-2">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Reservado</p>
                      <p className="text-sm font-bold text-orange-500">{cuts.filter(c => c.status === 'reservado').length}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center border-t pt-4">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Custo Total da Peça:</span>
                    <span className="text-lg font-bold text-success">{brl(activeMaterial?.cost_price || 0)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {!isAddingCut ? (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 h-11 rounded-xl gap-2 shadow-lg shadow-blue-100"
                      onClick={() => setIsAddingCut(true)}
                    >
                      <Plus className="size-4" /> Realizar Novo Corte
                    </Button>
                  ) : (
                    <div className="p-4 border rounded-2xl bg-blue-50/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nome do Corte</Label>
                        <Input 
                          placeholder="Ex: Forro Bolsa Monica" 
                          value={newCutForm.name}
                          onChange={e => setNewCutForm({...newCutForm, name: e.target.value})}
                          className="h-9 rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Largura (m)</Label>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="0" 
                            value={newCutForm.width || ""}
                            onChange={e => setNewCutForm({...newCutForm, width: Number(e.target.value)})}
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Altura (m)</Label>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="0" 
                            value={newCutForm.height || ""}
                            onChange={e => setNewCutForm({...newCutForm, height: Number(e.target.value)})}
                            className="h-9 rounded-lg"
                          />
                        </div>
                      </div>

                      {newCutForm.width > 0 && newCutForm.height > 0 && activeMaterial && (
                        <div className="bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Custo Proporcional do Corte</span>
                            <span className="text-sm font-bold text-success">
                              {brl((activeMaterial.cost_price / ((activeMaterial.width || 1) * (activeMaterial.height || 1))) * (newCutForm.width * newCutForm.height))}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-blue-600">
                            {num(newCutForm.width * newCutForm.height)} m²
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          className="flex-1 h-9 rounded-lg text-xs"
                          onClick={() => setIsAddingCut(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs"
                          onClick={() => {
                            if (!newCutForm.name || !newCutForm.width || !newCutForm.height) {
                              toast.error("Preencha todos os campos do corte");
                              return;
                            }
                            saveCut.mutate({
                              values: {
                                ...newCutForm,
                                material_id: activeMaterial?.id,
                                status: 'disponivel',
                                x: 0,
                                y: 0
                              }
                            }, {
                              onSuccess: () => {
                                setIsAddingCut(false);
                                setNewCutForm({ name: "", width: 0, height: 0 });
                              }
                            });
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cortes ({cuts.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {cuts.map(cut => (
                      <div key={cut.id} className="p-4 border rounded-2xl bg-gray-50/50 hover:bg-white transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-bold">{cut.name}</p>
                            <p className="text-[10px] text-muted-foreground">{cut.width} × {cut.height} cm • {cut.width * cut.height} cm²</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="size-7 rounded-full text-destructive" onClick={() => removeCut.mutate(cut.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-success">{brl(activeMaterial?.cost_price ? (activeMaterial.cost_price / ((activeMaterial.width || 1) * (activeMaterial.height || 1))) * (cut.width * cut.height) : 0)}</span>
                          <Select defaultValue={cut.status}>
                            <SelectTrigger className="h-7 w-28 text-[10px] uppercase font-bold rounded-lg border-none bg-white shadow-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="disponivel">Disponível</SelectItem>
                              <SelectItem value="utilizado">Utilizado</SelectItem>
                              <SelectItem value="reservado">Reservado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


