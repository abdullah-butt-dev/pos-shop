"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Home,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navItems = [
  { icon: ShoppingCart, label: "New Sale", href: "/orders" },
  { icon: Package, label: "Products & Suppliers", href: "/inventory" },
  { icon: Truck, label: "Inventory / Purchases", href: "/purchases" },
  { icon: Wallet, label: "Payables", href: "/payables" },
  { icon: Users, label: "Receivables", href: "/receivables" },
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

function getPageTitle(pathname: string): string {
  const match = navItems.find((item) => item.href === pathname)
  if (match) return match.label
  if (pathname === "/") return "Home"
  if (pathname === "/bill-history") return "Bill History"
  if (pathname === "/financials") return "Dashboard"
  if (pathname === "/login") return "Sign In"
  return "Perfect Traders"
}

export function NavHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const pageTitle = getPageTitle(pathname)
  const isHome = pathname === "/"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--pos-stroke)] bg-[var(--pos-panel)]">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        {/* Left: Back/Home + Title */}
        <div className="flex items-center gap-3 min-w-0">
          {!isHome && (
            <Link
              href="/"
              className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-foreground/5 transition shrink-0"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{pageTitle}</h1>
          </div>
        </div>

        {/* Right: Nav menu trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-foreground/5 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>

          <SheetContent side="right" className="w-72 p-0 bg-[var(--pos-panel)]">
            <SheetHeader className="px-4 pt-5 pb-3 border-b border-[var(--pos-stroke)]">
              <SheetTitle className="text-left text-base font-semibold">
                Perfect Traders
              </SheetTitle>
            </SheetHeader>

            <nav className="p-3 grid gap-1">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition min-h-[44px]",
                  pathname === "/"
                    ? "bg-[var(--pos-brand)] text-[oklch(0.15_0_0)] shadow-md"
                    : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"
                )}
              >
                <Home size={18} />
                Home
              </Link>

              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition min-h-[44px]",
                    pathname === item.href
                      ? "bg-[var(--pos-brand)] text-[oklch(0.15_0_0)] shadow-md"
                      : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground"
                  )}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
