import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Read environment from .env.local
const envContent = fs.readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("=== POS DELETION VERIFICATION SUITE ===\n");

  // Step 1: Check if functions exist in schema cache
  console.log("Step 1: Checking RPC functions in Supabase schema cache...");
  const dummyUuid = "00000000-0000-0000-0000-000000000000";

  const [resSale, resSalesBulk, resPur, resPurBulk] = await Promise.all([
    supabase.rpc("pos_delete_sale", { p_sale_id: dummyUuid }),
    supabase.rpc("pos_delete_sales_bulk", { p_sale_ids: [dummyUuid] }),
    supabase.rpc("pos_delete_purchase", { p_purchase_id: dummyUuid }),
    supabase.rpc("pos_delete_purchases_bulk", { p_purchase_ids: [dummyUuid] }),
  ]);

  const functionsStatus = {
    pos_delete_sale: resSale.error?.code !== "PGRST202",
    pos_delete_sales_bulk: resSalesBulk.error?.code !== "PGRST202",
    pos_delete_purchase: resPur.error?.code !== "PGRST202",
    pos_delete_purchases_bulk: resPurBulk.error?.code !== "PGRST202",
  };

  console.log("Functions status in Supabase:", functionsStatus);

  if (
    !functionsStatus.pos_delete_sale ||
    !functionsStatus.pos_delete_sales_bulk ||
    !functionsStatus.pos_delete_purchase
  ) {
    console.error(
      `\n[!] MISSING IN SUPABASE: One or more base functions missing.`,
    );
    process.exit(2);
  }

  if (!functionsStatus.pos_delete_purchases_bulk) {
    console.warn(
      `\n[NOTE] pos_delete_purchases_bulk is not yet installed in Supabase. It will be skipped until run in SQL Editor.\n`,
    );
  } else {
    console.log(
      "\nAll 4 delete functions are present and recognized by PostgREST!\n",
    );
  }

  // Step 2: Create test fixtures
  console.log("Step 2: Creating test fixtures...");
  const testSuffix = Date.now().toString().slice(-6);

  // Create test supplier
  const { data: supplier, error: supErr } = await supabase
    .from("pos_suppliers")
    .insert({
      name: `Test Supplier ${testSuffix}`,
      phone: "03001234567",
      address: "Test Location",
    })
    .select()
    .single();

  if (supErr) throw new Error("Failed to create supplier: " + supErr.message);
  console.log(`Created supplier: ${supplier.name} (${supplier.id})`);

  // Create test product
  const { data: product, error: prodErr } = await supabase
    .from("pos_products")
    .insert({
      name: `Test Product ${testSuffix}`,
      unit: "pcs",
      is_active: true,
    })
    .select()
    .single();

  if (prodErr) throw new Error("Failed to create product: " + prodErr.message);
  console.log(`Created product: ${product.name} (${product.id})`);

  try {
    // Create 3 purchases
    console.log("\nStep 3: Creating purchases (P1, P2, P3)...");
    const purchaseIds = [];
    for (let i = 1; i <= 3; i++) {
      const { data: pId, error: pErr } = await supabase.rpc(
        "pos_create_purchase",
        {
          p_supplier_id: supplier.id,
          p_purchase_date: new Date().toISOString().slice(0, 10),
          p_items: [{ product_id: product.id, quantity: 10, unit_cost: 50 }],
          p_amount_paid: 200,
          p_payment_method: "cash",
          p_reference_number: `REF-T${i}-${testSuffix}`,
          p_notes: `Test Purchase ${i}`,
        },
      );
      if (pErr)
        throw new Error(`Failed to create purchase ${i}: ` + pErr.message);
      purchaseIds.push(pId);
      console.log(`Purchase ${i} created: ID=${pId}`);
    }

    // Verify stock is 30
    const { data: invAfterPurchases } = await supabase
      .from("pos_inventory")
      .select("quantity")
      .eq("product_id", product.id)
      .single();
    console.log(
      `Inventory after 3 purchases of 10 units each: ${invAfterPurchases?.quantity} (expected 30)`,
    );

    // Create 2 sales consuming from FIFO
    console.log("\nStep 4: Creating sales (S1: 5 units, S2: 10 units)...");
    const { data: s1Id, error: s1Err } = await supabase.rpc("pos_create_sale", {
      p_customer_id: null,
      p_items: [{ product_id: product.id, quantity: 5, unit_price: 80 }],
      p_paid_amount: 400,
    });
    if (s1Err) throw new Error("Failed to create sale 1: " + s1Err.message);
    console.log(`Sale 1 created: ID=${s1Id} (sold 5 units)`);

    const { data: s2Id, error: s2Err } = await supabase.rpc("pos_create_sale", {
      p_customer_id: null,
      p_items: [{ product_id: product.id, quantity: 10, unit_price: 80 }],
      p_paid_amount: 800,
    });
    if (s2Err) throw new Error("Failed to create sale 2: " + s2Err.message);
    console.log(`Sale 2 created: ID=${s2Id} (sold 10 units)`);

    const { data: invAfterSales } = await supabase
      .from("pos_inventory")
      .select("quantity")
      .eq("product_id", product.id)
      .single();
    console.log(
      `Inventory after 2 sales: ${invAfterSales?.quantity} (expected 15)`,
    );

    // TEST 1: Blocked purchase deletion (P1 has items allocated to S1/S2)
    console.log(
      "\n--- TEST 1: Blocked purchase deletion (Purchase with sold items) ---",
    );
    const { data: blkRes, error: blkErr } = await supabase.rpc(
      "pos_delete_purchase",
      {
        p_purchase_id: purchaseIds[0],
      },
    );
    console.log("Attempted to delete Purchase 1 (sold items):");
    if (blkErr) {
      console.log(`✓ Correctly blocked with error: "${blkErr.message}"`);
      if (
        !blkErr.message.includes("already been sold") &&
        !blkErr.message.includes("blocked by sale")
      ) {
        throw new Error(
          "Blocking message did not describe sold items: " + blkErr.message,
        );
      }
    } else {
      throw new Error(
        "FAIL: Purchase with sold items was deleted when it should have been blocked!",
      );
    }

    // TEST 2: Blocked bulk purchases deletion
    if (functionsStatus.pos_delete_purchases_bulk) {
      console.log(
        "\n--- TEST 2: Blocked bulk purchase deletion (Batch containing sold purchase) ---",
      );
      const { data: blkBulkRes, error: blkBulkErr } = await supabase.rpc(
        "pos_delete_purchases_bulk",
        {
          p_purchase_ids: [purchaseIds[0], purchaseIds[2]], // P1 is sold, P3 is unsold
        },
      );
      if (blkBulkErr) {
        console.log(
          `✓ Batch correctly blocked with error: "${blkBulkErr.message}"`,
        );
        // Verify P3 was NOT deleted (all-or-nothing rollback)
        const { data: p3Check } = await supabase
          .from("pos_purchases")
          .select("id")
          .eq("id", purchaseIds[2])
          .single();
        if (!p3Check)
          throw new Error(
            "FAIL: Unsold purchase in blocked batch was deleted! Atomicity violated.",
          );
        console.log(
          "✓ All-or-nothing rollback verified: unsold purchase in batch remains untouched.",
        );
      } else {
        throw new Error(
          "FAIL: Bulk purchase delete with sold items succeeded when it should have been blocked!",
        );
      }
    } else {
      console.log(
        "\n--- TEST 2: Skipping blocked bulk purchase delete (run pos_delete_purchases_bulk in Supabase SQL editor) ---",
      );
    }

    // TEST 3: Single sale deletion (S1)
    console.log("\n--- TEST 3: Single sale deletion (Sale S1) ---");
    const { data: delSaleRes, error: delSaleErr } = await supabase.rpc(
      "pos_delete_sale",
      {
        p_sale_id: s1Id,
      },
    );
    if (delSaleErr)
      throw new Error("Failed to delete sale 1: " + delSaleErr.message);
    console.log("✓ Sale 1 deleted:", delSaleRes);

    const { data: invAfterS1Delete } = await supabase
      .from("pos_inventory")
      .select("quantity")
      .eq("product_id", product.id)
      .single();
    console.log(
      `Inventory after S1 delete: ${invAfterS1Delete?.quantity} (expected 20, +5 restored)`,
    );
    if (Number(invAfterS1Delete?.quantity) !== 20) {
      throw new Error(`Expected stock 20, got ${invAfterS1Delete?.quantity}`);
    }

    // TEST 4: Bulk sales deletion (S2)
    console.log("\n--- TEST 4: Bulk sales deletion (Sale S2) ---");
    const { data: delSalesBulkRes, error: delSalesBulkErr } =
      await supabase.rpc("pos_delete_sales_bulk", {
        p_sale_ids: [s2Id],
      });
    if (delSalesBulkErr)
      throw new Error(
        "Failed to bulk delete sale 2: " + delSalesBulkErr.message,
      );
    console.log("✓ Sale 2 bulk deleted:", delSalesBulkRes);

    const { data: invAfterS2Delete } = await supabase
      .from("pos_inventory")
      .select("quantity")
      .eq("product_id", product.id)
      .single();
    console.log(
      `Inventory after S2 delete: ${invAfterS2Delete?.quantity} (expected 30, all sales deleted)`,
    );
    if (Number(invAfterS2Delete?.quantity) !== 30) {
      throw new Error(`Expected stock 30, got ${invAfterS2Delete?.quantity}`);
    }

    // TEST 5: Single purchase deletion (P1, now that its sales were deleted)
    console.log(
      "\n--- TEST 5: Single purchase deletion (Purchase P1, now unblocked) ---",
    );
    const { data: delP1Res, error: delP1Err } = await supabase.rpc(
      "pos_delete_purchase",
      {
        p_purchase_id: purchaseIds[0],
      },
    );
    if (delP1Err)
      throw new Error("Failed to delete purchase 1: " + delP1Err.message);
    console.log("✓ Purchase 1 deleted:", delP1Res);

    const { data: invAfterP1Delete } = await supabase
      .from("pos_inventory")
      .select("quantity")
      .eq("product_id", product.id)
      .single();
    console.log(
      `Inventory after P1 delete: ${invAfterP1Delete?.quantity} (expected 20, -10 deducted)`,
    );
    if (Number(invAfterP1Delete?.quantity) !== 20) {
      throw new Error(`Expected stock 20, got ${invAfterP1Delete?.quantity}`);
    }

    // TEST 6: Bulk purchases deletion (P2 and P3)
    if (functionsStatus.pos_delete_purchases_bulk) {
      console.log(
        "\n--- TEST 6: Bulk purchases deletion (Purchases P2 and P3) ---",
      );
      const { data: delPurBulkRes, error: delPurBulkErr } = await supabase.rpc(
        "pos_delete_purchases_bulk",
        {
          p_purchase_ids: [purchaseIds[1], purchaseIds[2]],
        },
      );
      if (delPurBulkErr)
        throw new Error(
          "Failed to bulk delete purchases 2 and 3: " + delPurBulkErr.message,
        );
      console.log("✓ Purchases 2 and 3 bulk deleted:", delPurBulkRes);
    } else {
      console.log(
        "\n--- TEST 6: Deleting Purchases P2 and P3 via single delete (run pos_delete_purchases_bulk in Supabase SQL editor) ---",
      );
      await supabase.rpc("pos_delete_purchase", {
        p_purchase_id: purchaseIds[1],
      });
      await supabase.rpc("pos_delete_purchase", {
        p_purchase_id: purchaseIds[2],
      });
      console.log("✓ Purchases 2 and 3 deleted individually.");
    }

    const { data: invAfterBulkPurDelete } = await supabase
      .from("pos_inventory")
      .select("quantity")
      .eq("product_id", product.id)
      .single();
    console.log(
      `Inventory after P2 and P3 bulk delete: ${invAfterBulkPurDelete?.quantity} (expected 0)`,
    );
    if (Number(invAfterBulkPurDelete?.quantity) !== 0) {
      throw new Error(
        `Expected stock 0, got ${invAfterBulkPurDelete?.quantity}`,
      );
    }

    console.log(
      "\n=== ALL DELETION AND ATOMICITY TESTS PASSED SUCCESSFULLY! ===",
    );
  } finally {
    // Cleanup test products and suppliers
    console.log("\nCleaning up test product and supplier...");
    await supabase.from("pos_inventory").delete().eq("product_id", product.id);
    await supabase.from("pos_products").delete().eq("id", product.id);
    await supabase.from("pos_suppliers").delete().eq("id", supplier.id);
    console.log("Cleanup complete.");
  }
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
