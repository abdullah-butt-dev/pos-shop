# Perfect Traders — Point of Sale (POS) System

A fast, responsive, and robust Point of Sale system built with Next.js 14 App Router, Supabase (PostgreSQL), and Tailwind CSS. Tailored for commercial wholesale and retail counter operations.

---

## 🚀 Key Features

### 1. 📊 Dashboard (`/dashboard`)

- **Real-time Business Financials**: Key performance indicators including Sales, Purchases, **Gross Profit**, **Total Expenses** and **Net Profit** (Gross Profit − Expenses), all following the selected date range (Today / Yesterday / This Week / This Month / Custom).
- **Outstanding Balances**: Live Customer Receivables and Supplier Payables tracking.
- **Catalog Health**: Total active products count.
- **Recent Sales Audit**: View chronological customer sales with receipt number, customer, line item counts, total amount, payment status, and instant on-demand PDF receipt downloads.

### 2. 🛒 New Sale (`/orders`)

- **Fast-Paced Register Interface**: Clean grid view of active inventory with responsive layout and live stock indicators.
- **Customer Search & Creation**: Autocomplete lookup for existing customers with inline instant customer addition.
- **Previous Balance**: As soon as a customer is selected, the cart shows their outstanding balance from earlier credit/partial sales.
- **Discount & Delivery Charges**: Optional inputs in the cart. Discount reduces the sale, delivery charge is added to it. The discount can never exceed the sale amount.
- **Bill Breakdown**: Cart and printed bill show, in order: Previous Balance → Subtotal → Discount → Delivery Charges → **Grand Total** (previous balance + this sale), followed by Paid and Balance Due.
- **Flexible Payment Handling**:
  - **Paid**: Full payment collected upfront.
  - **Credit**: Zero payment collected upfront; balance added to customer receivables.
  - **Partial**: Split payment; specify cash collected with remaining balance added to customer receivables.
  - The amount paid at checkout settles *this* sale. Old balances are collected from the Receivables page.
- **On-the-Fly PDF Receipts**: Direct client-side receipt generation and download using `jsPDF` without storing files or consuming database storage quotas. Reprinting an older bill from the Dashboard or Bill History uses the values saved with that sale.

### 3. 📦 Purchases (`/purchases`)

- **Dedicated Purchase Entry**: Tabbed interface to record incoming purchase invoices from suppliers.
- **Supplier Autocomplete**: Instant lookup and on-the-fly supplier creation.
- **Itemized Costs**: Multi-line item entry specifying product, quantity, and unit cost.
- **Payment Terms**: Paid, Credit (unpaid), or Partial disbursement with automatic balance calculation.
- **Recent Purchases Log**: Expandable history showing line items, pricing, payment status, and outstanding balances.

### 4. 🏷️ Products & Suppliers Catalog (`/inventory`)

- **Product Catalog**: Manage product names, units of measure, and active status with live on-hand stock quantities.
- **Supplier Directory**: Manage supplier profiles, contact numbers, addresses, and notes.
- **Safe Deletion Guards**: Foreign key protections prevent accidental deletion of products or suppliers with linked transaction history.

### 5. 💳 Payables (`/payables`)

- **Supplier Debt Tracking**: Monitor total outstanding supplier balances across all open purchases.
- **Record Disbursements**: Log partial or full payments against specific supplier purchases.
- **Payment Audit**: Track historical disbursements with payment method and date.

### 6. 👥 Receivables (`/receivables`)

- **Customer Credit Management**: Comprehensive overview of outstanding credit owed by customers.
- **Cash Collections**: Record customer payments against open sales invoices with built-in overpayment prevention.
- **Payment Management**: View and edit collection records with real-time recalculation of remaining customer balances.

### 7. 💸 Expenses (`/expenses`)

