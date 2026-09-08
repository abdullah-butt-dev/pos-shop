"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { NavHeader } from "@/components/pos/nav-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PosSaleService } from "@/lib/pos-service";
import {
  generatePosReceiptPDF,
  formatPakistanDateTime,
} from "@/lib/pos-receipt-pdf";

export default function BillHistoryPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTargetSales, setDeleteTargetSales] = useState<any[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/pos/reports?from=2000-01-01&to=2999-12-31&t=${Date.now()}`,
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
        throw new Error(json.error || "Failed to load bill history");
      }

      setSales(json.sales || []);
      setSettings(json.settings || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load bill history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return sales;

    return sales.filter((sale) =>
      `${sale.receipt_number} ${
        sale.pos_customers?.name || ""
      } ${sale.payment_status}`
        .toLowerCase()
        .includes(q),
    );
  }, [sales, query]);

  const download = (sale: any) => {
    const items = sale.pos_sale_items || [];

    generatePosReceiptPDF({
      shopName: settings?.shop_name || "Perfect Traders",

      shopAddress: settings?.address || "Suraj Miani Road, Multan",

      shopPhone: settings?.phone || "03134640267",

      receiptFooterText: settings?.receipt_footer_text,

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
      currency: settings?.currency || "PKR",
    });
  };

  const allSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const filteredIdSet = new Set(filtered.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filtered.map((s) => s.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  const toggleSelectSale = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const impactSummary = useMemo(() => {
    if (!deleteTargetSales.length) return null;
    const totalAmount = deleteTargetSales.reduce(
      (sum, s) => sum + (Number(s.total_amount) || 0),
      0,
    );
    const totalPaid = deleteTargetSales.reduce(
      (sum, s) => sum + (Number(s.amount_paid) || 0),
      0,
    );
    const paymentsCount = deleteTargetSales.filter(
      (s) => Number(s.amount_paid) > 0,
    ).length;

    const stockMap = new Map<string, number>();
    for (const s of deleteTargetSales) {
      for (const item of s.pos_sale_items || []) {
        const name = item.pos_products?.name || "Product";
        const qty = Number(item.quantity) || 0;
        stockMap.set(name, (stockMap.get(name) || 0) + qty);
      }
    }

    return {
      count: deleteTargetSales.length,
      totalAmount,
      totalPaid,
      paymentsCount,
      restoredProducts: Array.from(stockMap.entries()).map(([name, qty]) => ({
        name,
        qty,
      })),
      receiptNumbers: deleteTargetSales.map((s) => s.receipt_number),
    };
  }, [deleteTargetSales]);

  const handleExecuteDelete = async () => {
    if (!deleteTargetSales.length) return;
    setDeleting(true);
    try {
      if (deleteTargetSales.length === 1) {
        await PosSaleService.delete(deleteTargetSales[0].id);
        toast.success(
          `Sale ${deleteTargetSales[0].receipt_number} deleted and stock restored`,
        );
      } else {
        const ids = deleteTargetSales.map((s) => s.id);
        await PosSaleService.deleteBulk(ids);
        toast.success(
          `${deleteTargetSales.length} sales deleted and stock restored`,
        );
      }
      setIsDeleteModalOpen(false);
      setSelectedIds((prev) =>
        prev.filter((id) => !deleteTargetSales.some((s) => s.id === id)),
      );
      setDeleteTargetSales([]);
      await load();
    } catch (err: any) {
      console.error("Failed to delete sales:", err);
      toast.error(err?.message || "Failed to delete sales");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
          <header className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-[var(--pos-brand)]" />
                Bill History
              </h1>

              <p className="text-sm text-muted-foreground mt-1">
                Sales, actual profit and downloadable receipts.
              </p>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--pos-stroke)] px-3 py-2 text-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </header>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bill number or customer"
                className="w-full rounded-lg border border-[var(--pos-stroke)] bg-foreground/5 pl-9 pr-3 py-2.5 text-sm"
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs w-full sm:w-auto justify-between sm:justify-start animate-in fade-in duration-150">
                <span className="font-semibold text-red-600 dark:text-red-400 px-1">
                  {selectedIds.length} selected
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  className="h-7 text-xs px-2"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setDeleteTargetSales(
                      sales.filter((s) => selectedIds.includes(s.id)),
                    );
                    setIsDeleteModalOpen(true);
                  }}
                  className="h-7 text-xs px-3 bg-red-600 hover:bg-red-700 text-white font-semibold gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete ({selectedIds.length})
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="pos-panel rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-[var(--pos-stroke)]">
                    <th className="p-3 w-10 text-center">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all sales"
                      />
                    </th>
                    <th className="p-3">Receipt</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Cost</th>
                    <th className="p-3 text-right">Profit</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Due</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((sale) => (
                    <tr
                      key={sale.id}
                      className={`border-b border-[var(--pos-stroke)] last:border-0 transition-colors ${
                        selectedIds.includes(sale.id)
                          ? "bg-red-500/[0.04]"
                          : "hover:bg-foreground/[0.02]"
                      }`}
                    >
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={selectedIds.includes(sale.id)}
                          onCheckedChange={() => toggleSelectSale(sale.id)}
                          aria-label={`Select receipt ${sale.receipt_number}`}
                        />
                      </td>

                      <td className="p-3 font-semibold">
                        {sale.receipt_number}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {sale.sale_date}
                      </td>

                      <td className="p-3">
                        {sale.pos_customers?.name || "Walk-in Customer"}
                      </td>

                      <td className="p-3 text-right">
                        {Number(sale.total_amount).toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="p-3 text-right">
                        {Number(sale.actual_cost).toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="p-3 text-right font-semibold text-emerald-500">
                        {Number(sale.profit).toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="p-3 text-right">
                        {Number(sale.amount_paid).toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="p-3 text-right">
                        {Number(sale.amount_due).toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      <td className="p-3 capitalize">{sale.payment_status}</td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => download(sale)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--pos-stroke)] px-2.5 py-1.5 text-xs hover:bg-foreground/5 font-medium transition"
                            title="Download Receipt PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTargetSales([sale]);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                            title="Delete sale and restore stock"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No sales found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregated Impact Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <AlertDialogTitle className="text-lg">
                Delete {impactSummary?.count}{" "}
                {impactSummary?.count === 1 ? "Sale" : "Sales"}?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This action permanently deletes the selected sale records, reverses
              any customer payments, and returns the items back to inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {impactSummary && (
            <div className="space-y-3.5 my-2 text-xs">
              {/* Receipt numbers */}
              <div className="p-3 rounded-xl bg-foreground/5 border border-[var(--pos-stroke)]">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 text-[11px]">
                  Receipts to Delete ({impactSummary.count})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {impactSummary.receiptNumbers.map((rn: string) => (
                    <span
                      key={rn}
                      className="px-2 py-0.5 rounded-md font-mono bg-foreground/10 text-foreground font-semibold text-[11px]"
                    >
                      {rn}
                    </span>
                  ))}
                </div>
              </div>

              {/* Financial impact */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-foreground/5 border border-[var(--pos-stroke)]">
                  <span className="text-muted-foreground block text-[11px]">
                    Total Sale Value
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    Rs.{" "}
                    {impactSummary.totalAmount.toLocaleString("en-PK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="text-red-600 dark:text-red-400 block text-[11px] font-medium">
                    Payments Removed
                  </span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    Rs.{" "}
                    {impactSummary.totalPaid.toLocaleString("en-PK", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    ({impactSummary.paymentsCount} recorded payments)
                  </span>
                </div>
              </div>

              {/* Stock Restored */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[11px]">
                    Stock Being Restored
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Added to inventory
                  </span>
                </div>
                {impactSummary.restoredProducts.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto divide-y divide-emerald-500/10">
                    {impactSummary.restoredProducts.map((p) => (
                      <div
                        key={p.name}
                        className="flex justify-between py-1 text-xs"
                      >
                        <span className="font-medium truncate pr-2">
                          {p.name}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                          +{p.qty} units
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No products recorded.
                  </p>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleExecuteDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Yes, delete {impactSummary?.count}{" "}
                  {impactSummary?.count === 1 ? "sale" : "sales"}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
