import { NextRequest, NextResponse } from 'next/server';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ data: products }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[GET /api/products]', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const manufacturerName = String(body.manufacturerName ?? '').trim();

    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }
    const result = await createProduct({
      name,
      manufacturerName,
      unitCostUSD:        parseFloat(body.unitCostUSD) || 0,
      manufacturerNumbers: Array.isArray(body.manufacturerNumbers)
        ? body.manufacturerNumbers
        : [],
      claimable: manufacturerName ? body.claimable !== false : false,
    });
    return NextResponse.json({
      data: result.product,
      meta: {
        sheetRow: result.sheetRow,
        writeRange: result.writeRange,
        layout: result.layout,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/products]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }
    const updates = {
      ...body,
      ...(body.name !== undefined ? { name: String(body.name ?? '').trim() } : {}),
      ...(body.manufacturerName !== undefined
        ? { manufacturerName: String(body.manufacturerName ?? '').trim() }
        : {}),
    };
    if (updates.name !== undefined && !updates.name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    if (updates.manufacturerName === '') updates.claimable = false;
    await updateProduct(body.id, updates);
    return NextResponse.json({ message: 'Updated' });
  } catch (error) {
    console.error('[PATCH /api/products]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }
    await deleteProduct(id);
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    console.error('[DELETE /api/products]', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
