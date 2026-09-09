import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Package, 
  Search,
  Filter,
  Plus,
  History,
  AlertTriangle,
  Warehouse,
  Barcode,
  Calendar,
  Pencil,
  Settings2,
  CircleDollarSign,
  TrendingUp,
  DollarSign,
  Trash2,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Check,
  X,
  ArrowUpDown,
  Truck
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { brl, num, dateBR } from "@/lib/format";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/data";
import { AddProductDirectModal } from "@/components/stock/AddProductDirectModal";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({
    meta: [
      { title: "Estoque — Amstore Gestão" },
      { name: "description", content: "Controle de estoque de produtos e materiais." },
    ],
  }),
  component: StockPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  current_stock: number;
  min_stock: number;
  image_url: string | null;
  cost_price: number;
  sale_price: number;
  wholesale_price: number;
  updated_at: string | null;
  color: string | null;
};

type StockRecord = {
  id: string;
  produto_id: string;
  lote: string | null;
  localizacao: string | null;
  data_entrada: string | null;
  numeracoes: Record<string, number> | null;
};

// Normalizador tolerante para categorias (ignora acentos, maiúsculas/minúsculas e terminação plural em "s")
const normalizeCat = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/s$/, "");

function StockPage() {
  const qc = useQueryClient();
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSupplier, setSelectedSupplier] = useState("Todos");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "price-asc" | "price-desc" | "stock-desc" | "stock-asc" | "recent">("name-asc");
  const [showZeroStock, setShowZeroStock] = useState(false); // Oculta produtos zerados por padrão
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Lista de fornecedores para filtro
  const { data: suppliers = [] } = useRows<any>("suppliers", {
    order: { column: "name", ascending: true },
  });

  // Reinicia a paginação para a página 1 ao alterar qualquer filtro, busca ou ordenação
  useEffect(() => {
    setPage(1);
  }, [term, activeTab, selectedCategory, selectedSupplier, sortBy, showZeroStock]);

  // Cálculo de limites .range(from, to) baseado na página atual
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Busca paginada no Supabase
  const { data: stockResult, isLoading } = useQuery({
    queryKey: [
      "stock-products",
      page,
      term,
      activeTab,
      selectedCategory,
      selectedSupplier,
      sortBy,
      showZeroStock,
    ],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*", { count: "exact" });

      // Ordenação configurável
      if (sortBy === "name-asc") {
        q = q.order("name", { ascending: true });
      } else if (sortBy === "name-desc") {
        q = q.order("name", { ascending: false });
      } else if (sortBy === "price-asc") {
        q = q.order("sale_price", { ascending: true, nullsFirst: false });
      } else if (sortBy === "price-desc") {
        q = q.order("sale_price", { ascending: false, nullsFirst: false });
      } else if (sortBy === "stock-desc") {
        q = q.order("current_stock", { ascending: false });
      } else if (sortBy === "stock-asc") {
        q = q.order("current_stock", { ascending: true });
      } else if (sortBy === "recent") {
        q = q.order("updated_at", { ascending: false, nullsFirst: false });
      } else {
        q = q.order("name", { ascending: true });
      }

      // Ocultar produtos com estoque zerado por padrão
      if (!showZeroStock) {
        q = q.gt("current_stock", 0);
      }

      // Busca por nome ou código (SKU)
      if (term.trim()) {
        const cleanTerm = term.trim();
        q = q.or(`name.ilike.%${cleanTerm}%,sku.ilike.%${cleanTerm}%`);
      }

      // Filtro avançado por categoria (tolerante a maiúsculas, acentos e plural/singular)
      if (selectedCategory !== "Todas") {
        const targetNorm = normalizeCat(selectedCategory);

        const { data: catProducts } = await supabase
          .from("products")
          .select("id, category");

        const matchingIds = (catProducts || [])
          .filter((p: any) => {
            const pNorm = normalizeCat(p.category || "");
            return (
              pNorm === targetNorm ||
              (pNorm.length > 0 && targetNorm.length > 0 && (pNorm.includes(targetNorm) || targetNorm.includes(pNorm)))
            );
          })
          .map((p: any) => p.id);

        if (matchingIds.length > 0) {
          q = q.in("id", matchingIds);
        } else {
          // Nenhum produto nessa categoria
          q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
        }
      }

      // Filtro avançado por fornecedor
      if (selectedSupplier !== "Todos") {
        const { data: mats } = await supabase
          .from("materials")
          .select("id")
          .eq("supplier", selectedSupplier);

        const matIds = (mats || []).map((m: any) => m.id);
        if (matIds.length > 0) {
          const { data: pMats } = await supabase
            .from("product_materials")
            .select("product_id")
            .in("material_id", matIds);

          const productIds = Array.from(new Set((pMats || []).map((pm: any) => pm.product_id)));
          if (productIds.length > 0) {
            q = q.in("id", productIds);
          } else {
            q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
          }
        } else {
          q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
        }
      }

      // Abas rápidas
      if (activeTab === "Crítico") {
        const { data: allStocks } = await supabase
          .from("products")
          .select("id, current_stock, min_stock");
        const criticalIds = (allStocks || [])
          .filter((p: any) => {
            const current = Number(p.current_stock || 0);
            const min = Number(p.min_stock || 0);
            const isCritical = current <= min;
            return showZeroStock ? isCritical : isCritical && current > 0;
          })
          .map((p: any) => p.id);

        if (criticalIds.length > 0) {
          q = q.in("id", criticalIds);
        } else {
          q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
        }
      } else if (activeTab === "Disponível") {
        q = q.gt("current_stock", 0);
      }

      q = q.range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return {
        products: (data as Product[]) || [],
        totalCount: count || 0,
      };
    },
  });

  const products = stockResult?.products || [];
  const totalCount = stockResult?.totalCount || 0;

  const { data: stockRecords = [] } = useRows<StockRecord>("stock_products");
  const save = useSaveRow("products", "estoque");
  const remove = useDeleteRow("products", "estoque");
  const saveStock = useSaveRow("stock_products", "estoque detalhado");
  const removeStock = useDeleteRow("stock_products", "estoque detalhado");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [sizeDetailOpen, setSizeDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSizeInfo, setSelectedSizeInfo] = useState<{ size: string; quantity: number } | null>(null);
  const [newQty, setNewQty] = useState("");
  const [adjustQuantities, setAdjustQuantities] = useState<Record<string, number>>({});
  const [addDirectOpen, setAddDirectOpen] = useState(false);

  const filtered = products;

  // Consulta consolidada para os 5 StatCards de topo (mantém totais globais) e categorias do banco
  const { data: statsData } = useQuery({
    queryKey: ["stock-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category, current_stock, min_stock, cost_price, sale_price, wholesale_price");

      if (error) throw error;

      const all = (data as any[]) || [];
      const totalProducts = all.length;
      const totalUnits = all.reduce((sum: number, p: any) => sum + Number(p.current_stock || 0), 0);
      const low = all.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 0)).length;

      // Custo total: soma de (estoque atual * preço de custo)
      const totalCost = all.reduce(
        (sum: number, p: any) => sum + (Number(p.current_stock || 0) * Number(p.cost_price || 0)),
        0
      );

      // Valor Varejo: soma de (estoque atual * preço de venda/varejo)
      const totalRetail = all.reduce(
        (sum: number, p: any) => sum + (Number(p.current_stock || 0) * Number(p.sale_price || 0)),
        0
      );

      // Valor Atacado: soma de (estoque atual * preço de atacado)
      const totalWholesale = all.reduce(
        (sum: number, p: any) =>
          sum + (Number(p.current_stock || 0) * (Number(p.wholesale_price || 0) || Number(p.sale_price || 0))),
        0
      );

      // Extrai categorias reais existentes nos produtos do banco
      const dbCategories = Array.from(
        new Set(
          all
            .map((p: any) => (typeof p.category === "string" ? p.category.trim() : ""))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

      return {
        totalProducts,
        totalUnits,
        low,
        totalCost,
        totalRetail,
        totalWholesale,
        categories: dbCategories,
      };
    },
  });

  const stats = statsData || {
    totalProducts: 0,
    totalUnits: 0,
    low: 0,
    totalCost: 0,
    totalRetail: 0,
    totalWholesale: 0,
    categories: [] as string[],
  };

  // Categorias disponíveis no filtro avançado (reais do banco + padrões)
  const availableCategories = useMemo(() => {
    const defaultCats = ["Bolsa", "Sandálias", "Carteiras", "perfumes"];
    const fromDb = stats.categories || [];

    const seen = new Set<string>();
    const list: string[] = [];

    // Prioriza categorias do banco de dados
    for (const cat of fromDb) {
      const key = normalizeCat(cat);
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push(cat);
      }
    }

    // Complementa com as categorias padrão se ainda não adicionadas
    for (const cat of defaultCats) {
      const key = normalizeCat(cat);
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push(cat);
      }
    }

    return ["Todas", ...list];
  }, [stats.categories]);

  const handleAdjust = async () => {
    if (!selectedProduct) return;

    const stockRecord = stockRecords.find(s => s.produto_id === selectedProduct.id);
    const isSandalia = selectedProduct.category === "Sandálias";

    try {
      let totalQty = 0;
      if (isSandalia) {
        totalQty = Object.values(adjustQuantities).reduce((a, b) => a + (Number(b) || 0), 0);
      } else {
        totalQty = Number(newQty);
      }

      // Update product table
      await save.mutateAsync({
        id: selectedProduct.id,
        values: { 
          current_stock: totalQty, 
          updated_at: new Date().toISOString() 
        }
      });

      // Update stock_products table if record exists
      if (stockRecord) {
        await saveStock.mutateAsync({
          id: stockRecord.id,
          values: {
            quantidade_disponivel: totalQty,
            numeracoes: isSandalia ? adjustQuantities : null
          }
        });
      }

      setAdjustOpen(false);
      setNewQty("");
      setAdjustQuantities({});
      toast.success("Estoque ajustado com sucesso");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao ajustar estoque");
    }
  };

  const handleDeleteItem = async (productId: string) => {
    if (!confirm("Deseja realmente excluir este item do estoque? Esta ação é irreversível.")) return;

    try {
      const stockRecord = stockRecords.find(s => s.produto_id === productId);
      
      // Delete from stock_products first (foreign key)
      if (stockRecord) {
        await removeStock.mutateAsync(stockRecord.id);
      }
      
      // Delete from products
      await remove.mutateAsync(productId);
      
      toast.success("Item removido do estoque");
      qc.invalidateQueries();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover item");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Estoque" 
        description="Produtos acabados prontos para venda"
        icon={Warehouse}
        actions={
          <div className="flex gap-2">
             <Button variant="outline" className="gap-2">
                <History className="size-4" /> Histórico
             </Button>
             <Button onClick={() => setAddDirectOpen(true)} className="gap-2 bg-success hover:bg-success/90 border-none shadow-lg shadow-success/20 font-bold text-white">
                <Plus className="size-4" /> Adicionar Produto Direto
             </Button>
             <Button onClick={() => window.location.href = "/production"} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
                <Plus className="size-4" /> Nova Produção
             </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total de Itens"
          value={stats.totalUnits}
          icon={Package}
          tone="dark"
          sub={`${stats.totalProducts} produto(s) cadastrado(s)`}
        />
        <StatCard
          title="Estoque baixo"
          value={stats.low}
          icon={AlertTriangle}
          tone="destructive"
          sub={`${stats.low} item(ns) no limite mínimo`}
        />
        <StatCard
          title="Custo Total"
          value={brl(stats.totalCost)}
          icon={CircleDollarSign}
          tone="destructive"
          sub="Custo do estoque atual"
        />
        <StatCard
          title="Valor Varejo"
          value={brl(stats.totalRetail)}
          icon={TrendingUp}
          tone="success"
          sub="Preço de venda varejo"
        />
        <StatCard
          title="Valor Atacado"
          value={brl(stats.totalWholesale)}
          icon={DollarSign}
          tone="gold"
          sub="Preço de venda atacado"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {["Todos", "Crítico", "Disponível"].map(t => (
            <Button 
              key={t}
              variant={activeTab === t ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(t)}
              className="rounded-full px-6"
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex flex-1 flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Buscar por código de barras ou nome..." 
                className="pl-10 h-11 rounded-2xl bg-card border-border/40"
                value={term}
                onChange={e => setTerm(e.target.value)}
              />
            </div>

            {/* Tooltip + Popover do Funil (Filtros avançados) */}
            <TooltipProvider>
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button 
                        variant={selectedCategory !== "Todas" || selectedSupplier !== "Todos" ? "default" : "outline"} 
                        size="icon" 
                        className={`h-11 w-11 rounded-xl relative ${
                          selectedCategory !== "Todas" || selectedSupplier !== "Todos" 
                            ? "bg-gold hover:bg-gold/90 text-white border-none shadow-sm" 
                            : ""
                        }`}
                      >
                        <Filter className="size-4" />
                        {(selectedCategory !== "Todas" || selectedSupplier !== "Todos") && (
                          <span className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
                        )}
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Filtros avançados</p>
                  </TooltipContent>
                </Tooltip>

                <PopoverContent align="start" className="w-80 rounded-2xl p-4 shadow-xl border-border/60">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Filter className="size-4 text-gold" />
                        <h4 className="text-sm font-bold">Filtros avançados</h4>
                      </div>
                      {(selectedCategory !== "Todas" || selectedSupplier !== "Todos") && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory("Todas");
                            setSelectedSupplier("Todos");
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    {/* Filtro por Categoria */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Categorias
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableCategories.map((cat) => {
                          const isSelected =
                            (cat === "Todas" && selectedCategory === "Todas") ||
                            (cat !== "Todas" &&
                              (selectedCategory === cat || normalizeCat(selectedCategory) === normalizeCat(cat)));

                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategory(cat)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                                  : "border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filtro por Fornecedor */}
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Truck className="size-3.5" />
                        Fornecedores
                      </Label>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSupplier("Todos")}
                          className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center justify-between ${
                            selectedSupplier === "Todos"
                              ? "bg-muted text-foreground font-bold"
                              : "text-muted-foreground hover:bg-muted/30"
                          }`}
                        >
                          <span>Todos os fornecedores</span>
                          {selectedSupplier === "Todos" && <Check className="size-3.5 text-primary" />}
                        </button>
                        {suppliers.map((sup: any) => (
                          <button
                            key={sup.id}
                            type="button"
                            onClick={() => setSelectedSupplier(sup.name)}
                            className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center justify-between ${
                              selectedSupplier === sup.name
                                ? "bg-muted text-foreground font-bold"
                                : "text-muted-foreground hover:bg-muted/30"
                            }`}
                          >
                            <span className="truncate">{sup.name}</span>
                            {selectedSupplier === sup.name && <Check className="size-3.5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex justify-end">
                      <Button
                        size="sm"
                        className="h-8 text-xs font-bold bg-gold hover:bg-gold/90 text-white rounded-lg"
                        onClick={() => setFilterOpen(false)}
                      >
                        Concluir
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipProvider>

            {/* Tooltip + Popover dos Sliders (Ordenar por...) */}
            <TooltipProvider>
              <Popover open={sortOpen} onOpenChange={setSortOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button 
                        variant={sortBy !== "name-asc" ? "default" : "outline"} 
                        size="icon" 
                        className={`h-11 w-11 rounded-xl relative ${
                          sortBy !== "name-asc" 
                            ? "bg-gold hover:bg-gold/90 text-white border-none shadow-sm" 
                            : ""
                        }`}
                      >
                        <SlidersHorizontal className="size-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ordenar por...</p>
                  </TooltipContent>
                </Tooltip>

                <PopoverContent align="start" className="w-56 rounded-2xl p-2 shadow-xl border-border/60">
                  <div className="p-2 border-b border-border/40">
                    <h4 className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                      <ArrowUpDown className="size-3.5 text-gold" />
                      Ordenar por...
                    </h4>
                  </div>
                  <div className="space-y-0.5 pt-1">
                    {[
                      { id: "name-asc", label: "Nome (A-Z)" },
                      { id: "name-desc", label: "Nome (Z-A)" },
                      { id: "price-asc", label: "Menor Preço" },
                      { id: "price-desc", label: "Maior Preço" },
                      { id: "stock-desc", label: "Maior Estoque" },
                      { id: "stock-asc", label: "Menor Estoque" },
                      { id: "recent", label: "Mais Recentes" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.id as any);
                          setSortOpen(false);
                        }}
                        className={`w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center justify-between ${
                          sortBy === opt.id
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <Check className="size-3.5" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipProvider>
          </div>

          {/* Botão EXIBIR / OCULTAR ITENS ZERADOS */}
          <Button
            variant={showZeroStock ? "default" : "outline"}
            onClick={() => setShowZeroStock(!showZeroStock)}
            className={`h-11 rounded-xl gap-2 font-bold px-4 text-xs shrink-0 transition-all ${
              showZeroStock
                ? "bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {showZeroStock ? (
              <>
                <EyeOff className="size-4" />
                OCULTAR ITENS ZERADOS
              </>
            ) : (
              <>
                <Eye className="size-4" />
                EXIBIR ITENS ZERADOS
              </>
            )}
          </Button>
        </div>

        {/* Chips de filtros ativos */}
        {(selectedCategory !== "Todas" || selectedSupplier !== "Todos" || showZeroStock) && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {selectedCategory !== "Todas" && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 rounded-lg text-xs">
                <span>Categoria: {selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("Todas")}
                  className="hover:text-destructive transition-colors ml-0.5"
                  title="Remover filtro de categoria"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {selectedSupplier !== "Todos" && (
              <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 rounded-lg text-xs">
                <span>Fornecedor: {selectedSupplier}</span>
                <button
                  type="button"
                  onClick={() => setSelectedSupplier("Todos")}
                  className="hover:text-destructive transition-colors ml-0.5"
                  title="Remover filtro de fornecedor"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {showZeroStock && (
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-2.5 rounded-lg text-xs bg-amber-500/10 text-amber-600 border-amber-500/30"
              >
                <span>Exibindo produtos zerados</span>
                <button
                  type="button"
                  onClick={() => setShowZeroStock(false)}
                  className="hover:text-destructive transition-colors ml-0.5"
                  title="Ocultar produtos zerados"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("Todas");
                setSelectedSupplier("Todos");
                setShowZeroStock(false);
              }}
              className="text-[11px] font-semibold text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2 ml-1"
            >
              Limpar todos
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-72 animate-pulse rounded-[2rem] bg-card" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => {
            const stockRecord = stockRecords.find(s => s.produto_id === p.id);
            const numeracoes = stockRecord?.numeracoes || {};
            const allSizes = Object.entries(numeracoes as Record<string, number>)
              .map(([size, qty]) => ({ size, qty: Number(qty) }));
            const availableSizes = allSizes.filter(s => s.qty > 0).map(s => s.size);

            return (
              <Card key={p.id} className="group overflow-hidden rounded-[2rem] border-border/30 bg-card transition-all hover:shadow-xl shadow-elegant flex flex-col">
                <div className="relative aspect-video bg-muted/20 shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/10">
                      <Package className="size-16" />
                    </div>
                  )}
                </div>
                
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="mb-4">
                    <div className="flex justify-between items-start gap-2">
                       <h3 className="line-clamp-2 font-display font-black leading-tight flex-1 text-sm md:text-base">{p.name}</h3>
                       <div className="bg-success/10 text-success text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                          {p.current_stock}
                       </div>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1 flex items-center gap-1">
                      <Barcode className="size-3" /> {p.sku || "—"}
                    </p>
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Data de Entrada:</span>
                        <span className="font-medium text-right">{dateBR(stockRecord?.data_entrada || p.updated_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Categoria:</span>
                        <span className="font-medium text-right">{p.category}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground font-medium">Lote:</span>
                        <span className="font-mono text-[9px] truncate max-w-[150px] text-right">{stockRecord?.lote || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Cor:</span>
                        <span className="font-medium text-right">{p.color || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Localização:</span>
                        <span className="font-medium text-primary text-right">{stockRecord?.localizacao || "—"}</span>
                      </div>
                    </div>

                    {availableSizes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Numerações:</p>
                        <div className="flex flex-wrap gap-1">
                          {allSizes.length > 0 ? allSizes.map(({ size, qty }) => (
                            <Badge 
                              key={size} 
                              className={`px-2 py-0 h-5 text-[10px] font-black border-none cursor-pointer transition-all ${
                                qty > 0 ? "bg-black text-white hover:bg-black/80" : "bg-muted text-muted-foreground hover:bg-muted/80 opacity-40"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(p);
                                setSelectedSizeInfo({ size, quantity: qty });
                                setSizeDetailOpen(true);
                              }}
                            >
                              {size}
                            </Badge>
                          )) : availableSizes.map(size => (
                            <Badge 
                              key={size} 
                              className="bg-black text-white hover:bg-black px-2 py-0 h-5 text-[10px] font-black border-none cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(p);
                                setSelectedSizeInfo({ size, quantity: numeracoes[size] as number });
                                setSizeDetailOpen(true);
                              }}
                            >
                              {size}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border/30">
                      <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest mb-2">Valores Unitários</p>
                      <div className="grid grid-cols-3 gap-2">
                         <div className="text-left">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Custo</p>
                            <p className="font-bold text-[11px] text-orange-500">{brl(p.cost_price)}</p>
                         </div>
                         <div className="text-left border-x border-border/40 px-2">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Varejo</p>
                            <p className="font-bold text-[11px] text-success">{brl(p.sale_price)}</p>
                         </div>
                         <div className="text-left pl-2">
                            <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Atacado</p>
                            <p className="font-bold text-[11px] text-blue-600">{brl(p.wholesale_price)}</p>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg flex-1">
                      <TrendingUp className="size-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Disponível para venda</span>
                    </div>
                    <Button 
                       variant="outline" 
                       size="icon"
                       className="size-9 rounded-lg border-border/40 hover:bg-muted"
                       onClick={() => {
                          setSelectedProduct(p);
                          setNewQty(p.current_stock.toString());
                          setAdjustQuantities(stockRecord?.numeracoes || {});
                          setAdjustOpen(true);
                       }}
                    >
                       <Pencil className="size-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <Button 
                      variant="ghost" 
                      className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 font-bold h-7 gap-1"
                      onClick={() => handleDeleteItem(p.id)}
                    >
                      <Trash2 className="size-3" /> Excluir Item do Estoque
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Barra de Paginação */}
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={totalCount}
        itemName="produtos no estoque"
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque</DialogTitle>
            <DialogDescription>
               Alterando saldo de <span className="font-bold text-foreground">{selectedProduct?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             {selectedProduct?.category === "Sandálias" ? (
               <div className="space-y-4">
                 <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Numerações</Label>
                 <div className="grid grid-cols-4 gap-3">
                   {["33", "34", "35", "36", "37", "38", "39", "40"].map(size => (
                     <div key={size} className="space-y-1.5">
                       <Label className="text-[10px] font-bold block text-center">{size}</Label>
                       <Input 
                         type="number" 
                         value={adjustQuantities[size] || 0}
                         onChange={e => setAdjustQuantities({...adjustQuantities, [size]: Number(e.target.value)})}
                         className="h-10 text-center font-bold"
                       />
                     </div>
                   ))}
                 </div>
                 <div className="pt-2 border-t text-right">
                   <span className="text-xs font-bold">Total: {Object.values(adjustQuantities).reduce((a, b) => a + (Number(b) || 0), 0)}</span>
                 </div>
               </div>
             ) : (
               <>
                 <Label className="mb-2 block">Novo saldo disponível</Label>
                 <Input 
                    type="number" 
                    value={newQty} 
                    onChange={e => setNewQty(e.target.value)}
                    placeholder={`Saldo atual: ${selectedProduct?.current_stock}`}
                    className="h-12 text-lg font-bold"
                 />
               </>
             )}
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
             <Button onClick={handleAdjust} disabled={save.isPending}>Salvar Ajuste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={sizeDetailOpen} onOpenChange={setSizeDetailOpen}>
        <DialogContent className="sm:max-w-[320px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-gold p-6 flex flex-col items-center text-white text-center">
            <div className="size-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 border border-white/30">
              <Package className="size-8" />
            </div>
            <h3 className="font-display font-black text-lg leading-tight">{selectedProduct?.name}</h3>
            <p className="text-[10px] uppercase tracking-tighter opacity-80 font-bold mt-1">Gradeado de Estoque</p>
          </div>
          
          <div className="p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Tamanho</span>
              <div className="size-16 rounded-2xl bg-black flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl font-black">{selectedSizeInfo?.size}</span>
              </div>
            </div>

            <div className="w-full h-px bg-border/40" />

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Qtd Disponível</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-display font-black text-success">{selectedSizeInfo?.quantity}</span>
                <span className="text-[10px] font-black text-muted-foreground uppercase">Unidades</span>
              </div>
            </div>

            <Button 
              className="w-full bg-muted/50 hover:bg-muted text-foreground font-black text-[10px] uppercase tracking-widest h-10 rounded-xl mt-2 border-none"
              onClick={() => setSizeDetailOpen(false)}
            >
              FECHAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AddProductDirectModal open={addDirectOpen} onOpenChange={setAddDirectOpen} />
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
