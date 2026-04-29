import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RefundRequest, RefundResolution } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): RefundRequest {
  return {
    id:             String(row.id ?? ''),
    orderNumber:    String(row.order_number ?? ''),
    customerName:   String(row.customer_name ?? ''),
    amount:         Number(row.amount ?? 0),
    currency:       String(row.currency ?? 'AUD'),
    reason:         String(row.reason ?? ''),
    notes:          String(row.notes ?? ''),
    shopifyLink:    String(row.shopify_link ?? ''),
    commsLink:      String(row.comms_link ?? ''),
    submittedBy:    String(row.submitted_by ?? ''),
    status:         (row.status as RefundRequest['status']) ?? 'Pending',
    processedNotes: String(row.processed_notes ?? ''),
    resolution:     (row.resolution as RefundResolution) ?? 'Pending',
    createdAt:      String(row.created_at ?? ''),
    processedAt:    row.processed_at ? String(row.processed_at) : null,
  };
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as any).message);
  return String(e);
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('refund_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: errMsg(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderNumber, customerName, amount, currency, reason, notes, shopifyLink, commsLink, submittedBy } = body;
    if (!orderNumber?.trim()) return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
    if (!customerName?.trim()) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    if (!shopifyLink?.trim()) return NextResponse.json({ error: 'Shopify order link is required' }, { status: 400 });
    if (!commsLink?.trim()) return NextResponse.json({ error: 'Conversation link is required' }, { status: 400 });
    if (!submittedBy?.trim()) return NextResponse.json({ error: 'Submitted by is required' }, { status: 400 });

    const { data, error } = await getSupabase()
      .from('refund_requests')
      .insert({
        order_number:    orderNumber.trim(),
        customer_name:   customerName.trim(),
        amount:          Number(amount) || 0,
        currency:        currency ?? 'AUD',
        reason,
        notes:           notes?.trim() ?? '',
        shopify_link:    shopifyLink?.trim() ?? '',
        comms_link:      commsLink?.trim() ?? '',
        submitted_by:    submittedBy.trim(),
        status:          'Pending',
        processed_notes: '',
        resolution:      'Pending',
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errMsg(error) }, { status: 500 });
  }
}
