// =========================================================
// SHOPIFY ADMIN API CLIENT
// =========================================================
// Direct server-side integration with Shopify's Admin REST API.
// Requires a custom app access token created in the Shopify admin
// (Settings → Apps and sales channels → Develop apps) with at least
// the `read_orders` scope. See .env.local.example for the required
// env vars.
//
// This is intentionally a thin client — it only fetches what the
// Unfulfilled Orders tab needs. Do not reuse this for anything that
// writes to Shopify without adding review, since order data touches
// customers directly.

export interface ShopifyLineItem {
  title: string;
  sku: string;
  quantity: number;
  fulfillable_quantity?: number;
}

export interface ShopifyOrder {
  id: number;
  name: string;               // e.g. "#10234"
  created_at: string;
  updated_at: string;
  financial_status: string | null;
  fulfillment_status: string | null;  // null | 'partial' | 'fulfilled' | 'restocked'
  tags: string;
  total_price: string;
  currency: string;
  cancelled_at: string | null;
  customer: {
    first_name?: string;
    last_name?: string;
    email?: string;
  } | null;
  email: string | null;
  line_items: ShopifyLineItem[];
}

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;       // e.g. "snapwireless.myshopify.com"
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;  // shpat_...
  const version = process.env.SHOPIFY_API_VERSION || '2024-10';
  if (!domain || !token) {
    throw new Error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN env vars');
  }
  return { domain, token, version };
}

const ORDER_FIELDS = [
  'id', 'name', 'created_at', 'updated_at', 'financial_status',
  'fulfillment_status', 'tags', 'total_price', 'currency',
  'cancelled_at', 'customer', 'email', 'line_items',
].join(',');

/**
 * Fetch every currently-open order (not cancelled/archived) from Shopify,
 * following cursor-based pagination via the Link header. Filtering down to
 * unfulfilled/partial happens in the caller — Shopify's own
 * `fulfillment_status=unfulfilled` filter excludes partially-fulfilled
 * orders, which we still want to surface.
 */
export async function fetchOpenShopifyOrders(): Promise<ShopifyOrder[]> {
  const { domain, token, version } = getShopifyConfig();
  const orders: ShopifyOrder[] = [];

  let url: string | null =
    `https://${domain}/admin/api/${version}/orders.json?status=open&limit=250&fields=${ORDER_FIELDS}`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      // Never cache — this always needs fresh fulfillment state.
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Shopify API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const json: { orders: ShopifyOrder[] } = await res.json();
    orders.push(...(json.orders ?? []));

    // Cursor pagination: next page URL is in the Link response header.
    const link = res.headers.get('Link') || res.headers.get('link');
    const match = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  return orders;
}

/** Orders that are open and not yet (or only partially) fulfilled. */
export function isUnfulfilled(order: ShopifyOrder): boolean {
  return !order.cancelled_at && order.fulfillment_status !== 'fulfilled';
}

export function shopifyOrderAdminUrl(orderId: number): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || '';
  const storeSlug = domain.replace(/\.myshopify\.com$/, '');
  return `https://admin.shopify.com/store/${storeSlug}/orders/${orderId}`;
}
