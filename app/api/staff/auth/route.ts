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

  const agents = (data || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    name: a.name as string,
    email: (a.email as string) || null,
    role: ((a.role as string) || 'staff') as 'admin' | 'staff',
    hasPassword: !!(a.password_hash as string),
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
