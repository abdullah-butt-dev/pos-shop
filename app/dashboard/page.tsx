"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Download,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

import { NavHeader } from "@/components/pos/nav-header"
import { generatePosReceiptPDF } from "@/lib/pos-receipt-pdf"

type DashboardData = {
  settings: {
    shop_name?: string
    currency?: string
    shop_address?: string
    shop_phone?: string
  }
  summary: {
    sales: number
    profit: number
    purchases: number
    customer_payments: number
    supplier_payments: number
    receivables: number
    payables: number
    stock_units: number
    low_stock_count: number
  }
  sales: any[]
  low_stock: any[]
}

function getLocalDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d.setDate(diff))
  const year = start.getFullYear()
  const month = String(start.getMonth() + 1).padStart(2, "0")
  const dd = String(start.getDate()).padStart(2, "0")
  return `${year}-${month}-${dd}`
}

function getMonthStart() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}-01`
}

function money(value: number, currency = "PKR") {
  return `${currency} ${Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "custom">("today")
  const [customFrom, setCustomFrom] = useState(getLocalDate())
  const [customTo, setCustomTo] = useState(getLocalDate())

  const [currentTime, setCurrentTime] = useState(new Date())

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError("")

      let from = getLocalDate()
      let to = getLocalDate()

      if (dateFilter === "week") {
        from = getWeekStart()
      } else if (dateFilter === "month") {
        from = getMonthStart()
      } else if (dateFilter === "custom") {
        from = customFrom
        to = customTo
      }

      const response = await fetch(`/api/pos/reports?from=${from}&to=${to}`)
      const json = await response.json()

      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to load dashboard")
      }

      setData(json)
    } catch (err) {
      console.error("Failed to load dashboard:", err)
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dateFilter !== "custom") {
      loadDashboard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [])

  const handleApplyFilter = () => {
    loadDashboard()
  }

  const currency = data?.settings?.currency || "PKR"
  const shopName = data?.settings?.shop_name || "Perfect Traders"

  const sales = data?.summary.sales || 0
  const profit = data?.summary.profit || 0
  const receivables = data?.summary.receivables || 0
  const payables = data?.summary.payables || 0
  const stockUnits = data?.summary.stock_units || 0
  const lowStock = data?.low_stock || []

  const recentSales = useMemo(() => {
    return (data?.sales || []).slice(0, 10)
  }, [data])

  const downloadReceipt = (sale: any) => {
    const items = sale.pos_sale_items || []
    
    generatePosReceiptPDF({
      shopName: data?.settings?.shop_name || "Perfect Traders",
      shopAddress: data?.settings?.shop_address,
      shopPhone: data?.settings?.shop_phone,
      receiptNumber: sale.receipt_number,
      dateTime: new Date(sale.created_at).toLocaleString("en-PK"),
      customerName: sale.pos_customers?.name || "Walk-in Customer",
      items: items.map((item: any) => ({
        name: item.pos_products?.name || "Product",
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      })),
      itemCount: items.length,
      unitCount: items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
      grandTotal: Number(sale.total_amount),
      paidAmount: Number(sale.amount_paid),
      remainingAmount: Number(sale.amount_due),
      paymentStatus: sale.payment_status,
      paymentMode: sale.payment_status ? sale.payment_status.charAt(0).toUpperCase() + sale.payment_status.slice(1) : "",
      currency: currency,
    })
  }

  const getDateLabel = () => {
    if (dateFilter === "today") return "Today"
    if (dateFilter === "week") return "This Week"
    if (dateFilter === "month") return "This Month"
    return `${customFrom} to ${customTo}`
  }

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
          <header className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {shopName}
              </p>
              <h1 className="text-2xl font-bold mt-1">
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time business performance and financial overview.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="pos-panel rounded-xl px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[var(--pos-brand)]" />
                  {currentTime.toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="text-muted-foreground/30">•</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--pos-brand)]" />
                  {currentTime.toLocaleTimeString("en-PK", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>

              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="pos-panel rounded-xl p-2.5 hover:bg-foreground/5 transition disabled:opacity-50"
                title="Refresh dashboard"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </header>

          {/* Date Filtering */}
          <section className="pos-panel rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDateFilter("today")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "today" ? "bg-[var(--pos-brand)] text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter("week")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "week" ? "bg-[var(--pos-brand)] text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                This Week
              </button>
              <button
                onClick={() => setDateFilter("month")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "month" ? "bg-[var(--pos-brand)] text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateFilter("custom")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "custom" ? "bg-[var(--pos-brand)] text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                Custom
              </button>
            </div>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/5 px-2 py-1.5 text-sm"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/5 px-2 py-1.5 text-sm"
                />
                <button
                  onClick={handleApplyFilter}
                  disabled={loading}
                  className="px-3 py-1.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Metrics */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold">Performance Overview</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Showing data for: <span className="font-medium text-foreground">{getDateLabel()}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={ShoppingCart}
                label="Sales"
                value={money(sales, currency)}
                description="Total sale revenue"
              />
              <StatCard
                icon={TrendingUp}
                label="Profit"
                value={money(profit, currency)}
                description="Revenue minus actual cost"
              />
              <StatCard
                icon={Package}
                label="Current Stock"
                value={stockUnits.toLocaleString("en-PK")}
                description="Total units currently in inventory"
                href="/inventory"
              />
              <StatCard
                icon={AlertTriangle}
                label="Low Stock"
                value={String(lowStock.length)}
                description="Products at or below threshold"
                href="/inventory"
                danger={lowStock.length > 0}
              />
            </div>
          </section>

          {/* Financials Summary */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <BalanceCard
              title="Total Customer Receivables"
              value={money(receivables, currency)}
              href="/receivables"
            />
            <BalanceCard
              title="Total Supplier Payables"
              value={money(payables, currency)}
              href="/payables"
            />
          </section>

          {/* Quick actions */}
          <section className="pos-panel rounded-xl p-4">
            <h2 className="font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              <QuickAction href="/orders" icon={ShoppingCart} label="New Sale" />
              <QuickAction href="/inventory" icon={Package} label="Inventory" />
              <QuickAction href="/receivables" icon={Users} label="Receivables" />
              <QuickAction href="/payables" icon={Wallet} label="Payables" />
            </div>
          </section>

          {/* Recent Sales */}
          <section className="pos-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--pos-stroke)] flex items-center justify-between">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[var(--pos-brand)]" />
                  Recent Sales
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Latest 10 sales for the selected period.
                </p>
              </div>
              <Link href="/bill-history" className="text-xs text-[var(--pos-brand)] hover:underline font-medium">
                View All Sales →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-[var(--pos-stroke)]">
                    <th className="p-3">Receipt</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale: any) => (
                    <tr key={sale.id} className="border-b border-[var(--pos-stroke)] last:border-0">
                      <td className="p-3 font-medium">{sale.receipt_number}</td>
                      <td className="p-3 whitespace-nowrap">{sale.sale_date}</td>
                      <td className="p-3">{sale.pos_customers?.name || "Walk-in Customer"}</td>
                      <td className="p-3 text-right font-medium">{money(Number(sale.total_amount), currency)}</td>
                      <td className="p-3 capitalize">{sale.payment_status}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => downloadReceipt(sale)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pos-stroke)] px-2.5 py-1.5 text-xs hover:bg-foreground/5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recentSales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No sales found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  href,
  danger = false,
}: {
  icon: any
  label: string
  value: string
  description: string
  href?: string
  danger?: boolean
}) {
  const content = (
    <div className={`pos-panel rounded-xl p-4 h-full transition ${href ? "hover:bg-foreground/5 cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${danger ? "text-amber-500" : "text-[var(--pos-brand)]"}`} />
          <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        </div>
        {href && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-bold tracking-tight mt-3">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  )
  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function BalanceCard({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href} className="pos-panel rounded-xl p-4 hover:bg-foreground/5 transition block">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-[var(--pos-brand)] mt-2">View details →</p>
    </Link>
  )
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/[0.02] px-3 py-3 flex items-center gap-2 text-sm font-medium hover:bg-foreground/5 transition"
    >
      <Icon className="w-4 h-4 text-[var(--pos-brand)]" />
      {label}
    </Link>
  )
}
