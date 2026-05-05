import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { CorporateOrder, CorporateItem } from '@/types';

function fromItemRow(row: Record<string, unknown>): CorporateItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    product: (row.product as string) || '',
    quantity: (row.quantity as number) || 0,
    unitPrice: (row.unit_price as number) || 0,
  };
}

function fromRow(row: Record<string, unknown>): CorporateOrder {
  const rawItems = Array.isArray(row.corporate_order_items) ? row.corporate_order_items : [];
  const items = rawItems.map(fromItemRow);
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    companyName: (row.company_name as string) || '',
    contactName: (row.contact_name as string) || '',
    contactEmail: (row.contact_email as string) || '',
    contactPhone: (row.contact_phone as string) || '',
    billingAddress: (row.billing_address as string) || '',
    shippingAddress: (row.shipping_address as string) || '',
    status: (row.status as CorporateOrder['status']) || 'Inquiry',
    inquiryDate: (row.inquiry_date as string) || '',
    requestedDeliveryDate: (row.requested_delivery_date as string) || '',
    actualDeliveryDate: (row.actual_delivery_date as string) || '',
    quoteSentDate: (row.quote_sent_date as string) || '',
    quoteApprovedDate: (row.quote_approved_date as string) || '',
    mockupSentDate: (row.mockup_sent_date as string) || '',
    mockupApprovedDate: (row.mockup_approved_date as string) || '',
    orderSentDate: (row.order_sent_date as string) || '',
    expectedCompletionDate: (row.expected_completion_date as string) || '',
    quoteAmount: (row.quote_amount as number) || 0,
    supplierQuote: (row.supplier_quote as number) || 0,
    shippingCost: (row.shipping_cost as number) || 0,
    paymentStatus: (row.payment_status as CorporateOrder['paymentStatus']) || 'Unpaid',
    supplier: (row.supplier as string) || '',
    logoUrl: (row.logo_url as string) || '',
    mockupUrl: (row.mockup_url as string) || '',
    notes: (row.notes as string) || '',
    referenceNumber: (row.reference_number as string) || '',
    conversationLink: (row.conversation_link as string) || '',
    items,
  };
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('corporate_orders')
    .select('*, corporate_order_items(*)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(fromRow) });
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  const body = await req.json();
  const { items = [], ...orderFields } = body;

  // Generate reference number: CORP-YYYY-NNN
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('corporate_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`);
  const refNum = `CORP-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

  const { data: orderRow, error: orderErr } = await supabase
    .from('corporate_orders')
    .insert([{
      company_name: orderFields.companyName,
      contact_name: orderFields.contactName,
      contact_email: orderFields.contactEmail,
      contact_phone: orderFields.contactPhone,
      billing_address: orderFields.billingAddress,
      shipping_address: orderFields.shippingAddress,
      status: orderFields.status || 'Inquiry',
      inquiry_date: orderFields.inquiryDate || new Date().toISOString().split('T')[0],
      requested_delivery_date: orderFields.requestedDeliveryDate || null,
      quote_amount: orderFields.quoteAmount || null,
      supplier_quote: orderFields.supplierQuote || null,
      shipping_cost: orderFields.shippingCost || null,
      payment_status: orderFields.paymentStatus || 'Unpaid',
      supplier: orderFields.supplier || null,
      logo_url: orderFields.logoUrl || null,
      mockup_url: orderFields.mockupUrl || null,
      notes: orderFields.notes || null,
      conversation_link: orderFields.conversationLink || null,
      reference_number: refNum,
    }])
    .select()
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  if (items.length > 0) {
    const itemRows = items.map((item: CorporateItem) => ({
      order_id: orderRow.id,
      product: item.product,
      quantity: item.quantity || 0,
      unit_price: item.unitPrice || 0,
    }));
    const { error: itemErr } = await supabase.from('corporate_order_items').insert(itemRows);
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  const { data: full } = await supabase
    .from('corporate_orders')
    .select('*, corporate_order_items(*)')
    .eq('id', orderRow.id)
    .single();

  return NextResponse.json({ data: fromRow(full) }, { status: 201 });
}
