import {
  LayoutDashboard,
  Package,
  Store,
  ShoppingCart,
  Users,
  Megaphone,
  Wallet,
  FileBarChart2,
  Inbox,
  RefreshCcw,
  ShieldCheck,
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
import { useAuth } from "../context/AuthContext"
import { roleCan, ROLE_LABEL, type Capability, type AdminRole } from "../lib/rbac"

// 2026-06-02 — role-aware sidebar per RBAC doc.
// Each nav item carries a `requires` capability; SUPER_ADMIN (wildcard) always
// sees everything. Other roles see items they're permitted to act on.

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If omitted, item is visible to every admin-tier role. */
  requires?: Capability;
  /** True if the active route should match by `startsWith`. */
  startsWith?: boolean;
}

const PLATFORM_ITEMS: NavItem[] = [
  { to: "/",          label: "Dashboard",        icon: LayoutDashboard },
  { to: "/catalog",   label: "Master Catalog",   icon: Package,        requires: "catalog.issues.manage" },
  { to: "/merchants", label: "Merchant Network", icon: Store,          requires: "merchants.onboarding.review", startsWith: true },
  { to: "/orders",    label: "Orders",           icon: ShoppingCart,   requires: "orders.view" },
  { to: "/customers", label: "Customers",        icon: Users,          requires: "platform.assist" },
  { to: "/marketing", label: "Marketing",        icon: Megaphone,      requires: "coupons.create_edit_delete", startsWith: true },
];

const OPERATIONS_ITEMS: NavItem[] = [
  { to: "/refunds-disputes", label: "Refunds & Disputes", icon: RefreshCcw, requires: "disputes.standard.resolve" },
  { to: "/customer-support", label: "Customer Support",   icon: Inbox,      requires: "tickets.respond" },
];

const FINANCE_ITEMS: NavItem[] = [
  // Maps to existing FinanceHub (SettlementsManager + InvoiceRepository tabs)
  { to: "/finance",   label: "Settlements", icon: Wallet,         requires: "settlements.verify" },
  // Maps to existing AnalyticsHub (AnalyticsDashboard + AuditLog tabs)
  { to: "/analytics", label: "Reports",     icon: FileBarChart2,  requires: "reports.financial.generate" },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: "/roles", label: "Roles & Permissions", icon: ShieldCheck, requires: "roles.manage" },
];

function NavItemRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const isActive = item.startsWith ? pathname.startsWith(item.to) : pathname === item.to;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <NavLink to={item.to}>
          <Icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function visibleItems(items: NavItem[], role: string | undefined, isAdmin?: boolean | null): NavItem[] {
  return items.filter(i => !i.requires || roleCan(role, i.requires, isAdmin));
}

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = user?.isAdmin;

  const platform   = visibleItems(PLATFORM_ITEMS,   role, isAdmin);
  const operations = visibleItems(OPERATIONS_ITEMS, role, isAdmin);
  const finance    = visibleItems(FINANCE_ITEMS,    role, isAdmin);
  const admin      = visibleItems(ADMIN_ITEMS,      role, isAdmin);

  // Legacy isAdmin=true users without a typed role show as "Super Admin" for label purposes.
  const effectiveRole = (role && role in ROLE_LABEL) ? role : (isAdmin ? 'SUPER_ADMIN' : role);
  const roleLabel = effectiveRole && (effectiveRole in ROLE_LABEL)
    ? ROLE_LABEL[effectiveRole as AdminRole]
    : (role ?? "Unknown role");

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
        {platform.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {platform.map(item => <NavItemRow key={item.to} item={item} pathname={pathname} />)}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {operations.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarMenu>
              {operations.map(item => <NavItemRow key={item.to} item={item} pathname={pathname} />)}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {finance.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarMenu>
              {finance.map(item => <NavItemRow key={item.to} item={item} pathname={pathname} />)}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarMenu>
              {admin.map(item => <NavItemRow key={item.to} item={item} pathname={pathname} />)}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Logged in as
        </div>
        <div className="px-3 pb-3">
          {/* Role label on top, full width */}
          <div className="text-sm font-semibold text-foreground truncate">{roleLabel}</div>
          {/* Email below with the live-status green dot beside it */}
          {user?.email && (
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <div className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          )}
        </div>
      </SidebarFooter>

      <SidebarRail />
    </ShadcnSidebar>
  )
}
