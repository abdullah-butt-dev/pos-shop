import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const purchaseId = params.id;
    if (!purchaseId) {
      return NextResponse.json(
        { error: "Purchase ID is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("pos_delete_purchase", {
      p_purchase_id: purchaseId,
    });

    if (error) {
      console.error("[API /api/pos/purchases/[id]] Delete error:", error);
      const isBlockingError = error.message
        ?.toLowerCase()
        .includes("already been sold");
      const isNotFound = error.message?.toLowerCase().includes("not found");
      return NextResponse.json(
        { error: error.message || "Failed to delete purchase" },
        { status: isBlockingError ? 409 : isNotFound ? 404 : 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[API /api/pos/purchases/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
