# SnapWireless CC&E Portal — Multi-Role Platform Review
**Date:** May 2026 · **Reviewer:** Platform Audit · **Status:** Pre-implementation planning

---

## Role 1 — Frontline Agent (Daily Ticket Handler)

### How They Use the Platform
They arrive at the dashboard, check the Today's Team strip to see who's on, glance at the AI briefing for any overnight context, then open their CS tool (Commslayer) in a second tab. When a customer reports a faulty product they go sidebar → Submit Fault, fill in the form, attach evidence, submit. For a return request they hit Log Return Request. For a refund they hit Request Refund. Throughout the day they cross-reference Order Lookup when customers call with an order number.

### What's Working
- Quick mode on fault submission is genuinely useful — reduced input from ~10 fields to 4
- Duplicate detection on the fault form is a smart friction point that catches double-logging
- The sidebar action links (Submit Fault, Log Return Request, Request Refund) near the top give fast access to the most frequent workflows
- Copy order number button on the cases list is a small but real time-saver
- Internal notes on cases, returns, and refunds mean agents don't have to use Slack or email to communicate about a record
- Success screen after fault submission shows the case ID so agents can reference it immediately

### Friction Points
1. **No "My Queue" view.** There is no way to filter cases, returns, or refunds by the currently logged-in user. An agent wanting to see what they personally submitted has to scroll or remember IDs. On a busy day with 10+ submissions across the team this becomes genuinely frustrating.
2. **Returns list defaults to the current week.** If a customer follows up on a return from last Thursday the agent has to click back a week, wait for a reload, then scan the list. There is no "search by order number" or "search by customer name" on the returns page — only week navigation.
3. **No cross-entity search by customer name or email.** Order Lookup is good but requires an exact order number. If a customer doesn't have their order number there is no way to find them quickly. Search by first name, last name, or email returns nothing.
4. **No assignment system.** Returns and refunds are not assignable to an agent. There is no way to "claim" a return you're handling, meaning two agents can unknowingly work the same record simultaneously. There is no signal that says "Sarah is already on this one."
5. **Context switching is constant.** The portal handles logging and status tracking but all actual customer communication happens in Commslayer. The conversationLink field is a one-way link out — there is no way to pull the conversation thread into the portal or see its status without leaving. Every action requires two tabs minimum.
6. **File evidence upload is limited.** The form accepts uploads but the size limit is 500MB, which is fine for video. The problem is that many agents already have evidence links in Google Drive, YouTube, or Loom but the form also has a separate evidenceLink field. It's unclear which to use and why both exist. Agents may duplicate effort by uploading a file and also pasting a link.
7. **No canned response or template system within the portal.** Agents going to a case detail have no quick way to generate a standardised email reply or internal note from a template. They copy-paste from memory or Slack.
8. **After submitting a fault there's no "view today's cases" shortcut.** The success screen offers "Submit Another" or "View Case" but nothing to show all cases submitted today — agents have to go to All Cases and mentally filter.

---

## Role 2 — Customer Care Manager

### How They Use the Platform
Starts the day on the dashboard looking at KPI cards and the AI briefing. Checks the performance page to see who's tracking against targets. Reviews open returns with the age pills to identify anything overdue. Checks claims before sending a batch to the manufacturer. Pulls reports when preparing a weekly or monthly review. Uses Admin to manage staff access and roster.

### What's Working
- Claims page with recovery stats and outcome recording is well thought out — the logic of tracking "submitted vs approved vs rejected" per manufacturer is exactly right for a CC&E function
- Performance page pulling live Commslayer data is the right approach — agents can't game it and it updates automatically
- Dashboard trend indicators (↑↓ week-over-week) give quick directional signals without needing to go to reports
- Today's Team strip gives instant visibility into who's actually in without checking Slack
- KPI targets in Admin Settings let managers set expectations that show on the performance page

