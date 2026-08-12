import { createFileRoute } from "@tanstack/react-router";
import { 
  Zap, 
  Plus, 
  Bell, 
  Search, 
  Trash2, 
  Pencil, 
  Power,
  Coins,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/data";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cashback")({
  head: () => ({
    meta: [
      { title: "Cashback por Categoria — Amstore Gestão" },
      { name: "description", content: "Configure percentuais de cashback para cada categoria de produto." },
    ],
  }),
  component: CashbackPage,
});

function CashbackPage() {
  const { data: configs = [], isLoading } = useRows<any>("cashback_config", {
    select: "*, material_categories(name)"
  });
  const { data: categories = [] } = useRows<any>("material_categories");
  
  const save = useSaveRow("cashback_config", "Configuração de Cashback");
  const remove = useDeleteRow("cashback_config", "Configuração de Cashback");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  
  // Form state
  const [categoryId, setCategoryId] = useState("");
  const [percent, setPercent] = useState("");
  const [isActive, setIsActive] = useState(true);

  const stats = useMemo(() => {
    const activeConfigs = configs.filter(c => c.active);
    const avgPercent = configs.length > 0 
      ? configs.reduce((acc, c) => acc + Number(c.cashback_percent), 0) / configs.length 
      : 0;
      
    return {
      totalCategories: configs.length,
      activeConfigs: activeConfigs.length,
      avgCashback: avgPercent.toFixed(1)
    };
  }, [configs]);

  const handleEdit = (config: any) => {
    setEditingConfig(config);
    setCategoryId(config.category_id);
    setPercent(config.cashback_percent.toString());
    setIsActive(config.active);
    setModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingConfig(null);
    setCategoryId("");
    setPercent("");
    setIsActive(true);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!categoryId || !percent) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      await save.mutateAsync({
        id: editingConfig?.id,
        values: {
          category_id: categoryId,
          cashback_percent: Number(percent),
          active: isActive
        }
      });
      setModalOpen(false);
    } catch (error) {
      // Error handled by useSaveRow
    }
  };

  const toggleStatus = async (config: any) => {
    try {
      await save.mutateAsync({
        id: config.id,
        values: { active: !config.active }
      });
    } catch (error) {}
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Zap className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-display tracking-tight">Cashback por Categoria</h1>
            <p className="text-sm text-muted-foreground">Configure percentuais de cashback para cada categoria de produto</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-success/30 text-success hover:bg-success/5">
            <Bell className="size-4" /> Notificar Clientes
          </Button>
          <Button onClick={handleOpenNew} className="gap-2 bg-gradient-gold shadow-gold font-bold">
            <Plus className="size-4" /> Nova Configuração
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 p-6 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Zap className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/60">Total de Categorias</p>
            <p className="text-2xl font-black">{stats.totalCategories}</p>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-green-100 bg-green-50/50 p-6 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-green-500 flex items-center justify-center text-white shadow-lg shadow-green-500/20">
            <TrendingUp className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-600/60">Configurações Ativas</p>
            <p className="text-2xl font-black">{stats.activeConfigs}</p>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-purple-100 bg-purple-50/50 p-6 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Coins className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600/60">Média de Cashback</p>
            <p className="text-2xl font-black">{stats.avgCashback}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-32 bg-card rounded-[1.5rem] animate-pulse" />)
        ) : configs.length === 0 ? (
          <Card className="rounded-[2rem] border-dashed border-2 flex flex-col items-center justify-center py-20 text-muted-foreground/50">
            <Zap className="size-12 mb-4" />
            <p className="font-bold">Nenhuma configuração encontrada</p>
            <Button variant="link" onClick={handleOpenNew} className="text-gold">Criar primeira configuração</Button>
          </Card>
        ) : configs.map((config: any) => (
          <Card key={config.id} className="rounded-[1.5rem] border-border/40 hover:border-gold/30 transition-all group shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-xl">{config.material_categories?.name}</h3>
                    <Badge variant={config.active ? "default" : "secondary"} className={cn("h-5 rounded-md px-1.5 font-bold text-[9px] uppercase tracking-wider", config.active ? "bg-success hover:bg-success/90" : "")}>
                      {config.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Percentual de Cashback:</p>
                    <p className="text-4xl font-black text-primary">{config.cashback_percent}%</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 font-bold px-6 rounded-xl border-border/60"
                    onClick={() => toggleStatus(config)}
                  >
                    {config.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl border-border/60 hover:text-gold"
                    onClick={() => handleEdit(config)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-9 w-9 rounded-xl border-border/60 text-destructive hover:bg-destructive/5"
                    onClick={() => remove.mutate(config.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Plus className="size-5 text-gold" />
              {editingConfig ? "Editar Configuração" : "Nova Configuração"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Categoria de Produto</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={!!editingConfig}>
                <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl">
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id} className="rounded-xl font-medium">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Percentual de Cashback (%)</Label>
              <div className="relative">
                <Input 
                  type="number"
                  value={percent}
                  onChange={e => setPercent(e.target.value)}
                  placeholder="Ex: 5"
                  className="h-12 rounded-2xl bg-muted/30 border-none font-black pl-4 pr-10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <Label className="font-bold text-sm">Configuração Ativa</Label>
              <Button 
                variant={isActive ? "default" : "outline"}
                className={isActive ? "bg-success hover:bg-success/90" : ""}
                onClick={() => setIsActive(!isActive)}
              >
                {isActive ? "Sim" : "Não"}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 mt-4">
            <Button variant="ghost" className="flex-1 rounded-2xl font-bold h-12" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button className="flex-1 rounded-2xl bg-gradient-gold shadow-gold font-black h-12" onClick={handleSubmit}>
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
