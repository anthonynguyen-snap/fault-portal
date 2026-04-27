import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/replenishment/[id]/dispatch
 *
 * Marks the request as Dispatched, updates qty_sent per item,
 * records tracking number + dispatch date, and for Storeroom items
 * creates a stock movement (out) deducting from stock_items.quantity.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { trackingNumber, dispatchDate, itemUpdates, store } = await req.json();
    // itemUpdates: { id: string; stockItemId: string; quantitySent: number; source: string; skipped: boolean }[]

    const supabase = getSupabase();

    // 1. Update each item's qty_sent, source, skipped
    for (const item of itemUpdates as { id: string; stockItemId: string; quantitySent: number; source: string; skipped: boolean }[]) {
      const { error } = await supabase
        .from('replenishment_items')
        .update({ quantity_sent: item.quantitySent, source: item.source, skipped: item.skipped })
        .eq('id', item.id);
      if (error) throw error;
    }

    // 2. Mark request as Dispatched
    const { error: reqErr } = await supabase
      .from('replenishment_requests')
      .update({
        status:          'Dispatched',
        tracking_number: trackingNumber ?? '',
        dispatch_date:   dispatchDate ?? new Date().toISOString().slice(0, 10),
      })
      .eq('id', id);
    if (reqErr) throw reqErr;

    // 3. Deduct storeroom items from stock (Adelaide Popup only)
    const storeroomItems = (itemUpdates as { id: string; stockItemId: string; quantitySent: number; source: string; skipped: boolean }[])
      .filter(i => !i.skipped && i.source === 'Storeroom' && i.stockItemId && i.quantitySent > 0);

    if (storeroomItems.length > 0) {
      // Create a stock movement record (out)
      const { data: movement, error: mvErr } = await supabase
        .from('stock_movements')
        .insert({
          type:   'out',
          reason: `Replenishment — ${store ?? 'Store'}`,
          notes:  `Request ID: ${id}. Tracking: ${trackingNumber ?? '—'}`,
        })
        .select()
        .single();
      if (mvErr) throw mvErr;

      // Insert movement items
      const movementItemRows = storeroomItems.map(i => ({
        movement_id:   movement.id,
        stock_item_id: i.stockItemId,
        quantity:      i.quantitySent,
      }));
      const { error: miErr } = await supabase
        .from('stock_movement_items')
        .insert(movementItemRows);
      if (miErr) throw miErr;

      // Deduct from stock_items
      for (const item of storeroomItems) {
        const { data: current, error: fetchErr } = await supabase
          .from('stock_items')
          .select('quantity')
          .eq('id', item.stockItemId)
          .single();
        if (fetchErr) throw fetchErr;
        const newQty = Math.max(0, Number(current.quantity) - item.quantitySent);
        const { error: updateErr } = await supabase
          .from('stock_items')
          .update({ quantity: newQty })
          .eq('id', item.stockItemId);
        if (updateErr) throw updateErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
