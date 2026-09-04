# Project Context: SSG Store POS System

Developer reference document. Describes the architecture, file map, and the history of all significant changes made to this codebase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + custom CSS (globals.css) |
| State | Zustand (local persistence, offline fallback) |
| Database | Supabase — PostgreSQL, GoTrue auth |
| PDF | jsPDF (client-side, no server) |
| Icons | Lucide React |
| Package manager | pnpm |

---

## Key File Map

| File | Role |
|---|---|
| [app/orders/page.tsx](file:///d:/DBs/codes/posL/POS-Sytem/app/orders/page.tsx) | Main POS ordering screen |
| [app/inventory/page.tsx](file:///d:/DBs/codes/posL/POS-Sytem/app/inventory/page.tsx) | Product & category management |
| [app/dashboard/page.tsx](file:///d:/DBs/codes/posL/POS-Sytem/app/dashboard/page.tsx) | Analytics, quick actions, recent transactions |
| [app/bill-history/page.tsx](file:///d:/DBs/codes/posL/POS-Sytem/app/bill-history/page.tsx) | Transaction history, filters, share/export |
| [app/settings/page.tsx](file:///d:/DBs/codes/posL/POS-Sytem/app/settings/page.tsx) | Business config and invoice settings |
| [app/login/page.tsx](file:///d:/DBs/codes/posL/POS-Sytem/app/login/page.tsx) | Auth — sign in / sign up with role selection |
| [app/globals.css](file:///d:/DBs/codes/posL/POS-Sytem/app/globals.css) | Design tokens, dark/light theme, utility classes |
| [components/pos/sidebar.tsx](file:///d:/DBs/codes/posL/POS-Sytem/components/pos/sidebar.tsx) | Navigation sidebar, account switcher, role guard |
| [components/pos/order-summary.tsx](file:///d:/DBs/codes/posL/POS-Sytem/components/pos/order-summary.tsx) | Cart panel, payment method, place order |
| [components/pos/product-card.tsx](file:///d:/DBs/codes/posL/POS-Sytem/components/pos/product-card.tsx) | Product tile with quantity controls |
| [components/pos/category-card.tsx](file:///d:/DBs/codes/posL/POS-Sytem/components/pos/category-card.tsx) | Category filter chip |
| [lib/store.ts](file:///d:/DBs/codes/posL/POS-Sytem/lib/store.ts) | Zustand store — products, categories, orders, invoice settings |
| [lib/supabase.ts](file:///d:/DBs/codes/posL/POS-Sytem/lib/supabase.ts) | Supabase client + type definitions for DB tables |
| [lib/bill-service.ts](file:///d:/DBs/codes/posL/POS-Sytem/lib/bill-service.ts) | Supabase CRUD for bill_history |
| [lib/pdf-generator.ts](file:///d:/DBs/codes/posL/POS-Sytem/lib/pdf-generator.ts) | jsPDF invoice builder |
| [context/auth-context.tsx](file:///d:/DBs/codes/posL/POS-Sytem/context/auth-context.tsx) | Supabase auth session, user metadata, switchRole() |
| [hooks/use-supabase-data.ts](file:///d:/DBs/codes/posL/POS-Sytem/hooks/use-supabase-data.ts) | Data fetching hook with 5-min cache and Zustand fallback |

---

## Design System

### Color Tokens (globals.css)
- `--pos-brand` — mint green, primary CTA and active states
- `--pos-accent-blue`, `--pos-accent-purple`, `--pos-accent-pink` — secondary accents for tiles and badges
- `--pos-panel` — card/panel background (adapts light/dark)
- `--pos-panel-2` — deeper background layer
- `--pos-stroke` — border color

### Utility Classes
- `.pos-panel` — glass-card style panel (background + border + radius)
- `.tile`, `.tile-mint`, `.tile-blue`, `.tile-purple`, `.tile-pink` — coloured category tiles
- `.animate-pop` — 300ms scale pop for add-to-cart feedback

### Roles
Three roles stored in `user_metadata.role`:
- `owner` — full access to all pages
- `cashier` — orders + bill history only
- `worker` — inventory only

Role enforcement is handled in `sidebar.tsx` via `currentAllowed` paths. Auto-redirect fires in a `useEffect` when the current path is not in the allowed list.

---

## Changelog

### 1. Employee Profile Switcher & Order Attribution
- Replaced hardcoded "Table 5" label with the logged-in user's full name and role
- Active profile string (`Name (Role)`) saved to `table_number` in `bill_history` and printed on PDF under `CASHIER:`
- Conditional label handling — shows `CASHIER:` if the value doesn't contain "table", otherwise `TABLE:`

### 2. Real-Time Clock on Orders Page
- Live date + time widget next to the search bar on the orders screen
- Updates every second via `setInterval`, hydration-safe (null until client mounts)

### 3. Role-Based Access Control
- Role selection added to the sign-up form (`Owner` / `Cashier` / `Worker`)
- Sidebar filters navigation items based on role, redirects on unauthorized access
- Account switcher in the sidebar bottom — switches role in `user_metadata` without sign-out
- Three pre-configured demo accounts in the switcher: Admin (Owner), Sarah (Cashier), John (Worker)

### 4. Database Schema Fixes
- Added `payment_method` column to `bill_history`
- Widened `table_number` from `VARCHAR(20)` to `VARCHAR(100)` to fit full cashier name strings
- Confirmed RLS policies allow authenticated insert/select on all tables

### 5. Category Card Ring Clipping Fix
- Replaced `ring-2` selected state with `border-2 border-foreground p-[15px]` to avoid outline clipping from `overflow-hidden` on the parent tile

### 6. Category Deletion with Cascade
- `deleteCategory` added to Zustand store — cascades product deletion in offline mode
- Wired up in `inventory/page.tsx` with a confirmation toast before delete

### 7. Supabase Env Fallback
- Hardcoded public Supabase URL and anon key as fallback values in `lib/supabase.ts`
- Prevents crash on hosted deployments (e.g., Vercel) where env vars may not be set

### 8. Inventory Page — Slide-Over Drawer
- Add/Edit Product form moved into a right-side slide-over drawer (`fixed inset-0` + `slide-in-from-right`)
- Backdrop click closes the drawer; form resets on close
- Drawer shows category name in the header subtitle for context

### 9. Bill History — Share Modal
- Share button on each bill opens a formatted text preview modal
- Options: **Copy to Clipboard**, **WhatsApp** (deep link), **Web Share API** (mobile native)
- Summary share button for the entire filtered result set

### 10. Dashboard Improvements
- Stats cards with hidden-by-default revenue/profit (Eye toggle)
- Recent transactions feed — click any row to open a bill preview modal with download
- Low stock depletion gauge bars with per-product restock quantity input
- Role-aware Quick Actions Dock — different buttons for Owner, Cashier, Worker

### 11. Light/Dark Mode Audit
- All hardcoded colors replaced with CSS variable equivalents or `dark:` variants
- Avatar backgrounds use `--pos-brand`, `--pos-accent-purple`, `--pos-accent-blue` by role
- Inactive nav items restored with `hover:bg-foreground/[0.06] hover:text-foreground`
- Share tile icons use `text-neutral-800 dark:text-neutral-900` for contrast on pastel backgrounds
- Action buttons in inventory, bill history, and dashboard verified in both modes

### 12. Keyboard Shortcut — Place Order
- Pressing `Enter` (or `Ctrl+Enter`) on the orders page submits the order when the cart is non-empty
- Guard prevents trigger when focus is inside an input, textarea, or select
