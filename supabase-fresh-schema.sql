-- Fresh POS System Database Schema
-- Delete old tables and create new ones with proper structure

-- Drop existing tables if they exist
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS bill_history CASCADE;

-- Categories Table
CREATE TABLE categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  retail_price DECIMAL(10,2) NOT NULL,
  wholesale_price DECIMAL(10,2) NOT NULL,
  category_id VARCHAR(50) REFERENCES categories(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  order_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill History Table
CREATE TABLE bill_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_number VARCHAR(50) NOT NULL UNIQUE,
  table_number VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('retail', 'wholesale')),
  items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_stock ON products(stock);
CREATE INDEX idx_bill_history_type ON bill_history(type);
CREATE INDEX idx_bill_history_created_at ON bill_history(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_history ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations
CREATE POLICY "Enable all operations for categories" ON categories
FOR ALL USING (true);

CREATE POLICY "Enable all operations for products" ON products
FOR ALL USING (true);

CREATE POLICY "Enable all operations for bill_history" ON bill_history
FOR ALL USING (true);

-- Create function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
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

-- Helper functions for product operations
CREATE OR REPLACE FUNCTION increment_order_count(product_id VARCHAR(50))
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET order_count = order_count + 1, updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_stock(product_id VARCHAR(50), quantity_to_subtract INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock = GREATEST(0, stock - quantity_to_subtract), updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- Insert fresh default categories
INSERT INTO categories (id, name, color) VALUES
('cleaning-agents', 'Cleaning Agents', 'tile-pink'),
('brooms-mops', 'Brooms & Mops', 'tile-purple'),
('brushes', 'Brushes', 'tile-blue'),
('dustpans', 'Dustpans & Bins', 'tile-purple'),
('gloves', 'Gloves & Protection', 'tile-pink'),
('sponges', 'Sponges & Cloths', 'tile-mint'),
('disinfectants', 'Disinfectants', 'tile-blue'),
('accessories', 'Accessories', 'tile-purple');

-- Insert sample products
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

-- Verify the setup
SELECT 'Categories created:' as info, count(*) as count FROM categories
UNION ALL
SELECT 'Products created:' as info, count(*) as count FROM products;
