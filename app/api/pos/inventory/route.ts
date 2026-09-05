import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/pos/inventory -> current stock balance per product, so the
// purchase entry screen can show live totals after a purchase is saved.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const [
      { data: products, error: prodErr },
      { data: purchaseItems, error: piErr },
      { data: saleItems, error: siErr },
      { data: invRows, error: invErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("pos_products")
        .select("id, name, unit, is_active")
        .eq("is_active", true),
      supabaseAdmin.from("pos_purchase_items").select("product_id, quantity"),
      supabaseAdmin.from("pos_sale_items").select("product_id, quantity"),
      supabaseAdmin
        .from("pos_inventory")
        .select("product_id, quantity, updated_at"),
    ]);

    if (prodErr || piErr || siErr || invErr) {
      const err = prodErr || piErr || siErr || invErr;
      console.error("[API /api/pos/inventory] Supabase error:", err);
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }

    // Sum all historical purchases per product across all suppliers
    const purchasedMap = new Map<string, number>();
    for (const pi of purchaseItems || []) {
      if (!pi.product_id) continue;
      const current = purchasedMap.get(pi.product_id) || 0;
      purchasedMap.set(pi.product_id, current + Number(pi.quantity || 0));
    }

    // Sum all sales per product
    const soldMap = new Map<string, number>();
    for (const si of saleItems || []) {
      if (!si.product_id) continue;
      const current = soldMap.get(si.product_id) || 0;
      soldMap.set(si.product_id, current + Number(si.quantity || 0));
    }

    // Existing inventory rows map
    const existingInvMap = new Map<
      string,
      { quantity: number; updated_at: string }
    >();
    for (const row of invRows || []) {
      existingInvMap.set(row.product_id, {
        quantity: Number(row.quantity || 0),
        updated_at: row.updated_at,
      });
    }

    // Build the reconciled inventory list and detect any drift
    const reconciledList: {
      product_id: string;
      quantity: number;
      updated_at: string;
      pos_products: { name: string; unit: string };
    }[] = [];

    const driftUpserts: {
      product_id: string;
      quantity: number;
      updated_at: string;
    }[] = [];

    const nowIso = new Date().toISOString();

    for (const prod of products || []) {
      const totalPurchased = purchasedMap.get(prod.id) || 0;
      const totalSold = soldMap.get(prod.id) || 0;
      const trueStock = Math.max(0, totalPurchased - totalSold);

      const existing = existingInvMap.get(prod.id);
      const currentDbQty = existing?.quantity;

      if (
        currentDbQty === undefined ||
        Math.abs(currentDbQty - trueStock) > 0.001
      ) {
        driftUpserts.push({
          product_id: prod.id,
          quantity: trueStock,
          updated_at: nowIso,
        });
      }

      reconciledList.push({
        product_id: prod.id,
        quantity: trueStock,
        updated_at: existing?.updated_at || nowIso,
        pos_products: {
          name: prod.name,
          unit: prod.unit || "pcs",
        },
      });
    }

    // Reconcile database pos_inventory in the background if any drift was found
    if (driftUpserts.length > 0) {
      void supabaseAdmin
        .from("pos_inventory")
        .upsert(driftUpserts, { onConflict: "product_id" })
        .then(({ error }) => {
          if (error) {
            console.warn(
              "[API /api/pos/inventory] Background drift reconcile warning:",
              error.message,
            );
          }
        });
    }

    return NextResponse.json(
      { data: reconciledList },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (err: any) {
    console.error("[API /api/pos/inventory] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
