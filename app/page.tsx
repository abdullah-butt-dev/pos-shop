"use client"

import {
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { NavHeader } from "@/components/pos/nav-header"

const sectionCards = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Sales reports, profit analytics and history",
    href: "/dashboard",
    color: "bg-[var(--pos-brand)]/15 text-[var(--pos-brand-text)]",
    borderColor: "border-[var(--pos-brand)]/30",
  },
  {
    icon: Truck,
    title: "Inventory / Purchases",
    description: "Record purchases and view current stock levels",
    href: "/purchases",
    color: "bg-[var(--pos-accent-blue)]/15 text-[var(--pos-accent-blue-text)]",
    borderColor: "border-[var(--pos-accent-blue)]/30",
  },
  {
    icon: Package,
    title: "Products & Suppliers",
    description: "Manage product catalog and supplier directory",
    href: "/inventory",
    color: "bg-[var(--pos-brand)]/15 text-[var(--pos-brand-text)]",
    borderColor: "border-[var(--pos-brand)]/30",
  },
  {
    icon: Wallet,
    title: "Payables",
    description: "Track and manage supplier payments",
    href: "/payables",
    color: "bg-[var(--pos-accent-pink)]/15 text-[var(--pos-accent-pink-text)]",
    borderColor: "border-[var(--pos-accent-pink)]/30",
  },
  {
    icon: Users,
    title: "Receivables",
    description: "Track and collect customer outstanding amounts",
    href: "/receivables",
    color: "bg-[var(--pos-accent-purple)]/15 text-[var(--pos-accent-purple-text)]",
    borderColor: "border-[var(--pos-accent-purple)]/30",
  },
  {
    icon: Settings,
    title: "Settings",
    description: "Shop info, theme and account settings",
    href: "/settings",
    color: "bg-foreground/5 text-muted-foreground",
    borderColor: "border-foreground/10",
  },
]

export default function HomePage() {
  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Shop Identity */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold">Perfect Traders</h2>
          </div>

          {/* New Sale — Primary Action */}
          <Link
            href="/orders"
            className="block w-full pos-panel rounded-2xl p-5 sm:p-6 hover:shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-[var(--pos-brand)] flex items-center justify-center shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8 text-[oklch(0.15_0_0)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold">New Sale</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Start a new POS transaction
                </p>
              </div>
            </div>
          </Link>

          {/* 6 Section Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sectionCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="pos-panel rounded-xl p-4 sm:p-5 hover:shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${card.color} ${card.borderColor}`}
                  >
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm sm:text-base">
                      {card.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
