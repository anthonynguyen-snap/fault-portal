import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>) {
  return {
    id:        String(row.id ?? ''),
    store:     String(row.store ?? ''),
    recipient: String(row.recipient ?? ''),
    address:   String(row.address ?? ''),
    phone:     String(row.phone ?? ''),
    notes:     String(row.notes ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = String(record.message ?? record.details ?? record.hint ?? '');
    if (message.includes('replenishment_store_addresses') || message.includes('relation')) {
      return 'Store address table is missing. Apply the Supabase migration 20260522_replenishment_store_addresses.sql, then try again.';
    }
    if (message) return message;
  }
  return String(error);
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('replenishment_store_addresses')
      .select('*')
      .order('store', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const store = String(body.store ?? '').trim();
    if (!store) return NextResponse.json({ error: 'Store is required' }, { status: 400 });

    const { data, error } = await getSupabase()
      .from('replenishment_store_addresses')
      .upsert({
        store,
        recipient:  String(body.recipient ?? '').trim(),
        address:    String(body.address ?? '').trim(),
        phone:      String(body.phone ?? '').trim(),
        notes:      String(body.notes ?? '').trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
