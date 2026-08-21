import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeftRight,
  BadgePercent,
  BookMarked,
  BookOpen,
  Boxes,
  ChevronRight,
  Coins,
  Factory,
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
import * as React from "react";
import { useRows } from "@/lib/data";
import logoAsset from "@/assets/store-logo.png.asset.json";
import { HeaderBrand } from "@/components/header-brand";

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SubItem = { title: string; url: string; icon?: any };
type Item = {
  title: string;
  url?: string;
  icon: any;
  items?: SubItem[];
  hint?: string;
};

const menuGroups: { label: string; items: Item[] }[] = [
  {
    label: "Menu principal",
    items: [
      { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
      { title: "Materiais", url: "/materials", icon: Boxes },
      { title: "Produtos", url: "/products", icon: Package },
      { title: "Produção", url: "/production", icon: Factory },
      { title: "Estoque", url: "/stock", icon: Warehouse },
      { title: "Relatórios", url: "/reports", icon: PieChart },
      { title: "Etiquetas", url: "/labels", icon: Tags },

    ],
  },
  {
    label: "Sistema",
    items: [
      {
        title: "Sistema",
        url: "#sistema",
        icon: ShieldCheck,
        items: [
          { title: "Auditoria", url: "/audit", icon: ShieldCheck },
          { title: "Métricas ao Vivo", url: "/live-metrics", icon: Activity },
          { title: "Documentação IA", url: "/ai-docs", icon: BookOpen },
        ],
      },
    ],
  },
  {
    label: "Loja",
    items: [
      {
        title: "Loja",
        url: "#loja",
        icon: Store,
        items: [
          { title: "Painel de controle", url: "/store", icon: Store },
          { title: "Vendas", url: "/sales", icon: ShoppingCart },
          { title: "Clientes", url: "/clients", icon: Users },
          { title: "Fiado", url: "/credit", icon: HandCoins },
          { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
          { title: "Contas", url: "/accounts", icon: Landmark },
          { title: "Catálogo", url: "/catalog", icon: BookMarked },
        ],
      },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Fornecedores", url: "/purchase-board", icon: KanbanSquare },
      { title: "Compras", url: "/purchases", icon: Truck },
    ],
  },
  {
    label: "Gestão",
    items: [
        {
          title: "Cobrança WhatsApp",
          url: "/whatsapp-billing",
          icon: MessageCircle,
          hint: "Envie lembretes e mensagens",
        },
          { title: "Cashback", url: "/cashback", icon: Coins },
          { title: "Promoções QR", url: "/promotions", icon: BadgePercent },
          {
            title: "Configurações",
            url: "/settings",
            icon: Settings,
          },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: settings = [] } = useRows<any>("app_settings");

  const storeLogo = React.useMemo(() => {
    const setting = settings.find((s: any) => s.key === "store_logo");
    if (!setting) return logoAsset.url;
    try {
      return JSON.parse(setting.value) || logoAsset.url;
    } catch {
      return setting.value || logoAsset.url;
    }
  }, [settings]);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border scrollbar-hide [&_[data-sidebar=sidebar]]:scrollbar-hide">
      <SidebarHeader className="border-b border-sidebar-border">
        {collapsed ? (
          <div className="flex items-center justify-center py-2">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gold/20 bg-gradient-gold shadow-gold">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="size-full object-cover" />
              ) : (
                <Store className="size-5" />
              )}
            </div>
          </div>
        ) : (
          <BrandBlock storeLogo={storeLogo} />
        )}
      </SidebarHeader>

      <SidebarContent className="scrollbar-hide gap-0 overflow-y-auto overflow-x-hidden">
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-2">
                {group.items.map((item) => {
                  const hasSubItems = item.items && item.items.length > 0;
                  const isCollapsibleHeader = hasSubItems && item.url?.startsWith('#');
                  
                  if (hasSubItems) {
                    const isAnyActive = item.items!.some(
                      (sub) => pathname === sub.url
                    );
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={isAnyActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title} className="w-full justify-between">
                              <div className="flex items-center gap-2">
                                <item.icon className="size-4 text-sidebar-foreground/60 transition-colors group-hover/nav:text-sidebar-primary" />
                                <span>{item.title}</span>
                              </div>
                              <ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-4 border-l border-sidebar-border/50 pl-2">
                              {item.items!.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === subItem.url}
                                  >
                                    <Link to={subItem.url}>
                                      {subItem.icon && (
                                        <subItem.icon className="size-3.5" />
                                      )}
                                      <span className="text-xs">{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  const active = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                      >
                        <Link to={item.url!} className="group/nav">
                          <item.icon
                            className={cn(
                              "size-4 transition-colors",
                              active
                                ? "text-sidebar-primary"
                                : "text-sidebar-foreground/60 group-hover/nav:text-sidebar-primary"
                            )}
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
