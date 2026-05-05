import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name              !== undefined) updates.name                = body.name.trim();
    if (body.sku               !== undefined) updates.sku                 = body.sku.trim();
    if (body.lowStockThreshold !== undefined) updates.low_stock_threshold = body.lowStockThreshold;
    if (body.discontinued      !== undefined) updates.discontinued        = body.discontinued;
    const { data, error } = await getSupabase()
      .from('stock_items')
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
      .from('stock_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
