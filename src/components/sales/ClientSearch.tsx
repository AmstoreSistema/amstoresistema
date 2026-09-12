import * as React from "react";
import { Search, User, Check, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [showAddModal, setShowAddModal] = React.useState(false);
  const { data: clients = [] } = useRows<Client>("clients");

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between h-11 rounded-xl bg-background border-border/40"
            >
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                {selectedClient ? (
                  <span className="font-bold">{selectedClient.name}</span>
                ) : (
                  <span className="text-muted-foreground">Selecionar Cliente</span>
                )}
              </div>
              <Search className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2.5rem)] sm:w-[320px] max-w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !selectedClient ? "opacity-100" : "opacity-0"
                      )}
                    />
                    Consumidor Final (Não identificado)
                  </CommandItem>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      onSelect={() => {
                        onSelect(client);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold">{client.name}</span>
                        {client.phone && (
                          <span className="text-[10px] text-muted-foreground">{client.phone}</span>
                        )}
                      </div>
                      <div className="ml-auto text-right">
                         <span className="text-[10px] uppercase font-bold text-success block">Cashback</span>
                         <span className="text-xs font-black">{brl(client.cashback_balance)}</span>
                      </div>
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
          className="h-11 w-11 shrink-0 rounded-xl bg-background border-border/40 hover:bg-gold/10 hover:text-gold hover:border-gold/40 transition-all"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="size-5" />
        </Button>
      </div>
      
      {selectedClient && (
        <div className="rounded-xl bg-success/10 border border-success/20 p-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold text-success tracking-widest">Saldo Cashback</span>
            <span className="text-sm font-black text-success">{brl(selectedClient.cashback_balance)}</span>
          </div>
        </div>
      )}

      <QuickAddClientModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
        onSuccess={(newClient) => {
          onSelect(newClient);
          setShowAddModal(false);
        }}
      />
    </div>
  );
}
