import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  PackageCheck,
  Plus,
  Search,
  User,
  Package,
  CheckCircle2,
  RotateCcw,
  Clock,
  ChevronRight,
  X,
  ShoppingCart,
  Trash2,
  Hash,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ClientSearch } from "@/components/sales/ClientSearch";
import { ProductSearch } from "@/components/sales/ProductSearch";
import { POSModal } from "@/components/sales/POSModal";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/condicionais")({
  head: () => ({
    meta: [
      { title: "Condicionais — Amstore Gestão" },
      { name: "description", content: "Gerencie saídas e retornos de condicionais." },
    ],
  }),
  component: CondicionaisPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CartItem {
  id: string;       // chave única: `${stock_id}-${numeracao}`
  stock_id: string | null;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  numeracao: string | null;
  discount: number;
  imagem_url?: string | null;
  skipStockDecrement?: boolean;
}

interface Condicional {
  id: string;
  codigo: string;
  client_id: string | null;
  client_name: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
}

interface CondicionalItem {
  id: string;
  condicional_id: string;
  stock_id: string | null;
  product_id: string;
  product_name: string;
  numeracao: string | null;
  price: number;
  quantity: number;
  status: string; // pendente | confirmado | devolvido
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genCodigo = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `C${ymd}-${rand}`;
};

