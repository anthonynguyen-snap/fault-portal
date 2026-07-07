import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchOpenShopifyOrders, isUnfulfilled, ShopifyOrder } from '@/lib/shopify';

export const runtime = 'nodejs';
export const maxDuration = 60;

function customerName(order: ShopifyOrder): string {
  const c = order.customer;
  if (!c) return '';
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
}

function customerEmail(order: ShopifyOrder): string {
  return order.customer?.email || order.email || '';
}

async function runSync() {
  const supabase = getSupabase();
  const allOpen = await fetchOpenShopifyOrders();
  const unfulfilled = allOpen.filter(isUnfulfilled);

  if (unfulfilled.length > 0) {
    const rows = unfulfilled.map(o => ({
      shopify_order_id: o.id,
      order_number: o.name,
      customer_name: customerName(o),
      customer_email: customerEmail(o),
      financial_status: o.financial_status || '',
      fulfillment_status: o.fulfillment_status || '',
      tags: o.tags || '',
      total_price: parseFloat(o.total_price) || 0,
      currency: o.currency || 'AUD',
      line_items: (o.line_items || []).map(li => ({
        title: li.title,
        sku: li.sku,
        quantity: li.quantity,
      })),
      order_created_at: o.created_at,
      shopify_updated_at: o.updated_at,
      synced_at: new Date().toISOString(),
      resolved_at: null,
    }));

    // Upsert — only touches Shopify-sourced columns, never the portal-owned
    // fields (action_status, assigned_to, notes, last_actioned_*).
    const { error: upsertErr } = await supabase
      .from('shopify_orders')
      .upsert(rows, { onConflict: 'shopify_order_id' });
    if (upsertErr) throw upsertErr;
  }

  // Anything previously cached as still-open that didn't come back in this
  // fetch is no longer open+unfulfilled in Shopify — mark it resolved so it
  // drops off the tab. (It may have shipped, been cancelled, or archived.)
  const stillOpenIds = unfulfilled.map(o => o.id);
  let staleQuery = supabase
    .from('shopify_orders')
    .update({ fulfillment_status: 'fulfilled', resolved_at: new Date().toISOString() })
    .is('resolved_at', null);

  staleQuery = stillOpenIds.length > 0
    ? staleQuery.not('shopify_order_id', 'in', `(${stillOpenIds.join(',')})`)
    : staleQuery;

  const { error: staleErr } = await staleQuery;
  if (staleErr) throw staleErr;

  return { fetched: allOpen.length, unfulfilled: unfulfilled.length };
}

async function handle(req: NextRequest) {
  // Vercel Cron sends requests with this header set; also accept a manual
  // trigger from the portal UI (guarded by the same portal session cookie
  // as everything else, since this route sits behind the app's auth).
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const isCron = req.headers.get('x-vercel-cron') != null;
  if (isCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json({ ok: true, ...result, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[shopify/sync]', err);
    return NextResponse.json({ ok: false, error: err.message ?? String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
