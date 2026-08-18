import { useState, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Users, Search, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientsWithCashback } from "@/lib/cashback-notifications.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface NotifyClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotifyClientsModal({ open, onOpenChange }: NotifyClientsModalProps) {
  const getClientsFn = useServerFn(getClientsWithCashback);
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-with-cashback"],
    queryFn: () => getClientsFn(),
    enabled: open
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );
  }, [clients, searchTerm]);

  const whatsappMessage = selectedClient 
    ? `Olá, ${selectedClient.name}! Você tem um saldo de R$ ${Number(selectedClient.cashback_balance).toFixed(2)} em cashback disponível para usar em sua próxima compra na AmStore. Aproveite!`
    : "";

  const handleSendWhatsApp = (client: any) => {
    if (!client.phone) return;
    const phone = client.phone.replace(/\D/g, "");
    const text = encodeURIComponent(`Olá, ${client.name}! Você tem um saldo de R$ ${Number(client.cashback_balance).toFixed(2)} em cashback disponível para usar em sua próxima compra na AmStore. Aproveite!`);
    window.open(`https://wa.me/55${phone}?text=${text}`, "_blank");
  };

  const handleSendAll = () => {
    alert("O envio em massa requer integração com API oficial do WhatsApp ou serviço de SMS. Por enquanto, envie individualmente para cada cliente.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[600px] p-0 gap-0 rounded-[2rem] overflow-hidden">
        <div className="flex h-full">
          {/* Left Column: Client List */}
          <div className="w-full sm:w-[400px] border-r border-border flex flex-col bg-muted/10">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-xl font-black flex items-center justify-between">
                <span>Notificar Clientes</span>
                <Button 
                  size="sm" 
                  onClick={handleSendAll}
                  className="bg-primary text-[10px] font-black uppercase tracking-tighter h-7 px-3 rounded-lg"
                >
                  Enviar Todos
                </Button>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">
                  {clients.length} clientes com saldo
                </span>
              </div>
            </DialogHeader>

            <div className="px-6 py-4 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar cliente..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-muted/50 border-none text-sm font-medium"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-2">
              <div className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 bg-muted/40 animate-pulse rounded-2xl" />
                  ))
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <div 
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={cn(
                        "p-4 rounded-2xl cursor-pointer transition-all border border-transparent",
                        selectedClient?.id === client.id 
                          ? "bg-white shadow-md border-primary/20" 
                          : "hover:bg-white/60"
                      )}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm truncate max-w-[180px]">{client.name}</span>
                        <span className="text-[10px] font-black text-primary px-2 py-0.5 rounded-full bg-primary/10">
                          R$ {Number(client.cashback_balance).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                        <div className="flex items-center gap-1">
                          <Phone className="size-3" />
                          <span>{client.phone || "Sem telefone"}</span>
                        </div>
                        <span>{format(new Date(client.updated_at), "dd MMM", { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center text-muted-foreground text-sm font-bold">
                    Nenhum cliente com saldo.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Column: Message Preview */}
          <div className="hidden sm:flex flex-1 flex-col bg-white">
            <div className="p-6 border-b border-border flex items-center gap-3">
              <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Pré-visualização</h3>
                <p className="text-[10px] text-muted-foreground font-bold">MENSAGEM VIA WHATSAPP</p>
              </div>
            </div>

            <div className="flex-1 p-8 flex flex-col justify-center items-center text-center">
              {selectedClient ? (
                <div className="max-w-sm space-y-6">
                  <div className="relative p-6 bg-[#E7FFDB] rounded-[2rem] rounded-tr-none shadow-sm text-left border border-[#D1E8C6]">
                    <p className="text-sm font-medium text-[#303030] leading-relaxed">
                      {whatsappMessage}
                    </p>
                    <div className="absolute right-3 bottom-2 text-[9px] text-muted-foreground flex items-center gap-1">
                      {format(new Date(), "HH:mm")}
                      <div className="flex -space-x-1">
                        <div className="size-3 text-blue-500">✓✓</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground font-bold">
                      Enviar para <span className="text-foreground">{selectedClient.name}</span>
                    </p>
                    <Button 
                      onClick={() => handleSendWhatsApp(selectedClient)}
                      className="w-full bg-[#25D366] hover:bg-[#20bd5c] text-white font-black rounded-2xl h-12 gap-2 shadow-lg shadow-green-500/20"
                    >
                      <Send className="size-4" />
                      Enviar Agora
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground space-y-4">
                  <div className="size-16 rounded-[2rem] bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground/30">
                    <MessageSquare className="size-8" />
                  </div>
                  <p className="font-bold text-sm">Selecione um cliente para ver a mensagem</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-muted/5 text-[10px] text-muted-foreground font-bold border-t border-border/40">
              * O sistema abrirá o WhatsApp Web ou App com a mensagem preenchida.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
