import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Return } from '@/types';

export const runtime = 'nodejs';

// Supabase row → camelCase Return
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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('returns')
      .select('*')
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
      orderNumber, customerName, customerEmail, product,
      condition, decision, restockingFee, assignedTo,
      notes, processedBy, date,
    } = body;

    if (!orderNumber || !customerName || !product || !condition || !decision) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const row = {
      date:             date || new Date().toISOString().slice(0, 10),
      order_number:     orderNumber,
      customer_name:    customerName,
      customer_email:   customerEmail || '',
      product,
      condition,
      decision,
      restocking_fee:   Number(restockingFee) || 0,
      assigned_to:      assignedTo || '',
      follow_up_status: assignedTo ? 'Pending' : 'N/A',
      follow_up_notes:  '',
      notes:            notes || '',
      status:           'Received',
      processed_by:     processedBy || '',
    };

    const { data, error } = await supabase
      .from('returns')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
