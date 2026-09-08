import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const saleIds = Array.isArray(body?.sale_ids) ? body.sale_ids : [];

    if (saleIds.length === 0) {
      return NextResponse.json(
        { error: "At least one sale ID must be provided" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("pos_delete_sales_bulk", {
      p_sale_ids: saleIds,
    });

    if (error) {
      console.error(
        "[API /api/pos/sales/bulk-delete] Bulk delete error:",
        error,
      );
      return NextResponse.json(
        { error: error.message || "Failed to bulk delete sales" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[API /api/pos/sales/bulk-delete] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
