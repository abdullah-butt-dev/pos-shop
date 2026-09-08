-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR TO INSTALL / UPDATE POS DELETION FUNCTIONS
-- ============================================================================

-- 1. pos_delete_sale (Single Sale Deletion)
CREATE OR REPLACE FUNCTION pos_delete_sale(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_payment RECORD;
  v_deleted_payments JSONB := '[]'::JSONB;
  v_restored_items JSONB := '[]'::JSONB;
BEGIN
  -- 1. Verify sale exists
  SELECT * INTO v_sale FROM pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale with ID % not found', p_sale_id;
  END IF;

  -- 2. Fetch payments referencing this sale to return info
  FOR v_payment IN
    SELECT id, amount, payment_date, payment_method
    FROM pos_customer_payments
    WHERE sale_id = p_sale_id
  LOOP
    v_deleted_payments := v_deleted_payments || jsonb_build_object(
      'id', v_payment.id,
      'amount', v_payment.amount,
      'payment_date', v_payment.payment_date,
      'payment_method', v_payment.payment_method
    );
  END LOOP;

  -- 3. Fetch items to record restored stock info
  FOR v_item IN
    SELECT si.id, si.product_id, si.quantity, p.name AS product_name
    FROM pos_sale_items si
    JOIN pos_products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale_id
  LOOP
    v_restored_items := v_restored_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity
    );
  END LOOP;

  -- 4. Delete pos_sale_cost_allocations for this sale first
  -- (frees up consumed purchase-lot quantity back for FIFO)
  DELETE FROM pos_sale_cost_allocations
  WHERE sale_item_id IN (
    SELECT id FROM pos_sale_items WHERE sale_id = p_sale_id
  );

  -- 5. Delete pos_customer_payments tied to this sale
  DELETE FROM pos_customer_payments WHERE sale_id = p_sale_id;

  -- 6. Delete pos_sale_items
  -- Fires pos_sale_items_after_change_trg (TG_OP = 'DELETE'),
  -- which executes pos_adjust_inventory(OLD.product_id, OLD.quantity, 'sale_reversal', 'sale_item', OLD.id, 'Deleted')
  DELETE FROM pos_sale_items WHERE sale_id = p_sale_id;

  -- 7. Delete the pos_sales row itself
  DELETE FROM pos_sales WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sale_id', p_sale_id,
    'receipt_number', v_sale.receipt_number,
    'deleted_payments', v_deleted_payments,
    'restored_items', v_restored_items
  );
END;
$$;

