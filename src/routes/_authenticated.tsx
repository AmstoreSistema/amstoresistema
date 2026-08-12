import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { LogOut, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

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
        const userRole = roles && roles.length > 0 ? roles[0].role : "user";
        
        const roleMap: any = { admin: "Administrador", moderator: "Moderador", user: "Vendedor" };
        setRole(roleMap[userRole] || "Vendedor");
        
        if (pathname === "/settings" && userRole !== "admin") {
            window.location.href = "/dashboard";
          }
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
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
            <SidebarTrigger />
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="size-4" />
              <span className="text-xs font-bold uppercase tracking-widest text-gold/80">Amstore BAGSHOES</span>
            </div>
            <div className="flex-1" />
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
