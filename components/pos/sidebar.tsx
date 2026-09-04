"use client";

import { useMemo } from "react";
import {
  LayoutDashboard,
  Menu,
  Settings,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Wallet,
  Users,
  CircleDollarSign,
} from "lucide-react"
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePrefetch } from "@/hooks/use-prefetch";

const NavItem = ({
  icon: Icon,
  label,
  href,
  active = false,
  onHover,
}: {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  onHover?: () => void;
}) => (
  <Link
    href={href}
    onMouseEnter={onHover}
    className={cn(
      "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200 ease-in-out min-h-[44px]",
      "active:scale-[0.98] active:bg-[var(--pos-panel)]",
      "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pos-brand)] focus-visible:outline-none focus-visible:ring-offset-background",
      active
        ? "bg-[var(--pos-brand)] text-[oklch(0.15_0_0)] shadow-md scale-[1.02]"
        : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground",
    )}
    aria-current={active ? "page" : undefined}
  >
    <Icon
      size={18}
      aria-hidden
      className={cn("transition-transform duration-200", active && "scale-110")}
    />
    <span className="text-pretty font-medium">{label}</span>
  </Link>
);

import { useAuth } from "@/context/auth-context";

// Single-user app (see business rules: one authenticated application user
// only, no roles). All pages are visible to the signed-in user — there is
// no per-role page restriction or account switching.
export function Sidebar() {
  const pathname = usePathname();
  const { prefetchRoute } = usePrefetch();
  const { user } = useAuth();

  // Navigation config items
  const navigationItems = useMemo(
    () => [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: ShoppingCart, label: "New Order", href: "/orders" },
      { icon: Package, label: "Inventory", href: "/inventory" },
      { icon: Truck, label: "Purchases", href: "/purchases" },
      { icon: Wallet, label: "Payables", href: "/payables" },
      { icon: Users, label: "Receivables", href: "/receivables" },
      { icon: Receipt, label: "Bill History", href: "/bill-history" },
      { icon: CircleDollarSign, label: "Financials", href: "/financials" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
    [],
  );

  return (
    <aside className="pos-panel w-64 shrink-0 p-4 flex flex-col gap-4">
      <header className="flex items-center gap-2 px-1">
        <Menu className="h-5 w-5" aria-hidden />
        <span className="font-semibold">SSG Store</span>
      </header>

      <nav className="grid gap-1">
        {navigationItems.map((item) => (
          <NavItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={pathname === item.href}
            onHover={() => prefetchRoute(item.href)}
          />
        ))}
      </nav>

      {/* Profile Section */}
      <div className="mt-auto pt-4 border-t border-[var(--pos-stroke)]">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-inner border bg-[var(--pos-brand)]/15 text-[var(--pos-brand-text)] border-[var(--pos-brand)]/30">
              {(user.user_metadata?.full_name || user.email)?.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-foreground/40">
            Offline Mode
          </div>
        )}
        <div className="text-[10px] text-muted-foreground text-center mt-3">
          Made by Divyansh Baghel
        </div>
      </div>
    </aside>
  );
}
