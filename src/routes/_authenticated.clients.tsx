import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRows, useDeleteRow, useSaveRow } from "@/lib/data";
import { ClientCard, ClientSummary } from "@/components/clients/ClientCard";
import { ClientDetailsModal } from "@/components/clients/ClientDetailsModal";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription, 
  DialogClose 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  const { data: clientsData = [], isLoading } = useRows<any>("clients", {
    order: { column: "name", ascending: true }
  });

  const { data: qrBonusData } = useRows<any>("qr_promo_history", {
    filter: { column: "is_awarded", operator: "eq", value: true },
    select: "client_id, bonus_amount, available_bonus"
  });

  const clients = useMemo(() => {
    return clientsData.map(client => {
      const activeBonuses = qrBonusData?.filter(b => b.client_id === client.id && b.available_bonus !== false) || [];
      return {
        ...client,
        has_qr_bonus: activeBonuses.length > 0,
        qr_bonus_amount: activeBonuses.reduce((acc, b) => acc + (b.bonus_amount || 0), 0)
      };
    });
  }, [clientsData, qrBonusData]);

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
      result = result.filter(c => c.client_type !== 'Pessoa Jurídica');
    } else if (filterType === "pj") {
      result = result.filter(c => c.client_type === 'Pessoa Jurídica');
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
            className={cn("rounded-lg px-6 font-bold text-xs", filterType === "all" ? "bg-primary shadow-md text-white" : "")}
          >
            Todos
          </Button>
          <Button 
            variant={filterType === "pf" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setFilterType("pf")}
            className={cn("rounded-lg px-6 font-bold text-xs", filterType === "pf" ? "bg-primary shadow-md text-white" : "")}
          >
            PF
          </Button>
          <Button 
            variant={filterType === "pj" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setFilterType("pj")}
            className={cn("rounded-lg px-6 font-bold text-xs", filterType === "pj" ? "bg-primary shadow-md text-white" : "")}
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

function ClientFormModal({ isOpen, onClose, client }: { isOpen: boolean, onClose: () => void, client: any }) {
  const save = useSaveRow("clients", "cliente");
  const [values, setValues] = useState<any>(client || {
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    client_type: "Pessoa Física",
    document_cpf: "",
    birth_date: "",
    zip_code: "",
    city: "",
    state: ""
  });

  const handleSubmit = () => {
    save.mutate(
      { id: client?.id, values },
      { onSuccess: onClose }
    );
  };

  const handleZipCodeBlur = async () => {
    const cep = values.zip_code?.replace(/\D/g, '');
    if (cep?.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setValues({
            ...values,
            address: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`,
            city: data.localidade,
            state: data.uf
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white border-none shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b relative">
          <DialogTitle className="text-base font-bold text-foreground">
            {client ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogClose className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="size-4" />
          </DialogClose>
        </div>

        <ScrollArea className="max-h-[80vh]">
          <div className="p-6 space-y-6">
            {/* Basic Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Nome Completo / Razão Social *</Label>
                <Input 
                  value={values.name} 
                  onChange={e => setValues({...values, name: e.target.value})} 
                  placeholder="Ex: João Silva"
                  className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Tipo de Cliente</Label>
                <Select 
                  value={values.client_type} 
                  onValueChange={v => setValues({...values, client_type: v})}
                >
                  <SelectTrigger className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                    <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">CPF / CNPJ</Label>
                <Input 
                  value={values.document_cpf} 
                  onChange={e => setValues({...values, document_cpf: e.target.value})} 
                  placeholder="000.000.000-00"
                  className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Telefone / WhatsApp</Label>
                <Input 
                  value={values.phone} 
                  onChange={e => setValues({...values, phone: e.target.value})} 
                  placeholder="(00) 00000-0000"
                  className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">E-mail</Label>
                <Input 
                  value={values.email} 
                  onChange={e => setValues({...values, email: e.target.value})} 
                  placeholder="cliente@email.com"
                  className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  Data de Aniversário 🎂
                </Label>
                <Input 
                  type="date"
                  value={values.birth_date} 
                  onChange={e => setValues({...values, birth_date: e.target.value})} 
                  className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-4 pt-2 border-t">
              <h3 className="text-sm font-bold text-foreground">Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">CEP</Label>
                  <Input 
                    value={values.zip_code} 
                    onChange={e => setValues({...values, zip_code: e.target.value})} 
                    onBlur={handleZipCodeBlur}
                    placeholder="00000-000"
                    className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Endereço Completo</Label>
                  <Input 
                    value={values.address} 
                    onChange={e => setValues({...values, address: e.target.value})} 
                    placeholder="Rua, número, complemento"
                    className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Cidade</Label>
                  <Input 
                    value={values.city} 
                    onChange={e => setValues({...values, city: e.target.value})} 
                    placeholder="Cidade"
                    className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Estado</Label>
                  <Input 
                    value={values.state} 
                    onChange={e => setValues({...values, state: e.target.value})} 
                    placeholder="UF"
                    className="h-9 text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Observations Section */}
            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs font-semibold text-foreground">Observações</Label>
              <Textarea 
                value={values.notes} 
                onChange={e => setValues({...values, notes: e.target.value})} 
                placeholder="Anotações sobre o cliente..."
                className="min-h-[60px] text-sm rounded-lg bg-gray-50/50 border-gray-200 focus:bg-white transition-all resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 bg-gray-50/50 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-9 text-xs px-4 rounded-lg font-semibold">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={save.isPending} className="h-9 text-xs px-4 rounded-lg font-bold bg-primary hover:bg-primary/90 shadow-sm text-white">
            {save.isPending ? "Salvando..." : client ? "Atualizar Cliente" : "Cadastrar Cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

