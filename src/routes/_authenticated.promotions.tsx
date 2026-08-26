import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, QrCode, History, Receipt, Save, RefreshCcw, Trash2, Gift, Trophy, Star, Settings, Eraser } from "lucide-react";
import { useState, useEffect } from "react";
import { useRows } from "@/lib/data";
import { useServerFn } from "@tanstack/react-start";
import { 
  getQrPromoConfig, 
  updateQrPromoConfig, 
  resetQrPromoCounter, 
  deleteQrPromoHistoryItem 
} from "@/lib/qr-promo.functions";

import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReceiptModal } from "@/components/sales/ReceiptModal";
import { StatCard } from "@/components/stat-card";
import { brl, dateTimeBR } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({
    meta: [
      { title: "Promoção QR Code — Amstore Gestão" },
      { name: "description", content: "Gerencie a promoção de sorteio via QR Code nos cupons fiscais." },
      { property: "og:title", content: "Promoção QR Code — Amstore Gestão" },
      { property: "og:description", content: "Configurações de sorteio e histórico de premiados." },
    ],
  }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const [activeTab, setActiveTab] = useState("config");
  const { data: config, refetch: refetchConfig } = useRows<any>("qr_promo_config", { limit: 1 });
  const { data: history = [], refetch: refetchHistory } = useRows<any>("qr_promo_history", { 
    order: { column: "created_at", ascending: false },
    limit: 1000 // Aumentar limite para garantir que todas apareçam
  });
  
  const updateConfigFn = useServerFn(updateQrPromoConfig);
  const resetCounterFn = useServerFn(resetQrPromoCounter);
  const deleteHistoryItemFn = useServerFn(deleteQrPromoHistoryItem);
  

  const currentConfig = config?.[0];

  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (currentConfig) {
      setFormData({
        active: currentConfig.active,
        name: currentConfig.name,
        sales_limit: currentConfig.sales_limit,
        bonus_value: currentConfig.bonus_value,
        awarded_positions: currentConfig.awarded_positions,
        standard_message: currentConfig.standard_message,
        awarded_message: currentConfig.awarded_message,
      });
    }
  }, [currentConfig]);

  const handleSave = async () => {
    try {
      await updateConfigFn({ data });
      toast.success("Configurações salvas com sucesso");
      refetchConfig();
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    }
  };

  const handleResetCounter = async () => {
    if (!confirm("Tem certeza que deseja zerar o contador de vendas?")) return;
    try {
      await resetCounterFn();
      toast.success("Contador zerado");
      refetchConfig();
    } catch (error) {
      toast.error("Erro ao zerar contador");
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Remover este registro do histórico?")) return;
    try {
      await deleteHistoryItemFn({ data: { id } });
      toast.success("Registro removido");
      refetchHistory();
    } catch (error) {
      toast.error("Erro ao remover registro");
    }
  };


  const data = formData ?? {
    active: currentConfig?.active ?? false,
    name: currentConfig?.name ?? "Promoção QR Code",
    sales_limit: currentConfig?.sales_limit ?? 100,
    bonus_value: currentConfig?.bonus_value ?? 0,
    awarded_positions: currentConfig?.awarded_positions ?? "",
    standard_message: currentConfig?.standard_message ?? "",
    awarded_message: currentConfig?.awarded_message ?? "",
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-gold text-white shadow-gold">
            <QrCode className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">Promoção QR CODE</h1>
            <p className="text-sm text-muted-foreground">Configure e acompanhe os sorteios automáticos no PDV.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard 
          title="Contador Real" 
          value={`${currentConfig?.current_counter || 0} / ${currentConfig?.sales_limit || 0}`} 
          icon={QrCode} 
          tone="dark"
          sub={
            <div className="mt-2 h-2 w-full bg-muted/20 rounded-full overflow-hidden min-w-[120px]">
              <div 
                className="h-full bg-sidebar-primary transition-all duration-500" 
                style={{ width: `${Math.min(100, ((currentConfig?.current_counter || 0) / (currentConfig?.sales_limit || 1)) * 100)}%` }} 
              />
            </div>
          }
        />
        <StatCard 
          title="QRs Premiados Gerados" 
          value={history.filter((h: any) => h.is_awarded).length} 
          icon={Trophy} 
          tone="warning" 
        />
        <StatCard 
          title="Bônus Reservados" 
          value={`${history.filter((h: any) => h.is_awarded && h.available_bonus !== false).length} / ${history.filter((h: any) => h.is_awarded).length}`} 
          icon={Gift} 
          tone="success" 
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/30 p-1">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="size-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Receipt className="size-4" /> Prévia Cupom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Parâmetros do Sorteio</CardTitle>
                <CardDescription>Defina as regras de funcionamento da promoção.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-sidebar-border/50 bg-muted/20 p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Promoção Ativa</Label>
                    <p className="text-xs text-muted-foreground">Habilitar/desabilitar sorteios no PDV</p>
                  </div>
                  <Switch 
                    checked={data.active} 
                    onCheckedChange={(v) => setFormData({ ...data, active: v })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome da Campanha</Label>
                  <Input 
                    value={data.name} 
                    onChange={(e) => setFormData({ ...data, name: e.target.value })}
                    placeholder="Ex: Natal Premiado Amstore"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite de Vendas (Ciclo)</Label>
                    <Input 
                      type="number"
                      value={data.sales_limit} 
                      onChange={(e) => setFormData({ ...data, sales_limit: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Bônus (R$)</Label>
                    <Input 
                      type="number"
                      value={data.bonus_value} 
                      onChange={(e) => setFormData({ ...data, bonus_value: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Posições Premiadas (Separadas por vírgula)</Label>
                  <Input 
                    value={data.awarded_positions} 
                    onChange={(e) => setFormData({ ...data, awarded_positions: e.target.value })}
                    placeholder="Ex: 5, 10, 25, 50"
                  />
                  <p className="text-[10px] text-muted-foreground">O bônus será concedido quando o contador atingir essas posições.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} className="flex-1 bg-gradient-gold text-white shadow-gold">
                    <Save className="mr-2 size-4" /> Salvar Configurações
                  </Button>
                  <Button variant="destructive" onClick={handleResetCounter} className="font-bold gap-2 shadow-lg shadow-destructive/20 border-none px-6">
                    <RefreshCcw className="size-4" /> Zerar Contagem
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Mensagens do Cupom</CardTitle>
                <CardDescription>O que aparecerá no cupom impresso de 80mm.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Mensagem Padrão (Não Premiado)</Label>
                  <Textarea 
                    rows={4}
                    value={data.standard_message} 
                    onChange={(e) => setFormData({ ...data, standard_message: e.target.value })}
                    placeholder="Ex: Que pena! Continue comprando para concorrer."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem do Ganhador</Label>
                  <Textarea 
                    rows={4}
                    value={data.awarded_message} 
                    onChange={(e) => setFormData({ ...data, awarded_message: e.target.value })}
                    placeholder="Ex: PARABÉNS! Você ganhou um bônus de R$ 50,00 na sua próxima compra!"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Histórico de QR Codes</CardTitle>
                <CardDescription>Todas as vendas vinculadas à promoção.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {history.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-muted-foreground border-2 border-dashed border-sidebar-border/30 rounded-2xl">
                    Nenhum QR Code gerado ainda.
                  </div>
                ) : (
                  history.map((item: any) => (
                    <div 
                      key={item.id} 
                      className="group relative flex items-center gap-4 rounded-2xl border border-sidebar-border/50 bg-muted/10 p-4 transition-all hover:bg-muted/20 hover:border-sidebar-primary/30"
                    >
                      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${item.is_awarded ? 'bg-success/20 text-success' : 'bg-muted/30 text-muted-foreground'}`}>
                        {item.is_awarded ? <Trophy className="size-6" /> : <QrCode className="size-6" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-white truncate">{item.client_name || "CONSUMIDOR"}</h4>
                          {item.is_awarded ? (
                            <Badge className="bg-success text-white text-[10px] h-4">PREMIADO</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] h-4">PADRÃO</Badge>
                          )}
                          {item.status === 'cancelado' && (
                            <Badge variant="destructive" className="text-[10px] h-4">CANCELADO</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-1"><Receipt className="size-3" /> {item.sale_code || item.promo_qr?.split('-')[1]}</span>
                          <span className="flex items-center gap-1"><History className="size-3" /> {dateTimeBR(item.created_at)}</span>
                          <span className="text-sidebar-primary font-bold uppercase">{item.promo_qr}</span>
                          {item.counter_pos !== undefined && (
                            <span className="bg-sidebar-primary/10 px-1.5 py-0.5 rounded border border-sidebar-primary/20 text-sidebar-primary">POS: {item.counter_pos}</span>
                          )}
                        </div>
                      </div>

                      {item.is_awarded && (
                        <div className="text-right">
                          <div className="text-gold font-bold text-sm">{brl(item.bonus_value)}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">{item.available_bonus ? 'Disponível' : 'Utilizado'}</div>
                        </div>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteHistory(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-6 flex flex-col items-center">
           <div className="flex gap-4 mb-6">
             <Button variant="outline" className="bg-muted/20 border-sidebar-border/50">Simular Premiado</Button>
             <Button variant="outline" className="bg-muted/20 border-sidebar-border/50">Simular Padrão</Button>
           </div>
           
           <div className="relative w-full max-w-[400px]">
              <div className="absolute inset-0 bg-gold/5 blur-[80px] rounded-full pointer-events-none" />
              <div className="relative bg-white text-black p-8 font-mono text-[11px] leading-tight border-2 border-dashed border-gray-300 shadow-2xl" 
                   style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <div className="text-center space-y-1 mb-4">
                  <h2 className="font-bold text-base uppercase">AMSTORE BAGSHOES</h2>
                  <div className="text-[9px]">
                    <p>CNPJ: XX.XXX.XXX/XXXX-XX</p>
                    <p>Tel: (73) 99120-0426</p>
                    <p>Rua Waldeiza Rosa, 42 - A - Jequié - BA</p>
                  </div>
                </div>
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>Cupom:</span><span>PRÉVIA-2024</span></div>
                  <div className="flex justify-between"><span>Data:</span><span>{new Date().toLocaleString('pt-BR')}</span></div>
                  <div className="flex justify-between"><span>Cliente:</span><span className="font-bold">CLIENTE EXEMPLO</span></div>
                </div>
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="font-bold mb-1 uppercase">Itens da Simulação</div>
                <div className="flex justify-between">
                  <span>EXEMPLO DE PRODUTO TAM 37</span>
                  <span>R$ 150,00</span>
                </div>
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>R$ 150,00</span></div>
                <div className="border-t border-dashed border-gray-300 my-2" />
                
                <div className="text-center py-2">
                  <p className="font-bold mb-2 flex items-center justify-center gap-2">
                     <Gift className="size-3" /> PROMOÇÃO: {data.name || "QR Code Premiado"}
                  </p>
                  <div className="mx-auto w-32 h-32 bg-muted/20 flex items-center justify-center border-2 border-dashed border-gray-200 mb-2">
                    <QrCode className="size-16 text-gray-300" />
                  </div>
                  <p className="text-[8px] text-gray-400 mb-2 uppercase">QR-XXXX-SIMULACAO</p>
                  <p className="text-gray-600 font-bold leading-tight px-2 text-[10px]">
                    {data.awarded_message || "PARABÉNS! Você foi sorteado!"}
                  </p>
                </div>
                
                <div className="border-t border-dashed border-gray-300 my-2" />
                <div className="text-center text-[9px] space-y-1 mt-2">
                  <p>Obrigado pela preferência! 🌟</p>
                  <p className="font-bold italic">AmStore Bagshoes</p>
                </div>
              </div>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
