import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import {
  applyStockDeductionPlan,
  planStockDeductions,
  restoreStockDeductionPlan,
  type StockDeductionPlan,
} from '@/lib/stock-sheets';
import { logActivity } from '@/lib/activity';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

type DispatchResult = { alreadyDispatched?: boolean; status?: string };

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

    if (!['Storeroom', '3PL', 'All'].includes(dispatchSource)) {
      return NextResponse.json({ error: 'Invalid dispatch source' }, { status: 400 });
    }
    if (!Array.isArray(itemUpdates) || itemUpdates.length === 0) {
      return NextResponse.json({ error: 'No replenishment items supplied' }, { status: 400 });
    }

    const supabase = getSupabase();
    const session  = await verifySession();
    const today    = new Date().toISOString().slice(0, 10);
    const tracking = trackingNumber ?? '';
    const date     = dispatchDate ?? today;

    // Fetch and lock-relevant current state before touching the stock sheet.
    const { data: current, error: fetchErr } = await supabase
      .from('replenishment_requests')
      .select('storeroom_dispatched, tpl_dispatched, status')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const alreadyDispatched = dispatchSource === 'Storeroom'
      ? Boolean(current.storeroom_dispatched)
      : dispatchSource === '3PL'
        ? Boolean(current.tpl_dispatched)
        : Boolean(current.storeroom_dispatched || current.tpl_dispatched);
    if (alreadyDispatched) {
      return NextResponse.json({ success: true, alreadyDispatched: true, status: current.status });
    }

    const typedUpdates = itemUpdates as Array<{
      id: string; stockItemId: string; sku?: string; quantitySent: number;
      source: string; skipped: boolean;
    }>;
    const storeroomItems = typedUpdates.filter(item =>
      !item.skipped && item.source === 'Storeroom' && item.quantitySent > 0
    );
    let stockPlan: StockDeductionPlan | null = null;
    const reason = `Replenishment — ${store ?? 'Store'}`;
    const notes = `Request ID: ${id}. Tracking: ${tracking || '—'}`;

    if (dispatchSource === 'Storeroom' || dispatchSource === 'All') {
      if (dispatchSource === 'Storeroom' && storeroomItems.length === 0) {
        return NextResponse.json({ error: 'No active Storeroom items to dispatch' }, { status: 400 });
      }
      stockPlan = await planStockDeductions(storeroomItems.map(item => ({
        sku: item.sku || item.stockItemId || '',
        quantity: item.quantitySent,
      })));
      await applyStockDeductionPlan(stockPlan, `OUT · ${reason} · ${notes}`);
    }

    let finalizeResult: DispatchResult | null = null;
    try {
      const { data, error } = await supabase.rpc('finalize_replenishment_dispatch', {
        p_request_id: id,
        p_dispatch_source: dispatchSource,
        p_tracking: tracking,
        p_dispatch_date: date,
        p_item_updates: typedUpdates,
      });
      if (error) throw error;
      finalizeResult = data as DispatchResult;
    } catch (error) {
      if (stockPlan) {
        try {
          await restoreStockDeductionPlan(stockPlan);
        } catch (restoreError) {
          console.error('[replenishment dispatch] stock restoration failed', restoreError);
          throw new Error(`Dispatch failed and Stock Room restoration also failed. Check request ${id} before retrying.`);
        }
      }
      throw error;
    }

    if (stockPlan && !finalizeResult?.alreadyDispatched) {
      const movementId = crypto.randomUUID();
      await logActivity({
        actor: session?.name || 'Stock',
        action: 'stock_movement_created',
        entityType: 'stock_movement',
        entityId: movementId,
        entityLabel: `OUT · ${reason}`,
        detail: {
          type: 'out', reason, notes,
          items: stockPlan.items.map(item => ({
            id: crypto.randomUUID(), movementId, stockItemId: item.sku,
            stockItemName: item.itemName, quantity: item.quantityDeducted,
          })),
        },
      });
    }

    return NextResponse.json({ success: true, ...finalizeResult });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
