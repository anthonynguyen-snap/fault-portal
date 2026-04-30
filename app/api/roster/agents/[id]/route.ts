import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (body.name           !== undefined) patch.name             = body.name;
    if (body.colour         !== undefined) patch.colour           = body.colour;
    if (body.shiftType      !== undefined) patch.shift_type       = body.shiftType;
    if (body.isAdmin        !== undefined) patch.is_admin         = body.isAdmin;
    if (body.active         !== undefined) patch.active           = body.active;
    if (body.leaveResetDate !== undefined) patch.leave_reset_date = body.leaveResetDate || null;
    const { error } = await getSupabase().from('roster_agents').update(patch).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabase().from('roster_agents').update({ active: false }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
