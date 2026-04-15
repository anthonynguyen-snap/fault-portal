import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Return } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): Return {
  return {
    id:              String(row.id ?? ''),
    date:            String(row.date ?? ''),
    orderNumber:     String(row.order_number ?? ''),
    customerName:    String(row.customer_name ?? ''),
    customerEmail:   String(row.customer_email ?? ''),
    product:         String(row.product ?? ''),
    condition:       row.condition as Return['condition'],
    decision:        row.decision as Return['decision'],
    restockingFee:   Number(row.restocking_fee ?? 0),
    assignedTo:      String(row.assigned_to ?? ''),
    followUpStatus:  row.follow_up_status as Return['followUpStatus'],
    followUpNotes:   String(row.follow_up_notes ?? ''),
    notes:           String(row.notes ?? ''),
    status:          row.status as Return['status'],
    processedBy:     String(row.processed_by ?? ''),
    createdAt:       String(row.created_at ?? ''),
  };
}

// camelCase patch → snake_case for Supabase
function toSnake(updates: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    orderNumber:    'order_number',
    customerName:   'customer_name',
    customerEmail:  'customer_email',
    restockingFee:  'restocking_fee',
    assignedTo:     'assigned_to',
    followUpStatus: 'follow_up_status',
    followUpNotes:  'follow_up_notes',
    processedBy:    'processed_by',
  };
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    result[map[k] ?? k] = v;
  }
  return result;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const snakeUpdates = toSnake(body);

    const { data, error } = await supabase
      .from('returns')
      .update(snakeUpdates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
