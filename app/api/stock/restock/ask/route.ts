import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { RestockItem } from '@/types';

export const runtime = 'nodejs';

// Staff-facing "ask about a product" endpoint. Unlike the main restock
// route (admin-only for mutations, see proxy.ts), this is reachable by any
// signed-in staff member — it only ever creates a bare, unanswered request
// with the asker's name attached, never a full admin-authored update.
function fromRow(row: Record<string, unknown>): RestockItem {
  return {
    id:                  String(row.id ?? ''),
    productName:         String(row.product_name ?? ''),
    sku:                 String(row.sku ?? ''),
    store:               String(row.store ?? 'All Stores'),
    status:              (row.status as RestockItem['status']) ?? 'Out of Stock',
    expectedRestockDate: (row.expected_restock_date as string | null) ?? null,
    expectedRestockLabel: String(row.expected_restock_label ?? ''),
    customerMessage:     String(row.customer_message ?? ''),
    supplier:            String(row.supplier ?? ''),
    notes:               String(row.notes ?? ''),
    resolved:            Boolean(row.resolved ?? false),
    createdAt:           String(row.created_at ?? ''),
    resolvedAt:          (row.resolved_at as string | null) ?? null,
    requestedBy:         (row.requested_by as string | null) ?? null,
    requestedNote:       String(row.requested_note ?? ''),
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await req.json();
    if (!body.productName?.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('restock_items')
      .insert({
        product_name:   body.productName.trim(),
        store:          body.store?.trim() || 'All Stores',
        status:         'Out of Stock',
        requested_by:   session.name,
        requested_note: body.requestedNote?.trim() ?? '',
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data: fromRow(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
