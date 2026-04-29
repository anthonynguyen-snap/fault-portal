import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { Return, ReturnItem } from '@/types';
import { logActivity } from '@/lib/activity';

export const runtime = 'nodejs';

function fromItemRow(row: Record<string, unknown>): ReturnItem {
  return {
    id:            String(row.id ?? ''),
    returnId:      String(row.return_id ?? ''),
    product:       String(row.product ?? ''),
    condition:     row.condition as ReturnItem['condition'],
    decision:      row.decision as ReturnItem['decision'],
    refundAmount:  Number(row.refund_amount ?? 0),
    restockingFee: Number(row.restocking_fee ?? 0),
  };
}

function fromRow(row: Record<string, unknown>): Return {
  const rawItems = Array.isArray(row.return_items) ? row.return_items as Record<string, unknown>[] : [];
  const items: ReturnItem[] = rawItems.length > 0
    ? rawItems.map(fromItemRow)
    : row.product
      ? [{
          id:            `legacy-${row.id}`,
          returnId:      String(row.id),
          product:       String(row.product ?? ''),
          condition:     (row.condition ?? 'Sealed') as ReturnItem['condition'],
          decision:      (row.decision ?? 'Pending') as ReturnItem['decision'],
          refundAmount:  Number(row.refund_amount ?? 0),
          restockingFee: Number(row.restocking_fee ?? 0),
        }]
      : [];

  return {
    id:                    String(row.id ?? ''),
    stage:                 (row.stage ?? 'processed') as Return['stage'],
    date:                  String(row.date ?? ''),
    orderNumber:           String(row.order_number ?? ''),
    customerName:          String(row.customer_name ?? ''),
    customerEmail:         String(row.customer_email ?? ''),
    trackingNumber:        String(row.tracking_number ?? ''),
    parcelReceived:        Boolean(row.parcel_received ?? false),
    linkedRequestId:       row.linked_request_id ? String(row.linked_request_id) : null,
    items,
    totalRefundAmount:     items.reduce((sum, item) => sum + item.refundAmount, 0),
    assignedTo:            String(row.assigned_to ?? ''),
    followUpStatus:        row.follow_up_status as Return['followUpStatus'],
    followUpNotes:         String(row.follow_up_notes ?? ''),
    notes:                 String(row.notes ?? ''),
    status:                row.status as Return['status'],
    processedBy:           String(row.processed_by ?? ''),
    conversationLink:      String(row.conversation_link ?? ''),
    starshipitOrderNumber: String(row.starshipit_order_number ?? ''),
    createdAt:             String(row.created_at ?? ''),
  };
}

function toSnake(updates: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    orderNumber:           'order_number',
    customerName:          'customer_name',
    customerEmail:         'customer_email',
    assignedTo:            'assigned_to',
    followUpStatus:        'follow_up_status',
    followUpNotes:         'follow_up_notes',
    processedBy:           'processed_by',
    conversationLink:      'conversation_link',
    trackingNumber:        'tracking_number',
    parcelReceived:        'parcel_received',
    linkedRequestId:       'linked_request_id',
    stage:                 'stage',
    starshipitOrderNumber: 'starshipit_order_number',
  };
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    result[map[k] ?? k] = v;
  }
  return result;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { data, error } = await getSupabase()
      .from('returns')
      .select('*, return_items(*)')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();

    // Separate items updates from header updates
    const { items, ...headerUpdates } = body;
    const snakeUpdates = toSnake(headerUpdates);

    // Update header fields
    const { data, error } = await getSupabase()
      .from('returns')
      .update(snakeUpdates)
      .eq('id', id)
      .select('*, return_items(*)')
      .single();

    if (error) throw error;

    // If items were passed, replace them
    if (items && Array.isArray(items)) {
      await getSupabase().from('return_items').delete().eq('return_id', id);
      if (items.length > 0) {
        await getSupabase().from('return_items').insert(
          items.map((item: Record<string, unknown>) => ({
            return_id:      id,
            product:        String(item.product ?? ''),
            condition:      item.condition,
            decision:       item.decision,
            refund_amount:  Number(item.refundAmount) || 0,
            restocking_fee: Number(item.restockingFee) || 0,
          }))
        );
      }
      // Re-fetch with updated items
      const { data: full } = await getSupabase()
        .from('returns')
        .select('*, return_items(*)')
        .eq('id', id)
        .single();
      void logActivity({
        actor:       String(full?.processed_by ?? ''),
        action:      'return.updated',
        entityType:  'Return',
        entityId:    id,
        entityLabel: String(full?.order_number ?? ''),
        detail:      { customerName: String(full?.customer_name ?? '') },
      });
      return NextResponse.json({ data: fromRow(full) });
    }

    void logActivity({
      actor:       String(data.processed_by ?? ''),
      action:      'return.updated',
      entityType:  'Return',
      entityId:    id,
      entityLabel: String(data.order_number ?? ''),
      detail:      { customerName: String(data.customer_name ?? '') },
    });
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
