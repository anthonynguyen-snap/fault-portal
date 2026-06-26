import { NextRequest, NextResponse } from 'next/server';
import { updateStockItem, deleteStockItem } from '@/lib/stock-sheets';

export const runtime = 'nodejs';

/**
 * After migration, `id` in the URL is the SKU (not a UUID).
 * The stock page continues to use item.id as a key — it just holds
 * the SKU string instead of a Supabase UUID.
 */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sku } = await params;
    const body = await req.json();

    const updates: Parameters<typeof updateStockItem>[1] = {};
    if (body.name              !== undefined) updates.name              = String(body.name).trim();
    if (body.sku               !== undefined) updates.newSku            = String(body.sku).trim();
    if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = Number(body.lowStockThreshold);
    if (body.category          !== undefined) updates.category          = String(body.category);
    if (body.imageUrl          !== undefined) updates.imageUrl          = String(body.imageUrl);
    if (body.discontinued      !== undefined) updates.discontinued      = Boolean(body.discontinued);

    const item = await updateStockItem(sku, updates);
    return NextResponse.json({ data: item });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sku } = await params;
    await deleteStockItem(sku);
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
