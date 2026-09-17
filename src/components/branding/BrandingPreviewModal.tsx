import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBranding } from "@/contexts/BrandingContext";
import {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Users,
  Smartphone,
  Globe,
  Sparkles,
  Menu,
  ChevronRight,
  Lock,
  Download,
  Share,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrandingPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandingPreviewModal({ open, onOpenChange }: BrandingPreviewModalProps) {
  const branding = useBranding();
  const [activePreview, setActivePreview] = useState<string>("sidebar-open");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-6 rounded-3xl border-border/60 bg-card/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="size-5 text-gold animate-pulse" /> Prévia ao Vivo da Aplicação
          </DialogTitle>
          <DialogDescription>
            Veja em tempo real como a identidade visual configurada é exibida nos diferentes contextos do sistema.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activePreview} onValueChange={setActivePreview} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/60 rounded-2xl mb-6">
            <TabsTrigger value="sidebar-open" className="rounded-xl py-2 text-xs font-semibold">
              Menu Aberto
            </TabsTrigger>
            <TabsTrigger value="sidebar-collapsed" className="rounded-xl py-2 text-xs font-semibold">
              Menu Recolhido
            </TabsTrigger>
            <TabsTrigger value="login" className="rounded-xl py-2 text-xs font-semibold">
              Tela de Login
            </TabsTrigger>
            <TabsTrigger value="splash" className="rounded-xl py-2 text-xs font-semibold">
              Splash Screen
            </TabsTrigger>
            <TabsTrigger value="favicon" className="rounded-xl py-2 text-xs font-semibold">
              Aba / Favicon
            </TabsTrigger>
            <TabsTrigger value="pwa" className="rounded-xl py-2 text-xs font-semibold">
              Instalação PWA
            </TabsTrigger>
          </TabsList>

          {/* 1. Menu Aberto */}
          <TabsContent value="sidebar-open" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-6">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Simulação: Menu Lateral Expandido
              </span>
              <div className="max-w-[280px] bg-sidebar border border-sidebar-border rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3 pb-4 border-b border-sidebar-border">
                  <div className="size-10 rounded-xl bg-sidebar-accent/50 p-1.5 flex items-center justify-center overflow-hidden shrink-0 border border-sidebar-border">
                    <img
                      src={branding.logoPrimary}
                      alt="Logo Principal"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm truncate text-sidebar-foreground">AmStore Gestão</span>
                    <span className="text-[11px] text-muted-foreground truncate">Produção & Vendas</span>
                  </div>
                </div>

                <div className="mt-4 space-y-1 text-xs">
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gold/15 text-gold font-semibold">
                    <LayoutDashboard className="size-4" />
                    <span>Painel Principal</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sidebar-foreground/70">
                    <ShoppingCart className="size-4" />
                    <span>Vendas</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sidebar-foreground/70">
                    <Warehouse className="size-4" />
                    <span>Estoque</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 2. Menu Recolhido */}
          <TabsContent value="sidebar-collapsed" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-6">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Simulação: Menu Lateral Recolhido
              </span>
              <div className="w-[72px] bg-sidebar border border-sidebar-border rounded-2xl p-3 shadow-xl flex flex-col items-center">
                <div className="size-11 rounded-xl bg-sidebar-accent/60 p-1.5 flex items-center justify-center overflow-hidden border border-sidebar-border mb-4">
                  <img
                    src={branding.logoCompact}
                    alt="Logo Compacta"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-3">
                  <div className="size-8 rounded-lg bg-gold/20 text-gold flex items-center justify-center">
                    <LayoutDashboard className="size-4" />
                  </div>
                  <div className="size-8 rounded-lg text-sidebar-foreground/60 flex items-center justify-center">
                    <ShoppingCart className="size-4" />
                  </div>
                  <div className="size-8 rounded-lg text-sidebar-foreground/60 flex items-center justify-center">
                    <Warehouse className="size-4" />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 3. Tela de Login */}
          <TabsContent value="login" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-[#0a0a0c] p-8 flex items-center justify-center">
              <div className="w-full max-w-[340px] rounded-2xl border border-neutral-800 bg-[#121214] p-6 shadow-2xl text-center">
                <div className="flex justify-center mb-5">
                  <img
                    src={branding.logoLogin}
                    alt="Logo Login"
                    className="max-h-16 max-w-[200px] object-contain drop-shadow"
                  />
                </div>
                <h4 className="text-sm font-semibold text-neutral-100 mb-1">Acesso ao Sistema</h4>
                <p className="text-xs text-neutral-400 mb-4">Digite suas credenciais</p>
                <div className="space-y-2.5 text-left">
                  <div className="h-8 rounded-lg bg-neutral-900 border border-neutral-800 px-3 flex items-center text-xs text-neutral-500">
                    amstorebagshoes@gmail.com
                  </div>
                  <div className="h-8 rounded-lg bg-neutral-900 border border-neutral-800 px-3 flex items-center text-xs text-neutral-500">
                    ••••••••••••
                  </div>
                  <div className="h-8 rounded-lg bg-gold text-black font-bold flex items-center justify-center text-xs">
                    Entrar
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 4. Splash Screen */}
          <TabsContent value="splash" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 flex flex-col items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Simulação: Splash de Inicialização
              </span>
              <div
                className="w-[280px] h-[480px] rounded-3xl shadow-2xl flex flex-col items-center justify-center p-6 text-center relative overflow-hidden border border-white/20 transition-all duration-300"
                style={{
                  backgroundColor: branding.splashBgColor,
                  background: `radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.28) 100%), ${branding.splashBgColor}`,
                }}
              >
                <img
                  src={branding.splash}
                  alt="Splash Logo"
                  className="max-h-28 max-w-[200px] object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.25)] animate-pulse"
                />
                <div className="mt-8 flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-2.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-2.5 rounded-full bg-white animate-bounce" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 5. Aba / Favicon */}
          <TabsContent value="favicon" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-6">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Simulação: Aba do Navegador Web
              </span>
              <div className="rounded-xl border border-border/80 bg-neutral-900 shadow-xl overflow-hidden max-w-xl">
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-950 border-b border-neutral-800">
                  <div className="flex gap-1.5">
                    <div className="size-3 rounded-full bg-red-500/80" />
                    <div className="size-3 rounded-full bg-amber-500/80" />
                    <div className="size-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-neutral-800 rounded-t-lg text-neutral-200 text-xs font-medium max-w-[260px] truncate border-t border-x border-neutral-700">
                    <img
                      src={branding.favicon}
                      alt="Favicon"
                      className="size-4 object-contain rounded shrink-0"
                    />
                    <span className="truncate">Amstore Gestão — Produção & Vendas</span>
                  </div>
                </div>
                <div className="p-4 text-xs text-neutral-400 bg-neutral-900">
                  URL: https://amstoresistema.lovable.app/dashboard
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 6. Instalação PWA */}
          <TabsContent value="pwa" className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-6 flex flex-col items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Simulação: Ícone no Celular & Card de Instalação PWA
              </span>
              <div className="w-full max-w-md space-y-6">
                {/* Ícone na Tela Inicial do Celular */}
                <div className="p-4 rounded-2xl border border-border bg-black/40 flex items-center gap-4">
                  <div
                    className="size-16 rounded-2xl p-2 flex items-center justify-center shadow-lg shrink-0 border border-white/20 transition-all duration-300"
                    style={{ backgroundColor: branding.pwaBgColor }}
                  >
                    <img
                      src={branding.pwaIcon}
                      alt="Ícone PWA"
                      className="size-full object-contain drop-shadow"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Amstore Bagshoes</h4>
                    <p className="text-xs text-muted-foreground">App Nativo na Tela de Início</p>
                  </div>
                </div>

                {/* Banner de Instalação */}
                <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-card p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-12 rounded-xl p-1.5 flex items-center justify-center shrink-0 border border-white/20 transition-all duration-300"
                      style={{ backgroundColor: branding.pwaBgColor }}
                    >
                      <img
                        src={branding.pwaIcon}
                        alt="App"
                        className="size-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black uppercase text-gold">App Oficial</span>
                      <h4 className="text-sm font-black text-foreground truncate">Amstore Bagshoes</h4>
                      <p className="text-xs text-muted-foreground">Instalar para acesso rápido</p>
                    </div>
                    <Button size="sm" className="bg-gold text-black font-bold hover:bg-gold/90 h-8 text-xs">
                      Instalar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
