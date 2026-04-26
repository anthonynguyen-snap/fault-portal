import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { StockItem } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): StockItem {
  return {
    id:                String(row.id ?? ''),
    name:              String(row.name ?? ''),
    sku:               String(row.sku ?? ''),
    quantity:          Number(row.quantity ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold ?? 5),
    discontinued:      Boolean(row.discontinued ?? false),
    createdAt:         String(row.created_at ?? ''),
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('stock_items')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, sku, lowStockThreshold } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const { data, error } = await getSupabase()
      .from('stock_items')
      .insert({ name: name.trim(), sku: sku?.trim() ?? '', quantity: 0, low_stock_threshold: lowStockThreshold ?? 5 })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
