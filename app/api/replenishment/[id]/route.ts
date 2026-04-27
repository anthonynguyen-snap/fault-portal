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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await getSupabase()
      .from('replenishment_requests')
      .select('*, replenishment_items(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Update request header fields
    const headerUpdates: Record<string, unknown> = {};
    if (body.status        !== undefined) headerUpdates.status         = body.status;
    if (body.store         !== undefined) headerUpdates.store          = body.store;
    if (body.orderNumber   !== undefined) headerUpdates.order_number   = body.orderNumber;
    if (body.trackingNumber !== undefined) headerUpdates.tracking_number = body.trackingNumber;
    if (body.tplTracking   !== undefined) headerUpdates.tpl_tracking   = body.tplTracking;
    if (body.dispatchDate  !== undefined) headerUpdates.dispatch_date  = body.dispatchDate;
    if (body.notes         !== undefined) headerUpdates.notes          = body.notes;
    if (body.requestedBy   !== undefined) headerUpdates.requested_by   = body.requestedBy;

    if (Object.keys(headerUpdates).length > 0) {
      const { error } = await getSupabase()
        .from('replenishment_requests')
        .update(headerUpdates)
        .eq('id', id);
      if (error) throw error;
    }

    // Update individual item qty_sent / source if provided
    if (Array.isArray(body.itemUpdates)) {
      for (const upd of body.itemUpdates as { id: string; quantitySent: number; source: string; skipped?: boolean }[]) {
        const patch: Record<string, unknown> = { quantity_sent: upd.quantitySent, source: upd.source };
        if (upd.skipped !== undefined) patch.skipped = upd.skipped;
        const { error } = await getSupabase()
          .from('replenishment_items')
          .update(patch)
          .eq('id', upd.id);
        if (error) throw error;
      }
    }

    // Support toggling a single item's skipped state
    if (body.toggleSkipped) {
      const { id: itemId, skipped } = body.toggleSkipped as { id: string; skipped: boolean };
      const { error } = await getSupabase()
        .from('replenishment_items')
        .update({ skipped })
        .eq('id', itemId);
      if (error) throw error;
    }

    const { data: full } = await getSupabase()
      .from('replenishment_requests')
      .select('*, replenishment_items(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ data: fromRow(full) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
