"use client";

import React, { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { PosSaleService } from "@/lib/pos-service";
import { toast } from "sonner";

interface DeleteSalesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sales: any[];
  onSuccess: () => void;
}

export function DeleteSalesModal({
  open,
  onOpenChange,
  sales,
  onSuccess,
}: DeleteSalesModalProps) {
  const [deleting, setDeleting] = useState(false);

  const impactSummary = useMemo(() => {
    if (!sales.length) return null;

    const totalAmount = sales.reduce(
      (sum, s) => sum + (Number(s.total_amount) || 0),
      0,
    );
    const totalPaid = sales.reduce(
      (sum, s) => sum + (Number(s.amount_paid) || 0),
      0,
    );
    const paymentsCount = sales.filter((s) => Number(s.amount_paid) > 0).length;

    const stockMap = new Map<string, number>();
    for (const s of sales) {
      for (const item of s.pos_sale_items || []) {
        const name = item.pos_products?.name || "Product";
        const qty = Number(item.quantity) || 0;
        stockMap.set(name, (stockMap.get(name) || 0) + qty);
      }
    }

    return {
      count: sales.length,
      totalAmount,
      totalPaid,
      paymentsCount,
      restoredProducts: Array.from(stockMap.entries()).map(([name, qty]) => ({
        name,
        qty,
      })),
      receiptNumbers: sales.map((s) => s.receipt_number),
    };
  }, [sales]);

  const handleExecuteDelete = async () => {
    if (!sales.length) return;
    setDeleting(true);
    try {
      if (sales.length === 1) {
        await PosSaleService.delete(sales[0].id);
        toast.success(
          `Sale ${sales[0].receipt_number} deleted and stock restored`,
        );
      } else {
        const ids = sales.map((s) => s.id);
        await PosSaleService.deleteBulk(ids);
        toast.success(`${sales.length} sales deleted and stock restored`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Failed to delete sales:", err);
      toast.error(err?.message || "Failed to delete sales");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Delete {sales.length > 1 ? `${sales.length} Sales` : "Sale"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action deletes the sale record(s), customer payment records,
            and restores inventory back into stock.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {impactSummary && (
          <div className="space-y-3.5 py-1 text-xs">
            {/* Receipts Affected */}
            <div className="p-2.5 rounded-lg bg-foreground/5 border border-[var(--pos-stroke)] space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {impactSummary.count === 1
                  ? "Receipt"
                  : `Receipts (${impactSummary.count})`}
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
  );
}
