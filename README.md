# Perfect Traders — Point of Sale (POS) System

A fast, responsive, and robust Point of Sale system built with Next.js 14 App Router, Supabase (PostgreSQL), and Tailwind CSS. Tailored for commercial wholesale and retail counter operations.

---

## 🚀 Key Features

### 1. 📊 Dashboard (`/dashboard`)

- **Real-time Business Financials**: Key performance indicators including Total Sales Revenue, Estimated Profit, Cash Inflow (customer collections), and Cash Outflow (supplier disbursements).
- **Outstanding Balances**: Live Customer Receivables and Supplier Payables tracking.
- **Catalog Health**: Total active products count.
- **Recent Sales Audit**: View chronological customer sales with receipt number, customer, line item counts, total amount, payment status, and instant on-demand PDF receipt downloads.

### 2. 🛒 New Sale (`/orders`)

- **Fast-Paced Register Interface**: Clean grid view of active inventory with responsive layout and live stock indicators.
- **Customer Search & Creation**: Autocomplete lookup for existing customers with inline instant customer addition.
- **Flexible Payment Handling**:
  - **Paid**: Full payment collected upfront.
  - **Credit**: Zero payment collected upfront; balance added to customer receivables.
  - **Partial**: Split payment; specify cash collected with remaining balance added to customer receivables.
- **On-the-Fly PDF Receipts**: Direct client-side receipt generation and download using `jsPDF` without storing files or consuming database storage quotas.

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

### 7. ⚙️ Settings (`/settings`)

- **Shop Identity & Invoicing**: Configure Shop Name, Currency symbol, Business Address, Phone Number, and Invoice Prefix.
- **Tax Configuration**: Set system-wide tax percentage.
- **Account Security**: Update account password via Supabase Auth.

---

## 🏗️ Architectural Foundations

- **Single Source of Truth**: Financial totals, stock balances, and payment statuses are calculated and maintained directly at the database layer using PostgreSQL triggers and functions:
  - `pos_adjust_inventory`: Adjusts stock and logs inventory movements on purchase and sale events.
  - `pos_recalc_sale` & `pos_recalc_purchase`: Automatically compute line totals, amounts paid, amounts due, and payment statuses (`paid`, `partial`, `credit`/`unpaid`).
  - `pos_create_sale` & `pos_create_purchase`: Atomic stored procedures enforcing stock availability and FIFO cost allocation.
- **Revenue Recognition Rule**: Revenue and profit are recognized immediately on the original sale date (regardless of whether paid in cash, partial, or on credit). Customer payments are cash collections only; they reduce receivables and are reported as Cash Inflow, never double-counted as revenue or profit.
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

### 3. Deploy Database Schema

Execute `schema.sql` in your Supabase SQL Editor:

1. Open the Supabase dashboard and navigate to **SQL Editor**.
2. Copy and paste the contents of `schema.sql`.
3. Run the query to create tables, triggers, indexes, and initial settings.

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
