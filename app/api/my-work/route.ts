import { NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

type WorkItemType = 'case' | 'return' | 'refund' | 'unfulfilled';

type WorkItem = {
  id: string;
  type: WorkItemType;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  href: string;
  priority: 'red' | 'amber' | 'blue' | 'slate';
};

function samePerson(value: unknown, name: string) {
  const stored = String(value ?? '').trim().toLowerCase();
  const query = name.trim().toLowerCase();
  return Boolean(stored && query && (stored === query || stored.includes(query) || query.includes(stored)));
}

function daysSince(value: string) {
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function priorityFor(date: string, urgent = false): WorkItem['priority'] {
  const age = daysSince(date);
  if (urgent || age >= 7) return 'red';
  if (age >= 2) return 'amber';
  return 'blue';
}

function fromReturn(row: Record<string, unknown>): WorkItem {
  const id = String(row.id ?? '');
  const orderNumber = String(row.order_number ?? '');
  const customerName = String(row.customer_name ?? '');
  const stage = String(row.stage ?? '');
  const status = String(row.status ?? row.follow_up_status ?? '');
  const date = String(row.date ?? row.created_at ?? '');
  const followUpStatus = String(row.follow_up_status ?? '');
  return {
    id,
    type: 'return',
    title: `${orderNumber} · ${customerName}`,
    subtitle: stage === 'requested' ? 'Awaiting customer parcel' : String(row.follow_up_notes ?? 'Processed return'),
    status: followUpStatus === 'Pending' ? 'Follow-up pending' : status,
    date,
    href: `/returns/${id}`,
    priority: priorityFor(date, followUpStatus === 'Pending'),
  };
}

function fromRefund(row: Record<string, unknown>): WorkItem {
  const id = String(row.id ?? '');
  const orderNumber = String(row.order_number ?? '');
  const customerName = String(row.customer_name ?? '');
  const createdAt = String(row.created_at ?? '');
  return {
    id,
    type: 'refund',
    title: `${orderNumber} · ${customerName}`,
    subtitle: `${String(row.currency ?? 'AUD')} ${Number(row.amount ?? 0).toFixed(2)} · ${String(row.reason ?? '')}`,
    status: String(row.status ?? ''),
    date: createdAt,
    href: `/refunds?open=${encodeURIComponent(id)}`,
    priority: priorityFor(createdAt),
  };
}

function fromUnfulfilled(row: Record<string, unknown>): WorkItem {
  const id = String(row.id ?? '');
  const orderNumber = String(row.order_number ?? '');
  const customerName = String(row.customer_name ?? '');
  const updatedAt = String(row.updated_at ?? row.created_at ?? '');
  const followUpRequired = Boolean(row.follow_up_required);
  return {
    id,
    type: 'unfulfilled',
    title: `${orderNumber} · ${customerName}`,
    subtitle: String(row.product_variant ?? ''),
    status: followUpRequired ? 'Follow-up required' : String(row.outcome ?? 'Active'),
    date: updatedAt,
    href: '/unfulfilled',
    priority: priorityFor(String(row.follow_up_on ?? updatedAt), followUpRequired),
  };
}

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const name = session.name;
    const [cases, returnsRes, refundsRes, unfulfilledRes] = await Promise.all([
      getCases().catch(() => []),
      getSupabase()
        .from('returns')
        .select('id, stage, date, order_number, customer_name, status, follow_up_status, follow_up_notes, assigned_to, processed_by, created_at')
        .or(`processed_by.ilike.%${name.replace(/[%_,]/g, '')}%,assigned_to.ilike.%${name.replace(/[%_,]/g, '')}%`)
        .limit(100),
      getSupabase()
        .from('refund_requests')
        .select('id, order_number, customer_name, amount, currency, reason, status, submitted_by, created_at')
        .ilike('submitted_by', `%${name.replace(/[%_,]/g, '')}%`)
        .limit(100),
      getSupabase()
        .from('unfulfilled_orders')
        .select('id, order_number, customer_name, product_variant, assigned_to, follow_up_required, follow_up_on, outcome, resolved_at, created_at, updated_at')
        .is('resolved_at', null)
        .ilike('assigned_to', `%${name.replace(/[%_,]/g, '')}%`)
        .limit(100),
    ]);

    const items: WorkItem[] = [];

    for (const c of cases) {
      if (!samePerson(c.submittedBy, name)) continue;
      if (['Credit Received', 'Rejected'].includes(c.claimStatus)) continue;
      items.push({
        id: c.id,
        type: 'case',
        title: `${c.orderNumber} · ${c.customerName}`,
        subtitle: `${c.product} · ${c.faultType}`,
        status: c.claimStatus,
        date: c.date || c.createdAt,
        href: `/cases/${c.id}`,
        priority: priorityFor(c.date || c.createdAt, c.claimStatus === 'Unsubmitted'),
      });
    }

    if (returnsRes.error) throw returnsRes.error;
    for (const row of returnsRes.data ?? []) {
      const isOwner = samePerson(row.processed_by, name) || samePerson(row.assigned_to, name);
      const isActive = row.stage === 'requested' || row.follow_up_status === 'Pending' || row.status !== 'Closed';
      if (isOwner && isActive) items.push(fromReturn(row));
    }

    if (refundsRes.error) throw refundsRes.error;
    for (const row of refundsRes.data ?? []) {
      if (row.status === 'Pending') items.push(fromRefund(row));
    }

    if (unfulfilledRes.error) throw unfulfilledRes.error;
    for (const row of unfulfilledRes.data ?? []) {
      items.push(fromUnfulfilled(row));
    }

    const priorityRank = { red: 0, amber: 1, blue: 2, slate: 3 };
    items.sort((a, b) => {
      const priority = priorityRank[a.priority] - priorityRank[b.priority];
      if (priority !== 0) return priority;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return NextResponse.json({
      name,
      items,
      counts: {
        total: items.length,
        cases: items.filter(item => item.type === 'case').length,
        returns: items.filter(item => item.type === 'return').length,
        refunds: items.filter(item => item.type === 'refund').length,
        unfulfilled: items.filter(item => item.type === 'unfulfilled').length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
