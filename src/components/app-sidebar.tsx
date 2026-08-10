import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  BadgePercent,
  BookMarked,
  BookOpen,
  Boxes,
  Coins,
  Factory,
  FileBarChart,
  HandCoins,
  KanbanSquare,
  Landmark,
  LayoutDashboard,
  MessageCircle,
  Package,
  PieChart,
  QrCode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Item = { title: string; url: string; icon: any; hint?: string };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Menu principal",
    items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Materiais", url: "/materials", icon: Boxes },
      { title: "Produtos", url: "/products", icon: Package },
      { title: "Produção", url: "/production", icon: Factory },
      { title: "Estoque", url: "/stock", icon: Warehouse },
      { title: "Etiquetas", url: "/labels", icon: Tags },
      { title: "Relatórios", url: "/reports", icon: PieChart },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Auditoria", url: "/audit", icon: ShieldCheck },
      { title: "Métricas ao Vivo", url: "/live-metrics", icon: Activity },
      { title: "Documentação IA", url: "/ai-docs", icon: BookOpen },
    ],
  },
  {
    label: "Loja",
    items: [
      { title: "Painel de controle", url: "/store", icon: Store },
      { title: "Vendas", url: "/sales", icon: ShoppingCart },
      { title: "Clientes", url: "/clients", icon: Users },
      { title: "Fiado", url: "/credit", icon: HandCoins },
      { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
      { title: "Contas", url: "/accounts", icon: Landmark },
      { title: "Relatórios", url: "/reports", icon: PieChart },
      { title: "Catálogo", url: "/catalog", icon: BookMarked },
      { title: "Promoções", url: "/promotions", icon: BadgePercent },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Quadros", url: "/purchase-board", icon: KanbanSquare },
      { title: "Compras", url: "/purchases", icon: Truck },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Cobrança WhatsApp", url: "/whatsapp-billing", icon: MessageCircle, hint: "Envie lembretes e mensagens" },
      { title: "Promoção QR", url: "/qr-promo", icon: QrCode, hint: "Códigos QR promocionais" },
      { title: "Cashback", url: "/cashback", icon: Coins, hint: "Programa de fidelidade" },
      { title: "Configurações", url: "/settings", icon: Settings, hint: "Ajustes do sistema" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-1 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-sidebar-primary-foreground shadow-gold">
            <Store className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold tracking-tight text-sidebar-foreground">
                Amstore
              </p>
              <p className="truncate text-[10px] uppercase tracking-[0.2em] text-sidebar-primary">
                Bag&nbsp;Shoes
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="group/nav">
                          <item.icon
                            className={
                              active
                                ? "size-4 text-sidebar-primary"
                                : "size-4 text-sidebar-foreground/60 transition-colors group-hover/nav:text-sidebar-primary"
                            }
                          />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <p className="px-2 py-1 text-[10px] text-sidebar-foreground/40">
            Amstore Gestão · v2.0
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}