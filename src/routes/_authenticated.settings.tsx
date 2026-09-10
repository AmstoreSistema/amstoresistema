import { createFileRoute } from "@tanstack/react-router";
import { Settings, User, Bell, Database, Zap, Save, UserPlus, Shield, Power, Download, Upload, Store, Loader2, FileJson, CheckCircle, Trash2, Link2, ShoppingBag, DollarSign, Package, Gift, RefreshCw, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { resetSystemData } from "@/lib/system-reset.functions";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings, updateAppSettingsBatch, getUsers, updateUserStatus, updateUserRole, createNewUser, updateUserName } from "@/lib/settings.functions";
import { exportSystemData, importSystemData, inspectBackupFile, reconcileOrphanTransactions, linkSaleItemsAndFillStock, getRestorationAuditReport } from "@/lib/backup.functions";
import { IMPORT_ORDER } from "@/lib/backup-mapping";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Info, Loader2 as Spinner, ImageIcon, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/amstore-symbol.png.asset.json";


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
  const [importDialog, setImportDialog] = useState<{ open: boolean; payload: any; selected: string[]; counts: Record<string, number>; skipped: Record<string, number>; format: "amstore" | "externo" }>({ open: false, payload: null, selected: [], counts: {}, skipped: {}, format: "amstore" });
  const [reportDialog, setReportDialog] = useState<{
    open: boolean;
    inserted: number;
    updated: number;
    failed: number;
    productsCreated: number;
    tableSummaries: Record<string, { inserted: number; updated: number; failed: number }>;
    errors: string[];
  }>({
    open: false,
    inserted: 0,
    updated: 0,
    failed: 0,
    productsCreated: 0,
    tableSummaries: {},
    errors: [],
  });

  const [auditReport, setAuditReport] = useState<any>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [linkingStock, setLinkingStock] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const reconcileTransactions = useServerFn(reconcileOrphanTransactions);
  const runLinkStock = useServerFn(linkSaleItemsAndFillStock);
  const fetchAudit = useServerFn(getRestorationAuditReport);

  const loadAuditReport = async () => {
    setLoadingAudit(true);
    try {
      const data = await fetchAudit();
      setAuditReport(data);
    } catch (err: any) {
      console.warn("Erro ao carregar relatório de auditoria:", err?.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleLinkStock = async () => {
    setLinkingStock(true);
    try {
      toast.info("Vinculando itens das vendas aos produtos e preenchendo o estoque...");
      const res: any = await runLinkStock();
      if (res?.success) {
        toast.success(
          `Concluído: ${res.itemsLinked} itens vinculados, ${res.productsCreated} novos produtos criados e ${res.stockUpdated} estoques sincronizados!`,
          { duration: 6000 }
        );
        loadAuditReport();
      } else {
        toast.error(`Erro ao vincular estoque: ${res?.message || "falha desconhecida"}`);
      }
    } catch (err: any) {
      toast.error(`Erro ao vincular estoque: ${err.message}`);
    } finally {
      setLinkingStock(false);
    }
  };

  const handleReconcileTransactions = async () => {
    setReconciling(true);
    try {
      toast.info("Verificando e vinculando transações órfãs aos clientes e vendas...");
      const res: any = await reconcileTransactions();
      if (res?.success) {
        toast.success(
          `Conciliação finalizada: ${res.fixedSales} vendas vinculadas e ${res.fixedClients} clientes vinculados (${res.totalOrphans} transações avaliadas).`,
          { duration: 6000 }
        );
        loadAuditReport();
      } else {
        toast.error(`Erro ao conciliar transações: ${res?.message || "falha desconhecida"}`);
      }
    } catch (err: any) {
      toast.error(`Erro ao conciliar transações: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  };

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const runResetSystem = useServerFn(resetSystemData);


  const handleResetSystem = async () => {
    setResetting(true);
    try {
      await runResetSystem({ data: { confirm: "ZERAR" } });
      toast.success("Sistema zerado com sucesso. Recarregando...");
      setResetDialogOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error(`Não foi possível zerar os dados: ${error?.message ?? "falha desconhecida"}`);
    } finally {
      setResetting(false);
    }
  };
  
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
        { id: "material_variations", label: "Cupons de Produção" },
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
        { id: "condicionais", label: "Saídas Condicionais" },
        { id: "condicional_items", label: "Itens Condicionais" },
      ]
    },
    {
      id: "financeiro",
      label: "Financeiro",
      items: [
        { id: "transactions", label: "Transações Financeiras" },
        { id: "financial_accounts", label: "Contas Financeiras" },
        { id: "accounts", label: "Categorias de Transação" },

      ]
    },
    {
      id: "compras",
      label: "Compras",
      items: [
        { id: "suppliers", label: "Fornecedores" },
        { id: "purchases", label: "Compras de Materiais" },
        { id: "purchase_items", label: "Itens de Compra" },
        { id: "units_of_measure", label: "Unidades de Medida" },
      ]
    },
    {
      id: "fidelidade",
      label: "Fidelidade & Cashback",
      items: [
        { id: "cashback_config", label: "Regras de Cashback" },
        { id: "cashback_entries", label: "Movimentações de Cashback" },
        { id: "CashbackCategoria", label: "Categorias Cashback (Externo)" },
        { id: "CashbackCliente", label: "Saldos Cashback (Externo)" },
        { id: "CashbackMovimentacao", label: "Movimentações Cashback (Externo)" },
        { id: "CashbackHistorico", label: "Histórico Cashback (Externo)" },
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
  const updateName = useServerFn(updateUserName);
  const exportData = useServerFn(exportSystemData);
  const importData = useServerFn(importSystemData);
  const inspectBackup = useServerFn(inspectBackupFile);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsResult, usersResult] = await Promise.allSettled([
        fetchSettings(),
        fetchUsers()
      ]);

      loadAuditReport();

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
      toast.error((error as any)?.message || "Erro ao salvar configurações.");
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
        console.log("[Import] Objeto JSON carregado:", payload);
        
        const isNative = !!payload?.data && !!payload?.version;

        if (isNative) {
          const counts = Object.fromEntries(
            Object.entries(payload.data as Record<string, any[]>).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
          );
          setImportDialog({ open: true, payload, selected: Object.keys(counts), counts, skipped: {}, format: "amstore" });
          return;
        }

        // Backup externo (Base44 e similares): inspeciona, mapeia e abre o mesmo diálogo de seleção
        toast.info("Backup externo detectado. Analisando dados...");
        setSaving(true);
        try {
          const info = await inspectBackup({ data: { payload } });
          const rawCounts = (info.collections as Record<string, number>) || {};
          const counts = Object.fromEntries(
            Object.entries(rawCounts).filter(
              ([k]) => k !== "__ignorado" && !k.startsWith("__") && k !== "ignorado"
            )
          );
          
          const hasData = Object.keys(counts).length > 0;
          const hasSkipped = Object.keys(info.skipped as Record<string, number>).length > 0;

          if (!hasData && !hasSkipped) {
            toast.error("Este arquivo parece estar vazio ou não contém dados estruturados.");
            return;
          }

          setImportDialog({
            open: true,
            payload,
            selected: Object.keys(counts),
            counts,
            skipped: (info.skipped as Record<string, number>) ?? {},
            format: "externo",
          });
        } catch (error: any) {
          toast.error(`Erro ao analisar backup: ${error?.message ?? "falha desconhecida"}`);
        } finally {
          setSaving(true); // Manter saving como true para evitar múltiplos cliques enquanto processa, mas as funções acima já lidam com isso
          setSaving(false);
        }
      } catch (error) {
        toast.error("Erro ao carregar arquivo de backup: o arquivo não é um JSON válido");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const closeImportDialog = () =>
    setImportDialog({ open: false, payload: null, selected: [], counts: {}, skipped: {}, format: "amstore" });

  const handleConfirmImport = async () => {
    if (importDialog.selected.length === 0) {
      toast.error("Selecione ao menos um item para restaurar");
      return;
    }

    const payload = importDialog.payload;
    const orderOf = (t: string) => (IMPORT_ORDER.indexOf(t) === -1 ? 99 : IMPORT_ORDER.indexOf(t));
    const tables = [...importDialog.selected].sort((a, b) => orderOf(a) - orderOf(b));

    // Fecha o diálogo para que a barra de progresso fique visível durante a restauração.
    closeImportDialog();
    setSaving(true);
    setBackupProgress({ active: true, currentTable: "Iniciando restauração...", percent: 0 });

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let productsCreated = 0;
    const tableSummaries: Record<string, { inserted: number; updated: number; failed: number }> = {};
    const errors: string[] = [];

    try {
      const total = tables.length;

      for (let i = 0; i < total; i++) {
        const table = tables[i];
        if (!table) continue;
        
        const label = backupModules.flatMap(m => m.items).find(item => item.id === table)?.label || table;

        // Atualiza o progresso no início de cada tabela
        setBackupProgress({ active: true, currentTable: `Restaurando: ${label}`, percent: Math.round((i / total) * 100) });

        try {
          const result: any = await importData({ data: { payload, tables: [table] } });
          const tableResult = result?.results?.[table];
          
          const ins = tableResult?.inserted ?? 0;
          const upd = tableResult?.updated ?? 0;
          const fail = tableResult?.failed ?? 0;

          inserted += ins;
          updated += upd;
          failed += fail;
          productsCreated += result?.summary?.productsCreated ?? 0;

          tableSummaries[table] = { inserted: ins, updated: upd, failed: fail };

          // Se houve falha parcial na tabela, adicionamos aos erros para informar o usuário no final
          if (fail > 0 && tableResult?.error) {
            errors.push(`${label}: ${tableResult.error}`);
          }
        } catch (error: any) {
          errors.push(`${label}: ${error?.message ?? "falha na conexão"}`);
        }
      }

      setBackupProgress({ active: true, currentTable: "Finalizando...", percent: 100 });

      if (inserted === 0 && updated === 0 && failed > 0) {
        toast.error(`A restauração falhou.${errors[0] ? ` ${errors[0]}` : ""}`);
      } else {
        toast.success(`Restauração concluída: ${inserted} inseridos, ${updated} atualizados.`);
      }

      // Abre o diálogo com o relatório completo da restauração
      setReportDialog({
        open: true,
        inserted,
        updated,
        failed,
        productsCreated,
        tableSummaries,
        errors,
      });
    } catch (error) {
      console.error("Erro import:", error);
      toast.error("Erro inesperado ao restaurar backup");
    } finally {
      setSaving(false);
      setTimeout(() => setBackupProgress(prev => ({ ...prev, active: false })), 2000);
    }
  };

  
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error("Imagem muito grande. Use um arquivo de até 1 MB.");
      e.target.value = "";
      return;
    }

    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
        reader.readAsDataURL(file);
      });

      setLocalSettings((prev) => ({ ...prev, store_logo: dataUrl }));
      await saveSettingsBatch({ data: [{ key: "store_logo", value: dataUrl }] });

      toast.success("Logomarca carregada e salva com sucesso!");
      await loadData();
    } catch (error: any) {
      console.error("Erro no upload da logo:", error);
      toast.error(`Erro ao carregar logomarca: ${error.message}`);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      setLocalSettings((prev) => ({ ...prev, store_logo: "" }));
      await saveSettingsBatch({ data: [{ key: "store_logo", value: "" }] });
      toast.success("Logomarca excluída! O nome 'AMSTORE BAGSHOES' voltou a ser exibido no cabeçalho.");
      await loadData();
    } catch (error: any) {
      console.error("Erro ao remover logo:", error);
      toast.error(`Erro ao excluir logomarca: ${error.message}`);
    } finally {
      setUploadingLogo(false);
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto bg-transparent border-b border-border p-0 rounded-none mb-6 overflow-x-auto">
          <TabsTrigger value="geral" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <Settings className="size-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="cupom" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none py-3">
            <Printer className="size-4" /> Cupom Fiscal
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
                    <div className="size-24 rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
                      {uploadingLogo ? (
                        <Spinner className="size-8 animate-spin text-gold" />
                      ) : (
                        <img
                          src={getSettingValue("store_logo") || logoAsset.url}
                          alt="Logomarca da loja"
                          className="max-h-full max-w-full object-contain p-2"
                        />
                      )}
                    </div>
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-col gap-2">
                        <Input 
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="flex-1 gap-2 border-dashed border-gold/50 hover:border-gold hover:bg-gold/5"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? (
                              <Spinner className="size-4 animate-spin" />
                            ) : (
                              <Upload className="size-4" />
                            )}
                            {getSettingValue("store_logo") ? "Trocar Logomarca" : "Carregar Logomarca"}
                          </Button>
                          {getSettingValue("store_logo") && (
                            <Button
                              type="button"
                              variant="outline"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                              onClick={handleRemoveLogo}
                              disabled={uploadingLogo}
                              title="Excluir Logomarca"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        Recomendado: PNG ou JPG com fundo transparente ou branco.
                      </p>
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

        <TabsContent value="cupom" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna da Esquerda: Upload e Configurações */}
            <div className="lg:col-span-6 space-y-6">
              {/* Card de Logomarca do Cupom */}
              <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/50 border-b border-border/40 p-6 sm:p-8">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <ImageIcon className="size-5 text-gold" /> Logomarca do Cupom Fiscal
                  </CardTitle>
                  <CardDescription className="mt-1">
                    A imagem enviada substituirá o título "AMSTORE BAGSHOES" no topo dos cupons impressos e compartilhados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-8 space-y-6">
                  {/* Status atual da logomarca */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-muted/20 border border-border/40">
                    <div className="size-32 rounded-2xl bg-white border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0 shadow-inner p-2">
                      {uploadingLogo ? (
                        <Spinner className="size-8 animate-spin text-gold" />
                      ) : getSettingValue("store_logo") ? (
                        <img
                          src={getSettingValue("store_logo")}
                          alt="Logomarca do cupom"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <Store className="size-8 text-muted-foreground/40 mx-auto mb-1" />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold leading-tight block">
                            Sem Logomarca
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 flex-1 text-center sm:text-left">
                      <div>
                        {getSettingValue("store_logo") ? (
                          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-1">
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs font-bold">
                              <CheckCircle2 className="size-3 mr-1" /> Logomarca Ativa no Topo
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mb-1">
                            <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs font-bold">
                              Exibindo Nome em Texto
                            </Badge>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {getSettingValue("store_logo")
                            ? "A logomarca está ativa e visível no cabeçalho do cupom impresso."
                            : "Nenhuma logomarca cadastrada. O cupom exibirá o nome 'AMSTORE BAGSHOES'."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <Input 
                          id="cupom-logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="gap-2 border-dashed border-gold/50 hover:border-gold hover:bg-gold/5 font-semibold text-xs h-10 rounded-xl"
                          onClick={() => document.getElementById('cupom-logo-upload')?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? <Spinner className="size-4 animate-spin" /> : <Upload className="size-4" />}
                          {getSettingValue("store_logo") ? "Trocar Logomarca" : "Fazer Upload da Logomarca"}
                        </Button>

                        {getSettingValue("store_logo") && (
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-semibold text-xs h-10 rounded-xl"
                            onClick={handleRemoveLogo}
                            disabled={uploadingLogo}
                          >
                            <Trash2 className="size-4" />
                            Excluir Logomarca
                          </Button>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground italic">
                        Dica: use imagens com fundo transparente (PNG) ou branco com bom contraste para uma impressão térmica nítida.
                      </p>
                    </div>
                  </div>

                  {/* Informações impressas no rodapé e cabeçalho */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Store className="size-4 text-gold" /> Dados do Cabeçalho e Rodapé do Cupom
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Endereço da Loja</Label>
                        <Input 
                          value={getSettingValue("store_address", "Rua Medeiros Neto, 12-A - Centro")} 
                          onChange={(e) => handleLocalUpdate("store_address", e.target.value)}
                          placeholder="Rua Medeiros Neto, 12-A - Centro"
                          className="h-10 border-border/60"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Cidade / UF</Label>
                          <Input 
                            value={getSettingValue("store_city", "Jequié - BA")} 
                            onChange={(e) => handleLocalUpdate("store_city", e.target.value)}
                            placeholder="Jequié - BA"
                            className="h-10 border-border/60"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Telefone de Contato</Label>
                          <Input 
                            value={getSettingValue("store_phone", "73999269136")} 
                            onChange={(e) => handleLocalUpdate("store_phone", e.target.value)}
                            placeholder="73999269136"
                            className="h-10 border-border/60"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Site</Label>
                          <Input 
                            value={getSettingValue("store_website", "www.amstorebagshoes.com.br")} 
                            onChange={(e) => handleLocalUpdate("store_website", e.target.value)}
                            placeholder="www.amstorebagshoes.com.br"
                            className="h-10 border-border/60"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Instagram</Label>
                          <Input 
                            value={getSettingValue("store_instagram", "@amstorebagshoes")} 
                            onChange={(e) => handleLocalUpdate("store_instagram", e.target.value)}
                            placeholder="@amstorebagshoes"
                            className="h-10 border-border/60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t border-border/40 p-4 sm:p-6 flex justify-end">
                  <Button 
                    onClick={handleSaveAll} 
                    disabled={saving}
                    className="bg-gradient-gold shadow-gold font-bold"
                  >
                    {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                    Salvar Informações
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Coluna da Direita: Visualização Real do Cupom Fiscal */}
            <div className="lg:col-span-6 space-y-4">
              <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden bg-muted/10">
                <CardHeader className="bg-muted/50 border-b border-border/40 p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Printer className="size-5 text-gold" /> Visualização Real do Cupom Fiscal
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Demonstração fiel de como o cupom será impresso na impressora térmica (80mm / 58mm).
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] bg-background">
                      80mm Padrão
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 sm:p-8 flex flex-col items-center">
                  {/* Simulação do Papel Térmico */}
                  <div 
                    className="bg-white text-black p-6 border border-gray-300 font-mono text-[11px] leading-tight shadow-xl rounded-sm w-full max-w-[360px]"
                    style={{ fontFamily: "'Courier New', Courier, monospace" }}
                  >
                    {/* Topo do Cupom: Logomarca ou Nome Textual */}
                    <div className="text-center space-y-2 mb-4">
                      {getSettingValue("store_logo") ? (
                        <div className="flex justify-center items-center py-2">
                          <img 
                            src={getSettingValue("store_logo")} 
                            alt="Logomarca da loja" 
                            className="max-h-20 max-w-[200px] object-contain" 
                          />
                        </div>
                      ) : (
                        <h2 className="font-bold text-base uppercase tracking-[0.2em] py-2">
                          AMSTORE BAGSHOES
                        </h2>
                      )}

                      <div className="text-[10px] space-y-0.5 text-gray-800">
                        <p>{getSettingValue("store_address", "Rua Medeiros Neto, 12-A - Centro")}</p>
                        <p>{getSettingValue("store_city", "Jequié - BA")}</p>
                        <p>Telefone: {getSettingValue("store_phone", "73999269136")}</p>
                      </div>
                      
                      <div className="border-t border-black my-2" />
                      <h3 className="font-bold text-[11px] uppercase tracking-wider">CUPOM FISCAL</h3>
                      <div className="border-t border-black my-2" />
                    </div>

                    {/* Dados da Venda (Exemplo Real) */}
                    <div className="space-y-1 mb-3 text-[10px]">
                      <div className="flex justify-between">
                        <span className="w-20">Pedido:</span>
                        <span className="flex-1 text-right font-bold">#V080926141811GA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="w-20">Data:</span>
                        <span className="flex-1 text-right">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="w-20">Cliente:</span>
                        <span className="flex-1 text-right font-bold">GALEGA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="w-20">Vendedor:</span>
                        <span className="flex-1 text-right">AMSTORE</span>
                      </div>
                    </div>

                    <div className="border-t border-black my-2" />
                    <div className="text-center font-bold mb-2 text-[10px]">ITENS</div>
                    
                    {/* Itens de Exemplo */}
                    <div className="space-y-2 mb-3 text-[10px]">
                      <div className="space-y-0.5">
                        <div className="flex justify-between font-bold">
                          <span className="flex-1 truncate pr-2">1 x RASTEIRA METALIZADA (Nº 37)</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-700">
                          <span>(R$ 130,00)</span>
                          <span className="font-bold">R$ 130,00</span>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex justify-between font-bold">
                          <span className="flex-1 truncate pr-2">1 x BOLSA TRANSVERSAL COURO</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-700">
                          <span>(R$ 100,00)</span>
                          <span className="font-bold">R$ 100,00</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-black my-2" />
                    
                    {/* Totais */}
                    <div className="space-y-1 mb-3 text-[10px]">
                      <div className="flex justify-between font-bold">
                        <span>VALOR TOTAL:</span>
                        <span>R$ 230,00</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-700">
                        <span>Desconto:</span>
                        <span>- R$ 20,00</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs pt-1 border-t border-dotted border-gray-400">
                        <span>TOTAL LÍQUIDO:</span>
                        <span>R$ 210,00</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-600">
                        <span>Qtd Total:</span>
                        <span>2 itens</span>
                      </div>
                    </div>

                    <div className="border-t border-black my-2" />
                    <div className="text-center font-bold mb-1 text-[10px]">PAGAMENTO</div>
                    <div className="border-t border-black my-2" />

                    <div className="space-y-1 mb-3 text-[10px]">
                      <div className="flex justify-between font-bold">
                        <span>CARTÃO DE CRÉDITO:</span>
                        <span>R$ 210,00</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total Pago:</span>
                        <span>R$ 210,00</span>
                      </div>
                    </div>

                    <div className="border-t border-black my-2" />

                    {/* Destaque Cashback */}
                    <div className="text-center py-2 space-y-1">
                      <div className="bg-[#FFF9C4] border border-[#FBC02D] p-2 rounded text-center">
                        <div className="font-bold text-[9px] text-orange-800">CASHBACK DESTA VENDA</div>
                        <div className="text-xs font-black my-0.5">R$ 10,50</div>
                        <p className="text-[8px] font-bold text-orange-900">Saldo liberado e disponível!</p>
                      </div>
                    </div>

                    {/* Rodapé */}
                    <div className="mt-3 pt-2 border-t border-black text-center text-[9px] text-gray-700 space-y-0.5">
                      <p className="font-bold">{getSettingValue("store_website", "www.amstorebagshoes.com.br")}</p>
                      <p className="font-bold">{getSettingValue("store_instagram", "@amstorebagshoes")}</p>
                      
                      <div className="mt-4 pt-1">
                        <p className="font-semibold">Obrigado! Volte sempre!</p>
                        <p className="text-[8px] text-gray-500 mt-0.5">{new Date().toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t border-border/40 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    O cupom acima é exatamente o que será impresso pela impressora de 80mm.
                  </p>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="gap-2 font-bold text-xs"
                    onClick={() => window.print()}
                  >
                    <Printer className="size-3.5" /> Testar Impressão (80mm)
                  </Button>
                </CardFooter>
              </Card>

              {/* Dica para configuração no aplicativo RawBT */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Dica importante para corte automático e 80mm no aplicativo RawBT:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed pl-1">
                  <li>No aplicativo <strong>RawBT</strong> no seu celular, acesse <strong>Configurações &gt; Impressora</strong>.</li>
                  <li>Em <strong>Largura do Papel</strong>, certifique-se de selecionar <strong>80mm</strong> (e não 58mm).</li>
                  <li>Em <strong>Corte de Papel (Paper Cut)</strong>, ative a opção <strong>Corte ao Final do Trabalho</strong> para acionar a guilhotina automaticamente.</li>
                  <li>Ao imprimir pelo botão <strong>Imprimir 80mm (RawBT)</strong>, o sistema enviará a imagem gráfica em alta definição com sua logomarca no topo e o corte automático.</li>
                </ul>
              </div>
            </div>
          </div>
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-gold/30 text-gold">
                            {backupProgress.percent === 100 ? "Concluído" : "Processando"}
                          </Badge>
                          <h4 className="font-bold text-sm">{backupProgress.currentTable}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {backupProgress.percent === 100 
                            ? "Operação finalizada com sucesso." 
                            : "Aguarde enquanto os dados são processados..."}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-gold tabular-nums leading-none">{backupProgress.percent}%</span>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Progresso Total</p>
                    </div>
                  </div>
                  <div className="relative pt-1">
                    <Progress value={backupProgress.percent} className="h-3 bg-muted border border-border/40 overflow-hidden rounded-full shadow-inner" />
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-gold/10 transition-all duration-500 rounded-full" 
                      style={{ width: `${backupProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* PAINEL DE AUDITORIA E RELATÓRIO COMPLETO DA RESTAURAÇÃO */}
              <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-card via-card to-gold/5 p-6 sm:p-8 space-y-6 shadow-md">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 border-gold text-gold bg-gold/10">
                        Status do Banco
                      </Badge>
                      <h3 className="text-xl font-black flex items-center gap-2 text-foreground">
                        <Database className="size-5 text-gold" /> Relatório Completo da Restauração
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Contagem consolidada por área (Vendas, Transações, Estoque e Cashback) e pendências restantes.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAuditReport}
                      disabled={loadingAudit}
                      className="h-10 text-xs font-bold gap-2 border-border/70 shadow-sm"
                    >
                      <RefreshCw className={`size-3.5 ${loadingAudit ? "animate-spin text-gold" : ""}`} />
                      Atualizar Relatório
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleLinkStock}
                      disabled={linkingStock}
                      className="h-10 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      {linkingStock ? <Spinner className="size-3.5 animate-spin" /> : <Package className="size-3.5" />}
                      Ligar Itens & Preencher Estoque
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleReconcileTransactions}
                      disabled={reconciling}
                      className="h-10 text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                      {reconciling ? <Spinner className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                      Acertar Transações Órfãs
                    </Button>
                  </div>
                </div>

                {/* 4 Cards de Áreas */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                  {/* 1. Vendas */}
                  <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4 hover:border-gold/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-gold/10 text-gold border border-gold/20">
                          <ShoppingBag className="size-4" />
                        </div>
                        <h4 className="font-black text-sm text-foreground">Vendas</h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          auditReport?.sales?.status === "ok"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                            : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {auditReport?.sales?.status === "ok" ? "Integrado" : "Atenção"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Total de Vendas:</span>
                        <span className="font-bold text-sm text-foreground">{auditReport?.sales?.total ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Itens de Venda:</span>
                        <span className="font-bold text-foreground">{auditReport?.sales?.items ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Pagamentos / Parcelas:</span>
                        <span className="font-bold text-foreground">
                          {auditReport?.sales?.payments ?? 0} / {auditReport?.sales?.installments ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Vendas com Itens:</span>
                        <span className="font-bold text-emerald-600">{auditReport?.sales?.salesWithItems ?? 0}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                      <strong className="text-foreground block mb-0.5">O que falta:</strong>
                      {auditReport?.sales?.missing ?? "Carregando relatório..."}
                    </div>
                  </div>

                  {/* 2. Transações */}
                  <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4 hover:border-gold/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          <DollarSign className="size-4" />
                        </div>
                        <h4 className="font-black text-sm text-foreground">Transações</h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          auditReport?.transactions?.status === "ok"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                            : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {auditReport?.transactions?.status === "ok" ? "Conciliado" : "Pendências"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Total Transações:</span>
                        <span className="font-bold text-sm text-foreground">{auditReport?.transactions?.total ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Com Cliente:</span>
                        <span className="font-bold text-emerald-600">{auditReport?.transactions?.withClient ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Com Venda Vinculada:</span>
                        <span className="font-bold text-blue-600">{auditReport?.transactions?.withSale ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Órfãs (sem vínculo):</span>
                        <span
                          className={`font-bold ${
                            (auditReport?.transactions?.pureOrphans ?? 0) > 0 ? "text-destructive" : "text-emerald-600"
                          }`}
                        >
                          {auditReport?.transactions?.pureOrphans ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                      <strong className="text-foreground block mb-0.5">O que falta:</strong>
                      {auditReport?.transactions?.missing ?? "Carregando relatório..."}
                    </div>
                  </div>

                  {/* 3. Estoque */}
                  <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4 hover:border-gold/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <Package className="size-4" />
                        </div>
                        <h4 className="font-black text-sm text-foreground">Estoque</h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          auditReport?.stock?.status === "ok"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                            : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {auditReport?.stock?.status === "ok" ? "Preenchido" : "Ajustar"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Total de Produtos:</span>
                        <span className="font-bold text-sm text-foreground">{auditReport?.stock?.totalProducts ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Com Estoque Positivo:</span>
                        <span className="font-bold text-emerald-600">{auditReport?.stock?.productsWithStock ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Com Estoque Zerado:</span>
                        <span className="font-bold text-amber-600">{auditReport?.stock?.productsZeroStock ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Estoque Detalhado:</span>
                        <span className="font-bold text-foreground">{auditReport?.stock?.totalStockRecords ?? 0}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                      <strong className="text-foreground block mb-0.5">O que falta:</strong>
                      {auditReport?.stock?.missing ?? "Carregando relatório..."}
                    </div>
                  </div>

                  {/* 4. Cashback */}
                  <div className="p-5 rounded-2xl bg-card border border-border/70 shadow-sm space-y-4 hover:border-gold/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          <Gift className="size-4" />
                        </div>
                        <h4 className="font-black text-sm text-foreground">Cashback</h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          auditReport?.cashback?.status === "ok"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                            : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {auditReport?.cashback?.status === "ok" ? "Configurado" : "Pendente"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Regras Ativas:</span>
                        <span className="font-bold text-sm text-foreground">{auditReport?.cashback?.activeConfigs ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Clientes c/ Saldo:</span>
                        <span className="font-bold text-purple-600">{auditReport?.cashback?.clientsWithCashback ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-muted-foreground">Movimentações:</span>
                        <span className="font-bold text-foreground">{auditReport?.cashback?.totalEntries ?? 0}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                      <strong className="text-foreground block mb-0.5">O que falta:</strong>
                      {auditReport?.cashback?.missing ?? "Carregando relatório..."}
                    </div>
                  </div>
                </div>
              </div>

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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={handleExport} 
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-md transition-all flex gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Gerar Backup Sistema
                </Button>

                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json,.csv" 
                    onChange={handleImportFile}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <Button variant="outline" className="w-full h-12 font-bold border-2 flex gap-2 border-gold/40 text-gold hover:bg-gold/5">
                    <Upload className="size-4" />
                    Restaurar Backup Sistema
                  </Button>
                </div>

                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json,.csv" 
                    onChange={handleImportFile}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  <Button variant="outline" className="w-full h-12 font-bold border-2 flex gap-2 border-blue-400/40 text-blue-600 hover:bg-blue-50">
                    <Database className="size-4" />
                    Restaurar Backup Base44
                  </Button>
                </div>
              </div>

              {/* Import Selection Modal */}
              {importDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                  <Card className="w-full max-w-2xl max-h-[85vh] rounded-[2rem] border-gold/20 shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
                    <CardHeader className="bg-muted/50 border-b border-border/40 p-8 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20">
                          <FileJson className="size-6 text-gold" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-black">Restaurar Backup</CardTitle>
                          <CardDescription>
                            {importDialog.format === "externo"
                              ? "Arquivo externo (Base44) reconhecido. Selecione o que deseja restaurar."
                              : "Selecione quais módulos deseja restaurar do arquivo enviado."}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 overflow-y-auto flex-1">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-4">
                          <h3 className="font-bold text-lg">Módulos encontrados no arquivo</h3>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setImportDialog(prev => ({ ...prev, selected: Object.keys(prev.counts) }))}
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
                          {Object.keys(importDialog.counts)
                            .filter(tableId => tableId !== "__ignorado" && !tableId.startsWith("__") && tableId !== "ignorado")
                            .map((tableId) => {
                            const label = backupModules.flatMap(m => m.items).find(item => item.id === tableId)?.label || tableId;
                            const rowCount = importDialog.counts[tableId] || 0;
                            
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

                        {Object.keys(importDialog.skipped).length > 0 && (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="size-4 text-destructive" />
                              <h4 className="font-bold text-sm">Coleções não reconhecidas (não serão restauradas)</h4>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-[15vh] overflow-y-auto">
                              {Object.entries(importDialog.skipped).map(([name, count]) => (
                                <Badge key={name} variant="outline" className="text-[10px] border-destructive/30">
                                  {name} · {count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t border-border/40 p-8 flex justify-end gap-4 shrink-0">
                      <Button 
                        variant="ghost" 
                        onClick={() => closeImportDialog()}
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

              {/* Relatório Final da Restauração Modal */}
              {reportDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                  <Card className="w-full max-w-2xl max-h-[85vh] rounded-[2rem] border-gold/30 shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
                    <CardHeader className="bg-muted/50 border-b border-border/40 p-8 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20">
                          <CheckCircle className="size-6 text-gold" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-black">Relatório da Restauração</CardTitle>
                          <CardDescription>Resumo dos registros inseridos, atualizados e vinculados aos produtos e clientes.</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-8 overflow-y-auto flex-1 space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-center">
                          <span className="text-2xl font-black text-foreground">{reportDialog.inserted}</span>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Inseridos</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-center">
                          <span className="text-2xl font-black text-gold">{reportDialog.updated}</span>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Atualizados</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-center">
                          <span className="text-2xl font-black text-blue-500">{reportDialog.productsCreated}</span>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Produtos Criados</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-center">
                          <span className={`text-2xl font-black ${reportDialog.failed > 0 ? "text-destructive" : "text-emerald-500"}`}>{reportDialog.failed}</span>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Falhas</p>
                        </div>
                      </div>

                      {Object.keys(reportDialog.tableSummaries).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-bold text-sm text-foreground">Detalhamento por Coleção:</h4>
                          <div className="divide-y border rounded-2xl overflow-hidden bg-muted/10 max-h-[30vh] overflow-y-auto">
                            {Object.entries(reportDialog.tableSummaries).map(([table, counts]) => (
                              <div key={table} className="flex items-center justify-between p-3 px-4 text-xs">
                                <span className="font-semibold text-foreground">{table}</span>
                                <div className="flex gap-3 text-muted-foreground">
                                  <span className="text-emerald-600 font-medium">+{counts.inserted} novos</span>
                                  <span className="text-gold font-medium">~{counts.updated} atualizados</span>
                                  {counts.failed > 0 && <span className="text-destructive font-medium">!{counts.failed} erros</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {reportDialog.errors.length > 0 && (
                        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 space-y-2">
                          <h4 className="font-bold text-sm text-destructive flex items-center gap-2">
                            <AlertTriangle className="size-4" /> Alertas encontrados:
                          </h4>
                          <ul className="text-xs text-destructive space-y-1 list-disc list-inside">
                            {reportDialog.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t border-border/40 p-6 flex justify-end shrink-0">
                      <Button
                        onClick={() => {
                          setReportDialog((prev) => ({ ...prev, open: false }));
                          loadAuditReport();
                        }}
                        className="bg-gradient-gold shadow-gold font-bold px-8"
                      >
                        Fechar e Atualizar Painel
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

          <Card className="rounded-[2rem] border-destructive/40 shadow-sm overflow-hidden mt-6">
            <CardHeader className="bg-destructive/10 border-b border-destructive/30 p-8">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Zona de Risco
              </CardTitle>
              <CardDescription>
                Apague todos os dados do sistema e comece do zero. Usuários e configurações da loja são preservados.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                Serão apagados: vendas, fiados, pagamentos, transações, compras, estoque, produção, cortes,
                produtos, materiais, clientes, fornecedores, promoções, etiquetas e notificações. Faça um backup antes.
              </p>
              <Dialog open={resetDialogOpen} onOpenChange={(o) => { setResetDialogOpen(o); if (!o) setResetConfirm(""); }}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="font-bold">
                    <Trash2 className="size-4 mr-2" /> Zerar todos os dados
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="size-5" /> Zerar todos os dados
                    </DialogTitle>
                    <DialogDescription>
                      Esta ação é definitiva e não pode ser desfeita. Digite <strong>ZERAR</strong> para confirmar.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value.toUpperCase())}
                    placeholder="ZERAR"
                    className="h-12"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={resetConfirm !== "ZERAR" || resetting}
                      onClick={handleResetSystem}
                      className="font-bold"
                    >
                      {resetting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
                      Confirmar exclusão
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const nome = prompt("Nome de quem usa este acesso:", user.display_name || "");
                          if (nome === null || !nome.trim()) return;
                          try {
                            await updateName({ data: { userId: user.id, display_name: nome.trim() } });
                            toast.success("Nome atualizado");
                            loadData();
                          } catch (error: any) {
                            toast.error(error.message);
                          }
                        }}
                      >
                        Editar nome
                      </Button>
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