import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BookMarked,
  HandCoins,
  LogOut,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { clearActivity, touchActivity } from "@/lib/session-timeout";
import { clearRefreshTokenCookie, getRefreshTokenCookie, saveRefreshTokenCookie } from "@/lib/auth-cookie";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


import { useServerFn } from "@tanstack/react-start";
import { syncCurrentAdminProfile } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Tenta restaurar sessão pelo localStorage (getSession auto-renova o JWT expirado)
    let { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // localStorage pode ter sido limpo pelo navegador de desktop (modo privado, "limpar ao fechar").
      // Fallback: usar o refresh token salvo em cookie persistente para restaurar a sessão.
      const rt = getRefreshTokenCookie();
      if (rt) {
        try {
          const { data } = await supabase.auth.refreshSession({ refresh_token: rt });
          session = data.session;
          if (session?.refresh_token) {
            // Atualiza o cookie com o novo refresh token emitido
            saveRefreshTokenCookie(session.refresh_token);
          }
        } catch {}
      }
    }

    if (!session) {
      // Nenhuma forma de restaurar a sessão → redireciona sem signOut
      clearRefreshTokenCookie();
      throw redirect({ to: "/auth" });
    }

    touchActivity();
    return { user: session.user };
  },
  component: AuthenticatedLayout,
});


const quickNavItems = [
  { label: "Estoque", path: "/stock", icon: Warehouse },
  { label: "Vendas", path: "/sales", icon: ShoppingCart },
  { label: "Fiados", path: "/credit", icon: HandCoins },
  { label: "Transações", path: "/transactions", icon: ArrowLeftRight },
  { label: "Clientes", path: "/clients", icon: Users },
  { label: "Catálogo", path: "/catalog", icon: BookMarked },
];


function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<string>("Colaborador");
  const [email, setEmail] = useState<string>("");
  const syncProfile = useServerFn(syncCurrentAdminProfile);

  // Carrega perfil e cargo na inicialização da sessão e garante sincronização do papel de admin no banco
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (user) {
        setEmail(user.email ?? "");

        try {
          const syncRes = await syncProfile();
          if (syncRes?.displayName) {
            setName(syncRes.displayName);
          } else {
            const metaName = (user.user_metadata as any)?.display_name as string | undefined;
            setName((metaName || "").trim());
          }
          if (syncRes?.isAdmin) {
            setRole("Administrador");
          }
        } catch {
          const metaName = (user.user_metadata as any)?.display_name as string | undefined;
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle();
          setName((profile?.display_name || metaName || "").trim());
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          const userRole = (roles && roles.length > 0) ? (roles[0] as any).role : "user";
          const isAdmin = userRole === 'admin' || user.email === 'amstorebagshoes@gmail.com' || user.email === 'matosmonica000@gmail.com';
          const finalRole = isAdmin ? 'admin' : userRole;
          const roleMap: Record<string, string> = { admin: "Administrador", moderator: "Moderador", user: "Vendedor" };
          setRole(roleMap[finalRole] || "Vendedor");
        }
      }
    });
  }, []);

  // Proteção leve para rota /settings
  useEffect(() => {
    if (pathname === "/settings" && role !== "Administrador" && role !== "Colaborador") {
      toast.error("Você não tem permissão para acessar as configurações.");
      window.location.href = "/dashboard";
    }
  }, [pathname, role]);

  // Mantém a sessão ativa por 8h de inatividade
  useEffect(() => {
    touchActivity();
    const events: Array<keyof WindowEventMap> = ["click", "keydown", "pointerdown", "focus"];
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < 30_000) return;
      last = now;
      touchActivity();
    };
    events.forEach((e) => window.addEventListener(e, onActivity));

    // Atualiza o cookie de persistência sempre que houver um token válido
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.refresh_token) {
        touchActivity();
        saveRefreshTokenCookie(session.refresh_token);
      }
    });

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      subscription.unsubscribe();
    };
  }, []);


  const initials = (name || email || "AM").slice(0, 2).toUpperCase();


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar name={name} role={role} email={email} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-1 sm:gap-2 border-b border-border bg-card/80 px-1.5 sm:px-4 backdrop-blur-md">
            <SidebarTrigger className="shrink-0 text-foreground md:hidden size-8" aria-label="Abrir menu" />

            {/* Acesso rápido às funções do sistema — compactado para caber todos os 6 visíveis no celular */}
            <TooltipProvider delayDuration={150}>
              <div className="flex flex-1 md:flex-initial items-center justify-between sm:justify-start gap-0.5 sm:gap-1.5 py-1 min-w-0">
                {quickNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.path}
                          className={cn(
                            "flex flex-1 md:flex-initial flex-col md:flex-row items-center justify-center rounded-lg transition-all duration-150 min-w-0",
                            "h-12 px-0.5 py-1 gap-0.5 max-w-[54px] sm:max-w-[64px] md:max-w-none md:h-9 md:px-3 md:py-0 md:gap-1.5",
                            "text-xs font-medium",
                            isActive
                              ? "bg-gold/15 text-gold border border-gold/30 shadow-sm shadow-gold/10 font-semibold"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-transparent"
                          )}
                        >
                          <Icon className={cn("size-3.5 sm:size-4 shrink-0", isActive && "text-gold")} />
                          <span className="text-[9px] sm:text-[10px] font-medium leading-none truncate max-w-full text-center md:hidden tracking-tight">
                            {item.label}
                          </span>
                          <span className="hidden md:inline">{item.label}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>

            <div className="hidden md:block flex-1" />
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold leading-tight">{name || email}</p>
              <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">{name ? `${role} · ${email}` : role}</p>
            </div>
            <div className="hidden sm:flex size-9 items-center justify-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground shadow-gold">
              {initials}
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Sair"
              className="hidden sm:inline-flex"
              onClick={async () => {
                clearRefreshTokenCookie();
                clearActivity();
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </header>

          <main className="flex-1 overflow-x-hidden p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  );
}