### Friction Points
1. **No claims alert on the dashboard.** The manager can see returns alerts and refund counts on the sidebar but there's no signal for "you have 3 cases ready to batch into a manufacturer claim" or "Manufacturer X has an overdue claim response." The claims workflow is invisible from the dashboard.
2. **Reports are claims-only.** There is no report on return rates by product, refund volumes over time, average resolution time, or fault type frequency. A manager preparing a monthly operational review has to export raw data from Google Sheets manually because the Reports page only handles manufacturer claim bundles.
3. **No SLA enforcement or visibility.** A refund request that's 5 days old has an age pill that turns red. That's it. There is no automatic escalation, no alert, no SLA breach counter on the dashboard. Managers have to manually scan every page for overdue items.
4. **Activity log is not filterable by agent.** The log shows everything but there's no way to ask "what did Gabriel submit this week" or "who processed the most refunds in the last 30 days." It's a stream, not a queryable tool.
5. **Performance page only covers Commslayer agents.** It pulls data for three hardcoded agent IDs. Any work done in the portal itself — returns logged, cases submitted, refunds processed — contributes nothing to performance metrics. An agent who processes 30 returns in the portal but sends few Commslayer messages appears unproductive.
6. **No workload distribution view.** The manager cannot see "how many open returns does each agent have" or "who has the most pending refunds." There's no team-level queue management — just individual record lists.
7. **Roster and leave management is buried in Admin.** Admin is where you manage products, manufacturers, and system config. Having the live roster there alongside Products and Fault Types doesn't make sense for a manager who accesses the roster daily. It should be a top-level section.
8. **No export for operational data.** Cases, returns, and refunds can't be exported as CSV or Excel from the portal UI. A manager who wants to do their own pivot table analysis on refund reasons or fault type trends has to go directly to Google Sheets.

---

## Role 3 — Frontline Agent (Checking Their Own Submissions)

### How They Use the Platform
Submitted a return request yesterday for a customer who just called back asking for an update. Needs to find the record, check its status, add a note that the customer called again, and confirm whether the follow-up is completed.

### What's Working
- Order Lookup is a genuinely useful cross-reference — entering an order number shows all associated cases, refunds, and returns in one view
- Internal notes mean the agent can leave context ("customer called back 2/5/26, still waiting on tracking confirmation") without using Slack
- Follow-up age pill on returns gives an at-a-glance urgency signal
- The returns list shows submittedBy so agents can at least visually scan for their name

### Friction Points
1. **Finding their own submissions requires scrolling or knowing the order number.** There is no "Show my submissions" filter. If the agent doesn't remember the order number they have to scroll through the returns list — which defaults to the current week — and scan the submittedBy column visually.
2. **Status changes produce no notification.** If a return is marked as delivered or a refund is processed, the submitting agent finds out only if they happen to go check the record. No email, no in-app notification, no badge.
3. **The week-based returns navigation is not intuitive.** "This Week" is the default and navigating to a previous week requires clicking back one week at a time. A customer calling about a return submitted 3 weeks ago requires clicking back 3 times, reloading each time.
4. **Return detail page doesn't exist as a standalone route.** The return detail is shown as a slide-over panel on the returns list. That means there's no URL to link to a specific return, you can't bookmark it, and you can't send a colleague a direct link to a record. Compare with fault cases that do have a proper detail page at /cases/[id].
5. **The refunds page has no search.** You can filter by status but not search by order number, customer name, or submitter. Finding a specific refund requires knowing the status and scrolling.

---

## Role 4 — UX/UI Designer

### How They Evaluate the Platform
Walks through every screen looking at information hierarchy, task completion efficiency, visual consistency, and discoverability.

### What's Working
- The visual language is consistent — badge system, brand color accent, slate palette, and card layout are unified throughout
- Skeleton loading states on major pages feel polished and prevent layout shift
- Toast notifications provide appropriate feedback for async actions without disrupting workflow
- The sidebar's action link treatment (brand-colored, slightly different weight) correctly signals "this does something" rather than "this is a page"
- Sticky table headers are present and correct
- The What's New modal on login is a smart onboarding pattern
- The SOP TOC sidebar with intersection observer active tracking is a well-implemented detail

