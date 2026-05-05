import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { LeavePayoutRequest } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): LeavePayoutRequest {
  const agent = row.roster_agents as Record<string, unknown> | null;
  return {
    id:               String(row.id ?? ''),
    agentId:          String(row.agent_id ?? ''),
    agentName:        agent ? String(agent.name ?? '') : undefined,
    daysRequested:    Number(row.days_requested ?? 0),
    status:           (row.status ?? 'pending') as LeavePayoutRequest['status'],
    leaveWindowStart: String(row.leave_window_start ?? ''),
    notes:            String(row.notes ?? ''),
    reviewedBy:       row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt:       row.reviewed_at ? String(row.reviewed_at) : null,
    createdAt:        String(row.created_at ?? ''),
  };
}

// GET /api/roster/leave-payout — list all payout requests
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const status  = searchParams.get('status');

    let query = getSupabase()
      .from('leave_payout_requests')
      .select('*, roster_agents(name)')
      .order('created_at', { ascending: false });

    if (agentId) query = query.eq('agent_id', agentId);
    if (status)  query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/roster/leave-payout — staff submits a payout request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.agentId)          return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    if (!body.daysRequested)    return NextResponse.json({ error: 'daysRequested is required' }, { status: 400 });
    if (!body.leaveWindowStart) return NextResponse.json({ error: 'leaveWindowStart is required' }, { status: 400 });

    const days = Number(body.daysRequested);
    if (isNaN(days) || days <= 0 || days > 5 || !Number.isInteger(days)) {
      return NextResponse.json({ error: 'daysRequested must be a whole number between 1 and 5' }, { status: 400 });
    }

    // Prevent duplicate pending requests for the same agent + window
    const { data: existing } = await getSupabase()
      .from('leave_payout_requests')
      .select('id')
      .eq('agent_id', body.agentId)
      .eq('leave_window_start', body.leaveWindowStart)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A pending payout request already exists for this leave window' }, { status: 409 });
    }

    const { data, error } = await getSupabase()
      .from('leave_payout_requests')
      .insert({
        agent_id:          body.agentId,
        days_requested:    days,
        status:            'pending',
        leave_window_start: body.leaveWindowStart,
        notes:             body.notes ?? '',
      })
      .select('*, roster_agents(name)')
      .single();

    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
