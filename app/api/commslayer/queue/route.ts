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
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'api_access_token': API_TOKEN, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Commslayer not configured' }, { status: 503 });
  }

  try {
    // Fetch open conversations (meta gives counts; payload gives individual convos for oldest calc)
    const [openJson, unassignedJson] = await Promise.all([
      csGet(`/api/v1/accounts/${ACCOUNT_ID}/conversations`, { status: 'open', page: '1' }),
      csGet(`/api/v1/accounts/${ACCOUNT_ID}/conversations`, { status: 'open', assignee_type: 'unassigned', page: '1' }),
    ]);

    const meta        = openJson?.data?.meta ?? {};
    const openCount   = meta.all_count       ?? 0;
    const unassigned  = meta.unassigned_count ?? unassignedJson?.data?.meta?.all_count ?? 0;
    const pending     = meta.pending_count   ?? 0;

    // Find oldest open conversation from the payload
    const payload: { created_at: number }[] = openJson?.data?.payload ?? [];
    const oldest = payload.length > 0
      ? Math.min(...payload.map((c) => c.created_at * 1000))
      : null;

    const oldestAgeMinutes = oldest
      ? Math.floor((Date.now() - oldest) / 60_000)
      : null;

    return NextResponse.json({
      open: openCount,
      unassigned,
      pending,
      oldestAgeMinutes,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[GET /api/commslayer/queue]', err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
