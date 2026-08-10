import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary italic">AmStore</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Gestão</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavItem to="/dashboard" icon="📊">Dashboard</NavItem>
          <div className="pt-4 pb-2 px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Menu Principal</div>
          <NavItem to="/materials" icon="📦">Materiais</NavItem>
          <NavItem to="/products" icon="🎨">Produtos</NavItem>
          <NavItem to="/production" icon="🏭">Produção</NavItem>
          <NavItem to="/stock" icon="📋">Estoque</NavItem>
          <NavItem to="/sales" icon="💰">Vendas</NavItem>
          <NavItem to="/clients" icon="👥">Clientes</NavItem>
          <NavItem to="/transactions" icon="📉">Transações</NavItem>
        </nav>
        <div className="p-4 border-t">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center space-x-2 p-2 rounded-md hover:bg-accent text-sm text-destructive"
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-10">
          <div className="flex-1">
            <h2 className="text-sm font-medium text-muted-foreground">Bem-vindo à AmStore Gestão</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              AM
            </div>
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: string; children: React.ReactNode }) {
  return (
    <a 
      href={to}
      className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent text-sm transition-colors"
    >
      <span className="text-lg">{icon}</span>
      <span>{children}</span>
    </a>
  );
}
