import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// PATCH /api/pos/products/[id] { name?, unit?, is_active? }
// Used by the Inventory page to edit product master data or to
// deactivate/reactivate a product. Products are never hard-deleted here:
// pos_purchase_items / pos_sale_items reference products with
// ON DELETE RESTRICT, so a product that has ever been purchased or sold
// can't be removed without corrupting purchase/sale history. Deactivating
// (is_active = false) hides it from the POS and from autocomplete search
// while keeping every historical record intact.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "name cannot be empty" },
          { status: 400 },
        );
      }
      updates.name = name;
    }

    if (typeof body?.unit === "string") {
      const unit = body.unit.trim();
      if (!unit) {
        return NextResponse.json(
          { error: "unit cannot be empty" },
          { status: 400 },
        );
      }
      updates.unit = unit;
    }

    if (typeof body?.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("pos_products")
      .update(updates)
      .eq("id", params.id)
      .select("id, name, unit, is_active")
      .single();

    if (error) {
      // Unique violation: another product already has this name.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A product with this name already exists" },
          { status: 409 },
        );
      }
      console.error("[API /api/pos/products/[id]] Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[API /api/pos/products/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("pos_products")
      .delete()
      .eq("id", params.id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          {
            error:
              "Cannot delete this product because it has existing purchase or sale records",
          },
          { status: 409 },
        );
      }
      console.error("[API /api/pos/products/[id]] Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API /api/pos/products/[id]] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