// ─── Página principal ─────────────────────────────────────────────────────────
function CondicionaisPage() {
  const qc = useQueryClient();

  // ── Queries ──
  const { data: condicionais = [], refetch: refetchCondicionais } = useQuery<Condicional[]>({
    queryKey: ["condicionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condicionais" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // ── Aba / estado global ──
  const [activeTab, setActiveTab] = React.useState("saida");
  const [term, setTerm] = React.useState("");

  // ── Estado da aba "Nova Saída" ──
  const [client, setClient] = React.useState<any>(null);
  const [cartItems, setCartItems] = React.useState<CartItem[]>([]);
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // ── Modal de Retorno ──
  const [retornoOpen, setRetornoOpen] = React.useState(false);
  const [activeCondicional, setActiveCondicional] = React.useState<Condicional | null>(null);
  const [condicionalItems, setCondicionalItems] = React.useState<CondicionalItem[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  // ── PDV injeção ──
  const [posOpen, setPosOpen] = React.useState(false);
  const [posInitialClient, setPosInitialClient] = React.useState<any>(null);
  const [posInitialItems, setPosInitialItems] = React.useState<CartItem[]>([]);

  // ── Estatísticas ──
  const abertos = React.useMemo(() => condicionais.filter(c => c.status === "aberto"), [condicionais]);
  const fechados = React.useMemo(() => condicionais.filter(c => c.status === "fechado"), [condicionais]);

  // ── Filtro na aba retorno ──
  const filteredAbertos = React.useMemo(() => {
    const t = term.toLowerCase();
    return abertos.filter(c =>
      (c.codigo || "").toLowerCase().includes(t) ||
      (c.client_name || "").toLowerCase().includes(t)
    );
  }, [abertos, term]);

  // ── Adicionar item ao carrinho (compatível com ProductSearch) ──
  const handleAddProduct = (stock: any, numeracao: string | null) => {
    const key = `${stock.id}-${numeracao ?? "default"}`;
    setCartItems(prev => {
      const existing = prev.find(i => i.id === key);
      if (existing) {
        return prev.map(i => i.id === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: key,
        stock_id: stock.id.startsWith("virtual:") ? null : stock.id,
        product_id: stock.produto_id,
        name: stock.produto_nome,
        price: Number(stock.preco_venda),
        quantity: 1,
        numeracao,
        discount: 0,
        imagem_url: stock.imagem_url,
      }];
    });
    toast.success(`${stock.produto_nome}${numeracao ? ` (Nº ${numeracao})` : ""} adicionado`);
  };

  // ── Registrar saída condicional ──
  const handleRegistrarSaida = async () => {
    if (cartItems.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }
    setIsSubmitting(true);
    try {
      const codigo = genCodigo();

      // 1. Insere cabeçalho do condicional
      const { data: cond, error: condErr } = await supabase
        .from("condicionais" as any)
        .insert({
          codigo,
          client_id: client?.id ?? null,
          client_name: client?.name ?? null,
          status: "aberto",
          notes: notes || null,
        })
        .select()
        .single();

      if (condErr) throw condErr;
      const condId = (cond as any).id;

      // 2. Insere itens
      const itemsToInsert = cartItems.map(item => ({
        condicional_id: condId,
        stock_id: item.stock_id,
        product_id: item.product_id,
        product_name: item.name,
        numeracao: item.numeracao,
        price: item.price,
        quantity: item.quantity,
        status: "pendente",
      }));

      const { error: itemsErr } = await supabase
        .from("condicional_items" as any)
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      // 3. Debita estoque para cada item
      for (const item of cartItems) {
        if (item.stock_id) {
          // Busca o registro atual de stock_products
          const { data: stockRow } = await supabase
            .from("stock_products")
            .select("quantidade_disponivel, numeracoes")
            .eq("id", item.stock_id)
            .single();

          if (stockRow) {
            const updates: Record<string, any> = {
              quantidade_disponivel: Math.max(0, Number(stockRow.quantidade_disponivel) - item.quantity),
            };
            // Se houver grade de numerações, debita a numeração específica
            const numsRaw = stockRow.numeracoes as any;
            if (item.numeracao && numsRaw && typeof numsRaw === "object" && !Array.isArray(numsRaw)) {
              const nums: Record<string, any> = { ...numsRaw };
              nums[item.numeracao] = Math.max(0, (Number(nums[item.numeracao]) || 0) - item.quantity);
              updates["numeracoes"] = nums;
            }
            await supabase.from("stock_products").update(updates as any).eq("id", item.stock_id);
          }
        }

        // Debita também em products.current_stock
        if (item.product_id) {
          await supabase.rpc("decrement_product_stock" as any, {
            p_product_id: item.product_id,
            p_qty: item.quantity,
          }).then(({ error }) => {
            if (error) {
              // Fallback manual se RPC não existir
              supabase
                .from("products")
                .select("current_stock")
                .eq("id", item.product_id)
                .single()
                .then(({ data: p }) => {
                  if (p) {
                    supabase.from("products").update({
                      current_stock: Math.max(0, Number(p.current_stock) - item.quantity)
                    }).eq("id", item.product_id);
                  }
                });
            }
          });
        }
      }

      toast.success(`Condicional ${codigo} registrado! Estoque debitado.`);
      setCartItems([]);
      setClient(null);
      setNotes("");
      await refetchCondicionais();
      qc.invalidateQueries({ queryKey: ["stock_products"] });
      qc.invalidateQueries({ queryKey: ["stock_products_with_images"] });
      setActiveTab("retorno");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar condicional");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Abre modal de retorno ──
  const handleOpenRetorno = async (cond: Condicional) => {
    setActiveCondicional(cond);
    setLoadingItems(true);
    setRetornoOpen(true);
    try {
      const { data, error } = await supabase
        .from("condicional_items" as any)
        .select("*")
        .eq("condicional_id", cond.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setCondicionalItems((data as any[]) ?? []);
    } catch (e: any) {
      toast.error("Erro ao carregar itens");
    } finally {
      setLoadingItems(false);
    }
  };

  // ── Confirmar item ──
  const handleConfirmar = async (item: CondicionalItem) => {
    setProcessingId(item.id);
    try {
      const { error } = await supabase
        .from("condicional_items" as any)
        .update({ status: "confirmado", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;
      setCondicionalItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "confirmado" } : i));
      toast.success(`"${item.product_name}" confirmado`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao confirmar item");
    } finally {
      setProcessingId(null);
    }
  };

  // ── Devolver item → devolve ao estoque ──
  const handleDevolver = async (item: CondicionalItem) => {
    setProcessingId(item.id);
    try {
      // 1. Marca item como devolvido
      const { error } = await supabase
        .from("condicional_items" as any)
        .update({ status: "devolvido", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;

      // 2. Devolve ao stock_products
      if (item.stock_id) {
        const { data: stockRow } = await supabase
          .from("stock_products")
          .select("quantidade_disponivel, numeracoes")
          .eq("id", item.stock_id)
          .single();

        if (stockRow) {
          const updates: Record<string, any> = {
            quantidade_disponivel: Number(stockRow.quantidade_disponivel) + item.quantity,
          };
          const numsRaw2 = stockRow.numeracoes as any;
          if (item.numeracao && numsRaw2 && typeof numsRaw2 === "object" && !Array.isArray(numsRaw2)) {
            const nums: Record<string, any> = { ...numsRaw2 };
            nums[item.numeracao] = (Number(nums[item.numeracao]) || 0) + item.quantity;
            updates["numeracoes"] = nums;
          }
          await supabase.from("stock_products").update(updates as any).eq("id", item.stock_id);
        }
      }

      // 3. Devolve ao products.current_stock
      if (item.product_id) {
        const { data: p } = await supabase
          .from("products")
          .select("current_stock")
          .eq("id", item.product_id)
          .single();
        if (p) {
          await supabase.from("products").update({
            current_stock: Number(p.current_stock) + item.quantity,
          }).eq("id", item.product_id);
        }
      }

      setCondicionalItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "devolvido" } : i));
      toast.success(`"${item.product_name}" devolvido ao estoque`);
      qc.invalidateQueries({ queryKey: ["stock_products"] });
      qc.invalidateQueries({ queryKey: ["stock_products_with_images"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao devolver item");
    } finally {
      setProcessingId(null);
    }
  };

  // ── Faturar itens confirmados → injeta no PDV ──
  const handleFaturar = async () => {
    const confirmados = condicionalItems.filter(i => i.status === "confirmado");
    if (confirmados.length === 0) {
      toast.error("Confirme pelo menos um item antes de faturar");
      return;
    }

    try {
      // Fecha o condicional
      const { error } = await supabase
        .from("condicionais" as any)
        .update({ status: "fechado", closed_at: new Date().toISOString() })
        .eq("id", activeCondicional!.id);
      if (error) throw error;

      // Monta os itens para injetar no PDV (com flag para não debitar estoque novamente)
      const posItems: CartItem[] = confirmados.map(item => ({
        id: `cond-${item.id}`,
        stock_id: item.stock_id ?? `virtual:${item.product_id}`,
        product_id: item.product_id,
        name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        numeracao: item.numeracao,
        imagem_url: null,
        // Flag especial: estoque já foi debitado na saída do condicional
        skipStockDecrement: true,
      } as any));

      // Busca dados do cliente se necessário
      let clientObj: any = null;
      if (activeCondicional?.client_id) {
        const { data: c } = await supabase
          .from("clients")
          .select("*")
          .eq("id", activeCondicional.client_id)
          .single();
        clientObj = c;
      }

      setRetornoOpen(false);
      await refetchCondicionais();
      qc.invalidateQueries({ queryKey: ["condicionais"] });

      // Pequeno delay para o modal de retorno fechar antes de abrir o PDV
      await new Promise(r => setTimeout(r, 200));
      setPosInitialClient(clientObj);
      setPosInitialItems(posItems);
      setPosOpen(true);
      toast.success("Condicional fechado! Finalize a venda no PDV.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao faturar");
    }
  };

  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const pendentes = condicionalItems.filter(i => i.status === "pendente").length;
  const confirmados = condicionalItems.filter(i => i.status === "confirmado").length;
  const devolvidos = condicionalItems.filter(i => i.status === "devolvido").length;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Condicionais"
        description="Saídas para avaliação e retorno de mercadorias"
        icon={PackageCheck}
        actions={
          <Button
            className="gap-2 bg-gradient-gold border-none shadow-gold font-bold"
            onClick={() => setActiveTab("saida")}
          >
            <Plus className="size-4" /> Nova Saída
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Condicionais Abertos" value={abertos.length} icon={Clock} tone="warning" />
        <StatCard title="Fechados" value={fechados.length} icon={CheckCircle2} tone="dark" />
        <StatCard title="Total de Saídas" value={condicionais.length} icon={PackageCheck} tone="gold" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-11 rounded-2xl bg-card border border-border/40 p-1">
          <TabsTrigger value="saida" className="rounded-xl px-5 font-semibold data-[state=active]:bg-gradient-gold data-[state=active]:text-primary-foreground data-[state=active]:shadow-gold">
            <Plus className="size-4 mr-2" />Nova Saída
          </TabsTrigger>
          <TabsTrigger value="retorno" className="rounded-xl px-5 font-semibold data-[state=active]:bg-gradient-gold data-[state=active]:text-primary-foreground data-[state=active]:shadow-gold">
            <RotateCcw className="size-4 mr-2" />Condicionais Abertos
            {abertos.length > 0 && (
              <Badge className="ml-2 h-5 min-w-5 rounded-full bg-destructive/80 text-[10px] font-black px-1.5">
                {abertos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── ABA: Nova Saída ── */}
        <TabsContent value="saida" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Coluna esquerda: busca */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="rounded-3xl border-border/50 bg-card overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="size-4 text-gold" />
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Cliente</span>
                  </div>
                  <ClientSearch
                    selectedClient={client}
                    onSelect={setClient}
                  />

                  <Separator />

                  <div className="flex items-center gap-2 mb-1">
                    <Package className="size-4 text-gold" />
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Produto</span>
                  </div>
                  <ProductSearch onAdd={handleAddProduct} />

                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Observações
                    </Label>
                    <Textarea
                      className="mt-2 rounded-2xl resize-none bg-card border-border/40"
                      placeholder="Ex: Deixou para experimentar em casa..."
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna direita: carrinho */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-3xl border-border/50 bg-card overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-gold" />
                    <span className="font-bold text-sm">Itens da Saída</span>
                    {cartItems.length > 0 && (
                      <Badge className="ml-auto bg-gold/10 text-gold text-xs font-black border-none">
                        {cartItems.length} {cartItems.length === 1 ? "item" : "itens"}
                      </Badge>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 gap-2">
                      <ShoppingCart className="size-10" />
                      <p className="text-sm">Nenhum item adicionado</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[340px]">
                      <div className="space-y-2">
                        {cartItems.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-2xl bg-muted/30 border border-border/30 p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.numeracao && (
                                  <Badge className="bg-blue-600/10 text-blue-600 border-none text-[10px] font-black h-4 px-1.5">
                                    <Hash className="size-2.5 mr-0.5" />Nº {item.numeracao}
                                  </Badge>
                                )}
                                <span className="text-[11px] text-muted-foreground">Qtd: {item.quantity}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-gold">{brl(item.price * item.quantity)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setCartItems(prev => prev.filter(i => i.id !== item.id))}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {cartItems.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-sm text-muted-foreground">Total estimado</span>
                        <span className="text-lg text-gold">{brl(subtotal)}</span>
                      </div>
                    </>
                  )}

                  <Button
                    className="w-full h-12 rounded-2xl gap-2 bg-gradient-gold border-none shadow-gold font-bold text-primary-foreground"
                    onClick={handleRegistrarSaida}
                    disabled={isSubmitting || cartItems.length === 0}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Registrando...
                      </span>
                    ) : (
                      <>
                        <PackageCheck className="size-5" /> Registrar Saída Condicional
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── ABA: Condicionais Abertos ── */}
        <TabsContent value="retorno" className="mt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou cliente..."
                className="pl-10 h-11 rounded-2xl bg-card border-border/40"
                value={term}
                onChange={e => setTerm(e.target.value)}
              />
            </div>

            {filteredAbertos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50 gap-3">
                <PackageCheck className="size-12" />
                <p className="font-semibold">Nenhum condicional aberto</p>
                <p className="text-sm">Registre uma nova saída na aba ao lado</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAbertos.map(cond => (
                  <Card
                    key={cond.id}
                    className="rounded-3xl border-border/50 bg-card hover:shadow-xl hover:shadow-gold/5 transition-all cursor-pointer group"
                    onClick={() => handleOpenRetorno(cond)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-warning/10 text-warning border-none text-[10px] font-black uppercase">
                              Aberto
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">{cond.codigo}</span>
                          </div>
                          <p className="font-bold text-sm truncate">{cond.client_name || "Consumidor"}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            {dateBR(cond.created_at)}
                          </div>
                        </div>
                        <ChevronRight className="size-5 text-muted-foreground/40 group-hover:text-gold transition-colors shrink-0 mt-1" />
                      </div>
                      {cond.notes && (
                        <p className="mt-3 text-xs text-muted-foreground italic line-clamp-1 border-t border-border/30 pt-2">
                          {cond.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Modal de Retorno ─── */}
      <Dialog open={retornoOpen} onOpenChange={setRetornoOpen}>
        <DialogContent className="max-w-2xl max-h-[95vh] rounded-3xl p-0 border-none bg-white overflow-hidden [&>button]:hidden">
          <DialogHeader className="border-b px-6 py-4 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <PackageCheck className="size-5 text-gold" />
                  Condicional {activeCondicional?.codigo}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {activeCondicional?.client_name || "Consumidor"} · {dateBR(activeCondicional?.created_at ?? "")}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setRetornoOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="p-6 space-y-3">
              {loadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <span className="size-8 animate-spin rounded-full border-4 border-gold/30 border-t-gold" />
                </div>
              ) : condicionalItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="size-10 mx-auto mb-2 opacity-40" />
                  <p>Nenhum item encontrado</p>
                </div>
              ) : (
                condicionalItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                      item.status === "confirmado"
                        ? "border-success/30 bg-success/5"
                        : item.status === "devolvido"
                        ? "border-border/30 bg-muted/20 opacity-60"
                        : "border-border/50 bg-card"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.product_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.numeracao ? (
                          <Badge className="bg-blue-600/10 text-blue-600 border-none text-[10px] font-black h-4 px-1.5">
                            <Hash className="size-2.5 mr-0.5" />Nº {item.numeracao}
                          </Badge>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">Qtd: {item.quantity}</span>
                        <span className="text-[11px] font-bold text-gold">{brl(item.price)}</span>
                      </div>
                    </div>

                    {/* Badge de status */}
                    <div className="shrink-0">
                      {item.status === "confirmado" && (
                        <Badge className="bg-success/10 text-success border-none font-black text-[10px] uppercase">
                          <CheckCircle2 className="size-3 mr-1" />Confirmado
                        </Badge>
                      )}
                      {item.status === "devolvido" && (
                        <Badge className="bg-muted text-muted-foreground border-none font-black text-[10px] uppercase">
                          <RotateCcw className="size-3 mr-1" />Devolvido
                        </Badge>
                      )}
                    </div>

                    {/* Botões de ação (só para pendentes) */}
                    {item.status === "pendente" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 rounded-xl bg-success hover:bg-success/90 text-white font-bold text-xs"
                          disabled={processingId === item.id}
                          onClick={() => handleConfirmar(item)}
                        >
                          {processingId === item.id ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 rounded-xl font-bold text-xs text-warning border-warning/40 hover:bg-warning/10"
                          disabled={processingId === item.id}
                          onClick={() => handleDevolver(item)}
                        >
                          {processingId === item.id ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          Devolver
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Resumo + Botão Faturar */}
          {!loadingItems && condicionalItems.length > 0 && (
            <div className="border-t bg-muted/30 px-6 py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-4 text-muted-foreground">
                  <span>🟡 Pendentes: <strong className="text-foreground">{pendentes}</strong></span>
                  <span>✅ Confirmados: <strong className="text-success">{confirmados}</strong></span>
                  <span>🔄 Devolvidos: <strong className="text-foreground">{devolvidos}</strong></span>
                </div>
              </div>
              {confirmados > 0 && (
                <Button
                  className="w-full h-12 rounded-2xl gap-2 bg-gradient-gold border-none shadow-gold font-bold text-primary-foreground"
                  onClick={handleFaturar}
                >
                  <ShoppingCart className="size-5" />
                  Faturar {confirmados} {confirmados === 1 ? "Item Confirmado" : "Itens Confirmados"} no PDV
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── PDV com injeção de dados do condicional ─── */}
      <POSModal
        open={posOpen}
        onOpenChange={setPosOpen}
        initialClient={posInitialClient}
        initialItems={posInitialItems as any}
      />
    </div>
  );
}
