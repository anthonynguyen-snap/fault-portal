import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { ReplenishmentRequest, ReplenishmentLineItem } from '@/types';

export const runtime = 'nodejs';

function fromItemRow(row: Record<string, unknown>): ReplenishmentLineItem {
  return {
    id:                String(row.id ?? ''),
    requestId:         String(row.request_id ?? ''),
    stockItemId:       String(row.stock_item_id ?? ''),
    stockItemName:     String(row.stock_item_name ?? ''),
    sku:               String(row.sku ?? ''),
    quantityRequested: Number(row.quantity_requested ?? 0),
    quantityOnHand:    Number(row.quantity_on_hand ?? 0),
    quantitySent:      Number(row.quantity_sent ?? 0),
    source:            (row.source ?? 'Storeroom') as ReplenishmentLineItem['source'],
    skipped:           Boolean(row.skipped ?? false),
  };
}

function fromRow(row: Record<string, unknown>): ReplenishmentRequest {
  const rawItems = Array.isArray(row.replenishment_items)
    ? (row.replenishment_items as Record<string, unknown>[])
    : [];
  return {
    id:             String(row.id ?? ''),
    store:          String(row.store ?? ''),
    orderNumber:    String(row.order_number ?? ''),
    requestedBy:    String(row.requested_by ?? ''),
    date:           String(row.date ?? ''),
    status:         (row.status ?? 'Pending') as ReplenishmentRequest['status'],
    items:          rawItems.map(fromItemRow),
    trackingNumber: String(row.tracking_number ?? ''),
    dispatchDate:   row.dispatch_date ? String(row.dispatch_date) : null,
    notes:          String(row.notes ?? ''),
    createdAt:      String(row.created_at ?? ''),
    storeroomDispatched:   Boolean(row.storeroom_dispatched ?? false),
    storeroomTracking:     String(row.storeroom_tracking ?? ''),
    storeroomDispatchDate: row.storeroom_dispatch_date ? String(row.storeroom_dispatch_date) : null,
    tplDispatched:         Boolean(row.tpl_dispatched ?? false),
    tplTracking:           String(row.tpl_tracking ?? ''),
    tplDispatchDate:       row.tpl_dispatch_date ? String(row.tpl_dispatch_date) : null,
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('replenishment_requests')
      .select('*, replenishment_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { store, orderNumber, requestedBy, date, notes, items } = body;

    if (!store || !items?.length) {
      return NextResponse.json({ error: 'Store and items are required' }, { status: 400 });
    }

    const { data: request, error: reqErr } = await getSupabase()
      .from('replenishment_requests')
      .insert({
        store,
        order_number:  orderNumber ?? '',
        requested_by:  requestedBy ?? '',
        date:          date ?? new Date().toISOString().slice(0, 10),
        status:        'Pending',
        notes:         notes ?? '',
      })
      .select()
      .single();
    if (reqErr) throw reqErr;

    const itemRows = items.map((item: Record<string, unknown>) => ({
      request_id:          request.id,
      stock_item_id:       item.stockItemId || null,
      stock_item_name:     String(item.stockItemName ?? ''),
      sku:                 String(item.sku ?? ''),
      quantity_requested:  Number(item.quantityRequested) || 0,
      quantity_on_hand:    Number(item.quantityOnHand) || 0,
      quantity_sent:       0,
      source:              String(item.source ?? 'Storeroom'),
      skipped:             Boolean(item.skipped ?? false),
    }));

    const { error: itemErr } = await getSupabase()
      .from('replenishment_items')
      .insert(itemRows);
    if (itemErr) throw itemErr;

    const { data: full } = await getSupabase()
      .from('replenishment_requests')
      .select('*, replenishment_items(*)')
      .eq('id', request.id)
      .single();

    return NextResponse.json({ data: fromRow(full) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
