import * as React from "react";
import { Search, User, Check, Plus, X, UserCheck } from "lucide-react";
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
import { QuickAddClientModal } from "./QuickAddClientModal";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  cashback_balance: number;
}

export function ClientSearch({ 
  selectedClient, 
  onSelect 
}: { 
  selectedClient: Client | null; 
  onSelect: (client: Client | null) => void 
}) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const { data: clients = [] } = useRows<Client>("clients");

  // Ordenação rigorosamente alfabética (A-Z)
  const sortedClients = React.useMemo(() => {
    return [...clients].sort((a, b) => 
      (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })
    );
  }, [clients]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between h-11 rounded-xl bg-background border-border/40 px-3 hover:border-gold/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={cn(
                  "size-7 rounded-lg flex items-center justify-center shrink-0",
                  selectedClient ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                )}>
                  {selectedClient ? <UserCheck className="size-4" /> : <User className="size-4" />}
                </div>
                {selectedClient ? (
                  <div className="flex flex-col text-left truncate min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground truncate">{selectedClient.name}</span>
                    {selectedClient.phone && (
                      <span className="text-[10px] text-muted-foreground font-normal">{selectedClient.phone}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs sm:text-sm font-medium">Selecionar Cliente (Ordem A-Z)...</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {selectedClient && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(null);
                    }}
                    title="Limpar cliente (Consumidor Final)"
                  >
                    <X className="size-3.5" />
                  </span>
                )}
                <Search className="size-4 opacity-50" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-[380px] max-w-[420px] p-0 shadow-xl border-border/60 rounded-2xl" align="start">
            <Command>
              <CommandInput 
                placeholder="Buscar cliente por nome ou telefone..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList className="max-h-[300px] overflow-y-auto">
                <CommandEmpty>
                  <div className="p-3 text-center text-xs text-muted-foreground space-y-2">
                    <p>Nenhum cliente encontrado com "{searchTerm}".</p>
                    {searchTerm.trim().length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full text-xs font-bold gap-1.5 rounded-xl text-gold border-gold/40 hover:bg-gold/10 h-8"
                        onClick={() => {
                          setShowAddModal(true);
                          setOpen(false);
                        }}
                      >
                        <Plus className="size-3.5" /> Cadastrar "{searchTerm.trim()}"
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup heading="Padrão">
                  <CommandItem
                    value="consumidor final padrao nao identificado sem cadastro"
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                    className="cursor-pointer py-2 font-medium text-xs text-muted-foreground"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !selectedClient ? "opacity-100 text-emerald-600" : "opacity-0"
                      )}
                    />
                    Consumidor Final (Sem cadastro)
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading={`Clientes Cadastrados A-Z (${sortedClients.length})`}>
                  {sortedClients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`${client.name} ${client.phone || ""}`}
                      onSelect={() => {
                        onSelect(client);
                        setOpen(false);
                      }}
                      className="cursor-pointer py-2.5 px-3"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          selectedClient?.id === client.id ? "opacity-100 text-emerald-600" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-xs truncate text-foreground">{client.name}</span>
                        {client.phone && (
                          <span className="text-[10px] text-muted-foreground">{client.phone}</span>
                        )}
                      </div>
                      {Number(client.cashback_balance || 0) > 0 && (
                        <div className="ml-2 text-right shrink-0">
                          <span className="text-[9px] uppercase font-black text-emerald-600 block">Cashback</span>
                          <span className="text-xs font-black text-emerald-700">{brl(client.cashback_balance)}</span>
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button 
          type="button"
          variant="outline" 
          size="icon" 
          title="Cadastrar Novo Cliente"
          className="h-11 w-11 shrink-0 rounded-xl bg-background border-border/40 hover:bg-gold/10 hover:text-gold hover:border-gold/40 transition-all"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="size-5" />
        </Button>
      </div>
      
      {selectedClient && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200/60 p-2.5 px-3 animate-in fade-in slide-in-from-top-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-emerald-900">
              Cliente selecionada: <strong className="font-black">{selectedClient.name}</strong>
            </span>
          </div>
          {Number(selectedClient.cashback_balance || 0) > 0 && (
            <span className="text-xs font-black text-emerald-700">
              Saldo: {brl(selectedClient.cashback_balance)}
            </span>
          )}
        </div>
      )}

      <QuickAddClientModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
        initialName={searchTerm}
        onSuccess={(newClient) => {
          onSelect(newClient);
          setShowAddModal(false);
        }}
      />
    </div>
  );
}
