import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_URL   = process.env.COMMSLAYER_BASE_URL   ?? '';
const ACCOUNT_ID = process.env.COMMSLAYER_ACCOUNT_ID ?? '';
const API_TOKEN  = process.env.COMMSLAYER_API_TOKEN  ?? '';
const MAX_BREACH_TICKETS = 8;

function isConfigured() {
  return BASE_URL && ACCOUNT_ID && API_TOKEN;
}

function appRoot() {
  return BASE_URL.replace(/\/api\/integration\/v1\/?$/, '').replace(/\/$/, '');
}

function integrationUrl(path: string) {
  const root = appRoot();
  return new URL(`${root}/api/integration/v1${path.startsWith('/') ? path : `/${path}`}`);
}

async function csGet(path: string, params: Record<string, string> = {}) {
  const url = integrationUrl(path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function csFlexibleGet(path: string, params: Record<string, string>, authMode: 'bearer' | 'api_access_token') {
  const url = path.startsWith('/api/')
    ? new URL(`${appRoot()}${path}`)
    : integrationUrl(path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      ...(authMode === 'bearer' ? { Authorization: `Bearer ${API_TOKEN}` } : { api_access_token: API_TOKEN }),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${authMode} HTTP ${res.status} — ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

function toACST(date: Date): string {
  // ACST = UTC+9:30 — use Adelaide locale for date string
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
}

function getPayload(json: any): any[] {
  const payload = json?.data?.payload ?? json?.payload ?? json?.data?.data ?? json?.data ?? [];
  return Array.isArray(payload) ? payload : [];
}

function asSeconds(value: unknown): number | null {
  if (typeof value === 'number') return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
    const num = Number(value);
    if (Number.isFinite(num)) return num > 10_000_000_000 ? Math.floor(num / 1000) : num;
  }
  return null;
}

function conversationAgeSeconds(conversation: any, nowSeconds: number): number {
  const since = asSeconds(
    conversation.waiting_since ??
    conversation.first_reply_created_at ??
    conversation.created_at ??
    conversation.last_activity_at
  );
  return since ? Math.max(0, nowSeconds - since) : 0;
}

function conversationUrl(conversation: any): string {
  const explicit = conversation.url ?? conversation.link ?? conversation.conversation_url;
  if (explicit) return String(explicit);
  const id = conversation.display_id ?? conversation.id;
  return `${appRoot()}/app/accounts/${ACCOUNT_ID}/conversations/${id}`;
}

function unassignedQueueUrl(): string {
  return `${appRoot()}/app/accounts/${ACCOUNT_ID}/conversations?status=open&assignee_type=unassigned`;
}

function conversationTitle(conversation: any): string {
  return String(
    conversation.subject ??
    conversation.additional_attributes?.mail_subject ??
    conversation.messages?.[0]?.content ??
    'Unassigned conversation'
  ).replace(/\s+/g, ' ').trim().slice(0, 90);
}

function contactName(conversation: any): string {
  const contact = conversation.meta?.sender ?? conversation.contact ?? conversation.sender ?? {};
  return String(contact.name ?? contact.email ?? conversation.contact_name ?? 'Customer');
}

async function loadBreachingTickets() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const params = { status: 'open', assignee_type: 'unassigned', page: '1', account_id: ACCOUNT_ID };
  let conversations: any = null;
  const errors: string[] = [];

  const attempts = [
    { path: '/conversations', includeAccountInPath: false },
    { path: '/api/integration/v1/conversations', includeAccountInPath: false },
    { path: `/api/integration/v1/accounts/${ACCOUNT_ID}/conversations`, includeAccountInPath: true },
  ];

  for (const attempt of attempts) {
    for (const authMode of ['api_access_token', 'bearer'] as const) {
      try {
        const requestParams = attempt.includeAccountInPath
          ? { status: params.status, assignee_type: params.assignee_type, page: params.page }
          : params;
        conversations = await csFlexibleGet(attempt.path, requestParams, authMode);
        break;
      } catch (err: any) {
        errors.push(err.message ?? String(err));
      }
    }
    if (conversations) break;
  }

  if (!conversations) {
    throw new Error(errors.slice(0, 4).join(' | '));
  }

  return getPayload(conversations)
    .map((conversation: any) => {
      const ageSeconds = conversationAgeSeconds(conversation, nowSeconds);
      const id = String(conversation.display_id ?? conversation.id ?? '');
      return {
        id,
        title: conversationTitle(conversation),
        customer: contactName(conversation),
        inbox: conversation.inbox?.name ?? conversation.inbox_name ?? conversation.channel ?? '',
        ageSeconds,
        url: conversationUrl(conversation),
      };
    })
    .filter((ticket: { id: string; ageSeconds: number }) => ticket.id && ticket.ageSeconds > 0)
    .sort((a: { ageSeconds: number }, b: { ageSeconds: number }) => b.ageSeconds - a.ageSeconds)
    .slice(0, MAX_BREACH_TICKETS);
}

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Commslayer not configured' }, { status: 503 });
  }

  try {
    const today = toACST(new Date());

    const json = await csGet('/reports/overview', {
      from_date: today,
      to_date: today,
    });

    const ov = json?.data?.data?.overview ?? {};
    const created  = ov?.created_tickets?.current  ?? 0;
    const closed   = ov?.closed_tickets?.current   ?? 0;
    const frtSecs  = ov?.first_response_time?.current ?? 0;

    const prod = json?.data?.data?.productivity ?? {};
    const msgs = prod?.messages_sent?.current ?? 0;

    let breachingTickets: Awaited<ReturnType<typeof loadBreachingTickets>> = [];
    let liveQueueError = '';
    try {
      breachingTickets = await loadBreachingTickets();
    } catch (ticketErr: any) {
      liveQueueError = ticketErr.message ?? String(ticketErr);
      console.warn('[GET /api/commslayer/queue] live queue unavailable:', liveQueueError);
    }

    return NextResponse.json({
      date: today,
      created,
      closed,
      frtSeconds: frtSecs,
      messagesSent: msgs,
      breachingTickets,
      liveQueueError,
      unassignedQueueUrl: unassignedQueueUrl(),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[GET /api/commslayer/queue]', err.message);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
