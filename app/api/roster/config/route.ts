import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('roster_config')
      .select('*')
      .limit(1)
      .single();
    if (error) throw error;
    return NextResponse.json({
      data: {
        id:                   String(data.id),
        rotationStartDate:    String(data.rotation_start_date),
        annualLeaveResetDate: data.annual_leave_reset_date ? String(data.annual_leave_reset_date) : null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { data: existing } = await getSupabase().from('roster_config').select('id').limit(1).single();
    const payload: Record<string, unknown> = {};
    if (body.rotationStartDate    !== undefined) payload.rotation_start_date     = body.rotationStartDate;
    if (body.annualLeaveResetDate !== undefined) payload.annual_leave_reset_date = body.annualLeaveResetDate || null;

    if (existing) {
      const { error } = await getSupabase().from('roster_config').update(payload).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await getSupabase().from('roster_config').insert(payload);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
