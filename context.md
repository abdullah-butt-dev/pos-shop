# POS Shop — System Architecture & Developer Context

This document provides a comprehensive overview of the `pos-shop` application architecture, database layer, accounting principles, data models, API endpoints, and component organization.

---

## 1. High-Level Architecture

The system is designed as an operational Point of Sale (POS) and inventory management platform for commercial retail and wholesale businesses:

- **Frontend / Application Layer**: Next.js 14 App Router, React 18, Tailwind CSS, Lucide React, and Radix UI components.
- **Backend / API Layer**: Next.js Route Handlers (`/api/pos/*`) utilizing Supabase Admin client (`SUPABASE_SERVICE_ROLE_KEY`) for secure data operations and integrity checks.
- **Database & Trigger Layer**: Supabase PostgreSQL 15+ containing relational tables, foreign key constraints, CITEXT case-insensitive unique identifiers, automated recalculation triggers, and atomic stored procedures.
- **Client PDF Generation**: `jsPDF` builds branded thermal/invoice receipts directly in the browser on demand, requiring 0 storage bucket allocation.

---

## 2. Directory & Route Map

```
pos-shop/
├── app/
│   ├── api/pos/
│   │   ├── autocomplete/
│   │   │   ├── customers/route.ts   # Autocomplete + inline creation of customers
│   │   │   ├── products/route.ts    # Autocomplete + inline creation of products
│   │   │   └── suppliers/route.ts   # Autocomplete + inline creation of suppliers
│   │   ├── customer-payments/
│   │   │   └── route.ts             # Record, edit (with overpayment guard), and delete collections
│   │   ├── customers/
│   │   │   └── route.ts             # Customer listing and query
│   │   ├── inventory/
│   │   │   └── route.ts             # Live inventory balances per product
│   │   ├── orders/
│   │   │   └── route.ts             # Create sales with FIFO cost allocation via RPC
│   │   ├── payables/
│   │   │   └── route.ts             # Supplier payables listing with amount due
│   │   ├── products/
│   │   │   ├── [id]/route.ts        # Update product metadata or soft/hard delete
│   │   │   └── route.ts             # Product catalog listing and creation
│   │   ├── purchases/
│   │   │   └── route.ts             # Record purchases and list historical purchase orders
│   │   ├── receivables/
│   │   │   └── route.ts             # Customer receivables listing with amount due
│   │   ├── reports/
│   │   │   └── route.ts             # Consolidated dashboard KPI reports
│   │   ├── settings/
│   │   │   └── route.ts             # Business profile and invoice settings
│   │   ├── supplier-payments/
│   │   │   └── route.ts             # Record supplier disbursements
│   │   └── suppliers/
│   │       ├── [id]/route.ts        # Update supplier or delete with FK check
│   │       └── route.ts             # Supplier catalog listing and creation
│   ├── dashboard/page.tsx           # Dashboard with KPIs, cash flows, and recent sales
│   ├── inventory/page.tsx           # Products & Suppliers catalog management
│   ├── orders/page.tsx              # New Sale POS terminal and checkout
│   ├── payables/page.tsx            # Payables management and supplier payments
│   ├── purchases/page.tsx           # Purchases (Add Purchase & Recent Purchases)
│   ├── receivables/page.tsx         # Receivables management, cash collections, and payment edits
│   ├── settings/page.tsx            # Business settings and user password management
│   ├── login/page.tsx               # Supabase authentication sign-in
│   ├── layout.tsx                   # Root layout with AuthProvider and NavHeader
│   └── page.tsx                     # Home directory / quick navigation cards
├── components/
│   ├── pos/
│   │   ├── autocomplete-field.tsx   # Generic searchable dropdown with inline creation
│   │   ├── cart-context.tsx         # React context for active order state
│   │   ├── nav-header.tsx           # Responsive navigation header and hamburger sheet
│   │   ├── order-summary.tsx        # Cart summary, payment modes, and checkout submission
│   │   └── product-card.tsx         # POS catalog item card with stock badge
│   └── ui/                          # Radix/Shadcn primitives (dialog, button, input, etc.)
├── context/
│   └── auth-context.tsx             # Supabase GoTrue authentication state
├── lib/
│   ├── pos-receipt-pdf.ts           # Client-side PDF receipt generation via jsPDF
│   ├── pos-service.ts               # Typed frontend client API service classes
│   ├── supabase.ts                  # Supabase client and TypeScript entity definitions
│   ├── supabase-admin.ts            # Supabase service role client for API routes
│   └── utils.ts                     # Utility helpers and cn class merger
└── schema.sql                       # Complete PostgreSQL database schema and triggers
```

---

## 3. Database Entities & Schemas

