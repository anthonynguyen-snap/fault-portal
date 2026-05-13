import { NextResponse } from 'next/server';
import { getCases, getClaims, getFaultTypes, getManufacturers, getProducts } from '@/lib/google-sheets';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

type HealthStatus = 'connected' | 'partial' | 'broken' | 'not_configured';

type HealthCheck = {
  name: string;
  status: HealthStatus;
  detail: string;
  latencyMs?: number;
  checkedAt: string;
};

type HealthGroup = {
  name: string;
  status: HealthStatus;
  summary: string;
  checks: HealthCheck[];
};

type CommslayerAuthMode = 'bearer' | 'api_access_token';

function hasEnv(keys: string[]) {
  return keys.every(key => Boolean(process.env[key]));
}

function nowIso() {
  return new Date().toISOString();
}

async function timed<T>(fn: () => Promise<T>) {
  const start = Date.now();
  const value = await fn();
  return { value, latencyMs: Date.now() - start };
}

function groupStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.every(check => check.status === 'not_configured')) return 'not_configured';
  if (checks.every(check => check.status === 'connected')) return 'connected';
  if (checks.some(check => check.status === 'connected')) return 'partial';
  return checks.some(check => check.status === 'not_configured') ? 'not_configured' : 'broken';
}

function groupSummary(status: HealthStatus) {
  if (status === 'connected') return 'All checks passed';
  if (status === 'partial') return 'Some checks passed, some need attention';
  if (status === 'not_configured') return 'Required environment variables are missing';
  return 'Checks failed';
}

function appRoot() {
  const base = process.env.COMMSLAYER_BASE_URL ?? '';
  return base.replace(/\/api\/integration\/v1\/?$/, '').replace(/\/$/, '');
}

function integrationUrl(path: string) {
  const root = appRoot();
  return new URL(`${root}/api/integration/v1${path.startsWith('/') ? path : `/${path}`}`);
}

function getPayload(json: any): any[] {
  const payload = json?.data?.payload ?? json?.payload ?? json?.data?.data ?? json?.data ?? [];
  return Array.isArray(payload) ? payload : [];
}

function isOpenConversation(conversation: any) {
  const status = String(conversation.status ?? conversation.state ?? '').toLowerCase();
  if (['open', 'opened', 'pending'].includes(status)) return true;
  if (['resolved', 'closed', 'archived'].includes(status)) return false;
  return !conversation.closed_at && !conversation.resolved_at;
}

function isUnassignedConversation(conversation: any) {
  const assignee = conversation.assignee ?? conversation.assigned_to ?? conversation.user ?? conversation.agent;
  const assigneeId = conversation.assignee_id ?? conversation.assigned_to_id ?? conversation.user_id ?? conversation.agent_id;
  return !assignee && !assigneeId;
}

