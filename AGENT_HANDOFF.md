# SNAP Customer Care Portal — Agent Handoff Document
*Last updated: 2026-05-07 | Current version: v2.13*

---

## 1. Project Overview

**What it is:** An internal operations portal for SNAP's customer care team. It is not customer-facing. Staff use it daily in the office to manage fault cases, customer returns, refund requests, stock room inventory, team replenishment orders, and roster/shift scheduling.

**Primary user:** Anthony (admin/owner) and a small team of customer care agents (staff role).

**Key workflows:**

| Workflow | Description |
|---|---|
| Fault Cases | Log and track product fault reports linked to manufacturer warranty claims. Evidence uploads go to Google Drive. Cases feed a claims tracking flow (submit → credit received → partial/rejected). |
| Returns | Two-stage: team logs a *return request* (customer says they're sending something back), Anthony processes it in the office when the parcel arrives. Auto-matches requests by order number, auto-fills items. |
| Refund Requests | Team raises refunds for approval. Status: Pending → Approved/Declined. Cross-linked to returns by order number. |
| Stock Room | Track in-house office stock (not 3PL). Receive/dispatch movements with reason codes. Stocktake mode for counting. |
| Replenishment | Manage stock orders from office to stores. Status: Pending → Packed → Dispatched → Delivered. |
| Roster | Weekly shift schedule for agents. Public holiday coverage warnings (AU + PH). Leave log and leave payout tracking. |
| Team Performance | Agent-level stats pulled from Commslayer (replies, resolution time, CSAT). Day/week/month views. |
| Dashboard | Admin sees KPI cards (faults, returns, refunds, cost), Commslayer today's activity card, AI briefing, replenishment alerts, today's team strip, weekly trend chart. |

**Two roles:**
- `admin` — full access to everything
- `staff` — access to cases, returns (request only), refunds, orders, roster, SOP; **blocked from** `/stock`, `/replenishment`, `/corporate`, `/reports`, `/admin`

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 18, TypeScript 5 |
| Styling | Tailwind CSS 3 + custom CSS component classes in `app/globals.css` |
| Database (primary) | **Supabase** (PostgreSQL) — used for returns, refunds, stock, replenishment, roster, promotions, auth |
| Database (legacy) | **Google Sheets** — still used for fault cases, products, manufacturers, fault types, claims |
| Auth | Custom JWT sessions (`jose`), bcrypt password hashing, httpOnly cookie `snap_session` |
| AI | Anthropic SDK (`claude-haiku-4-5-20251001`) — dashboard AI briefing card |
| File uploads | Google Drive API — fault case evidence |
| Customer support | Commslayer API (`reports:read` scope only) — performance page + today's activity |
| Package manager | npm |
| Deployment | Vercel (auto-deploy on push to `main`) |
| Repo | GitHub: `anthonynguyen-snap/fault-portal` |
| Icons | `lucide-react@0.383.0` |
| Charts | `recharts` (lazy-loaded on dashboard) |

---

## 3. How to Run Locally

### Install
```bash
cd fault-portal
npm install
```

### Dev server
```bash
npm run dev   # starts at http://localhost:3000
```

### TypeScript check (no separate build step needed for checking)
```bash
npx tsc --noEmit
```

### Build (for production testing)
```bash
npm run build && npm start
```

### Required environment variables

Copy `.env.local.example` to `.env.local`. All values are already set in the checked-in `.env.local` (this repo has `.env.local` committed — unusual but intentional for this private internal project).

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `SESSION_SECRET` | JWT signing secret — must be set or server throws on startup |
| `GOOGLE_PROJECT_ID` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY_ID` / `GOOGLE_CLIENT_ID` | Google service account for Sheets + Drive |
| `GOOGLE_SPREADSHEET_ID` | Google Sheet used for fault cases, products, manufacturers, claims |
| `COMMSLAYER_BASE_URL` / `COMMSLAYER_ACCOUNT_ID` / `COMMSLAYER_API_TOKEN` | Commslayer integration (performance + today's activity) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (used for redirects) |
| `PORTAL_PASSWORD` | Legacy simple password (still used somewhere — check before removing) |

**Commslayer token scope:** The current token only has `reports:read`. Adding `conversations:read` in Commslayer Settings → API Tokens would enable live queue data (open/unassigned tickets).

### Login credentials (dev/prod — shared database)
Create accounts via Admin → Password Management panel, or query `roster_agents` in Supabase directly. There is no seed script. The session expires at midnight AEST each day (forces clock-in on login).

---

## 4. Repo Structure

```
fault-portal/
├── app/
│   ├── page.tsx                  ← THE real dashboard (route: /)
│   ├── layout.tsx                ← Root layout: sidebar + header + auth
│   ├── globals.css               ← All component utility classes (card, btn-*, form-*, badge, etc.)
│   ├── login/page.tsx
│   ├── cases/                    ← Fault cases list, new case form, case detail
│   ├── claims/page.tsx           ← Manufacturer claims tracking
│   ├── returns/
│   │   ├── page.tsx              ← Returns list (Requested + Processed tabs)
│   │   ├── new/page.tsx          ← Log a processed return (Anthony only)
│   │   └── [id]/page.tsx         ← Return detail/edit
│   ├── refunds/page.tsx
│   ├── stock/page.tsx            ← Stock room + Stocktake mode
│   ├── replenishment/
│   │   ├── page.tsx              ← Replenishment list
│   │   └── [id]/page.tsx         ← Replenishment detail
│   ├── performance/page.tsx      ← Team performance (Commslayer)
│   ├── roster/
│   │   ├── page.tsx
│   │   └── leave/page.tsx
│   ├── orders/page.tsx
│   ├── corporate/                ← Corporate orders + retail customer module
│   ├── promotions/page.tsx
│   ├── admin/page.tsx            ← Staff, products, manufacturers, fault types, KPI config, changelog
│   ├── sop/page.tsx              ← Standard operating procedures
│   ├── reports/page.tsx
│   ├── account/password/page.tsx ← Change own password
│   ├── dashboard/page.tsx        ← SECONDARY dashboard (not the main one — uses DashboardView component, barely used)
│   └── api/
│       ├── auth/                 ← login, logout, me, set-password, change-password
│       ├── cases/                ← CRUD + notes (Google Sheets backend)
│       ├── returns/              ← CRUD + notes + alerts (Supabase)
│       ├── refunds/              ← CRUD + notes + alerts (Supabase)
│       ├── stock/                ← items CRUD + movements (Supabase)
│       ├── replenishment/        ← CRUD + alerts + dispatch (Supabase)
│       ├── roster/               ← agents, leave, overrides, config, ph-coverage (Supabase)
│       ├── performance/          ← Commslayer agent stats
│       ├── commslayer/queue/     ← Commslayer today's activity (reports/overview)
│       ├── dashboard/            ← Aggregated stats (Google Sheets, cached 60s)
│       ├── ai/summary/           ← Anthropic AI briefing
│       ├── products/ manufacturers/ fault-types/ claims/ promotions/ orders/
│       └── search/               ← Global search
├── components/
│   ├── auth/AuthProvider.tsx     ← useAuth() hook, wraps app
│   ├── layout/
│   │   ├── Sidebar.tsx           ← Nav links, alert badges, role-based visibility
│   │   ├── Header.tsx            ← Search bar, notifications
│   │   └── SidebarContext.tsx    ← Mobile drawer state
│   ├── dashboard/
│   │   ├── DashboardCharts.tsx   ← WeeklyFaultChart (lazy-loaded)
│   │   └── DashboardView.tsx     ← Secondary dashboard component (NOT the main one)
│   └── ui/
│       ├── InternalNotes.tsx     ← Shared internal notes component (cases, returns, refunds)
│       ├── Skeleton.tsx          ← Loading skeletons (TableSkeleton, DashboardSkeleton, etc.)
│       ├── WhatsNewModal.tsx     ← "What's New" modal shown on login
│       ├── EmptyState.tsx
│       └── Toast.tsx
├── lib/
│   ├── auth.ts                   ← JWT session create/verify/clear
│   ├── supabase.ts               ← Supabase client singleton
│   ├── google-sheets.ts          ← All Google Sheets read/write (cases, products, manufacturers, claims)
│   ├── google-drive.ts           ← Evidence file uploads
│   ├── cache.ts                  ← In-memory TTL cache (used by dashboard API)
│   ├── changelog.ts              ← Version history (ALWAYS update when shipping features)
│   ├── sop.ts                    ← SOP content (static, edit to update procedures)
│   ├── activity.ts               ← Activity log helper
│   ├── utils.ts                  ← Shared date helpers, formatCurrency, STATUS_STYLES, etc.
│   ├── au-holidays.ts            ← Australian public holidays
│   └── ph-holidays.ts            ← Philippine public holidays
├── middleware.ts                 ← Auth gate + role enforcement for all routes
├── types/index.ts                ← ALL shared TypeScript types (single source of truth)
├── tailwind.config.ts            ← Brand colours (baby blue `brand-*` palette)
└── supabase/
    └── replenishment_migration.sql  ← Reference SQL (run manually in Supabase dashboard)
```

**Important: `app/dashboard/page.tsx` is NOT the main dashboard.** The real dashboard is `app/page.tsx` (route `/`). The `dashboard` route uses `DashboardView.tsx` and appears to be an older/alternate view. Don't confuse them.

---

## 5. Current State

### Complete and working
- Fault Cases (Google Sheets backend) — full CRUD, evidence upload, claim linking
- Claims tracking — status workflow, outcome recording, recovery stats
- Returns — two-stage (request → processed), auto-match by order number, auto-populate items, fee deductions (label fee / restocking %), internal notes
- Refund Requests — full CRUD, internal notes, cross-link to returns
- Stock Room — inventory, receive/dispatch movements, Stocktake Mode (v2.13)
- Replenishment — order creation, item management, status workflow, dispatch tracking
- Roster — weekly schedule, leave log, leave payout, PH coverage alerts, drag overrides
- Team Performance — Commslayer agent stats, day/week/month view, charts
- Dashboard — KPIs, today's activity (Commslayer), AI briefing (Anthropic), team strip, fault chart, replenishment alerts
- Auth — JWT sessions, role-based access (admin/staff), password management, shift clock-in on login
- Admin panel — staff, products, manufacturers, fault types, KPI targets, changelog viewer
- SOP page — static content in `lib/sop.ts`
- Sidebar alert badges — returns (overdue), refunds (pending count), replenishment (pending count)
- Global search (Header)
- Internal notes (cases, returns, refunds)
- "What's New" modal on login keyed to latest changelog version

### Partially complete / deferred
- **`app/dashboard/page.tsx`** — secondary dashboard using `DashboardView.tsx`. Currently accessible but not linked in sidebar. Likely vestigial from an earlier design. Could be removed.
- **Commslayer live queue (open/unassigned tickets)** — the token only has `reports:read`. To get open ticket counts, add `conversations:read` scope in Commslayer Settings → API Tokens, then update `/api/commslayer/queue/route.ts`.
- **Corporate module** (`/corporate`) — exists with orders and retail customer pages. Appears functional but limited. Not reviewed thoroughly.
- **Orders page** (`/orders`) — exists, not audited recently.

### Known issues / broken
- **Git lock files** — `.git/HEAD.lock` and `.git/index.lock` cannot be deleted via the shell due to macOS filesystem permissions on the mount. All commits must use the `GIT_INDEX_FILE` workaround (see Section 11).
- **`app/new/page.tsx` and `app/log/page.tsx`** — appear to be legacy pages that may redirect or overlap with current routes. Haven't been audited.
- **No automated tests** — zero test files. All QA is manual.
- **In-memory cache** — `lib/cache.ts` uses module-level state. This works across warm Vercel invocations but resets on cold starts, and different serverless instances don't share cache. Not a bug per se but something to be aware of.

---

## 6. Recent Changes (last session, 2026-05-07)

| Feature | Files touched |
|---|---|
| Returns: auto-deduct label fee ($9.50) and restocking % from gross refund; live breakdown UI | `app/returns/new/page.tsx`, `app/returns/[id]/page.tsx` |
| Returns: success screen after logging with "Log Another" / "View Returns" | `app/returns/new/page.tsx` |
| Returns: auto-populate items from matched request; deletable pre-filled items | `app/returns/new/page.tsx` |
| Replenishment: expandable inline item row (replaced tooltip); inline status changer via badge click | `app/replenishment/page.tsx` |
| Dashboard: Today's Activity card (Commslayer) added to `app/page.tsx` | `app/page.tsx`, `app/api/commslayer/queue/route.ts` |
| Stock Room: Stocktake Mode (keyboard counting, progress, variance, print checklist, save all) | `app/stock/page.tsx` |
| Changelog updated to v2.13 | `lib/changelog.ts` |

---

## 7. Known Issues & Limitations

1. **Dual dashboard confusion.** `app/page.tsx` is the real dashboard. `app/dashboard/page.tsx` / `components/dashboard/DashboardView.tsx` are secondary and mostly redundant. Easy to accidentally edit the wrong file.

2. **Google Sheets as a database.** Fault cases, products, manufacturers, fault types, and claims all live in a Google Sheet (`GOOGLE_SPREADSHEET_ID`). This means no transactions, no foreign keys, and row order matters. The `rowToCase` / `fromRow` functions in `lib/google-sheets.ts` are brittle — if column ordering in the sheet changes, data maps incorrectly. Columns extend to `O` for cases (internal notes stored as JSON in column 15).

3. **No tests.** If you break something, you'll only know from manual testing or a user complaint.

4. **Session expires at midnight AEST.** This is intentional (shift-based). Users must re-login each day. If you're testing across midnight, sessions will silently expire.

5. **Commslayer `reports:read` scope only.** The `/api/commslayer/queue` route gets today's aggregate stats. Live conversation data (open/unassigned queue size) requires `conversations:read` to be added to the API token in Commslayer settings.

6. **`restockingPct` in returns.** The new `restockingPct` field on `LineItem` (form state) is local only — it is NOT saved to the database. Only the calculated net `refundAmount` is persisted. On the edit form (`app/returns/[id]/page.tsx`), the gross amount displayed is whatever was saved (which may already be net), not the original gross. This can lead to double-deduction if you edit and re-enter a percentage — the user needs to be aware of this.

7. **`components/Dashboard.tsx` and `components/FaultDetailModal.tsx`** — legacy top-level components that appear to be from the original version. They may still be referenced somewhere. Don't delete without checking.

8. **`import-data.mjs` and `import-old-data.mjs`** — one-shot migration scripts at the repo root. Historical, not needed for ongoing work.

---

## 8. Testing

**No automated tests exist.**

### Manual QA steps
- `npx tsc --noEmit` — run before every commit. This codebase compiles cleanly; any TypeScript errors mean something is broken.
- Log in as admin and staff to verify role-based page restrictions work.
- For returns flow: log a return request as staff → log a processed return as Anthony (match by order number, verify auto-fill).
- For stocktake: enter Stocktake Mode, type a count, verify variance column, save and check movement history shows "Stocktake Adjustment".

### Build check
```bash
npm run build
```
This validates Next.js compilation. Run it if you've made any significant structural changes.

---

## 9. Design & Product Notes

### Styling system
All reusable class utilities are defined in `app/globals.css` under `@layer components`. **Do not use inline Tailwind for things like buttons, cards, form inputs, badges — use the utility classes:**

| Class | Usage |
|---|---|
| `.card` | White rounded container with shadow |
| `.btn-primary` | Brand-coloured CTA button |
| `.btn-secondary` | White/grey secondary button |
| `.btn-ghost` | Invisible button, hover shows bg |
| `.btn-danger` | Red destructive button |
| `.form-input` | Text inputs, selects, textareas |
| `.form-label` | Label above input |
| `.badge` | Small coloured pill |
| `.page-title` / `.page-subtitle` | Page header text |
| `.page-header` | Flex row for title + actions |
| `.data-table` | Table with sticky headers and zebra rows |

### Brand colour
Baby blue palette defined as `brand-*` in `tailwind.config.ts` and as CSS variables in `globals.css`. Primary interactive colour is `brand-600` (`#1591b3`). **Do not use `blue-*` from Tailwind — use `brand-*`.**

### UX conventions
- **Never use bullet points in toast/error messages** — use plain sentences.
- **Skeleton loading** — use `<TableSkeleton>` / `<DashboardSkeleton>` from `components/ui/Skeleton.tsx` for loading states, not spinners alone.
- **Internal notes** — reusable `<InternalNotes>` component. Add to any new detail pages.
- **Slide-overs** — panels/drawers use the local `SlideOver` pattern (fixed right panel with overlay). See `app/stock/page.tsx` for reference.
- **Confirmation for destructive actions** — use `window.confirm()` (yes, the native browser one — consistent with existing patterns).
- **Alert badges on sidebar** — `Sidebar.tsx` polls alert API routes every 30s. If adding a new module with alerts, follow the `ReturnAlertBadge` pattern.
- **Changelog** — ALWAYS update `lib/changelog.ts` when shipping a feature. Add a new version entry at the top, set `isLatest: true`, set `isLatest: false` on the previous entry.

### Date/time
The business operates on **ACST (UTC+9:30, Adelaide)**. `lib/utils.ts` has shared date helpers. The Commslayer queue route uses `Australia/Adelaide` timezone. The auth session expires at midnight AEST (UTC+10 — note: slightly different from ACST).

---

## 10. Next Recommended Work

**Prioritised:**

1. **Commslayer live queue data** — add `conversations:read` to the API token in Commslayer settings, then update `/api/commslayer/queue/route.ts` to also return open ticket count and unassigned count. Dashboard card is already structured to show this if data is present.

2. **Returns: double-deduction bug on edit** — the edit form (`app/returns/[id]/page.tsx`) shows the saved net amount in the gross field. If a user re-enters a restocking percentage, it will deduct again from an already-net amount. Consider either storing gross separately in the DB, or showing a read-only net display on edit without allowing re-calculation.

3. **Migrate fault cases from Google Sheets to Supabase** — the Google Sheets backend is the biggest source of fragility. Products, manufacturers, fault types, cases, and claims should all move to Supabase tables. This is a significant effort but would enable proper querying, transactions, and foreign keys.

4. **`app/dashboard/page.tsx` cleanup** — either remove it or make it redirect to `/`. Having two dashboard files is a maintenance trap.

5. **Staff return request form** — staff can log return *requests* but there doesn't appear to be a clearly defined form for this separate from Anthony's processing form. Audit `/returns/new` and its "Anthony only" warning banner.

6. **Resolution rate on dashboard** — the Today's Activity card (created vs closed) was noted as something to flag when more closed than created. Add a resolution rate badge (closed/created %) with colour coding.

7. **Replenishment: received quantities** — the `quantityReceived` field exists on `ReplenishmentLineItem` and the DB migration is done, but the UI for entering received quantities on the detail page needs a review/completion pass.

---

## 11. Cautions — Do Not Break These

### Git commit workaround
The macOS filesystem mount causes `.git/index.lock` and `.git/HEAD.lock` to be unremovable. All commits must use this pattern:
```bash
IDX=$(mktemp)
GIT_INDEX_FILE=$IDX git read-tree HEAD
GIT_INDEX_FILE=$IDX git add <files>
TREE=$(GIT_INDEX_FILE=$IDX git write-tree)
COMMIT=$(git commit-tree $TREE -p HEAD -m "your message")
echo $COMMIT > .git/refs/heads/main
git push origin main
```
Do NOT use `git add` / `git commit` directly — they will fail or corrupt the index.

### Google Sheets column mapping
`lib/google-sheets.ts` has hardcoded column indices for fault cases (A–O = columns 0–14). If anyone adds or reorders columns in the Google Sheet, `rowToCase()` and the write functions will silently map data to wrong fields. Do not touch the sheet structure without also updating the mapping functions.

### SESSION_SECRET must be set
`lib/auth.ts` throws an explicit error at startup if `SESSION_SECRET` is missing. This is intentional. If you see "SESSION_SECRET environment variable is not set" errors, add it to `.env.local` and Vercel.

### Supabase uses service role key
All Supabase calls use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). RLS policies exist on the tables but are set to `FOR ALL USING (true)`. If you need real user-level RLS, the architecture would need to change to use user-scoped tokens.

### `types/index.ts` is the single source of truth
All shared types live here. Don't define duplicate types locally in page files. If you need a new type used in more than one place, add it to `types/index.ts`.

### The `blankItem()` function in returns new/page.tsx
This function initialises a new line item. If you add a new field to `LineItem`, you must add it to `blankItem()` too, or new items will be missing the field and TypeScript will not catch it (because of partial spread patterns in `setItemField`).

### Sidebar admin-only routes
`middleware.ts` has a hardcoded `ADMIN_ONLY_PATHS` array. If you add a new route that should be admin-only, add it there. The middleware runs on every request — keep it fast (no DB calls).

### `app/globals.css` — don't fight Tailwind specificity
Custom component classes in `globals.css` use `@apply` and sometimes direct CSS. Tailwind's JIT sometimes produces specificity conflicts. If a utility class isn't working, check if a `.card`, `.form-input`, or similar custom class is overriding it.
