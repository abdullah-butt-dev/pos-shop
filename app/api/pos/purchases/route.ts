import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const PURCHASE_SELECT =
  "*, pos_suppliers(name), pos_purchase_items(*, pos_products(name))";

// GET /api/pos/purchases -> most recent purchases first, with supplier and
// line-item (product) names joined in for display.
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("pos_purchases")
      .select(PURCHASE_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API /api/pos/purchases] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: data || [] },
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
    console.error("[API /api/pos/purchases] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/pos/purchases -> creates the purchase header, line items, and optional payment.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      supplier_id,
      purchase_date,
      items,
      amount_paid,
      payment_method,
      reference_number,
      notes,
    } = body || {};

    if (!supplier_id || typeof supplier_id !== "string") {
      return NextResponse.json(
        { error: "supplier_id is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one purchase item is required" },
        { status: 400 },
      );
    }

    for (const item of items) {
      if (
        !item?.product_id ||
        !(Number(item.quantity) > 0) ||
        Number(item.unit_cost) < 0
      ) {
        return NextResponse.json(
          {
            error:
              "Each item needs a product, a quantity greater than 0, and a non-negative cost",
          },
          { status: 400 },
        );
      }
    }

    const supabaseAdmin = getSupabaseAdmin();

    let purchaseId: string | null = null;

    // Try 7-parameter RPC first (which matches the PostgreSQL function in schema.sql)
    const { data: rpc7Data, error: rpc7Error } = await supabaseAdmin.rpc(
      "pos_create_purchase",
      {
        p_supplier_id: supplier_id,
        p_purchase_date: purchase_date || null,
        p_items: items.map((item: any) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
        })),
        p_amount_paid: Number(amount_paid) || 0,
        p_payment_method: payment_method || null,
        p_reference_number: reference_number
          ? String(reference_number).trim()
          : null,
        p_notes: notes ? String(notes).trim() : null,
      },
    );

    if (!rpc7Error && rpc7Data) {
      purchaseId = rpc7Data;
    } else {
      // If 7-param failed, try 5-param overload
      const { data: rpc5Data, error: rpc5Error } = await supabaseAdmin.rpc(
        "pos_create_purchase",
        {
          p_supplier_id: supplier_id,
          p_purchase_date: purchase_date || null,
          p_items: items.map((item: any) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            unit_cost: Number(item.unit_cost),
          })),
          p_amount_paid: Number(amount_paid) || 0,
          p_payment_method: payment_method || null,
        },
      );

      if (!rpc5Error && rpc5Data) {
        purchaseId = rpc5Data;
      } else {
        const errorMsg =
          rpc7Error?.message ||
          rpc5Error?.message ||
          "Failed to save purchase in database";
        console.error("[API /api/pos/purchases] RPC error:", errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }
    }

    const { data: purchase, error: fetchError } = await supabaseAdmin
      .from("pos_purchases")
      .select(PURCHASE_SELECT)
      .eq("id", purchaseId)
      .single();

    if (fetchError) {
      console.error(
        "[API /api/pos/purchases] Fetch-after-create error:",
        fetchError,
      );
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Reconcile live inventory for all purchased products across all suppliers
    await syncProductsInventory(
      supabaseAdmin,
      items.map((i: any) => i.product_id),
    );

    return NextResponse.json({ data: purchase });
  } catch (err: any) {
    console.error("[API /api/pos/purchases] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/pos/purchases -> edits a purchase item's quantity or unit_cost
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { item_id, quantity, unit_cost } = body || {};

    if (!item_id) {
      return NextResponse.json(
        { error: "item_id is required" },
        { status: 400 },
      );
    }

    const updates: Record<string, number> = {};
    if (typeof quantity === "number" && quantity > 0)
      updates.quantity = quantity;
    if (typeof unit_cost === "number" && unit_cost >= 0)
      updates.unit_cost = unit_cost;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide a valid quantity (>0) or unit_cost (>=0)" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("pos_purchase_items")
      .update(updates)
      .eq("id", item_id)
      .select("*, pos_products(name)")
      .single();

    if (error) {
      console.error("[API /api/pos/purchases PATCH] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.product_id) {
      await syncProductsInventory(supabaseAdmin, [data.product_id]);
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[API /api/pos/purchases PATCH] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

async function syncProductsInventory(supabaseAdmin: any, productIds: string[]) {
  if (!productIds || productIds.length === 0) return;
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  try {
    const [{ data: pItems }, { data: sItems }] = await Promise.all([
      supabaseAdmin
        .from("pos_purchase_items")
        .select("product_id, quantity")
        .in("product_id", uniqueIds),
      supabaseAdmin
        .from("pos_sale_items")
        .select("product_id, quantity")
        .in("product_id", uniqueIds),
    ]);

    const pMap = new Map<string, number>();
    for (const item of pItems || []) {
      pMap.set(
        item.product_id,
        (pMap.get(item.product_id) || 0) + Number(item.quantity || 0),
      );
    }

    const sMap = new Map<string, number>();
    for (const item of sItems || []) {
      sMap.set(
        item.product_id,
        (sMap.get(item.product_id) || 0) + Number(item.quantity || 0),
      );
    }

    const nowIso = new Date().toISOString();
    const upserts = uniqueIds.map((id) => ({
      product_id: id,
      quantity: Math.max(0, (pMap.get(id) || 0) - (sMap.get(id) || 0)),
      updated_at: nowIso,
    }));

    await supabaseAdmin
      .from("pos_inventory")
      .upsert(upserts, { onConflict: "product_id" });
  } catch (e) {
    console.error("[syncProductsInventory] error:", e);
  }
}
