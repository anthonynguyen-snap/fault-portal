import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const session = await verifySession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roster_agents')
    .select('id, name, email, role, password_hash')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch last login for each agent
  const agentIds = (data || []).map((a: Record<string, unknown>) => a.id as string);
  const { data: shifts } = await supabase
    .from('shift_logs')
    .select('agent_id, clock_in')
    .in('agent_id', agentIds)
    .order('clock_in', { ascending: false });

  // Build a map of agentId → most recent clock_in
  const lastLoginMap: Record<string, string> = {};
  for (const shift of (shifts || [])) {
    const s = shift as { agent_id: string; clock_in: string };
    if (!lastLoginMap[s.agent_id]) {
      lastLoginMap[s.agent_id] = s.clock_in;
    }
  }

  const agents = (data || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    name: a.name as string,
    email: (a.email as string) || null,
    role: ((a.role as string) || 'staff') as 'admin' | 'staff',
    hasPassword: !!(a.password_hash as string),
    lastLogin: lastLoginMap[a.id as string] || null,
  }));

  return NextResponse.json({ data: agents });
}

export async function PATCH(req: Request) {
  const session = await verifySession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { agentId, role } = await req.json();
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

  const supabase = getSupabase();
  const update: Record<string, unknown> = {};
  if (role) update.role = role;

  const { error } = await supabase.from('roster_agents').update(update).eq('id', agentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
