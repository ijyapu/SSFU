@AGENTS.md

# SSFU ERP — Claude Project Guide

## Project Overview
Enterprise Resource Planning system for **Shanti Special Food Udhyog Pvt. Ltd.** (Nepal).
Internal tool — not a public product. All users require admin approval after sign-in.
Codebase is derived from the SSFI ERP; all business logic is intentionally identical unless noted otherwise.

## Tech Stack
| Layer | Library | Version |
|-------|---------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| UI | shadcn/ui + Tailwind CSS | v4 |
| Auth | Clerk | v7 |
| Database | PostgreSQL via Supabase | — |
| ORM | Prisma | v5 |
| Storage | Supabase Storage (proof photos) | — |
| Email | Resend (optional — disabled when env vars absent) | v6 |
| Forms | react-hook-form + zod v4 | — |
| Toast | sonner | — |
| Charts | recharts | — |

## Key Architecture Rules
- **App Router only** — no Pages Router. All routes under `src/app/`.
- **Server Actions** — mutations use `"use server"` actions, never API routes for internal data.
- **Soft deletes** — records are never hard-deleted. Use `deletedAt: new Date()` and filter `deletedAt: null` in queries.
- **Role-based access** — roles stored in Clerk `publicMetadata.role`. Values: `superadmin`, `admin`, `manager`, `accountant`, `employee`. Check with `useRole()` hook or `currentUser()` in server actions.
- **Auth flow** — sign-in → `/auth-callback` → role check → redirect. Pending users see a waiting screen.
- **No Sentry** — error tracking is not configured. `instrumentation.ts` logs to console only.

## Module Structure
```
src/app/(dashboard)/
  dashboard/        # Overview cards + revenue chart
  inventory/        # Products, stock levels, reorder, adjustments
  daily-log/        # Daily production log (open/close/reopen)
  purchases/        # Purchase orders + invoices + supplier payments
  vendors/          # Vendor profiles + payable ledger
  sales/            # Sales orders + customer payments + returns
  salesmen/         # Salesman ledger + commission tracking
  expenses/         # Expense tracking
  employees/        # Employee profiles + salary withdrawals
  payroll/          # Payroll runs + deduction dialogs
  receipts/         # Receipts received + payments out
  cash-flow/        # Cash position tracking
  profit-loss/      # P&L statement
  costing/          # Product margin analysis + recipes
  reports/          # Aging, stock valuation, receivables, payables, analytics
  settings/         # Users, categories, units, audit log, access requests
```

## Costing Logic
- Uses **latest purchase price** — no weighted average.
- `recalcProductCostFromRecipe()` in `src/lib/recipe-cost.ts`:
  - `ingredientCost = Σ(qty × ingredient.costPrice)`
  - `costPerUnit = (ingredientCost + overheadCost) ÷ yieldQty`
- `deductionPct` on Recipe is a profitability-preview field only — never used in costPrice.
- When a purchase is received, ingredient `costPrice` updates, then cascades to all recipes using that ingredient.

## Database Conventions
- All monetary values: `Decimal @db.Decimal(10, 2)` — convert with `Number()` before use in JS.
- All quantity values: `Decimal @db.Decimal(10, 3)`.
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `deletedAt DateTime?`.
- IDs: `@id @default(cuid())`.
- Stock is tracked via `StockMovement` records — never update `currentStock` directly, always use `applyStockMovement()` from `src/lib/stock.ts`.

## Reusable Patterns

### Sorting
Every data table uses the same sorting pattern:
```tsx
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { SortButton } from "@/components/ui/sort-icon";

const { sortKey, sortDir, toggle } = useSortable("defaultColumn");
const sorted = useMemo(() => [...rows].sort((a, b) =>
  compareValues(a[sortKey], b[sortKey], sortDir)
), [rows, sortKey, sortDir]);
```

### Numeric Table Columns
`TableHead` and `TableCell` accept a `numeric` boolean prop that applies `text-right tabular-nums`:
```tsx
<TableHead numeric>Total (Rs)</TableHead>
<TableCell numeric>{amount.toFixed(2)}</TableCell>
```

### Forms
- Validators live in `src/lib/validators/` — one file per domain.
- Uses `zod` v4 (`import { z } from "zod/v4"` in client components, `import { z } from "zod"` in server actions).
- Number inputs must use `value={field.value === 0 ? "" : field.value}` to prevent "078" prefix bug.

## Environment Variables (`.env.local`)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL          # pooled (runtime)
DIRECT_URL            # direct (migrations only)
RESEND_API_KEY        # optional
RESEND_FROM_EMAIL     # optional — email disabled if absent
ADMIN_EMAIL           # optional — admin alerts disabled if absent
NEXT_PUBLIC_APP_URL
CLERK_WEBHOOK_SECRET
```

## Common Commands
```bash
npm run dev           # start dev server
npm run build         # prisma generate + next build
npm run db:migrate    # run migrations (uses DIRECT_URL)
npm run db:studio     # open Prisma Studio
npm run db:seed       # seed database
```

## Known Gotchas
- **Clerk v5+**: `afterSignInUrl` / `afterSignUpUrl` props removed from `<ClerkProvider>` — use `forceRedirectUrl` on `<SignIn>` instead.
- **Zod v4**: error messages use `error:` not `message:` in schema definitions.
- **Decimal fields**: always wrap Prisma Decimal values with `Number()` before arithmetic or display.
- **`useMemo` in maps**: not allowed — extract sort/filter logic to a plain function above the render.
- **`toggle` naming**: `useSortable` exports `toggle` — rename if the component already uses that identifier.
- **Salesman model**: mapped to `"Customer"` table in the DB (`@@map("Customer")`) — historical artifact, do not rename.
- **Email silent-fail**: all four email functions return silently if `RESEND_API_KEY` or `RESEND_FROM_EMAIL` env vars are not set.
- **Logo placeholder**: `public/ssfu-logo.svg` is a placeholder — replace with real SSFU logo before production.
- **Company details placeholder**: `src/lib/company.ts` fields (address, phone, PAN, owner, established) are TBD — confirm before deployment.
