import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const saleId = params.id;
    if (!saleId) {
      return NextResponse.json(
        { error: "Sale ID is required" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("pos_delete_sale", {
      p_sale_id: saleId,
    });

    if (error) {
      console.error("[API /api/pos/sales/[id]] Delete error:", error);
      const isNotFound = error.message?.toLowerCase().includes("not found");
      return NextResponse.json(
        { error: error.message || "Failed to delete sale" },
        { status: isNotFound ? 404 : 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[API /api/pos/sales/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
