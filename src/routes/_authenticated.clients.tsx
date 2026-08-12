import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRows, useDeleteRow } from "@/lib/data";
import { ClientCard, ClientSummary } from "@/components/clients/ClientCard";
import { ClientDetailsModal } from "@/components/clients/ClientDetailsModal";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clientes — Amstore Gestão" },
      { name: "description", content: "Cadastro de clientes com contato, endereço, saldo de cashback e histórico de compras." },
      { property: "og:title", content: "Clientes — Amstore Gestão" },
      { property: "og:description", content: "Gerencie sua base de clientes, contatos e programa de cashback." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [term, setTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "pf" | "pj">("all");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCrudOpen, setIsCrudOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);

  const { data: clients = [], isLoading } = useRows<any>("clients", {
    order: { column: "name", ascending: true }
  });

  const { data: salesStats } = useQuery({
    queryKey: ['clients-sales-total'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('total_amount');
      if (error) return 0;
      return data.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    }
  });

  const remove = useDeleteRow("clients", "cliente");

  const filtered = useMemo(() => {
    let result = clients;
    
    // Search filter
    if (term.trim()) {
      const t = term.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(t) || 
        (c.phone && c.phone.includes(t)) || 
        (c.email && c.email.toLowerCase().includes(t))
      );
    }

    // PF/PJ filter
    if (filterType === "pf") {
      result = result.filter(c => !c.notes?.toLowerCase().includes('pj') && !c.name?.toLowerCase().includes('ltda'));
    } else if (filterType === "pj") {
      result = result.filter(c => c.notes?.toLowerCase().includes('pj') || c.name?.toLowerCase().includes('ltda'));
    }

    return result;
  }, [clients, term, filterType]);

  const handleOpenDetails = (client: any) => {
    setSelectedClient(client);
    setIsDetailsOpen(true);
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setIsCrudOpen(true);
  };

  const handleNew = () => {
    setEditingClient(null);
    setIsCrudOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie sua base de clientes"
        actions={
          <Button onClick={handleNew} className="gap-2 bg-primary shadow-lg shadow-primary/20">
            <Plus className="size-4" /> Novo Cliente
          </Button>
        }
      />

      <ClientSummary clients={clients} totalSalesAmount={salesStats || 0} />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="pl-9 h-11 bg-white border-none shadow-sm rounded-xl"
          />
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm self-stretch md:self-auto">
          <Button 
            variant={filterType === "all" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setFilterType("all")}
            className={cn("rounded-lg px-6 font-bold text-xs", filterType === "all" ? "bg-primary shadow-md" : "")}
          >
            Todos
          </Button>
          <Button 
            variant={filterType === "pf" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setFilterType("pf")}
            className={cn("rounded-lg px-6 font-bold text-xs", filterType === "pf" ? "bg-primary shadow-md" : "")}
          >
            PF
          </Button>
          <Button 
            variant={filterType === "pj" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setFilterType("pj")}
            className={cn("rounded-lg px-6 font-bold text-xs", filterType === "pj" ? "bg-primary shadow-md" : "")}
          >
            PJ
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
          {filtered.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onViewDetails={handleOpenDetails}
              onEdit={handleEdit}
              onDelete={(id) => {
                if (confirm("Deseja realmente excluir este cliente?")) {
                  remove.mutate(id);
                }
              }}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground bg-white rounded-3xl border border-dashed">
              Nenhum cliente encontrado.
            </div>
          )}
        </div>
      )}


      {isCrudOpen && (
        <ClientFormModal
          isOpen={isCrudOpen}
          onClose={() => {
            setIsCrudOpen(false);
            setEditingClient(null);
          }}
          client={editingClient}
        />
      )}

      <ClientDetailsModal 
        client={selectedClient} 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
      />
    </div>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSaveRow } from "@/lib/data";

function ClientFormModal({ isOpen, onClose, client }: { isOpen: boolean, onClose: () => void, client: any }) {
  const save = useSaveRow("clients", "cliente");
  const [values, setValues] = useState<any>(client || {
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: ""
  });

  const handleSubmit = () => {
    save.mutate(
      { id: client?.id, values },
      { onSuccess: onClose }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>Preencha as informações do cliente abaixo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium">Nome</Label>
            <Input 
              value={values.name} 
              onChange={e => setValues({...values, name: e.target.value})} 
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium">WhatsApp / Telefone</Label>
            <Input 
              value={values.phone} 
              onChange={e => setValues({...values, phone: e.target.value})} 
              placeholder="5511999999999"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium">E-mail</Label>
            <Input 
              value={values.email} 
              onChange={e => setValues({...values, email: e.target.value})} 
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium">Endereço</Label>
            <Input 
              value={values.address} 
              onChange={e => setValues({...values, address: e.target.value})} 
              placeholder="Rua, número, bairro, cidade"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs font-medium">Observações</Label>
            <Input 
              value={values.notes} 
              onChange={e => setValues({...values, notes: e.target.value})} 
              placeholder="Adicione 'PJ' para identificar como empresa"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

