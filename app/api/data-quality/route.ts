import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { hasAdminAccess, verifySession } from '@/lib/auth';

export const runtime = 'nodejs';

type DataQualityIssue = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: 'red' | 'amber' | 'blue';
  detail: string;
};

function isBlank(value: unknown) {
  return String(value ?? '').trim() === '';
}

export async function GET() {
  const session = await verifySession();
  if (!session || !hasAdminAccess(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date();
    soon.setDate(soon.getDate() + 14);
    const soonDate = soon.toISOString().slice(0, 10);

    const [
      returnsRes,
      refundsRes,
      shipmentsRes,
      restockRes,
      promotionsRes,
    ] = await Promise.all([
      getSupabase().from('returns').select('id, order_number, tracking_number, processed_by, stage, starshipit_order_number').limit(500),
      getSupabase().from('refund_requests').select('id, order_number, status, submitted_by, processed_at').limit(500),
      getSupabase().from('shipments').select('id, shipment_number, status, eta, tracking_number').limit(500),
      getSupabase().from('restock_items').select('id, product_name, status, expected_restock_date, resolved').eq('resolved', false).limit(500),
      getSupabase().from('promotions').select('id, name, end_date, enabled').eq('enabled', true).limit(500),
    ]);

    const error = returnsRes.error || refundsRes.error || shipmentsRes.error || restockRes.error || promotionsRes.error;
    if (error) throw error;

    const returns = returnsRes.data ?? [];
    const refunds = refundsRes.data ?? [];
    const shipments = shipmentsRes.data ?? [];
    const restock = restockRes.data ?? [];
    const promotions = promotionsRes.data ?? [];

    const missingReturnLogger = returns.filter((row) => isBlank(row.processed_by)).length;
    const missingReturnTracking = returns.filter((row) =>
      row.stage === 'requested' && isBlank(row.tracking_number) && isBlank(row.starshipit_order_number)
    ).length;
    const pendingRefunds = refunds.filter((row) => row.status === 'Pending').length;
    const shipmentsMissingEta = shipments.filter((row) =>
      row.status !== 'Delivered' && isBlank(row.eta)
    ).length;
    const shipmentsMissingTracking = shipments.filter((row) =>
      row.status !== 'Delivered' && isBlank(row.tracking_number)
    ).length;
    const restockMissingDate = restock.filter((row) =>
      ['On Order', 'Backordered'].includes(String(row.status)) && isBlank(row.expected_restock_date)
    ).length;
    const promosEndingSoon = promotions.filter((row) => {
      if (isBlank(row.end_date)) return false;
      const endDate = String(row.end_date);
      return endDate >= today && endDate <= soonDate;
    }).length;
    const promosNoEndDate = promotions.filter((row) => isBlank(row.end_date)).length;

    const issues: DataQualityIssue[] = [
      {
        id: 'returns-missing-logger',
        label: 'Returns missing logged by',
        count: missingReturnLogger,
        href: '/returns',
        tone: missingReturnLogger > 0 ? 'amber' : 'blue',
        detail: 'Useful for checking who entered each return.',
      },
      {
        id: 'returns-missing-tracking',
        label: 'Return requests missing tracking',
        count: missingReturnTracking,
        href: '/returns',
        tone: missingReturnTracking > 0 ? 'amber' : 'blue',
        detail: 'Awaiting-customer returns without inbound or Starshipit tracking.',
      },
      {
        id: 'refunds-pending',
        label: 'Pending refunds',
        count: pendingRefunds,
        href: '/refunds',
        tone: pendingRefunds > 0 ? 'amber' : 'blue',
        detail: 'Refund requests still waiting to be closed.',
      },
      {
        id: 'shipments-missing-eta',
        label: 'Shipments missing ETA',
        count: shipmentsMissingEta,
        href: '/shipments',
        tone: shipmentsMissingEta > 0 ? 'amber' : 'blue',
        detail: 'Open incoming shipments without an expected arrival date.',
      },
      {
        id: 'shipments-missing-tracking',
        label: 'Shipments missing tracking',
        count: shipmentsMissingTracking,
        href: '/shipments',
        tone: shipmentsMissingTracking > 0 ? 'red' : 'blue',
        detail: 'Open incoming shipments without tracking details.',
      },
      {
        id: 'restock-missing-date',
        label: 'Restock items missing ETA',
        count: restockMissingDate,
        href: '/stock/restock',
        tone: restockMissingDate > 0 ? 'amber' : 'blue',
        detail: 'Backordered or on-order items without an expected restock date.',
      },
      {
        id: 'promos-ending-soon',
        label: 'Promos ending soon',
        count: promosEndingSoon,
        href: '/promotions',
        tone: promosEndingSoon > 0 ? 'amber' : 'blue',
        detail: 'Enabled promotions ending in the next 14 days.',
      },
      {
        id: 'promos-without-end',
        label: 'Promos without end date',
        count: promosNoEndDate,
        href: '/promotions',
        tone: promosNoEndDate > 0 ? 'amber' : 'blue',
        detail: 'Active promotions that will stay on until manually ended.',
      },
    ];

    return NextResponse.json({
      data: issues,
      summary: {
        total: issues.reduce((sum, issue) => sum + issue.count, 0),
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
