"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";

import { NavHeader } from "@/components/pos/nav-header";
import { InfoTooltip } from "@/components/pos/info-tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DeleteSalesModal } from "@/components/pos/delete-sales-modal";
import {
  generatePosReceiptPDF,
  formatPakistanDateTime,
} from "@/lib/pos-receipt-pdf";
import {
  getPakistanDate,
  getPakistanYesterday,
  getPakistanWeekStart,
  getPakistanMonthStart,
} from "@/lib/pos-date-utils";

type DashboardData = {
  settings: {
    shop_name?: string;
    currency?: string;
    address?: string;
    phone?: string;
    receipt_footer_text?: string;
  };
  summary: {
    sales: number;
    profit: number;
    purchases: number;
    customer_payments: number;
    supplier_payments: number;
    receivables: number;
    payables: number;
    stock_units: number;
    total_products?: number;
  };
  sales: any[];
};

function money(value: number, currency = "PKR") {
  return `${currency} ${Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFilter, setDateFilter] = useState<
    "today" | "yesterday" | "week" | "month" | "custom"
  >("today");
  const [customFrom, setCustomFrom] = useState(getPakistanDate());
  const [customTo, setCustomTo] = useState(getPakistanDate());

  const [currentTime, setCurrentTime] = useState(new Date());

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      let from = getPakistanDate();
      let to = getPakistanDate();

      if (dateFilter === "yesterday") {
        from = getPakistanYesterday();
        to = getPakistanYesterday();
      } else if (dateFilter === "week") {
        from = getPakistanWeekStart();
        to = getPakistanDate();
      } else if (dateFilter === "month") {
        from = getPakistanMonthStart();
        to = getPakistanDate();
      } else if (dateFilter === "custom") {
        from = customFrom;
        to = customTo;
      }

      const response = await fetch(
        `/api/pos/reports?from=${from}&to=${to}&t=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        },
      );
      const json = await response.json();

      if (!response.ok || json.error) {
        throw new Error(json.error || "Failed to load dashboard");
      }

      setData(json);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleForceRefresh = async () => {
    if (typeof window !== "undefined") {
      if ("caches" in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        } catch (_) {}
      }
      if ("serviceWorker" in navigator) {
        try {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        } catch (_) {}
      }
    }
    await loadDashboard();
  };

  const selectFilter = (
    filter: "today" | "yesterday" | "week" | "month" | "custom",
  ) => {
    if (filter === dateFilter && filter !== "custom") {
      handleForceRefresh();
    } else {
      setDateFilter(filter);
    }
  };

  useEffect(() => {
    if (dateFilter !== "custom") {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    const onFocus = () => {
      if (dateFilter !== "custom") {
        loadDashboard();
      }
    };
    window.addEventListener("focus", onFocus);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && dateFilter !== "custom") {
        loadDashboard();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dateFilter]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const handleApplyFilter = () => {
    loadDashboard();
  };

  const currency = data?.settings?.currency || "PKR";
  const shopName = data?.settings?.shop_name || "Perfect Traders";

  const sales = data?.summary.sales || 0;
  const purchases = data?.summary.purchases || 0;
  const profit = data?.summary.profit || 0;

  const recentSales = useMemo(() => {
    return data?.sales || [];
  }, [data]);

  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [deleteTargetSales, setDeleteTargetSales] = useState<any[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const allSalesSelected =
    recentSales.length > 0 &&
    recentSales.every((s: any) => selectedSaleIds.includes(s.id));

  const toggleSelectAllSales = () => {
    if (allSalesSelected) {
      const visibleIds = new Set(recentSales.map((s: any) => s.id));
      setSelectedSaleIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const combined = new Set([
        ...selectedSaleIds,
        ...recentSales.map((s: any) => s.id),
      ]);
      setSelectedSaleIds(Array.from(combined));
    }
  };

  const toggleSelectSale = (id: string) => {
    setSelectedSaleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const downloadReceipt = (sale: any) => {
    const items = sale.pos_sale_items || [];

    generatePosReceiptPDF({
      shopName: data?.settings?.shop_name || "Perfect Traders",
      shopAddress: data?.settings?.address || "Suraj Miani Road, Multan",
      shopPhone: data?.settings?.phone || "03134640267",
      receiptFooterText: data?.settings?.receipt_footer_text,
      receiptNumber: sale.receipt_number,
      dateTime: formatPakistanDateTime(sale.created_at),
      customerName: sale.pos_customers?.name || "Walk-in Customer",
      items: items.map((item: any) => ({
        name: item.pos_products?.name || "Product",
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
      })),
      itemCount: items.length,
      unitCount: items.reduce(
        (sum: number, item: any) => sum + Number(item.quantity || 0),
        0,
      ),
      grandTotal: Number(sale.total_amount),
      paidAmount: Number(sale.amount_paid),
      remainingAmount: Number(sale.amount_due),
      paymentStatus: sale.payment_status,
      paymentMode: sale.payment_status
        ? sale.payment_status.charAt(0).toUpperCase() +
          sale.payment_status.slice(1)
        : "",
      currency: currency,
    });
  };

  const getDateLabel = () => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "yesterday") return "Yesterday";
    if (dateFilter === "week") return "This Week";
    if (dateFilter === "month") return "This Month";
    return `${customFrom} to ${customTo}`;
  };

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
              <h1 className="text-2xl font-bold mt-1">Dashboard</h1>
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
                onClick={handleForceRefresh}
                disabled={loading}
                className="pos-panel rounded-xl p-2.5 hover:bg-foreground/5 transition disabled:opacity-50"
                title="Refresh dashboard"
                aria-label="Refresh dashboard"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </header>

          {/* Date Filtering */}
          <section className="pos-panel rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => selectFilter("today")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "today" ? "bg-[var(--pos-brand)] text-primary-foreground font-semibold" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                Today
              </button>
              <button
                onClick={() => selectFilter("yesterday")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "yesterday" ? "bg-[var(--pos-brand)] text-primary-foreground font-semibold" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                Yesterday
              </button>
              <button
                onClick={() => selectFilter("week")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "week" ? "bg-[var(--pos-brand)] text-primary-foreground font-semibold" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                This Week
              </button>
              <button
                onClick={() => selectFilter("month")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "month" ? "bg-[var(--pos-brand)] text-primary-foreground font-semibold" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                This Month
              </button>
              <button
                onClick={() => selectFilter("custom")}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateFilter === "custom" ? "bg-[var(--pos-brand)] text-primary-foreground font-semibold" : "bg-foreground/5 hover:bg-foreground/10"}`}
              >
                Custom Range
              </button>
            </div>

            {dateFilter === "custom" && (
              <div className="flex items-center gap-3 flex-wrap pt-2 sm:pt-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">From:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/5 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--pos-brand)]"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium">To:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/5 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--pos-brand)]"
                  />
                </div>
                <button
                  onClick={handleApplyFilter}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-foreground text-background rounded-lg text-xs font-semibold hover:bg-foreground/90 transition disabled:opacity-50 active:scale-[0.98]"
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
                  Showing data for:{" "}
                  <span className="font-medium text-foreground">
                    {getDateLabel()}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                icon={ShoppingCart}
                label="Sales"
                value={money(sales, currency)}
                description="Recognized on sale date"
                tooltip="Total value of goods sold in this period."
              />
              <StatCard
                icon={Truck}
                label="Purchases"
                value={money(purchases, currency)}
                description="Cost of stock purchases"
                href="/purchases"
                tooltip="Total cost of inventory purchases recorded in this period."
              />
              <StatCard
                icon={TrendingUp}
                label="Profit"
                value={money(profit, currency)}
                description="Net profit from sales"
                tooltip="Total sales revenue minus the wholesale purchase cost of the items sold."
              />
            </div>
          </section>

          {/* Recent Sales (Collapsible, closed by default) */}
          <details className="group pos-panel rounded-xl overflow-hidden border border-[var(--pos-stroke)]">
            <summary className="p-4 flex items-center justify-between cursor-pointer list-none select-none hover:bg-foreground/[0.02] transition">
              <div>
                <h2 className="font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[var(--pos-brand)]" />
                  Recent Sales
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (Click to expand)
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Sales records with PDF receipt download.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/bill-history"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-[var(--pos-brand)] hover:underline font-medium"
                >
                  View All Sales →
                </Link>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </div>
            </summary>

            {selectedSaleIds.length > 0 && (
              <div className="flex items-center gap-2 p-2.5 mx-4 my-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs justify-between sm:justify-start animate-in fade-in duration-150">
                <span className="font-semibold text-red-600 dark:text-red-400 px-1">
                  {selectedSaleIds.length} selected
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSaleIds([])}
                  className="h-7 text-xs px-2"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setDeleteTargetSales(
                      recentSales.filter((s: any) =>
                        selectedSaleIds.includes(s.id),
                      ),
                    );
                    setIsDeleteModalOpen(true);
                  }}
                  className="h-7 text-xs px-3 bg-red-600 hover:bg-red-700 text-white font-semibold gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete ({selectedSaleIds.length})
                </Button>
              </div>
            )}

            <div className="border-t border-[var(--pos-stroke)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-[var(--pos-stroke)]">
                    <th className="p-3 w-10">
                      <Checkbox
                        checked={allSalesSelected}
                        onCheckedChange={toggleSelectAllSales}
                        aria-label="Select all recent sales"
                      />
                    </th>
                    <th className="p-3">Receipt</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale: any) => (
                    <tr
                      key={sale.id}
                      className="border-b border-[var(--pos-stroke)] last:border-0 hover:bg-foreground/[0.02]"
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedSaleIds.includes(sale.id)}
                          onCheckedChange={() => toggleSelectSale(sale.id)}
                          aria-label={`Select sale ${sale.receipt_number}`}
                        />
                      </td>
                      <td className="p-3 font-medium">{sale.receipt_number}</td>
                      <td className="p-3 whitespace-nowrap">
                        {sale.sale_date}
                      </td>
                      <td className="p-3">
                        {sale.pos_customers?.name || "Walk-in Customer"}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {money(Number(sale.total_amount), currency)}
                      </td>
                      <td className="p-3 capitalize">{sale.payment_status}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => downloadReceipt(sale)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pos-stroke)] px-2 py-1 text-xs hover:bg-foreground/5"
                            title="Download Receipt PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTargetSales([sale]);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                            title={`Delete sale ${sale.receipt_number}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {recentSales.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No sales found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      <DeleteSalesModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        sales={deleteTargetSales}
        onSuccess={async () => {
          setSelectedSaleIds((prev) =>
            prev.filter((id) => !deleteTargetSales.some((s) => s.id === id)),
          );
          setDeleteTargetSales([]);
          await handleForceRefresh();
        }}
      />
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  href,
  danger = false,
  tooltip,
}: {
  icon: any;
  label: string;
  value: string;
  description: string;
  href?: string;
  danger?: boolean;
  tooltip?: string;
}) {
  const content = (
    <div
      className={`pos-panel rounded-xl p-4 h-full transition ${href ? "hover:bg-foreground/5 cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Icon
            className={`w-5 h-5 ${danger ? "text-amber-500" : "text-[var(--pos-brand)]"}`}
          />
          <span className="text-xs font-semibold text-muted-foreground">
            {label}
          </span>
          {tooltip && <InfoTooltip text={tooltip} title={label} side="top" />}
        </div>
        {href && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <p className="text-2xl font-bold tracking-tight mt-3">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} prefetch={true}>
        {content}
      </Link>
    );
  }
  return content;
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: any;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/[0.02] px-3 py-3 flex items-center gap-2 text-sm font-medium hover:bg-foreground/5 transition"
    >
      <Icon className="w-4 h-4 text-[var(--pos-brand)]" />
      {label}
    </Link>
  );
}
