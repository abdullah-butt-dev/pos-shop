# SSG Store — POS System

> A fast, modern Point of Sale system built for real businesses. Handles orders, inventory, billing, and analytics — all in one clean interface.

Built with **Next.js 15**, **Supabase**, and **Tailwind CSS v4**. Designed for tablets, desktop counters, and busy retail environments.

---

## Features

### Orders & Checkout
- Product grid with category filtering and live search (debounced, 300ms)
- **Retail / Wholesale** price mode toggle — switch mid-session, prices update instantly
- Cart with per-item quantity controls and stock limit enforcement
- Payment method selection: **Cash**, **Online (UPI/QR)**, **Credit**
- Place order with **Enter key** shortcut for fast cashier workflows
- Auto-generates and downloads a branded PDF invoice on checkout
- Real-time clock widget on the orders screen

### Inventory Management
- Slide-over drawer for adding or editing products — no page leave required
- Per-category product listing with instant search
- Low stock alerts with visual pulse indicators and badge tags
- Stock quantity tracking with configurable per-product thresholds
- Add / delete categories with cascade product cleanup
- Full Supabase sync with Zustand offline fallback

### Bill History
- Full searchable transaction history pulled from Supabase
- Filter by **type** (Retail / Wholesale) and **date range** (Today / Week / Month)
- Stats bar: total bills, retail revenue, wholesale revenue, grand total
- Per-bill actions: **View**, **Share**, **Download PDF**
- **Share modal** with Copy Text, WhatsApp, and native Web Share options
- Bill summary sharing with formatted receipt text

### Dashboard & Analytics
- Revenue, profit, orders count, and low-stock alerts at a glance
- Hidden-by-default revenue/profit cards (toggle to reveal)
- Product sales share chart with horizontal progress bars
- Recent transactions timeline with clickable bill preview
- Low stock depletion gauges with one-click restock inputs
- **Role-aware Quick Actions Dock** — different shortcuts for Owner, Cashier, and Worker

### Role-Based Access Control
- Three roles: **Owner** (full access), **Cashier** (orders + history), **Worker** (inventory only)
- Role stored in Supabase `user_metadata`, enforced client-side with auto-redirect
- Account switcher in sidebar — switch between roles without signing out
- Role-aware page visibility in the navigation sidebar

### Settings & Customization
- Business name, address, GST/tax number
- Configurable tax rate
- Invoice header and footer text
- Paper size: A4 or 58mm thermal receipt
- Settings persisted locally via Zustand

### Design System
- **Light and dark mode** with a mint-green brand palette and themed accent colors
- Consistent `pos-panel` glass-card system across all pages
- Smooth micro-animations: page transitions, hover lifts, button press feedback
- Minimal adaptive scrollbars that match the current theme
- Accessible focus rings, ARIA labels, and keyboard navigation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, Vanilla CSS animations |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase GoTrue |
| State | Zustand (local persistence + offline fallback) |
| PDF | jsPDF (client-side, no server needed) |
| Icons | Lucide React |
| Date utils | date-fns |
| Package manager | pnpm |

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- A Supabase project

### 1. Clone & install

```bash
git clone https://github.com/DivineDB/POS-Sytem.git
cd POS-Sytem
pnpm install
```

### 2. Set environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set up the database

Run `complete-fresh-setup.sql` in your Supabase SQL editor. This creates:
- `categories` table
- `products` table with stock and order tracking
- `bill_history` table with full line items
- RLS policies and helper functions

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

---

## Database Schema

```
categories        id, name, color
products          id, name, category, retail_price, wholesale_price, stock, low_stock_threshold, order_count
bill_history      id, bill_number, table_number, type, payment_method, items (jsonb), subtotal, tax, total, created_at
```

---

## Payment Methods

| Method | Use case |
|---|---|
| 💰 Cash | Physical currency |
| 📱 Online | UPI, QR code, card machine |
| 💳 Credit | Credit sales / account-based billing |

---

## Project Structure

```
app/
  login/          Auth screen (sign in / sign up with role selection)
  orders/         Main POS screen
  inventory/      Product and category management
  bill-history/   Transaction history and export
  dashboard/      Analytics and quick operations
  settings/       Business config and invoice settings

components/
  pos/            Sidebar, ProductCard, CategoryCard, OrderSummary, SearchBar
  inventory/      ProductForm
  ui/             Shared primitives (PageTransition, LoadingSkeleton, etc.)

lib/
  store.ts        Zustand store
  supabase.ts     Supabase client + type definitions
  bill-service.ts Supabase bill CRUD
  pdf-generator.ts jsPDF invoice builder

context/
  auth-context.tsx  Auth state, role management, switchRole()
```

---

## License

MIT — free to use, modify, and deploy.

---

*Built by Divyansh Baghel · 2026*
# pos-shop
