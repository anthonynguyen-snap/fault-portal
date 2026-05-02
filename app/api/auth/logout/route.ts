import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession, clearSession } from '@/lib/auth';

export async function POST() {
  const session = await verifySession();

  if (session?.shiftLogId) {
    // Clock out: update shift log with clock_out time
    const supabase = getSupabase();
    await supabase
      .from('shift_logs')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', session.shiftLogId)
      .is('clock_out', null);
  }

  await clearSession();

  return NextResponse.json({ success: true });
}
