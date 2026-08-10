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
  X
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
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

export const MATERIAL_TYPES = ["Couro", "Tecido", "Ferragem", "Forro", "Cola", "Linha", "Outro"];

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
};

function MaterialsPage() {
  const { data: materials = [], isLoading } = useRows<Material>("materials", { order: { column: "name", ascending: true } });
  const save = useSaveRow("materials", "material");
  const remove = useDeleteRow("materials", "material");

  const [term, setTerm] = useState("");
  const [activeType, setActiveType] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState<Partial<Material>>({});

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Materiais" 
        description="Gerencie todos os materiais e cortes de couro"
        icon={Boxes}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon"><Settings2 className="size-4" /></Button>
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
          {["Todos", ...MATERIAL_TYPES].map(t => (
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
            <Card key={m.id} className="group overflow-hidden rounded-3xl border-border/50 bg-card transition-all hover:shadow-xl hover:shadow-gold/5">
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

                <div className="mt-4 flex gap-2 border-t border-border/50 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="outline" size="sm" className="h-8 flex-1 gap-1" onClick={() => openEdit(m)}>
                    <Pencil className="size-3" /> Editar
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(m.id)}>
                    <Trash2 className="size-3" />
                  </Button>
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
                      {MATERIAL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                        <SelectItem value="Fornecedor A">Fornecedor A</SelectItem>
                        <SelectItem value="Fornecedor B">Fornecedor B</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-orange-200 text-orange-500 hover:bg-orange-50 hover:text-orange-600">
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

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

                {/* Dimensões */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Largura (cm) *</Label>
                  <Input 
                    type="number"
                    value={form.width || ""} 
                    onChange={e => setForm({ ...form, width: Number(e.target.value) })}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Altura (cm) *</Label>
                  <Input 
                    type="number"
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

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unidade de Medida</Label>
                  <Input 
                    placeholder="Ex: m2, un, par"
                    value={form.unit || ""} 
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="h-11 rounded-xl"
                  />
                </div>
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
    </div>
  );
}
