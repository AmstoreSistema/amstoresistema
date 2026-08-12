import { createFileRoute } from "@tanstack/react-router";
import { Settings, User, Bell, Database, Zap, Save, UserPlus, Shield, Power, Download, Upload, Store, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings, updateAppSettingsBatch, getUsers, updateUserStatus, updateUserRole } from "@/lib/settings.functions";
import { exportSystemData, importSystemData } from "@/lib/backup.functions";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — Amstore Gestão" },
      { name: "description", content: "Ajuste as configurações gerais, alertas e preferências do sistema." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("geral");
  const [settings, setSettings] = useState<any[]>([]);
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  
  const backupModules = [
    {
      id: "producao",
      label: "Produção",
      items: [
        { id: "materials", label: "Materiais" },
        { id: "products", label: "Produtos" },
        { id: "product_materials", label: "Composições de Materiais" },
        { id: "production_orders", label: "Ordens de Produção" },
        { id: "material_cuts", label: "Cortes de Couro" },
        { id: "material_variations", label: "Cupons de Produção" }, // Mapping to material_variations as context suggests
      ]
    },
    {
      id: "estoque",
      label: "Estoque",
      items: [
        { id: "stock_products", label: "Estoque de Produtos" },
      ]
    },
    {
      id: "loja",
      label: "Loja",
      items: [
        { id: "clients", label: "Clientes" },
        { id: "sales", label: "Vendas" },
        { id: "sale_items", label: "Itens de Venda" },
        { id: "sale_payments", label: "Pagamentos de Vendas" },
        { id: "sale_installments", label: "Parcelas de Vendas" },
      ]
    },
    {
      id: "financeiro",
      label: "Financeiro",
      items: [
        { id: "transactions", label: "Transações Financeiras" },
        { id: "financial_accounts", label: "Contas Financeiras" },
        { id: "accounts", label: "Categorias de Transação" }, // Assuming accounts table for categories based on types
      ]
    },
    {
      id: "compras",
      label: "Compras",
      items: [
        { id: "suppliers", label: "Fornecedores" },
        { id: "purchases", label: "Compras de Materiais" },
        { id: "units_of_measure", label: "Itens de Compra" }, // Mapping units for reference
      ]
    },
    {
      id: "sistema",
      label: "Sistema",
      items: [
        { id: "notifications", label: "Alertas" },
        { id: "material_categories", label: "Configurações de Materiais" },
        { id: "app_settings", label: "Configurações Globais" },
      ]
    }
  ];

  const allTableIds = backupModules.flatMap(m => m.items.map(i => i.id));

  useEffect(() => {
    setSelectedTables(allTableIds);
  }, []);

  const fetchSettings = useServerFn(getAppSettings);
  const saveSettingsBatch = useServerFn(updateAppSettingsBatch);
  const fetchUsers = useServerFn(getUsers);
  const updateStatus = useServerFn(updateUserStatus);
  const updateRole = useServerFn(updateUserRole);
  const exportData = useServerFn(exportSystemData);
  const importData = useServerFn(importSystemData);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, usersData] = await Promise.all([
        fetchSettings(),
        fetchUsers()
      ]);
      setSettings(settingsData);
      setUsers(usersData);
      
      // Initialize local state
      const initialLocal: Record<string, any> = {};
      settingsData.forEach((s: any) => {
        try {
          initialLocal[s.key] = JSON.parse(s.value);
        } catch {
          initialLocal[s.key] = s.value;
        }
      });
      setLocalSettings(initialLocal);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getSettingValue = (key: string, defaultValue: any = "") => {
    return localSettings[key] !== undefined ? localSettings[key] : defaultValue;
  };

  const handleLocalUpdate = (key: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const batch = Object.entries(localSettings).map(([key, value]) => ({
        key,
        value: value === null || value === undefined ? "" : value
      }));
      
      console.log("Salvando configurações:", batch);
      const result = await saveSettingsBatch({ data: batch });
      
      if (result?.success) {
        toast.success("Configurações salvas com sucesso");
        await loadData();
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações. Verifique se você tem permissão de administrador.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast.error("Selecione ao menos um módulo para backup");
      return;
    }
    setSaving(true);
    try {
      const data = await exportData({ data: { tables: selectedTables } });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `amstore-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success("Backup gerado com sucesso");
    } catch (error) {
      console.error("Erro export:", error);
      toast.error("Erro ao gerar backup");
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        await importData({ data: { payload } });
        toast.success("Backup restaurado com sucesso");
        window.location.reload();
      } catch (error) {
        toast.error("Erro ao restaurar backup: arquivo inválido");
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Configurações" 
        description="Personalize e gerencie seu sistema."
        icon={Settings}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto bg-transparent border-b border-border p-0 rounded-none mb-6 overflow-x-auto">
          <TabsTrigger value="geral" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <Settings className="size-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <Bell className="size-4" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <Database className="size-4" /> Backup
          </TabsTrigger>
          <TabsTrigger value="avancado" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <Zap className="size-4" /> Avançado
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <User className="size-4" /> Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border/40 p-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Store className="size-5 text-gold" /> Dados da Empresa
              </CardTitle>
              <CardDescription>Informações que aparecem em recibos e documentos.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da Loja</Label>
                  <Input 
                    value={getSettingValue("store_name", "Amstore")} 
                    onChange={(e) => handleLocalUpdate("store_name", e.target.value)}
                    placeholder="Amstore"
                    className="h-12 border-border/60 focus-visible:ring-gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CNPJ / CPF</Label>
                  <Input 
                    value={getSettingValue("store_document")} 
                    onChange={(e) => handleLocalUpdate("store_document", e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="h-12 border-border/60 focus-visible:ring-gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">E-mail de Contato</Label>
                  <Input 
                    value={getSettingValue("store_email")} 
                    onChange={(e) => handleLocalUpdate("store_email", e.target.value)}
                    placeholder="contato@amstore.com"
                    className="h-12 border-border/60 focus-visible:ring-gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Telefone</Label>
                  <Input 
                    value={getSettingValue("store_phone")} 
                    onChange={(e) => handleLocalUpdate("store_phone", e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-12 border-border/60 focus-visible:ring-gold"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Endereço Completo</Label>
                  <Input 
                    value={getSettingValue("store_address")} 
                    onChange={(e) => handleLocalUpdate("store_address", e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className="h-12 border-border/60 focus-visible:ring-gold"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-border/40 p-6 flex justify-end">
              <Button 
                onClick={handleSaveAll} 
                disabled={saving}
                className="bg-gradient-gold shadow-gold font-bold min-w-[200px]"
              >
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                Salvar Configurações
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="alertas">
          <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border/40 p-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Bell className="size-5 text-gold" /> Notificações e Alertas
              </CardTitle>
              <CardDescription>Configure como e quando o sistema deve te avisar.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/40">
                <div className="space-y-1">
                  <h4 className="font-bold">Alerta de Estoque Mínimo</h4>
                  <p className="text-xs text-muted-foreground">Notificar quando materiais ou produtos atingirem o nível crítico.</p>
                </div>
                <Switch 
                  checked={getSettingValue("alert_stock", true)} 
                  onCheckedChange={(val) => handleLocalUpdate("alert_stock", val)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/40">
                <div className="space-y-1">
                  <h4 className="font-bold">Resumo Diário de Vendas</h4>
                  <p className="text-xs text-muted-foreground">Enviar um resumo das vendas do dia por e-mail.</p>
                </div>
                <Switch 
                  checked={getSettingValue("alert_daily_report", false)} 
                  onCheckedChange={(val) => handleLocalUpdate("alert_daily_report", val)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/40">
                <div className="space-y-1">
                  <h4 className="font-bold">Notificações por WhatsApp</h4>
                  <p className="text-xs text-muted-foreground">Ativar envio de mensagens automáticas de cobrança.</p>
                </div>
                <Switch 
                  checked={getSettingValue("alert_whatsapp", true)} 
                  onCheckedChange={(val) => handleLocalUpdate("alert_whatsapp", val)}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-border/40 p-6 flex justify-end">
              <Button 
                onClick={handleSaveAll} 
                disabled={saving}
                className="bg-gradient-gold shadow-gold font-bold min-w-[200px]"
              >
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                Salvar Configurações
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border/40 p-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Database className="size-5 text-gold" /> Backup e Segurança
              </CardTitle>
              <CardDescription>Exporte seus dados ou restaure um backup anterior.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
                <div className="bg-white rounded-full p-2 h-fit border border-blue-200">
                  <CheckCircle2 className="size-5 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900">Backup Automático Ativado</h4>
                  <p className="text-sm text-blue-700">O sistema faz backup automático a cada 24 horas quando você entra no sistema e salva localmente</p>
                  <ul className="text-xs text-blue-600 list-disc list-inside mt-2 space-y-1">
                    <li>Backup manual (botão) = Download do arquivo</li>
                    <li>Backup automático = Salvo no navegador</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">Selecione o que deseja fazer backup</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTables(allTableIds)}>Todos</Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTables([])}>Nenhum</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {backupModules.map((module) => (
                    <div key={module.id} className="space-y-3">
                      <h4 className="font-bold text-muted-foreground border-b pb-2">{module.label}</h4>
                      <div className="space-y-2">
                        {module.items.map((item) => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`chk-${item.id}`} 
                              checked={selectedTables.includes(item.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTables(prev => [...prev, item.id]);
                                } else {
                                  setSelectedTables(prev => prev.filter(id => id !== item.id));
                                }
                              }}
                            />
                            <Label htmlFor={`chk-${item.id}`} className="text-sm font-medium leading-none cursor-pointer">
                              {item.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Button 
                  onClick={handleExport} 
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-md transition-all flex gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Gerar Backup Agora
                </Button>

                <div className="relative w-full">
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImport}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <Button variant="outline" className="w-full h-12 font-bold border-2 flex gap-2">
                    <Upload className="size-4" />
                    Restaurar Backup (Selecionar Arquivo)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avancado">
          <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border/40 p-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Zap className="size-5 text-gold" /> Configurações Avançadas
              </CardTitle>
              <CardDescription>Parâmetros técnicos e de performance do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tempo de Expiração da Sessão (horas)</Label>
                  <Input 
                    type="number" 
                    value={getSettingValue("session_expiry", 24)} 
                    onChange={(e) => handleLocalUpdate("session_expiry", e.target.value)}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Moeda Padrão</Label>
                  <Select 
                    value={getSettingValue("currency", "BRL")} 
                    onValueChange={(val) => handleLocalUpdate("currency", val)}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real (R$)</SelectItem>
                      <SelectItem value="USD">Dólar ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t border-border/40 p-6 flex justify-end">
              <Button 
                onClick={handleSaveAll} 
                disabled={saving}
                className="bg-gradient-gold shadow-gold font-bold min-w-[200px]"
              >
                {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                Salvar Configurações
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/50 border-b border-border/40 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <User className="size-5 text-gold" /> Gerenciamento de Usuários
                  </CardTitle>
                  <CardDescription>Controle quem tem acesso e quais permissões possuem.</CardDescription>
                </div>
                <Button className="bg-gradient-gold shadow-gold font-bold">
                  <UserPlus className="size-4 mr-2" /> Novo Usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/40">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold">
                        {user.display_name?.slice(0, 2).toUpperCase() || "U"}
                      </div>
                      <div>
                        <h4 className="font-bold">{user.display_name || user.email}</h4>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cargo</Label>
                        <Select 
                          defaultValue={user.user_roles?.[0]?.role || "user"} 
                          onValueChange={async (role: any) => {
                            await updateRole({ data: { userId: user.id, role } });
                            toast.success(`Cargo atualizado para ${role}`);
                            loadData();
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="moderator">Moderador</SelectItem>
                            <SelectItem value="user">Vendedor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                        <Switch 
                          checked={user.active} 
                          onCheckedChange={async (active) => {
                            await updateStatus({ data: { id: user.id, active } });
                            toast.success(active ? "Usuário ativado" : "Usuário desativado");
                            loadData();
                          }}
                        />
                      </div>

                      <Badge variant={user.active ? "default" : "secondary"} className={user.active ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}>
                        {user.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}