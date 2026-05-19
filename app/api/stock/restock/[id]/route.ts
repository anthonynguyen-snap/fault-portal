import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RestockItem } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): RestockItem {
  return {
    id:                  String(row.id ?? ''),
    productName:         String(row.product_name ?? ''),
    sku:                 String(row.sku ?? ''),
    status:              (row.status as RestockItem['status']) ?? 'Out of Stock',
    expectedRestockDate: (row.expected_restock_date as string | null) ?? null,
    supplier:            String(row.supplier ?? ''),
    notes:               String(row.notes ?? ''),
    resolved:            Boolean(row.resolved ?? false),
    createdAt:           String(row.created_at ?? ''),
    resolvedAt:          (row.resolved_at as string | null) ?? null,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.productName         !== undefined) updates.product_name          = body.productName.trim();
    if (body.sku                 !== undefined) updates.sku                   = body.sku.trim();
    if (body.status              !== undefined) updates.status                = body.status;
    if (body.expectedRestockDate !== undefined) updates.expected_restock_date = body.expectedRestockDate || null;
    if (body.supplier            !== undefined) updates.supplier              = body.supplier.trim();
    if (body.notes               !== undefined) updates.notes                 = body.notes;
    if (body.resolved            !== undefined) {
      updates.resolved    = body.resolved;
      updates.resolved_at = body.resolved ? new Date().toISOString() : null;
    }
    const { data, error } = await getSupabase()
      .from('restock_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabase()
      .from('restock_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
