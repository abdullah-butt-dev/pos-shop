-- ============================================================================
-- CONSOLIDATED POS SYSTEM SCHEMA
-- Copy and run this entire script in the Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS & CLEANUP
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS bill_history CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ----------------------------------------------------------------------------
-- SHARED TRIGGER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- MASTER TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_products (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 CITEXT NOT NULL,
  unit                 TEXT NOT NULL DEFAULT 'pcs',
  low_stock_threshold  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_products_name_not_blank CHECK (btrim(name::text) <> ''),
  CONSTRAINT pos_products_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS pos_suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        CITEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_suppliers_name_not_blank CHECK (btrim(name::text) <> ''),
  CONSTRAINT pos_suppliers_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS pos_customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_customers_name_not_blank CHECK (btrim(name) <> '')
);

-- ----------------------------------------------------------------------------
-- PURCHASES & INVENTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       UUID NOT NULL REFERENCES pos_suppliers(id) ON DELETE RESTRICT,
  purchase_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number  TEXT,
  notes             TEXT,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due        NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_purchase_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id   UUID NOT NULL REFERENCES pos_purchases(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES pos_products(id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost     NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  line_total    NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_inventory (
  product_id  UUID PRIMARY KEY REFERENCES pos_products(id) ON DELETE CASCADE,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_inventory_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
  movement_type     TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'purchase_reversal', 'sale_out', 'sale_reversal', 'adjustment')),
  quantity_change   NUMERIC(12,2) NOT NULL,
  balance_after     NUMERIC(12,2) NOT NULL,
  reference_type    TEXT CHECK (reference_type IN ('purchase_item', 'sale_item', 'manual')),
  reference_id      UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_supplier_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     UUID NOT NULL REFERENCES pos_suppliers(id) ON DELETE RESTRICT,
  purchase_id     UUID REFERENCES pos_purchases(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- SALES & ALLOCATIONS
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS pos_receipt_number_seq;

CREATE TABLE IF NOT EXISTS pos_sales (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES pos_customers(id) ON DELETE RESTRICT,
  receipt_number    TEXT NOT NULL DEFAULT ('PT-' || LPAD(nextval('pos_receipt_number_seq')::TEXT, 4, '0')),
  sale_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due        NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  payment_status    TEXT NOT NULL DEFAULT 'credit' CHECK (payment_status IN ('credit', 'partial', 'paid')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure existing database structure upgrades receipt format if table was already created
ALTER TABLE pos_sales 
  ALTER COLUMN receipt_number 
  SET DEFAULT ('PT-' || LPAD(nextval('pos_receipt_number_seq')::TEXT, 4, '0'));

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id           UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES pos_products(id) ON DELETE RESTRICT,
  quantity          NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price        NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_total        NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  line_cost_total   NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_sale_cost_allocations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id     UUID NOT NULL REFERENCES pos_sale_items(id) ON DELETE CASCADE,
  purchase_item_id UUID NOT NULL REFERENCES pos_purchase_items(id) ON DELETE RESTRICT,
  quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost        NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_customer_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES pos_customers(id) ON DELETE RESTRICT,
  sale_id         UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- BUSINESS SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_business_settings (
  id                            BOOLEAN PRIMARY KEY DEFAULT TRUE,
  shop_name                     TEXT NOT NULL DEFAULT 'Perfect Traders',
  currency                      TEXT NOT NULL DEFAULT 'PKR',
  address                       TEXT,
  phone                         TEXT,
  invoice_prefix                TEXT NOT NULL DEFAULT 'PT',
  default_low_stock_threshold   NUMERIC(12,2) NOT NULL DEFAULT 5,
  tax_rate                      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_business_settings_singleton CHECK (id)
);

INSERT INTO pos_business_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- TRIGGERS & LOGIC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pos_adjust_inventory(
  p_product_id      UUID,
  p_delta           NUMERIC,
  p_movement_type   TEXT,
  p_reference_type  TEXT,
  p_reference_id    UUID,
  p_notes           TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_balance NUMERIC(12,2);
BEGIN
  -- First ensure row exists in pos_inventory with 0 quantity if not present yet.
  -- Inserting 0 never violates pos_inventory_quantity_non_negative.
  INSERT INTO pos_inventory (product_id, quantity)
  VALUES (p_product_id, 0)
  ON CONFLICT (product_id) DO NOTHING;

  -- Update quantity safely; the table CHECK constraint pos_inventory_quantity_non_negative
  -- ensures final quantity >= 0 and raises an error if an oversell is attempted.
  UPDATE pos_inventory
  SET quantity = pos_inventory.quantity + p_delta,
      updated_at = NOW()
  WHERE product_id = p_product_id
  RETURNING quantity INTO v_balance;

  INSERT INTO pos_inventory_movements
    (product_id, movement_type, quantity_change, balance_after, reference_type, reference_id, notes)
  VALUES
    (p_product_id, p_movement_type, p_delta, v_balance, p_reference_type, p_reference_id, p_notes);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pos_recalc_purchase(p_purchase_id UUID) RETURNS VOID AS $$
DECLARE
  v_total NUMERIC(12,2);
  v_paid  NUMERIC(12,2);
BEGIN
  IF p_purchase_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO v_total FROM pos_purchase_items WHERE purchase_id = p_purchase_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM pos_supplier_payments WHERE purchase_id = p_purchase_id;

  UPDATE pos_purchases
  SET total_amount = v_total,
      amount_paid = v_paid,
      payment_status = CASE
        WHEN v_total > 0 AND v_paid >= v_total THEN 'paid'
        WHEN v_paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END,
      updated_at = NOW()
  WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pos_recalc_sale(p_sale_id UUID) RETURNS VOID AS $$
DECLARE
  v_total NUMERIC(12,2);
  v_paid  NUMERIC(12,2);
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO v_total FROM pos_sale_items WHERE sale_id = p_sale_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM pos_customer_payments WHERE sale_id = p_sale_id;

  UPDATE pos_sales
  SET total_amount = v_total,
      amount_paid = v_paid,
      payment_status = CASE
        WHEN v_total > 0 AND v_paid >= v_total THEN 'paid'
        WHEN v_paid > 0 THEN 'partial'
        ELSE 'credit'
      END,
      updated_at = NOW()
  WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pos_purchase_items_after_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pos_adjust_inventory(NEW.product_id, NEW.quantity, 'purchase_in', 'purchase_item', NEW.id, NULL);
    PERFORM pos_recalc_purchase(NEW.purchase_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id OR NEW.quantity <> OLD.quantity THEN
      PERFORM pos_adjust_inventory(OLD.product_id, -OLD.quantity, 'purchase_reversal', 'purchase_item', OLD.id, 'Reversed on edit');
      PERFORM pos_adjust_inventory(NEW.product_id, NEW.quantity, 'purchase_in', 'purchase_item', NEW.id, 'Re-applied on edit');
    END IF;
    PERFORM pos_recalc_purchase(NEW.purchase_id);
    IF NEW.purchase_id <> OLD.purchase_id THEN PERFORM pos_recalc_purchase(OLD.purchase_id); END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM pos_adjust_inventory(OLD.product_id, -OLD.quantity, 'purchase_reversal', 'purchase_item', OLD.id, 'Deleted');
    PERFORM pos_recalc_purchase(OLD.purchase_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pos_sale_items_after_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pos_adjust_inventory(NEW.product_id, -NEW.quantity, 'sale_out', 'sale_item', NEW.id, NULL);
    PERFORM pos_recalc_sale(NEW.sale_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id OR NEW.quantity <> OLD.quantity THEN
      PERFORM pos_adjust_inventory(OLD.product_id, OLD.quantity, 'sale_reversal', 'sale_item', OLD.id, 'Reversed on edit');
      PERFORM pos_adjust_inventory(NEW.product_id, -NEW.quantity, 'sale_out', 'sale_item', NEW.id, 'Re-applied on edit');
    END IF;
    PERFORM pos_recalc_sale(NEW.sale_id);
    IF NEW.sale_id <> OLD.sale_id THEN PERFORM pos_recalc_sale(OLD.sale_id); END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM pos_adjust_inventory(OLD.product_id, OLD.quantity, 'sale_reversal', 'sale_item', OLD.id, 'Deleted');
    PERFORM pos_recalc_sale(OLD.sale_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pos_supplier_payments_after_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pos_recalc_purchase(OLD.purchase_id);
    RETURN OLD;
  ELSE
    PERFORM pos_recalc_purchase(NEW.purchase_id);
    IF TG_OP = 'UPDATE' AND NEW.purchase_id IS DISTINCT FROM OLD.purchase_id THEN
      PERFORM pos_recalc_purchase(OLD.purchase_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pos_customer_payments_after_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pos_recalc_sale(OLD.sale_id);
    RETURN OLD;
  ELSE
    PERFORM pos_recalc_sale(NEW.sale_id);
    IF TG_OP = 'UPDATE' AND NEW.sale_id IS DISTINCT FROM OLD.sale_id THEN
      PERFORM pos_recalc_sale(OLD.sale_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pos_purchase_items_after_change_trg ON pos_purchase_items;
CREATE TRIGGER pos_purchase_items_after_change_trg
  AFTER INSERT OR UPDATE OR DELETE ON pos_purchase_items
  FOR EACH ROW EXECUTE FUNCTION pos_purchase_items_after_change();

DROP TRIGGER IF EXISTS pos_sale_items_after_change_trg ON pos_sale_items;
CREATE TRIGGER pos_sale_items_after_change_trg
  AFTER INSERT OR UPDATE OR DELETE ON pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION pos_sale_items_after_change();

DROP TRIGGER IF EXISTS pos_supplier_payments_after_change_trg ON pos_supplier_payments;
CREATE TRIGGER pos_supplier_payments_after_change_trg
  AFTER INSERT OR UPDATE OR DELETE ON pos_supplier_payments
  FOR EACH ROW EXECUTE FUNCTION pos_supplier_payments_after_change();

DROP TRIGGER IF EXISTS pos_customer_payments_after_change_trg ON pos_customer_payments;
CREATE TRIGGER pos_customer_payments_after_change_trg
  AFTER INSERT OR UPDATE OR DELETE ON pos_customer_payments
  FOR EACH ROW EXECUTE FUNCTION pos_customer_payments_after_change();

-- updated_at triggers
DROP TRIGGER IF EXISTS pos_products_updated_at ON pos_products;
CREATE TRIGGER pos_products_updated_at BEFORE UPDATE ON pos_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pos_suppliers_updated_at ON pos_suppliers;
CREATE TRIGGER pos_suppliers_updated_at BEFORE UPDATE ON pos_suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pos_customers_updated_at ON pos_customers;
CREATE TRIGGER pos_customers_updated_at BEFORE UPDATE ON pos_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pos_purchases_updated_at ON pos_purchases;
CREATE TRIGGER pos_purchases_updated_at BEFORE UPDATE ON pos_purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pos_sales_updated_at ON pos_sales;
CREATE TRIGGER pos_sales_updated_at BEFORE UPDATE ON pos_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pos_business_settings_updated_at ON pos_business_settings;
CREATE TRIGGER pos_business_settings_updated_at BEFORE UPDATE ON pos_business_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION pos_create_purchase(
  p_supplier_id       UUID,
  p_purchase_date     DATE,
  p_items             JSONB,
  p_amount_paid       NUMERIC DEFAULT 0,
  p_payment_method    TEXT DEFAULT NULL,
  p_reference_number  TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_purchase_id UUID;
  v_item        JSONB;
BEGIN
  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'supplier_id is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'At least one purchase item is required';
  END IF;

  INSERT INTO pos_purchases (supplier_id, purchase_date, reference_number, notes)
  VALUES (
    p_supplier_id,
    COALESCE(p_purchase_date, CURRENT_DATE),
    NULLIF(BTRIM(p_reference_number), ''),
    NULLIF(BTRIM(p_notes), '')
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item ->> 'product_id') IS NULL THEN
      RAISE EXCEPTION 'Each purchase item requires a product_id';
    END IF;

    INSERT INTO pos_purchase_items (purchase_id, product_id, quantity, unit_cost)
    VALUES (
      v_purchase_id,
      (v_item ->> 'product_id')::UUID,
      (v_item ->> 'quantity')::NUMERIC,
      (v_item ->> 'unit_cost')::NUMERIC
    );
  END LOOP;

  IF p_amount_paid IS NOT NULL AND p_amount_paid > 0 THEN
    INSERT INTO pos_supplier_payments (supplier_id, purchase_id, amount, payment_date, payment_method)
    VALUES (
      p_supplier_id,
      v_purchase_id,
      p_amount_paid,
      COALESCE(p_purchase_date, CURRENT_DATE),
      NULLIF(BTRIM(p_payment_method), '')
    );
  END IF;

  RETURN v_purchase_id;
END;
$$;

DROP FUNCTION IF EXISTS pos_create_sale(UUID, JSONB);
DROP FUNCTION IF EXISTS pos_create_sale(UUID, JSONB, NUMERIC);

CREATE OR REPLACE FUNCTION pos_create_sale(
  p_customer_id  UUID,
  p_items        JSONB,
  p_paid_amount  NUMERIC DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_id       UUID;
  v_sale_item_id  UUID;
  v_product_id    UUID;
  v_qty           NUMERIC(12,2);
  v_unit_price    NUMERIC(12,2);
  v_stock         NUMERIC(12,2);
  v_remaining     NUMERIC(12,2);
  v_take          NUMERIC(12,2);
  v_cost_total    NUMERIC(18,4);
  v_qty_total     NUMERIC(18,4);
  v_purchase      RECORD;
  v_total         NUMERIC(12,2);
  v_paid          NUMERIC(12,2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  v_paid := COALESCE(p_paid_amount, 0);
  IF v_paid < 0 THEN
    RAISE EXCEPTION 'Paid amount must be zero or greater';
  END IF;

  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pos_customers WHERE id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- 1. Validate live stock and lock inventory rows for each unique product
  -- Aggregates SUM(quantity) in case the same product appears on multiple line items.
  FOR v_product_id, v_qty IN
    SELECT
      (x->>'product_id')::UUID,
      SUM((x->>'quantity')::NUMERIC)
    FROM jsonb_array_elements(p_items) x
    GROUP BY (x->>'product_id')::UUID
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pos_products WHERE id = v_product_id AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Product not found or inactive: %', v_product_id;
    END IF;

    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    -- Ensure an inventory row exists so SELECT FOR UPDATE does not miss
    INSERT INTO pos_inventory (product_id, quantity)
    VALUES (v_product_id, 0)
    ON CONFLICT (product_id) DO NOTHING;

    -- Read the true live locked stock balance
    SELECT quantity
    INTO v_stock
    FROM pos_inventory
    WHERE product_id = v_product_id
    FOR UPDATE;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION
        'Insufficient stock for product %. Available: %, requested: %',
        v_product_id,
        v_stock,
        v_qty;
    END IF;
  END LOOP;

  -- 2. Create the sale header record
  INSERT INTO pos_sales (
    customer_id,
    sale_date,
    total_amount,
    amount_paid,
    payment_status
  )
  VALUES (
    p_customer_id,
    CURRENT_DATE,
    0,
    0,
    'credit'
  )
  RETURNING id INTO v_sale_id;

  -- 3. Create sale items and allocate FIFO cost
  -- Exactly ONE pos_sale_items row is created per unique product so the
  -- AFTER INSERT trigger (pos_sale_items_after_change_trg) fires ONCE per product,
  -- deducting stock accurately without double-triggering inventory movements.
  FOR v_product_id, v_qty, v_unit_price IN
    SELECT
      (x->>'product_id')::UUID,
      SUM((x->>'quantity')::NUMERIC),
      MAX((x->>'unit_price')::NUMERIC)
    FROM jsonb_array_elements(p_items) x
    GROUP BY (x->>'product_id')::UUID
  LOOP
    v_remaining := v_qty;
    v_cost_total := 0;
    v_qty_total := 0;

    -- Oldest purchase stock first
    FOR v_purchase IN
      SELECT
        pi.id,
        pi.quantity,
        pi.unit_cost,
        COALESCE(
          (
            SELECT SUM(a.quantity)
            FROM pos_sale_cost_allocations a
            WHERE a.purchase_item_id = pi.id
          ),
          0
        ) AS allocated_quantity
      FROM pos_purchase_items pi
      JOIN pos_purchases p ON p.id = pi.purchase_id
      WHERE pi.product_id = v_product_id
      ORDER BY
        p.purchase_date ASC,
        p.created_at ASC,
        pi.created_at ASC,
        pi.id ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      IF v_purchase.quantity > v_purchase.allocated_quantity THEN
        v_take := LEAST(
          v_remaining,
          v_purchase.quantity - v_purchase.allocated_quantity
        );

        v_cost_total := v_cost_total + (v_take * v_purchase.unit_cost);
        v_qty_total  := v_qty_total + v_take;
        v_remaining  := v_remaining - v_take;
      END IF;
    END LOOP;

    -- Single insert per product -> fires pos_sale_items_after_change_trg once
    INSERT INTO pos_sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      unit_cost
    )
    VALUES (
      v_sale_id,
      v_product_id,
      v_qty,
      v_unit_price,
      CASE
        WHEN v_qty_total > 0 THEN ROUND(v_cost_total / v_qty_total, 2)
        ELSE 0
      END
    )
    RETURNING id INTO v_sale_item_id;

    -- Persist exact purchase lots used in pos_sale_cost_allocations
    v_remaining := v_qty;
    FOR v_purchase IN
      SELECT
        pi.id,
        pi.quantity,
        pi.unit_cost,
        COALESCE(
          (
            SELECT SUM(a.quantity)
            FROM pos_sale_cost_allocations a
            WHERE a.purchase_item_id = pi.id
          ),
          0
        ) AS allocated_quantity
      FROM pos_purchase_items pi
      JOIN pos_purchases p ON p.id = pi.purchase_id
      WHERE pi.product_id = v_product_id
      ORDER BY
        p.purchase_date ASC,
        p.created_at ASC,
        pi.created_at ASC,
        pi.id ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      IF v_purchase.quantity > v_purchase.allocated_quantity THEN
        v_take := LEAST(
          v_remaining,
          v_purchase.quantity - v_purchase.allocated_quantity
        );

        INSERT INTO pos_sale_cost_allocations (
          sale_item_id,
          purchase_item_id,
          quantity,
          unit_cost
        )
        VALUES (
          v_sale_item_id,
          v_purchase.id,
          v_take,
          v_purchase.unit_cost
        );

        v_remaining := v_remaining - v_take;
      END IF;
    END LOOP;
  END LOOP;

  -- 4. Process payment
  SELECT total_amount
  INTO v_total
  FROM pos_sales
  WHERE id = v_sale_id
  FOR UPDATE;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Created sale could not be found';
  END IF;

  IF v_paid > v_total THEN
    RAISE EXCEPTION 'Paid amount of Rs. % exceeds sale total of Rs. %', v_paid, v_total;
  END IF;

  IF v_paid < v_total AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer is required for credit or partial payment sales';
  END IF;

  IF p_customer_id IS NOT NULL AND v_paid > 0 THEN
    -- Customer ledger entry -> trigger pos_customer_payments_after_change will recalculate pos_sales
    INSERT INTO pos_customer_payments (
      customer_id,
      sale_id,
      amount,
      payment_date,
      payment_method
    )
    VALUES (
      p_customer_id,
      v_sale_id,
      v_paid,
      CURRENT_DATE,
      'cash'
    );
  ELSIF p_customer_id IS NULL AND v_paid = v_total THEN
    -- Fully paid walk-in sale
    UPDATE pos_sales
    SET
      amount_paid = v_paid,
      payment_status = 'paid',
      updated_at = NOW()
    WHERE id = v_sale_id;
  END IF;

  RETURN v_sale_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_cost_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_business_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Drop existing policies to prevent 42710 "policy already exists" errors
  DROP POLICY IF EXISTS pos_products_auth_all ON pos_products;
  DROP POLICY IF EXISTS pos_suppliers_auth_all ON pos_suppliers;
  DROP POLICY IF EXISTS pos_customers_auth_all ON pos_customers;
  DROP POLICY IF EXISTS pos_purchases_auth_all ON pos_purchases;
  DROP POLICY IF EXISTS pos_purchase_items_auth_all ON pos_purchase_items;
  DROP POLICY IF EXISTS pos_inventory_auth_all ON pos_inventory;
  DROP POLICY IF EXISTS pos_inventory_movements_auth_all ON pos_inventory_movements;
  DROP POLICY IF EXISTS pos_supplier_payments_auth_all ON pos_supplier_payments;
  DROP POLICY IF EXISTS pos_sales_auth_all ON pos_sales;
  DROP POLICY IF EXISTS pos_sale_items_auth_all ON pos_sale_items;
  DROP POLICY IF EXISTS pos_sale_cost_allocations_auth_all ON pos_sale_cost_allocations;
  DROP POLICY IF EXISTS pos_customer_payments_auth_all ON pos_customer_payments;
  DROP POLICY IF EXISTS pos_business_settings_auth_all ON pos_business_settings;
END $$;

CREATE POLICY pos_products_auth_all ON pos_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_suppliers_auth_all ON pos_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_customers_auth_all ON pos_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_purchases_auth_all ON pos_purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_purchase_items_auth_all ON pos_purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_inventory_auth_all ON pos_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_inventory_movements_auth_all ON pos_inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_supplier_payments_auth_all ON pos_supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_sales_auth_all ON pos_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_sale_items_auth_all ON pos_sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_sale_cost_allocations_auth_all ON pos_sale_cost_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_customer_payments_auth_all ON pos_customer_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pos_business_settings_auth_all ON pos_business_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
-- Product indexes
CREATE INDEX IF NOT EXISTS idx_pos_products_is_active ON pos_products (is_active);
CREATE INDEX IF NOT EXISTS idx_pos_products_name_trgm ON pos_products USING gin (name gin_trgm_ops);

-- Supplier indexes
CREATE INDEX IF NOT EXISTS idx_pos_suppliers_is_active ON pos_suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_pos_suppliers_name_trgm ON pos_suppliers USING gin (name gin_trgm_ops);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_pos_customers_name_trgm ON pos_customers USING gin ((name::citext) gin_trgm_ops);

-- Purchase indexes
CREATE INDEX IF NOT EXISTS idx_pos_purchases_supplier_id ON pos_purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_pos_purchases_purchase_date ON pos_purchases (purchase_date);
CREATE INDEX IF NOT EXISTS idx_pos_purchases_payment_status ON pos_purchases (payment_status);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_items_purchase_id ON pos_purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS idx_pos_purchase_items_product_id ON pos_purchase_items (product_id);

-- Inventory movement indexes
CREATE INDEX IF NOT EXISTS idx_pos_inv_mov_product_id ON pos_inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_pos_inv_mov_created_at ON pos_inventory_movements (created_at);
CREATE INDEX IF NOT EXISTS idx_pos_inv_mov_reference ON pos_inventory_movements (reference_type, reference_id);

-- Supplier payment indexes
CREATE INDEX IF NOT EXISTS idx_pos_supplier_payments_supplier ON pos_supplier_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_pos_supplier_payments_purchase ON pos_supplier_payments (purchase_id);
CREATE INDEX IF NOT EXISTS idx_pos_supplier_payments_date ON pos_supplier_payments (payment_date);

-- Sale indexes
CREATE INDEX IF NOT EXISTS idx_pos_sales_customer_id ON pos_sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_sale_date ON pos_sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_pos_sales_payment_status ON pos_sales (payment_status);
CREATE INDEX IF NOT EXISTS idx_pos_sales_created_at ON pos_sales (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_sales_receipt_number_unique ON pos_sales (receipt_number);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale_id ON pos_sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_product_id ON pos_sale_items (product_id);

-- Sale cost allocation indexes
CREATE INDEX IF NOT EXISTS idx_pos_sale_cost_allocations_sale_item ON pos_sale_cost_allocations (sale_item_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_cost_allocations_purchase_item ON pos_sale_cost_allocations (purchase_item_id);

-- Customer payment indexes
CREATE INDEX IF NOT EXISTS idx_pos_customer_payments_customer ON pos_customer_payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_customer_payments_sale ON pos_customer_payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_customer_payments_date ON pos_customer_payments (payment_date);

-- ----------------------------------------------------------------------------
-- PERMISSIONS & GRANTS
-- ----------------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon, service_role;