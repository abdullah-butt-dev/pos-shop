import re

file_path = "/home/abdullah/Downloads/pos-shop/pos-shop-main/app/receivables/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'import { Sidebar } from "@/components/pos/sidebar"',
    '''import { NavHeader } from "@/components/pos/nav-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"'''
)

# 2. Add state
content = content.replace(
    'const [submitting, setSubmitting] = useState(false)',
    '''const [submitting, setSubmitting] = useState(false)
  const [paymentToConfirm, setPaymentToConfirm] = useState<{sale: PosSaleWithRelations, amount: number} | null>(null)'''
)

# 3. Handle Record Payment
old_record = '''  async function handleRecordPayment(e: React.FormEvent<HTMLFormElement>, sale: PosSaleWithRelations) {
    e.preventDefault()
    if (!selectedCustomer) return

    const amount = Number(payAmount)
    if (!(amount > 0)) {
      toast.error("Enter a payment amount greater than 0")
      return
    }

    setSubmitting(true)
    try {
      await PosCustomerPaymentService.create({
        customer_id: selectedCustomer.id,
        sale_id: sale.id,
        amount,
        payment_date: payDate,
        payment_method: payMethod.trim() || undefined,
        notes: payNotes.trim() || undefined,
      })

      toast.success("Payment recorded")
      closePaymentForm()
      await loadSales()
      await loadPayments(selectedCustomer.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    } finally {
      setSubmitting(false)
    }
  }'''

new_record = '''  function handleRecordPayment(e: React.FormEvent<HTMLFormElement>, sale: PosSaleWithRelations) {
    e.preventDefault()
    if (!selectedCustomer) return

    const amount = Number(payAmount)
    if (!(amount > 0)) {
      toast.error("Enter a payment amount greater than 0")
      return
    }

    setPaymentToConfirm({ sale, amount })
  }

  async function confirmPayment() {
    if (!selectedCustomer || !paymentToConfirm) return

    setSubmitting(true)
    try {
      await PosCustomerPaymentService.create({
        customer_id: selectedCustomer.id,
        sale_id: paymentToConfirm.sale.id,
        amount: paymentToConfirm.amount,
        payment_date: payDate,
        payment_method: payMethod.trim() || undefined,
        notes: payNotes.trim() || undefined,
      })

      toast.success("Payment recorded")
      closePaymentForm()
      await loadSales()
      await loadPayments(selectedCustomer.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment")
    } finally {
      setSubmitting(false)
      setPaymentToConfirm(null)
    }
  }'''

content = content.replace(old_record, new_record)


# 4. Replace Layout Start
old_layout_start = '''  return (
    <main className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
        <div className="pos-panel flex-1 flex overflow-hidden">
          <div className="flex gap-3 flex-1 overflow-hidden">
            <Sidebar />
            <section className="flex-1 flex flex-col gap-4 overflow-y-auto p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold">Customer Receivables</h1>
                  <p className="text-sm text-muted-foreground">
                    Track what customers owe and record payments against their sales
                  </p>
                </div>
                <div className="pos-panel rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Total Outstanding
                    </p>
                    <p className="text-lg font-bold text-amber-500">{formatMoney(totalOutstanding)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_2fr] min-h-0 flex-1">
                {/* Customer list + create/select */}
                <div className="pos-panel rounded-lg p-4 flex flex-col gap-3 min-w-0">'''

new_layout_start = '''  const customersWithBalance = customerSummaries.filter(c => c.outstanding > 0).length

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          {/* Total Receivable Summary Card */}
          <div className="pos-panel rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-2 border border-[var(--pos-stroke)]">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Receivable</h2>
            <p className="text-4xl font-bold text-amber-500">{formatMoney(totalOutstanding)}</p>
            <p className="text-sm text-muted-foreground">
              From {customersWithBalance} customer{customersWithBalance === 1 ? "" : "s"} with outstanding balances
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-5">
            {/* Customer list + create/select */}
            <div className="pos-panel rounded-lg p-4 flex flex-col gap-3 w-full lg:w-80 shrink-0">'''

content = content.replace(old_layout_start, new_layout_start)

# 5. Detail panel class update
content = content.replace(
    '''                {/* Detail: sales + payment history for the selected customer */}
                <div className="flex flex-col gap-4 min-w-0 overflow-y-auto">''',
    '''                {/* Detail: sales + payment history for the selected customer */}
                <div className="flex flex-col gap-4 w-full lg:flex-1 min-w-0">'''
)

# 6. Replace Layout End
old_layout_end = '''                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>'''

new_layout_end = '''                </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!paymentToConfirm} onOpenChange={(open) => !open && setPaymentToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Record payment of Rs {paymentToConfirm?.amount} from {selectedCustomer?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayment} disabled={submitting}>
              {submitting ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>'''

content = content.replace(old_layout_end, new_layout_end)

# 7. Form class update
content = content.replace(
    '''className="bg-foreground/5 rounded-xl p-4 grid gap-3 sm:grid-cols-4 items-end"''',
    '''className="bg-foreground/5 rounded-xl p-4 grid gap-3 grid-cols-1 sm:grid-cols-4 items-end"'''
)

with open(file_path, "w") as f:
    f.write(content)

print("File updated successfully.")
