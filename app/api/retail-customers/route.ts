import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RetailCustomer } from '@/types';

function fromRow(row: Record<string, unknown>): RetailCustomer {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    name: (row.name as string) || '',
    email: (row.email as string) || '',
    phone: (row.phone as string) || '',
    shippingAddress: (row.shipping_address as string) || '',
    shippingCity: (row.shipping_city as string) || '',
    shippingState: (row.shipping_state as string) || '',
    shippingPostcode: (row.shipping_postcode as string) || '',
    shippingCountry: (row.shipping_country as string) || 'AU',
    notes: (row.notes as string) || '',
  };
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('retail_customers')
    .select('*')
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data || []).map(fromRow) });
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  const body = await req.json();

  const { data, error } = await supabase
    .from('retail_customers')
    .insert([{
      name: body.name || '',
      email: body.email || '',
      phone: body.phone || '',
      shipping_address: body.shippingAddress || '',
      shipping_city: body.shippingCity || '',
      shipping_state: body.shippingState || '',
      shipping_postcode: body.shippingPostcode || '',
      shipping_country: body.shippingCountry || 'AU',
      notes: body.notes || '',
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: fromRow(data) }, { status: 201 });
}