### Friction Points
1. **The sidebar is long and undifferentiated.** There are 7 navigation groups with 15+ links. On a 768px screen most of the bottom half is cut off and requires scrolling. Groups like "Wholesale" (one link) and "Resources" (one link) feel thin and could be collapsed or merged. The visual weight of every group label is identical regardless of how important the section is.
2. **The Admin page tabs wrap on small screens.** Eight tabs in a horizontal pill row wrap to two lines below ~900px, which looks broken. The tab layout also buries the Changelog — the most frequently relevant tab for non-admin users who happen to have admin access — behind Products and Manufacturers.
3. **Case detail is single-column with wasted space.** The detail page at /cases/[id] has a narrow left panel with info rows and then internal notes stacked below. On a wide screen there's a lot of empty right-side space. A two-column layout with case info on the left and a notes/timeline panel on the right would use the space better and match how agents actually work (reference info while writing notes).
4. **The returns detail is a slide-over, not a page.** This is inconsistent with cases which have their own route. It means returns can't be linked to, bookmarked, or opened in a new tab. For a manager reviewing a specific return this is a meaningful limitation.
5. **Filter panels don't have date presets.** Every "From date / To date" date range requires manually opening a date input and typing or picking a date. There are no quick-select options for Today, This Week, This Month, or Last 30 Days. This slows every filtered search.
6. **Emoji in refund resolution badges is inconsistent with the design system.** The ResolutionBadge renders 💵 and 🎁 inline with text. Every other badge in the system uses only text and color. This inconsistency feels unpolished in an otherwise cohesive visual system.
7. **No search within the SOP.** The document has 13 sections and numerous subsections. A staff member looking for the specific policy on return label fees has to scroll through the TOC manually or Ctrl+F in the browser. An in-page search bar would significantly improve the utility of the SOP.
8. **The evidence field duality on the fault form is confusing.** There is both a file upload dropzone and a separate "Evidence Link" text field. A new agent doesn't know whether they should upload, paste a link, or both. The relationship between these two fields is not explained.
9. **Loading spinner on case detail is a plain CSS border-spin.** Every other page uses the Skeleton component which maintains layout. The detail page drops to a centered spinner which causes a jarring layout shift when the page loads.
10. **Mobile table experience is scroll-only.** Tables on mobile scroll horizontally inside the card, which works but isn't ideal. A card/list view mode for mobile would be significantly more usable for a staff member checking something on their phone between calls.

---

## Role 5 — Technical / Product Manager

### Architecture Assessment
The platform is a well-built Next.js 15 App Router application on Vercel. TypeScript throughout is correct. The component structure is sensible. The problem is the data layer — everything rides on Google Sheets as a primary database, and that will become a serious constraint within months.

### What's Working
- Next.js App Router with server components where applicable is a modern, appropriate choice
- Vercel deployment with environment variables is clean and deployable
- In-memory caching for dashboard aggregations is a pragmatic performance optimization
- File upload via chunked proxy to bypass Vercel's 4.5MB request limit is a solid engineering solution
- Server-side pagination and filtering on /api/cases is correctly implemented — this is the right approach
- Lazy loading of Recharts on the dashboard reduces initial bundle size meaningfully
- Role-based access control with middleware protection is correctly implemented

### Critical Issues (Not Friction — Actual Problems)

**1. Google Sheets as a Database Will Fail at Scale**
Google Sheets API has a quota of 300 requests per minute per project. The platform currently polls returns every 30 seconds, refunds every 30 seconds, and replenishment every 60 seconds per active browser tab. With 5 concurrent staff this is 30+ Sheets API calls per minute just from polling — before any actual CRUD operations. At 10 staff during peak the platform will start hitting quota limits and silently returning empty data. Beyond quotas: no transactions means concurrent writes can corrupt row data, there is no proper foreign key integrity, and row lookups are O(n) full-sheet scans. Supabase is partially in use for replenishment — this was the right instinct and should be extended to all entities.

**2. No Audit Trail on Record Changes**
When a case is edited via PATCH /api/cases/[id], the previous values are overwritten with no history. There is no way to see that a claim status changed from Unsubmitted to Submitted, or that a fault type was changed after submission. The internal notes are append-only which is good, but the core record fields have no versioning.

