import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_URL   = process.env.COMMSLAYER_BASE_URL   ?? '';
const ACCOUNT_ID = process.env.COMMSLAYER_ACCOUNT_ID ?? '';
const API_TOKEN  = process.env.COMMSLAYER_API_TOKEN  ?? '';

function isConfigured() {
  return BASE_URL && ACCOUNT_ID && API_TOKEN;
}

async function csGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('account_id', ACCOUNT_ID);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function toACST(date: Date): string {
  // ACST = UTC+9:30 — use Adelaide locale for date string
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
}

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Commslayer not configured' }, { status: 503 });
  }

  try {
    const today = toACST(new Date());

    const json = await csGet('/api/integration/v1/reports/overview', {
      from_date: today,
      to_date: today,
    });

    const ov = json?.data?.data?.overview ?? {};
    const created  = ov?.created_tickets?.current  ?? 0;
    const closed   = ov?.closed_tickets?.current   ?? 0;
    const frtSecs  = ov?.first_response_time?.current ?? 0;

    const prod = json?.data?.data?.productivity ?? {};
    const msgs = prod?.messages_sent?.current ?? 0;

    return NextResponse.json({
      date: today,
      created,
      closed,
      frtSeconds: frtSecs,
      messagesSent: msgs,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[GET /api/commslayer/queue]', err.message);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
