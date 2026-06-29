import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { Return, ReturnItem } from '@/types';
import { logActivity } from '@/lib/activity';
import { verifySession } from '@/lib/auth';

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

type ReturnWriteResult = { returnId: string; closedRefundIds?: string[] };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();

    // Separate items updates from header updates
    const { items, ...headerUpdates } = body;
    if (
      Object.prototype.hasOwnProperty.call(headerUpdates, 'processedBy') &&
      !String(headerUpdates.processedBy ?? '').trim()
    ) {
      const session = await verifySession();
      if (session?.name) headerUpdates.processedBy = session.name;
    }
    const shouldCloseRefunds = headerUpdates.status === 'Processed';
    const { data: writeResult, error: writeError } = await getSupabase().rpc('update_return_with_items', {
      p_return_id: id,
      p_header: headerUpdates,
      p_items: Array.isArray(items) ? items : null,
      p_replace_items: Array.isArray(items),
      p_close_refunds: shouldCloseRefunds,
    });
    if (writeError) throw writeError;
    const result = writeResult as ReturnWriteResult;

    const { data: full, error: reloadError } = await getSupabase()
      .from('returns')
      .select('*, return_items(*)')
      .eq('id', id)
      .single();
    if (reloadError || !full) throw reloadError ?? new Error('Return could not be reloaded');

    await logActivity({
      actor:       String(full.processed_by ?? ''),
      action:      'return.updated',
      entityType:  'Return',
      entityId:    id,
      entityLabel: String(full.order_number ?? ''),
      detail:      { customerName: String(full.customer_name ?? '') },
    });
    await Promise.all((result?.closedRefundIds ?? []).map(refundId => logActivity({
      actor: String(full.processed_by ?? '') || 'system',
      action: 'refund.processed',
      entityType: 'Refund',
      entityId: refundId,
      entityLabel: String(full.order_number ?? ''),
      detail: { note: 'Auto-closed when return was processed' },
    })));
    return NextResponse.json({ data: fromRow(full) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
