"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NavHeader } from "@/components/pos/nav-header";
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
import {
  POS_EXPENSE_CATEGORIES,
  PosExpenseService,
} from "@/lib/pos-service";
import type { PosExpense } from "@/lib/supabase";
import { getPakistanDate } from "@/lib/pos-date-utils";

function formatMoney(value: number) {
  return `Rs. ${(Number(value) || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const inputClass =
  "w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pos-brand";

export default function ExpensesPage() {
  const [month, setMonth] = useState(() => getPakistanDate().slice(0, 7));
  const [expenses, setExpenses] = useState<PosExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => getPakistanDate());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PosExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { from, to } = monthRange(month);
      const data = await PosExpenseService.list(from, to);
      setExpenses(data);
    } catch (err) {
      setExpenses([]);
      setError(
        err instanceof Error ? err.message : "Failed to load expenses",
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, { label: string; total: number; count: number }>();

    for (const e of expenses) {
      const key = e.category.trim().toLowerCase();
      const existing = map.get(key) || {
        label: e.category.trim(),
        total: 0,
        count: 0,
      };
      existing.total += Number(e.amount || 0);
      existing.count += 1;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const resetForm = () => {
    setEditingId(null);
    setCategory("");
    setAmount("");
    setNotes("");
    setExpenseDate(getPakistanDate());
  };

  const startEdit = (expense: PosExpense) => {
    setEditingId(expense.id);
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setExpenseDate(expense.expense_date);
    setNotes(expense.notes || "");
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    const trimmedCategory = category.trim();
    const numericAmount = Number(amount);

    if (!trimmedCategory) {
      toast.error("Choose or type an expense category");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      toast.error("Choose the expense date");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        category: trimmedCategory,
        amount: numericAmount,
        expense_date: expenseDate,
        notes: notes.trim() || null,
      };

      if (editingId) {
        await PosExpenseService.update(editingId, payload);
        toast.success("Expense updated");
      } else {
        await PosExpenseService.create(payload);
        toast.success("Expense saved");
      }

      const savedMonth = expenseDate.slice(0, 7);
      resetForm();

      if (savedMonth !== month) {
        // Jump to the month of the saved expense so it is visible immediately
        setMonth(savedMonth);
      } else {
        await loadExpenses();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save expense",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    try {
      await PosExpenseService.delete(deleteTarget.id);
      toast.success("Expense deleted");

      if (editingId === deleteTarget.id) resetForm();

      setDeleteTarget(null);
      await loadExpenses();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete expense",
      );
    } finally {
      setDeleting(false);
    }
  };

  const isCurrentMonth = month === getPakistanDate().slice(0, 7);

  return (
    <main className="h-full w-full flex flex-col overflow-hidden bg-[var(--pos-panel-2)] text-foreground">
      <NavHeader />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          <header>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Perfect Traders
            </p>
            <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-[var(--pos-brand)]" />
              Expenses
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Record business expenses like rent and meals. Totals feed the
              Net Profit on the dashboard.
            </p>
          </header>

          {/* Month switcher */}
          <section className="pos-panel rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="rounded-lg bg-foreground/5 hover:bg-foreground/10 p-2 transition"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="min-w-[10rem] text-center font-semibold">
                {monthLabel(month)}
              </div>

              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="rounded-lg bg-foreground/5 hover:bg-foreground/10 p-2 transition"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="rounded-lg border border-[var(--pos-stroke)] bg-foreground/5 px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--pos-brand)]"
                aria-label="Pick month"
              />

              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => setMonth(getPakistanDate().slice(0, 7))}
                  className="px-3 py-1.5 text-sm rounded-lg bg-foreground/5 hover:bg-foreground/10 transition"
                >
                  This month
                </button>
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          {/* Summary */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="pos-panel rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Total — {monthLabel(month)}
              </p>
              <p className="text-2xl font-bold tracking-tight mt-2">
                {formatMoney(total)}
              </p>
            </div>

            <div className="pos-panel rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Entries
              </p>
              <p className="text-2xl font-bold tracking-tight mt-2">
                {expenses.length}
              </p>
            </div>

            <div className="pos-panel rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Biggest category
              </p>
              <p className="text-2xl font-bold tracking-tight mt-2 truncate">
                {byCategory[0]?.label || "—"}
              </p>
              {byCategory[0] && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMoney(byCategory[0].total)}
                </p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Add / edit form */}
            <section className="pos-panel rounded-xl p-4 space-y-4 lg:col-span-2 self-start">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {editingId ? "Edit Expense" : "Add Expense"}
                </h2>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel edit
                  </button>
                )}
              </div>

              <div>
                <label
                  htmlFor="expense-category"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Category
                </label>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POS_EXPENSE_CATEGORIES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCategory(preset)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                        category.trim().toLowerCase() === preset.toLowerCase()
                          ? "bg-[var(--pos-brand)] text-black border-transparent"
                          : "bg-foreground/5 border-transparent text-muted-foreground hover:bg-foreground/10"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <input
                  id="expense-category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={60}
                  placeholder="Or type a custom category"
                  className={`${inputClass} mt-2`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="expense-amount"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Amount
                  </label>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs">
                      Rs.
                    </span>
                    <input
                      id="expense-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`${inputClass} pl-9 font-semibold`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="expense-date"
                    className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    Date
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="expense-notes"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Notes (optional)
                </label>
                <input
                  id="expense-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Shop rent for October"
                  className={`${inputClass} mt-2`}
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-full py-2.5 font-medium transition flex items-center justify-center gap-2 bg-foreground text-background hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Expense"
                    : "Save Expense"}
              </button>
            </section>

            {/* Category breakdown */}
            <section className="pos-panel rounded-xl p-4 lg:col-span-3 self-start">
              <h2 className="font-semibold">By category</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monthLabel(month)}
              </p>

              {loading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No expenses recorded for this month.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {byCategory.map((row) => {
                    const pct = total > 0 ? (row.total / total) * 100 : 0;

                    return (
                      <div key={row.label.toLowerCase()}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate pr-2">
                            {row.label}
                            <span className="text-xs text-muted-foreground font-normal ml-1.5">
                              ({row.count})
                            </span>
                          </span>
                          <span className="font-semibold shrink-0">
                            {formatMoney(row.total)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-foreground/10 mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--pos-brand)]"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Entries */}
          <section className="pos-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--pos-stroke)]">
              <h2 className="font-semibold">Entries</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Newest first
              </p>
            </div>

            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                Nothing here yet — add your first expense above.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--pos-stroke)]">
                {expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {expense.category}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatDate(expense.expense_date)}
                        {expense.notes ? ` · ${expense.notes}` : ""}
                      </p>
                    </div>

                    <span className="font-semibold text-sm shrink-0">
                      {formatMoney(Number(expense.amount))}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(expense)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
                        aria-label={`Edit ${expense.category} expense`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(expense)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                        aria-label={`Delete ${expense.category} expense`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.category} — ${formatMoney(
                    Number(deleteTarget.amount),
                  )} on ${formatDate(deleteTarget.expense_date)}. This will also reduce the expenses shown on the dashboard.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
