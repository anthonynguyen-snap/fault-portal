import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

type ShiftType = 'mon-fri' | 'tue-sat' | 'sun-thu';

const SHIFT_DAYS: Record<ShiftType, number[]> = {
  'mon-fri': [1, 2, 3, 4, 5],
  'tue-sat': [2, 3, 4, 5, 6],
  'sun-thu': [0, 1, 2, 3, 4],
};

function effectiveShift(shiftType: ShiftType, today: Date, rotationStart: Date): ShiftType {
  if (shiftType === 'mon-fri') return 'mon-fri';
  const monthsElapsed =
    (today.getFullYear() - rotationStart.getFullYear()) * 12 +
    (today.getMonth() - rotationStart.getMonth());
  const isSwapped = ((monthsElapsed % 2) + 2) % 2 === 1;
  if (!isSwapped) return shiftType;
  return shiftType === 'tue-sat' ? 'sun-thu' : 'tue-sat';
}

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();

  // Today in ACST/ACDT
  const now   = new Date();
  const today = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Australia/Adelaide' }) + 'T00:00:00');
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat

  const [{ data: agents }, { data: config }, { data: logs }] = await Promise.all([
    supabase.from('roster_agents').select('id, name, colour, shift_type').eq('active', true).order('created_at'),
    supabase.from('roster_config').select('rotation_start_date').limit(1).single(),
    supabase.from('shift_logs').select('agent_id').eq('date', todayStr),
  ]);

  const rotationStart = config?.rotation_start_date ? new Date(config.rotation_start_date) : today;
  const loggedInIds   = new Set((logs || []).map((l: { agent_id: string }) => l.agent_id));

  const team = (agents || []).map((a: { id: string; name: string; colour: string; shift_type: string }) => {
    const shift     = effectiveShift(a.shift_type as ShiftType, today, rotationStart);
    const scheduled = SHIFT_DAYS[shift].includes(dayOfWeek);
    return {
      id:        a.id,
      name:      a.name,
      colour:    a.colour,
      shift,
      scheduled,
      loggedIn:  loggedInIds.has(a.id),
    };
  });

  return NextResponse.json({ data: team });
}
