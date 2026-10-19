import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPakistanDate } from "@/lib/pos-date-utils";

const SALE_SELECT =
  "*, pos_customers(name), pos_sale_items(*, pos_products(name))";

// GET /api/pos/sales
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("pos_sales")
      .select(SALE_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[API /api/pos/sales] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error("[API /api/pos/sales] Unexpected error:", err);

    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/pos/sales
//
// Creates the complete sale through the existing database sale function,
// including the initial payment when supplied.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const customerId =
      body?.customer_id === null ||
      body?.customer_id === undefined ||
      body?.customer_id === ""
        ? null
        : String(body.customer_id);

    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Sale must contain at least one item" },
        { status: 400 },
      );
    }

    const paidAmount = Number(body?.paid_amount);

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      return NextResponse.json(
        { error: "Paid amount must be zero or greater" },
        { status: 400 },
      );
    }

    const discountRaw =
      body?.discount_amount === undefined ||
      body?.discount_amount === null ||
      body?.discount_amount === ""
        ? 0
        : Number(body.discount_amount);
    const deliveryRaw =
      body?.delivery_charge === undefined ||
      body?.delivery_charge === null ||
      body?.delivery_charge === ""
        ? 0
        : Number(body.delivery_charge);

    if (!Number.isFinite(discountRaw) || discountRaw < 0) {
      return NextResponse.json(
        { error: "Discount must be zero or greater" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(deliveryRaw) || deliveryRaw < 0) {
      return NextResponse.json(
        { error: "Delivery charge must be zero or greater" },
        { status: 400 },
      );
    }

    const discountAmount = Math.round(discountRaw * 100) / 100;
    const deliveryCharge = Math.round(deliveryRaw * 100) / 100;

    const normalizedItems = items.map((item: any) => ({
      product_id: String(item?.product_id || ""),
      quantity: Number(item?.quantity),
      unit_price: Number(item?.unit_price),
    }));

    for (const item of normalizedItems) {
      if (!item.product_id) {
        return NextResponse.json(
          { error: "Each sale item requires a product" },
          { status: 400 },
        );
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        return NextResponse.json(
          { error: "Quantity must be greater than zero" },
          { status: 400 },
        );
      }

      if (!Number.isFinite(item.unit_price) || item.unit_price <= 0) {
        return NextResponse.json(
          { error: "Selling price must be greater than zero" },
          { status: 400 },
        );
      }
    }

    // Aggregate requested quantities per product to validate against live stock
    const productQuantities = new Map<string, number>();
    for (const item of normalizedItems) {
      productQuantities.set(
        item.product_id,
        (productQuantities.get(item.product_id) || 0) + item.quantity,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const productIds = Array.from(productQuantities.keys());

    // Check live stock balance from pos_inventory to prevent stale state
    const { data: inventoryRows, error: invLookupError } = await supabaseAdmin
      .from("pos_inventory")
      .select("product_id, quantity")
      .in("product_id", productIds);

    if (invLookupError) {
      console.warn(
        "[API /api/pos/sales] Stock lookup skipped:",
        invLookupError.message,
      );
    } else if (inventoryRows) {
      const inventoryMap = new Map<string, number>();
      for (const row of inventoryRows) {
        inventoryMap.set(row.product_id, Number(row.quantity) || 0);
      }

      for (const [prodId, requestedQty] of productQuantities.entries()) {
        const liveStock = inventoryMap.get(prodId) ?? 0;

        if (liveStock < requestedQty) {
          return NextResponse.json(
            {
              error: `Insufficient stock available. In stock: ${liveStock}, requested: ${requestedQty}`,
            },
            { status: 409 },
          );
        }
      }
    }

    const saleDate =
      body?.sale_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.sale_date))
        ? String(body.sale_date)
        : getPakistanDate();

    // pos_create_sale_v2 creates the sale, items, FIFO cost allocation, discount,
    // delivery charge, previous-balance snapshot and initial payment in ONE
    // database transaction (installed by migration-001-expenses-discounts.sql).
    const { data, error } = await supabaseAdmin.rpc("pos_create_sale_v2", {
      p_customer_id: customerId,
      p_items: normalizedItems,
      p_paid_amount: paidAmount,
      p_sale_date: saleDate,
      p_discount_amount: discountAmount,
      p_delivery_charge: deliveryCharge,
    });

    if (
      error &&
      (error.code === "PGRST202" ||
        error.message?.toLowerCase().includes("schema cache") ||
        error.message?.toLowerCase().includes("could not find the function"))
    ) {
      console.error("[API /api/pos/sales] pos_create_sale_v2 not found:", error);

      return NextResponse.json(
        {
          error:
            "Database update required: run migration-001-expenses-discounts.sql in the Supabase SQL Editor, then try again.",
        },
        { status: 500 },
      );
    }

    if (error) {
      console.error("[API /api/pos/sales] Create error:", error);

      const message = error.message || "Failed to create sale";
      const normalizedMessage = message.toLowerCase();

      const isStockError = normalizedMessage.includes("insufficient stock");
      const isConstraintError =
        normalizedMessage.includes("pos_inventory_quantity_non_negative") ||
        normalizedMessage.includes("check constraint");

      let userFacingError = message;
      if (isConstraintError) {
        userFacingError =
          "Database stock trigger error: Please execute the updated pos_adjust_inventory function from schema.sql in your Supabase SQL Editor.";
      } else if (isStockError) {
        userFacingError = "Insufficient stock available to complete this sale.";
      }

      return NextResponse.json(
        {
          error: userFacingError,
        },
        {
          status: isStockError || isConstraintError ? 409 : 400,
        },
      );
    }

    const { data: createdSale } = await supabaseAdmin
      .from("pos_sales")
      .select(
        "id, receipt_number, sale_date, total_amount, amount_paid, amount_due, payment_status, discount_amount, delivery_charge, previous_balance, created_at",
      )
      .eq("id", data)
      .maybeSingle();

    return NextResponse.json(
      { data: createdSale || { id: data } },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[API /api/pos/sales] Unexpected error:", err);

    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
