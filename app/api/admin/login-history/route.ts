import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await verifySession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId') || null;
  const days    = parseInt(searchParams.get('days') || '30', 10);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = getSupabase();

  let query = supabase
    .from('shift_logs')
    .select('id, agent_id, clock_in, date')
    .gte('clock_in', since.toISOString())
    .order('clock_in', { ascending: false })
    .limit(200);

  if (agentId) query = query.eq('agent_id', agentId);

  const { data: logs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch agent names + roles
  const seen = new Set<string>();
  const agentIds: string[] = [];
  for (const l of (logs || []) as { agent_id: string }[]) {
    if (!seen.has(l.agent_id)) { seen.add(l.agent_id); agentIds.push(l.agent_id); }
  }
  const { data: agents } = await supabase
    .from('roster_agents')
    .select('id, name, role')
    .in('id', agentIds);

  const agentMap: Record<string, { name: string; role: string }> = {};
  for (const a of (agents || []) as { id: string; name: string; role: string }[]) {
    agentMap[a.id] = { name: a.name, role: a.role };
  }

  const events = (logs || []).map((l: Record<string, unknown>) => ({
    id:       l.id as string,
    agentId:  l.agent_id as string,
    name:     agentMap[l.agent_id as string]?.name ?? 'Unknown',
    role:     agentMap[l.agent_id as string]?.role ?? 'staff',
    loggedIn: l.clock_in as string,
    date:     l.date as string,
  }));

  return NextResponse.json({ data: events });
}
