import { createFileRoute } from "@tanstack/react-router";
import { Settings, User, Bell, Database, Zap, Save } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Configurações" 
        description="Personalize e gerencie seu sistema."
        icon={Settings}
      />

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto bg-transparent border-b border-border p-0 rounded-none mb-6">
          <TabsTrigger value="geral" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
            <Settings className="size-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
            <Bell className="size-4" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
            <Database className="size-4" /> Backup
          </TabsTrigger>
          <TabsTrigger value="avancado" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
            <Zap className="size-4" /> Avançado
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-gold rounded-none">
            <User className="size-4" /> Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold">Dados da Loja</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Loja</Label>
                    <Input placeholder="Amstore" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail da Loja</Label>
                    <Input placeholder="contato@amstore.com" />
                  </div>
                </div>
              </div>
              <Button className="bg-gradient-gold shadow-gold font-bold">
                <Save className="size-4 mr-2" /> Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">Alerta de Estoque Mínimo</h3>
                  <p className="text-xs text-muted-foreground">Notificar quando materiais atingirem o mínimo</p>
                </div>
                <Switch />
              </div>
              <Button className="bg-gradient-gold shadow-gold font-bold">
                <Save className="size-4 mr-2" /> Salvar Preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8 space-y-6">
              <h3 className="text-lg font-bold">Backup do Sistema</h3>
              <p className="text-sm text-muted-foreground">O backup é 100% local no seu navegador.</p>
              <Button className="w-full bg-primary text-white py-6 rounded-xl font-bold">
                Gerar Backup Agora
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avancado">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label>Duração do Cache (minutos)</Label>
                <Input type="number" defaultValue={5} />
              </div>
              <Button className="bg-gradient-gold shadow-gold font-bold">
                <Save className="size-4 mr-2" /> Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8 space-y-6">
              <h3 className="text-lg font-bold">Usuários</h3>
              <p className="text-muted-foreground">Gerenciamento de usuários em desenvolvimento.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
