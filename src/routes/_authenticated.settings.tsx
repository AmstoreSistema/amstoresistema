import { createFileRoute } from "@tanstack/react-router";
import { Settings, User, Bell, Database, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

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
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4">Configurações Gerais</h2>
              <p className="text-muted-foreground">Aba de configurações gerais em implementação.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="alertas">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4">Alertas</h2>
              <p className="text-muted-foreground">Configurações de alertas do sistema.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="backup">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4">Backup</h2>
              <p className="text-muted-foreground">Gerenciamento de backup de dados.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="avancado">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4">Avançado</h2>
              <p className="text-muted-foreground">Configurações avançadas e técnicas.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="usuarios">
          <Card className="rounded-[2rem] border-border/40 shadow-sm">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4">Usuários</h2>
              <p className="text-muted-foreground">Gerenciamento de acesso dos usuários.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
