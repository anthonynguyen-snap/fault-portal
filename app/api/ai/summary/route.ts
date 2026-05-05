import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCases } from '@/lib/google-sheets';
import { getSupabase } from '@/lib/supabase';
import { isThisWeek, isThisMonth } from '@/lib/utils';

export const runtime = 'nodejs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json() as { type: 'briefing' | 'trends' | 'monthly' | 'digest' };

    // ── Fetch all data in parallel ──────────────────────────────────────────
    const [cases, refundsRes, returnsRes, stockRes] = await Promise.all([
      getCases(),
      getSupabase().from('refund_requests').select('*').order('created_at', { ascending: false }),
      getSupabase().from('returns').select('*').order('date', { ascending: false }).limit(50),
      getSupabase().from('stock_items').select('*').order('name'),
    ]);

    const refunds = refundsRes.data ?? [];
    const returns = returnsRes.data ?? [];
    const stockItems = stockRes.data ?? [];

    // ── Derived data ────────────────────────────────────────────────────────
    const today = new Date();

    // Faults
    const faultsThisWeek  = cases.filter(c => isThisWeek(c.date));
    const faultsThisMonth = cases.filter(c => isThisMonth(c.date));
    const recentCases     = cases.slice(0, 10);

    // Fault breakdown by product this week
    const productCounts: Record<string, number> = {};
    for (const c of faultsThisWeek) {
      productCounts[c.product] = (productCounts[c.product] ?? 0) + 1;
    }

    // Fault type breakdown
    const typeCounts: Record<string, number> = {};
    for (const c of cases) {
      typeCounts[c.faultType] = (typeCounts[c.faultType] ?? 0) + 1;
    }

    // Monthly fault trend (last 6 months)
    const monthlyTrend: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toLocaleString('en-AU', { month: 'short', year: 'numeric' });
      monthlyTrend[key] = cases.filter(c => {
        try {
          const cd = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
          return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
        } catch { return false; }
      }).length;
    }

    // Refunds
    const pendingRefunds = refunds.filter((r: any) => r.status === 'Pending');
    const pendingRefundTotal = pendingRefunds.reduce((s: number, r: any) => s + Number(r.amount), 0);
    const oldestRefund = pendingRefunds.length > 0
      ? Math.max(...pendingRefunds.map((r: any) => Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)))
      : 0;

    // Returns
    const pendingFollowUps = returns.filter((r: any) => r.follow_up_status === 'Pending');
    const oldestFollowUp = pendingFollowUps.length > 0
      ? Math.max(...pendingFollowUps.map((r: any) => {
          const d = new Date(r.date.includes('T') ? r.date : r.date + 'T00:00:00');
          return Math.floor((Date.now() - d.getTime()) / 86400000);
        }))
      : 0;

    // Stock
    const lowStock  = stockItems.filter((i: any) => !i.discontinued && i.quantity > 0 && i.quantity <= i.low_stock_threshold);
    const outStock  = stockItems.filter((i: any) => !i.discontinued && i.quantity === 0);

    // ── Build prompt per mode ───────────────────────────────────────────────
    const dateStr = today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let prompt = '';

    if (type === 'briefing') {
      prompt = `You are a concise operations assistant for SNAP Customer Care, an Australian consumer electronics support team.

Today is ${dateStr}. Here is the current state of the portal:

FAULT CASES:
- This week: ${faultsThisWeek.length} cases (cost at risk: $${faultsThisWeek.reduce((s, c) => s + c.unitCostUSD, 0).toFixed(2)} USD)
- This month: ${faultsThisMonth.length} cases
- Total all time: ${cases.length} cases
- Top fault types this week: ${Object.entries(productCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([p,n]) => `${p} (${n})`).join(', ') || 'none'}

REFUND REQUESTS:
- Pending: ${pendingRefunds.length} requests totalling $${pendingRefundTotal.toFixed(2)} AUD
- Oldest pending: ${oldestRefund} day(s) ago
${pendingRefunds.slice(0,5).map((r: any) => `  • ${r.customer_name} – $${Number(r.amount).toFixed(2)} – ${r.reason}`).join('\n')}

RETURNS FOLLOW-UPS:
- Pending follow-ups: ${pendingFollowUps.length}
- Oldest: ${oldestFollowUp} day(s) ago
${pendingFollowUps.slice(0,3).map((r: any) => `  • Order #${r.order_number} – ${r.assigned_to || 'unassigned'}`).join('\n')}

OFFICE STOCK ALERTS (note: this is in-house office stock only — demo/replacement units kept on hand. It does NOT reflect 3PL fulfilment inventory, so out-of-stock here does not mean customer orders can't be fulfilled):
- Out of stock (${outStock.length}): ${outStock.map((i: any) => i.name).slice(0, 5).join(', ') || 'none'}${outStock.length > 5 ? ` and ${outStock.length - 5} more` : ''}
- Low stock (${lowStock.length}): ${lowStock.map((i: any) => `${i.name} (${i.quantity} left)`).join(', ') || 'none'}

Write a concise daily briefing in plain English. Use short paragraphs, no bullet points, no headers. Be direct and action-oriented — highlight what needs attention today. Do NOT raise alarms about office stock levels being unable to fulfil customer orders — that stock is separate. Keep it under 150 words.`;

    } else if (type === 'trends') {
      const topFaultTypes = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
      const productAllTime: Record<string, number> = {};
      for (const c of cases) {
        productAllTime[c.product] = (productAllTime[c.product] ?? 0) + 1;
      }
      const topProducts = Object.entries(productAllTime).sort((a,b) => b[1]-a[1]).slice(0,5);

      prompt = `You are a data analyst for SNAP Customer Care, an Australian consumer electronics support team.

Today is ${dateStr}. Analyse the following fault data and identify meaningful patterns, spikes, or concerns:

MONTHLY FAULT TREND (last 6 months):
${Object.entries(monthlyTrend).map(([m, n]) => `  ${m}: ${n} cases`).join('\n')}

TOP FAULT TYPES (all time):
${topFaultTypes.map(([t, n]) => `  ${t}: ${n} cases`).join('\n')}

TOP PRODUCTS BY FAULT COUNT (all time):
${topProducts.map(([p, n]) => `  ${p}: ${n} cases`).join('\n')}

THIS WEEK vs THIS MONTH:
- This week: ${faultsThisWeek.length} faults
- This month: ${faultsThisMonth.length} faults

RECENT CASES (last 10):
${recentCases.map(c => `  ${c.date} – ${c.product} – ${c.faultType}`).join('\n')}

Write a trend analysis in plain English. Identify any spikes, recurring issues, or products/fault types that deserve attention. Note any patterns that might be worth raising with manufacturers. Use short paragraphs, no bullet points. Keep it under 200 words.`;

    } else if (type === 'monthly') {
      // Build per-month breakdown for the last 12 months
      const monthlyBreakdown: { month: string; total: number; byProduct: Record<string, number>; byType: Record<string, number> }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const label = d.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
        const monthCases = cases.filter(c => {
          try {
            const cd = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
            return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
          } catch { return false; }
        });
        const byProduct: Record<string, number> = {};
        const byType: Record<string, number> = {};
        for (const c of monthCases) {
          byProduct[c.product] = (byProduct[c.product] ?? 0) + 1;
          byType[c.faultType]  = (byType[c.faultType]  ?? 0) + 1;
        }
        monthlyBreakdown.push({ month: label, total: monthCases.length, byProduct, byType });
      }

      prompt = `You are a monthly trends analyst for SNAP Customer Care, an Australian consumer electronics support team.

Today is ${dateStr}. Analyse the following month-by-month fault data over the last 12 months and identify meaningful trends, seasonal patterns, improving or worsening product lines, and any months that stand out:

MONTHLY FAULT COUNTS (last 12 months):
${monthlyBreakdown.map(m => {
  const topProducts = Object.entries(m.byProduct).sort((a,b) => b[1]-a[1]).slice(0,3).map(([p,n]) => `${p}:${n}`).join(', ');
  const topTypes    = Object.entries(m.byType).sort((a,b) => b[1]-a[1]).slice(0,2).map(([t,n]) => `${t}:${n}`).join(', ');
  return `  ${m.month}: ${m.total} faults${m.total > 0 ? ` | Top products: ${topProducts || 'n/a'} | Top types: ${topTypes || 'n/a'}` : ''}`;
}).join('\n')}

OVERALL TOTALS (all time):
- Total cases: ${cases.length}
- Top 5 products: ${Object.entries((() => { const p: Record<string,number> = {}; for (const c of cases) p[c.product] = (p[c.product]??0)+1; return p; })()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([p,n])=>`${p} (${n})`).join(', ')}
- Top 5 fault types: ${Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>`${t} (${n})`).join(', ')}

Write a monthly trend analysis in plain English. Identify which months had spikes, which products are trending up or down, and any fault types that are becoming more common. Note anything worth raising with manufacturers or the supply chain. Use short paragraphs, no bullet points, no headers. Keep it under 250 words.`;

    } else {
      // digest
      prompt = `You are a weekly operations summariser for SNAP Customer Care, an Australian consumer electronics support team.

Today is ${dateStr}. Generate a weekly digest covering all areas of the business:

FAULTS THIS WEEK: ${faultsThisWeek.length} cases (vs ${cases.filter(c => {
  try {
    const d = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 14);
    const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);
    return d <= weekAgo;
  } catch { return false; }
}).slice(0, faultsThisWeek.length).length} last week)
FAULT COST THIS WEEK: $${faultsThisWeek.reduce((s, c) => s + c.unitCostUSD, 0).toFixed(2)} USD

REFUNDS: ${pendingRefunds.length} pending ($${pendingRefundTotal.toFixed(2)} AUD), ${refunds.filter((r: any) => r.status === 'Processed').length} processed total

RETURNS: ${returns.length} total returns this period, ${pendingFollowUps.length} follow-ups still pending

OFFICE STOCK (in-house only, not 3PL fulfilment): ${outStock.length} items out of stock, ${lowStock.length} items low
${[...outStock, ...lowStock].slice(0,5).map((i: any) => `  • ${i.name}: ${i.quantity} units`).join('\n')}

TOP FAULT TYPES THIS WEEK:
${Object.entries(productCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([p,n]) => `  ${p}: ${n}`).join('\n') || '  No faults this week'}

Write a professional but conversational weekly digest suitable for a quick team review. Cover what happened, what's outstanding, and any notable patterns. Note that office stock is separate from 3PL fulfilment stock — do not suggest out-of-stock office items affect the ability to fulfil customer orders. Use short paragraphs, no bullet points, no headers. Keep it under 200 words.`;
    }

    // ── Call Claude ─────────────────────────────────────────────────────────
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ summary: text });

  } catch (error) {
    console.error('AI summary error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
