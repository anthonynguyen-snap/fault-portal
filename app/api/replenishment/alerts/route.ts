import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

/** Returns the date that is `n` business days after `start` (Mon–Fri). */
function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export async function GET() {
  try {
    // Fetch dispatched/partially-dispatched orders where 3PL was used but tracking is missing
    const { data, error } = await getSupabase()
      .from('replenishment_requests')
      .select('id, store, status, tpl_dispatch_date, tpl_tracking, tpl_dispatched')
      .eq('tpl_dispatched', true)
      .in('status', ['Dispatched', 'Partially Dispatched', 'Ordered'])
      .or('tpl_tracking.is.null,tpl_tracking.eq.');

    if (error) throw error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = (data ?? []).filter(row => {
      if (!row.tpl_dispatch_date) return false;
      const dispatchDate = new Date(row.tpl_dispatch_date + 'T00:00:00');
      const alertDate    = addBusinessDays(dispatchDate, 2);
      return alertDate <= today;
    }).map(row => ({
      id:              row.id,
      store:           row.store,
      status:          row.status,
      tplDispatchDate: row.tpl_dispatch_date,
    }));

    return NextResponse.json({ count: overdue.length, items: overdue });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
