import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { clearActivity, isSessionExpired, touchActivity } from "@/lib/session-timeout";

import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() do Supabase JS v2 JÁ renova automaticamente o JWT expirado
    // usando o refresh token armazenado no localStorage.
    // NÃO chamar signOut() aqui: destruiria o refresh token e forçaria novo login toda vez.
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      // Sem sessão ou refresh falhou → apenas redireciona, sem signOut
      throw redirect({ to: "/auth" });
    }

    // Verifica inatividade (timer de 8h)
    // Só aqui chamamos signOut pois há uma sessão ativa que queremos encerrar por segurança
    if (isSessionExpired()) {
      clearActivity();
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    touchActivity();
    return { user: session.user };
  },
  component: AuthenticatedLayout,
});


function AuthenticatedLayout() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Vendedor");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (user) {
        setEmail(user.email ?? "");
        const metaName = (user.user_metadata as any)?.display_name as string | undefined;
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        setName((profile?.display_name || metaName || "").trim());
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const userRole = (roles && roles.length > 0) ? (roles[0] as any).role : "user";
        
        // Fix for admins if they are not detected as admin in the database yet
        const isAdmin = userRole === 'admin' || user.email === 'amstorebagshoes@gmail.com' || user.email === 'matosmonica000@gmail.com';
        const finalRole = isAdmin ? 'admin' : userRole;

        const roleMap: Record<string, string> = { admin: "Administrador", moderator: "Moderador", user: "Vendedor" };
        setRole(roleMap[finalRole] || "Vendedor");
        
        if (pathname === "/settings" && finalRole !== "admin") {
          toast.error("Você não tem permissão para acessar as configurações.");
          window.location.href = "/dashboard";
        }
      }
    });
  }, [pathname]);

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

    const interval = window.setInterval(async () => {
      if (isSessionExpired()) {
        clearActivity();
        await supabase.auth.signOut();
        window.location.href = "/auth";
      }
    }, 60_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(interval);
    };
  }, []);

  const initials = (name || email || "AM").slice(0, 2).toUpperCase();


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="shrink-0 text-foreground" aria-label="Abrir menu" />
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest text-gold/80">Amstore BAGSHOES</span>
            </div>
            <div className="flex-1" />
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold leading-tight">{name || email}</p>
              <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">{name ? `${role} · ${email}` : role}</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-gold text-xs font-bold text-primary-foreground shadow-gold">
              {initials}
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Sair"
              onClick={async () => {
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
