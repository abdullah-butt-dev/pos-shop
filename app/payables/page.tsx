"use client"

import type React from "react"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock, Loader2, Receipt, Wallet } from "lucide-react"
import { toast } from "sonner"
import { NavHeader } from "@/components/pos/nav-header"
import {
  PosPurchaseService,
  PosSupplierPaymentService,
  type PosPurchaseWithRelations,
  type PosSupplierPaymentWithPurchase,
} from "@/lib/pos-service"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SupplierSummary {
  id: string
  name: string
  totalPurchased: number
  totalPaid: number
  outstanding: number
  purchaseCount: number
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMoney(value: number) {
  return `Rs. ${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatDate(value: string) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

export default function PayablesPage() {
  const [purchases, setPurchases] = useState<PosPurchaseWithRelations[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(true)

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [payments, setPayments] = useState<PosSupplierPaymentWithPurchase[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  const [payingPurchaseId, setPayingPurchaseId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(todayISO)
  const [payMethod, setPayMethod] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  
  const [purchaseTab, setPurchaseTab] = useState<"outstanding" | "paid">("outstanding")

  const [pendingPayment, setPendingPayment] = useState<{
    purchase: PosPurchaseWithRelations
    amount: number
    date: string
    method: string
    notes: string
  } | null>(null)

  const loadPurchases = useCallback(async () => {
    setPurchasesLoading(true)
    const data = await PosPurchaseService.list()
    setPurchases(data)
    setPurchasesLoading(false)
  }, [])

  const loadPayments = useCallback(async (supplierId: string) => {
    setPaymentsLoading(true)
    const data = await PosSupplierPaymentService.listForSupplier(supplierId)
    setPayments(data)
    setPaymentsLoading(false)
  }, [])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  useEffect(() => {
    if (selectedSupplierId) loadPayments(selectedSupplierId)
    else setPayments([])
  }, [selectedSupplierId, loadPayments])

  const supplierSummaries = useMemo<SupplierSummary[]>(() => {
    const map = new Map<string, SupplierSummary>()
    for (const p of purchases) {
      const existing = map.get(p.supplier_id) || {
        id: p.supplier_id,
        name: p.pos_suppliers?.name || "Unknown supplier",
        totalPurchased: 0,
        totalPaid: 0,
        outstanding: 0,
        purchaseCount: 0,
      }
      existing.totalPurchased += Number(p.total_amount) || 0
      existing.totalPaid += Number(p.amount_paid) || 0
      existing.outstanding += Number(p.amount_due) || 0
      existing.purchaseCount += 1
      map.set(p.supplier_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding)
  }, [purchases])

  const totalOutstanding = useMemo(
    () => supplierSummaries.reduce((sum, s) => sum + s.outstanding, 0),
    [supplierSummaries],
  )
  
  const suppliersWithOutstanding = useMemo(
    () => supplierSummaries.filter(s => s.outstanding > 0.009).length,
    [supplierSummaries]
  )

  const selectedSupplier = supplierSummaries.find((s) => s.id === selectedSupplierId) || null

  const supplierPurchases = useMemo(
    () =>
      purchases
        .filter((p) => p.supplier_id === selectedSupplierId)
        .filter((p) => {
          const due = Number(p.amount_due) || 0
          if (purchaseTab === "outstanding") return due > 0.009
          return due <= 0.009
        })
        .sort((a, b) => (a.purchase_date < b.purchase_date ? 1 : -1)),
    [purchases, selectedSupplierId, purchaseTab],
  )

  function selectSupplier(id: string) {
    setSelectedSupplierId(id)
    setPayingPurchaseId(null)
    setPurchaseTab("outstanding")
  }

  function openPaymentForm(purchase: PosPurchaseWithRelations) {
    setPayingPurchaseId(purchase.id)
    setPayAmount(String(Number(purchase.amount_due) || ""))
    setPayDate(todayISO())
    setPayMethod("")
    setPayNotes("")
  }

  function closePaymentForm() {
    setPayingPurchaseId(null)
  }

  function handleRecordPayment(e: React.FormEvent<HTMLFormElement>, purchase: PosPurchaseWithRelations) {
    e.preventDefault()
    if (!selectedSupplierId) return

    const amount = Number(payAmount)
    if (!(amount > 0)) {
      toast.error("Enter a payment amount greater than 0")
      return
    }

    setPendingPayment({
      purchase,
      amount,
      date: payDate,
      method: payMethod,
      notes: payNotes,
    })
  }
  
  async function confirmPayment() {
    if (!pendingPayment || !selectedSupplierId) return
    
    setSubmitting(true)
    try {
      await PosSupplierPaymentService.create({
        supplier_id: selectedSupplierId,
        purchase_id: pendingPayment.purchase.id,
        amount: pendingPayment.amount,
        payment_date: pendingPayment.date,
        payment_method: pendingPayment.method.trim() || undefined,
        notes: pendingPayment.notes.trim() || undefined,
      })

      toast.success("Payment recorded")
      closePaymentForm()
      await loadPurchases()
      await loadPayments(selectedSupplierId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    } finally {
      setSubmitting(false)
      setPendingPayment(null)
    }
  }

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Supplier Payables</h1>
              <p className="text-sm text-muted-foreground">
                Track what&apos;s owed to each supplier and record payments against purchases
              </p>
            </div>
          </div>
          
          <div className="pos-panel rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 border border-[var(--pos-stroke)] bg-gradient-to-br from-background to-background/50">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Total Payable
            </h2>
            <p className="text-4xl sm:text-5xl font-extrabold text-amber-500">
              {formatMoney(totalOutstanding)}
            </p>
            <p className="text-sm text-muted-foreground mt-2 font-medium">
              Across {suppliersWithOutstanding} supplier{suppliersWithOutstanding === 1 ? "" : "s"} with outstanding balances
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-5">
            {/* Supplier list */}
            <div className="pos-panel rounded-xl p-4 flex flex-col gap-3 w-full lg:w-80 shrink-0 h-[400px] lg:h-[600px]">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Suppliers
              </h2>
              {purchasesLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : supplierSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchases recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 overflow-y-auto pr-2 pb-2">
                  {supplierSummaries.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => selectSupplier(s.id)}
                        className={cn(
                          "w-full text-left rounded-xl px-3 py-2.5 transition flex items-center justify-between gap-3",
                          s.id === selectedSupplierId
                            ? "bg-pos-brand text-black"
                            : "bg-foreground/5 hover:bg-foreground/10",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{s.name}</span>
                          <span
                            className={cn(
                              "block text-[11px]",
                              s.id === selectedSupplierId ? "text-black/70" : "text-muted-foreground",
                            )}
                          >
                            {s.purchaseCount} purchase{s.purchaseCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold whitespace-nowrap",
                            s.outstanding > 0.009
                              ? s.id === selectedSupplierId
                                ? "text-black"
                                : "text-amber-500"
                              : s.id === selectedSupplierId
                                ? "text-black/70"
                                : "text-emerald-500",
                          )}
                        >
                          {s.outstanding > 0.009 ? formatMoney(s.outstanding) : "Settled"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Detail: purchases + payment history for the selected supplier */}
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              {!selectedSupplier ? (
                <div className="pos-panel rounded-xl p-8 flex items-center justify-center text-sm text-muted-foreground h-[400px] lg:h-[600px]">
                  Select a supplier to view purchases and record payments
                </div>
              ) : (
                <>
                  <div className="pos-panel rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-[var(--pos-stroke)]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Total Purchased
                      </p>
                      <p className="text-lg font-bold">{formatMoney(selectedSupplier.totalPurchased)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Total Paid
                      </p>
                      <p className="text-lg font-bold text-emerald-500">
                        {formatMoney(selectedSupplier.totalPaid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Outstanding
                      </p>
                      <p
                        className={cn(
                          "text-lg font-bold",
                          selectedSupplier.outstanding > 0.009 ? "text-amber-500" : "text-emerald-500",
                        )}
                      >
                        {formatMoney(selectedSupplier.outstanding)}
                      </p>
                    </div>
                  </div>

                  <div className="pos-panel rounded-xl p-4 flex flex-col gap-4 border border-[var(--pos-stroke)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h2 className="text-sm font-bold">Purchases</h2>
                      <div className="flex bg-foreground/5 p-1 rounded-lg w-full sm:w-auto">
                        <button
                          className={cn(
                            "flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition",
                            purchaseTab === "outstanding" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setPurchaseTab("outstanding")}
                        >
                          Outstanding
                        </button>
                        <button
                          className={cn(
                            "flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition",
                            purchaseTab === "paid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setPurchaseTab("paid")}
                        >
                          Paid
                        </button>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-[var(--pos-stroke)]">
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Reference</th>
                            <th className="py-2 pr-3 text-right">Amount</th>
                            <th className="py-2 pr-3 text-right">Paid</th>
                            <th className="py-2 pr-3 text-right">Remaining</th>
                            <th className="py-2 pr-3 text-right">Status</th>
                            <th className="py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierPurchases.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-4 text-center text-muted-foreground text-sm">
                                No {purchaseTab} purchases found.
                              </td>
                            </tr>
                          ) : (
                            supplierPurchases.map((p) => {
                              const due = Number(p.amount_due) || 0
                              const isPaying = payingPurchaseId === p.id
                              return (
                                <Fragment key={p.id}>
                                  <tr className="border-b border-[var(--pos-stroke)]/50 align-top">
                                    <td className="py-3 pr-3 whitespace-nowrap">{formatDate(p.purchase_date)}</td>
                                    <td className="py-3 pr-3 whitespace-nowrap">{p.reference_number || "—"}</td>
                                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                                      {formatMoney(Number(p.total_amount) || 0)}
                                    </td>
                                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                                      {formatMoney(Number(p.amount_paid) || 0)}
                                    </td>
                                    <td className="py-3 pr-3 text-right whitespace-nowrap font-semibold">
                                      {formatMoney(due)}
                                    </td>
                                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                                      <span
                                        className={cn(
                                          "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                                          p.payment_status === "paid" && "bg-emerald-500/10 text-emerald-500",
                                          p.payment_status === "partial" && "bg-amber-500/10 text-amber-500",
                                          p.payment_status === "unpaid" && "bg-red-500/10 text-red-500",
                                        )}
                                      >
                                        {p.payment_status}
                                      </span>
                                    </td>
                                    <td className="py-3 text-right whitespace-nowrap">
                                      {due > 0.009 ? (
                                        <button
                                          type="button"
                                          onClick={() => (isPaying ? closePaymentForm() : openPaymentForm(p))}
                                          className="px-3 py-1.5 rounded-lg bg-pos-brand text-black text-xs font-bold transition active:scale-[0.98]"
                                        >
                                          {isPaying ? "Cancel" : "Record Payment"}
                                        </button>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-semibold justify-end w-full">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                  {isPaying && (
                                    <tr className="border-b border-[var(--pos-stroke)]/50">
                                      <td colSpan={7} className="py-3">
                                        <form
                                          onSubmit={(e) => handleRecordPayment(e, p)}
                                          className="bg-foreground/5 rounded-xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end"
                                        >
                                          <div>
                                            <label
                                              htmlFor={`amount-${p.id}`}
                                              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                                            >
                                              Amount (Rs)
                                            </label>
                                            <input
                                              id={`amount-${p.id}`}
                                              type="number"
                                              min="0.01"
                                              step="0.01"
                                              max={due}
                                              value={payAmount}
                                              onChange={(e) => setPayAmount(e.target.value)}
                                              className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                              Remaining: {formatMoney(due)}
                                            </p>
                                          </div>
                                          <div>
                                            <label
                                              htmlFor={`date-${p.id}`}
                                              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                                            >
                                              Payment Date
                                            </label>
                                            <input
                                              id={`date-${p.id}`}
                                              type="date"
                                              value={payDate}
                                              onChange={(e) => setPayDate(e.target.value)}
                                              className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                                            />
                                          </div>
                                          <div>
                                            <label
                                              htmlFor={`method-${p.id}`}
                                              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                                            >
                                              Method (optional)
                                            </label>
                                            <input
                                              id={`method-${p.id}`}
                                              type="text"
                                              value={payMethod}
                                              onChange={(e) => setPayMethod(e.target.value)}
                                              placeholder="e.g. Cash"
                                              className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                                            />
                                          </div>
                                          <div className="flex gap-2 w-full lg:col-span-1">
                                            <button
                                              type="submit"
                                              disabled={submitting}
                                              className="flex-1 px-3 py-2 rounded-xl bg-pos-brand text-black text-xs font-bold transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                            >
                                              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={closePaymentForm}
                                              className="px-3 py-2 rounded-xl bg-foreground/10 text-xs font-semibold transition active:scale-[0.98]"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                          <div className="sm:col-span-2 lg:col-span-4">
                                            <label
                                              htmlFor={`notes-${p.id}`}
                                              className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
                                            >
                                              Notes (optional)
                                            </label>
                                            <input
                                              id={`notes-${p.id}`}
                                              type="text"
                                              value={payNotes}
                                              onChange={(e) => setPayNotes(e.target.value)}
                                              placeholder="Reference, cheque #, etc."
                                              className="w-full bg-background border border-foreground/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand transition"
                                            />
                                          </div>
                                        </form>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pos-panel rounded-xl p-4 flex flex-col gap-3 border border-[var(--pos-stroke)]">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Payment History
                    </h2>
                    {paymentsLoading ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-[var(--pos-stroke)]">
                              <th className="py-2 pr-3">Payment Date</th>
                              <th className="py-2 pr-3">Against Purchase</th>
                              <th className="py-2 pr-3 text-right">Amount</th>
                              <th className="py-2 pr-3">Method</th>
                              <th className="py-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((pay) => (
                              <tr key={pay.id} className="border-b border-[var(--pos-stroke)]/50">
                                <td className="py-3 pr-3 whitespace-nowrap">{formatDate(pay.payment_date)}</td>
                                <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                                  {pay.pos_purchases
                                    ? `${pay.pos_purchases.reference_number || formatDate(pay.pos_purchases.purchase_date)}`
                                    : "—"}
                                </td>
                                <td className="py-3 pr-3 text-right whitespace-nowrap font-semibold">
                                  {formatMoney(Number(pay.amount) || 0)}
                                </td>
                                <td className="py-3 pr-3 whitespace-nowrap">{pay.payment_method || "—"}</td>
                                <td className="py-3 text-muted-foreground">{pay.notes || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <AlertDialog open={!!pendingPayment} onOpenChange={(open) => !open && setPendingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Record payment of Rs {pendingPayment?.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} to {selectedSupplier?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault()
                confirmPayment()
              }}
              disabled={submitting}
              className="bg-pos-brand text-black hover:bg-pos-brand/90"
            >
              {submitting ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}