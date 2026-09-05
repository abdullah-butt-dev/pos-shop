"use client";

import type React from "react";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  PackageCheck,
  Plus,
  Trash2,
  Truck,
  ChevronDown,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NavHeader } from "@/components/pos/nav-header";
import {
  AutocompleteField,
  type AutocompleteOption,
} from "@/components/purchases/autocomplete-field";
import { InfoTooltip } from "@/components/pos/info-tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PosInventoryService,
  PosProductService,
  PosPurchaseService,
  PosSupplierService,
  type PosInventoryRow,
  type PosPurchaseWithRelations,
} from "@/lib/pos-service";
import { cn } from "@/lib/utils";

interface LineItem {
  key: string;
  product: AutocompleteOption | null;
  quantity: string;
  unitCost: string;
}

function emptyLineItem(): LineItem {
  return {
    key: crypto.randomUUID(),
    product: null,
    quantity: "",
    unitCost: "",
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `Rs. ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function PurchasesPage() {
  const [supplier, setSupplier] = useState<AutocompleteOption | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(todayISO);
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Paid");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("add");

  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    quantity: number;
    unit_cost: number;
  } | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [purchases, setPurchases] = useState<PosPurchaseWithRelations[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [inventory, setInventory] = useState<PosInventoryRow[]>([]);

  const loadPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    const data = await PosPurchaseService.list();
    setPurchases(data);
    setPurchasesLoading(false);
  }, []);

  const loadInventory = useCallback(async () => {
    const data = await PosInventoryService.list();
    setInventory(data);
  }, []);

  useEffect(() => {
    loadPurchases();
    loadInventory();
  }, [loadPurchases, loadInventory]);

  const total = useMemo(
    () =>
      lineItems.reduce((sum, li) => {
        const qty = Number(li.quantity) || 0;
        const cost = Number(li.unitCost) || 0;
        return sum + qty * cost;
      }, 0),
    [lineItems],
  );

  function updateLineItem(key: string, patch: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((li) => (li.key === key ? { ...li, ...patch } : li)),
    );
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeLineItem(key: string) {
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((li) => li.key !== key) : prev,
    );
  }

  function resetForm() {
    setSupplier(null);
    setPurchaseDate(todayISO());
    setLineItems([emptyLineItem()]);
    setAmountPaid("");
    setPaymentMethod("Paid");
  }

  // Auto-set amount paid based on payment mode
  function handlePaymentMethodChange(method: string) {
    setPaymentMethod(method);
    if (method === "Paid") {
      setAmountPaid("");
    } else if (method === "Credit") {
      setAmountPaid("0");
    } else if (method === "Partial") {
      setAmountPaid("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supplier) {
      toast.error("Select a supplier from the list, or add a new one");
      return;
    }

    const items = lineItems
      .filter((li) => li.product && Number(li.quantity) > 0)
      .map((li) => ({
        product_id: li.product!.id,
        quantity: Number(li.quantity),
        unit_cost: Number(li.unitCost) || 0,
      }));

    if (items.length === 0) {
      toast.error("Add at least one product with a quantity greater than 0");
      return;
    }

    const totalCost = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_cost,
      0,
    );
    const mode = paymentMethod || "Paid";
    let finalAmountPaid = 0;

    if (mode === "Paid") {
      finalAmountPaid = totalCost;
    } else if (mode === "Partial") {
      const parsed = Number(amountPaid);
      if (isNaN(parsed) || parsed <= 0) {
        toast.error("Enter a valid amount paid for partial payment");
        return;
      }
      if (parsed >= totalCost) {
        toast.error(
          "Partial amount cannot be equal to or greater than total. Select 'Paid' instead.",
        );
        return;
      }
      finalAmountPaid = parsed;
    } else {
      // Credit
      finalAmountPaid = 0;
    }

    setSubmitting(true);
    try {
      const result = await PosPurchaseService.create({
        supplier_id: supplier.id,
        purchase_date: purchaseDate,
        items,
        amount_paid: finalAmountPaid,
        payment_method: mode,
      });

      if (!result) {
        toast.error("Failed to save purchase. Please try again.");
        return;
      }

      toast.success("Purchase saved successfully");
      resetForm();
      setActiveTab("purchases");
      loadPurchases();
      loadInventory();
    } catch (err: any) {
      console.error("Save purchase error:", err);
      toast.error(err?.message || "Failed to save purchase. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEditItem() {
    if (!editingItem) return;
    const qty = Number(editQty);
    const cost = Number(editCost);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity greater than 0");
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Enter a valid unit cost (0 or greater)");
      return;
    }

    setEditLoading(true);
    try {
      await PosPurchaseService.updateItem(editingItem.id, {
        quantity: qty,
        unit_cost: cost,
      });
      toast.success("Purchase item updated successfully");
      setEditingItem(null);
      await loadPurchases();
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update purchase item");
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">Purchases</h1>
              <p className="text-sm text-muted-foreground">
                Record and manage stock purchases from suppliers
              </p>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="add" className="flex-1 sm:flex-none">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Purchase
              </TabsTrigger>
              <TabsTrigger value="purchases" className="flex-1 sm:flex-none">
                <Truck className="w-4 h-4 mr-1.5" />
                Recent Purchases
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              <div className="pos-panel rounded-lg p-4">
                {purchasesLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Loading...
                  </p>
                ) : purchases.length === 0 ? (
                  <div className="text-center py-8">
                    <Truck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      No purchases yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-[var(--pos-stroke)]">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Supplier</th>
                          <th className="py-2 pr-3">Items</th>
                          <th className="py-2 pr-3 text-right">Total</th>
                          <th className="py-2 pr-3 text-right">Paid</th>
                          <th className="py-2 pr-3 text-right">Due</th>
                          <th className="py-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-[var(--pos-stroke)]/50 align-top"
                          >
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {p.purchase_date}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {p.pos_suppliers?.name || "—"}
                            </td>
                            <td className="py-2 pr-3">
                              <ul className="space-y-0.5">
                                {p.pos_purchase_items.map((it) => (
                                  <li
                                    key={it.id}
                                    className="text-xs text-muted-foreground whitespace-nowrap flex items-center justify-between gap-2 py-0.5"
                                  >
                                    <span>
                                      {it.pos_products?.name || "—"} ×{" "}
                                      {it.quantity} @ Rs.{it.unit_cost}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItem({
                                          id: it.id,
                                          name:
                                            it.pos_products?.name || "Product",
                                          quantity: Number(it.quantity),
                                          unit_cost: Number(it.unit_cost),
                                        });
                                        setEditQty(String(it.quantity));
                                        setEditCost(String(it.unit_cost));
                                      }}
                                      className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition ml-1 shrink-0"
                                      title="Edit purchase quantity or price"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                              {formatMoney(Number(p.total_amount) || 0)}
                            </td>
                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                              {formatMoney(Number(p.amount_paid) || 0)}
                            </td>
                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                              {formatMoney(Number(p.amount_due) || 0)}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                                  p.payment_status === "paid" &&
                                    "bg-emerald-500/10 text-emerald-500",
                                  p.payment_status === "partial" &&
                                    "bg-amber-500/10 text-amber-500",
                                  p.payment_status === "unpaid" &&
                                    "bg-red-500/10 text-red-500",
                                )}
                              >
                                {p.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="add">
              <div className="pos-panel rounded-lg p-4">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AutocompleteField
                      id="supplier"
                      label="Supplier"
                      placeholder="Type supplier name"
                      value={supplier}
                      onChange={setSupplier}
                      searchFn={PosSupplierService.search}
                      createFn={PosSupplierService.create}
                    />
                    <div>
                      <label
                        htmlFor="purchase-date"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                      >
                        Purchase Date
                      </label>
                      <input
                        id="purchase-date"
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        required
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Products
                      </span>
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="text-xs font-semibold text-[var(--pos-brand-text)] flex items-center gap-1 hover:opacity-80"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add product
                      </button>
                    </div>

                    {lineItems.map((li, idx) => {
                      const qty = Number(li.quantity) || 0;
                      const cost = Number(li.unitCost) || 0;
                      return (
                        <div
                          key={li.key}
                          className="grid gap-3 sm:grid-cols-[1fr_100px_120px_110px_auto] items-end p-3 rounded-xl bg-foreground/[0.02] border border-[var(--pos-stroke)]"
                        >
                          <div className="flex flex-col gap-2">
                            <label
                              className={cn(
                                "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                                idx === 0 ? "block" : "block sm:hidden",
                              )}
                            >
                              Product
                            </label>
                            <AutocompleteField
                              placeholder="Type product name"
                              value={li.product}
                              onChange={(option) =>
                                updateLineItem(li.key, { product: option })
                              }
                              searchFn={PosProductService.search}
                              createFn={PosProductService.create}
                            />
                          </div>
                          <div>
                            <label
                              className={cn(
                                "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
                                idx === 0 ? "block" : "block sm:hidden",
                              )}
                            >
                              Qty
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={li.quantity}
                              onChange={(e) =>
                                updateLineItem(li.key, {
                                  quantity: e.target.value,
                                })
                              }
                              placeholder="0"
                              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                            />
                          </div>
                          <div>
                            <label
                              className={cn(
                                "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
                                idx === 0 ? "block" : "block sm:hidden",
                              )}
                            >
                              Cost/unit
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={li.unitCost}
                              onChange={(e) =>
                                updateLineItem(li.key, {
                                  unitCost: e.target.value,
                                })
                              }
                              placeholder="0.00"
                              className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                            />
                          </div>
                          <div>
                            <label
                              className={cn(
                                "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
                                idx === 0 ? "block" : "block sm:hidden",
                              )}
                            >
                              Item Total
                            </label>
                            <div className="px-3 py-2.5 text-sm font-semibold text-foreground/80 truncate">
                              {formatMoney(qty * cost)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(li.key)}
                            disabled={lineItems.length === 1}
                            className="p-2.5 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed w-full sm:w-auto flex justify-center mt-2 sm:mt-0"
                            title="Remove product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 items-end">
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Payment Mode
                        </label>
                        <InfoTooltip
                          title="Payment Mode"
                          text="Paid: You pay the supplier in full right now. Partial: You pay some now and the remaining balance is tracked in Payables. Credit: No upfront payment, full bill added to Payables."
                          side="top"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handlePaymentMethodChange("Paid")}
                          className={cn(
                            "flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors",
                            paymentMethod === "Paid"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10",
                          )}
                        >
                          Paid
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaymentMethodChange("Partial")}
                          className={cn(
                            "flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors",
                            paymentMethod === "Partial"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10",
                          )}
                        >
                          Partial
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaymentMethodChange("Credit")}
                          className={cn(
                            "flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl border transition-colors",
                            paymentMethod === "Credit"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                              : "bg-foreground/5 border-foreground/10 text-muted-foreground hover:bg-foreground/10",
                          )}
                        >
                          Credit
                        </button>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Purchase Total
                      </p>
                      <p className="text-xl font-bold">{formatMoney(total)}</p>
                    </div>
                  </div>

                  {/* Amount Paid — only for Partial */}
                  {paymentMethod === "Partial" && (
                    <div>
                      <label
                        htmlFor="amount-paid"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                      >
                        Amount Paid (Rs)
                      </label>
                      <input
                        id="amount-paid"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                      />
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-[var(--pos-stroke)] mt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-pos-brand text-black text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[var(--pos-brand)]/10 flex items-center justify-center gap-2"
                    >
                      {submitting && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      Save Purchase
                    </button>
                  </div>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--pos-panel)] border border-[var(--pos-stroke)] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Edit Purchase Item</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg hover:bg-foreground/10 text-muted-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Product:{" "}
              <span className="font-semibold text-foreground">
                {editingItem.name}
              </span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-brand"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Unit Cost (Rs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pos-brand"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--pos-stroke)]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                disabled={editLoading}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-foreground/5 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditItem}
                disabled={editLoading}
                className="px-4 py-2 text-xs font-bold bg-[var(--pos-brand)] text-black rounded-xl hover:opacity-90 transition flex items-center gap-1.5"
              >
                {editLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
