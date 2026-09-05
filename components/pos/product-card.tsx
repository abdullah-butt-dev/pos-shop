"use client";

import { useState } from "react";
import { useCart } from "./cart-context";
import { Minus, Plus, ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export type PurchaseHistoryEntry = {
  supplierName: string;
  supplierId?: string;
  unitCost: number;
  totalQuantity: number;
  dateBreakdown: string;
};

export function ProductCard({
  id,
  name,
  stock = 0,
  highlight,
  purchaseHistory = [],
}: {
  id: string;
  name: string;
  stock?: number;
  highlight?: "tile-pink" | "tile-blue" | "tile-purple";
  purchaseHistory?: PurchaseHistoryEntry[];
}) {
  const { items, inc, dec, add, setQty } = useCart();
  const [showHistory, setShowHistory] = useState(false);

  const item = items.find((i) => i.id === id);
  const qty = item?.qty ?? 0;

  const isOutOfStock = stock <= 0;
  const isStockLimitReached = qty >= stock;

  const handleCardClick = () => {
    if (isOutOfStock || isStockLimitReached) return;

    if (qty > 0) {
      inc(id);
    } else {
      add({
        id,
        name,
        price: 0,
      });
    }
  };

  const handleQuantityInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    e.stopPropagation();
    const valStr = e.target.value.trim();
    if (valStr === "") {
      setQty(id, 0);
      return;
    }

    const val = parseInt(valStr, 10);
    if (isNaN(val)) return;

    if (val <= 0) {
      setQty(id, 0);
    } else if (val > stock) {
      if (qty === 0) {
        add({ id, name, price: 0 });
      }
      setQty(id, stock);
      toast.warning(`Maximum available stock is ${stock}`);
    } else {
      if (qty === 0) {
        add({ id, name, price: 0 });
      }
      setQty(id, val);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group relative rounded-xl border border-[var(--pos-stroke)] bg-[var(--pos-panel)] p-3 sm:p-3.5 transition-all duration-200 cursor-pointer hover:border-foreground/20 hover:shadow-sm flex flex-col justify-between gap-2.5",
        highlight,
        isOutOfStock &&
          "opacity-60 saturate-50 border-red-500/20 dark:border-red-900/50 cursor-not-allowed",
      )}
    >
      {/* Top row: Name, stock status, dropdown button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug break-words">
              {name}
            </h3>

            {/* Expandable purchase history toggle */}
            <button
              type="button"
              aria-label={`View purchase history for ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowHistory((prev) => !prev);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="View purchase history"
            >
              <History className="w-3 h-3 text-[var(--pos-brand)]" />
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  showHistory && "rotate-180",
                )}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={cn(
                "text-xs font-medium",
                isOutOfStock ? "text-red-500" : "text-muted-foreground",
              )}
            >
              Stock: {stock}
            </span>

            {isOutOfStock && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 uppercase tracking-wider">
                Out of Stock
              </span>
            )}
          </div>
        </div>

        {/* Quantity Controls: - [input] + */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 shrink-0 self-center"
        >
          <button
            type="button"
            className="rounded-md w-8 h-8 flex items-center justify-center border border-[var(--pos-stroke)] bg-[var(--pos-panel-2)] hover:bg-muted/40 disabled:opacity-30 transition-opacity cursor-pointer text-foreground"
            aria-label={`Decrease ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (qty > 0) dec(id);
            }}
            disabled={qty === 0}
          >
            <Minus className="h-3 w-3" />
          </button>

          <input
            type="number"
            min="0"
            max={stock}
            value={qty > 0 ? qty : ""}
            placeholder="0"
            onChange={handleQuantityInputChange}
            disabled={isOutOfStock}
            aria-label={`Quantity for ${name}`}
            className="w-12 sm:w-14 h-8 text-center text-sm font-semibold rounded-md border border-[var(--pos-stroke)] bg-[var(--pos-panel-2)] text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--pos-brand)] disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          <button
            type="button"
            className="rounded-md w-8 h-8 flex items-center justify-center border border-[var(--pos-stroke)] bg-[var(--pos-panel-2)] hover:bg-muted/40 disabled:opacity-30 transition-opacity cursor-pointer text-foreground"
            aria-label={`Increase ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isStockLimitReached) return;
              if (qty > 0) {
                inc(id);
              } else {
                add({
                  id,
                  name,
                  price: 0,
                });
              }
            }}
            disabled={isOutOfStock || isStockLimitReached}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Collapsible Purchase Details Dropdown */}
      {showHistory && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1 pt-2.5 border-t border-[var(--pos-stroke)] text-xs space-y-2 cursor-default"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Purchase History</span>
            <span>Total Stock: {stock}</span>
          </div>

          {purchaseHistory && purchaseHistory.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {purchaseHistory.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-[var(--pos-panel-2)] border border-[var(--pos-stroke)] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href="/payables"
                      className="font-medium text-amber-600 dark:text-amber-400 hover:underline truncate"
                      title={`View payables for ${entry.supplierName}`}
                    >
                      {entry.supplierName}
                    </Link>
                    <span className="font-semibold text-foreground shrink-0">
                      Rs. {entry.unitCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Qty:{" "}
                      <strong className="text-foreground">
                        {entry.totalQuantity}
                      </strong>
                    </span>
                    <span className="text-[10px] text-muted-foreground/80">
                      {entry.dateBreakdown}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/75 py-1">
              No purchase records found for this product.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
