import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (body.leaveType      !== undefined) patch.leave_type      = body.leaveType;
    if (body.notes          !== undefined) patch.notes           = body.notes;
    if (body.hoursOwed      !== undefined) patch.hours_owed      = body.hoursOwed;
    if (body.hoursCompleted !== undefined) patch.hours_completed = body.hoursCompleted;
    const { error } = await getSupabase().from('roster_leave').update(patch).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabase().from('roster_leave').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
