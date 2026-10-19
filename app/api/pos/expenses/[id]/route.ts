import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ? null : value;
}

// PATCH /api/pos/expenses/:id { category?, amount?, expense_date?, notes? }
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body?.category !== undefined) {
      const category =
        typeof body.category === "string"
          ? body.category.trim().replace(/\s+/g, " ")
          : "";

      if (!category || category.length > 60) {
        return NextResponse.json(
          { error: "Category is required (max 60 characters)" },
          { status: 400 },
        );
      }

      updates.category = category;
    }

    if (body?.amount !== undefined) {
      const amount = Math.round(Number(body.amount) * 100) / 100;

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Amount must be greater than zero" },
          { status: 400 },
        );
      }

      updates.amount = amount;
    }

    if (body?.expense_date !== undefined) {
      const expenseDate = validDate(body.expense_date);

      if (!expenseDate) {
        return NextResponse.json(
          { error: "Invalid expense date" },
          { status: 400 },
        );
      }

      updates.expense_date = expenseDate;
    }

    if (body?.notes !== undefined) {
      updates.notes =
        typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim().slice(0, 500)
          : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("pos_expenses")
      .update(updates)
      .eq("id", params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[API /api/pos/expenses/[id]] Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[API /api/pos/expenses/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/pos/expenses/:id
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from("pos_expenses")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("[API /api/pos/expenses/[id]] Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API /api/pos/expenses/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
