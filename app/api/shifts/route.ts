import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const supabase = getSupabase();
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // Staff can only see their own shifts
  const targetAgentId = session.role === 'admin' && agentId ? agentId : session.agentId;

  let query = supabase
    .from('shift_logs')
    .select('id, agent_id, clock_in, clock_out, date, created_at')
    .eq('agent_id', targetAgentId)
    .order('clock_in', { ascending: false });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}
