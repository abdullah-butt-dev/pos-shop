import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// GET /api/pos/settings -> the single pos_business_settings row. Used by the
// Settings page's Business & Invoice tab, and mirrors the same row the
// dashboard/financials/receipt PDF already read via /api/pos/reports.

export const dynamic = "force-dynamic";

const DEFAULT_RECEIPT_FOOTER =
  "مال موقع پر چیک کر لیں، بعد میں دکاندار ذمہ دار نہ ہوگا";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("pos_business_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) {
      console.error("[API /api/pos/settings] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings = data
      ? {
          ...data,
          receipt_footer_text:
            data.receipt_footer_text !== undefined &&
            data.receipt_footer_text !== null
              ? data.receipt_footer_text
              : DEFAULT_RECEIPT_FOOTER,
        }
      : null;

    return NextResponse.json({ data: settings });
  } catch (err: any) {
    console.error("[API /api/pos/settings] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT /api/pos/settings { shop_name, currency, address, phone, invoice_prefix,
// tax_rate, receipt_footer_text } -> updates the single settings row.
// Only known columns are accepted; everything else in the request body is
// ignored so this can't be used to write arbitrary columns.
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (typeof body?.shop_name === "string") {
      const name = body.shop_name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "Shop name cannot be empty" },
          { status: 400 },
        );
      }
      updates.shop_name = name;
    }

    if (typeof body?.currency === "string" && body.currency.trim()) {
      updates.currency = body.currency.trim();
    }

    if (typeof body?.address === "string") {
      updates.address = body.address.trim() || null;
    }

    if (typeof body?.phone === "string") {
      updates.phone = body.phone.trim() || null;
    }

    if (
      typeof body?.invoice_prefix === "string" &&
      body.invoice_prefix.trim()
    ) {
      updates.invoice_prefix = body.invoice_prefix.trim();
    }

    if (body?.tax_rate !== undefined) {
      const taxRate = Number(body.tax_rate);
      if (!Number.isFinite(taxRate) || taxRate < 0) {
        return NextResponse.json(
          { error: "Tax rate must be zero or greater" },
          { status: 400 },
        );
      }
      updates.tax_rate = taxRate;
    }

    if (body?.receipt_footer_text !== undefined) {
      updates.receipt_footer_text =
        typeof body.receipt_footer_text === "string"
          ? body.receipt_footer_text.trim()
          : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let { data, error } = await supabaseAdmin
      .from("pos_business_settings")
      .update(updates)
      .eq("id", true)
      .select("*")
      .single();

    // If column doesn't exist yet in Supabase, retry update without receipt_footer_text
    if (error && error.code === "42703" && "receipt_footer_text" in updates) {
      console.warn(
        "[API /api/pos/settings] receipt_footer_text column not yet migrated in database, falling back without column",
      );
      const safeUpdates = { ...updates };
      delete safeUpdates.receipt_footer_text;
      const retry = await supabaseAdmin
        .from("pos_business_settings")
        .update(safeUpdates)
        .eq("id", true)
        .select("*")
        .single();
      data = retry.data
        ? { ...retry.data, receipt_footer_text: updates.receipt_footer_text }
        : null;
      error = retry.error;
    }

    if (error) {
      console.error("[API /api/pos/settings] Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[API /api/pos/settings] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
