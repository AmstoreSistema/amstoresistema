import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ArrowRightLeft,
  Loader2,
  Package,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSaleDetails, editSaleItems } from "@/lib/sales.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProductSearch } from "./ProductSearch";
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

  // Carrega os itens da venda no estado local ao abrir
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
  }, [saleData, productSizesMap]);

  const sale = saleData?.sale;
  const originalTotal = Number(sale?.total_amount || 0);

  // Calcula novo total
  const newSubtotal = useMemo(() => {
    return items.reduce(
      (acc, i) => acc + i.quantity * i.unit_price - (i.discount || 0),
      0
    );
  }, [items]);

  const discountGeneral = Number(sale?.discount_amount ?? sale?.discount ?? 0);
  const cashbackUsed = Number(sale?.cashback_used || 0);
  const newTotal = Math.max(0, newSubtotal - discountGeneral - cashbackUsed);
  const diff = Number((newTotal - originalTotal).toFixed(2));

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
          items: payloadItems,
        },
      });

      toast.success("Venda atualizada com sucesso! O estoque foi sincronizado.");
      // Invalida todos os caches pertinentes
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sale-details", saleId] }),
        qc.invalidateQueries({ queryKey: ["sales"] }),
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
      <DialogContent className="w-[96vw] sm:max-w-3xl p-0 overflow-hidden bg-card border-border/80 shadow-2xl flex flex-col h-[90vh] rounded-2xl sm:rounded-[1.5rem]">
        {/* Header do Modal */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold shrink-0">
                <ArrowRightLeft className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Editar Venda #{sale?.sale_code || saleId?.slice(0, 8)}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Troque produtos ou numerações. O estoque anterior será devolvido e o novo será baixado automaticamente.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-5 space-y-4">
          {isLoadingSale ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin" />
              Carregando itens da venda...
            </div>
          ) : (
            <>
              {/* Botão para Adicionar / Trocar por outro produto do estoque */}
              <div className="flex items-center justify-between gap-2 bg-muted/40 p-3 rounded-xl border border-border/60">
                <div>
                  <p className="text-xs font-bold text-foreground">Troca de Produtos</p>
                  <p className="text-[11px] text-muted-foreground">
                    Remova itens ou adicione novos produtos disponíveis no estoque
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-bold gap-1.5 h-9 bg-background shadow-sm border-border hover:bg-gold/10 hover:text-gold"
                  onClick={() => setShowProductSearch(true)}
                >
                  <Plus className="size-4" /> Adicionar Produto
                </Button>
              </div>

              {/* Seletor de produto (Popover de busca) */}
              {showProductSearch && (
                <div className="p-4 rounded-xl border-2 border-dashed border-gold/40 bg-gold/5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gold uppercase tracking-wider">
                      Selecione o produto no estoque para incluir na venda:
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setShowProductSearch(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                  <ProductSearch onAdd={handleAddProduct} />
                </div>
              )}

              {/* Lista dos itens da venda */}
              <ScrollArea className="flex-1 rounded-xl border border-border bg-card pr-3">
                <div className="divide-y divide-border/60">
                  {items.map((item, idx) => {
                    const availableSizes =
                      item.available_sizes && item.available_sizes.length > 0
                        ? item.available_sizes
                        : productSizesMap.get(item.product_id) || [];

                    return (
                      <div
                        key={`${item.product_id}-${item.numeracao}-${idx}`}
                        className={cn(
                          "p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                          item.is_new ? "bg-gold/[0.04]" : "hover:bg-muted/30"
                        )}
                      >
                        {/* Informações do Produto */}
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

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span>Unitário: {brl(item.unit_price)}</span>
                              {item.discount > 0 && (
                                <span className="text-amber-600 font-medium">
                                  Desc.: -{brl(item.discount)}
                                </span>
                              )}
                            </div>

                            {/* Troca de Numeração direta (se for calçado) */}
                            {item.numeracao && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                  Numeração:
                                </span>
                                {availableSizes.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {/* Tamanho atual */}
                                    <Badge className="bg-black text-white text-[11px] font-black h-5 px-1.5">
                                      Nº {item.numeracao}
                                    </Badge>
                                    {/* Opções de outros tamanhos disponíveis */}
                                    {availableSizes
                                      .filter((s) => s !== item.numeracao)
                                      .map((size) => (
                                        <button
                                          key={size}
                                          type="button"
                                          onClick={() => handleChangeNumeracao(idx, size)}
                                          className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-gold/20 hover:text-gold hover:border-gold/50 transition-colors"
                                          title={`Trocar para tamanho ${size}`}
                                        >
                                          Mudar p/ {size}
                                        </button>
                                      ))}
                                  </div>
                                ) : (
                                  <Badge className="bg-black text-white text-[11px] font-black h-5 px-1.5">
                                    Nº {item.numeracao}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Controles de Quantidade, Subtotal e Remoção */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          {/* Quantidade */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-7 rounded-lg"
                              onClick={() => handleChangeQty(idx, -1)}
                              disabled={item.quantity <= 1}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center text-xs font-bold">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-7 rounded-lg"
                              onClick={() => handleChangeQty(idx, 1)}
                            >
                              +
                            </Button>
                          </div>

                          {/* Subtotal do Item */}
                          <div className="text-right min-w-[80px]">
                            <p className="text-sm font-black text-foreground">
                              {brl(item.quantity * item.unit_price - (item.discount || 0))}
                            </p>
                          </div>

                          {/* Botão Remover */}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:bg-destructive/10 rounded-lg"
                            title="Remover produto da venda (devolve ao estoque)"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Resumo da Troca / Totais */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border/70 space-y-2 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Total Original
                    </span>
                    <span className="font-bold text-sm text-foreground">
                      {brl(originalTotal)}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Novo Total
                    </span>
                    <span className="font-black text-sm text-foreground">
                      {brl(newTotal)}
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Diferença
                    </span>
                    {diff === 0 ? (
                      <span className="font-bold text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Mesmo valor
                      </span>
                    ) : diff > 0 ? (
                      <span className="font-black text-xs text-amber-600">
                        + {brl(diff)} (A cobrar)
                      </span>
                    ) : (
                      <span className="font-black text-xs text-blue-600">
                        - {brl(Math.abs(diff))} (Crédito/Sobra)
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/40">
                  <AlertCircle className="size-3 text-gold shrink-0" />
                  Ao salvar, o sistema atualizará o estoque automaticamente (devolvendo os substituídos e baixando os novos).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Botões */}
        <div className="p-3 sm:p-4 border-t border-border bg-muted/10 flex items-center justify-end gap-2.5 shrink-0">
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
                Atualizando estoque...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Confirmar e Atualizar Estoque
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
