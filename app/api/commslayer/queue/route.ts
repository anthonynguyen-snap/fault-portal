import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_URL   = process.env.COMMSLAYER_BASE_URL   ?? '';
const ACCOUNT_ID = process.env.COMMSLAYER_ACCOUNT_ID ?? '';
const API_TOKEN  = process.env.COMMSLAYER_API_TOKEN  ?? '';

function isConfigured() {
  return BASE_URL && ACCOUNT_ID && API_TOKEN;
}

// Matches the auth used by the working /api/performance route
async function csGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('account_id', ACCOUNT_ID);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.slice(0, 300)}`); }
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Commslayer not configured' }, { status: 503 });
  }

  const debug = new URL(req.url).searchParams.get('debug') === '1';

  // Try several likely endpoint paths so we can discover which one works
  if (debug) {
    const results: Record<string, unknown> = {};
    const paths = [
      '/api/v1/accounts/${ACCOUNT_ID}/conversations',
      '/api/integration/v1/conversations',
      '/api/integration/v1/reports/overview',
    ];
    for (const p of paths) {
      const resolved = p.replace('${ACCOUNT_ID}', ACCOUNT_ID);
      try {
        results[resolved] = await csGet(resolved, { status: 'open', page: '1' });
      } catch (e: any) {
        results[resolved] = { _error: e.message };
      }
    }
    return NextResponse.json({ debug: true, accountId: ACCOUNT_ID, results });
  }

  try {
    // Try standard Chatwoot-compatible conversations endpoint
    const openJson = await csGet(`/api/v1/accounts/${ACCOUNT_ID}/conversations`, {
      status: 'open',
      page: '1',
    });

    const meta       = openJson?.data?.meta ?? {};
    const openCount  = meta.all_count        ?? 0;
    const unassigned = meta.unassigned_count  ?? 0;
    const pending    = meta.pending_count     ?? 0;

    // Find oldest open conversation age from first-page payload
    const payload: { created_at: number }[] = openJson?.data?.payload ?? [];
    const oldest = payload.length > 0
      ? Math.min(...payload.map((c) => c.created_at * 1000))
      : null;
    const oldestAgeMinutes = oldest ? Math.floor((Date.now() - oldest) / 60_000) : null;

    return NextResponse.json({ open: openCount, unassigned, pending, oldestAgeMinutes, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[GET /api/commslayer/queue]', err.message);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
