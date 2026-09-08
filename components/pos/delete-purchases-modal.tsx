"use client";

import React, { useMemo, useState, useEffect } from "react";
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
import { PosPurchaseService } from "@/lib/pos-service";
import { toast } from "sonner";

interface DeletePurchasesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchases: any[];
  onSuccess: () => void;
}

export function DeletePurchasesModal({
  open,
  onOpenChange,
  purchases,
  onSuccess,
}: DeletePurchasesModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [blockingError, setBlockingError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBlockingError(null);
    }
  }, [open]);

  const impactSummary = useMemo(() => {
    if (!purchases.length) return null;

    let totalCost = 0;
    let totalPaid = 0;
    const stockMap = new Map<string, number>();

    for (const p of purchases) {
      totalPaid += Number(p.amount_paid) || 0;
      for (const item of p.pos_purchase_items || []) {
        const qty = Number(item.quantity) || 0;
        const unitCost = Number(item.unit_cost) || 0;
        totalCost += qty * unitCost;

        const name =
          item.pos_products?.name || item.product_name || "Product";
        stockMap.set(name, (stockMap.get(name) || 0) + qty);
      }
    }

    return {
      count: purchases.length,
      totalCost,
      totalPaid,
      deductedProducts: Array.from(stockMap.entries()).map(([name, qty]) => ({
        name,
        qty,
      })),
      purchasesList: purchases.map((p) => ({
        id: p.id,
        date: p.purchase_date,
        ref: p.reference_number,
        supplierName: p.pos_suppliers?.name || "Supplier",
      })),
    };
  }, [purchases]);

  const handleExecuteDelete = async () => {
    if (!purchases.length) return;
    setDeleting(true);
    setBlockingError(null);

    try {
      if (purchases.length === 1) {
        await PosPurchaseService.delete(purchases[0].id);
        toast.success("Purchase deleted and stock updated");
      } else {
        const ids = purchases.map((p) => p.id);
        await PosPurchaseService.deleteBulk(ids);
        toast.success(
          `${purchases.length} purchases deleted and stock updated`,
        );
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Failed to delete purchase(s):", err);
      const msg = err?.message || "Failed to delete purchase(s)";
      setBlockingError(msg);
      toast.error(msg);
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
            Delete {purchases.length > 1 ? `${purchases.length} Purchases` : "Purchase"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action deletes the purchase record(s), associated supplier payment
            records, and reverses (subtracts) the purchased stock from inventory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {blockingError && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Deletion Blocked by Existing Sales:
            </span>
            <p className="whitespace-pre-line text-[11px] leading-relaxed">
              {blockingError}
            </p>
          </div>
        )}

        {impactSummary && (
          <div className="space-y-3.5 py-1 text-xs">
            {/* Purchase targets */}
            <div className="p-2.5 rounded-lg bg-foreground/5 border border-[var(--pos-stroke)] space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {impactSummary.count === 1
                  ? "Purchase Record"
                  : `Selected Purchases (${impactSummary.count})`}
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {impactSummary.purchasesList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs py-0.5 text-foreground/90"
                  >
                    <span className="font-medium">
                      {p.supplierName} ({p.date})
                    </span>
                    {p.ref && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Ref: {p.ref}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial impact */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-foreground/5 border border-[var(--pos-stroke)]">
                <span className="text-muted-foreground block text-[11px]">
                  Total Purchase Value
                </span>
                <span className="text-sm font-bold text-foreground">
                  Rs.{" "}
                  {impactSummary.totalCost.toLocaleString("en-PK", {
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
              </div>
            </div>

            {/* Stock Deducted */}
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider text-[11px]">
                  Stock Being Deducted
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Reversed from inventory
                </span>
              </div>
              {impactSummary.deductedProducts.length > 0 ? (
                <div className="max-h-36 overflow-y-auto divide-y divide-red-500/10">
                  {impactSummary.deductedProducts.map((p) => (
                    <div
                      key={p.name}
                      className="flex justify-between py-1 text-xs"
                    >
                      <span className="font-medium truncate pr-2">
                        {p.name}
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400 shrink-0">
                        -{p.qty} units
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
                {impactSummary?.count === 1 ? "purchase" : "purchases"}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