**3. Authentication Has No 2FA and Passwords Are Plain Admin-Reset**
Custom session authentication with no multi-factor option. If a staff account is compromised there is no second factor. Password reset requires an admin to set it manually in the portal — there is no self-service reset flow. This is acceptable for internal staff but should be flagged as a risk.

**4. No Error Tracking**
There is no Sentry, Datadog, or equivalent. Runtime errors in production surface only if a user reports them. The catch blocks in several components log to console.warn — they are silent to the development team. Issues on Google Sheets API quota exhaustion or rate limiting will be invisible until users complain.

**5. Shopify Integration Is Manual**
The refunds page detects currency from order number suffix (AU, US, UK etc.) and has Shopify link fields — but order data is manually entered. Customer name, email, and order details must be typed in by agents. Shopify has a well-documented API. Order lookups could be automatic: agent enters order number → platform fetches customer name, email, products, order total from Shopify → fields pre-fill. This would eliminate a class of data entry errors and save significant time per submission.

**6. Starshipit Is Fully Manual**
Returns tracking requires agents to manually enter tracking numbers and Starshipit order numbers. Starshipit has a REST API. A webhook on label creation could auto-populate returns and update tracking status without any agent input.

**7. No Staging Environment**
All development and testing happens against the production Google Sheets and Supabase databases. A bug in a migration or API route could corrupt production data. There is no way to test a major change safely before it reaches staff.

### Medium-Term Technical Concerns
- The `PRIMARY_AGENT_IDS` array in the performance page is hardcoded — adding a new agent requires a code deploy
- No API versioning or documentation — the internal routes are implicitly versioned by the frontend that calls them
- Rate limiting is absent on all API routes — a misconfigured client or script could hammer the Sheets API without any throttle
- The `GIT_INDEX_FILE` commit workaround left the git index in an inconsistent state — this is a development workflow risk that should be resolved by standardising the commit process

---

## Prioritised Improvement List

### HIGH — Do These First

**H1. Add "My Submissions" / Assignment System**
Filter cases, returns, and refunds by logged-in user or by assigned agent. Agents need to find their own records in under 3 seconds. This is the single most requested UX improvement for a team using this daily.

**H2. Return and Refund Detail Pages (Proper Routes)**
Convert the slide-over return detail into a standalone page at /returns/[id] matching the pattern of /cases/[id]. This unblocks linking, bookmarking, and two-tab workflows. Same applies to refund detail if it doesn't already have one.

**H3. Search on Returns and Refunds Pages**
Add order number and customer name search to the returns and refunds list pages. Week-based navigation without search is a serious friction point when customers call about older records.

**H4. Date Presets on All Filter Panels**
Add Today / This Week / This Month / Last 30 Days quick-select above every date range input. This reduces filter setup from 4 clicks to 1.

**H5. Shopify Order Auto-Fill on Fault/Return/Refund Forms**
When an agent enters an order number and tabs out, call a Shopify lookup API and pre-fill customer name, email, and products. One of the highest-ROI integrations available given how frequently these forms are used.

**H6. Operational Dashboard for Managers**
Add a manager-only section to the dashboard showing: open returns by age, pending refunds by agent, cases without a claim status by age, and a quick-link to claims. Currently managers have to navigate to 4 separate pages to get this picture.

### MEDIUM — Schedule for Next Cycle

**M1. Migrate Core Data to Supabase**
Start with refunds (simplest schema), then returns, then cases. Each entity already has a type definition — migration to Supabase tables is mechanical. This eliminates quota risk, enables proper querying, and unlocks real-time subscriptions. Maintain Google Sheets as an optional sync/export, not as the source of truth.

**M2. Status Change Notifications**
When a return or refund status changes, the submitting agent should receive an in-app notification badge. This eliminates the need to manually check back on records. A simple notifications table in Supabase with a polling endpoint is sufficient — full websocket implementation is not required at this scale.

**M3. Return Detail Page Consistent with Cases**
Already covered in H2. Noted here because it also enables the manager to link to a specific return in a Slack message or email.

**M4. SOP In-Page Search**
A simple client-side text search through the structured SOP_SECTIONS data filtered into matching results. The data is already in memory — this is a one-afternoon feature.

