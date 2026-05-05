import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { Promotion } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): Promotion {
  const endDate  = row.end_date ? String(row.end_date) : null;
  const today    = new Date().toISOString().slice(0, 10);
  const isActive = !endDate || endDate >= today;
  const enabled      = row.enabled === null || row.enabled === undefined ? true : Boolean(row.enabled);
  const previousRuns = Array.isArray(row.previous_runs) ? row.previous_runs : [];
  const isMajor      = Boolean(row.is_major ?? false);
  return {
    id:              String(row.id ?? ''),
    name:            String(row.name ?? ''),
    code:            String(row.code ?? ''),
    platform:        String(row.platform ?? 'AU (+ Popup)'),
    description:     String(row.description ?? ''),
    discountType:    String(row.discount_type ?? ''),
    discountValue:   String(row.discount_value ?? ''),
    productsCovered: String(row.products_covered ?? ''),
    notes:           String(row.notes ?? ''),
    startDate:       String(row.start_date ?? ''),
    endDate,
    createdAt:       String(row.created_at ?? ''),
    isActive,
    enabled,
    previousRuns,
    isMajor,
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('promotions')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code, platform, description, discountType, discountValue, productsCovered, notes, startDate, endDate } = body;
    if (!name?.trim())  return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!startDate)     return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
    if (!discountType)  return NextResponse.json({ error: 'Discount type is required' }, { status: 400 });

    const { data, error } = await getSupabase()
      .from('promotions')
      .insert({
        name:             name.trim(),
        code:             code?.trim() ?? '',
        platform:         platform ?? 'AU (+ Popup)',
        description:      description?.trim() ?? '',
        discount_type:    discountType,
        discount_value:   discountValue?.trim() ?? '',
        products_covered: productsCovered?.trim() ?? '',
        notes:            notes?.trim() ?? '',
        start_date:       startDate,
        end_date:         endDate || null,
        enabled:          true,
        previous_runs:    [],
        is_major:         body.isMajor ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
