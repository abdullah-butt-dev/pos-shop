import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://stynbmxluovwisqogwre.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function clearTestData() {
  console.log('🚀 Starting POS test data cleanup...');
  console.log('🔒 Note: auth.users (passwords/usernames) and pos_business_settings are PRESERVED.\n');

  // Step 1: Delete sales-related tables
  const { error: scaErr, count: scaCount } = await supabase
    .from('pos_sale_cost_allocations')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_sale_cost_allocations: ${scaErr ? '❌ ' + scaErr.message : '✅ Cleared ' + (scaCount ?? 0) + ' rows'}`);

  const { error: siErr, count: siCount } = await supabase
    .from('pos_sale_items')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_sale_items: ${siErr ? '❌ ' + siErr.message : '✅ Cleared ' + (siCount ?? 0) + ' rows'}`);

  const { error: cpErr, count: cpCount } = await supabase
    .from('pos_customer_payments')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_customer_payments: ${cpErr ? '❌ ' + cpErr.message : '✅ Cleared ' + (cpCount ?? 0) + ' rows'}`);

  const { error: sErr, count: sCount } = await supabase
    .from('pos_sales')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_sales: ${sErr ? '❌ ' + sErr.message : '✅ Cleared ' + (sCount ?? 0) + ' rows'}`);

  const { error: spErr, count: spCount } = await supabase
    .from('pos_supplier_payments')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_supplier_payments: ${spErr ? '❌ ' + spErr.message : '✅ Cleared ' + (spCount ?? 0) + ' rows'}`);

  // Step 2: Buffer inventory before deleting purchase items so triggers do not violate non-negative check
  const { data: products } = await supabase.from('pos_products').select('id');
  if (products && products.length > 0) {
    for (const p of products) {
      await supabase.from('pos_inventory').upsert({ product_id: p.id, quantity: 1000000 });
    }
  }

  // Step 3: Delete purchase items
  const { error: piErr, count: piCount } = await supabase
    .from('pos_purchase_items')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_purchase_items: ${piErr ? '❌ ' + piErr.message : '✅ Cleared ' + (piCount ?? 0) + ' rows'}`);

  // Step 4: Delete purchases
  const { error: purErr, count: purCount } = await supabase
    .from('pos_purchases')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_purchases: ${purErr ? '❌ ' + purErr.message : '✅ Cleared ' + (purCount ?? 0) + ' rows'}`);

  // Step 5: Delete inventory movements & inventory
  const { error: imErr, count: imCount } = await supabase
    .from('pos_inventory_movements')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_inventory_movements: ${imErr ? '❌ ' + imErr.message : '✅ Cleared ' + (imCount ?? 0) + ' rows'}`);

  const { error: invErr, count: invCount } = await supabase
    .from('pos_inventory')
    .delete({ count: 'exact' })
    .neq('product_id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_inventory: ${invErr ? '❌ ' + invErr.message : '✅ Cleared ' + (invCount ?? 0) + ' rows'}`);

  // Step 6: Delete customers, products, and suppliers
  const { error: cErr, count: cCount } = await supabase
    .from('pos_customers')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_customers: ${cErr ? '❌ ' + cErr.message : '✅ Cleared ' + (cCount ?? 0) + ' rows'}`);

  const { error: prodErr, count: prodCount } = await supabase
    .from('pos_products')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_products: ${prodErr ? '❌ ' + prodErr.message : '✅ Cleared ' + (prodCount ?? 0) + ' rows'}`);

  const { error: supErr, count: supCount } = await supabase
    .from('pos_suppliers')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000');
  console.log(`pos_suppliers: ${supErr ? '❌ ' + supErr.message : '✅ Cleared ' + (supCount ?? 0) + ' rows'}`);

  // Final check of counts across all tables
  const tables = [
    'pos_sales',
    'pos_sale_items',
    'pos_sale_cost_allocations',
    'pos_customer_payments',
    'pos_purchases',
    'pos_purchase_items',
    'pos_supplier_payments',
    'pos_inventory',
    'pos_inventory_movements',
    'pos_customers',
    'pos_products',
    'pos_suppliers',
  ];

  console.log('\n--- Final Verification ---');
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`${table}: ${count} rows`);
  }

  console.log('\n✨ All POS test data successfully wiped!');
}

clearTestData().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
