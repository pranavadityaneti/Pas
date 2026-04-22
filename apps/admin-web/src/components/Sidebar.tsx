import {
  LayoutDashboard,
  Package,
  Store,
  ShoppingCart,
  Users,
  Megaphone,
  Bell,
  Wallet,
  BarChart3,
  Settings,
  TrendingUp,
  ChevronRight
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarRail,
} from "./ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Store className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">PickAtStore</span>
                  <span className="truncate text-xs">Admin Console</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Dashboard">
                <NavLink to="/">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/catalog"} tooltip="To Catalog">
                <NavLink to="/catalog">
                  <Package />
                  <span>Master Catalog</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith("/merchants")} tooltip="Merchants">
                <NavLink to="/merchants">
                  <Store />
                  <span>Merchant Network</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/orders"} tooltip="Orders">
                <NavLink to="/orders">
                  <ShoppingCart />
                  <span>Orders</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/customers"} tooltip="Customers">
                <NavLink to="/customers">
                  <Users />
                  <span>Customers</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>


      </SidebarContent>

      <SidebarRail />
    </ShadcnSidebar>
  )
}
