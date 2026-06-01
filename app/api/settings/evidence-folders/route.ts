import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const KEY = 'evidence_folders';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('portal_settings')
      .select('value')
      .eq('key', KEY)
      .single();
    if (error || !data) return NextResponse.json({ data: {} });
    return NextResponse.json({ data: data.value as Record<string, string> });
  } catch {
    return NextResponse.json({ data: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { error } = await getSupabase()
      .from('portal_settings')
      .upsert({ key: KEY, value: body, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
