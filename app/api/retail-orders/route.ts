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

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('retail_orders')
    .select('*, retail_order_items(*)')
    .order('order_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(fromRow) });
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  const body = await req.json();
  const { items = [], ...fields } = body;

  const { data: orderRow, error: orderErr } = await supabase
    .from('retail_orders')
    .insert([{
      order_number: fields.orderNumber,
      platform: fields.platform || 'Shopify',
      order_date: fields.orderDate || null,
      customer_name: fields.customerName || '',
      customer_email: fields.customerEmail || '',
      customer_phone: fields.customerPhone || '',
      shipping_address: fields.shippingAddress || '',
      shipping_city: fields.shippingCity || '',
      shipping_state: fields.shippingState || '',
      shipping_postcode: fields.shippingPostcode || '',
      shipping_country: fields.shippingCountry || 'AU',
      third_pl_reference: fields.thirdPlReference || '',
      warehouse: fields.warehouse || '',
      third_pl_notes: fields.thirdPlNotes || '',
      carrier: fields.carrier || '',
      tracking_number: fields.trackingNumber || '',
      tracking_url: fields.trackingUrl || '',
      status: fields.status || 'Pending',
      customer_id: fields.customerId || null,
      shipped_date: fields.shippedDate || null,
      delivered_date: fields.deliveredDate || null,
      estimated_delivery: fields.estimatedDelivery || null,
      notes: fields.notes || '',
    }])
    .select()
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  if (items.length > 0) {
    const itemRows = items.map((item: RetailOrderItem) => ({
      order_id: orderRow.id,
      product: item.product,
      sku: item.sku || '',
      quantity_ordered: item.quantityOrdered || 0,
      quantity_shipped: item.quantityShipped || 0,
    }));
    const { error: itemErr } = await supabase.from('retail_order_items').insert(itemRows);
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  const { data: full } = await supabase
    .from('retail_orders')
    .select('*, retail_order_items(*)')
    .eq('id', orderRow.id)
    .single();

  return NextResponse.json({ data: fromRow(full) }, { status: 201 });
}
