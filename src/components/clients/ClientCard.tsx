import React from "react";
import { User, ShoppingBag, CreditCard, Smartphone, Trash2, Pencil, Eye, UserCheck, UserPlus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ClientSummaryProps {
  clients: any[];
  totalSalesAmount: number;
}

export function ClientSummary({ clients, totalSalesAmount }: ClientSummaryProps) {
  const totalClients = clients.length;
  const pfCount = clients.filter(c => !c.notes?.toLowerCase().includes('pj') && !c.name?.toLowerCase().includes('ltda')).length; // Basic heuristic
  const pjCount = totalClients - pfCount;

  const stats = [
    {
      label: "Total de Clientes",
      value: totalClients,
      icon: UsersIcon,
      color: "bg-blue-500",
      textColor: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      label: "Pessoa Física",
      value: pfCount,
      icon: UserCheck,
      color: "bg-green-500",
      textColor: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      label: "Pessoa Jurídica",
      value: pjCount,
      icon: UserPlus,
      color: "bg-purple-500",
      textColor: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      label: "Total em Compras",
      value: brl(totalSalesAmount),
      icon: TrendingUp,
      color: "bg-orange-500",
      textColor: "text-orange-500",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="border-none shadow-sm overflow-hidden">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={cn("p-3 rounded-xl", stat.bgColor)}>
              <stat.icon className={cn("size-6", stat.textColor)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl font-bold tracking-tight">{stat.value}</h3>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <div className={cn("size-6 flex items-center justify-center rounded-md bg-blue-500 text-white", className)}>
      <User className="size-4" />
    </div>
  );
}

interface ClientCardProps {
  client: any;
  onViewDetails: (client: any) => void;
  onEdit: (client: any) => void;
  onDelete: (id: string) => void;
}

export function ClientCard({ client, onViewDetails, onEdit, onDelete }: ClientCardProps) {
  const initials = client.name
    ? client.name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow group bg-white/50 backdrop-blur-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary/20 relative">
            {initials}
            {client.has_qr_bonus && (
              <div className="absolute -top-1 -right-1 size-5 bg-gold rounded-full border-2 border-white flex items-center justify-center animate-pulse" title="Crédito QR Code Premiado disponível!">
                <Trophy className="size-2.5 text-noir fill-noir" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate text-foreground/90 group-hover:text-primary transition-colors">
              {client.name}
            </h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                R$ {client.total_spent?.toFixed(2) || "0.00"}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                CB: R$ {client.cashback_balance?.toFixed(2) || "0.00"}
              </span>
              {client.has_qr_bonus && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gold/10 text-gold border border-gold/20">
                  QR BÔNUS: {brl(client.qr_bonus_amount)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Smartphone className="size-4" />
          <span className="text-sm font-medium">{client.phone || "Sem telefone"}</span>
        </div>

        <div className="pt-2 border-t flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1 gap-2 bg-blue-50 hover:bg-blue-100 border-blue-100 text-blue-600 font-bold text-xs"
            onClick={() => onViewDetails(client)}
          >
            <Eye className="size-3" /> Detalhes
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            className="bg-yellow-50 hover:bg-yellow-100 border-yellow-100 text-yellow-600"
            onClick={() => onEdit(client)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button 
            size="icon" 
            variant="outline" 
            className="bg-red-50 hover:bg-red-100 border-red-100 text-red-600"
            onClick={() => onDelete(client.id)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
