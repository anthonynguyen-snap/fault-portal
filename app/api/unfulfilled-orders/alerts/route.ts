import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!await verifySession()) return NextResponse.json({ count: 0 });
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await getSupabase()
      .from('unfulfilled_orders')
      .select('contacted_at, follow_up_required, follow_up_on')
      .is('resolved_at', null);
    if (error) throw error;
    const count = (data ?? []).filter(order => (
      !order.contacted_at ||
      (order.follow_up_required && (!order.follow_up_on || order.follow_up_on <= today))
    )).length;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