- **Record Expenses**: Log each business expense with a **category** (quick-pick Rent, Food / Meals, Salaries, Electricity, Transport, Delivery, Maintenance, Other — or any custom text), **amount**, **date** and optional note.
- **Monthly Tracking**: Switch months with the arrows or month picker; see the month total, number of entries, biggest category and a per-category breakdown.
- **Edit & Delete**: Fix a mistake or remove an entry; the dashboard updates accordingly.
- **Feeds the Dashboard**: Expenses in the selected date range are subtracted from Gross Profit to give Net Profit.

### 8. ⚙️ Settings (`/settings`)

- **Shop Identity & Invoicing**: Configure Shop Name, Currency symbol, Business Address, Phone Number, and Invoice Prefix.
- **Tax Configuration**: Set system-wide tax percentage.
- **Account Security**: Update account password via Supabase Auth.

---

## 🏗️ Architectural Foundations

- **Single Source of Truth**: Financial totals, stock balances, and payment statuses are calculated and maintained directly at the database layer using PostgreSQL triggers and functions:
  - `pos_adjust_inventory`: Adjusts stock and logs inventory movements on purchase and sale events.
  - `pos_recalc_sale` & `pos_recalc_purchase`: Automatically compute line totals, amounts paid, amounts due, and payment statuses (`paid`, `partial`, `credit`/`unpaid`). A sale's `total_amount` = items − `discount_amount` + `delivery_charge`.
  - `pos_create_sale_v2` & `pos_create_purchase`: Atomic stored procedures enforcing stock availability and FIFO cost allocation. `pos_create_sale_v2` also stores the discount, delivery charge and a snapshot of the customer's previous balance. The original `pos_create_sale` is kept for backward compatibility.
- **Revenue Recognition Rule**: Revenue and profit are recognized immediately on the original sale date (regardless of whether paid in cash, partial, or on credit). Customer payments are cash collections only; they reduce receivables and are reported as Cash Inflow, never double-counted as revenue or profit.
- **Profit Rules**: Revenue = sale total after discount, including delivery charges. **Gross Profit** = revenue − FIFO cost of goods sold. **Net Profit** = Gross Profit − Expenses. Previous balance is never counted as revenue (it was already counted when that earlier sale was made).
- **Database Tables** (all prefixed `pos_`): products, suppliers, customers, purchases, purchase_items, inventory, inventory_movements, supplier_payments, sales, sale_items, sale_cost_allocations, customer_payments, business_settings, **expenses**.
- **Zero Storage Bucket Consumption**: Receipts are generated client-side on demand using `jsPDF`. No binary files are stored in Supabase storage buckets, keeping storage usage within free-tier limits.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database & Auth**: Supabase (PostgreSQL 15+, GoTrue Auth)
- **Styling**: Tailwind CSS & Lucide Icons
- **UI Components**: Radix UI / Shadcn primitives
- **Client PDF Generation**: `jsPDF`

---

## 🏁 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or pnpm
- A Supabase project

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd pos-shop
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Set Up the Database

**New project (empty database):** run `schema.sql` in the Supabase SQL Editor. It already includes everything below.

**Existing project with live data (upgrading):** do **not** re-run `schema.sql`. Run only the migration:

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `migration-001-expenses-discounts.sql` and click **Run**.
3. Do this **before** deploying or starting the updated app.

The migration is additive and safe to re-run: it adds three columns to `pos_sales` (discount, delivery charge, previous balance — all default to 0, so every existing sale stays identical), creates the `pos_expenses` table, replaces `pos_recalc_sale` (same results when discount and delivery are 0) and adds `pos_create_sale_v2`. It does not drop, delete or rewrite any existing data. Existing bills reprint with Discount / Delivery / Previous Balance at Rs 0.

Optional check: `SELECT count(*), sum(total_amount) FROM pos_sales;` before and after — the numbers must match.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Compiles and builds the production application.
- `npm run start`: Runs the production build.
- `npm run lint`: Checks for linting errors.

---

## 📁 Database Files

- `schema.sql`: Full schema for a **fresh** database (includes migration 001).
- `migration-001-expenses-discounts.sql`: Upgrade script for an **existing** database — expenses, discounts, delivery charges, previous balance.
- `run-in-supabase.sql`: Earlier patch for the delete functions.
