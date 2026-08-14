import { createFileRoute } from "@tanstack/react-router";
import { Settings, User, Bell, Database, Zap, Save, UserPlus, Shield, Power, Download, Upload, Store, Loader2, FileJson, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings, updateAppSettingsBatch, getUsers, updateUserStatus, updateUserRole, createNewUser } from "@/lib/settings.functions";
import { exportSystemData, importSystemData } from "@/lib/backup.functions";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Info, Loader2 as Spinner, ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

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
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", display_name: "", role: "admin" as const });
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [backupProgress, setBackupProgress] = useState<{ active: boolean; currentTable: string; percent: number }>({ active: false, currentTable: "", percent: 0 });
  const [importDialog, setImportDialog] = useState<{ open: boolean; payload: any; selected: string[] }>({ open: false, payload: null, selected: [] });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
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
  const createUser = useServerFn(createNewUser);
  const exportData = useServerFn(exportSystemData);
  const importData = useServerFn(importSystemData);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsResult, usersResult] = await Promise.allSettled([
        fetchSettings(),
        fetchUsers()
      ]);

      const settingsData = settingsResult.status === "fulfilled" ? settingsResult.value : [];
      if (settingsResult.status === "rejected") {
        console.error("Erro ao carregar configurações:", settingsResult.reason);
        toast.error("Erro ao carregar configurações");
      }

      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value as any[]);
      } else {
        console.error("Erro ao carregar administradores:", usersResult.reason);
        setUsers([]);
      }

      setSettings(settingsData);
      
      // Initialize local state
      const initialLocal: Record<string, any> = {};
      (settingsData as any[]).forEach((s: any) => {
        try {
          initialLocal[s.key] = JSON.parse(s.value);
        } catch {
          initialLocal[s.key] = s.value;
        }
      });
      setLocalSettings(initialLocal);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do sistema");
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
    setBackupProgress({ active: true, currentTable: "Iniciando...", percent: 0 });
    
    try {
      const exportDataMap: Record<string, any> = {};
      const total = selectedTables.length;
      
      for (let i = 0; i < selectedTables.length; i++) {
        const table = selectedTables[i];
        const label = allTableIds.find(id => id === table) ? 
          backupModules.flatMap(m => m.items).find(item => item.id === table)?.label || table : table;
        
        setBackupProgress({ active: true, currentTable: `Exportando: ${label}`, percent: Math.round((i / total) * 100) });
        
        // Export table by table to show progress
        const result = (await exportData({ data: { tables: [table] } })) as any;
        if (result?.data) {
          const tableKey = table as string;
          exportDataMap[tableKey] = result.data[tableKey];
        }
      }
      
      setBackupProgress({ active: true, currentTable: "Concluído!", percent: 100 });
      
      const finalData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        data: exportDataMap
      };
      
      const blob = new Blob([JSON.stringify(finalData, null, 2)], { type: "application/json" });
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
      setTimeout(() => setBackupProgress(prev => ({ ...prev, active: false })), 2000);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        
        // Check if it's a Base44 backup (versao can be a string or number)
        const isBase44 = payload.tabelas && (payload.versao === "1.0" || payload.versao === 1.0 || payload.versao === 1);
        
        if (isBase44) {
          toast.info("Backup Base44 detectado. Mapeando dados...");
          
          setSaving(true);
          try {
            await importData({ data: { payload, isBase44: true } });
            toast.success("Dados do Base44 restaurados com sucesso!");
            setTimeout(() => window.location.reload(), 1500);
          } catch (error: any) {
            toast.error(`Erro na restauração Base44: ${error.message}`);
          } finally {
            setSaving(false);
          }
          return;
        }

        if (!payload.data) throw new Error("Formato inválido");
        
        const availableTables = Object.keys(payload.data);
        setImportDialog({
          open: true,
          payload,
          selected: availableTables
        });
      } catch (error) {
        toast.error("Erro ao carregar arquivo de backup: formato inválido");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleConfirmImport = async () => {
    if (importDialog.selected.length === 0) {
      toast.error("Selecione ao menos um item para restaurar");
      return;
    }

    setSaving(true);
    setBackupProgress({ active: true, currentTable: "Iniciando restauração...", percent: 0 });
    
    try {
      const total = importDialog.selected.length;
      
      for (let i = 0; i < importDialog.selected.length; i++) {
        const table = importDialog.selected[i];
        const label = backupModules.flatMap(m => m.items).find(item => item.id === table)?.label || table;
        
        setBackupProgress({ active: true, currentTable: `Restaurando: ${label}`, percent: Math.round((i / total) * 100) });
        
        await importData({ data: { payload: importDialog.payload, tables: [table] } });
      }
      
      setBackupProgress({ active: true, currentTable: "Restauração Concluída!", percent: 100 });
      toast.success("Backup restaurado com sucesso");
      setImportDialog({ open: false, payload: null, selected: [] });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Erro import:", error);
      toast.error("Erro ao restaurar backup");
    } finally {
      setSaving(false);
    }
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logomarca da Loja</Label>
                  <div className="flex items-center gap-4">
                    <div className="size-24 rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {getSettingValue("store_logo") ? (
                        <img src={getSettingValue("store_logo")} alt="Logo" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Store className="size-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input 
                        type="text"
                        placeholder="URL da Logomarca"
                        value={getSettingValue("store_logo")}
                        onChange={(e) => handleLocalUpdate("store_logo", e.target.value)}
                        className="h-10 border-border/60 focus-visible:ring-gold"
                      />
                      <p className="text-[10px] text-muted-foreground">Insira a URL da imagem ou use o componente de upload se disponível.</p>
                    </div>
                  </div>
                </div>
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
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Website (Site)</Label>
                  <Input 
                    value={getSettingValue("store_website")} 
                    onChange={(e) => handleLocalUpdate("store_website", e.target.value)}
                    placeholder="www.amstore.com.br"
                    className="h-12 border-border/60 focus-visible:ring-gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instagram</Label>
                  <Input 
                    value={getSettingValue("store_instagram")} 
                    onChange={(e) => handleLocalUpdate("store_instagram", e.target.value)}
                    placeholder="@amstorebagshoes"
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
              {backupProgress.active && (
                <div className="bg-muted/30 border border-border/40 rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-gold/10 flex items-center justify-center">
                        {backupProgress.percent === 100 ? (
                          <CheckCircle className="size-5 text-green-500" />
                        ) : (
                          <Loader2 className="size-5 text-gold animate-spin" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{backupProgress.currentTable}</h4>
                        <p className="text-xs text-muted-foreground">Progresso do processo atual</p>
                      </div>
                    </div>
                    <span className="text-xl font-black text-gold">{backupProgress.percent}%</span>
                  </div>
                  <Progress value={backupProgress.percent} className="h-2 bg-muted border-none" />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
                <div className="bg-white rounded-full p-2 h-fit border border-blue-200">
                  <CheckCircle2 className="size-5 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-900">Backup Automático Ativado</h4>
                  <p className="text-sm text-blue-700">O sistema faz backup automático a cada 24 horas quando você entra no sistema e salva localmente</p>
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

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={handleExport} 
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-md transition-all flex gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Gerar Backup Agora
                </Button>

                <div className="relative flex-1">
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportFile}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <Button variant="outline" className="w-full h-12 font-bold border-2 flex gap-2 border-gold/40 text-gold hover:bg-gold/5">
                    <Upload className="size-4" />
                    Restaurar Backup BASE
                  </Button>
                </div>
              </div>

              {/* Import Selection Modal */}
              {importDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                  <Card className="w-full max-w-2xl rounded-[2rem] border-gold/20 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                    <CardHeader className="bg-muted/50 border-b border-border/40 p-8">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20">
                          <FileJson className="size-6 text-gold" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-black">Restaurar Backup</CardTitle>
                          <CardDescription>Selecione quais módulos deseja restaurar do arquivo enviado.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-4">
                          <h3 className="font-bold text-lg">Módulos encontrados no arquivo</h3>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setImportDialog(prev => ({ ...prev, selected: Object.keys(prev.payload.data) }))}
                              className="h-8 text-[10px] uppercase tracking-widest font-bold"
                            >
                              Todos
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setImportDialog(prev => ({ ...prev, selected: [] }))}
                              className="h-8 text-[10px] uppercase tracking-widest font-bold"
                            >
                              Nenhum
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[40vh] overflow-y-auto p-2 pr-4 custom-scrollbar">
                          {Object.keys(importDialog.payload.data).map((tableId) => {
                            const label = backupModules.flatMap(m => m.items).find(item => item.id === tableId)?.label || tableId;
                            const rowCount = importDialog.payload.data[tableId]?.length || 0;
                            
                            return (
                              <div 
                                key={tableId} 
                                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                  importDialog.selected.includes(tableId) 
                                    ? "bg-gold/5 border-gold shadow-[0_0_15px_-5px_rgba(212,175,55,0.3)]" 
                                    : "bg-muted/20 border-border/40 hover:border-gold/30"
                                }`}
                                onClick={() => {
                                  setImportDialog(prev => ({
                                    ...prev,
                                    selected: prev.selected.includes(tableId)
                                      ? prev.selected.filter(id => id !== tableId)
                                      : [...prev.selected, tableId]
                                  }));
                                }}
                              >
                                <Checkbox 
                                  id={`import-${tableId}`} 
                                  checked={importDialog.selected.includes(tableId)}
                                  className="mt-1 border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:text-black"
                                />
                                <div className="space-y-1">
                                  <Label 
                                    htmlFor={`import-${tableId}`} 
                                    className="font-bold text-sm cursor-pointer block"
                                  >
                                    {label}
                                  </Label>
                                  <Badge variant="secondary" className="bg-muted/50 text-[10px] py-0 h-4 border-none">
                                    {rowCount} registros
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t border-border/40 p-8 flex justify-end gap-4">
                      <Button 
                        variant="ghost" 
                        onClick={() => setImportDialog({ open: false, payload: null, selected: [] })}
                        disabled={saving}
                        className="font-bold"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        className="bg-gradient-gold shadow-gold font-bold min-w-[200px] h-12"
                        onClick={handleConfirmImport}
                        disabled={saving || importDialog.selected.length === 0}
                      >
                        {saving ? (
                          <>
                            <Spinner className="size-4 mr-2 animate-spin" />
                            Restaurando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-4 mr-2" />
                            Iniciar Restauração
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}
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
                    <Shield className="size-5 text-gold" /> Administradores do Sistema
                  </CardTitle>
                  <CardDescription>Gerencie os e-mails com acesso total ao sistema.</CardDescription>
                </div>
                <Button 
                  onClick={() => setIsNewUserModalOpen(true)}
                  className="bg-gradient-gold shadow-gold font-bold"
                >
                  <UserPlus className="size-4 mr-2" /> Adicionar Administrador
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-4">
                {users.filter(u => u.user_roles?.[0]?.role === 'admin' || ['amstorebagshoes@gmail.com', 'matosmonica000@gmail.com'].includes(u.email)).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/40 hover:border-gold/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-full bg-gold/10 flex items-center justify-center text-gold font-bold">
                        {user.email?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold">{user.display_name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gold/20 text-gold border-gold/30">Administrador</Badge>
                      {!['amstorebagshoes@gmail.com', 'matosmonica000@gmail.com'].includes(user.email) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (confirm("Remover este administrador?")) {
                              await updateRole({ data: { userId: user.id, role: "user" } });
                              toast.success("Cargo alterado");
                              loadData();
                            }
                          }}
                        >
                          Remover Acesso
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
              {/* New User Modal */}
              {isNewUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <Card className="w-full max-w-md">
                    <CardHeader>
                      <CardTitle>Cadastrar Novo Usuário</CardTitle>
                      <CardDescription>Crie um novo acesso para o sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input 
                          value={newUser.display_name} 
                          onChange={(e) => setNewUser({...newUser, display_name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input 
                          type="email"
                          value={newUser.email} 
                          onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Senha</Label>
                        <Input 
                          type="password"
                          value={newUser.password} 
                          onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo</Label>
                        <Select 
                          value={newUser.role} 
                          onValueChange={(role: any) => setNewUser({...newUser, role})}
                          disabled
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Apenas administradores podem ser cadastrados conforme nova regra do sistema.</p>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setIsNewUserModalOpen(false)}>Cancelar</Button>
                      <Button 
                        className="bg-gradient-gold shadow-gold font-bold"
                        onClick={async () => {
                          try {
                            setSaving(true);
                            await createUser({ data: newUser });
                            toast.success("Administrador cadastrado");
                            setIsNewUserModalOpen(false);
                            setNewUser({ email: "", password: "", display_name: "", role: "admin" });
                            loadData();
                          } catch (error: any) {
                            toast.error(error.message);
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving}
                      >
                        {saving ? <Spinner className="size-4 animate-spin" /> : "Criar Usuário"}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}