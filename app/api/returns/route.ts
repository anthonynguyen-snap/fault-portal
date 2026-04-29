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
    id:               String(row.id ?? ''),
    date:             String(row.date ?? ''),
    orderNumber:      String(row.order_number ?? ''),
    customerName:     String(row.customer_name ?? ''),
    customerEmail:    String(row.customer_email ?? ''),
    items,
    totalRefundAmount: items.reduce((sum, item) => sum + item.refundAmount, 0),
    assignedTo:       String(row.assigned_to ?? ''),
    followUpStatus:   row.follow_up_status as Return['followUpStatus'],
    followUpNotes:    String(row.follow_up_notes ?? ''),
    notes:            String(row.notes ?? ''),
    status:           row.status as Return['status'],
    processedBy:      String(row.processed_by ?? ''),
    conversationLink: String(row.conversation_link ?? ''),
    createdAt:        String(row.created_at ?? ''),
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('returns')
      .select('*, return_items(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
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
      items, assignedTo, needsFollowUp, notes,
      processedBy, date, conversationLink,
    } = body;

    if (!orderNumber || !customerName || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert return header (legacy item fields left empty for new returns)
    const { data: ret, error: retErr } = await getSupabase()
      .from('returns')
      .insert({
        date:             date || new Date().toISOString().slice(0, 10),
        order_number:     orderNumber,
        customer_name:    customerName,
        customer_email:   customerEmail || '',
        product:          '',
        condition:        'Sealed',
        decision:         'Pending',
        restocking_fee:   0,
        refund_amount:    0,
        assigned_to:      assignedTo || '',
        follow_up_status: needsFollowUp ? 'Pending' : 'N/A',
        follow_up_notes:  '',
        notes:            notes || '',
        status:           'Processed',
        processed_by:     processedBy || '',
        conversation_link: conversationLink || '',
      })
      .select()
      .single();

    if (retErr) throw retErr;

    // Insert line items
    const itemRows = items.map((item: Record<string, unknown>) => ({
      return_id:     ret.id,
      product:       String(item.product ?? ''),
      condition:     item.condition,
      decision:      item.decision,
      refund_amount: Number(item.refundAmount) || 0,
      restocking_fee: Number(item.restockingFee) || 0,
    }));

    const { error: itemErr } = await getSupabase().from('return_items').insert(itemRows);
    if (itemErr) throw itemErr;

    // Fetch back with items
    const { data: full } = await getSupabase()
      .from('returns')
      .select('*, return_items(*)')
      .eq('id', ret.id)
      .single();

    void logActivity({
      actor:       processedBy ?? '',
      action:      'return.logged',
      entityType:  'Return',
      entityId:    ret.id,
      entityLabel: orderNumber,
      detail:      { customerName, itemCount: items?.length ?? 0 },
    });
    return NextResponse.json({ data: fromRow(full) }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
