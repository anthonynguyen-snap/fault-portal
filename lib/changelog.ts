// ─── Portal Changelog ─────────────────────────────────────────────────────────
// Each entry represents a named release. Add new entries to the TOP of the
// array so the most recent version appears first in the UI.

export type ChangeCategory =
  | 'Cases'
  | 'Returns'
  | 'Refunds'
  | 'Orders'
  | 'Inventory'
  | 'Promotions'
  | 'Replenishment'
  | 'Roster'
  | 'Dashboard'
  | 'Performance'
  | 'Security'
  | 'Admin'
  | 'UI/UX';

export type ChangeEntry = {
  category: ChangeCategory;
  text: string;
};

export type ChangelogVersion = {
  version: string;       // e.g. "v1.8"
  label: string;         // e.g. "UI Polish"
  date: string;          // ISO date string  "2026-05-03"
  summary: string;       // One-sentence description shown in the card header
  changes: ChangeEntry[];
  isLatest?: boolean;
};

export const CHANGELOG: ChangelogVersion[] = [
  {
    version: 'v2.7',
    label: 'Annual Leave Payout',
    date: '2026-05-05',
    isLatest: true,
    summary: 'Staff can now request payout of unused annual leave days after their anniversary, with admin approve/deny workflow.',
    changes: [
      { category: 'Roster', text: 'Annual leave payout requests — staff can request unused annual leave days to be paid out once their anniversary date is reached. Whole days only (e.g. 1, 2, 3) — partial days are not permitted.' },
      { category: 'Roster', text: 'Admin review workflow — pending payout requests are flagged directly on each agent\'s annual leave balance card with Approve and Deny buttons. No extra page needed.' },
      { category: 'Roster', text: 'Admin alert banner — when any payout request is pending review, an amber banner appears at the top of the Leave Log page so nothing goes unnoticed.' },
      { category: 'Roster', text: 'Balance accuracy — approved payout days are automatically deducted from the displayed annual leave balance, so totals always reflect reality.' },
    ],
  },
  {
    version: 'v2.6',
    label: 'Layout Polish',
    date: '2026-05-05',
    isLatest: false,
    summary: 'Case detail two-column layout and admin tab bar scrolling on small screens.',
    changes: [
      { category: 'Cases', text: 'Case detail view — Case Info and Product Info fields now display in a two-column grid, reducing vertical scrolling and making better use of horizontal screen space.' },
      { category: 'Admin', text: 'Admin tab bar — now scrolls horizontally on small screens instead of overflowing. All 8 tabs remain accessible regardless of window size.' },
    ],
  },
  {
    version: 'v2.5',
    label: 'My Submissions & Filters',
    date: '2026-05-05',
    isLatest: false,
    summary: 'Mine filter on Cases, Returns, and Refunds — plus date presets and search on Refunds.',
    changes: [
      { category: 'Cases',   text: '"Mine" toggle button — filter All Cases to show only cases you submitted, with a single click. Active state is highlighted in brand blue.' },
      { category: 'Cases',   text: 'Date presets on Cases filter panel — Today, This Week, This Month, and Last 30 Days quick-select buttons above the date range inputs.' },
      { category: 'Returns', text: '"Mine" toggle on both Requested and Processed tabs — filters to returns you logged (by submitter name).' },
      { category: 'Returns', text: 'Week quick-jump buttons on Processed tab — Last Week, 2 Weeks Ago, 3 Weeks Ago and a "↩ This Week" shortcut when viewing a past week.' },
      { category: 'Refunds', text: '"Mine" toggle on Refunds — filter the queue to refunds you submitted.' },
      { category: 'Refunds', text: 'Search on Refunds — search by order number or customer name; expandable panel with Today/This Week/Last 30d date presets and a manual date range picker.' },
    ],
  },
  {
    version: 'v2.4',
    label: 'CC&E SOP',
    date: '2026-05-05',
    isLatest: false,
    summary: 'CC&E Standard Operating Procedure built into the portal — all 13 sections, searchable and always accessible from the sidebar.',
    changes: [
      { category: 'UI/UX', text: 'CC&E SOP page — full Standard Operating Procedure (v1.4) now lives in the portal under Resources → CC&E SOP, with sticky table of contents, section callouts, tables, and checklists' },
      { category: 'UI/UX', text: 'Admin-only edit controls coming in a future release — content can be updated via the source file in the meantime' },
    ],
  },
  {
    version: 'v2.3',
    label: 'Bug Fixes & Roster',
    date: '2026-05-05',
    isLatest: false,
    summary: 'Today\'s Team dashboard strip, roster monthly rotation, timezone fix, and refund form fixes.',
    changes: [
      { category: 'Dashboard', text: 'Today\'s Team strip — shows who\'s scheduled today with a green dot indicator for anyone already signed into the portal' },
      { category: 'Returns', text: 'Fixed missing returns — API was silently capping results to 1 record when no limit param was passed' },
      { category: 'Refunds', text: 'US orders: $9.50 return label fee auto-deducted from refund amount by default — checkbox to waive if offering free returns' },
      { category: 'Refunds', text: 'AU orders: optional $9.50 prepaid return label fee checkbox — tick to deduct when a label was provided, leave unticked if customer covered their own postage' },
      { category: 'Roster', text: 'Monthly rotation — Gail and Niko swap days off each month; rotation anchors to Monday if the 1st falls mid-week' },
      { category: 'Roster', text: 'Fixed straddle-week bug — weeks spanning two months now consistently use the Monday\'s month for phase lookup, preventing 6-day overwork alerts' },
      { category: 'Admin', text: 'Login history now groups by ACST/ACDT (Australia/Adelaide) date — logins no longer appear under "Yesterday" when made in the morning' },
      { category: 'Refunds', text: 'Fixed "Please select your name" error for staff submitting refund requests — name now resolved from session at submit time' },
      { category: 'Refunds', text: 'Processed By field now auto-fills from the logged-in user\'s session — dropdown removed' },
      { category: 'UI/UX', text: 'What\'s New modal — pops up on the dashboard when a new version is released, showing a summary of changes with category tags; dismisses to localStorage so it only appears once per release' },
    ],
  },
  {
    version: 'v2.2',
    label: 'Internal Notes',
    date: '2026-05-03',
    isLatest: false,
    summary: 'Append-only internal notes on fault cases, returns, and refund requests.',
    changes: [
      { category: 'Cases', text: 'Internal notes panel on case detail pages — timestamped, author-attributed, append-only thread with ⌘↵ shortcut' },
      { category: 'Returns', text: 'Internal notes panel on return detail pages — same timeline component as cases' },
      { category: 'Refunds', text: 'Notes button on each refund row — opens a modal with the full notes thread; badge shows note count when notes exist' },
      { category: 'UI/UX', text: 'Shared InternalNotes component with coloured author avatars, relative timestamps, and a textarea composer' },
      { category: 'Admin', text: 'Notes stored as JSON on Google Sheets (cases, col O) and Supabase JSONB (returns + refund_requests)' },
    ],
  },
  {
    version: 'v2.1',
    label: 'Claim Outcomes & Recovery Tracking',
    date: '2026-05-03',
    isLatest: false,
    summary: 'Manufacturer claim outcomes with partial credit support, recovery rate summary, and outcome detail modal.',
    changes: [
      { category: 'Cases', text: 'New "Partial Credit" claim status — for when a manufacturer approves only a portion of a claim batch' },
      { category: 'Cases', text: 'Record Outcome modal — triggered when marking a claim as Credit Received, Partial Credit, or Rejected; captures amount recovered, outcome date, and notes' },
      { category: 'Cases', text: 'Recovery Summary strip on the Claims page — shows total at risk, total recovered, open exposure, and recovery rate % with progress bar' },
      { category: 'Cases', text: 'Per-manufacturer recovery totals shown in each section header (at risk vs recovered)' },
      { category: 'Cases', text: 'Outcome detail row — expand any resolved claim to see outcome date, status badge, and notes inline in the table' },
      { category: 'Cases', text: 'Amount Recovered column added to claims table — shows recovered amount for settled claims, "pending" for open ones' },
    ],
  },
  {
    version: 'v2.0',
    label: 'Login History & Promotions UI',
    date: '2026-05-03',
    isLatest: false,
    summary: 'Staff login timeline in Admin and promotions strip redesigned to match portal UI.',
    changes: [
      { category: 'Admin', text: 'Login History feed in Admin > Logins — groups clock-in events by day (Today / Yesterday / date) with coloured initials, role badge, and relative time' },
      { category: 'Admin', text: 'Filter by staff member and date range (7 / 14 / 30 days) — fetches from shift_logs via new /api/admin/login-history endpoint' },
      { category: 'Promotions', text: 'Active Promotions strip rebuilt as a portal-native card — replace letterboard / scramble ticker with clean divide-y rows, store badges, discount chips, and countdown pills' },
      { category: 'Promotions', text: 'Major Sale Banner redesigned as an amber-bordered card with sale name, discount badge, code chip, store badge, dates, and days-left countdown' },
    ],
  },
  {
    version: 'v1.9',
    label: 'Dashboard Redesign & Navigation',
    date: '2026-05-03',
    isLatest: false,
    summary: 'Full dashboard overhaul, returns navigation restructure, and an Admin changelog tab.',
    changes: [
      { category: 'Dashboard', text: 'Complete dashboard rebuild — replaced cluttered stat cards with a compact 4-cell QuickStat strip (Faults This Week, Cost at Risk, Awaiting Parcel, Follow-ups Due)' },
      { category: 'Dashboard', text: 'Weekly Fault Chart (2/3 width) sits alongside AI Briefing or Today\'s Activity (1/3 width) in a two-column mid-section' },
      { category: 'Dashboard', text: 'Recent Cases table (2/3) shown beside Today\'s Activity feed (1/3) for admin users' },
      { category: 'Dashboard', text: 'By Manufacturer and By Fault Type breakdown panels use inline bar lines — no heavy charts, loads instantly' },
      { category: 'Dashboard', text: 'Returns summary row shows 3 numbers side by side: returns this week, amount refunded, and pending follow-ups' },
      { category: 'Dashboard', text: 'Replenishment summary row (admin only) shows pending orders, in-transit count, and tracking alerts' },
      { category: 'Dashboard', text: 'Promotions strip and Major Sale banner moved to the bottom of the dashboard' },
      { category: 'Returns', text: '"Log Return Request" moved to the sidebar as a teal action link — consistent with Submit Fault and Request Refund' },
      { category: 'Returns', text: 'Removed duplicate Log Request / Log Return button from page header; secondary Log Return button kept on Processed tab' },
      { category: 'Admin', text: 'New Changelog tab in Admin — full version history accordion with category colour badges, dates, and change counts' },
      { category: 'Admin', text: '"New" badge appears on the Admin sidebar link whenever a version has been released since the user last visited the Changelog tab' },
    ],
  },
  {
    version: 'v1.8',
    label: 'UI Polish',
    date: '2026-05-03',
    isLatest: false,
    summary: 'Visual refinements across the portal — sidebar, tables, dashboard, and loading states.',
    changes: [
      { category: 'UI/UX', text: 'Sidebar active nav item now shows a soft blue tint with an inset left-border accent instead of a filled block' },
      { category: 'UI/UX', text: 'Active nav icon tints brand-300; label goes semibold for stronger legibility' },
      { category: 'Dashboard', text: 'Week-over-week ↑↓ delta pills added to KPI stat cards — green for improvement, red for increase (more faults/cost = worse)' },
      { category: 'Dashboard', text: 'Section zones: Returns, Replenishment, and AI Briefing areas each sit inside a subtly gradient-tinted container for visual rhythm' },
      { category: 'UI/UX', text: 'Table even rows carry a warm brand tint (#f5fbfd); headers are tighter and more distinct with uppercase wider tracking' },
      { category: 'UI/UX', text: 'Numeric columns across all tables are right-aligned with monospaced tabular figures via .num CSS class' },
      { category: 'UI/UX', text: 'New PageSkeleton and DashboardSkeleton components provide a consistent full-page shimmer on initial load; Claims page updated to use PageSkeleton' },
      { category: 'Promotions', text: 'Upcoming promotions show a sky-blue countdown badge ("in 3d", "tomorrow") in the dashboard strip; promo name dims until live' },
    ],
  },
  {
    version: 'v1.7',
    label: 'Performance & Reliability',
    date: '2026-05-01',
    summary: 'Server-side pagination, in-memory caching, lazy-loading, and hardened error handling.',
    changes: [
      { category: 'Cases', text: 'Cases API now supports server-side filtering, sorting, and pagination — page/limit params, CSV export fetches all matching rows' },
      { category: 'Returns', text: 'Returns API supports server-side search, date range, page, and limit params with Supabase .range() for efficient queries' },
      { category: 'Dashboard', text: 'Dashboard aggregations cached in-memory (60s TTL) to avoid recomputing on every page load' },
      { category: 'Dashboard', text: 'Recharts lazy-loaded via dynamic import — code-split into a separate chunk to reduce initial bundle size' },
      { category: 'UI/UX', text: 'All silent catch blocks replaced with visible error states and console.error/warn logging' },
      { category: 'Admin', text: 'Staff list cached in component state — no longer refetched on every modal open' },
      { category: 'UI/UX', text: 'Shared date/week utility functions extracted to lib/utils.ts to eliminate duplication across pages' },
    ],
  },
  {
    version: 'v1.6',
    label: 'Authentication & Security',
    date: '2026-04-30',
    summary: 'Full staff authentication with role-based access control, password management, and audit logging.',
    changes: [
      { category: 'Security', text: 'Staff login page with session-cookie authentication — bcrypt-hashed passwords, signed SESSION_SECRET' },
      { category: 'Security', text: 'Role-based access control — admin vs. standard staff; admin-only pages and sidebar items gated accordingly' },
      { category: 'Security', text: 'Middleware enforces authentication on all portal routes; redirects unauthenticated users to /login' },
      { category: 'Security', text: 'Change Password page at /account/password — requires current password before updating' },
      { category: 'Admin', text: 'Admin > Logins panel shows all staff with last-login timestamp and role; admins can set/reset passwords' },
      { category: 'Admin', text: 'SESSION_SECRET throws at startup if missing — prevents silent insecure deployments' },
      { category: 'Cases', text: 'Input validation added to cases and refunds API routes — rejects malformed payloads with 400 errors' },
    ],
  },
  {
    version: 'v1.5',
    label: 'Roster & Leave Management',
    date: '2026-04-28',
    summary: 'Full roster calendar with drag-to-override, leave log, public holiday coverage, and iPad support.',
    changes: [
      { category: 'Roster', text: 'Weekly roster calendar showing all staff shifts with colour-coded role bands' },
      { category: 'Roster', text: 'Clickable Today bar navigates directly to the current week\'s view' },
      { category: 'Roster', text: 'Drag-to-override: shift cells can be dragged to swap or reassign staff for the day' },
      { category: 'Roster', text: '5-day staffing alert banner fires when coverage drops below the configured minimum threshold' },
      { category: 'Roster', text: 'Leave Log page — submit, view, approve/deny leave requests with date range and staff filter' },
      { category: 'Roster', text: 'Admin > Roster Settings panel to configure shift patterns, minimum staffing, and public holiday coverage' },
      { category: 'UI/UX', text: 'iPad-responsive sidebar drawer — hamburger menu slides in/out on mobile and tablet viewports' },
      { category: 'UI/UX', text: 'Table overflow and grid layout fixes for sub-1024px screens across all list pages' },
    ],
  },
  {
    version: 'v1.4',
    label: 'Replenishment Module',
    date: '2026-04-25',
    summary: 'End-to-end replenishment order tracking from request through to delivery confirmation.',
    changes: [
      { category: 'Replenishment', text: 'Replenishment list page — view all orders with status badges, supplier, and ETA filters' },
      { category: 'Replenishment', text: 'Replenishment detail page — line-item breakdown with quantity ordered, received, and variance' },
      { category: 'Replenishment', text: 'Skip toggle on line items — mark a line as skipped (won\'t count toward completion)' },
      { category: 'Replenishment', text: 'Mark Delivered button — logs received quantities and updates order status to Delivered' },
      { category: 'Replenishment', text: 'Alert badge on sidebar Replenishment link when orders are overdue' },
      { category: 'Admin', text: 'Supabase migration files for replenishment_orders and replenishment_line_items tables' },
    ],
  },
  {
    version: 'v1.3',
    label: 'Team Performance & AI Briefing',
    date: '2026-04-22',
    summary: 'Team performance dashboard with Commslayer integration and AI-generated daily briefings.',
    changes: [
      { category: 'Performance', text: 'Team Performance page — per-agent metrics (cases handled, avg resolution time, CSAT) with week/month toggle' },
      { category: 'Performance', text: 'Recharts bar and line charts showing trend data over the selected period' },
      { category: 'Performance', text: 'KPI Targets panel in Admin — configure thresholds for resolution time and case volume' },
      { category: 'Dashboard', text: 'AI Briefing card — calls Claude (Haiku) each morning to summarise overnight case activity and surface anomalies' },
      { category: 'Dashboard', text: 'Active Promotions ticker strip on the dashboard homepage — scrolling marquee of live promos' },
      { category: 'Promotions', text: 'Promotions management page — add/edit/deactivate promotions with start/end dates and product associations' },
    ],
  },
  {
    version: 'v1.2',
    label: 'Inventory & Promotions',
    date: '2026-04-18',
    summary: 'Stock room management with discontinued product support and promotions tracking.',
    changes: [
      { category: 'Inventory', text: 'Stock Room page — full inventory list with search, manufacturer filter, and stock level indicators' },
      { category: 'Inventory', text: 'Discontinued flag on products — marks items as discontinued with visual badge; admin can toggle per product' },
      { category: 'Promotions', text: 'Promotions page with active/upcoming/expired tabs and inline add/edit modal' },
      { category: 'Dashboard', text: 'Sticky table headers on all list pages — column labels stay visible when scrolling long tables' },
      { category: 'UI/UX', text: 'Keyboard navigation in header search — arrow keys cycle results, Enter navigates, Escape dismisses' },
      { category: 'UI/UX', text: 'Empty state illustrations with CTA buttons on filtered views with no results' },
    ],
  },
  {
    version: 'v1.1',
    label: 'Customer Module',
    date: '2026-04-14',
    summary: 'Returns processing, refund requests, and order lookup added to the portal.',
    changes: [
      { category: 'Returns', text: 'Returns list page — log and process return requests with status workflow (Requested → Received → Processed → Refunded)' },
      { category: 'Returns', text: 'Alert badge on sidebar Returns link when items have been waiting more than 3 days' },
      { category: 'Refunds', text: 'Refund Requests page — raise, review, and approve/decline refunds with amount and reason tracking' },
      { category: 'Refunds', text: 'Alert badge on sidebar Refunds link showing count of pending refund requests' },
      { category: 'Orders', text: 'Order Lookup page — search by order number or customer name; shows order lines, status, and linked cases' },
      { category: 'Dashboard', text: 'Returns and Refunds KPI cards on the dashboard homepage with weekly counts' },
    ],
  },
  {
    version: 'v1.0',
    label: 'Core Portal',
    date: '2026-04-10',
    summary: 'Initial release — fault case management, claims, and admin configuration.',
    changes: [
      { category: 'Cases', text: 'Fault Cases list — log, search, filter by manufacturer/status/date, and sort all open cases' },
      { category: 'Cases', text: 'Submit Fault form — create a new case with product, manufacturer, fault type, and description' },
      { category: 'Cases', text: 'Case detail page — full case history, status updates, and linked claim' },
      { category: 'Cases', text: 'Claims tab — track manufacturer warranty claims linked to fault cases with status workflow' },
      { category: 'Admin', text: 'Products, Manufacturers, and Fault Types management panels with add/edit/delete' },
      { category: 'Admin', text: 'Staff management — add team members with name, email, and role' },
      { category: 'Dashboard', text: 'Homepage dashboard with case volume KPI cards and weekly trend chart' },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const LATEST_VERSION = CHANGELOG.find(v => v.isLatest)?.version ?? CHANGELOG[0]?.version;

/** localStorage key used to track which version the user last acknowledged */
export const CHANGELOG_SEEN_KEY = 'portal_changelog_seen';
