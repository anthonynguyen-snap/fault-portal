import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { agentId, email } = await req.json();
  if (!agentId || !email) {
    return NextResponse.json({ error: 'agentId and email required' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('roster_agents')
    .update({ email: email.toLowerCase().trim() })
    .eq('id', agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
