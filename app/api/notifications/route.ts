import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export interface PortalNotification {
  id: string;
  type: 'refund' | 'return' | 'promo';
  severity: 'red' | 'amber' | 'info';
  title: string;
  subtitle: string;
  href: string;
}

export async function GET() {
  const notifications: PortalNotification[] = [];

  try {
    // ── Pending refunds ──────────────────────────────────────────────────────
    const { data: refunds } = await getSupabase()
      .from('refund_requests')
      .select('id, order_number, customer_name, amount, created_at')
      .eq('status', 'Pending')
      .order('created_at', { ascending: true });

    const pendingRefunds = refunds ?? [];
    if (pendingRefunds.length > 0) {
      // Flag any refund pending > 48 hours as red
      const now = Date.now();
      const oldRefunds = pendingRefunds.filter(r => {
        const age = now - new Date(r.created_at).getTime();
        return age > 48 * 60 * 60 * 1000;
      });

      if (oldRefunds.length > 0) {
        notifications.push({
          id: 'refunds-overdue',
          type: 'refund',
          severity: 'red',
          title: `${oldRefunds.length} overdue refund${oldRefunds.length > 1 ? 's' : ''}`,
          subtitle: `Pending more than 48 hours — needs action`,
          href: '/refunds',
        });
      } else {
        notifications.push({
          id: 'refunds-pending',
          type: 'refund',
          severity: 'amber',
          title: `${pendingRefunds.length} pending refund${pendingRefunds.length > 1 ? 's' : ''}`,
          subtitle: 'Awaiting review and approval',
          href: '/refunds',
        });
      }
    }
  } catch { /* skip */ }

  try {
    // ── Returns needing follow-up ────────────────────────────────────────────
    const { data: returns } = await getSupabase()
      .from('returns')
      .select('id, date, order_number, customer_name')
      .eq('follow_up_status', 'Pending')
      .order('date', { ascending: true });

    const pendingReturns = returns ?? [];
    if (pendingReturns.length > 0) {
      const daysSince = (dateStr: string) =>
        Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000);

      const ages = pendingReturns.map(r => daysSince(r.date));
      const maxAge = Math.max(...ages);
      const oldCount = ages.filter(a => a >= 3).length;

      notifications.push({
        id: 'returns-followup',
        type: 'return',
        severity: maxAge >= 7 ? 'red' : 'amber',
        title: `${pendingReturns.length} return${pendingReturns.length > 1 ? 's' : ''} need follow-up`,
        subtitle: oldCount > 0
          ? `${oldCount} pending ${oldCount === 1 ? 'return' : 'returns'} over 3 days old`
          : 'Follow-ups awaiting action',
        href: '/returns',
      });
    }
  } catch { /* skip */ }

  try {
    // ── Promotions expiring within 7 days ────────────────────────────────────
    const { data: promos } = await getSupabase()
      .from('promotions')
      .select('id, name, end_date, platform')
      .not('end_date', 'is', null)
      .eq('enabled', true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiring = (promos ?? []).filter(p => {
      if (!p.end_date) return false;
      const end = new Date(p.end_date + 'T00:00:00');
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
      return daysLeft >= 0 && daysLeft <= 7;
    });

    if (expiring.length > 0) {
      const soonest = expiring.reduce((a, b) => {
        const dA = new Date(a.end_date + 'T00:00:00').getTime();
        const dB = new Date(b.end_date + 'T00:00:00').getTime();
        return dA < dB ? a : b;
      });
      const daysLeft = Math.ceil(
        (new Date(soonest.end_date + 'T00:00:00').getTime() - today.getTime()) / 86_400_000
      );

      notifications.push({
        id: 'promos-expiring',
        type: 'promo',
        severity: daysLeft <= 2 ? 'red' : 'amber',
        title: `${expiring.length} promo${expiring.length > 1 ? 's' : ''} expiring soon`,
        subtitle: daysLeft === 0
          ? `${soonest.name} expires today`
          : `${soonest.name} expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        href: '/promotions',
      });
    }
  } catch { /* skip */ }

  // Sort: red first, then amber, then info
  const order = { red: 0, amber: 1, info: 2 };
  notifications.sort((a, b) => order[a.severity] - order[b.severity]);

  return NextResponse.json({ notifications, total: notifications.length });
}
