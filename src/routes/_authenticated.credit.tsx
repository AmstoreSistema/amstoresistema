import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  HandCoins, 
  Wallet,
  Search,
  Filter,
  User,
  Calendar,
  ChevronRight,
  CreditCard,
  Plus
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, useRows } from "@/lib/data";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/credit")({
  head: () => ({
    meta: [
      { title: "Fiado — Amstore Gestão" },
      { name: "description", content: "Controle das vendas no fiado por cliente, com registro de pagamentos parciais." },
    ],
  }),
  component: CreditPage,
});

type Sale = {
  id: string;
  client_id: string | null;
  total_amount: number;
  paid_amount: number;
  status: string | null;
  is_debt: boolean | null;
  created_at: string | null;
};
type Client = { id: string; name: string; phone: string | null };
type Payment = { id: string; sale_id: string; amount: number; created_at: string };

function CreditPage() {
  const qc = useQueryClient();
  const { data: sales = [], isLoading } = useRows<Sale>("sales", {
    order: { column: "created_at", ascending: false },
    filters: [{ column: "is_debt", value: true }],
  });
  const { data: clients = [] } = useRows<Client>("clients");
  const { data: payments = [] } = useRows<Payment>("debt_payments", { order: { column: "created_at", ascending: false } });

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const [target, setTarget] = useState<Sale | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [term, setTerm] = useState("");

  const remaining = (s: Sale) => Number(s.total_amount) - Number(s.paid_amount);

  const openPayment = (sale: Sale) => {
    setTarget(sale);
    setAmount(String(remaining(sale).toFixed(2)));
  };

  const registerPayment = async () => {
    if (!target) return;
    const value = Number(amount || 0);
    if (value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      const paid = Number(target.paid_amount) + value;
      const settled = paid >= Number(target.total_amount) - 0.001;
      const { error } = await supabase.from("debt_payments").insert({ sale_id: target.id, amount: value });
      if (error) throw error;
      const { error: saleError } = await supabase
        .from("sales")
        .update({ paid_amount: paid, status: settled ? "pago" : "pendente" })
        .eq("id", target.id);
      if (saleError) throw saleError;
      const clientName = target.client_id ? clientById.get(target.client_id)?.name ?? "Cliente" : "Cliente";
      const { error: txError } = await supabase.from("transactions").insert({
        sale_id: target.id,
        amount: value,
        type: "entrada",
        description: `Recebimento de fiado — ${clientName}`,
      });
      if (txError) throw txError;
      await logAudit("recebimento_fiado", "sales", `Recebido ${brl(value)} de ${clientName}`, target.id);
      toast.success(settled ? "Fiado quitado" : "Pagamento parcial registrado");
      setTarget(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar o pagamento");
    } finally {
      setSaving(false);
    }
  };

  const filteredSales = useMemo(() => {
     return (sales as Sale[]).filter(s => {
        const clientName = (s.client_id ? clientById.get(s.client_id)?.name : "Consumidor") || "";
        return clientName.toLowerCase().includes(term.toLowerCase()) || s.id.toLowerCase().includes(term.toLowerCase());
     });
  }, [sales, term, clientById]);

  const openTotal = sales.filter((s) => s.status !== "pago").reduce((s, v) => s + remaining(v), 0);
  const receivedTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Gestão de Fiado" 
        description="Controle de vendas a prazo e recebimentos pendentes" 
        icon={HandCoins}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total em Aberto" value={brl(openTotal)} icon={Wallet} tone="warning" />
        <StatCard title="Total Já Recebido" value={brl(receivedTotal)} icon={CheckCircle2} tone="success" />
        <StatCard title="Vendas no Fiado" value={sales.length} icon={HandCoins} tone="dark" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente..." 
            className="pl-10 h-11 rounded-2xl bg-card border-border/40"
            value={term}
            onChange={e => setTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl"><Filter className="size-4" /></Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
           <Calendar className="size-4 text-gold" />
           <h3 className="font-display font-black text-lg tracking-tight uppercase text-muted-foreground/80">Débitos Pendentes</h3>
           <div className="h-px flex-1 bg-border/30 ml-2" />
        </div>

        {isLoading ? (
           <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-3xl" />)}
           </div>
        ) : filteredSales.length === 0 ? (
           <Card className="rounded-3xl border-dashed bg-muted/20 border-border/40">
              <CardContent className="p-12 text-center text-muted-foreground">Nenhum débito encontrado.</CardContent>
           </Card>
        ) : (
           <div className="space-y-3">
             {filteredSales.map(sale => (
               <Card key={sale.id} className="group overflow-hidden rounded-3xl border-border/40 bg-card hover:bg-muted/10 transition-all shadow-sm hover:shadow-md">
                 <CardContent className="p-0">
                    <div className="flex items-center p-4 gap-4">
                       <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0">
                          <User className="size-6 text-muted-foreground" />
                       </div>

                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <div>
                                <h4 className="font-bold truncate">{sale.client_id ? clientById.get(sale.client_id)?.name ?? "—" : "—"}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                   <Badge className={sale.status === "pago" ? "bg-success/10 text-success border-none" : "bg-warning/10 text-warning border-none"}>
                                      {sale.status === "pago" ? "Quitado" : "Pendente"}
                                   </Badge>
                                   <span className="text-[10px] text-muted-foreground font-bold uppercase">{dateBR(sale.created_at || "")}</span>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="font-black text-lg font-display text-gold">{brl(remaining(sale))}</p>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Total: {brl(sale.total_amount)}</p>
                             </div>
                          </div>
                       </div>

                       <div className="flex items-center gap-2">
                          {sale.status !== "pago" && (
                             <Button size="sm" className="rounded-xl h-9 px-4 font-bold bg-gold/10 text-gold hover:bg-gold/20" onClick={() => openPayment(sale)}>
                                <Plus className="size-4 mr-1" /> Pagar
                             </Button>
                          )}
                          <ChevronRight className="size-5 text-muted-foreground/30 group-hover:text-gold transition-colors" />
                       </div>
                    </div>
                 </CardContent>
               </Card>
             ))}
           </div>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-2xl tracking-tight">Registrar Pagamento</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Saldo devedor total: <span className="font-bold text-gold">{target ? brl(remaining(target)) : ""}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
               <Label className="text-sm font-bold ml-1">Valor Recebido (R$)</Label>
               <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0,00"
                    className="h-12 pl-12 rounded-2xl bg-muted/50 border-none text-lg font-black"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                  />
               </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="rounded-2xl h-12 flex-1 font-bold" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button className="rounded-2xl h-12 flex-1 font-bold bg-gradient-gold border-none shadow-gold" onClick={registerPayment} disabled={saving}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
