// ─── SnapWireless CC&E Standard Operating Procedure ──────────────────────────
// Structured content mirroring the PDF (v1.4, April 2026).
// Each section contains typed blocks rendered by app/sop/page.tsx.
// Admins can request edits here; inline editing coming in a future release.

export type SOPBlock =
  | { type: 'p'; content: string }
  | { type: 'h3'; content: string }
  | { type: 'h4'; content: string }
  | { type: 'info'; content: string }
  | { type: 'warning'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'checklist'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

export type SOPSection = {
  id: string;
  number: string;
  title: string;
  parentId?: string;
  blocks: SOPBlock[];
};

export const SOP_META = {
  version: 'v1.4',
  updated: 'April 2026',
  owner: 'CC&E Lead',
  audience: 'New hires, existing CC&E team, cross-functional stakeholders',
  reviewCadence: 'Quarterly',
};

export const SOP_SECTIONS: SOPSection[] = [

  // ── 1. Department Overview ─────────────────────────────────────────────────
  {
    id: 's1',
    number: '1',
    title: 'Department Overview',
    blocks: [
      { type: 'p', content: 'The Customer Care & Experience team is the voice of SnapWireless. Every ticket, DM, comment, and review is a chance to either lose a customer or turn one into an advocate.' },
      { type: 'info', content: '**Naming note:** Internal strategy docs sometimes refer to this team as the "Customer Success Function." Same team, same scope — use whichever name fits the audience.' },
      { type: 'h3', content: 'What we deliver — the four service pillars' },
      { type: 'p', content: 'This team exists to deliver four connected services. Every task in this SOP maps to one of them.' },
      { type: 'ol', items: [
        '**Customer Inquiry Management (Pre & Post Purchase)** — Every inbound ticket, product DM, or email. Order issues, refunds, returns, wholesale leads, product questions. Sections 3–6, 9, 12.',
        '**Customer Education & Resources** — Help centre content, FAQs, tutorials, onboarding. Reducing inbound ticket volume by giving customers the answers upfront. Section 8B.',
        '**Community Support (shared with Social Media Lead)** — CC owns **product-specific DMs** and **per-customer review recovery** (Okendo, ProductReview outreach). Social Media Lead owns public comments, general social engagement, TikTok inbox triage, YouTube moderation. Section 7 + 8.',
        '**Customer Engagement, Retention & Loyalty** — Turning one-time buyers into repeat buyers and repeat buyers into advocates. Section 8C.',
      ]},
      { type: 'h3', content: 'What we own' },
      { type: 'ul', items: [
        'Inbound support across Shopify orders (AU, US, NZ, ROW)',
        'Order error clearing across all 3PLs (NP, Borderless, Portless)',
        'Returns processing (in-office + 3PL-routed)',
        'Product-specific DMs across IG and Messenger',
        'Per-customer review recovery (Okendo negative, ProductReview outreach)',
        'Fault case management via the **Fault Portal**',
        'Help centre / FAQ / tutorial content maintenance',
        'Loyalty program operations + retention outreach',
        'Corporate / wholesale lead intake',
        'ACS studio upkeep',
      ]},
      { type: 'h3', content: 'What we don\'t own (but coordinate with)' },
      { type: 'ul', items: [
        '**Public community engagement (FB/IG/TikTok/YouTube comments, TikTok inbox general triage)** → Social Media Lead',
        'Content creator outreach → PR Manager',
        'Product faults (diagnosis) → Product team (we gather evidence and run the Fault Portal case, they diagnose)',
        'Fulfilment errors caused by 3PL → 3PL account manager, CC flags',
        'Loyalty program strategy + rewards design → Marketing (we execute)',
      ]},
      { type: 'warning', content: '**Where CC and Social Media Lead overlap:** A public comment that turns into a product-specific DM becomes ours. A product DM that needs public clarification goes back to Social Media Lead. When in doubt, ping `#cc-ops`.' },
      { type: 'p', content: '**Our north star:** A SnapWireless customer should feel heard, taken seriously, and better off after talking to us — even when we\'re telling them no.' },
    ],
  },

  // ── 2. Core Pillars ────────────────────────────────────────────────────────
  {
    id: 's2',
    number: '2',
    title: 'Core Pillars of Customer Care',
    blocks: [
      { type: 'p', content: 'These aren\'t slogans. They\'re the filters every response should pass through.' },
      { type: 'ol', items: [
        '**Speed without sloppiness** Fast replies beat perfect replies. But a wrong answer sent quickly creates two problems instead of one. Check before you send.',
        '**Human, not scripted** Canned responses are starting points. Edit them. A customer knows when they\'re getting copy-paste.',
        '**Own the problem, even when it isn\'t ours** Courier lost the parcel? Address wrong on the order? We still run point until it\'s resolved. The customer doesn\'t care whose fault it is.',
        '**Evidence before empathy decisions** We\'re generous with refunds and replacements — but only after we\'ve seen video, order details, or photos. This protects the business and the customer from bad-faith or mistaken claims.',
        '**Advocates > apologists** A happy customer who leaves a 5-star review is worth more than a refund. Always look for the chance to turn a neutral experience into a positive one.',
      ]},
    ],
  },

  // ── 3. Daily Workflow ──────────────────────────────────────────────────────
  {
    id: 's3',
    number: '3',
    title: 'Daily Workflow (Step-by-Step)',
    blocks: [
      { type: 'info', content: 'This is the order of operations every day. Don\'t skip steps. Don\'t reorder them unless there\'s an actual reason.' },
      { type: 'h3', content: 'Operating hours' },
      { type: 'ul', items: [
        '**Mon–Thu:** 8:30am – 5:00pm ACST',
        '**Fri:** 8:30am – 2:30pm ACST',
      ]},
      { type: 'h3', content: 'Team shape' },
      { type: 'ul', items: [
        '**1 in-house CC** (Adelaide HQ) — owns daily ops, in-office returns, Fault Portal, escalations',
        '**Offshore team** — handles bulk ticket processing, morning Sera review, after-hours sweeps where covered',
      ]},
      { type: 'warning', content: '**Single point of failure — no backup exists for in-office returns.** Offshore can handle tickets; nobody else processes physical returns. Bosses will jump in if absolutely necessary, but there\'s no formal backup. **Historical precedent:** Last extended absence → returns piled up, refunds were issued before returns were processed/inspected. That\'s a financial leak and a quality gap. **Before any planned absence:** - Clear the full returns pile in the week leading up - Set expectations in Slack about what happens to returns during the gap - Put a hold on change-of-mind refunds until physical inspection resumes - Don\'t issue refunds for unreturned or uninspected products "to keep the queue clean" — that\'s how money walks out the door.' },
      { type: 'h3', content: 'Start of day (first 30 min)' },
      { type: 'h4', content: 'Step 1 — Clear order errors (NP + Borderless)' },
      { type: 'p', content: 'Errors block fulfilment. If you don\'t clear them first, everything else you do today is building on delayed orders.' },
      { type: 'ul', items: [
        'Log in to **NP Fulfilment** → Orders → click the red error bubble → resolve each',
        'Log in to **Borderless** → check error queue → resolve each',
        'Flag anything you can\'t resolve yourself to the CC Lead in Slack `#cc-ops`',
      ]},
      { type: 'h4', content: 'Step 2 — Sweep for cancellations' },
      { type: 'p', content: 'Cancellation requests are the single most time-sensitive thing in the inbox. Once 4am rolls past and orders hit the 3PL, cancellation is no longer possible — the customer has to do a full return.' },
      { type: 'ul', items: [
        'Check **Sera** (AI bot) first — Sera scans for cancellation requests and can action simple ones',
        'Open Commslayer → filter for "cancel" / "cancellation" / "wrong order" / "double order"',
        'Action any cancellation requests **before** any other ticket type',
        'Check Commslayer + Meta DMs + IG DMs for cancellation requests',
        '**End-of-shift sweep:** run the same check again before logging off — late-arriving cancellation requests that miss the 4am cutoff become returns, which is a worse experience and more work',
      ]},
      { type: 'warning', content: '**Sera is a backstop, not a replacement.** The model is still limited and will miss ambiguous requests (e.g. "can I change my order?" which could be cancellation or modification). Always human-verify Sera\'s actioned queue and manually sweep for anything Sera flagged but didn\'t action.' },
      { type: 'warning', content: '**Cancellation cutoff is 4am AEST — AU orders only.** US (Borderless) and NZ/ROW (Portless) operate on different cutoffs. Default rule: **pick up cancellation requests as fast as you can regardless of region** — the longer they sit, the more likely the order has hit the 3PL.' },
      { type: 'info', content: '**Out-of-hours habit:** A 5-minute Sunday evening sweep for cancellation requests saves significant weekday work and gives customers a much better experience than forcing a return.' },
      { type: 'h3', content: 'Mid-morning (next 1–2 hours)' },
      { type: 'h4', content: 'Step 3 — Work awaiting conversations' },
      { type: 'p', content: 'These are tickets where the customer has replied to us. They\'ve already waited at least once. Don\'t make them wait again.' },
      { type: 'ul', items: [
        'Commslayer → Awaiting filter → oldest first',
        'Target: every awaiting conversation touched within 4 business hours',
      ]},
      { type: 'h4', content: 'Step 4 — Work unresolved conversations' },
      { type: 'p', content: 'New inbound that hasn\'t been opened yet.' },
      { type: 'ul', items: [
        'Commslayer → Unresolved → oldest first',
        'Batch similar queries (e.g. all "where\'s my order" tickets together) for speed',
      ]},
      { type: 'h3', content: 'Ongoing throughout the day' },
      { type: 'h4', content: 'Step 5 — Product DM handling' },
      { type: 'p', content: 'CC handles **product-specific DMs only.** Anything non-product (brand comments, creator outreach, general engagement) belongs to the Social Media Lead or PR Manager. If you\'re unsure, ping `#cc-ops` rather than replying.' },
      { type: 'ul', items: [
        '**IG DMs (product questions / order issues):** flow through Commslayer — handle there',
        '**Messenger DMs:** handle in Commslayer. Use **Meta Business Suite as a backup** if the Commslayer sync ever drops (it has before)',
        '**IG inbox on SnapWireless account:** only action messages in the **General** folder. Primary folder belongs to the PR Manager (creator outreach, etc.)',
        '**Non-product DMs** (brand vibes, general comments, content collab) → route to Social Media Lead via Slack DM or Commslayer tag (`@social-media-lead` [CONFIRM tag name])',
      ]},
      { type: 'warning', content: 'If you move an IG message from Primary into General, **mark it unread** so the PR Manager still sees it on their side.' },
      { type: 'h4', content: 'Step 6 — Case + fault tracking' },
      { type: 'p', content: 'Anything that becomes a case (fault, return, replacement, ongoing issue) goes into the **Fault Portal** — not just Commslayer.' },
      { type: 'ul', items: [
        'Log the case in the Fault Portal with customer info, order reference, fault type, and current status',
        'Update the case as it moves through investigation → resolution → closure',
        'Supporting evidence (videos, photos, customer comms screenshots) goes into the linked Google Drive folder',
        'Public comment engagement, TikTok inbox triage, and YouTube comment moderation are **not CC responsibilities** — owned by Social Media Lead',
      ]},
      { type: 'h3', content: 'End of day (last 15 min)' },
      { type: 'checklist', items: [
        'End-of-shift cancellation sweep (Sera + manual)',
        'All cancellations for the day actioned',
        'No awaiting conversations older than 24 hrs',
        'NP + Borderless error queues at zero (or blockers logged in Slack)',
        'Fault Portal: all new cases from today logged, all existing cases updated',
        'Any unresolved items flagged with clear handover notes for the next shift',
      ]},
    ],
  },

  // ── 4. Tools & Systems ─────────────────────────────────────────────────────
  {
    id: 's4',
    number: '4',
    title: 'Tools & Systems',
    blocks: [
      { type: 'h3', content: 'Fault Portal (cases + returns tracker)' },
      { type: 'p', content: '**What:** Internal portal that tracks every fault case, return, and replacement from open → resolved. Also houses the in-office returns tracker. **URL:** https://fault-portal.vercel.app/cases **Ownership:** In-house CC owns + maintains the portal. **Access:** Open to anyone with the link — no login required. Treat the URL as internal. **When:** Every fault report, return, and replacement case — logged here in addition to Commslayer.' },
      { type: 'ul', items: [
        'This is the master tracker for case-level work. Commslayer handles the conversation; the portal tracks the case itself.',
        'The in-office returns log lives here too — no separate tracker.',
        'Pair with Google Drive for evidence files (videos, photos, screenshots of customer comms) — link the Drive folder on each case record.',
        'Review open cases weekly — anything sitting >14 days without movement needs escalation.',
      ]},
      { type: 'h3', content: 'Sera (AI cancellation bot)' },
      { type: 'p', content: '**What:** Internal AI bot that scans inbound comms for cancellation requests and can action simple, unambiguous ones. **When:** Start of day + end of shift, as a backstop to manual sweeps. **Ownership:**' },
      { type: 'ul', items: [
        '**Offshore lead** reviews Sera\'s overnight actions each morning to confirm the bot behaved as intended',
        'Offshore lead actions any issues and alerts the in-house manager',
        'In-house CC stays looped in on any Sera misfires so patterns can be spotted',
      ]},
      { type: 'p', content: '**Key notes:**' },
      { type: 'ul', items: [
        'Sera misses ambiguous language (e.g. "can I change my order?"). Always do a manual sweep alongside.',
        'If you catch a Sera error during the day (e.g. cancelled the wrong order, missed a clear request), flag it immediately in `#cc-ops` so it can be reinstated and the pattern logged.',
        'Sera is a time-saver, not a substitute for reading the inbox.',
      ]},
      { type: 'h3', content: 'Shopify' },
      { type: 'p', content: '**What:** Source of truth for customer orders, addresses, line items, order timeline, refund processing. **When:** Every ticket that references an order — pull the order up before replying. **Key notes:** All refunds are actioned here. Never assume the order status from what the customer says — always check Shopify.' },
      { type: 'h3', content: 'Commslayer (CS)' },
      { type: 'p', content: '**What:** Primary helpdesk. Ticket queue, customer history, team assignment, macros. **When:** Default interface for all support comms except Messenger DMs. **Key notes:** If a customer has reached out before, their history is here. Check it before responding — you\'ll often find context that changes your reply.' },
      { type: 'h3', content: 'NP Fulfilment (Australia 3PL)' },
      { type: 'p', content: '**What:** Fulfilment for all AU orders. **When:** Start of day (errors), order tracking lookups, stock returns. **Key notes:** Error clearing is manual. Bulk stock returns go here via TNT.' },
      { type: 'h3', content: 'Borderless (US 3PL)' },
      { type: 'p', content: '**What:** Fulfilment for US orders. **When:** Start of day (errors), US order tracking, US returns processing. **Key notes:** Returns clear in bulk batches — don\'t refund until the return is marked as cleared in Borderless.' },
      { type: 'h3', content: 'Portless (NZ + ROW 3PL)' },
      { type: 'p', content: '**What:** Fulfilment for NZ and rest-of-world orders. **When:** International order tracking, international returns.' },
      { type: 'h3', content: 'Starshipit' },
      { type: 'p', content: '**What:** Shipping label and tracking management. **When:** Tracking lookups, re-generating labels for re-sends.' },
      { type: 'h3', content: 'Google Drive' },
      { type: 'p', content: '**What:** Evidence storage for faulty product cases — videos, photos, and supporting files linked to Fault Portal cases. **When:** Every time a customer sends fault evidence (video, photo) that needs to be attached to a case.' },
      { type: 'ul', items: [
        'Create a **new folder per month** to keep things sorted (e.g. `2026-04-Faults`)',
        'Upload the customer\'s evidence file into that month\'s folder',
        'Link the file URL on the Fault Portal case record',
        'Don\'t rely on Commslayer attachments alone — they get lost when tickets are archived',
      ]},
      { type: 'h3', content: 'Slack' },
      { type: 'p', content: '**What:** Internal comms. Key channels: `#cc-ops`, `#cc-escalations`, `#warehouse`, `#product-faults`. **When:** Every escalation, every blocker, every handover. If it\'s not in Slack it didn\'t happen.' },
      { type: 'h3', content: 'Okendo' },
      { type: 'p', content: '**What:** Post-purchase review collection (auto-emails customers after delivery). **When:** Daily — work negative/average reviews (detractor → advocate). Request 4–5 star reviewers to re-post on ProductReview. **Key notes:** Credit/discount is offered to customers who leave a review. Check Commslayer first before contacting a negative reviewer — avoid reaching out to someone already in an open ticket.' },
      { type: 'h3', content: 'Meta Business Suite (FB + IG)' },
      { type: 'p', content: '**What:** FB + IG inbox + content management. **When:** Backup for Messenger if Commslayer sync drops. Otherwise primarily owned by Social Media Lead for community engagement. **Key notes:** Messenger and IG DMs sync to Commslayer — handle there by default. If sync breaks, fall back to Meta Business Suite directly until it\'s restored.' },
      { type: 'h3', content: 'TikTok' },
      { type: 'p', content: '**What:** Comment + DM handling for `@snapwireless` and `@behindthesnap`. **When:** Daily activity sweep. **Key notes:** Activity tab shows everything since the last time anyone in the office opened the app — so if it\'s been a few days, there\'s catch-up to do.' },
      { type: 'h3', content: 'ProductReview / Trustpilot' },
      { type: 'p', content: '**What:** Third-party review sites. Monitored, not managed directly. **When:** Weekly sweep for new reviews. Any negative review triggers an outreach attempt (see Section 7).' },
    ],
  },

  // ── 5. Customer Support SOP (CORE) ────────────────────────────────────────
  {
    id: 's5',
    number: '5',
    title: 'Customer Support SOP (CORE)',
    blocks: [
      { type: 'p', content: 'This is the decision tree for any inbound customer ticket.' },
      { type: 'h3', content: 'Step 1 — Triage' },
      { type: 'p', content: '**Read the ticket fully before replying.** Not the subject line — the full message. Most bad replies come from responding to what you thought was asked.' },
      { type: 'p', content: '**Classify:**' },
      { type: 'ul', items: [
        '**Cancellation request** → highest priority (see Section 12 playbook)',
        '**Missing delivery** → investigate before replying',
        '**Faulty product** → request evidence (video + order #) before committing',
        '**General enquiry** → standard response',
        '**Complaint / angry customer** → de-escalate first, solve second',
        '**Corporate / wholesale** → route to Section 9 workflow',
      ]},
      { type: 'h3', content: 'Step 2 — Investigation' },
      { type: 'p', content: 'Before you reply to anything order-related:' },
      { type: 'checklist', items: [
        'Pull the Shopify order',
        'Check the shipping status (Starshipit / 3PL)',
        'Check Commslayer history for prior contact',
        'Check if the customer has open tickets on other channels (IG, FB, Okendo)',
      ]},
      { type: 'warning', content: 'Don\'t reply to a faulty-product claim based on the customer\'s word alone. Always request a short video and order number.' },
      { type: 'p', content: '**Standard evidence request:**' },
      { type: 'quote', content: '"Sorry to hear you\'re having trouble with the [product]. So we can get this sorted for you quickly, could you send through a short video showing the issue, along with your order number? You can reply here or email help@snapwireless.com.au."' },
      { type: 'h3', content: 'Step 3 — Resolution' },
      { type: 'p', content: 'Decide: **refund, replacement, repair, or decline.**' },
      { type: 'p', content: 'SnapWireless offers two overlapping customer protections. Know both and know which one applies:' },
      { type: 'ol', items: [
        '**60-Day Happiness Guarantee** — change of mind or not satisfied within 60 days of purchase. See: https://app.commslayer.com/hc/snap-help-centre/articles/1763595434-snap-s-100-happiness-guarantee',
        '**24-Month Manufacturer\'s Warranty** — manufacturing faults within 24 months. See: https://app.commslayer.com/hc/snap-help-centre/articles/1763596611-product-warranty',
      ]},
      { type: 'table', headers: ['Situation', 'Default action'], rows: [
        ['Faulty unit, ≤60 days, clear video evidence', 'Replacement (preferred) or refund — covered by both Happiness Guarantee + Warranty'],
        ['Faulty unit, 60 days – 24 months', 'Replacement under manufacturer\'s warranty'],
        ['Faulty unit, >24 months', 'Out of warranty, goodwill gesture only with Lead approval'],
        ['Change of mind, ≤60 days', 'Happiness Guarantee — customer returns. Two options: prepaid Starshipit label ($9.50 deducted from refund) OR customer ships at own cost (no deduction). See Section 6.5.'],
        ['Change of mind, >60 days', 'Not covered — decline politely, offer discount code as goodwill'],
        ['Missing delivery, tracking shows delivered', 'Investigate with courier first, then case-by-case'],
        ['Customer-caused damage (drops, water, misuse clearly shown in video)', 'Decline, politely — offer discount code on replacement purchase'],
        ['Wrong item shipped', 'Replacement + prepaid return label, no customer cost'],
      ]},
      { type: 'info', content: '**Replacement beats refund when possible.** A customer with a working product is a potential advocate. A refunded customer is gone.' },
      { type: 'warning', content: '**Refund timeline in customer comms:** Always say "3–5 business days **once the return is processed at our office**" — not from the date of request. Returns sit in the PO box until the weekly pickup, so the clock doesn\'t start at "I want to return this."' },
      { type: 'h3', content: 'Step 4 — The Three-Strike Rule [CONFIRM with Lead]' },
      { type: 'p', content: 'Applied to repeat fault claims from the same customer on the same product line:' },
      { type: 'ul', items: [
        '**Strike 1:** Replace, no questions asked after evidence check.',
        '**Strike 2:** Replace, but flag the customer record in Commslayer and log the pattern in Slack `#cc-escalations`. Ask clarifying questions about usage.',
        '**Strike 3:** Escalate to CC Lead before any further action. Possible outcomes: refund and close relationship, alternative product offer, or decline with detailed explanation.',
      ]},
      { type: 'p', content: 'The rule exists because a small number of customers will repeatedly claim faults regardless of product condition. We protect the business and our other customers by spotting the pattern early — not by being mean to people with genuine problems.' },
      { type: 'h3', content: 'Step 5 — Customer-caused fault logic' },
      { type: 'p', content: 'If video clearly shows:' },
      { type: 'ul', items: [
        'Physical damage (drop, impact, crack)',
        'Water damage',
        'Use with non-compatible accessories / chargers',
        'Modification or disassembly',
      ]},
      { type: 'p', content: 'Then:' },
      { type: 'ol', items: [
        'Respond with care — the customer is still a customer',
        'Explain clearly what the video shows and why it falls outside warranty',
        'Offer a one-time discount code on a replacement purchase',
        'Do not issue a free replacement',
      ]},
      { type: 'p', content: '**Example response:**' },
      { type: 'quote', content: '"Thanks for the video — it really helps us understand what\'s happening. From what I can see, [specific observation, e.g. there\'s impact damage to the casing near the USB-C port]. Unfortunately that falls outside what our warranty covers, as it\'s physical damage rather than a manufacturing fault. I can offer you a 20% discount code on a replacement if that helps — just let me know and I\'ll send it through."' },
      { type: 'h3', content: 'Step 6 — Escalation triggers' },
      { type: 'p', content: '**Use judgment.** There\'s no fixed safety-keyword checklist — escalate based on what a reasonable person would consider serious. The categories below are guides, not exhaustive.' },
      { type: 'p', content: '**Escalate immediately to CC Lead + Slack `#cc-escalations` if you see any of:**' },
      { type: 'ul', items: [
        '**Safety-related language** — anything implying physical harm, damage to property, or risk to people/pets (e.g. fire, smoke, burning, melted, exploded, shock, injury, hospital, kid or pet harmed). When in doubt, escalate.',
        '**Threats of legal action**',
        '**Threats of public complaint** (media, ACCC, Fair Trading, BBB, social media callout)',
        '**Repeat complaints** from the same customer not resolved in 2+ rounds',
        '**Pattern faults** — multiple customers reporting the same issue in the same week (potential batch problem → flag to Product team)',
      ]},
      { type: 'warning', content: 'Safety-related tickets **pause all other work.** Stop, escalate, and do not respond until the Lead has reviewed.' },
      { type: 'h3', content: 'After-hours safety coverage' },
      { type: 'p', content: 'There\'s limited after-hours coverage, but not zero:' },
      { type: 'ul', items: [
        'An **AI program monitors a dedicated Slack channel** and pings when concerning language appears in inbound messages over the weekend',
        'The Lead checks this channel periodically on weekends',
        '**Planned:** a team member covering weekends in lieu of weekday hours [CONFIRM once scheduled]',
      ]},
      { type: 'p', content: 'If you catch a safety ticket after hours and there\'s genuine urgency (customer in distress, active safety concern), post in `#cc-escalations` — the ping should route to someone. Otherwise, it gets full handling first thing next business morning.' },
    ],
  },

  // ── 6. Returns & Maintenance SOP ──────────────────────────────────────────
  {
    id: 's6',
    number: '6',
    title: 'Returns & Maintenance SOP',
    blocks: [],
  },
  {
    id: 's6-1',
    number: '6.1',
    title: 'Return to Sender (RTS)',
    parentId: 's6',
    blocks: [
      { type: 'p', content: 'When an order bounces back to the 3PL due to failed delivery / wrong address:' },
      { type: 'ol', items: [
        'Contact customer via Commslayer — confirm correct address',
        'Once confirmed, arrange re-ship with 3PL (any cost recovery per policy)',
        'If customer has gone silent for 14+ days → refund minus shipping, stock returns to general inventory',
      ]},
    ],
  },
  {
    id: 's6-2',
    number: '6.2',
    title: 'In-office returns',
    parentId: 's6',
    blocks: [
      { type: 'p', content: 'A driver collects outbound office-packed orders and drops off returns delivered to our PO box. Process returns **at least once a week.**' },
      { type: 'p', content: '**Process:**' },
      { type: 'ol', items: [
        '**Sort by condition:** Sealed items → group together for next NP stock transfer. Opened items → inspect each',
        '**Inspect opened units:** Functional test. Visual condition check. If fully working + good condition → reseal, add to sealed stock pile. If cosmetic damage → swap replacement sleeves / packaging from spares, then reseal. If non-functional → separate pile for write-off or parts salvage',
        '**Package for resale** using spare PowerPack Universal sleeves / boxes from office stock (PowerPack is our main seller — always keep spares ready)',
        '**Log** each return action in the Fault Portal — this houses the in-office returns tracker',
      ]},
    ],
  },
  {
    id: 's6-3',
    number: '6.3',
    title: 'Bulk US returns (Borderless)',
    parentId: 's6',
    blocks: [
      { type: 'p', content: 'Borderless clears US returns in batches. There\'s no clean real-time view.' },
      { type: 'p', content: '**Process:**' },
      { type: 'ul', items: [
        'Monitor Borderless returns dashboard weekly',
        'When a batch clears, match returns to customer tickets in Commslayer',
        'Issue refunds for each resolved return',
        'Flag any unmatched returns to the CC Lead',
      ]},
      { type: 'info', content: 'Don\'t refund a US return before Borderless has marked it as cleared. You\'ll occasionally get phantom returns that never actually arrive.' },
    ],
  },
  {
    id: 's6-4',
    number: '6.4',
    title: 'NZ + Rest-of-World returns (Portless)',
    parentId: 's6',
    blocks: [
      { type: 'warning', content: '**We don\'t operate a managed returns process in NZ or ROW — and it\'s not just a policy choice.** Most international couriers won\'t ship lithium battery packs. That\'s a shipping-regulation constraint, not an optional service.' },
      { type: 'p', content: '**For change-of-mind returns (NZ/ROW):** customer finds a courier that will accept lithium shipments and pays the cost themselves. We don\'t provide labels.' },
      { type: 'p', content: '**At point of sale / pre-purchase enquiries:** set expectations early. International customers should understand before they buy that returns are effectively on them.' },
      { type: 'p', content: '**For faulty products (NZ/ROW):** same physical constraint — but treat as warranty and work with the customer case-by-case. Options:' },
      { type: 'ul', items: [
        'Replacement shipped out (our cost via Portless) without requiring return of the faulty unit, if the fault is clear from video evidence',
        'Refund without requiring return, if replacement isn\'t practical',
      ]},
      { type: 'p', content: '**Template (change of mind):**' },
      { type: 'quote', content: '"Just so you know upfront — for international orders, we\'re not able to organise a return ourselves because most couriers won\'t ship lithium battery packs across borders. If you\'d still like to return the product, you\'d need to find a courier willing to accept it and cover the shipping cost yourself. For faulty products we handle things differently — let me know which situation applies and I\'ll walk you through the next steps."' },
    ],
  },
  {
    id: 's6-5',
    number: '6.5',
    title: 'Return shipping policy (AU)',
    parentId: 's6',
    blocks: [
      { type: 'p', content: 'The 60-Day Happiness Guarantee covers change of mind, even on opened/used product. Customers have **two return options** — make sure both are explained:' },
      { type: 'table', headers: ['Option', 'Cost to customer', 'Process'], rows: [
        ['**Prepaid return label** (we generate via Starshipit)', '$9.50 deducted from refund', 'Customer emails help@snapwireless.com.au requesting a returns form. CC generates label via Starshipit.'],
        ['**Customer arranges own shipping**', 'Whatever they pay their courier', 'No deduction from refund. Customer ships to our PO box at their own cost.'],
      ]},
      { type: 'p', content: '**Refund timing:** 3–5 business days after the return lands at the office and is inspected.' },
      { type: 'p', content: '**For faulty products:** no deduction — prepaid label issued and full refund / replacement as per warranty.' },
      { type: 'warning', content: '**Don\'t auto-deduct $9.50.** Only apply it when the customer chose the prepaid label option. If they shipped themselves, no fee.' },
      { type: 'info', content: '**Phrasing matters.** A customer reading "100% Happiness Guarantee" who then sees an unexpected $9.50 deduction will feel misled. Always explain both options upfront so they\'re choosing knowingly.' },
    ],
  },
  {
    id: 's6-6',
    number: '6.6',
    title: 'Sending stock back to NP (via TNT)',
    parentId: 's6',
    blocks: [
      { type: 'p', content: 'When office sealed-stock pile reaches transfer threshold [CONFIRM threshold]:' },
      { type: 'ol', items: [
        'Count and record units by SKU',
        'Pack into shipping-grade boxes',
        'Book TNT pickup',
        'Notify NP with inbound reference',
        'Reconcile with NP inventory within 5 business days of receipt',
      ]},
    ],
  },

  // ── 7. Community & Review Management ──────────────────────────────────────
  {
    id: 's7',
    number: '7',
    title: 'Community & Review Management',
    blocks: [],
  },
  {
    id: 's7-1',
    number: '7.1',
    title: 'Okendo — Negative review recovery (detractor → advocate)',
    parentId: 's7',
    blocks: [
      { type: 'p', content: '**For 1–3 star reviews:**' },
      { type: 'ol', items: [
        'Check Commslayer first — has this customer already reached out? If yes, note the ticket ID and don\'t double-contact.',
        'If they haven\'t reached out, respond via Okendo:',
      ]},
      { type: 'quote', content: '"Hi [Name], Sorry to hear about the issues you\'re experiencing — this isn\'t what we want to hear. If you can send a short video and brief description of the issue along with your order number to **help@snapwireless.com.au**, one of our team will get a solution sorted for you."' },
      { type: 'ol', items: [
        'Log the outreach — if they respond, treat as a standard ticket from that point.',
      ]},
    ],
  },
  {
    id: 's7-2',
    number: '7.2',
    title: 'Okendo — Positive review amplification (ProductReview)',
    parentId: 's7',
    blocks: [
      { type: 'p', content: '**For 4–5 star reviews** (those that aren\'t auto-posted by the system):' },
      { type: 'p', content: 'Use this template, personalised with the customer\'s name and product:' },
      { type: 'quote', content: '"Hi [Name],\n\nThank you so much for your review and your love for our brand and products — we really do appreciate it! I just wanted to ask for a small favour.\n\nOur goal at Snap is to create amazing products and give the best possible customer experience. I know you\'ve already left us a review, and we\'re extremely grateful for this. I\'m just asking if you could please leave your review again on ProductReview.\n\nWe collect thousands of reviews — positive and negative — on our website. These aren\'t automatically reflected on third-party public review sites. So your review of us isn\'t displayed there for others to see, which means our true customer and product experience isn\'t reflected accurately on those platforms. That\'s not fair for our existing customers, our team, or future customers.\n\nIf you have a minute, we\'d love it if you could leave a short review and rating here: **https://www.productreview.com.au/listings/snap-wireless/write-review**\n\nThe team and I really appreciate your help, and we promise to keep delivering amazing products and customer experience.\n\nP.S. — Feel free to join our SnapWireless Community group for new product launches, VIP sale access and giveaways: **https://www.facebook.com/groups/778012532890285**\n\nThanks so much, [Your name] — Customer Care Specialist"' },
      { type: 'info', content: '**Why we do this:** Unhappy customers leave public reviews without prompting. Happy customers usually don\'t. Without active outreach, our public review score will always skew more negative than our actual customer experience.' },
    ],
  },
  {
    id: 's7-3',
    number: '7.3',
    title: 'Trustpilot',
    parentId: 's7',
    blocks: [
      { type: 'p', content: 'Same philosophy as Okendo — respond to every review.' },
      { type: 'ul', items: [
        '**5-star:** short, warm thank-you. Acknowledge what they specifically liked if they mentioned something.',
        '**4-star:** thank them, ask what would\'ve made it 5 (feeds product + ops insights).',
        '**1–3 star:** reach out to understand the issue, offer to make it right. Move to DM / email as soon as possible.',
        '**Target:** keep overall Trustpilot rating above 4 stars.',
      ]},
      { type: 'info', content: 'Responding to positive reviews isn\'t just politeness — it signals to future buyers reading reviews that the brand is active and cares. Silent 5-star reviews are worth less than acknowledged ones.' },
    ],
  },
  {
    id: 's7-5',
    number: '7.5',
    title: 'YouTube comment moderation',
    parentId: 's7',
    blocks: [
      { type: 'warning', content: '**Owned by Social Media Lead, not CC.** If a YouTube comment is specifically a product question that needs technical support, Social Media Lead will route it to CC. Otherwise it\'s not our queue.' },
    ],
  },
  {
    id: 's7-6',
    number: '7.6',
    title: 'Tone for public responses (reference only)',
    parentId: 's7',
    blocks: [
      { type: 'p', content: 'Reference guidance for the rare case CC responds publicly (e.g. a ProductReview response). Default assumption: Social Media Lead handles public posts.' },
      { type: 'p', content: '**Public** (rare for CC — ProductReview responses, occasional Okendo public replies):' },
      { type: 'ul', items: [
        'Shorter than DMs — people skim',
        'No long paragraphs — 1–3 lines max',
        'Never argue publicly — move to DM if things get heated',
        'Never share order specifics publicly',
      ]},
      { type: 'p', content: '**Private** (DMs, email, Commslayer — our default):' },
      { type: 'ul', items: [
        'Full detail is fine',
        'Order numbers, tracking, refund amounts all OK',
      ]},
    ],
  },

  // ── 8. CX — Product DM Handling ───────────────────────────────────────────
  {
    id: 's8',
    number: '8',
    title: 'CX — Product DM Handling',
    blocks: [
      { type: 'warning', content: '**Scope reminder:** Public comment engagement is owned by Social Media Lead. This section is about how CC handles **product-specific DMs** — which is what lands in our lap day-to-day.' },
    ],
  },
  {
    id: 's8-1',
    number: '8.1',
    title: 'What a "product DM" looks like',
    parentId: 's8',
    blocks: [
      { type: 'ul', items: [
        '"Which PowerPack fits my iPhone 15 Pro?"',
        '"My charger isn\'t working — is this the cable or the pad?"',
        '"Can I get this shipped to NZ?"',
        '"Is the new model available yet?"',
        '"My order hasn\'t arrived, can you check tracking?"',
      ]},
      { type: 'p', content: 'If it\'s about a product or an order, it\'s ours. If it\'s a brand vibes comment, a content creator reach-out, or general engagement — it goes to Social Media Lead.' },
    ],
  },
  {
    id: 's8-2',
    number: '8.2',
    title: 'When to be casual vs informative',
    parentId: 's8',
    blocks: [
      { type: 'ul', items: [
        '**Informative (default for product DMs)** — clear, factual, minimal emoji: product fit, warranty queries, shipping questions, troubleshooting.',
        '**Casual** — only when the DM is light (e.g. "just got mine, love it!"). Keep replies short, warm, and don\'t force product talk.',
      ]},
      { type: 'p', content: '**Never casual:**' },
      { type: 'ul', items: [
        'Complaints',
        'Fault claims',
        'Refund / cancellation conversations',
        'Any DM with a negative sentiment',
      ]},
    ],
  },
  {
    id: 's8-3',
    number: '8.3',
    title: 'Response variation',
    parentId: 's8',
    blocks: [
      { type: 'p', content: 'When you\'re answering the same product question 10 times in a day, rotate 3–4 variations rather than copy-pasting the same reply. Even in DMs, repetitive language reads as automated.' },
      { type: 'info', content: 'If a product question is coming in repeatedly via DM, it\'s a signal for Section 8B (Customer Education & Resources) — that question needs a help centre article or an updated product page.' },
    ],
  },

  // ── 8B. Customer Education & Resources ────────────────────────────────────
  {
    id: 's8b',
    number: '8B',
    title: 'Customer Education & Resources',
    blocks: [
      { type: 'p', content: 'This is the work we do so customers don\'t need to contact us in the first place. Every article, tutorial, or FAQ entry that answers a common question is a ticket we don\'t have to handle.' },
      { type: 'info', content: '**The maths:** If a piece of content prevents 10 tickets a month, it pays for itself in a week. If it prevents 100, it changes the team\'s capacity.' },
    ],
  },
  {
    id: 's8b-1',
    number: '8B.1',
    title: 'What it is',
    parentId: 's8b',
    blocks: [
      { type: 'ul', items: [
        'Product guides, FAQs, troubleshooting articles on the help centre',
        'Video tutorials (how to use, how to troubleshoot, unboxing)',
        'Onboarding content sent after purchase',
        'Product update announcements when features change',
      ]},
    ],
  },
  {
    id: 's8b-2',
    number: '8B.2',
    title: 'What it isn\'t',
    parentId: 's8b',
    blocks: [
      { type: 'ul', items: [
        'A replacement for human support on complex or emotional issues',
        'Pure marketing content — the goal is education, not promotion',
        'Static — content rots as products change. Keep it alive.',
      ]},
    ],
  },
  {
    id: 's8b-3',
    number: '8B.3',
    title: 'Ongoing responsibilities',
    parentId: 's8b',
    blocks: [
      { type: 'table', headers: ['Task', 'Cadence', 'Owner'], rows: [
        ['Review top 10 inbound ticket topics, write/update help centre content for each', 'Monthly', 'CC team'],
        ['Audit existing help centre articles for accuracy', 'Quarterly', 'CC Lead'],
        ['Create tutorial content for new product launches', 'Per launch', 'CC + Content'],
        ['Update onboarding email flow based on common new-customer questions', 'Quarterly', 'CC Lead + Marketing'],
        ['Track "reduction in basic support queries" as a KPI', 'Monthly', 'CC Lead'],
      ]},
    ],
  },
  {
    id: 's8b-4',
    number: '8B.4',
    title: 'Content loop',
    parentId: 's8b',
    blocks: [
      { type: 'p', content: 'Every ticket is a signal. If you answer the same question five times in a week, that\'s a help centre article waiting to be written.' },
      { type: 'p', content: '**Simple process:**' },
      { type: 'ol', items: [
        'Tag repeat-topic tickets in Commslayer [CONFIRM tagging convention]',
        'Monthly: pull top 10 tags',
        'For each: is there a help centre article? If no, write one. If yes, is it findable/useful? If not, fix it.',
        'When a new article is published, update the canned responses that would\'ve answered that query — point customers to the article instead of repeating yourself.',
      ]},
      { type: 'warning', content: 'Don\'t write content just to write content. If nobody searches for it, it\'s noise. Track which articles actually get views.' },
    ],
  },

  // ── 8C. Customer Engagement, Retention & Loyalty ──────────────────────────
  {
    id: 's8c',
    number: '8C',
    title: 'Customer Engagement, Retention & Loyalty',
    blocks: [
      { type: 'p', content: 'One-time buyers are nice. Repeat buyers are the business.' },
      { type: 'p', content: 'This is the work that turns a single purchase into a long-term customer and a long-term customer into an advocate. It\'s the layer beyond "answer the ticket" — it\'s everything we do to make customers want to come back.' },
    ],
  },
  {
    id: 's8c-1',
    number: '8C.1',
    title: 'What this looks like day-to-day',
    parentId: 's8c',
    blocks: [
      { type: 'ul', items: [
        'Following up on Okendo 5-star reviews with ProductReview outreach (already in Section 7.2)',
        'Proactively checking in with customers who had a bad experience and were made whole — did the replacement arrive? Are they happy?',
        'Tagging VIP customers in Commslayer for priority handling — **VIP criteria: lifetime spend >$1,000**',
        'Surfacing community-driven insights from CX channels back to product + marketing',
      ]},
    ],
  },
  {
    id: 's8c-2',
    number: '8C.2',
    title: 'Loyalty program operations',
    parentId: 's8c',
    blocks: [
      { type: 'warning', content: '**No loyalty program currently exists.** To be built out — Marketing owns the design when it happens. This subsection is a placeholder for when the program launches.' },
      { type: 'p', content: 'When a loyalty program does launch, CC&E\'s role will be:' },
      { type: 'ul', items: [
        'Handle customer questions about points, rewards, redemption',
        'Process goodwill point adjustments for service recovery',
        'Flag abuse patterns (multiple accounts, points farming) to Marketing',
        'Feed program feedback back to Marketing monthly',
      ]},
    ],
  },
  {
    id: 's8c-3',
    number: '8C.3',
    title: 'Retention outreach',
    parentId: 's8c',
    blocks: [
      { type: 'p', content: '**Proactive touchpoints we run:**' },
      { type: 'ul', items: [
        '**Post-resolution check-in:** For any ticket resolved with a replacement or refund, a light-touch follow-up 2 weeks later asking how things are going. Keep it human, not surveyed.',
        '**Lapsed-customer re-engagement:** [CONFIRM with Marketing] If a customer hasn\'t ordered in 12+ months, a targeted message — but only when it adds value (new product they\'d care about, not a generic discount).',
        '**VIP recognition:** Customers with >$1,000 lifetime spend get a flagged Commslayer record for priority handling and occasional handwritten thank-you notes from the office [CONFIRM cadence].',
      ]},
    ],
  },
  {
    id: 's8c-4',
    number: '8C.4',
    title: 'Feedback into product + marketing',
    parentId: 's8c',
    blocks: [
      { type: 'p', content: 'Everything we hear in CC is signal. Run a monthly digest to `#product-feedback` covering:' },
      { type: 'ul', items: [
        'Top 5 recurring fault types (if any trending)',
        'Top 5 feature requests or product questions',
        'Sentiment shifts in reviews (are CSAT / NPS moving?)',
        'Competitor mentions (customers comparing us to X)',
      ]},
      { type: 'info', content: 'The CC team usually knows a product problem weeks before the product team does. That\'s only valuable if we actually flag it.' },
    ],
  },

  // ── 9. Corporate / Wholesale SOP ──────────────────────────────────────────
  {
    id: 's9',
    number: '9',
    title: 'Corporate / Wholesale SOP',
    blocks: [
      { type: 'info', content: '[CONFIRM full workflow with Wholesale Lead — scaffolding below]' },
    ],
  },
  {
    id: 's9-1',
    number: '9.1',
    title: 'Lead intake',
    parentId: 's9',
    blocks: [
      { type: 'p', content: 'Corporate leads arrive via:' },
      { type: 'ul', items: [
        '`help@snapwireless.com.au` (tagged "corporate")',
        'Contact form on site',
        'Referrals from sales team',
        'Trade show leads',
      ]},
      { type: 'p', content: '**Required information before quoting:**' },
      { type: 'ul', items: [
        'Company name + ABN',
        'Contact name, email, phone',
        'Use case (corporate gift, resale, internal use)',
        'Quantity required',
        'Target delivery date',
        'Shipping destinations',
        'Co-branding / custom packaging requirements',
      ]},
    ],
  },
  {
    id: 's9-2',
    number: '9.2',
    title: 'Quoting workflow',
    parentId: 's9',
    blocks: [
      { type: 'ol', items: [
        'Acknowledge within **4 business hours** with intake questions',
        'Once info is complete → forward to Wholesale Lead with internal brief',
        'Wholesale Lead returns quote within **2 business days**',
        'CC sends quote to customer, manages follow-up',
        'On acceptance → hand to Operations for PO + production',
      ]},
    ],
  },
  {
    id: 's9-3',
    number: '9.3',
    title: 'Production timelines [CONFIRM with Ops]',
    parentId: 's9',
    blocks: [
      { type: 'ul', items: [
        'Standard stock, no customisation: ship within **5 business days**',
        'Custom branded packaging: **4–6 weeks**',
        'Fully custom product: **8–12 weeks**',
      ]},
    ],
  },
  {
    id: 's9-4',
    number: '9.4',
    title: 'Risk management',
    parentId: 's9',
    blocks: [
      { type: 'warning', content: '**Always over-communicate risk on timelines.** A corporate client with a specific event date (conference, launch, Christmas) needs a 2-week buffer built in. If shipping is borderline, flag it before they commit — not after.' },
      { type: 'p', content: '**Red flags to escalate:**' },
      { type: 'ul', items: [
        'Client wants delivery inside our minimum lead time',
        'Multi-destination international shipping',
        'Payment terms outside of standard (Net 30 / Net 60 requests)',
        'Quantities that would deplete consumer stock',
      ]},
    ],
  },

  // ── 10. ACS — Studio Operations ───────────────────────────────────────────
  {
    id: 's10',
    number: '10',
    title: 'ACS — Studio Operations',
    blocks: [
      { type: 'info', content: '[CONFIRM with ACS Lead — scaffolding below]' },
    ],
  },
  {
    id: 's10-1',
    number: '10.1',
    title: 'Daily upkeep',
    parentId: 's10',
    blocks: [
      { type: 'checklist', items: [
        'Visual sweep on walk-in (morning)',
        'Reset any moved furniture / props',
        'Check bins',
        'Confirm no bookings clash for the day',
      ]},
    ],
  },
  {
    id: 's10-2',
    number: '10.2',
    title: 'Cleaning process',
    parentId: 's10',
    blocks: [
      { type: 'checklist', items: [
        'Weekly deep clean (vacuum, dust, wipe-down surfaces)',
        'Post-booking spot clean (any marks, debris, moved items)',
        'Quarterly equipment check',
      ]},
    ],
  },
  {
    id: 's10-3',
    number: '10.3',
    title: 'Repainting workflow',
    parentId: 's10',
    blocks: [
      { type: 'ul', items: [
        'Paint touch-ups when walls show marks that don\'t wipe off',
        'Full repaint on a quarterly rotation or when bookings drop below threshold',
        'Schedule at least 48 hours of no-booking time for any repaint',
      ]},
    ],
  },
  {
    id: 's10-4',
    number: '10.4',
    title: 'Booking rules and restrictions',
    parentId: 's10',
    blocks: [
      { type: 'ul', items: [
        'Minimum booking: [CONFIRM]',
        'Maximum booking: [CONFIRM]',
        'No food/drink on set (water only)',
        'No smoke/haze machines without pre-approval',
        'Client responsible for damage beyond normal wear',
        'Booking confirmation requires signed T&Cs + payment',
      ]},
    ],
  },

  // ── 10B. New Hire Onboarding ───────────────────────────────────────────────
  {
    id: 's10b',
    number: '10B',
    title: 'New Hire Onboarding',
    blocks: [
      { type: 'p', content: 'The onboarding model is **shadow-first, drafts-before-send, then independent.** Expect the full path to take around 4 weeks.' },
    ],
  },
  {
    id: 's10b-1',
    number: 'Week 1',
    title: 'Observe + access',
    parentId: 's10b',
    blocks: [
      { type: 'checklist', items: [
        'Shadow the main person through a full daily workflow',
        'Set up logins: Commslayer, Shopify, NP, Borderless, Starshipit, Slack, Meta Business Suite, Okendo, Fault Portal, Google Drive',
        'Read this SOP end-to-end',
        'Read the Snap Help Centre (help.snapwireless warranty + happiness guarantee articles)',
        'Watch the screen-recording examples linked in the source SOP (NP errors, Borderless errors, RTS, returns)',
      ]},
    ],
  },
  {
    id: 's10b-2',
    number: 'Week 2',
    title: 'Product + fault literacy',
    parentId: 's10b',
    blocks: [
      { type: 'checklist', items: [
        'Hands-on time with each product in the range (unbox, assemble, test)',
        'Walk through the common fault types with the main person',
        'Review a sample of closed tickets across fault categories',
        'Learn the Fault Portal — log 3–5 test cases with the main person',
      ]},
    ],
  },
  {
    id: 's10b-3',
    number: 'Week 3',
    title: 'Drafts for approval',
    parentId: 's10b',
    blocks: [
      { type: 'checklist', items: [
        'Start drafting replies to real tickets — **don\'t send without the main person approving first**',
        'Start with low-stakes tickets (general enquiries, shipping questions) before escalations',
        'Get feedback on tone, accuracy, speed',
        'Aim for ~20 approved drafts before moving to independent',
      ]},
    ],
  },
  {
    id: 's10b-4',
    number: 'Week 4',
    title: 'Independent with check-ins',
    parentId: 's10b',
    blocks: [
      { type: 'checklist', items: [
        'Start replying independently on standard tickets',
        'Daily 15-min check-in with the main person for the first two weeks of independence',
        'Escalate anything unfamiliar — especially faults, safety, legal threats',
        'First solo end-of-day review with the main person to verify nothing\'s been missed',
      ]},
    ],
  },
  {
    id: 's10b-5',
    number: 'Ongoing',
    title: 'Ongoing',
    parentId: 's10b',
    blocks: [
      { type: 'checklist', items: [
        'Monthly 1:1 with CC Lead to review CSAT, quality flags, and any patterns',
        'Quarterly SOP review — new hires often spot things veterans miss',
      ]},
      { type: 'info', content: 'There\'s no substitute for handling real tickets. Shadowing helps, but the real learning is in drafting replies and getting feedback.' },
    ],
  },

  // ── 11. KPIs & Performance Expectations ───────────────────────────────────
  {
    id: 's11',
    number: '11',
    title: 'KPIs & Performance Expectations',
    blocks: [
      { type: 'warning', content: '[ALL TARGETS BELOW ARE STARTING PROPOSALS — CONFIRM WITH CC LEAD]' },
      { type: 'p', content: 'Metrics are grouped by the four service pillars from Section 1.' },
    ],
  },
  {
    id: 's11-1',
    number: '11.1',
    title: 'Customer Inquiry Management metrics',
    parentId: 's11',
    blocks: [
      { type: 'table', headers: ['Metric', 'Target', 'Review cadence'], rows: [
        ['CSAT (transactional, /5 scale)', '4.0/5 minimum (baseline 3.5–4.0)', 'Weekly'],
        ['Transactional NPS', 'Track — set target once baselined', 'Monthly'],
        ['Resolution rate (% tickets closed without reopen)', '≥90%', 'Weekly'],
        ['First response time (business hours)', '<2 hours', 'Daily'],
        ['Resolution time (standard ticket)', '<24 hours', 'Daily'],
        ['Tickets resolved per day (offshore)', '60/day', 'Weekly'],
        ['Tickets resolved per day (in-house)', 'No hard target — in-house role is oversight, escalations, returns, Fault Portal', 'Weekly'],
        ['Total ticket volume', 'Track — set target against trend', 'Weekly'],
        ['Awaiting conversations >24 hrs', '0 at end of day', 'Daily'],
      ]},
      { type: 'info', content: '**CSAT target is 4.0/5 — above the 3.5–4.0 historical baseline, still below the 4.3+ e-commerce benchmark.** A staged improvement. Once consistently hitting 4.0, the next target should be 4.2+. Drivers to watch: shipping delays, fault rates, response time, tone quality.' },
    ],
  },
  {
    id: 's11-2',
    number: '11.2',
    title: 'Customer Education & Resources metrics',
    parentId: 's11',
    blocks: [
      { type: 'table', headers: ['Metric', 'Target', 'Review cadence'], rows: [
        ['Reduction in basic support queries (QoQ)', '-10% QoQ [CONFIRM]', 'Quarterly'],
        ['Help centre article views', 'Track — target growth', 'Monthly'],
        ['Help centre article helpfulness rating', '≥80% thumbs up [CONFIRM]', 'Monthly'],
        ['Tutorial video engagement (avg watch time)', 'Track', 'Monthly'],
        ['New article / tutorial published', '≥1 per week [CONFIRM]', 'Weekly'],
      ]},
    ],
  },
  {
    id: 's11-3',
    number: '11.3',
    title: 'Community Support metrics (CC-owned slice)',
    parentId: 's11',
    blocks: [
      { type: 'p', content: '*Public comment metrics sit with Social Media Lead. The metrics below are the slice CC owns: product DMs + per-customer review recovery.*' },
      { type: 'table', headers: ['Metric', 'Target', 'Review cadence'], rows: [
        ['Product DM response time', '<4 business hours', 'Daily'],
        ['Okendo detractor outreach rate', '100% of 1–3 star reviews within 48 hrs', 'Weekly'],
        ['ProductReview outreach rate', '100% of eligible 4–5 star reviewers', 'Weekly'],
        ['Detractor-to-advocate conversion rate', 'Track — target growth [CONFIRM]', 'Monthly'],
      ]},
    ],
  },
  {
    id: 's11-4',
    number: '11.4',
    title: 'Customer Engagement, Retention & Loyalty metrics',
    parentId: 's11',
    blocks: [
      { type: 'table', headers: ['Metric', 'Target', 'Review cadence'], rows: [
        ['Customer Lifetime Value (LTV)', 'Track — set growth target [CONFIRM]', 'Quarterly'],
        ['Repeat purchase rate', '≥25% [CONFIRM]', 'Monthly'],
        ['Churn rate', '<baseline, trending down [CONFIRM]', 'Quarterly'],
        ['Net Promoter Score (relationship NPS)', '≥50 [CONFIRM]', 'Quarterly'],
        ['Customer retention rate (12-month)', '≥60% [CONFIRM]', 'Quarterly'],
        ['Post-resolution check-in completion', '100% of eligible tickets', 'Weekly'],
      ]},
    ],
  },
  {
    id: 's11-5',
    number: '11.5',
    title: 'Operational hygiene (team-level, non-negotiable)',
    parentId: 's11',
    blocks: [
      { type: 'table', headers: ['Metric', 'Target'], rows: [
        ['Inbox zero daily', 'Yes'],
        ['NP + Borderless error queue at day-end', '0'],
        ['Weekly in-office returns processed', '100% of received'],
        ['Fault Portal: cases logged same-day', '100%'],
        ['Fault Portal: cases with no movement >14 days', '0'],
        ['Escalation accuracy (no missed safety-keyword triggers)', '100% — zero tolerance'],
      ]},
    ],
  },
  {
    id: 's11-6',
    number: '11.6',
    title: 'Quality guardrails',
    parentId: 's11',
    blocks: [
      { type: 'ul', items: [
        'Macro-only response rate: <20% of tickets [CONFIRM]',
        'Repeat contact rate (same issue): <10%',
        'First-contact resolution (simple tickets): ≥70%',
      ]},
      { type: 'info', content: 'Speed without quality is just fast-broken service. Any KPI can be gamed — don\'t.' },
      { type: 'warning', content: '**OKRs quarterly.** Each service pillar should have 1–2 Objectives and 2–3 Key Results set at the start of each quarter by the CC Lead. The metric tables above are the measurement pool to draw from.' },
    ],
  },

  // ── 12. Edge Case Playbooks ────────────────────────────────────────────────
  {
    id: 's12',
    number: '12',
    title: 'Edge Case Playbooks',
    blocks: [],
  },
  {
    id: 's12-1',
    number: '12.1',
    title: 'Order cancellations',
    parentId: 's12',
    blocks: [
      { type: 'p', content: '**Trigger:** Customer requests cancellation for any reason.' },
      { type: 'ol', items: [
        'Check order status in Shopify',
        'If pre-4am fulfilment cutoff: cancel order + refund in Shopify, confirm with customer',
        'If post-cutoff: explain clearly — order has been released to warehouse, we can\'t pull it back',
        'Offer options: refuse delivery (auto-returns) OR accept delivery + return at their cost',
        'Log outcome in Commslayer',
      ]},
      { type: 'p', content: '**Script (pre-cutoff):**' },
      { type: 'quote', content: '"No worries at all — I\'ve cancelled your order and you\'ll see the refund hit your account in 3–5 business days. Apologies for any hassle, and let us know if there\'s anything else we can help with."' },
      { type: 'p', content: '**Script (post-cutoff):**' },
      { type: 'quote', content: '"Really sorry — your order has already been released to our warehouse for shipping, so we\'re not able to pull it back at this point. When it arrives, the easiest option is to refuse delivery and it\'ll come back to us automatically, or if it\'s already been delivered, we can arrange a return — happy to walk you through either option."' },
    ],
  },
  {
    id: 's12-2',
    number: '12.2',
    title: 'Missing deliveries',
    parentId: 's12',
    blocks: [
      { type: 'ol', items: [
        'Check Starshipit + 3PL tracking',
        'If tracking shows delivered but customer says no: Ask: check with neighbours, building manager, safe spot locations. Ask: confirm shipping address in case of typo. Wait 48 hours from "delivered" scan — parcels sometimes arrive late.',
        'If still missing after 48 hrs: Open courier investigation (NP / Borderless / Portless). Offer replacement shipment as goodwill while investigation runs.',
        'If tracking never updated / shows in transit for 10+ business days: Treat as lost — ship replacement, file courier claim in parallel.',
      ]},
    ],
  },
  {
    id: 's12-3',
    number: '12.3',
    title: 'Fault disputes',
    parentId: 's12',
    blocks: [
      { type: 'p', content: '**Customer says it\'s a fault. Evidence suggests customer-caused damage.**' },
      { type: 'ol', items: [
        'Reply acknowledging the frustration',
        'Share what the evidence shows, specifically',
        'Offer discount on replacement purchase',
        'If customer pushes back: Hold the line politely. Don\'t argue — restate the policy once. If they escalate further, transfer to CC Lead.',
      ]},
    ],
  },
  {
    id: 's12-4',
    number: '12.4',
    title: 'Angry customers',
    parentId: 's12',
    blocks: [
      { type: 'p', content: '**Principles:**' },
      { type: 'ul', items: [
        'Don\'t match their energy. De-escalate with calm, specific responses.',
        'Acknowledge the feeling before explaining the facts.',
        'Don\'t apologise for things that aren\'t our fault — apologise for the experience.',
        'Never promise something you can\'t deliver.',
      ]},
      { type: 'p', content: '**Structure:**' },
      { type: 'ol', items: [
        'Acknowledge: "I hear you, and I understand why this is frustrating."',
        'Clarify: "Let me make sure I\'ve got this right — [restate the issue]."',
        'Act: "Here\'s what I can do right now — [specific action]."',
        'Follow through: "I\'ll personally follow up with you by [time]."',
      ]},
      { type: 'warning', content: 'If a customer is abusive (slurs, threats, harassment): don\'t respond emotionally. Reply once politely stating the team is here to help within normal conduct. Escalate to CC Lead if behaviour continues.' },
    ],
  },
  {
    id: 's12-5',
    number: '12.5',
    title: 'Discount conflicts',
    parentId: 's12',
    blocks: [
      { type: 'p', content: '"I used my discount code but it didn\'t apply / I want to apply it retroactively."' },
      { type: 'ol', items: [
        'Check order — was the code eligible? (valid window, product restrictions, stacking rules)',
        'If code was valid and genuinely didn\'t apply due to our error: manual partial refund for the discount amount',
        'If code was used correctly but customer wants another applied retroactively: decline politely, offer code for next order',
        'If code had restrictions the customer didn\'t see: explain kindly, offer alternative',
      ]},
    ],
  },
  {
    id: 's12-6',
    number: '12.6',
    title: 'Out-of-stock situations',
    parentId: 's12',
    blocks: [
      { type: 'p', content: '**Customer ordered but product is out of stock:**' },
      { type: 'ol', items: [
        'Notify within 24 hrs of identifying the stockout',
        'Offer options: Wait for restock (give honest ETA). Substitute for similar product (with price adjustment if needed). Full refund.',
        'Don\'t promise ETAs you haven\'t confirmed with supply chain',
      ]},
      { type: 'p', content: '**Customer asks about a product that\'s out of stock:**' },
      { type: 'ol', items: [
        'Offer waitlist signup [CONFIRM waitlist tool]',
        'Give ETA range only if you\'ve confirmed it',
        'Suggest alternative products only if genuinely comparable',
      ]},
    ],
  },

  // ── 13. Communication Style Guide ─────────────────────────────────────────
  {
    id: 's13',
    number: '13',
    title: 'Communication Style Guide',
    blocks: [
      { type: 'h3', content: 'Tone principles' },
      { type: 'ol', items: [
        '**Sound like a person, not a department.** Use "I" and your name.',
        '**Short sentences beat long ones.**',
        '**Be specific.** "We\'ll sort this" is less trustworthy than "I\'ve processed your refund — you\'ll see it in 3–5 business days."',
        '**Never blame the customer, even when it\'s their fault.** Redirect to what we can do next.',
        '**Don\'t use corporate language.** No "as per," "please be advised," "kindly," "the aforementioned."',
        '**Cut the apologies.** One genuine apology is worth ten scripted ones.',
      ]},
      { type: 'h3', content: 'Words to avoid' },
      { type: 'ul', items: [
        '"Unfortunately" (overused — use sparingly, only for genuine bad news)',
        '"As per our policy" (robotic)',
        '"Please be advised" (corporate filler)',
        '"Per your previous email" (condescending)',
        '"Synergy," "circle back," "reach out" (unless genuinely natural)',
      ]},
      { type: 'h3', content: 'Words to use' },
      { type: 'ul', items: [
        '"Sure thing"',
        '"Let me have a look"',
        '"Here\'s what I can do"',
        '"Quick heads up"',
        '"Sorted"',
        '"All good"',
      ]},
      { type: 'h3', content: 'Strong vs weak responses' },
      { type: 'p', content: '**Weak:**' },
      { type: 'quote', content: '"Unfortunately, as per our returns policy, we are unable to process your request at this time. Please be advised that returns must be initiated within 30 days of purchase. Kindly refer to our terms and conditions."' },
      { type: 'p', content: '**Strong:**' },
      { type: 'quote', content: '"Sorry about that — our return window is 30 days and this order was placed 42 days ago, so we can\'t process it as a standard return. That said, I can offer you a 20% off code for your next order if that helps soften the blow. Let me know."' },
      { type: 'p', content: '**Weak:**' },
      { type: 'quote', content: '"Your order has been dispatched. Please check your tracking."' },
      { type: 'p', content: '**Strong:**' },
      { type: 'quote', content: '"Your order went out yesterday — tracking link here: [link]. Should land in 2–3 business days. Let me know if anything looks off."' },
      { type: 'p', content: '**Weak:**' },
      { type: 'quote', content: '"We apologise for the inconvenience caused by this issue. A replacement has been arranged."' },
      { type: 'p', content: '**Strong:**' },
      { type: 'quote', content: '"Really sorry this happened — that\'s not the experience we want. I\'ve put a replacement through this morning and you\'ll have it by Friday. I\'ll keep an eye on the tracking myself and message you if anything changes."' },
      { type: 'h3', content: 'Sign-off' },
      { type: 'p', content: 'Use your first name and role. Never "The SnapWireless Team" — it\'s distant.' },
      { type: 'quote', content: '"Cheers, [Name] — Customer Care"' },
    ],
  },

  // ── Appendix A — Quick Reference ──────────────────────────────────────────
  {
    id: 'sAppA',
    number: 'App A',
    title: 'Quick Reference',
    blocks: [
      { type: 'h3', content: 'Order of operations checklist' },
      { type: 'checklist', items: [
        'Clear NP errors',
        'Clear Borderless errors',
        'Sweep for cancellations — Sera first, then manual (Commslayer + IG DMs + Messenger)',
        'Work awaiting conversations (oldest first)',
        'Work unresolved conversations',
        'Product DM handling (IG + Messenger)',
        'Fault Portal: log new cases + update existing',
        'End-of-shift cancellation re-sweep',
        'End-of-day review',
      ]},
      { type: 'h3', content: 'Escalation quick reference' },
      { type: 'table', headers: ['Situation', 'Escalate to', 'Channel'], rows: [
        ['Safety keyword in ticket', 'CC Lead', '#cc-escalations + DM'],
        ['Legal threat', 'CC Lead + Ops Lead', '#cc-escalations'],
        ['Product batch fault pattern', 'CC Lead + Product team', '#cc-escalations + #product-faults'],
        ['3PL systemic issue', 'CC Lead', '#cc-ops'],
        ['Wholesale lead', 'Wholesale Lead', 'DM + handoff brief'],
        ['Media / public complaint', 'CC Lead + PR Manager', '#cc-escalations'],
        ['Non-product DM / brand enquiry', 'Social Media Lead', 'DM'],
        ['Sera actioned a cancellation in error', 'CC Lead', '#cc-ops'],
      ]},
      { type: 'h3', content: 'Contact cheat sheet [CONFIRM contacts]' },
      { type: 'ul', items: [
        'CC Lead: [name]',
        'Social Media Lead: [name]',
        'Wholesale Lead: [name]',
        'Product team: [name]',
        'PR Manager: [name]',
        'Ops Lead: [name]',
        'NP account manager: [name]',
        'Borderless account manager: [name]',
      ]},
      { type: 'h3', content: 'Key links' },
      { type: 'ul', items: [
        'Fault Portal: https://fault-portal.vercel.app/cases',
        'ProductReview listing: https://www.productreview.com.au/listings/snap-wireless/write-review',
        'SnapWireless Community FB group: https://www.facebook.com/groups/778012532890285',
      ]},
    ],
  },

  // ── Appendix D — Privacy & Data Handling ──────────────────────────────────
  {
    id: 'sAppD',
    number: 'App D',
    title: 'Privacy & Data Handling',
    blocks: [
      { type: 'warning', content: '[NEEDS LEGAL SIGN-OFF] — Placeholder. This section needs a Lead + legal review before publishing.' },
      { type: 'p', content: '**Current baseline practice (unofficial):' },
      { type: 'ul', items: [
        'Customer data stays inside the helpdesk + Shopify environments — don\'t share externally',
        'Evidence files (videos, photos) stored in Google Drive — internal access only',
        'Don\'t share customer order details publicly in comments or reviews',
        'When a customer requests deletion of their data, escalate to the Lead',
      ]},
      { type: 'p', content: '**What this section should cover once formalised:**' },
      { type: 'ul', items: [
        'Australian Privacy Principles (APP) compliance obligations',
        'GDPR considerations for EU customers (if any)',
        'Data retention policy for customer comms and fault evidence',
        'Process for customer data access / deletion requests',
        'Offshore team access controls + data handling requirements',
      ]},
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Top-level sections (no parentId) */
export const SOP_TOP_LEVEL = SOP_SECTIONS.filter(s => !s.parentId);

/** Children of a given section */
export function getSubsections(parentId: string): SOPSection[] {
  return SOP_SECTIONS.filter(s => s.parentId === parentId);
}

/** Flat lookup by id */
export function getSectionById(id: string): SOPSection | undefined {
  return SOP_SECTIONS.find(s => s.id === id);
}
