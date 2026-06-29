import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const LAUNCH_VISIBILITY_DAYS = 14;
const PORTAL_TIME_ZONE = 'Australia/Adelaide';

function portalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PORTAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

function isVisibleLaunch(launchDate: string | null, today = portalDateKey()) {
  // Launches without a date remain visible until an admin gives them one.
  if (!launchDate) return true;

  const [year, month, day] = launchDate.split('-').map(Number);
  const expiresOn = new Date(Date.UTC(year, month - 1, day + LAUNCH_VISIBILITY_DAYS))
    .toISOString()
    .slice(0, 10);

  return today < expiresOn;
}

export async function GET(req: NextRequest) {
  try {
    const includeExpired = req.nextUrl.searchParams.get('includeExpired') === 'true';
    const { data, error } = await getSupabase()
      .from('product_launches')
      .select('*')
      .eq('archived', false)
      .order('launch_date', { ascending: true });
    if (error) throw error;
    const launches = data ?? [];
    return NextResponse.json({
      data: includeExpired
        ? launches
        : launches.filter(launch => isVisibleLaunch(launch.launch_date)),
    });
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
