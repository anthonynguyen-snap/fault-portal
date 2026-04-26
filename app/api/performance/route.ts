import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_URL   = process.env.COMMSLAYER_BASE_URL   ?? '';
const ACCOUNT_ID = process.env.COMMSLAYER_ACCOUNT_ID ?? '';
const API_TOKEN  = process.env.COMMSLAYER_API_TOKEN  ?? '';

function isConfigured() {
  return BASE_URL && ACCOUNT_ID && API_TOKEN;
}

async function csRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/api/integration/v1/${path}`);
  url.searchParams.set('account_id', ACCOUNT_ID);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type':  'application/json',
    },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Commslayer ${path}: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Commslayer ${path}: invalid JSON — ${text.slice(0, 300)}`);
  }
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Commslayer not configured. Add COMMSLAYER_BASE_URL, COMMSLAYER_ACCOUNT_ID, and COMMSLAYER_API_TOKEN to .env.local' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const debug    = searchParams.get('debug') === '1';
  const fromDate = searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const toDate   = searchParams.get('to')   ?? new Date().toISOString().slice(0, 10);
  const params   = { from_date: fromDate, to_date: toDate };

  // In debug mode, try each endpoint individually and return raw results
  if (debug) {
    const results: Record<string, unknown> = {};
    for (const path of ['reports/agents', 'reports/overview', 'reports/csat', 'reports/summary', 'reports']) {
      try {
        results[path] = await csRequest(path, params);
      } catch (e: any) {
        results[path] = { _error: e.message };
      }
    }
    return NextResponse.json({ debug: true, fromDate, toDate, accountId: ACCOUNT_ID, results });
  }

  try {
    const [agentsRaw, overviewRaw, csatRaw] = await Promise.all([
      csRequest('reports/agents',   params),
      csRequest('reports/overview', params),
      csRequest('reports/csat',     params),
    ]);
    return NextResponse.json({ agents: agentsRaw, overview: overviewRaw, csat: csatRaw });
  } catch (err: any) {
    console.error('[GET /api/performance]', err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
