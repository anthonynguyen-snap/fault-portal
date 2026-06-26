import { NextRequest, NextResponse } from 'next/server';
import { getAllStockItems, addStockItem } from '@/lib/stock-sheets';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const items = await getAllStockItems();
    return NextResponse.json({ data: items });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, sku, lowStockThreshold, category, imageUrl } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!sku?.trim())  return NextResponse.json({ error: 'SKU is required'  }, { status: 400 });
    const item = await addStockItem({
      name:              name.trim(),
      sku:               sku.trim(),
      lowStockThreshold: lowStockThreshold ?? 5,
      category,
      imageUrl,
    });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
