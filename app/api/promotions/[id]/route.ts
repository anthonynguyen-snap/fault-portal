import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.name             !== undefined) updates.name             = body.name.trim();
    if (body.code             !== undefined) updates.code             = body.code.trim();
    if (body.platform         !== undefined) updates.platform         = body.platform;
    if (body.description      !== undefined) updates.description      = body.description.trim();
    if (body.discountType     !== undefined) updates.discount_type    = body.discountType;
    if (body.discountValue    !== undefined) updates.discount_value   = body.discountValue.trim();
    if (body.productsCovered  !== undefined) updates.products_covered = body.productsCovered.trim();
    if (body.notes            !== undefined) updates.notes            = body.notes.trim();
    if (body.startDate        !== undefined) updates.start_date       = body.startDate;
    if (body.endDate          !== undefined) updates.end_date         = body.endDate || null;
    if (body.enabled          !== undefined) updates.enabled          = body.enabled;
    if (body.previousRuns     !== undefined) updates.previous_runs    = body.previousRuns;
    if (body.isMajor          !== undefined) updates.is_major         = body.isMajor;

    const { data, error } = await getSupabase()
      .from('promotions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabase()
      .from('promotions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
