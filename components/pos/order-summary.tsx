"use client"

import {
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useCart } from "./cart-context"
import {
  PosCustomerService,
  PosSaleService,
} from "@/lib/pos-service"
import {
  AutocompleteField,
  type AutocompleteOption,
} from "@/components/purchases/autocomplete-field"

type PaymentMode = "paid" | "credit" | "partial"

export function OrderSummary({
  refetchData,
}: {
  refetchData?: () => void | Promise<void>
}) {
  const {
    items,
    subtotal,
    clear,
    inc,
    dec,
    remove,
    setQty,
    setPrice,
  } = useCart()

  const [customer, setCustomer] =
    useState<AutocompleteOption | null>(null)

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("paid")

  const [paidAmount, setPaidAmount] =
    useState("")

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (paymentMode === "paid") {
      setPaidAmount(subtotal > 0 ? subtotal.toFixed(2) : "")
      return
    }

    if (paymentMode === "credit") {
      setPaidAmount("0")
      return
    }

    const current = Number(paidAmount)

    if (
      !Number.isFinite(current) ||
      current <= 0 ||
      current >= subtotal
    ) {
      setPaidAmount("")
    }
  }, [subtotal, paymentMode])

  const numericPaidAmount = Number(paidAmount)
  const remaining =
    subtotal - (Number.isFinite(numericPaidAmount) ? numericPaidAmount : 0)

  const selectPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode)

    if (mode === "paid") {
      setPaidAmount(subtotal > 0 ? subtotal.toFixed(2) : "")
    } else if (mode === "credit") {
      setPaidAmount("0")
    } else {
      setPaidAmount("")
    }
  }

  const handlePaidAmountChange = (
    value: string,
  ) => {
    setPaidAmount(value)

    const amount = Number(value)

    if (!Number.isFinite(amount)) {
      return
    }

    if (amount === 0) {
      setPaymentMode("credit")
    } else if (amount >= subtotal) {
      setPaymentMode("paid")
    } else {
      setPaymentMode("partial")
    }
  }

  const handleSaveSale = async () => {
    if (items.length === 0) {
      toast.error("Please add at least one product")
      return
    }

    for (const item of items) {
      if (!Number.isFinite(item.qty) || item.qty <= 0) {
        toast.error(`Invalid quantity for ${item.name}`)
        return
      }

      if (!Number.isFinite(item.price) || item.price <= 0) {
        toast.error(`Enter a selling price for ${item.name}`)
        return
      }
    }

    const amount = Number(paidAmount)

    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Paid amount must be zero or greater")
      return
    }

    if (amount > subtotal + 0.009) {
      toast.error("Paid amount cannot be greater than the sale total")
      return
    }

    const normalizedAmount =
      Math.abs(amount - subtotal) <= 0.009
        ? subtotal
        : amount

    const isOutstanding =
      subtotal - normalizedAmount > 0.009

    if (isOutstanding && !customer) {
      toast.error(
        "Select a customer for credit or partial payment",
      )
      return
    }

    setSaving(true)

    try {
      await PosSaleService.create({
        customer_id: customer?.id ?? null,
        paid_amount: normalizedAmount,
        items: items.map((item) => ({
          product_id: item.id,
          quantity: item.qty,
          unit_price: item.price,
        })),
      })

      clear()
      setCustomer(null)
      setPaymentMode("paid")
      setPaidAmount("")

      await refetchData?.()

      setSuccess(true)
      toast.success("Sale saved successfully")

      window.setTimeout(
        () => setSuccess(false),
        1500,
      )
    } catch (error) {
      console.error("Failed to save sale:", error)

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save sale",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="pos-panel w-96 shrink-0 p-4 flex flex-col gap-4 h-full">
      <header className="flex items-center gap-2 shrink-0 pb-2 border-b border-[var(--pos-stroke)]">
        <ShoppingBag className="w-4 h-4 text-[var(--pos-brand-text)]" />
        <span className="text-sm font-semibold">
          New Sale
        </span>
      </header>

      <div className="shrink-0">
        <AutocompleteField
          id="pos-customer"
          label="Customer"
          placeholder="Search or create customer"
          value={customer}
          onChange={setCustomer}
          searchFn={PosCustomerService.search}
          createFn={PosCustomerService.create}
        />
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
          <div className="p-4 rounded-full bg-muted/50">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>

          <div>
            <p className="text-lg font-medium text-muted-foreground">
              Cart is empty
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              Add products to start a sale
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 min-h-0">
            <div className="grid gap-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="pos-panel rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="pos-panel h-6 w-6 shrink-0 rounded-full grid place-items-center text-xs font-medium">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item.name}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="text-muted-foreground hover:text-red-500 transition"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <label className="text-xs text-muted-foreground">
                      Selling price

                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">
                          Rs.
                        </span>

                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.price || ""}
                          onChange={(event) => {
                            const value = Number(
                              event.target.value,
                            )

                            setPrice(
                              item.id,
                              Number.isFinite(value)
                                ? value
                                : 0,
                            )
                          }}
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-lg pl-9 pr-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand"
                        />
                      </div>
                    </label>

                    <label className="text-xs text-muted-foreground">
                      Quantity

                      <div className="mt-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => dec(item.id)}
                          className="pos-panel rounded-lg w-9 h-9 flex items-center justify-center"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={(event) => {
                            const value = Number(
                              event.target.value,
                            )

                            if (Number.isFinite(value)) {
                              setQty(item.id, value)
                            }
                          }}
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-2 py-2 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand"
                        />

                        <button
                          type="button"
                          onClick={() => inc(item.id)}
                          className="pos-panel rounded-lg w-9 h-9 flex items-center justify-center"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--pos-stroke)]">
                    <span className="text-xs text-muted-foreground">
                      Line total
                    </span>

                    <span className="font-semibold">
                      Rs.
                      {(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 space-y-4">
            <div className="pos-panel rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  Grand Total
                </span>

                <span className="text-xl font-bold">
                  Rs.{subtotal.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Payment
                </label>

                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      selectPaymentMode("paid")
                    }
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                      paymentMode === "paid"
                        ? "bg-pos-brand text-black"
                        : "bg-foreground/5 hover:bg-foreground/10"
                    }`}
                  >
                    Paid
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectPaymentMode("partial")
                    }
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                      paymentMode === "partial"
                        ? "bg-pos-brand text-black"
                        : "bg-foreground/5 hover:bg-foreground/10"
                    }`}
                  >
                    Partial
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      selectPaymentMode("credit")
                    }
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                      paymentMode === "credit"
                        ? "bg-pos-brand text-black"
                        : "bg-foreground/5 hover:bg-foreground/10"
                    }`}
                  >
                    Credit
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="pos-paid-amount"
                  className="text-xs text-muted-foreground"
                >
                  Paid amount
                </label>

                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">
                    Rs.
                  </span>

                  <input
                    id="pos-paid-amount"
                    type="number"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(event) =>
                      handlePaidAmountChange(
                        event.target.value,
                      )
                    }
                    className="w-full bg-foreground/5 border border-foreground/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand"
                    aria-label="Paid amount"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Remaining
                </span>

                <span
                  className={
                    remaining > 0.009
                      ? "font-semibold text-amber-500"
                      : "font-semibold text-emerald-500"
                  }
                >
                  Rs.
                  {Math.max(remaining, 0).toFixed(2)}
                </span>
              </div>

              {remaining > 0.009 && !customer && (
                <p className="text-xs text-amber-500">
                  Select a customer to save a credit or
                  partial payment.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveSale}
              disabled={saving || success}
              className={`w-full rounded-full py-3 font-medium transition flex items-center justify-center gap-2 ${
                success
                  ? "bg-emerald-600 text-white"
                  : "bg-foreground text-background hover:opacity-90 disabled:opacity-50"
              }`}
            >
              {success ? (
                <>
                  <Check size={18} />
                  Sale Saved
                </>
              ) : (
                <>
                  <User size={18} />
                  {saving
                    ? "Saving..."
                    : "Complete Sale"}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}