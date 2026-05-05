import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both fields are required' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch current hash
  const { data: agent, error } = await supabase
    .from('roster_agents')
    .select('password_hash')
    .eq('id', session.agentId)
    .single();

  if (error || !agent?.password_hash) {
    return NextResponse.json({ error: 'Account error — contact admin' }, { status: 500 });
  }

  // Verify current password
  const valid = await bcrypt.compare(currentPassword, agent.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  // Hash and save new password
  const hash = await bcrypt.hash(newPassword, 12);
  const { error: updateError } = await supabase
    .from('roster_agents')
    .update({ password_hash: hash })
    .eq('id', session.agentId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
