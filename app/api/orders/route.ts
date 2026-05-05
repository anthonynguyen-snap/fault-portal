import { NextRequest, NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get('order') ?? '').trim();

  if (!raw) {
    return NextResponse.json({ error: 'order parameter is required' }, { status: 400 });
  }

  // Normalise: strip leading #, uppercase for consistent matching
  const orderNum = raw.replace(/^#/, '').trim();

  try {
    // Fetch all three sources in parallel
    const [allCases, refundRes, returnRes] = await Promise.all([
      getCases(),
      getSupabase()
        .from('refund_requests')
        .select('*')
        .ilike('order_number', `%${orderNum}%`)
        .order('created_at', { ascending: false }),
      getSupabase()
        .from('returns')
        .select('*, return_items(*)')
        .ilike('order_number', `%${orderNum}%`)
        .order('date', { ascending: false }),
    ]);

    // Filter cases locally (Google Sheets doesn't support server-side filtering)
    const cases = allCases.filter(c =>
      c.orderNumber.toLowerCase().includes(orderNum.toLowerCase())
    );

    const refunds = (refundRes.data ?? []).map((r: Record<string, unknown>) => ({
      id:          String(r.id ?? ''),
      orderNumber: String(r.order_number ?? ''),
      customerName: String(r.customer_name ?? ''),
      amount:      Number(r.amount ?? 0),
      reason:      String(r.reason ?? ''),
      status:      String(r.status ?? ''),
      resolution:  String(r.resolution ?? ''),
      createdAt:   String(r.created_at ?? ''),
      shopifyLink: String(r.shopify_link ?? ''),
      submittedBy: String(r.submitted_by ?? ''),
    }));

    const returns = (returnRes.data ?? []).map((r: Record<string, unknown>) => ({
      id:           String(r.id ?? ''),
      orderNumber:  String(r.order_number ?? ''),
      customerName: String(r.customer_name ?? ''),
      date:         String(r.date ?? ''),
      status:       String(r.status ?? ''),
      followUpStatus: String(r.follow_up_status ?? ''),
      totalRefundAmount: Number(r.total_refund_amount ?? 0),
      assignedTo:   String(r.assigned_to ?? ''),
    }));

    return NextResponse.json({
      orderNumber: orderNum,
      cases,
      refunds,
      returns,
      total: cases.length + refunds.length + returns.length,
    });
  } catch (err: any) {
    console.error('[GET /api/orders]', err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}
