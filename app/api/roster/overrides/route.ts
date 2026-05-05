import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RosterOverride } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): RosterOverride {
  return {
    id:        String(row.id ?? ''),
    agentId:   String(row.agent_id ?? ''),
    date:      String(row.date ?? ''),
    isWorking: Boolean(row.is_working ?? true),
    notes:     String(row.notes ?? ''),
    hours:     Number(row.hours ?? 0),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to   = searchParams.get('to');
    let query = getSupabase().from('roster_overrides').select('*');
    if (from) query = query.gte('date', from);
    if (to)   query = query.lte('date', to);
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
    const { error } = await getSupabase()
      .from('roster_overrides')
      .upsert({
        agent_id:   body.agentId,
        date:       body.date,
        is_working: body.isWorking,
        notes:      body.notes ?? '',
        hours:      body.hours ?? 0,
      }, { onConflict: 'agent_id,date' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { error } = await getSupabase()
      .from('roster_overrides')
      .delete()
      .eq('agent_id', body.agentId)
      .eq('date', body.date);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
