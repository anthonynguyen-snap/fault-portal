import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { Return, ReturnItem } from '@/types';
import { logActivity } from '@/lib/activity';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

type ReturnWriteResult = { returnId: string; closedRefundIds?: string[] };

async function logClosedRefunds(ids: string[], orderNumber: string, actor: string) {
  await Promise.all(ids.map(id => logActivity({
    actor: actor || 'system',
    action: 'refund.processed',
    entityType: 'Refund',
    entityId: id,
    entityLabel: orderNumber,
    detail: { note: 'Auto-closed when return was processed' },
  })));
}

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

  // If no items in return_items, synthesise one from legacy columns (backwards compat)
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
    internalNotes:         Array.isArray(row.internal_notes) ? row.internal_notes : [],
    status:                row.status as Return['status'],
    processedBy:           String(row.processed_by ?? ''),
    conversationLink:      String(row.conversation_link ?? ''),
    starshipitOrderNumber: String(row.starshipit_order_number ?? ''),
    createdAt:             String(row.created_at ?? ''),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage    = searchParams.get('stage');
    const search   = searchParams.get('search')?.toLowerCase();
    const from     = searchParams.get('from');
    const to       = searchParams.get('to');
    const limitParam = searchParams.get('limit');
    const limit    = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam, 10))) : 0;
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const paginate = limit > 0;

    // Build count query (no range)
    let countQ = getSupabase()
      .from('returns')
      .select('id', { count: 'exact', head: true });
    if (stage)  countQ = countQ.eq('stage', stage);
    if (from)   countQ = countQ.gte('date', from);
    if (to)     countQ = countQ.lte('date', to);
    // Note: search filter is applied post-fetch (Supabase doesn't support full-text on all fields easily)

    // Build data query
    let dataQ = getSupabase()
      .from('returns')
      .select('*, return_items(*)')
      .order('created_at', { ascending: false });
    if (stage)  dataQ = dataQ.eq('stage', stage);
    if (from)   dataQ = dataQ.gte('date', from);
    if (to)     dataQ = dataQ.lte('date', to);

    if (paginate && !search) {
      // True server-side pagination (only when no search — search requires full load)
      const offset = (page - 1) * limit;
      dataQ = dataQ.range(offset, offset + limit - 1);
    }

    const [{ count }, { data, error }] = await Promise.all([
      countQ,
      dataQ,
    ]);

    if (error) throw error;

    let rows = (data ?? []).map(fromRow);

    // Client-side search filter (applied after fetch)
    if (search) {
      rows = rows.filter(r =>
        r.orderNumber.toLowerCase().includes(search)   ||
        r.customerName.toLowerCase().includes(search)  ||
        r.customerEmail.toLowerCase().includes(search) ||
        (r.items ?? []).some(i => i.product.toLowerCase().includes(search))
      );
    }

    if (paginate) {
      // If search was applied, we need to paginate the in-memory result
      const total = search ? rows.length : (count ?? rows.length);
      const pages = Math.ceil(total / limit);
      if (search) rows = rows.slice((page - 1) * limit, page * limit);
      return NextResponse.json({ data: rows, total, page, pages, limit });
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      orderNumber, customerName, customerEmail,
      items, assignedTo, needsFollowUp, followUpNotes, notes,
      processedBy, date, conversationLink,
      stage, trackingNumber, linkedRequestId,
      starshipitOrderNumber,
    } = body;
    const session = await verifySession();
    const loggedBy = String(session?.name || processedBy || '');

    if (!orderNumber || !customerName || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build restocking reasons note
    const restockingNotes = items
      .filter((item: Record<string, unknown>) => item.decision === 'Refund + Restocking Fee' && item.restockingReason)
      .map((item: Record<string, unknown>) => `Restocking fee reason (${item.product}): ${item.restockingReason}`)
      .join('\n');

    const shouldCloseRefunds = (stage || 'processed') === 'processed';
    const { data: writeResult, error: writeError } = await getSupabase().rpc('create_return_with_items', {
      p_return: {
        stage: stage || 'processed',
        date: date || new Date().toISOString().slice(0, 10),
        orderNumber,
        customerName,
        customerEmail: customerEmail || '',
        trackingNumber: trackingNumber || '',
        parcelReceived: false,
        linkedRequestId: linkedRequestId || null,
        starshipitOrderNumber: starshipitOrderNumber || '',
        assignedTo: assignedTo || '',
        followUpStatus: needsFollowUp ? 'Pending' : 'N/A',
        followUpNotes: followUpNotes || '',
        notes: [notes || '', restockingNotes].filter(Boolean).join('\n\n'),
        status: stage === 'requested' ? 'Received' : (needsFollowUp ? 'Processed' : 'Closed'),
        processedBy: loggedBy,
        conversationLink: conversationLink || '',
      },
      p_items: items,
      p_close_refunds: shouldCloseRefunds,
    });
    if (writeError) throw writeError;
    const result = writeResult as ReturnWriteResult;
    if (!result?.returnId) throw new Error('Return transaction did not return an ID');

    // Fetch back with items
    const { data: full, error: reloadError } = await getSupabase()
      .from('returns')
      .select('*, return_items(*)')
      .eq('id', result.returnId)
      .single();
    if (reloadError || !full) throw reloadError ?? new Error('Return was saved but could not be reloaded');

    await logActivity({
      actor:       loggedBy,
      action:      'return.logged',
      entityType:  'Return',
      entityId:    result.returnId,
      entityLabel: orderNumber,
      detail:      { customerName, itemCount: items?.length ?? 0 },
    });
    await logClosedRefunds(result.closedRefundIds ?? [], orderNumber, loggedBy);

    return NextResponse.json({ data: fromRow(full) }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
