import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// PATCH /api/roster/leave-payout/[id] — admin approves or denies
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.status || !['approved', 'denied'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be "approved" or "denied"' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('leave_payout_requests')
      .update({
        status:      body.status,
        reviewed_by: body.reviewedBy ?? null,
        reviewed_at: new Date().toISOString(),
        notes:       body.notes ?? '',
      })
      .eq('id', id)
      .select('*, roster_agents(name)')
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
