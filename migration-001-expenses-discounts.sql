-- ============================================================================
-- MIGRATION 001 — Expenses, discounts, delivery charges, previous balance
-- ============================================================================
-- SAFE FOR LIVE DATA. This script only ADDS things:
--   * 3 new columns on pos_sales (default 0 -> every existing sale is unchanged)
--   * 1 new table pos_expenses
--   * pos_recalc_sale() is replaced; for sales with discount = 0 and
--     delivery = 0 (i.e. ALL your existing sales) it returns identical results
--   * 1 new function pos_create_sale_v2(); the old pos_create_sale() is untouched
-- Nothing is dropped, deleted, truncated or rewritten. It can be re-run safely.
-- Run it in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Sales: discount, delivery charge and previous-balance snapshot
-- ----------------------------------------------------------------------------
ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS delivery_charge  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0);
ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS previous_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (previous_balance >= 0);

COMMENT ON COLUMN pos_sales.discount_amount  IS 'Special discount given on this sale (reduces total_amount).';
COMMENT ON COLUMN pos_sales.delivery_charge  IS 'Delivery charge billed on this sale (increases total_amount).';
COMMENT ON COLUMN pos_sales.previous_balance IS 'Customer outstanding balance at the moment of sale (bill display only; NOT part of total_amount).';

-- ----------------------------------------------------------------------------
-- 2. total_amount = items - discount + delivery  (previous behaviour when both are 0)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pos_recalc_sale(p_sale_id UUID) RETURNS VOID AS $$
DECLARE
  v_items    NUMERIC(14,2);
  v_total    NUMERIC(12,2);
  v_paid     NUMERIC(12,2);
  v_discount NUMERIC(12,2);
  v_delivery NUMERIC(12,2);
BEGIN
  IF p_sale_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO v_items FROM pos_sale_items WHERE sale_id = p_sale_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM pos_customer_payments WHERE sale_id = p_sale_id;

  SELECT discount_amount, delivery_charge
  INTO v_discount, v_delivery
  FROM pos_sales
  WHERE id = p_sale_id;

  v_discount := COALESCE(v_discount, 0);
  v_delivery := COALESCE(v_delivery, 0);

  -- GREATEST(...) keeps the CHECK (total_amount >= 0) safe while items are
  -- still being inserted one by one inside pos_create_sale_v2().
  v_total := GREATEST(v_items - v_discount + v_delivery, 0);

  UPDATE pos_sales
  SET total_amount = v_total,
      amount_paid = v_paid,
      payment_status = CASE
        WHEN v_items > 0 AND v_paid >= v_total THEN 'paid'
        WHEN v_paid > 0 THEN 'partial'
        ELSE 'credit'
      END,
      updated_at = NOW()
  WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. pos_create_sale_v2 — same FIFO / stock / payment logic as pos_create_sale,
--    plus discount, delivery charge and previous-balance snapshot (one transaction).
--    The original pos_create_sale() is left exactly as it is.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pos_create_sale_v2(
  p_customer_id      UUID,
  p_items            JSONB,
  p_paid_amount      NUMERIC DEFAULT 0,
  p_sale_date        DATE DEFAULT NULL,
  p_discount_amount  NUMERIC DEFAULT 0,
  p_delivery_charge  NUMERIC DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_id         UUID;
  v_sale_item_id    UUID;
  v_product_id      UUID;
  v_qty             NUMERIC(12,2);
  v_unit_price      NUMERIC(12,2);
  v_stock           NUMERIC(12,2);
  v_remaining       NUMERIC(12,2);
  v_take            NUMERIC(12,2);
  v_cost_total      NUMERIC(18,4);
  v_qty_total       NUMERIC(18,4);
  v_purchase        RECORD;
  v_total           NUMERIC(12,2);
  v_paid            NUMERIC(12,2);
  v_effective_date  DATE;
  v_discount        NUMERIC(12,2);
  v_delivery        NUMERIC(12,2);
  v_prev_balance    NUMERIC(12,2);
  v_items_total     NUMERIC(14,2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  v_effective_date := COALESCE(p_sale_date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE);

  v_paid := COALESCE(p_paid_amount, 0);
  IF v_paid < 0 THEN
    RAISE EXCEPTION 'Paid amount must be zero or greater';
  END IF;

  v_discount := ROUND(COALESCE(p_discount_amount, 0), 2);
  v_delivery := ROUND(COALESCE(p_delivery_charge, 0), 2);

  IF v_discount < 0 THEN
    RAISE EXCEPTION 'Discount must be zero or greater';
  END IF;

  IF v_delivery < 0 THEN
    RAISE EXCEPTION 'Delivery charge must be zero or greater';
  END IF;

  IF p_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pos_customers WHERE id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Snapshot the customer's outstanding balance BEFORE this sale is created
  -- (printed on the bill as "Previous Balance"; never added to this sale's total).
  IF p_customer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_due), 0)
    INTO v_prev_balance
    FROM pos_sales
    WHERE customer_id = p_customer_id;
  ELSE
    v_prev_balance := 0;
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
    payment_status,
    discount_amount,
    delivery_charge,
    previous_balance
  )
  VALUES (
    p_customer_id,
    v_effective_date,
    0,
    0,
    'credit',
    v_discount,
    v_delivery,
    v_prev_balance
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

  -- 3b. Discount can never exceed what the customer is being charged
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_items_total
  FROM pos_sale_items
  WHERE sale_id = v_sale_id;

  IF v_discount > v_items_total + v_delivery THEN
    RAISE EXCEPTION 'Discount of Rs. % cannot exceed the sale amount of Rs. %', v_discount, (v_items_total + v_delivery);
  END IF;

  -- 4. Process payment
  SELECT total_amount
  INTO v_total
  FROM pos_sales
  WHERE id = v_sale_id
  FOR UPDATE;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Created sale could not be found';
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sale total must be greater than zero';
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
      v_effective_date,
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

REVOKE ALL ON FUNCTION pos_create_sale_v2(UUID, JSONB, NUMERIC, DATE, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pos_create_sale_v2(UUID, JSONB, NUMERIC, DATE, NUMERIC, NUMERIC) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Expenses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pos_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL CHECK (length(btrim(category)) > 0),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date  DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_expenses_expense_date ON pos_expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_pos_expenses_category ON pos_expenses (category);

DROP TRIGGER IF EXISTS pos_expenses_updated_at ON pos_expenses;
CREATE TRIGGER pos_expenses_updated_at
  BEFORE UPDATE ON pos_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pos_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_expenses_auth_all ON pos_expenses;
CREATE POLICY pos_expenses_auth_all ON pos_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON pos_expenses FROM anon;
GRANT ALL ON pos_expenses TO authenticated, service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- Optional sanity check (read-only). Run after the migration:
--   SELECT count(*) AS sales, sum(total_amount) AS revenue FROM pos_sales;
-- The numbers must be identical to what you saw before running this script.
-- ----------------------------------------------------------------------------
