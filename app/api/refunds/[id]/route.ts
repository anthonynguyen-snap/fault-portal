import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { logActivity } from '@/lib/activity';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.status         !== undefined) updates.status          = body.status;
    if (body.processedNotes !== undefined) updates.processed_notes = body.processedNotes;
    if (body.resolution     !== undefined) updates.resolution      = body.resolution;
    if (body.orderNumber    !== undefined) updates.order_number    = body.orderNumber;
    if (body.customerName   !== undefined) updates.customer_name   = body.customerName;
    if (body.amount         !== undefined) updates.amount          = body.amount;
    if (body.currency       !== undefined) updates.currency        = body.currency;
    if (body.reason         !== undefined) updates.reason          = body.reason;
    if (body.notes          !== undefined) updates.notes           = body.notes;
    if (body.shopifyLink    !== undefined) updates.shopify_link    = body.shopifyLink;
    if (body.commsLink      !== undefined) updates.comms_link      = body.commsLink;
    if (body.submittedBy    !== undefined) updates.submitted_by    = body.submittedBy;
    if (body.status === 'Processed' || body.status === 'Rejected') {
      updates.processed_at = new Date().toISOString();
    }

    const { data, error } = await getSupabase()
      .from('refund_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Determine log action from what changed
    const logAction = body.status === 'Processed' ? 'refund.processed'
                    : body.status === 'Rejected'  ? 'refund.rejected'
                    : 'refund.updated';
    void logActivity({
      actor:       String(data.submitted_by ?? ''),
      action:      logAction,
      entityType:  'Refund',
      entityId:    id,
      entityLabel: String(data.order_number ?? ''),
      detail:      { amount: data.amount, currency: data.currency ?? 'AUD', status: data.status },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : (error as any)?.message ?? String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabase()
      .from('refund_requests')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : (error as any)?.message ?? String(error) }, { status: 500 });
  }
}
