import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPakistanDate } from "@/lib/pos-date-utils";

export const dynamic = "force-dynamic";

const MIGRATION_HINT =
  "The expenses table is missing. Run migration-001-expenses-discounts.sql in the Supabase SQL Editor first.";

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ? null : value;
}

function isMissingTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.toLowerCase().includes("pos_expenses") === true &&
      error.message?.toLowerCase().includes("does not exist") === true
  );
}

// GET /api/pos/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = validDate(searchParams.get("from"));
    const to = validDate(searchParams.get("to"));

    const supabaseAdmin = getSupabaseAdmin();

    let query = supabaseAdmin
      .from("pos_expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (from) query = query.gte("expense_date", from);
    if (to) query = query.lte("expense_date", to);

    const { data, error } = await query;

    if (error) {
      console.error("[API /api/pos/expenses] Supabase error:", error);
      return NextResponse.json(
        { error: isMissingTable(error) ? MIGRATION_HINT : error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: data || [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[API /api/pos/expenses] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/pos/expenses { category, amount, expense_date?, notes? }
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const category =
      typeof body?.category === "string"
        ? body.category.trim().replace(/\s+/g, " ")
        : "";

    if (!category) {
      return NextResponse.json(
        { error: "Expense category is required" },
        { status: 400 },
      );
    }

    if (category.length > 60) {
      return NextResponse.json(
        { error: "Category must be 60 characters or fewer" },
        { status: 400 },
      );
    }

    const amount = Math.round(Number(body?.amount) * 100) / 100;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 },
      );
    }

    const expenseDate = validDate(body?.expense_date) || getPakistanDate();

    const notes =
      typeof body?.notes === "string" && body.notes.trim()
        ? body.notes.trim().slice(0, 500)
        : null;

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("pos_expenses")
      .insert([
        { category, amount, expense_date: expenseDate, notes },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("[API /api/pos/expenses] Insert error:", error);
      return NextResponse.json(
        { error: isMissingTable(error) ? MIGRATION_HINT : error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error("[API /api/pos/expenses] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
