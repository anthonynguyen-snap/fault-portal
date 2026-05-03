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
    version: 'v1.8',
    label: 'UI Polish',
    date: '2026-05-03',
    isLatest: true,
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
