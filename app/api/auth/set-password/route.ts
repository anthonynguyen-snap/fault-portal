import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { agentId, password } = await req.json();
  if (!agentId || !password) {
    return NextResponse.json({ error: 'agentId and password required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const supabase = getSupabase();

  const { error } = await supabase
    .from('roster_agents')
    .update({ password_hash: hash })
    .eq('id', agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
