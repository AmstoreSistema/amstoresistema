import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl, toISODate, formatSaleDateISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ArrowRightLeft,
  Loader2,
  Package,
  AlertCircle,
  CheckCircle2,
  BadgePercent,
  Coins,
  User,
  Calendar,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSaleDetails, editSaleItems } from "@/lib/sales.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProductSearch } from "./ProductSearch";
import { ClientSearch } from "./ClientSearch";
import { supabase } from "@/integrations/supabase/client";

interface EditableItem {
  id?: string;
  product_id: string;
  product_name: string;
  image_url?: string | null;
  quantity: number;
  unit_price: number;
  numeracao: string | null;
  discount: number;
  available_sizes?: string[];
  is_new?: boolean;
}

interface EditSaleModalProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditSaleModal({
  saleId,
  open,
  onOpenChange,
  onSuccess,
}: EditSaleModalProps) {
  const qc = useQueryClient();
  const fetchSale = useServerFn(getSaleDetails);
  const mutateEditSale = useServerFn(editSaleItems);

  const [items, setItems] = useState<EditableItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientName, setClientName] = useState<string>("");
  const [saleDate, setSaleDate] = useState<string>("");
  const [discountGeneral, setDiscountGeneral] = useState<number>(0);
  const [cashbackUsed, setCashbackUsed] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Busca dados da venda
  const { data: saleData, isLoading: isLoadingSale } = useQuery({
    queryKey: ["sale-details", saleId],
    queryFn: () => fetchSale({ data: { sale_id: saleId! } }),
    enabled: !!saleId && open,
  });

  // Busca todos os registros de stock_products para saber tamanhos disponíveis caso queira trocar tamanho
  const { data: stockRecords = [] } = useQuery({
    queryKey: ["stock_products_sizes_map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_products")
        .select("id, produto_id, numeracoes, quantidade_disponivel");
      return data || [];
    },
    enabled: open,
  });

  // Mapeia os tamanhos disponíveis por produto
  const productSizesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    stockRecords.forEach((s: any) => {
      if (s.produto_id && s.numeracoes && typeof s.numeracoes === "object") {
        const sizes = Object.entries(s.numeracoes)
          .filter(([_, qty]) => Number(qty) > 0)
          .map(([size]) => size)
          .sort((a, b) => {
            const nA = Number(a);
            const nB = Number(b);
            if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
            return a.localeCompare(b, undefined, { numeric: true });
          });
        if (sizes.length > 0) {
          map.set(s.produto_id, sizes);
        }
      }
    });
    return map;
  }, [stockRecords]);

  // Carrega os dados da venda no estado local ao abrir
  useEffect(() => {
    if (saleData?.items) {
      const loaded: EditableItem[] = saleData.items.map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.products?.name || "Produto",
        image_url: i.products?.image_url || null,
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        numeracao: i.numeracao || null,
        discount: Number(i.discount) || 0,
        available_sizes: productSizesMap.get(i.product_id) || [],
        is_new: false,
      }));
      setItems(loaded);
    }
    if (saleData?.sale) {
      const c = (saleData.sale as any).clients || null;
      setSelectedClient(c);
      setClientName(c?.name || "");
      setSaleDate(saleData.sale.created_at ? toISODate(saleData.sale.created_at) : "");
      setDiscountGeneral(Number(saleData.sale.discount_amount ?? saleData.sale.discount ?? 0));
      setCashbackUsed(Number(saleData.sale.cashback_used ?? 0));
    }
  }, [saleData, productSizesMap]);

  const sale = saleData?.sale;
  const originalTotal = Number(sale?.total_amount || 0);

  // Calcula novo subtotal dos itens
  const newSubtotal = useMemo(() => {
    return items.reduce(
      (acc, i) => acc + (i.quantity * i.unit_price - (i.discount || 0)),
      0
    );
  }, [items]);

  const newTotal = Math.max(0, Number((newSubtotal - discountGeneral - cashbackUsed).toFixed(2)));
  const diff = Number((newTotal - originalTotal).toFixed(2));

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setClientName(client?.name || "");
  };

  // Adiciona produto vindo do ProductSearch
  const handleAddProduct = (stockItem: any, size: string | null) => {
    const newItem: EditableItem = {
      product_id: stockItem.produto_id,
      product_name: stockItem.produto_nome,
      image_url: stockItem.imagem_url || null,
      quantity: 1,
      unit_price: Number(stockItem.preco_venda || 0),
      numeracao: size,
      discount: 0,
      available_sizes: productSizesMap.get(stockItem.produto_id) || [],
      is_new: true,
    };

    setItems((prev) => [...prev, newItem]);
    setShowProductSearch(false);
    toast.success(`"${stockItem.produto_nome}" adicionado à venda.`);
  };

  // Altera quantidade de um item
  const handleChangeQty = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const newQty = target.quantity + delta;
      if (newQty <= 0) return next;
      next[index] = { ...target, quantity: newQty };
      return next;
    });
  };

  // Altera desconto de um item específico
  const handleChangeItemDiscount = (index: number, discount: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], discount: Math.max(0, discount) };
      return next;
    });
  };

  // Altera preço unitário de um item
  const handleChangeUnitPrice = (index: number, unit_price: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unit_price: Math.max(0, unit_price) };
      return next;
    });
  };

  // Altera numeração de um item
  const handleChangeNumeracao = (index: number, newSize: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], numeracao: newSize };
      return next;
    });
    toast.success(`Numeração alterada para ${newSize}.`);
  };

  // Remove um item da venda
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("A venda precisa conter pelo menos 1 produto.");
      return;
    }
    const itemToRemove = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    toast.info(`"${itemToRemove.product_name}" removido. O estoque será devolvido ao salvar.`);
  };

  // Confirma e salva a edição
  const handleSave = async () => {
    if (!saleId) return;
    if (items.length === 0) {
      toast.error("A venda precisa ter pelo menos um produto.");
      return;
    }

    setIsSaving(true);
    try {
      let clientIdToSave: string | null = selectedClient?.id || null;

      // Se o usuário digitou ou alterou o nome da cliente
      if (clientName && clientName.trim().length > 0) {
        const trimmed = clientName.trim();
        if (selectedClient?.id) {
          // Atualiza o nome da cliente existente se mudou
          if (trimmed !== selectedClient.name) {
            await supabase.from("clients").update({ name: trimmed }).eq("id", selectedClient.id);
          }
        } else {
          // Cliente não cadastrada ainda ("Consumidor Final" com nome digitado)
          const { data: newC } = await supabase
            .from("clients")
            .insert({ name: trimmed })
            .select()
            .single();
          if (newC) {
            clientIdToSave = newC.id;
          }
        }
      }

      const payloadItems = items.map((i) => ({
        id: i.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        numeracao: i.numeracao,
        discount: i.discount,
      }));

      await mutateEditSale({
        data: {
          sale_id: saleId,
          client_id: clientIdToSave,
          created_at: saleDate ? formatSaleDateISO(saleDate) : undefined,
          items: payloadItems,
          discount_general: discountGeneral,
          cashback_used: cashbackUsed,
        },
      });

      toast.success("Venda atualizada com sucesso! Estoque e dados sincronizados.");
      // Invalida todos os caches pertinentes
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sale-details", saleId] }),
        qc.invalidateQueries({ queryKey: ["sales"] }),
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["stock_products"] }),
        qc.invalidateQueries({ queryKey: ["stock-products"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["stock_products_with_images"] }),
      ]);

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar a venda.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-4xl max-h-[92vh] p-0 overflow-hidden bg-card border-border/80 shadow-2xl flex flex-col rounded-2xl sm:rounded-[1.5rem]">
        {/* Header do Modal */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold shrink-0">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Editar Venda #{sale?.sale_code || saleId?.slice(0, 8)}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Edite a cliente, troque produtos, ajuste descontos ou cashback com atualização automática de estoque.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo Principal com Rolagem Única e Fluida */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isLoadingSale ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="size-6 animate-spin text-gold" />
              Carregando dados da venda...
            </div>
          ) : (
            <>
              {/* SEÇÃO 1: Cliente e Dados da Venda */}
              <div className="bg-muted/30 border border-border/70 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
                      <User className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-foreground">Cliente e Dados da Venda</h3>
                      <p className="text-[11px] text-muted-foreground">Vincule outra cliente, edite o nome ou ajuste a data da venda</p>
                    </div>
                  </div>
                  {selectedClient && (
                    <Badge variant="outline" className="text-[10px] font-bold bg-background text-muted-foreground">
                      Cadastrada
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Buscar / Selecionar Cliente
                    </label>
                    <ClientSearch selectedClient={selectedClient} onSelect={handleSelectClient} />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Nome da Cliente (Editável)
                    </label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Nome da cliente na venda..."
                      className="h-11 rounded-xl bg-background border-border/40 font-semibold text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-gold" />
                      Data da Venda
                    </label>
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="h-11 rounded-xl bg-background border-border/40 font-semibold text-sm cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: Produtos da Venda */}
              <div className="bg-muted/30 border border-border/70 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Package className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                        Produtos da Venda
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-black h-5">
                          {items.length} {items.length === 1 ? "item" : "itens"}
                        </Badge>
                      </h3>
                      <p className="text-[11px] text-muted-foreground">Troque numerações, ajuste quantidades e preços</p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold gap-1.5 h-9 bg-background shadow-sm border-gold/40 text-gold hover:bg-gold/10"
                    onClick={() => setShowProductSearch(!showProductSearch)}
                  >
                    <Plus className="size-4" /> Adicionar Produto do Estoque
                  </Button>
                </div>

                {/* Seletor de busca de produto */}
                {showProductSearch && (
                  <div className="p-4 rounded-xl border-2 border-dashed border-gold/40 bg-gold/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gold uppercase tracking-wider">
                        Selecione o produto no estoque para incluir na venda:
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setShowProductSearch(false)}
                      >
                        Cancelar busca
                      </Button>
                    </div>
                    <ProductSearch onAdd={handleAddProduct} />
                  </div>
                )}

                {/* Lista de itens em cards confortáveis */}
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const availableSizes =
                      item.available_sizes && item.available_sizes.length > 0
                        ? item.available_sizes
                        : productSizesMap.get(item.product_id) || [];
                    const itemSubtotal = item.quantity * item.unit_price - (item.discount || 0);

                    return (
                      <div
                        key={`${item.product_id}-${item.numeracao}-${idx}`}
                        className={cn(
                          "p-4 rounded-xl border bg-background flex flex-col gap-3.5 transition-all shadow-xs",
                          item.is_new
                            ? "border-gold/50 bg-gold/[0.03] shadow-sm shadow-gold/5"
                            : "border-border/60 hover:border-border"
                        )}
                      >
                        {/* Topo do item: Foto, Nome e Botão de Remover */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="size-12 rounded-xl bg-muted/40 border border-border/60 shrink-0 overflow-hidden flex items-center justify-center">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <Package className="size-6 text-muted-foreground/40" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-foreground truncate">
                                  {item.product_name}
                                </h4>
                                {item.is_new && (
                                  <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0">
                                    Novo Item
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                            title="Remover produto da venda (devolve ao estoque)"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {/* Numeração de calçado / sandália */}
                        {item.numeracao && (
                          <div className="flex items-center gap-2 flex-wrap bg-muted/30 p-2.5 rounded-lg border border-border/40 text-xs">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase">
                              Numeração Atual:
                            </span>
                            <Badge className="bg-black text-white text-xs font-black h-6 px-2.5">
                              Nº {item.numeracao}
                            </Badge>

                            {availableSizes.filter((s) => s !== item.numeracao).length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap ml-2">
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  Trocar para:
                                </span>
                                {availableSizes
                                  .filter((s) => s !== item.numeracao)
                                  .map((size) => (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => handleChangeNumeracao(idx, size)}
                                      className="text-[11px] font-bold px-2 py-0.5 rounded border border-border bg-background hover:bg-gold/15 hover:text-gold hover:border-gold transition-colors"
                                      title={`Trocar para tamanho ${size}`}
                                    >
                                      {size}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Grid de Quantidade, Preço, Desconto e Subtotal */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2.5 border-t border-border/40 items-center">
                          {/* Quantidade */}
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                              Quantidade
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="size-8 rounded-lg"
                                onClick={() => handleChangeQty(idx, -1)}
                                disabled={item.quantity <= 1}
                              >
                                -
                              </Button>
                              <span className="w-8 text-center text-sm font-bold">
                                {item.quantity}
                              </span>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="size-8 rounded-lg"
                                onClick={() => handleChangeQty(idx, 1)}
                              >
                                +
                              </Button>
                            </div>
                          </div>

                          {/* Preço Unitário */}
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                              Preço Unitário
                            </span>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                                R$
                              </span>
                              <Input
                                type="number"
                                min={0}
                                step="0.50"
                                value={item.unit_price}
                                onChange={(e) =>
                                  handleChangeUnitPrice(idx, Number(e.target.value) || 0)
                                }
                                className="h-8 pl-8 text-xs font-bold"
                              />
                            </div>
                          </div>

                          {/* Desconto do Item */}
                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-600 block mb-1">
                              Desconto Item
                            </span>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600">
                                R$
                              </span>
                              <Input
                                type="number"
                                min={0}
                                step="0.50"
                                value={item.discount || 0}
                                onChange={(e) =>
                                  handleChangeItemDiscount(idx, Number(e.target.value) || 0)
                                }
                                className="h-8 pl-8 text-xs font-bold text-amber-600"
                              />
                            </div>
                          </div>

                          {/* Subtotal do Item */}
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                              Subtotal Item
                            </span>
                            <p className="text-sm font-black text-foreground">{brl(itemSubtotal)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 3: Desconto Geral, Cashback e Resumo Financeiro */}
              <div className="bg-muted/30 border border-border/70 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <BadgePercent className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">
                      Desconto Geral e Cashback da Venda
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Ajuste os abatimentos aplicados no fechamento da venda
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <BadgePercent className="size-3.5 text-amber-600" /> Desconto Geral da Venda
                      </label>
                      {discountGeneral > 0 && (
                        <span className="text-xs font-bold text-amber-600">
                          - {brl(discountGeneral)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        R$
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.50"
                        value={discountGeneral}
                        onChange={(e) =>
                          setDiscountGeneral(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="0,00"
                        className="h-10 pl-9 font-bold text-sm bg-background"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Coins className="size-3.5 text-gold" /> Cashback Utilizado
                      </label>
                      {cashbackUsed > 0 && (
                        <span className="text-xs font-bold text-gold">- {brl(cashbackUsed)}</span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        R$
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.50"
                        value={cashbackUsed}
                        onChange={(e) =>
                          setCashbackUsed(Math.max(0, Number(e.target.value) || 0))
                        }
                        placeholder="0,00"
                        className="h-10 pl-9 font-bold text-sm bg-background"
                      />
                    </div>
                  </div>
                </div>

                {/* Painel de Resumo dos Totais */}
                <div className="bg-background rounded-xl border border-border/80 p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Subtotal Itens
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        {brl(newSubtotal)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Descontos / Cashback
                      </span>
                      <span className="font-bold text-sm text-amber-600">
                        - {brl(discountGeneral + cashbackUsed)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Novo Total da Venda
                      </span>
                      <span className="font-black text-base text-foreground">
                        {brl(newTotal)}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Diferença (vs Original {brl(originalTotal)})
                      </span>
                      {diff === 0 ? (
                        <span className="font-bold text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="size-3.5" /> Mesmo valor
                        </span>
                      ) : diff > 0 ? (
                        <span className="font-black text-xs text-amber-600 block mt-0.5">
                          + {brl(diff)} (A cobrar)
                        </span>
                      ) : (
                        <span className="font-black text-xs text-blue-600 block mt-0.5">
                          - {brl(Math.abs(diff))} (Crédito/Troco)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border/40">
                    <AlertCircle className="size-3.5 text-gold shrink-0" />
                    Ao salvar, o estoque será atualizado automaticamente (produtos substituídos retornam ao estoque e novos produtos dão baixa).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Botões de Ação */}
        <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/10 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="outline"
            className="rounded-xl font-bold text-xs h-10 px-4"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>

          <Button
            className="rounded-xl font-bold text-xs h-10 px-5 gap-2 bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90"
            onClick={handleSave}
            disabled={isSaving || isLoadingSale || items.length === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando alterações...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
