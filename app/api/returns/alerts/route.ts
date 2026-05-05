import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

function daysSince(dateStr: string): number {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('returns')
      .select('date')
      .eq('follow_up_status', 'Pending');

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ level: null, count: 0 });
    }

    const ages = rows.map((r: { date: string }) => daysSince(r.date));
    const maxAge = Math.max(...ages);
    const level = maxAge >= 7 ? 'red' : maxAge >= 3 ? 'amber' : null;

    return NextResponse.json({ level, count: rows.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
