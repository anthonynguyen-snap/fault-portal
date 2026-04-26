import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { StockMovement, StockMovementItem } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): StockMovement {
  const rawItems = Array.isArray(row.stock_movement_items)
    ? (row.stock_movement_items as Record<string, unknown>[])
    : [];
  const items: StockMovementItem[] = rawItems.map(i => ({
    id:            String(i.id ?? ''),
    movementId:    String(i.movement_id ?? ''),
    stockItemId:   String(i.stock_item_id ?? ''),
    stockItemName: String((i.stock_items as Record<string, unknown>)?.name ?? ''),
    quantity:      Number(i.quantity ?? 0),
  }));
  return {
    id:        String(row.id ?? ''),
    type:      row.type as 'in' | 'out',
    reason:    String(row.reason ?? ''),
    notes:     String(row.notes ?? ''),
    createdAt: String(row.created_at ?? ''),
    items,
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('stock_movements')
      .select('*, stock_movement_items(*, stock_items(name))')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, reason, notes, items } = await req.json();
    if (!type || !reason || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Insert movement
    const { data: movement, error: mvErr } = await getSupabase()
      .from('stock_movements')
      .insert({ type, reason, notes: notes ?? '' })
      .select()
      .single();
    if (mvErr) throw mvErr;

    // 2. Insert movement items
    const itemRows = items.map((i: { stockItemId: string; quantity: number }) => ({
      movement_id:   movement.id,
      stock_item_id: i.stockItemId,
      quantity:      i.quantity,
    }));
    const { error: itemErr } = await getSupabase()
      .from('stock_movement_items')
      .insert(itemRows);
    if (itemErr) throw itemErr;

    // 3. Update stock quantities
    for (const item of items as { stockItemId: string; quantity: number }[]) {
      const { data: current, error: fetchErr } = await getSupabase()
        .from('stock_items')
        .select('quantity')
        .eq('id', item.stockItemId)
        .single();
      if (fetchErr) throw fetchErr;
      const newQty = type === 'in'
        ? Number(current.quantity) + item.quantity
        : Math.max(0, Number(current.quantity) - item.quantity);
      const { error: updateErr } = await getSupabase()
        .from('stock_items')
        .update({ quantity: newQty })
        .eq('id', item.stockItemId);
      if (updateErr) throw updateErr;
    }

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
