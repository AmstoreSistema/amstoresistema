import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { 
  ShoppingBag, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Coins, 
  Phone,
  Calendar,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useServerFn } from "@tanstack/react-start";
import { getClientDetails } from "@/lib/clients.functions";
import { useQuery } from "@tanstack/react-query";
import { SaleDetailsModal } from "../sales/SaleDetailsModal";


interface ClientDetailsModalProps {
  client: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ClientDetailsModal({ client, isOpen, onClose }: ClientDetailsModalProps) {
  const fetchDetails = useServerFn(getClientDetails);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isSaleDetailsOpen, setIsSaleDetailsOpen] = useState(false);
  
  const { data, isLoading } = useQuery({
    queryKey: ['client-details', client?.id],
    queryFn: () => fetchDetails({ data: { client_id: client.id } }),
    enabled: !!client && isOpen,
  });

  const handleSaleClick = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsSaleDetailsOpen(true);
  };



  if (!client) return null;

  const initials = client.name
    ? client.name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const stats = [
    {
      label: "Total de Vendas",
      value: data?.stats.sales_count || 0,
      icon: ShoppingBag,
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
      valueColor: "text-foreground",
    },
    {
      label: "Total Comprado",
      value: brl(data?.stats.total_bought || 0),
      icon: DollarSign,
      bgColor: "bg-green-50",
      textColor: "text-green-600",
      valueColor: "text-green-600",
    },
    {
      label: "Total Pago",
      value: brl(data?.stats.total_paid || 0),
      icon: CheckCircle2,
      bgColor: "bg-purple-50",
      textColor: "text-purple-600",
      valueColor: "text-purple-600",
    },
    {
      label: "Saldo Devedor",
      value: brl(data?.stats.total_debt || 0),
      icon: AlertCircle,
      bgColor: "bg-orange-50",
      textColor: "text-orange-600",
      valueColor: "text-orange-600",
    },
    {
      label: "Cashback Disponível",
      value: brl(client.cashback_balance || 0),
      icon: Coins,
      bgColor: "bg-yellow-50",
      textColor: "text-yellow-600",
      valueColor: "text-yellow-600",
      subValue: `A receber: ${brl(0)}`, // Logic for pending cashback could be added if available
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-[#F8F9FB] border-none shadow-2xl">
        <div className="flex items-center justify-between p-6 bg-white border-b relative">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-lg font-bold">
              {initials}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {client.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{client.phone || "Sem telefone"}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[80vh]">
          <div className="p-6 space-y-6">
            {/* Contact Info Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Informações do Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Telefone</label>
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Phone className="size-3 text-muted-foreground" />
                    {client.phone || "—"}
                  </div>
                </div>
                {client.email && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">E-mail</label>
                    <div className="font-medium text-foreground">{client.email}</div>
                  </div>
                )}
                {client.address && (
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Endereço</label>
                    <div className="font-medium text-foreground">{client.address}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className={cn("rounded-2xl p-4 shadow-sm border border-gray-100", stat.bgColor)}>
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={cn("size-4", stat.textColor)} />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground truncate">{stat.label}</span>
                  </div>
                  <div className={cn("text-lg font-bold", stat.valueColor)}>{stat.value}</div>
                  {stat.subValue && <div className="text-[10px] text-muted-foreground mt-1">{stat.subValue}</div>}
                </div>
              ))}
            </div>

            {/* Sales History */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Histórico Completo de Vendas</h3>
              <div className="space-y-2">
                {isLoading ? (
                  <div className="p-10 text-center text-muted-foreground">Carregando histórico...</div>
                ) : data?.sales.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground bg-white rounded-2xl border border-dashed">
                    Nenhuma venda encontrada para este cliente.
                  </div>
                ) : (
                  data?.sales.map((sale: any) => (
                    <div 
                      key={sale.id} 
                      className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-50 hover:border-primary/20 hover:bg-gray-50 cursor-pointer transition-all active:scale-[0.98]"
                      onClick={() => handleSaleClick(sale.id)}
                    >

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{sale.sale_code}</span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                            sale.status === 'paid' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {sale.status === 'paid' ? 'pago' : 'parcial'}
                          </span>
                          {sale.payment_method === 'Fiado' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-yellow-100 text-yellow-700">
                              Fiado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                          <Calendar className="size-3" />
                          {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">{brl(sale.total_amount)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        <SaleDetailsModal 
          saleId={selectedSaleId}
          isOpen={isSaleDetailsOpen}
          onClose={() => setIsSaleDetailsOpen(false)}
        />
      </DialogContent>

    </Dialog>
  );
}
