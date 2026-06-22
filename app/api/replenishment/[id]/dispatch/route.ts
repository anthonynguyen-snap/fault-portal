import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { adjustStockQuantity } from '@/lib/stock-sheets';
import { logActivity } from '@/lib/activity';

export const runtime = 'nodejs';

/**
 * POST /api/replenishment/[id]/dispatch
 *
 * Supports split dispatch:
 *   dispatchSource = 'Storeroom' | '3PL' | 'All'
 *
 * For Storeroom: marks storeroom_dispatched, deducts stock, saves storeroom tracking.
 * For 3PL:       marks tpl_dispatched, saves tpl tracking.
 * For All:       legacy single-dispatch (both at once).
 *
 * Status logic:
 *   - One side done  → 'Partially Dispatched'
 *   - Both sides done → 'Dispatched'
 *   - Only one source type exists → 'Dispatched' immediately
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const {
      dispatchSource = 'All',
      trackingNumber,
      dispatchDate,
      itemUpdates,
      store,
    } = await req.json();

    const supabase = getSupabase();
    const today    = new Date().toISOString().slice(0, 10);
    const tracking = trackingNumber ?? '';
    const date     = dispatchDate ?? today;

    // 1. Update each item's qty_sent, source, skipped
    for (const item of itemUpdates as {
      id: string; stockItemId: string; sku?: string; quantitySent: number;
      source: string; skipped: boolean;
    }[]) {
      const { error } = await supabase
        .from('replenishment_items')
        .update({ quantity_sent: item.quantitySent, source: item.source, skipped: item.skipped })
        .eq('id', item.id);
      if (error) throw error;
    }

    // 2. Fetch current dispatch state
    const { data: current, error: fetchErr } = await supabase
      .from('replenishment_requests')
      .select('storeroom_dispatched, tpl_dispatched')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    // Which sources are active (non-skipped) in this request?
    const activeItems = (itemUpdates as { source: string; skipped: boolean }[]).filter(i => !i.skipped);
    const hasStoreroom = activeItems.some(i => i.source === 'Storeroom');
    const hasTpl       = activeItems.some(i => i.source === '3PL');

    // Build header update
    const headerUpdate: Record<string, unknown> = {};

    if (dispatchSource === 'Storeroom' || dispatchSource === 'All') {
      headerUpdate.storeroom_dispatched    = true;
      headerUpdate.storeroom_tracking      = tracking;
      headerUpdate.storeroom_dispatch_date = date;
    }
    if (dispatchSource === '3PL' || dispatchSource === 'All') {
      headerUpdate.tpl_dispatched    = true;
      headerUpdate.tpl_tracking      = tracking;
      headerUpdate.tpl_dispatch_date = date;
    }

    // Determine new overall status
    const storeroomDone = (dispatchSource === 'Storeroom' || dispatchSource === 'All') ? true : Boolean(current.storeroom_dispatched);
    const tplDone       = (dispatchSource === '3PL'       || dispatchSource === 'All') ? true : Boolean(current.tpl_dispatched);
    const allDone       = (!hasStoreroom || storeroomDone) && (!hasTpl || tplDone);

    headerUpdate.status = allDone ? 'Dispatched' : 'Partially Dispatched';
    // Keep legacy fields populated when fully dispatched
    if (allDone) {
      headerUpdate.tracking_number = tracking;
      headerUpdate.dispatch_date   = date;
    }

    const { error: reqErr } = await supabase
      .from('replenishment_requests')
      .update(headerUpdate)
      .eq('id', id);
    if (reqErr) throw reqErr;

    // 3. Deduct storeroom items from stock
    if (dispatchSource === 'Storeroom' || dispatchSource === 'All') {
      const storeroomItems = (itemUpdates as {
        id: string; stockItemId: string; sku?: string; quantitySent: number; source: string; skipped: boolean;
      }[]).filter(i => !i.skipped && i.source === 'Storeroom' && (i.stockItemId || i.sku) && i.quantitySent > 0);

      if (storeroomItems.length > 0) {
        const movementId = crypto.randomUUID();
        const movementItems = [];
        const reason = `Replenishment — ${store ?? 'Store'}`;
        const notes = `Request ID: ${id}. Tracking: ${tracking || '—'}`;

        for (const item of storeroomItems) {
          const sku = item.stockItemId || item.sku || '';
          const { itemName } = await adjustStockQuantity(
            sku,
            -item.quantitySent,
            `OUT · ${reason} · ${notes}`,
          );
          movementItems.push({
            id:            crypto.randomUUID(),
            movementId,
            stockItemId:   sku,
            stockItemName: itemName || sku,
            quantity:      item.quantitySent,
          });
        }

        void logActivity({
          actor:       'Stock',
          action:      'stock_movement_created',
          entityType:  'stock_movement',
          entityId:    movementId,
          entityLabel: `OUT · ${reason}`,
          detail: {
            type: 'out',
            reason,
            notes,
            items: movementItems,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
