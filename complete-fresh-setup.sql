-- 🗑️ COMPLETE FRESH SETUP - Delete Everything and Start Over
-- Copy and paste this ENTIRE script into Supabase SQL Editor and run it

-- ========================================
-- STEP 1: DELETE EVERYTHING
-- ========================================

-- Drop all existing tables (this will delete all data!)
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS bill_history CASCADE;

-- Drop any existing functions
DROP FUNCTION IF EXISTS increment_order_count(VARCHAR);
DROP FUNCTION IF EXISTS decrement_stock(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ========================================
-- STEP 2: CREATE FRESH TABLES
-- ========================================

-- Categories Table
CREATE TABLE categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL DEFAULT 'tile-blue',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  retail_price DECIMAL(10,2) NOT NULL CHECK (retail_price >= 0),
  wholesale_price DECIMAL(10,2) NOT NULL CHECK (wholesale_price >= 0),
  category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  order_count INTEGER NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill History Table
CREATE TABLE bill_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_number VARCHAR(50) NOT NULL UNIQUE,
  table_number VARCHAR(20) NOT NULL DEFAULT 'Table-1',
  type VARCHAR(10) NOT NULL CHECK (type IN ('retail', 'wholesale')),
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- STEP 3: CREATE INDEXES
-- ========================================

-- Categories indexes
CREATE INDEX idx_categories_name ON categories(name);

-- Products indexes
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_order_count ON products(order_count DESC);

-- Bill history indexes
CREATE INDEX idx_bill_history_type ON bill_history(type);
CREATE INDEX idx_bill_history_created_at ON bill_history(created_at DESC);
CREATE INDEX idx_bill_history_bill_number ON bill_history(bill_number);

-- ========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_history ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all operations for now)
CREATE POLICY "Allow all operations on categories" ON categories FOR ALL USING (true);
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations on bill_history" ON bill_history FOR ALL USING (true);

-- ========================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ========================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment product order count
CREATE OR REPLACE FUNCTION increment_order_count(product_id VARCHAR(50))
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET order_count = order_count + 1, updated_at = NOW()
  WHERE id = product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with id % not found', product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock(product_id VARCHAR(50), quantity_to_subtract INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock = GREATEST(0, stock - quantity_to_subtract), updated_at = NOW()
  WHERE id = product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with id % not found', product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 6: CREATE TRIGGERS
-- ========================================

-- Triggers to automatically update updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bill_history_updated_at
  BEFORE UPDATE ON bill_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- STEP 7: INSERT FRESH DEFAULT DATA
-- ========================================

-- Insert default categories
INSERT INTO categories (id, name, color) VALUES
('cleaning-agents', 'Cleaning Agents', 'tile-pink'),
('brooms-mops', 'Brooms & Mops', 'tile-purple'),
('brushes', 'Brushes', 'tile-blue'),
('dustpans', 'Dustpans & Bins', 'tile-purple'),
('gloves', 'Gloves & Protection', 'tile-pink'),
('sponges', 'Sponges & Cloths', 'tile-mint'),
('disinfectants', 'Disinfectants', 'tile-blue'),
('accessories', 'Accessories', 'tile-purple');

-- Insert default products
INSERT INTO products (id, name, retail_price, wholesale_price, category_id, stock, low_stock_threshold, order_count) VALUES
('floor-cleaner', 'Floor Cleaner 5L', 450.00, 380.00, 'cleaning-agents', 45, 10, 120),
('glass-cleaner', 'Glass Cleaner Spray', 180.00, 150.00, 'cleaning-agents', 8, 15, 95),
('cotton-mop', 'Cotton Mop Head', 320.00, 270.00, 'brooms-mops', 25, 8, 78),
('push-broom', 'Heavy Duty Push Broom', 550.00, 480.00, 'brooms-mops', 5, 10, 65),
('toilet-brush', 'Toilet Brush Set', 220.00, 180.00, 'brushes', 30, 12, 110),
('scrub-brush', 'Scrubbing Brush', 150.00, 120.00, 'brushes', 18, 10, 88),
('dustpan-set', 'Dustpan & Brush Set', 280.00, 230.00, 'dustpans', 22, 8, 72),
('waste-bin', 'Plastic Waste Bin 50L', 850.00, 720.00, 'dustpans', 12, 5, 45),
('rubber-gloves', 'Rubber Gloves (Pair)', 120.00, 95.00, 'gloves', 6, 20, 150),
('microfiber-cloth', 'Microfiber Cloth Pack', 200.00, 165.00, 'sponges', 35, 15, 92),
('sponge-pack', 'Kitchen Sponge 10-Pack', 180.00, 145.00, 'sponges', 28, 12, 105),
('disinfectant-spray', 'Disinfectant Spray 500ml', 250.00, 210.00, 'disinfectants', 7, 15, 130);

-- ========================================
-- STEP 8: VERIFY SETUP
-- ========================================

-- Show summary of what was created
SELECT 
  'SETUP COMPLETE! 🎉' as status,
  (SELECT COUNT(*) FROM categories) as categories_count,
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM bill_history) as bills_count;

-- Show all categories
SELECT 'Categories:' as info, id, name, color FROM categories ORDER BY name;

-- Show all products with their categories
SELECT 
  'Products:' as info,
  p.name as product_name,
  c.name as category_name,
  p.retail_price,
  p.stock
FROM products p
JOIN categories c ON p.category_id = c.id
ORDER BY c.name, p.name;

-- Test the helper functions
SELECT 'Testing functions...' as info;

-- This should work without errors if everything is set up correctly
-- (We're not actually running these, just showing they exist)
-- SELECT increment_order_count('floor-cleaner');
-- SELECT decrement_stock('floor-cleaner', 1);

SELECT '✅ Fresh setup complete! Your tables are ready to use.' as final_message;
