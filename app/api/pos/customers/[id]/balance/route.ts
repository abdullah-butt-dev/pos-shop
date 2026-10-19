import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET /api/pos/customers/:id/balance
// Returns the customer's total outstanding balance (sum of amount_due across
// all of their sales). Used by the cart to show "Previous Balance".
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const customerId = params.id;

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("pos_sales")
      .select("amount_due")
      .eq("customer_id", customerId)
      .gt("amount_due", 0);

    if (error) {
      console.error("[API /api/pos/customers/[id]/balance] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const balance = (data || []).reduce(
      (sum, row) => sum + Number(row.amount_due || 0),
      0,
    );

    return NextResponse.json(
      { data: { customer_id: customerId, balance } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: any) {
    console.error("[API /api/pos/customers/[id]/balance] Unexpected:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
