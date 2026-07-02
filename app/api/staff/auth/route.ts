import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { hasAdminAccess, verifySession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

type PortalRole = 'admin' | 'management' | 'staff';

function displayRole(agent: Record<string, unknown>): PortalRole {
  if (agent.role === 'staff' && agent.active === false && agent.is_admin === true) {
    return 'management';
  }
  return agent.role === 'admin' ? 'admin' : 'staff';
}

export async function GET() {
  const session = await verifySession();
  if (!session || !hasAdminAccess(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roster_agents')
    .select('id, name, email, role, password_hash, active, is_admin')
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
    role: displayRole(a),
    hasPassword: !!(a.password_hash as string),
    lastLogin: lastLoginMap[a.id as string] || null,
    portalOnly: displayRole(a) === 'management',
  }));

  return NextResponse.json({ data: agents });
}

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session || !hasAdminAccess(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { data, error } = await getSupabase()
    .from('roster_agents')
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: 'staff',
      active: false,
      is_admin: true,
      colour: '#64748b',
      shift_type: 'mon-fri',
    })
    .select('id, name, email, role, password_hash, active, is_admin')
    .single();

  if (error) {
    const message = error.code === '23505' ? 'That email address is already in use' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    data: { id: data.id, name: data.name, email: data.email, role: 'management', hasPassword: true, lastLogin: null, portalOnly: true },
  }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await verifySession();
  if (!session || !hasAdminAccess(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { agentId, role } = await req.json();
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

  const supabase = getSupabase();
  const update: Record<string, unknown> = {};
  if (role === 'management') {
    update.role = 'staff';
    update.active = false;
    update.is_admin = true;
  } else if (role === 'admin') {
    update.role = 'admin';
  } else if (role === 'staff') {
    update.role = 'staff';
    update.active = true;
    update.is_admin = false;
  }

  const { error } = await supabase.from('roster_agents').update(update).eq('id', agentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
