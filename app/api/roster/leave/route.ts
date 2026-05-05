import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RosterLeave } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): RosterLeave {
  const agent = row.roster_agents as Record<string, unknown> | null;
  return {
    id:             String(row.id ?? ''),
    agentId:        String(row.agent_id ?? ''),
    agentName:      agent ? String(agent.name ?? '') : undefined,
    date:           String(row.date ?? ''),
    leaveType:      (row.leave_type ?? 'other') as RosterLeave['leaveType'],
    notes:          String(row.notes ?? ''),
    hoursOwed:      Number(row.hours_owed ?? 0),
    hoursCompleted: Number(row.hours_completed ?? 0),
    createdAt:      String(row.created_at ?? ''),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const from    = searchParams.get('from');
    const to      = searchParams.get('to');

    let query = getSupabase()
      .from('roster_leave')
      .select('*, roster_agents(name)')
      .order('date', { ascending: false });

    if (agentId) query = query.eq('agent_id', agentId);
    if (from)    query = query.gte('date', from);
    if (to)      query = query.lte('date', to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await getSupabase()
      .from('roster_leave')
      .insert({
        agent_id:        body.agentId,
        date:            body.date,
        leave_type:      body.leaveType,
        notes:           body.notes ?? '',
        hours_owed:      body.hoursOwed ?? 0,
        hours_completed: body.hoursCompleted ?? 0,
      })
      .select('*, roster_agents(name)')
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
