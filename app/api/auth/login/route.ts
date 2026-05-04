import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabase } from '@/lib/supabase';
import { createSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Look up agent by email
  const { data: agent, error } = await supabase
    .from('roster_agents')
    .select('id, name, email, password_hash, role')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  if (!agent.password_hash) {
    return NextResponse.json({ error: 'Account not set up — contact admin' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, agent.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Clock in: create shift log (date in ACST/ACDT)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' });
  const { data: shiftLog } = await supabase
    .from('shift_logs')
    .insert([{
      agent_id: agent.id,
      date: today,
      clock_in: new Date().toISOString(),
    }])
    .select('id')
    .single();

  // Create session
  await createSession({
    agentId: agent.id,
    name: agent.name,
    email: agent.email,
    role: agent.role as 'admin' | 'staff',
    shiftLogId: shiftLog?.id,
  });

  return NextResponse.json({
    success: true,
    user: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
    },
  });
}
