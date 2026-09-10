import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  ShoppingCart, 
  Search,
  Plus,
  Filter,
  MoreVertical,
  Calendar,
  User,
  CreditCard,
  ChevronRight,
  Printer,
  FileDown,
  TrendingUp,
  AlertTriangle,
  CreditCard as InstallmentsIcon,
  FileText,
  X,
} from "lucide-react";


import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { brl, dateBR } from "@/lib/format";
import { useRows } from "@/lib/data";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { POSModal } from "@/components/sales/POSModal";
import { SaleInstallmentsModal } from "@/components/sales/SaleInstallmentsModal";
import { ReceiptModal } from "@/components/sales/ReceiptModal";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import { getSaleDetails } from "@/lib/sales.functions";
import { supabase } from "@/integrations/supabase/client";
import { PaginationBar } from "@/components/ui/pagination-bar";



export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Vendas — Amstore Gestão" },
      { name: "description", content: "Histórico de vendas e PDV." },
      { property: "og:title", content: "Vendas — Amstore Gestão" },
      { property: "og:description", content: "Histórico de vendas e PDV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const qc = useQueryClient();
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodPreset, setPeriodPreset] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const applyPreset = (preset: string) => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0] ?? "";

    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yStr = y.toISOString().split("T")[0] ?? "";
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "7days") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setStartDate(d.toISOString().split("T")[0] ?? "");
      setEndDate(todayStr);
    } else if (preset === "30days") {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setStartDate(d.toISOString().split("T")[0] ?? "");
      setEndDate(todayStr);
    } else if (preset === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0] ?? "";
      setStartDate(start);
      setEndDate(todayStr);
    } else if (preset === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0] ?? "";
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0] ?? "";
      setStartDate(start);
      setEndDate(end);
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  const clearPeriodFilter = () => {
    setStartDate("");
    setEndDate("");
    setPeriodPreset("all");
  };

  // Reinicia a paginação para a página 1 ao aplicar filtros, buscas ou período
  useEffect(() => {
    setPage(1);
  }, [term, startDate, endDate]);

  const { data: clients = [] } = useRows("clients");
  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);

  // Cálculo de limites .range(from, to) baseado na página atual
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Busca paginada no Supabase
  const { data: salesResult, isLoading } = useQuery({
    queryKey: ["sales", page, term, startDate, endDate],
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select("*, clients(id, name)", { count: "exact" })
        .order("created_at", { ascending: false });

      if (term.toLowerCase() === "pending") {
        q = q.eq("is_debt", true);
      } else if (term.trim()) {
        const cleanTerm = term.trim();
        const matchingClientIds = (clients as any[])
          .filter((c: any) => c.name?.toLowerCase().includes(cleanTerm.toLowerCase()))
          .map((c: any) => c.id);

        if (matchingClientIds.length > 0) {
          q = q.or(`sale_code.ilike.%${cleanTerm}%,id.ilike.%${cleanTerm}%,client_id.in.(${matchingClientIds.join(",")})`);
        } else {
          q = q.or(`sale_code.ilike.%${cleanTerm}%,id.ilike.%${cleanTerm}%`);
        }
      }

      if (startDate) {
        q = q.gte("created_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        q = q.lte("created_at", `${endDate}T23:59:59`);
      }

      q = q.range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return {
        sales: (data as any[]) || [],
        totalCount: count || 0,
      };
    },
  });

  const sales = salesResult?.sales || [];
  const totalCount = salesResult?.totalCount || 0;

  const [posOpen, setPosOpen] = useState(false);
  const [installmentsOpen, setInstallmentsOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  
  // Real-time fetching of selected sale for the receipt
  const fetchSale = useServerFn(getSaleDetails);
  const { data: selectedSaleDetails } = useQuery({
    queryKey: ['sale-details', selectedSaleId],
    queryFn: () => fetchSale({ data: { sale_id: selectedSaleId! } }),
    enabled: !!selectedSaleId && receiptOpen,
  });

  const groupedSales = useMemo(() => {
    const groups: Record<string, any[]> = {};
    sales.forEach(s => {
      const createdAt = s.created_at;
      const d = dateBR(typeof createdAt === 'string' ? createdAt : "");
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return groups;
  }, [sales]);

  // Consulta leve e dedicada para os cartões de estatística do topo (mantém totais globais)
  const { data: statsData } = useQuery({
    queryKey: ["sales-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("sales")
        .select("created_at, total_amount, is_debt, paid_amount, status")
        .gte("created_at", `${today}T00:00:00`);

      const { count: pendingFiadoCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("is_debt", true);

      const todaySales = (data || []).filter((s: any) => {
        const d = typeof s.created_at === "string" ? s.created_at.slice(0, 10) : "";
        return d === today;
      });

      return {
        countToday: todaySales.length,
        totalToday: todaySales.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0),
        pendingFiado: pendingFiadoCount || 0,
      };
    },
  });

  const stats = statsData || { countToday: 0, totalToday: 0, pendingFiado: 0 };

  const getStatusBadge = (s: any) => {
    // Para vendas fiado, o status vem do saldo devedor (nunca do status default do banco)
    const isFiado = s.payment_method === 'Fiado' || !!s.is_debt;
    const isPaid = isFiado
      ? Number(s.paid_amount) >= Number(s.total_amount) - 0.009
      : (["paid", "pago", "completed", "finalizado"].includes(String(s.status || "").toLowerCase()) || Number(s.paid_amount) >= Number(s.total_amount));
    
    if (isFiado && !isPaid) {
      const isPartial = Number(s.paid_amount) > 0;
      return (
        <Badge className={`${isPartial ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'} border-none uppercase text-[9px] font-black`}>
          {isPartial ? 'Pendente (Parcial)' : 'Pendente / Fiado'}
        </Badge>
      );
    }
    
    if (isPaid) {
      return <Badge className="bg-success/10 text-success border-none uppercase text-[9px] font-black">Pago</Badge>;
    }

    return (
      <Badge className="bg-destructive/10 text-destructive border-none uppercase text-[9px] font-black">
        Pendente
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Vendas" 
        description="Histórico completo de vendas e recebimentos"
        icon={ShoppingCart}
        actions={
          <Button 
            className="gap-2 bg-gradient-gold border-none shadow-gold font-bold"
            onClick={() => setPosOpen(true)}
          >
            <Plus className="size-4" /> Nova Venda (PDV)
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3">
        <StatCard title="Vendas Hoje" value={stats.countToday} icon={ShoppingCart} tone="dark" />
        <StatCard title="Faturamento Hoje" value={brl(stats.totalToday)} icon={TrendingUp} tone="gold" />
        <div className="col-span-2 sm:col-span-1">
          <StatCard title="Fiados em Aberto" value={stats.pendingFiado} icon={AlertTriangle} tone="warning" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente ou código da venda..." 
            className="pl-10 h-11 rounded-2xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={term === "pending" ? "default" : "outline"} 
            className="h-11 rounded-xl gap-2 font-bold px-4"
            onClick={() => setTerm(term === "pending" ? "" : "pending")}
          >
            <AlertTriangle className="size-4" /> Atrasados
          </Button>
          
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={startDate || endDate ? "default" : "outline"} 
                className={`h-11 rounded-xl gap-2 px-3 font-semibold ${
                  startDate || endDate ? "bg-gold hover:bg-gold/90 text-white border-none shadow-sm" : ""
                }`}
                title="Filtrar por período"
              >
                <Filter className="size-4" />
                <span className="hidden sm:inline">
                  {startDate || endDate ? "Período Ativo" : "Filtrar"}
                </span>
                {(startDate || endDate) && (
                  <span className="size-2 rounded-full bg-white animate-pulse" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 rounded-2xl border-border/60 p-4 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-gold" />
                    <h4 className="text-sm font-bold">Filtrar por Período</h4>
                  </div>
                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearPeriodFilter}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Limpar
                    </Button>
                  )}
                </div>

                {/* Presets rápidos */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Períodos Rápidos
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "today", label: "Hoje" },
                      { id: "yesterday", label: "Ontem" },
                      { id: "7days", label: "Últimos 7 dias" },
                      { id: "30days", label: "Últimos 30 dias" },
                      { id: "thisMonth", label: "Este mês" },
                      { id: "lastMonth", label: "Mês passado" },
                    ].map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant={periodPreset === p.id ? "default" : "outline"}
                        className={`h-8 text-xs justify-start rounded-lg ${
                          periodPreset === p.id ? "font-bold bg-primary text-primary-foreground" : "text-muted-foreground"
                        }`}
                        onClick={() => applyPreset(p.id)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Datas personalizadas */}
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Data Inicial
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPeriodPreset("custom");
                      }}
                      className="h-9 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Data Final
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPeriodPreset("custom");
                      }}
                      className="h-9 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={clearPeriodFilter}
                  >
                    Ver Todas
                  </Button>
                  <Button
                    type="button"
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
        </div>
      </div>

      {(startDate || endDate) && (
        <div className="flex items-center gap-2 px-1">
          <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 rounded-lg text-xs">
            <Calendar className="size-3 text-gold" />
            <span>
              Período: {startDate ? new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR") : "Início"} até{" "}
              {endDate ? new Date(endDate + "T00:00:00").toLocaleDateString("pt-BR") : "Hoje"}
            </span>
            <button
              onClick={clearPeriodFilter}
              className="ml-1 rounded-full hover:bg-muted p-0.5"
              title="Remover filtro de período"
            >
              <X className="size-3 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2].map(i => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-32 bg-muted/40 animate-pulse rounded-md" />
              <div className="space-y-3">
                {[1, 2, 3].map(j => <div key={j} className="h-20 bg-card animate-pulse rounded-3xl" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedSales).map(([date, items]) => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                 <Calendar className="size-4 text-gold" />
                 <h3 className="font-display font-black text-lg tracking-tight uppercase text-muted-foreground/80">{date}</h3>
                 <div className="h-px flex-1 bg-border/30 ml-2" />
              </div>
              
              <div className="space-y-3">
                {items.map(sale => (
                  <Card key={sale.id} className="group overflow-hidden rounded-2xl sm:rounded-3xl border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm hover:shadow-md">
                    <CardContent className="p-0">
                      <div className="flex items-center p-3 sm:p-4 gap-3 sm:gap-4">
                        <div className="size-10 sm:size-12 rounded-xl sm:rounded-2xl bg-muted/50 flex items-center justify-center shrink-0">
                           <User className="size-5 sm:size-6 text-muted-foreground" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                   <h4 className="font-bold text-xs sm:text-sm truncate max-w-[140px] sm:max-w-none">{clientById.get(sale.client_id || "")?.name || "Consumidor Final"}</h4>
                                   <div className="sm:hidden">{getStatusBadge(sale)}</div>
                                 </div>
                                 <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Venda #{sale.id.slice(0,8)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                 <p className="font-black text-base sm:text-lg font-display text-gold">{brl(sale.total_amount)}</p>
                                 <div className="flex items-center gap-1 justify-end text-[9px] sm:text-[10px] text-muted-foreground font-bold">
                                    <CreditCard className="size-3" /> {sale.payment_method}
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 px-4 border-l border-border/40">
                           {getStatusBadge(sale)}
                        </div>

                        <div className="flex items-center gap-1">
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-9 w-9 rounded-xl transition-opacity"
                             onClick={() => {
                               setSelectedSaleId(sale.id);
                               setReceiptOpen(true);
                             }}
                           >
                              <Printer className="size-4" />
                           </Button>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                    <MoreVertical className="size-4" />
                                 </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2">
                                 <DropdownMenuItem 
                                   className="rounded-xl gap-2"
                                   onClick={() => {
                                     setSelectedSaleId(sale.id);
                                     setDetailsOpen(true);
                                   }}
                                 >
                                   <FileText className="size-4" /> Detalhes da Venda
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="rounded-xl gap-2"><FileDown className="size-4" /> Baixar PDF</DropdownMenuItem>
                                 <DropdownMenuItem 
                                   className="rounded-xl gap-2"
                                   onClick={() => {
                                     setSelectedSaleId(sale.id);
                                     setReceiptOpen(true);
                                   }}
                                 >
                                   <Printer className="size-4" /> Imprimir Cupom
                                 </DropdownMenuItem>
                                 {sale.is_debt && (
                                   <DropdownMenuItem 
                                     className="rounded-xl gap-2"
                                     onClick={() => {
                                       setSelectedSaleId(sale.id);
                                       setInstallmentsOpen(true);
                                     }}
                                   >
                                      <InstallmentsIcon className="size-4" /> Ver Parcelas
                                   </DropdownMenuItem>
                                 )}

                                 <DropdownMenuItem 
                                    className="rounded-xl gap-2 text-destructive"
                                    onClick={async () => {
                                       if (confirm("Deseja realmente estornar esta venda? O estoque será devolvido, o saldo das contas financeiras será ajustado e o cashback liberado será estornado.")) {
                                          try {
                                             const { cancelSale } = await import("@/lib/sales.functions");
                                             await cancelSale({ data: { sale_id: sale.id } });
                                             toast.success("Venda estornada e dados financeiros sincronizados com sucesso");
                                             qc.invalidateQueries();
                                          } catch (err: any) {
                                             toast.error(err.message);
                                          }
                                       }
                                    }}
                                 >
                                    <AlertTriangle className="size-4" /> Estornar Venda
                                 </DropdownMenuItem>

                              </DropdownMenuContent>
                           </DropdownMenu>
                           <ChevronRight 
                             className="size-5 text-muted-foreground/30 group-hover:text-gold transition-colors ml-1 cursor-pointer" 
                             onClick={() => {
                               setSelectedSaleId(sale.id);
                               setDetailsOpen(true);
                             }}
                           />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra de Paginação */}
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={totalCount}
        itemName="vendas"
        onPageChange={setPage}
        isLoading={isLoading}
      />

      <POSModal open={posOpen} onOpenChange={setPosOpen} />
      <SaleInstallmentsModal 
        open={installmentsOpen} 
        onOpenChange={setInstallmentsOpen} 
        saleId={selectedSaleId}
      />
      <ReceiptModal 
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        sale={selectedSaleDetails?.sale || sales.find((s: any) => s.id === selectedSaleId)}
        client={clientById.get(sales.find((s: any) => s.id === selectedSaleId)?.client_id || "")}
        installments={selectedSaleDetails?.installments || []}
        payments={selectedSaleDetails?.payments || []}
      />
      <SaleDetailsModal 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        saleId={selectedSaleId}
      />
    </div>

  );
}

