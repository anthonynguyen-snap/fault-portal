import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('refund_requests')
      .select('id')
      .eq('status', 'Pending');
    if (error) throw error;
    const count = (data ?? []).length;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
