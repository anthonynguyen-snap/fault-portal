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
    items: rawItems.map(fromItemRow),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  const { id } = await params;
  const { data, error } = await supabase
    .from('corporate_orders')
    .select('*, corporate_order_items(*)')
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

  const update: Record<string, unknown> = {};
  if (fields.companyName     !== undefined) update.company_name = fields.companyName;
  if (fields.contactName     !== undefined) update.contact_name = fields.contactName;
  if (fields.contactEmail    !== undefined) update.contact_email = fields.contactEmail;
  if (fields.contactPhone    !== undefined) update.contact_phone = fields.contactPhone;
  if (fields.billingAddress  !== undefined) update.billing_address = fields.billingAddress;
  if (fields.shippingAddress !== undefined) update.shipping_address = fields.shippingAddress;
  if (fields.status          !== undefined) update.status = fields.status;
  if (fields.inquiryDate     !== undefined) update.inquiry_date = fields.inquiryDate || null;
  if (fields.requestedDeliveryDate !== undefined) update.requested_delivery_date = fields.requestedDeliveryDate || null;
  if (fields.actualDeliveryDate    !== undefined) update.actual_delivery_date = fields.actualDeliveryDate || null;
  if (fields.quoteSentDate         !== undefined) update.quote_sent_date = fields.quoteSentDate || null;
  if (fields.quoteApprovedDate     !== undefined) update.quote_approved_date = fields.quoteApprovedDate || null;
  if (fields.mockupSentDate        !== undefined) update.mockup_sent_date = fields.mockupSentDate || null;
  if (fields.mockupApprovedDate    !== undefined) update.mockup_approved_date = fields.mockupApprovedDate || null;
  if (fields.orderSentDate         !== undefined) update.order_sent_date = fields.orderSentDate || null;
  if (fields.expectedCompletionDate !== undefined) update.expected_completion_date = fields.expectedCompletionDate || null;
  if (fields.quoteAmount     !== undefined) update.quote_amount = fields.quoteAmount || null;
  if (fields.supplierQuote   !== undefined) update.supplier_quote = fields.supplierQuote || null;
  if (fields.shippingCost    !== undefined) update.shipping_cost = fields.shippingCost || null;
  if (fields.paymentStatus   !== undefined) update.payment_status = fields.paymentStatus;
  if (fields.supplier        !== undefined) update.supplier = fields.supplier || null;
  if (fields.logoUrl           !== undefined) update.logo_url = fields.logoUrl || null;
  if (fields.mockupUrl         !== undefined) update.mockup_url = fields.mockupUrl || null;
  if (fields.notes             !== undefined) update.notes = fields.notes || null;
  if (fields.conversationLink  !== undefined) update.conversation_link = fields.conversationLink || null;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('corporate_orders').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(items)) {
    await supabase.from('corporate_order_items').delete().eq('order_id', id);
    if (items.length > 0) {
      const itemRows = items.map((item: CorporateItem) => ({
        order_id: id,
        product: item.product,
        quantity: item.quantity || 0,
        unit_price: item.unitPrice || 0,
      }));
      const { error: itemErr } = await supabase.from('corporate_order_items').insert(itemRows);
      if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
  }

  const { data: full } = await supabase
    .from('corporate_orders')
    .select('*, corporate_order_items(*)')
    .eq('id', id)
    .single();

  return NextResponse.json({ data: fromRow(full) });
}
