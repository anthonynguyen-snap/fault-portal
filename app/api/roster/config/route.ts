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
    return NextResponse.json({ data: { id: String(data.id), rotationStartDate: String(data.rotation_start_date) } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { data: existing } = await getSupabase().from('roster_config').select('id').limit(1).single();
    if (existing) {
      const { error } = await getSupabase()
        .from('roster_config').update({ rotation_start_date: body.rotationStartDate }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await getSupabase()
        .from('roster_config').insert({ rotation_start_date: body.rotationStartDate });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
