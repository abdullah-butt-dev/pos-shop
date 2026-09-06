import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPakistanDate } from "@/lib/pos-date-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const today = () => getPakistanDate();

function validDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ? null : value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedFrom = validDate(searchParams.get("from"));
    const requestedTo = validDate(searchParams.get("to"));

    const from = requestedFrom || requestedTo || today();
    const to = requestedTo || requestedFrom || today();

    if (from > to) {
      return NextResponse.json(
        { error: "`from` cannot be after `to`" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const fromStart = `${from}T00:00:00+05:00`;
    const toEnd = `${to}T23:59:59+05:00`;

    const [
      salesResult,
      purchasesResult,
      customerPaymentsResult,
      supplierPaymentsResult,
      inventoryResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("pos_sales")
        .select(
          "id, receipt_number, customer_id, sale_date, total_amount, amount_paid, amount_due, payment_status, created_at, pos_customers(name), pos_sale_items(id, product_id, quantity, unit_price, unit_cost, line_total, line_cost_total, pos_products(name))",
        )
        .or(
          `and(sale_date.gte.${from},sale_date.lte.${to}),and(created_at.gte.${fromStart},created_at.lte.${toEnd})`,
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("pos_purchases")
        .select(
          "id, supplier_id, purchase_date, reference_number, total_amount, amount_paid, amount_due, payment_status, created_at, pos_suppliers(name)",
        )
        .or(
          `and(purchase_date.gte.${from},purchase_date.lte.${to}),and(created_at.gte.${fromStart},created_at.lte.${toEnd})`,
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("pos_customer_payments")
        .select(
          "id, customer_id, sale_id, amount, payment_date, payment_method, notes, created_at, pos_customers(name), pos_sales(receipt_number)",
        )
        .or(
          `and(payment_date.gte.${from},payment_date.lte.${to}),and(created_at.gte.${fromStart},created_at.lte.${toEnd})`,
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("pos_supplier_payments")
        .select(
          "id, supplier_id, purchase_id, amount, payment_date, payment_method, notes, created_at, pos_suppliers(name), pos_purchases(reference_number)",
        )
        .or(
          `and(payment_date.gte.${from},payment_date.lte.${to}),and(created_at.gte.${fromStart},created_at.lte.${toEnd})`,
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("pos_inventory")
        .select(
          "product_id, quantity, updated_at, pos_products(id, name, unit, is_active)",
        ),

      supabase
        .from("pos_business_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const firstError = [
      salesResult.error,
      purchasesResult.error,
      customerPaymentsResult.error,
      supplierPaymentsResult.error,
      inventoryResult.error,
      settingsResult.error,
    ].find(Boolean);

    if (firstError) {
      console.error("[API /api/pos/reports] Supabase error:", firstError);

      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const sales = salesResult.data || [];
    const purchases = purchasesResult.data || [];
    const customerPayments = customerPaymentsResult.data || [];
    const supplierPayments = supplierPaymentsResult.data || [];
    const inventory = inventoryResult.data || [];

    // Normalize dates to merchant Pakistan calendar date and trigger background self-healing
    for (const s of sales) {
      if (s.created_at) {
        const pkDate = getPakistanDate(new Date(s.created_at));
        if (s.sale_date !== pkDate) {
          s.sale_date = pkDate;
          supabase
            .from("pos_sales")
            .update({ sale_date: pkDate })
            .eq("id", s.id)
            .then();
        }
      }
    }

    for (const p of purchases) {
      if (p.created_at) {
        const pkDate = getPakistanDate(new Date(p.created_at));
        if (p.purchase_date !== pkDate) {
          p.purchase_date = pkDate;
          supabase
            .from("pos_purchases")
            .update({ purchase_date: pkDate })
            .eq("id", p.id)
            .then();
        }
      }
    }

    for (const cp of customerPayments) {
      if (cp.created_at) {
        const pkDate = getPakistanDate(new Date(cp.created_at));
        if (cp.payment_date !== pkDate) {
          cp.payment_date = pkDate;
          supabase
            .from("pos_customer_payments")
            .update({ payment_date: pkDate })
            .eq("id", cp.id)
            .then();
        }
      }
    }

    for (const sp of supplierPayments) {
      if (sp.created_at) {
        const pkDate = getPakistanDate(new Date(sp.created_at));
        if (sp.payment_date !== pkDate) {
          sp.payment_date = pkDate;
          supabase
            .from("pos_supplier_payments")
            .update({ payment_date: pkDate })
            .eq("id", sp.id)
            .then();
        }
      }
    }

    // Revenue and profit are recognized on the original sale date. Customer payments are cash collections only and must never be counted as revenue or profit again.
    const salesWithProfit = sales.map((sale: any) => {
      const revenue = (sale.pos_sale_items || []).reduce(
        (sum: number, item: any) => sum + Number(item.line_total || 0),
        0,
      );

      const cost = (sale.pos_sale_items || []).reduce(
        (sum: number, item: any) => sum + Number(item.line_cost_total || 0),
        0,
      );

      return {
        ...sale,
        profit: revenue - cost,
        actual_cost: cost,
      };
    });

    const currentReceivablesResult = await supabase
      .from("pos_sales")
      .select("amount_due")
      .gt("amount_due", 0);

    const currentPayablesResult = await supabase
      .from("pos_purchases")
      .select("amount_due")
      .gt("amount_due", 0);

    if (currentReceivablesResult.error || currentPayablesResult.error) {
      const error =
        currentReceivablesResult.error || currentPayablesResult.error;

      console.error("[API /api/pos/reports] Balance error:", error);

      return NextResponse.json(
        {
          error: error?.message || "Failed to load balances",
        },
        { status: 500 },
      );
    }

    const receivables = (currentReceivablesResult.data || []).reduce(
      (sum, row) => sum + Number(row.amount_due || 0),
      0,
    );

    const payables = (currentPayablesResult.data || []).reduce(
      (sum, row) => sum + Number(row.amount_due || 0),
      0,
    );

    const stockRows = inventory.map((row: any) => ({
      ...row,
      quantity: Number(row.quantity || 0),
    }));

    const salesTotal = salesWithProfit.reduce(
      (sum, sale: any) => sum + Number(sale.total_amount || 0),
      0,
    );

    const profitTotal = salesWithProfit.reduce(
      (sum, sale: any) => sum + Number(sale.profit || 0),
      0,
    );

    const purchaseTotal = purchases.reduce(
      (sum, purchase: any) => sum + Number(purchase.total_amount || 0),
      0,
    );

    const customerPaymentTotal = customerPayments.reduce(
      (sum, payment: any) => sum + Number(payment.amount || 0),
      0,
    );

    const supplierPaymentTotal = supplierPayments.reduce(
      (sum, payment: any) => sum + Number(payment.amount || 0),
      0,
    );

    return NextResponse.json(
      {
        range: {
          from,
          to,
        },

        settings: settingsResult.data || {
          shop_name: "Perfect Traders",
          currency: "PKR",
        },

        summary: {
          sales: salesTotal,
          profit: profitTotal,
          purchases: purchaseTotal,
          customer_payments: customerPaymentTotal,
          supplier_payments: supplierPaymentTotal,
          receivables,
          payables,
          total_products: inventory.length,
          stock_units: stockRows.reduce(
            (sum: number, row: any) => sum + row.quantity,
            0,
          ),
        },

        sales: salesWithProfit,
        purchases,
        customer_payments: customerPayments,
        supplier_payments: supplierPayments,
        inventory: stockRows,
      },
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
    console.error("[API /api/pos/reports] Unexpected error:", err);

    return NextResponse.json(
      {
        error: err?.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
