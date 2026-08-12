import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent, QrCode, History, Receipt, Save, RefreshCcw, Trash2, Gift, Trophy, Star } from "lucide-react";
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
    order: { column: "created_at", ascending: false } 
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
    if (!formData) return;
    try {
      await updateConfigFn({ data: formData });
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

  if (!formData) return null;

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

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard 
          title="Vendas Atuais" 
          value={currentConfig?.current_counter || 0} 
          icon={BadgePercent} 
          tone="dark" 
        />
        <StatCard 
          title="Limite do Ciclo" 
          value={currentConfig?.sales_limit || 0} 
          icon={RefreshCcw} 
          tone="dark" 
        />
        <StatCard 
          title="Total de Premiados" 
          value={history.filter((h: any) => h.is_awarded).length} 
          icon={Trophy} 
          tone="success" 
        />
        <StatCard 
          title="Bônus Entregues" 
          value={brl(history.filter((h: any) => h.is_awarded).reduce((acc: number, curr: any) => acc + (curr.bonus_value || 0), 0))} 
          icon={Star} 
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
                    checked={formData.active} 
                    onCheckedChange={(v) => setFormData({ ...formData, active: v })} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome da Campanha</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Natal Premiado Amstore"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite de Vendas (Ciclo)</Label>
                    <Input 
                      type="number"
                      value={formData.sales_limit} 
                      onChange={(e) => setFormData({ ...formData, sales_limit: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Bônus (R$)</Label>
                    <Input 
                      type="number"
                      value={formData.bonus_value} 
                      onChange={(e) => setFormData({ ...formData, bonus_value: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Posições Premiadas (Separadas por vírgula)</Label>
                  <Input 
                    value={formData.awarded_positions} 
                    onChange={(e) => setFormData({ ...formData, awarded_positions: e.target.value })}
                    placeholder="Ex: 5, 10, 25, 50"
                  />
                  <p className="text-[10px] text-muted-foreground">O bônus será concedido quando o contador atingir essas posições.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} className="flex-1 bg-gradient-gold text-white shadow-gold">
                    <Save className="mr-2 size-4" /> Salvar Configurações
                  </Button>
                  <Button variant="outline" onClick={handleResetCounter} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                    <RefreshCcw className="mr-2 size-4" /> Zerar Contador
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
                    value={formData.standard_message} 
                    onChange={(e) => setFormData({ ...formData, standard_message: e.target.value })}
                    placeholder="Ex: Que pena! Continue comprando para concorrer."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem do Ganhador</Label>
                  <Textarea 
                    rows={4}
                    value={formData.awarded_message} 
                    onChange={(e) => setFormData({ ...formData, awarded_message: e.target.value })}
                    placeholder="Ex: PARABÉNS! Você ganhou um bônus de R$ 50,00 na sua próxima compra!"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-sidebar-border/50 bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Histórico de QR Codes Gerados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-sidebar-border/50 bg-muted/10 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-sidebar-border/50 hover:bg-transparent">
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Código QR</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bônus</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Nenhum QR Code gerado ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((item: any) => (
                        <TableRow key={item.id} className="border-sidebar-border/30 hover:bg-sidebar/40">
                          <TableCell className="text-xs text-muted-foreground">{dateTimeBR(item.created_at)}</TableCell>
                          <TableCell className="font-medium text-white">{item.client_name || "CONSUMIDOR"}</TableCell>
                          <TableCell className="font-mono text-[10px] text-sidebar-primary uppercase">{item.promo_qr}</TableCell>
                          <TableCell>
                            {item.is_awarded ? (
                              <Badge className="bg-success/12 text-success border-success/20">PREMIADO</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">PADRÃO</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gold font-bold">
                            {item.is_awarded ? brl(item.bonus_value) : "—"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteHistory(item.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
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
                     <Gift className="size-3" /> PROMOÇÃO: {formData.name || "QR Code Premiado"}
                  </p>
                  <div className="mx-auto w-32 h-32 bg-muted/20 flex items-center justify-center border-2 border-dashed border-gray-200 mb-2">
                    <QrCode className="size-16 text-gray-300" />
                  </div>
                  <p className="text-[8px] text-gray-400 mb-2 uppercase">QR-XXXX-SIMULACAO</p>
                  <p className="text-gray-600 font-bold leading-tight px-2 text-[10px]">
                    {formData.awarded_message || "PARABÉNS! Você foi sorteado!"}
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
