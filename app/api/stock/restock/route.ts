import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { RestockItem } from '@/types';

export const runtime = 'nodejs';

function fromRow(row: Record<string, unknown>): RestockItem {
  return {
    id:                  String(row.id ?? ''),
    productName:         String(row.product_name ?? ''),
    sku:                 String(row.sku ?? ''),
    status:              (row.status as RestockItem['status']) ?? 'Out of Stock',
    expectedRestockDate: (row.expected_restock_date as string | null) ?? null,
    supplier:            String(row.supplier ?? ''),
    notes:               String(row.notes ?? ''),
    resolved:            Boolean(row.resolved ?? false),
    createdAt:           String(row.created_at ?? ''),
    resolvedAt:          (row.resolved_at as string | null) ?? null,
  };
}

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('restock_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map(fromRow) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.productName?.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    const { data, error } = await getSupabase()
      .from('restock_items')
      .insert({
        product_name:          body.productName.trim(),
        sku:                   body.sku?.trim() ?? '',
        status:                body.status ?? 'Out of Stock',
        expected_restock_date: body.expectedRestockDate || null,
        supplier:              body.supplier?.trim() ?? '',
        notes:                 body.notes?.trim() ?? '',
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