1. **`pos_products`**: Product catalog (`id`, `name citext unique`, `unit`, `is_active`, `created_at`, `updated_at`).
2. **`pos_suppliers`**: Supplier directory (`id`, `name citext unique`, `phone`, `address`, `notes`, `is_active`, `created_at`, `updated_at`).
3. **`pos_customers`**: Customer directory (`id`, `name citext unique`, `phone`, `notes`, `created_at`, `updated_at`).
4. **`pos_purchases`**: Purchase invoices (`id`, `supplier_id`, `purchase_date`, `reference_number`, `notes`, `total_amount`, `amount_paid`, `amount_due`, `payment_status`, `created_at`, `updated_at`).
5. **`pos_purchase_items`**: Purchase line items (`id`, `purchase_id`, `product_id`, `quantity`, `unit_cost`, `line_total`, `created_at`).
6. **`pos_inventory`**: Live inventory on hand (`product_id PK`, `quantity`, `updated_at`).
7. **`pos_inventory_movements`**: Audit log of stock adjustments (`id`, `product_id`, `movement_type`, `quantity_change`, `balance_after`, `reference_type`, `reference_id`, `notes`, `created_at`).
8. **`pos_supplier_payments`**: Cash disbursements to suppliers (`id`, `supplier_id`, `purchase_id`, `amount`, `payment_date`, `payment_method`, `notes`, `created_at`).
9. **`pos_sales`**: Sales invoices (`id`, `customer_id`, `sale_date`, `receipt_number`, `notes`, `total_amount`, `amount_paid`, `amount_due`, `payment_status`, `created_at`, `updated_at`).
10. **`pos_sale_items`**: Sale line items (`id`, `sale_id`, `product_id`, `quantity`, `unit_price`, `unit_cost`, `line_total`, `line_cost_total`, `created_at`).
11. **`pos_sale_cost_allocations`**: FIFO cost mapping connecting sale items to specific purchase batches (`id`, `sale_item_id`, `purchase_item_id`, `quantity`, `unit_cost`, `created_at`).
12. **`pos_customer_payments`**: Cash collections from customers (`id`, `customer_id`, `sale_id`, `amount`, `payment_date`, `payment_method`, `notes`, `created_at`).
13. **`pos_business_settings`**: Single-row configuration (`id = true`, `shop_name`, `currency`, `address`, `phone`, `invoice_prefix`, `tax_rate`, `updated_at`).

---

## 4. Business Logic & Accounting Rules

### Single Source of Truth

Financial aggregates and inventory levels are recalculated dynamically by PostgreSQL trigger functions:

- `pos_adjust_inventory()`: Updates `pos_inventory.quantity` and appends an immutable movement to `pos_inventory_movements`.
- `pos_recalc_purchase()`: Computes `total_amount = SUM(line_total)`, `amount_paid = SUM(amount)`, `amount_due = total_amount - amount_paid`, and sets `payment_status` (`paid`, `partial`, `unpaid`).
- `pos_recalc_sale()`: Computes `total_amount = SUM(line_total)`, `amount_paid = SUM(amount)`, `amount_due = total_amount - amount_paid`, and sets `payment_status` (`paid`, `partial`, `credit`).

### Revenue & Profit Recognition

- **Recognition on Sale Date**: Revenue (`total_amount`) and Profit (`total_amount - line_cost_total`) are recognized immediately on the original `sale_date`, regardless of whether payment was collected in full, partially, or sold on store credit.
- **Customer Payments as Cash Inflow**: Subsequent customer payments recorded in `pos_customer_payments` are cash collections that reduce accounts receivable. They are reported as Cash Inflow in cash flow statements and are **never** counted as revenue or profit on the collection date.

### FIFO Cost Allocation

When `pos_create_sale()` is invoked:

- It locks current inventory records using `SELECT FOR UPDATE` to avoid negative stock or race conditions.
- It steps chronologically through unexhausted `pos_purchase_items` for each product to allocate the exact historical `unit_cost` via `pos_sale_cost_allocations`.
- Weighted average cost is recorded on `pos_sale_items.unit_cost` for accurate margin tracking.

### Payment Validation & Overpayment Guard

- When recording a new customer payment, the payment amount cannot exceed the open `amount_due` on the target sale.
- When editing an existing customer payment via `PATCH /api/pos/customer-payments`, the updated amount cannot exceed `sale.amount_due + old_payment_amount`.

### Safe Deletion

- Products and suppliers with related purchase items or sale items are protected by foreign key constraints (`ON DELETE RESTRICT`).
- API routes catch PostgreSQL error code `23503` and return clear `409 Conflict` errors preventing record deletion when dependencies exist. Products can alternatively be deactivated (`is_active = false`).

### Zero-Storage Receipts

- Receipts are built dynamically on the client side using `jsPDF`. No binary files or PDF blobs are persisted to Supabase storage buckets, conserving free-tier storage limits.

---

## 5. Security & Authentication

- Single-user business authentication managed via Supabase GoTrue (`useAuth()` context and `auth-context.tsx`).
- Protected routes redirect unauthenticated users to `/login`.
- Server routes verify sessions or operate through `getSupabaseAdmin()` service role client for privileged database execution.
