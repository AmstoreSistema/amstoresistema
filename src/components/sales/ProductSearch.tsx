import * as React from "react";
import { Search, Package, Check, Plus, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRows } from "@/lib/data";
import { brl } from "@/lib/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StockProduct {
  id: string;
  produto_id: string;
  produto_nome: string;
  quantidade_disponivel: number;
  preco_venda: number;
  numeracoes: any;
  categoria: string | null;
  imagem_url?: string | null;
}


export function ProductSearch({ 
  onAdd 
}: { 
  onAdd: (product: StockProduct, numeracao: string | null) => void 
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedStock, setSelectedStock] = React.useState<StockProduct | null>(null);
  
  const { data: stockItems = [] } = useRows<StockProduct>("stock_products");

  const availableItems = React.useMemo(() => {
    return stockItems
      .filter(item => (item.quantidade_disponivel ?? 0) > 0)
      .sort((a, b) => (a.produto_nome || "").localeCompare(b.produto_nome || ""));
  }, [stockItems]);


  const handleSelectStock = (item: StockProduct) => {
    // If it has numeracoes, we don't close yet, we show sizes
    if (item.numeracoes && Object.keys(item.numeracoes).length > 0) {
      setSelectedStock(item);
    } else {
      onAdd(item, null);
      setOpen(false);
      setSelectedStock(null);
    }
  };

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={(val) => {
        setOpen(val);
        if (!val) setSelectedStock(null);
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start h-12 rounded-2xl bg-card border-border/40 gap-3"
          >
            <Search className="size-5 text-muted-foreground" />
            <span className="text-muted-foreground">Buscar produto ou bipar código...</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px] p-0" align="start">
          {!selectedStock ? (
            <Command>
              <CommandInput placeholder="Nome, SKU ou categoria..." />
              <CommandList className="max-h-[350px]">
                <CommandEmpty>Nenhum produto disponível em estoque.</CommandEmpty>
                <CommandGroup heading="Produtos em Estoque">
                  {availableItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => handleSelectStock(item)}
                      className="cursor-pointer p-3"
                    >
                      {item.imagem_url ? (
                        <div className="mr-3 size-10 rounded-lg overflow-hidden shrink-0 border border-border/40">
                          <img 
                            src={item.imagem_url} 
                            alt={item.produto_nome} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <Package className="mr-3 size-5 text-muted-foreground shrink-0" />
                      )}

                      <div className="flex flex-col flex-1">
                        <span className="font-bold">{item.produto_nome}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                           <Badge variant="secondary" className="text-[9px] h-4 py-0 px-1 bg-muted">
                             {item.categoria || "Geral"}
                           </Badge>
                           <span className="text-[10px] text-muted-foreground font-medium">
                             Qtd: {item.quantidade_disponivel}
                           </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-gold">{brl(item.preco_venda)}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Hash className="size-4 text-gold" /> Selecionar Tamanho
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStock(null)}>Voltar</Button>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(selectedStock.numeracoes as Record<string, number>)
                  .filter(([_, qty]) => qty > 0)
                  .map(([size, qty]) => (
                    <Button
                      key={size}
                      variant="outline"
                      className="h-12 flex flex-col gap-0 rounded-xl hover:border-gold hover:text-gold transition-all"
                      onClick={() => {
                        onAdd(selectedStock, size);
                        setOpen(false);
                        setSelectedStock(null);
                      }}
                    >
                      <span className="text-sm font-black">{size}</span>
                      <span className="text-[9px] opacity-60">Qtd: {qty}</span>
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
