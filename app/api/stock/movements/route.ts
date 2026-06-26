import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { adjustStockQuantity, getAllStockItems } from '@/lib/stock-sheets';
import type { StockMovement, StockMovementItem } from '@/types';

export const runtime = 'nodejs';

// ─── GET ──────────────────────────────────────────────────────────────────────
// Reads movement history from activity_log (entity_type = 'stock_movement').

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('activity_log')
      .select('entity_id, detail, ts')
      .eq('entity_type', 'stock_movement')
      .eq('action', 'stock_movement_created')
      .order('ts', { ascending: false })
      .limit(50);
    if (error) throw error;

    const movements: StockMovement[] = (data ?? []).map((row) => {
      const d = (row.detail ?? {}) as {
        type:   'in' | 'out';
        reason: string;
        notes:  string;
        items:  StockMovementItem[];
      };
      return {
        id:        String(row.entity_id ?? ''),
        type:      d.type   ?? 'in',
        reason:    d.reason ?? '',
        notes:     d.notes  ?? '',
        createdAt: String(row.ts ?? ''),
        items:     Array.isArray(d.items) ? d.items : [],
      };
    });

    return NextResponse.json({ data: movements });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Adjusts quantities in Google Sheets, then logs the movement to activity_log.

export async function POST(req: NextRequest) {
  try {
    const { type, reason, notes, items } = await req.json() as {
      type:   'in' | 'out';
      reason: string;
      notes?: string;
      items:  { stockItemId: string; quantity: number }[];
    };

    if (!type || !reason || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build a SKU→name map so we can store names in the log without a
    // separate lookup per item (one read, then N writes).
    const allItems  = await getAllStockItems();
    const nameBysku = new Map(allItems.map((i) => [i.sku, i.name]));

    // Adjust quantities in Google Sheets.
    const movementItems: StockMovementItem[] = [];
    const movementId = crypto.randomUUID();

    for (const lineItem of items) {
      const sku   = lineItem.stockItemId;  // after migration, stockItemId IS the sku
      const delta = type === 'in' ? lineItem.quantity : -lineItem.quantity;
      const note  = `${type.toUpperCase()} · ${reason}${notes ? ' · ' + notes : ''}`;

      const { newQuantity, itemName } = await adjustStockQuantity(sku, delta, note);

      movementItems.push({
        id:            crypto.randomUUID(),
        movementId,
        stockItemId:   sku,
        stockItemName: itemName || nameBysku.get(sku) || sku,
        quantity:      lineItem.quantity,
      });

      // Keep the local allItems list in sync so that if the same SKU appears
      // twice in one movement, the second delta sees the updated quantity.
      const cached = allItems.find((i) => i.sku === sku);
      if (cached) cached.quantity = newQuantity;
    }

    // Record the movement in activity_log so the history tab can show it.
    const { error: logErr } = await getSupabase().from('activity_log').insert({
      actor:        'Stock',
      action:       'stock_movement_created',
      entity_type:  'stock_movement',
      entity_id:    movementId,
      entity_label: `${type.toUpperCase()} · ${reason}`,
      detail: {
        type,
        reason,
        notes: notes ?? '',
        items: movementItems,
      },
    });
    if (logErr) {
      // Non-fatal: quantities are already updated in Sheets; just log the error.
      console.error('activity_log insert failed:', logErr.message);
    }

    return NextResponse.json({ data: { id: movementId } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
