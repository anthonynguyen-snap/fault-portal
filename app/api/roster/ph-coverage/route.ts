import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// GET /api/roster/ph-coverage?dates=2026-05-01,2026-06-12
export async function GET(req: NextRequest) {
  try {
    const dates = req.nextUrl.searchParams.get('dates')?.split(',').filter(Boolean) ?? [];
    if (!dates.length) return NextResponse.json({ data: [] });

    const { data, error } = await getSupabase()
      .from('ph_holiday_coverage')
      .select('*')
      .in('holiday_date', dates);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []).map(r => ({
        id:          String(r.id),
        holidayDate: String(r.holiday_date),
        agentId:     String(r.agent_id),
        working:     Boolean(r.working),
        notes:       String(r.notes ?? ''),
        createdAt:   String(r.created_at),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/roster/ph-coverage  { holidayDate, agentId, working, notes? }
// Upserts — safe to call multiple times to change mind
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { holidayDate, agentId, working, notes = '' } = body;
    if (!holidayDate || !agentId || working === undefined) {
      return NextResponse.json({ error: 'holidayDate, agentId and working are required' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('ph_holiday_coverage')
      .upsert(
        { holiday_date: holidayDate, agent_id: agentId, working, notes },
        { onConflict: 'holiday_date,agent_id' }
      )
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({
      data: {
        id:          String(data.id),
        holidayDate: String(data.holiday_date),
        agentId:     String(data.agent_id),
        working:     Boolean(data.working),
        notes:       String(data.notes ?? ''),
        createdAt:   String(data.created_at),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
