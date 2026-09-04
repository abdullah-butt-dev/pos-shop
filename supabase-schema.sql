-- Complete POS System Database Schema
-- Run this SQL in your Supabase SQL editor to create the required tables

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
CREATE INDEX idx_bill_history_table_number ON bill_history(table_number);

-- Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_history ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations for now (you can restrict this later)
CREATE POLICY "Enable all operations for categories" ON categories
FOR ALL USING (true);

CREATE POLICY "Enable all operations for products" ON products
FOR ALL USING (true);

CREATE POLICY "Enable all operations for bill_history" ON bill_history
FOR ALL USING (true);

-- Create a function to automatically update the updated_at column
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

-- Insert default categories (only if they don't exist)
INSERT INTO categories (id, name, color) VALUES
('cleaning-agents', 'Cleaning Agents', 'tile-pink'),
('brooms-mops', 'Brooms & Mops', 'tile-purple'),
('brushes', 'Brushes', 'tile-blue'),
('dustpans', 'Dustpans & Bins', 'tile-purple'),
('gloves', 'Gloves & Protection', 'tile-pink'),
('sponges', 'Sponges & Cloths', 'tile-mint'),
('disinfectants', 'Disinfectants', 'tile-blue'),
('accessories', 'Accessories', 'tile-purple')
ON CONFLICT (id) DO NOTHING;

-- Function to increment order count
CREATE OR REPLACE FUNCTION increment_order_count(product_id VARCHAR(50))
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET order_count = order_count + 1, updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock(product_id VARCHAR(50), quantity_to_subtract INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock = GREATEST(0, stock - quantity_to_subtract), updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;