async function commslayerGet(
  path: string,
  params: Record<string, string> = {},
  includeAccountId = false,
  authMode: CommslayerAuthMode = 'bearer'
) {
  const url = integrationUrl(path);
  const accountId = process.env.COMMSLAYER_ACCOUNT_ID;
  if (includeAccountId && accountId) url.searchParams.set('account_id', accountId);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), {
    headers: {
      ...(authMode === 'bearer'
        ? { Authorization: `Bearer ${process.env.COMMSLAYER_API_TOKEN}` }
        : { api_access_token: process.env.COMMSLAYER_API_TOKEN ?? '' }),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${text.slice(0, 180)}`);
  return text ? JSON.parse(text) : {};
}

async function checkGoogleSheets(): Promise<HealthGroup> {
  const checkedAt = nowIso();
  const required = [
    'GOOGLE_PROJECT_ID',
    'GOOGLE_PRIVATE_KEY_ID',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_SPREADSHEET_ID',
  ];

  if (!hasEnv(required)) {
    const checks = [{
      name: 'Google Sheets environment',
      status: 'not_configured' as const,
      detail: 'One or more Google Sheets environment variables are missing.',
      checkedAt,
    }];
    return { name: 'Google Sheets', status: 'not_configured', summary: groupSummary('not_configured'), checks };
  }

  const checks = await Promise.all([
    sheetCheck('Cases', () => getCases(), checkedAt),
    sheetCheck('Products', () => getProducts(), checkedAt),
    sheetCheck('Manufacturers', () => getManufacturers(), checkedAt),
    sheetCheck('Fault types', () => getFaultTypes(), checkedAt),
    sheetCheck('Claims', () => getClaims(), checkedAt),
  ]);
  const status = groupStatus(checks);
  return { name: 'Google Sheets', status, summary: groupSummary(status), checks };
}

async function sheetCheck(name: string, fn: () => Promise<unknown[]>, checkedAt: string): Promise<HealthCheck> {
  try {
    const { value, latencyMs } = await timed(fn);
    return {
      name,
      status: 'connected',
      detail: `${value.length} records reachable`,
      latencyMs,
      checkedAt,
    };
  } catch (err: any) {
    return {
      name,
      status: 'broken',
      detail: err.message ?? String(err),
      checkedAt,
    };
  }
}

async function checkSupabase(): Promise<HealthGroup> {
  const checkedAt = nowIso();
  if (!hasEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])) {
    const checks = [{
      name: 'Supabase environment',
      status: 'not_configured' as const,
      detail: 'Supabase URL or service role key is missing.',
      checkedAt,
    }];
    return { name: 'Supabase', status: 'not_configured', summary: groupSummary('not_configured'), checks };
  }

  const tables = [
    ['Returns', 'returns'],
    ['Refund requests', 'refund_requests'],
    ['Promotions', 'promotions'],
    ['Roster agents', 'roster_agents'],
    ['Shift logs', 'shift_logs'],
  ] as const;

  const supabase = getSupabase();
  const checks = await Promise.all(tables.map(async ([name, table]) => {
    try {
      const { value, latencyMs } = await timed(async () => {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) throw error;
        return count ?? 0;
      });
      return {
        name,
        status: 'connected' as const,
        detail: `${value} records reachable`,
        latencyMs,
        checkedAt,
      };
    } catch (err: any) {
      return {
        name,
        status: 'broken' as const,
        detail: err.message ?? String(err),
        checkedAt,
      };
    }
  }));

  const status = groupStatus(checks);
  return { name: 'Supabase', status, summary: groupSummary(status), checks };
}

async function checkCommslayer(): Promise<HealthGroup> {
  const checkedAt = nowIso();
  if (!hasEnv(['COMMSLAYER_BASE_URL', 'COMMSLAYER_API_TOKEN'])) {
    const checks = [{
      name: 'Commslayer environment',
      status: 'not_configured' as const,
      detail: 'Commslayer base URL or API token is missing.',
      checkedAt,
    }];
    return { name: 'Commslayer', status: 'not_configured', summary: groupSummary('not_configured'), checks };
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
  const checks = await Promise.all([
    commslayerCheck('Reports', '/reports/overview', { from_date: today, to_date: today }, checkedAt, true),
    loadConversationsForHealth(checkedAt),
  ]);

  const conversationCheck = checks.find(check => check.name === 'Conversations') as HealthCheck & { raw?: any };
  const conversations = conversationCheck?.raw ? getPayload(conversationCheck.raw) : [];
  checks.push({
    name: 'Unassigned conversations',
    status: conversationCheck?.status === 'connected' ? 'connected' : 'broken',
    detail: conversationCheck?.status === 'connected'
      ? `${conversations.filter(conversation => isOpenConversation(conversation) && isUnassignedConversation(conversation)).length} open unassigned-looking records found on the first page`
      : 'Conversation list was not reachable, so unassigned records could not be inspected.',
    checkedAt,
  });

  const status = groupStatus(checks);
  return { name: 'Commslayer', status, summary: groupSummary(status), checks };
}

async function loadConversationsForHealth(checkedAt: string): Promise<HealthCheck & { raw?: any }> {
  const variants: Array<{ label: string; path: string; params: Record<string, string>; includeAccountId: boolean; authMode: CommslayerAuthMode }> = [
    { label: 'bearer /conversations', path: '/conversations', params: {}, includeAccountId: false, authMode: 'bearer' },
    { label: 'bearer /conversations?page=1', path: '/conversations', params: { page: '1' }, includeAccountId: false, authMode: 'bearer' },
    { label: 'bearer /conversations + account_id', path: '/conversations', params: {}, includeAccountId: true, authMode: 'bearer' },
    { label: 'bearer /conversations?page=1 + account_id', path: '/conversations', params: { page: '1' }, includeAccountId: true, authMode: 'bearer' },
    { label: 'api_access_token /conversations', path: '/conversations', params: {}, includeAccountId: false, authMode: 'api_access_token' },
    { label: 'api_access_token /conversations + account_id', path: '/conversations', params: {}, includeAccountId: true, authMode: 'api_access_token' },
  ];

  const errors: string[] = [];
  for (const variant of variants) {
    try {
      const { value, latencyMs } = await timed(() => commslayerGet(variant.path, variant.params, variant.includeAccountId, variant.authMode));
      const conversations = getPayload(value);
      return {
        name: 'Conversations',
        status: 'connected',
        detail: `${conversations.length} conversations reachable via ${variant.label}`,
        latencyMs,
        checkedAt,
        raw: value,
      };
    } catch (err: any) {
      errors.push(`${variant.label}: ${err.message ?? String(err)}`);
    }
  }

  return {
    name: 'Conversations',
    status: 'broken',
    detail: `All conversation variants failed. ${errors.slice(0, 3).join(' | ')}`,
    checkedAt,
  };
}

async function commslayerCheck(name: string, path: string, params: Record<string, string>, checkedAt: string, includeAccountId = false): Promise<HealthCheck> {
  try {
    const { latencyMs } = await timed(() => commslayerGet(path, params, includeAccountId));
    return {
      name,
      status: 'connected',
      detail: 'Endpoint responded successfully',
      latencyMs,
      checkedAt,
    };
  } catch (err: any) {
    return {
      name,
      status: 'broken',
      detail: err.message ?? String(err),
      checkedAt,
    };
  }
}

export async function GET() {
  const checkedAt = nowIso();
  const groups = await Promise.all([
    checkGoogleSheets(),
    checkSupabase(),
    checkCommslayer(),
  ]);

  const overall = groupStatus(groups.map(group => ({
    name: group.name,
    status: group.status,
    detail: group.summary,
    checkedAt,
  })));

  return NextResponse.json({
    checkedAt,
    status: overall,
    summary: groupSummary(overall),
    groups,
  });
}
