import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const purchaseIds = Array.isArray(body?.purchase_ids)
      ? body.purchase_ids
      : [];

    if (purchaseIds.length === 0) {
      return NextResponse.json(
        { error: "At least one purchase ID must be provided" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc(
      "pos_delete_purchases_bulk",
      {
        p_purchase_ids: purchaseIds,
      },
    );

    if (error) {
      console.error(
        "[API /api/pos/purchases/bulk-delete] Bulk delete error:",
        error,
      );
      const isBlockingError =
        error.message?.toLowerCase().includes("already been sold") ||
        error.message?.toLowerCase().includes("already sold") ||
        error.message?.toLowerCase().includes("blocked by sale");

      return NextResponse.json(
        { error: error.message || "Failed to bulk delete purchases" },
        { status: isBlockingError ? 409 : 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error(
      "[API /api/pos/purchases/bulk-delete] Unexpected error:",
      err,
    );
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
