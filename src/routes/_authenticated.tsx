import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { HeaderBrand } from "@/components/header-brand";
import { Button } from "@/components/ui/button";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

function CollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      className="shrink-0 text-muted-foreground hover:text-gold"
    >
      {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
    </Button>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
    return { user: session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Vendedor");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (user) {
        setEmail(user.email ?? "");
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

  const initials = (email || "AM").slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
            <CollapseButton />
            <HeaderBrand />
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold leading-tight">{role}</p>
              <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">{email}</p>
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
