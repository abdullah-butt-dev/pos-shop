import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function escapeLikePattern(input: string) {
  return input.replace(/[%_\\]/g, (match) => `\\${match}`);
}

// GET /api/pos/products?q=cok       -> autocomplete matches while typing
// GET /api/pos/products?all=1       -> full catalog (active + inactive) with
//                                       unit, for the Inventory page
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const all = searchParams.get("all") === "1";

    const supabaseAdmin = getSupabaseAdmin();

    if (all) {
      const [{ data: products, error }, { data: pItems }, { data: sItems }] =
        await Promise.all([
          supabaseAdmin
            .from("pos_products")
            .select("id, name, unit, is_active, created_at")
            .order("name", { ascending: true }),
          supabaseAdmin.from("pos_purchase_items").select("product_id"),
          supabaseAdmin.from("pos_sale_items").select("product_id"),
        ]);

      if (error) {
        console.error("[API /api/pos/products] Supabase error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const usedProductIds = new Set([
        ...(pItems || []).map((i: any) => i.product_id),
        ...(sItems || []).map((i: any) => i.product_id),
      ]);

      const withHasRecords = (products || []).map((p: any) => ({
        ...p,
        has_records: usedProductIds.has(p.id),
      }));

      return NextResponse.json(
        { data: withHasRecords },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );
    }

    let query = supabaseAdmin
      .from("pos_products")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(100);

    if (q) {
      query = query.ilike("name", `%${escapeLikePattern(q)}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API /api/pos/products] Supabase error:", error);
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
    console.error("[API /api/pos/products] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/pos/products { name, unit? } -> reuses an
// existing case-insensitive match if one exists, otherwise creates a new
// product. Never creates a duplicate: `name` is a citext column, so equality
// here is already case-insensitive at the database level. `unit` is
// optional so the purchase-entry autocomplete (which only ever sends `name`)
// keeps working unchanged.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const unit =
      typeof body?.unit === "string" && body.unit.trim()
        ? body.unit.trim()
        : undefined;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("pos_products")
      .select("id, name")
      .eq("name", name)
      .maybeSingle();

    if (lookupError) {
      console.error("[API /api/pos/products] Lookup error:", lookupError);
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ data: existing });
    }

    const insertRow: Record<string, unknown> = { name };
    if (unit !== undefined) insertRow.unit = unit;

    const { data, error } = await supabaseAdmin
      .from("pos_products")
      .insert([insertRow])
      .select("id, name")
      .single();

    if (error) {
      // Race: another request created the same name between the lookup
      // above and this insert. Reuse it instead of erroring out.
      if (error.code === "23505") {
        const { data: raceExisting } = await supabaseAdmin
          .from("pos_products")
          .select("id, name")
          .eq("name", name)
          .maybeSingle();

        if (raceExisting) {
          return NextResponse.json({ data: raceExisting });
        }
      }

      console.error("[API /api/pos/products] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error("[API /api/pos/products] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
