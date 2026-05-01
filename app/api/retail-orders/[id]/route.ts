import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RetailOrder, RetailOrderItem } from '@/types';

function fromItemRow(row: Record<string, unknown>): RetailOrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    product: (row.product as string) || '',
    sku: (row.sku as string) || '',
    quantityOrdered: (row.quantity_ordered as number) || 0,
    quantityShipped: (row.quantity_shipped as number) || 0,
  };
}

function fromRow(row: Record<string, unknown>): RetailOrder {
  const rawItems = Array.isArray(row.retail_order_items) ? row.retail_order_items : [];
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    orderNumber: (row.order_number as string) || '',
    platform: (row.platform as string) || 'Shopify',
    orderDate: (row.order_date as string) || '',
    customerName: (row.customer_name as string) || '',
    customerEmail: (row.customer_email as string) || '',
    customerPhone: (row.customer_phone as string) || '',
    shippingAddress: (row.shipping_address as string) || '',
    shippingCity: (row.shipping_city as string) || '',
    shippingState: (row.shipping_state as string) || '',
    shippingPostcode: (row.shipping_postcode as string) || '',
    shippingCountry: (row.shipping_country as string) || 'AU',
    thirdPlReference: (row.third_pl_reference as string) || '',
    warehouse: (row.warehouse as string) || '',
    thirdPlNotes: (row.third_pl_notes as string) || '',
    carrier: (row.carrier as string) || '',
    trackingNumber: (row.tracking_number as string) || '',
    trackingUrl: (row.tracking_url as string) || '',
    status: (row.status as RetailOrder['status']) || 'Pending',
    shippedDate: (row.shipped_date as string) || '',
    deliveredDate: (row.delivered_date as string) || '',
    estimatedDelivery: (row.estimated_delivery as string) || '',
    notes: (row.notes as string) || '',
    customerId: (row.customer_id as string) || '',
    items: rawItems.map(fromItemRow),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  const { id } = await params;
  const { data, error } = await supabase
    .from('retail_orders')
    .select('*, retail_order_items(*)')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data: fromRow(data) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  const { id } = await params;
  const body = await req.json();
  const { items, ...fields } = body;

  const updatePayload: Record<string, unknown> = {};
  const map: Record<string, string> = {
    orderNumber: 'order_number', platform: 'platform', orderDate: 'order_date',
    customerName: 'customer_name', customerEmail: 'customer_email', customerPhone: 'customer_phone',
    shippingAddress: 'shipping_address', shippingCity: 'shipping_city',
    shippingState: 'shipping_state', shippingPostcode: 'shipping_postcode', shippingCountry: 'shipping_country',
    thirdPlReference: 'third_pl_reference', warehouse: 'warehouse', thirdPlNotes: 'third_pl_notes',
    carrier: 'carrier', trackingNumber: 'tracking_number', trackingUrl: 'tracking_url',
    customerId: 'customer_id',
    status: 'status', shippedDate: 'shipped_date', deliveredDate: 'delivered_date',
    estimatedDelivery: 'estimated_delivery', notes: 'notes',
  };
  for (const [camel, snake] of Object.entries(map)) {
    if (camel in fields) updatePayload[snake] = fields[camel] || null;
  }

  const { error } = await supabase.from('retail_orders').update(updatePayload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace items if provided
  if (Array.isArray(items)) {
    await supabase.from('retail_order_items').delete().eq('order_id', id);
    if (items.length > 0) {
      const itemRows = items.map((item: RetailOrderItem) => ({
        order_id: id,
        product: item.product,
        sku: item.sku || '',
        quantity_ordered: item.quantityOrdered || 0,
        quantity_shipped: item.quantityShipped || 0,
      }));
      await supabase.from('retail_order_items').insert(itemRows);
    }
  }

  const { data: full } = await supabase
    .from('retail_orders')
    .select('*, retail_order_items(*)')
    .eq('id', id)
    .single();
  return NextResponse.json({ data: fromRow(full!) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  const { id } = await params;
  const { error } = await supabase.from('retail_orders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
