import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE_URL   = process.env.COMMSLAYER_BASE_URL   ?? '';
const ACCOUNT_ID = process.env.COMMSLAYER_ACCOUNT_ID ?? '';
const API_TOKEN  = process.env.COMMSLAYER_API_TOKEN  ?? '';

function isConfigured() {
  return BASE_URL && ACCOUNT_ID && API_TOKEN;
}

function appRoot() {
  return BASE_URL.replace(/\/api\/integration\/v1\/?$/, '').replace(/\/$/, '');
}

function parseCommslayerError(path: string, status: number, text: string) {
  try {
    const json = JSON.parse(text);
    const code = json?.error?.code ?? json?.code;
    const message = json?.error?.message ?? json?.message;
    if (status === 401 || code === 'invalid_token') {
      return 'Commslayer token is invalid or expired. Generate a new API token in Commslayer and update COMMSLAYER_API_TOKEN.';
    }
    if (message) return `Commslayer ${path}: ${message}`;
  } catch {
    // Fall through to the generic response below.
  }
  return `Commslayer ${path}: HTTP ${status}`;
}

async function csRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${appRoot()}/api/integration/v1/${path}`);
  url.searchParams.set('account_id', ACCOUNT_ID);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const errors: string[] = [];
  const authHeaders: Record<string, string>[] = [
    { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    { api_access_token: API_TOKEN, 'Content-Type': 'application/json' },
  ];
  for (const headers of authHeaders) {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      errors.push(parseCommslayerError(path, res.status, text));
      continue;
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Commslayer ${path}: invalid JSON`);
    }
  }

  throw new Error(errors[0] ?? `Commslayer ${path}: request failed`);
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
