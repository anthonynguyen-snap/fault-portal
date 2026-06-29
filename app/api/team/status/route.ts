import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

type ShiftType = 'mon-fri' | 'tue-sat' | 'sun-thu';
type LeaveType = 'sick' | 'makeup' | 'other' | 'ph-holiday' | 'annual';

const SHIFT_DAYS: Record<ShiftType, number[]> = {
  'mon-fri': [1, 2, 3, 4, 5],
  'tue-sat': [2, 3, 4, 5, 6],
  'sun-thu': [0, 1, 2, 3, 4],
};

const LEAVE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick leave',
  makeup: 'Make-up day',
  other: 'Leave',
  'ph-holiday': 'PH holiday',
  annual: 'Annual leave',
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

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function mondayOf(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
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

  const [{ data: overrides }, { data: leave }] = await Promise.all([
    supabase.from('roster_overrides').select('agent_id, is_working, notes').eq('date', todayStr),
    supabase.from('roster_leave').select('agent_id, leave_type, notes').eq('date', todayStr),
  ]);

  const rotationStart = config?.rotation_start_date ? new Date(config.rotation_start_date) : today;
  const loggedInIds   = new Set((logs || []).map((l: { agent_id: string }) => l.agent_id));
  const overrideMap = new Map((overrides || []).map((o: { agent_id: string; is_working: boolean; notes?: string }) => [o.agent_id, o]));
  const leaveMap = new Map((leave || []).map((l: { agent_id: string; leave_type: LeaveType; notes?: string }) => [l.agent_id, l]));

  const team = (agents || []).map((a: { id: string; name: string; colour: string; shift_type: string }) => {
    const shift     = effectiveShift(a.shift_type as ShiftType, today, rotationStart);
    const baseScheduled = SHIFT_DAYS[shift].includes(dayOfWeek);
    const override = overrideMap.get(a.id);
    const leaveRecord = leaveMap.get(a.id);
    const scheduled = leaveRecord ? false : override ? Boolean(override.is_working) : baseScheduled;
    const source = leaveRecord ? 'leave' : override ? 'override' : 'roster';
    const statusLabel = leaveRecord
      ? LEAVE_LABELS[leaveRecord.leave_type] ?? 'Leave'
      : override
        ? (override.is_working ? 'Override: working' : 'Override: off')
        : (scheduled ? 'Rostered today' : 'Off today');

    return {
      id:        a.id,
      name:      a.name,
      colour:    a.colour,
      shift,
      scheduled,
      loggedIn:  loggedInIds.has(a.id),
      source,
      statusLabel,
      notes: leaveRecord?.notes || override?.notes || '',
    };
  });

  // Flag a monthly weekend rotation whenever the first of a month falls in
  // this Monday–Sunday week. This also covers months that begin mid-week.
  const weekStart = mondayOf(today);
  const changeDate = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
    .find(date => date.getDate() === 1);
  const rotatingAgents = (agents || []).filter(
    (agent: { shift_type: string }) => agent.shift_type !== 'mon-fri',
  );
  const changeover = changeDate
    ? {
        date: changeDate.toISOString().slice(0, 10),
        members: rotatingAgents.map((agent: { id: string; name: string; shift_type: string }) => ({
          id: agent.id,
          name: agent.name,
          shift: effectiveShift(agent.shift_type as ShiftType, changeDate, rotationStart),
        })),
      }
    : null;

  return NextResponse.json({ data: team, changeover });
}
