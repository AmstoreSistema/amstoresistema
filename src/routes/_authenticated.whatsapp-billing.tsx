import { createFileRoute } from "@tanstack/react-router";
import { 
  AlertTriangle, 
  Search, 
  Users, 
  FileText, 
  Landmark, 
  MessageCircle,
  Filter,
  CheckSquare
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/whatsapp-billing")({
  component: WhatsAppBillingPage,
});

function WhatsAppBillingPage() {
  const [filter, setFilter] = useState("all");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Cobrança WhatsApp" 
        subtitle="Gerencie lembretes de pagamento e cobranças pendentes."
      />

      {/* Warning Alert */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 flex items-start gap-4 rounded-r-lg shadow-sm">
        <AlertTriangle className="size-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900">Atenção: Clientes sem contato</h3>
          <p className="text-sm text-amber-800/80">Existem clientes com dívidas pendentes que não possuem número de telefone cadastrado.</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Com Telefone / Total" value="84 / 120" icon={Users} />
        <StatCard title="Com Parcelas Vencidas" value="23" icon={AlertTriangle} />
        <StatCard title="Total a Receber" value="R$ 12.450,00" icon={Landmark} />
        <StatCard title="Total Vencido" value="R$ 4.300,00" icon={AlertTriangle} />
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar por nome ou telefone..." className="w-64" />
          <Button variant="outline" className="gap-2">
            <Filter className="size-4" /> Filtros
          </Button>
        </div>
        <div className="flex gap-2">
          {["Todos", "Vencidos", "A Vencer"].map((f) => (
            <Button 
              key={f} 
              variant={filter === f.toLowerCase() ? "default" : "outline"}
              onClick={() => setFilter(f.toLowerCase())}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground font-bold">
          <Checkbox /> <span>Selecionar todos desta página</span>
        </div>
        
        {/* Mock Data Card */}
        <Card className="rounded-[1.5rem] border-border/40 hover:border-gold/30 transition-all shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox />
              <div>
                <h3 className="font-black text-lg">Maria Silva</h3>
                <p className="text-sm text-muted-foreground font-medium">(11) 99999-9999</p>
              </div>
            </div>
            
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Devido</p>
                <p className="font-black text-primary text-xl">R$ 150,00</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Vencido</p>
                <p className="font-black text-destructive text-xl">R$ 50,00</p>
              </div>
            </div>

            <Button className="gap-2 bg-gradient-gold shadow-gold font-bold">
              <MessageCircle className="size-4" /> Enviar Cobrança
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
