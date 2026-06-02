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

  // Normalise: strip leading #
  const orderNum = raw.replace(/^#/, '').trim();
  const q = orderNum.toLowerCase();

  try {
    // Fetch all three sources in parallel — search both order number and customer name
    const [allCases, refundRes, returnRes] = await Promise.all([
      getCases(),
      getSupabase()
        .from('refund_requests')
        .select('*')
        .or(`order_number.ilike.%${orderNum}%,customer_name.ilike.%${orderNum}%`)
        .order('created_at', { ascending: false }),
      getSupabase()
        .from('returns')
        .select('*, return_items(*)')
        .or(`order_number.ilike.%${orderNum}%,customer_name.ilike.%${orderNum}%`)
        .order('date', { ascending: false }),
    ]);

    // Filter cases locally (Google Sheets doesn't support server-side filtering)
    const cases = allCases.filter(c =>
      c.orderNumber.toLowerCase().includes(q) ||
      c.customerName.toLowerCase().includes(q)
    );

    const refunds = (refundRes.data ?? []).map((r: Record<string, unknown>) => ({
      id:          String(r.id ?? ''),
      orderNumber: String(r.order_number ?? ''),
      customerName: String(r.customer_name ?? ''),
      customerEmail: String(r.customer_email ?? ''),
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
      customerEmail: String(r.customer_email ?? ''),
      date:         String(r.date ?? ''),
      status:       String(r.status ?? ''),
      followUpStatus: String(r.follow_up_status ?? ''),
      totalRefundAmount: Number(r.total_refund_amount ?? 0),
      assignedTo:   String(r.assigned_to ?? ''),
    }));

    // Build candidate list when name search matches multiple distinct customers
    // Key by email (if available) otherwise by name+firstOrder
    const candidateMap = new Map<string, { name: string; email: string; orderNumbers: string[]; recordCount: number }>();
    const allRecords = [
      ...returns.map(r => ({ name: r.customerName, email: r.customerEmail, order: r.orderNumber })),
      ...refunds.map(r => ({ name: r.customerName, email: r.customerEmail, order: r.orderNumber })),
      ...cases.map(c => ({ name: c.customerName, email: '', order: c.orderNumber })),
    ];
    for (const rec of allRecords) {
      const key = rec.email?.trim() || `${rec.name}::${rec.order}`;
      if (!key) continue;
      const existing = candidateMap.get(key);
      if (existing) {
        if (!existing.orderNumbers.includes(rec.order)) existing.orderNumbers.push(rec.order);
        existing.recordCount++;
      } else {
        candidateMap.set(key, { name: rec.name, email: rec.email || '', orderNumbers: [rec.order], recordCount: 1 });
      }
    }

    const candidates = Array.from(candidateMap.values());
    const isNameSearch = /\s/.test(q) || !/^\d/.test(q); // has space or doesn't start with digit
    const hasMultiple = isNameSearch && candidates.length > 1;

    if (hasMultiple) {
      return NextResponse.json({ candidates });
    }

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