**M5. Export CSV from Cases, Returns, Refunds**
A download button on each list page that exports the current filtered view as CSV. Managers need this for monthly reporting that goes beyond what the portal displays.

**M6. Remove Hardcoded Agent IDs from Performance Page**
Agent IDs should be stored in the staff table in Admin (or Supabase) with a "Commslayer agent ID" field. The performance page fetches the list dynamically. Adding a new agent then requires no code change.

**M7. Unified Evidence Field on Fault Form**
Replace the current dual "upload file" + "evidence link" fields with a single evidence section: paste a URL or upload a file, with clear explanatory text. Prevents confusion and duplicate effort.

**M8. Sentry Error Tracking**
Add Sentry to both client and server. All the existing console.warn and empty catch blocks should route to Sentry. Runtime errors in production should alert the development team, not wait for a user report.

### LOW — Backlog

**L1. 2FA on Admin Accounts**
TOTP-based 2FA for admin role logins at minimum. Not urgent given the internal-only nature of the platform, but the right eventual direction.

**L2. Staging Environment**
Separate Vercel preview environment connected to a staging Supabase instance and a test Google Sheet. Required before any major data layer migration.

**L3. Starshipit Webhook Integration**
Auto-populate tracking numbers and status on returns when a Starshipit label is created. Eliminates one manual field per return.

**L4. In-App Canned Responses / Note Templates**
A small library of pre-written internal note templates (e.g., "Customer called to follow up — advised processing within 3–5 business days") that agents can insert rather than typing from memory.

**L5. Commslayer Bidirectional Sync**
When a case is resolved in the portal, optionally close the corresponding Commslayer conversation. When a Commslayer conversation is resolved, optionally create a case in the portal. Requires Commslayer webhook setup.

**L6. SOP Admin Editing**
The "Editing coming soon" label has been on the SOP page since launch. An inline block editor for admin users would allow SOP maintenance without requiring a code deploy. Low urgency while the SOP is still being written, but should be planned.

**L7. Mobile Card View for Tables**
An alternative list layout for screens under 640px that shows each record as a card rather than a horizontal-scroll table row. Returns and refunds are the highest-priority pages for this.

---

## Missing Features — What a Strong Customer Care Platform Has That This Doesn't

**Customer Profile View.** A page that aggregates everything about a single customer: all their orders, all cases, returns, and refunds associated with them, notes from any record, and a link to their Shopify account. Currently this requires Order Lookup per order and the customer may have multiple orders.

**SLA Rules Engine.** Configurable SLA rules per case type (e.g., "Refund requests must be processed within 48 hours") with automatic escalation flagging. Currently only age pills provide urgency signals.

**Internal Announcement System.** A lightweight way for the manager to post a notice that appears on the dashboard for all staff ("Heads up: Manufacturer X is taking 3 weeks to respond to claims right now"). Currently this requires Slack.

**Bulk Actions on Returns/Refunds.** Batch-select multiple refunds and mark them all processed at once, similar to the batch claim status update on cases. Currently each refund must be updated individually.

**A Proper Notification Centre.** A bell icon in the header with a dropdown of recent events relevant to the current user: status changes on their submissions, admin announcements, new internal notes on records they've touched.

**Customer Satisfaction Tracking at the Portal Level.** Commslayer provides CSAT from chat conversations, but returns and refunds handled in the portal have no satisfaction tracking at all. A simple one-question follow-up email (sent automatically when a refund is marked processed) would provide meaningful data.

---

## Summary Statement

This is a genuinely impressive internal tool for a small team. The visual polish is above average for an internal portal, the TypeScript is clean, the Vercel deployment is solid, and key UX patterns (skeleton loaders, toast notifications, action links, duplicate detection) are thoughtfully implemented.

The two structural problems that need attention before this platform handles a larger team or higher volume: the Google Sheets data layer which has hard ceilings on reliability and performance, and the lack of assignment and notification systems which make it a logging tool rather than a workflow management tool.

The quick wins — My Submissions filter, return detail pages with proper routes, search on returns/refunds, and date presets — are all low-effort changes that would have an immediate, daily impact on every agent using the platform.