-- 2. pos_delete_sales_bulk (Bulk Sale Deletion in Single Transaction)
CREATE OR REPLACE FUNCTION pos_delete_sales_bulk(p_sale_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_count INT := 0;
  v_missing_count INT := 0;
  v_results JSONB := '[]'::JSONB;
  v_single_res JSONB;
BEGIN
  IF p_sale_ids IS NULL OR array_length(p_sale_ids, 1) IS NULL OR array_length(p_sale_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No sale IDs provided for bulk deletion';
  END IF;

  -- 1. Verify ALL sales exist upfront. If ANY is missing, abort the entire batch.
  SELECT count(*) INTO v_missing_count
  FROM unnest(p_sale_ids) AS expected(id)
  WHERE NOT EXISTS (SELECT 1 FROM pos_sales s WHERE s.id = expected.id);

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION '% of the selected sales do not exist in the database. Entire bulk deletion cancelled.', v_missing_count;
  END IF;

  -- 2. Delete each sale in single atomic transaction
  FOREACH v_id IN ARRAY p_sale_ids
  LOOP
    v_single_res := pos_delete_sale(v_id);
    v_results := v_results || jsonb_build_array(v_single_res);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_count', v_count,
    'sales', v_results
  );
END;
$$;

-- 3. pos_delete_purchase (Single Purchase Deletion with Allocation Safeguards)
CREATE OR REPLACE FUNCTION pos_delete_purchase(p_purchase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchase RECORD;
  v_blocking RECORD;
  v_deleted_payments JSONB := '[]'::JSONB;
  v_payment RECORD;
BEGIN
  -- 1. Verify purchase exists
  SELECT * INTO v_purchase FROM pos_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase with ID % not found', p_purchase_id;
  END IF;

  -- 2. Check whether ANY pos_sale_cost_allocations reference any pos_purchase_items of this purchase
  SELECT
    string_agg(DISTINCT s.receipt_number, ', ') AS receipts,
    string_agg(DISTINCT p.name, ', ') AS products
  INTO v_blocking
  FROM pos_sale_cost_allocations a
  JOIN pos_sale_items si ON si.id = a.sale_item_id
  JOIN pos_sales s ON s.id = si.sale_id
  JOIN pos_purchase_items pi ON pi.id = a.purchase_item_id
  JOIN pos_products p ON p.id = pi.product_id
  WHERE pi.purchase_id = p_purchase_id;

  IF v_blocking.receipts IS NOT NULL AND v_blocking.receipts <> '' THEN
    RAISE EXCEPTION 'Cannot delete purchase: items from this purchase have already been sold in sale(s): % (Product: %). Please delete or adjust those sales first.',
      v_blocking.receipts, v_blocking.products;
  END IF;

  -- 3. Fetch supplier payments tied to this purchase to log/return
  FOR v_payment IN
    SELECT id, amount, payment_date, payment_method
    FROM pos_supplier_payments
    WHERE purchase_id = p_purchase_id
  LOOP
    v_deleted_payments := v_deleted_payments || jsonb_build_object(
      'id', v_payment.id,
      'amount', v_payment.amount,
      'payment_date', v_payment.payment_date,
      'payment_method', v_payment.payment_method
    );
  END LOOP;

  -- 4. Delete supplier payments
  DELETE FROM pos_supplier_payments WHERE purchase_id = p_purchase_id;

  -- 5. Delete purchase items
  -- Fires pos_purchase_items_after_change_trg (TG_OP = 'DELETE'),
  -- which executes pos_adjust_inventory(OLD.product_id, -OLD.quantity, 'purchase_reversal', 'purchase_item', OLD.id, 'Deleted')
  DELETE FROM pos_purchase_items WHERE purchase_id = p_purchase_id;

  -- 6. Delete the purchase record
  DELETE FROM pos_purchases WHERE id = p_purchase_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'purchase_id', p_purchase_id,
    'deleted_payments', v_deleted_payments
  );
END;
$$;

-- 4. pos_delete_purchases_bulk (Bulk Purchase Deletion in Single Transaction)
CREATE OR REPLACE FUNCTION pos_delete_purchases_bulk(p_purchase_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_count INT := 0;
  v_missing_count INT := 0;
  v_blocking_details TEXT;
  v_results JSONB := '[]'::JSONB;
  v_single_res JSONB;
BEGIN
  IF p_purchase_ids IS NULL OR array_length(p_purchase_ids, 1) IS NULL OR array_length(p_purchase_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No purchase IDs provided for bulk deletion';
  END IF;

  -- 1. Verify ALL purchases exist upfront. If ANY is missing, abort the entire batch.
  SELECT count(*) INTO v_missing_count
  FROM unnest(p_purchase_ids) AS expected(id)
  WHERE NOT EXISTS (SELECT 1 FROM pos_purchases p WHERE p.id = expected.id);

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION '% of the selected purchases do not exist in the database. Entire bulk deletion cancelled.', v_missing_count;
  END IF;

  -- 2. Check if ANY purchase in the batch is blocked by sales allocations.
  -- If blocked, report ALL blocking purchases, sales, and products in a detailed exception.
  SELECT string_agg(
    DISTINCT concat(
      'Purchase on ', pur.purchase_date,
      CASE WHEN pur.reference_number IS NOT NULL AND pur.reference_number <> '' THEN ' (Ref: ' || pur.reference_number || ')' ELSE '' END,
      ' blocked by sale ', s.receipt_number,
      ' (Product: ', p.name, ')'
    ),
    E'\n'
  )
  INTO v_blocking_details
  FROM pos_sale_cost_allocations a
  JOIN pos_sale_items si ON si.id = a.sale_item_id
  JOIN pos_sales s ON s.id = si.sale_id
  JOIN pos_purchase_items pi ON pi.id = a.purchase_item_id
  JOIN pos_purchases pur ON pur.id = pi.purchase_id
  JOIN pos_products p ON p.id = pi.product_id
  WHERE pi.purchase_id = ANY(p_purchase_ids);

  IF v_blocking_details IS NOT NULL AND v_blocking_details <> '' THEN
    RAISE EXCEPTION 'Cannot delete purchases: one or more purchases have items already sold in sales:
%
Entire bulk deletion cancelled. Please delete or adjust the blocking sales first.', v_blocking_details;
  END IF;

  -- 3. Delete each purchase in single atomic transaction
  FOREACH v_id IN ARRAY p_purchase_ids
  LOOP
    v_single_res := pos_delete_purchase(v_id);
    v_results := v_results || jsonb_build_array(v_single_res);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_count', v_count,
    'purchases', v_results
  );
END;
$$;

-- Permissions and Cache Reload
GRANT EXECUTE ON FUNCTION pos_delete_sale(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION pos_delete_sales_bulk(UUID[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION pos_delete_purchase(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION pos_delete_purchases_bulk(UUID[]) TO authenticated, anon, service_role;
NOTIFY pgrst, 'reload schema';
