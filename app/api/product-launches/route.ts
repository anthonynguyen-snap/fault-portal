import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('product_launches')
      .select('*')
      .eq('archived', false)
      .order('launch_date', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = `LAUNCH-${Date.now()}`;
    const { data, error } = await getSupabase()
      .from('product_launches')
      .insert({
        id,
        name:        body.name,
        description: body.description || '',
        price_aud:   body.priceAud ?? null,
        image_url:   body.imageUrl || '',
        launch_date: body.launchDate || null,
        link:        body.link || '',
        archived:    false,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if ('name'        in rest) updates.name        = rest.name;
    if ('description' in rest) updates.description = rest.description;
    if ('priceAud'    in rest) updates.price_aud   = rest.priceAud;
    if ('imageUrl'    in rest) updates.image_url   = rest.imageUrl;
    if ('launchDate'  in rest) updates.launch_date = rest.launchDate;
    if ('link'        in rest) updates.link        = rest.link;
    if ('archived'    in rest) updates.archived    = rest.archived;
    const { error } = await getSupabase().from('product_launches').update(updates).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const { error } = await getSupabase().from('product_launches').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
