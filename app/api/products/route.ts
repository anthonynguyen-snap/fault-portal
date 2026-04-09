import { NextRequest, NextResponse } from 'next/server';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/google-sheets';

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ data: products });
  } catch (error) {
    console.error('[GET /api/products]', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.manufacturerName) {
      return NextResponse.json(
        { error: 'Product name and manufacturer name are required' },
        { status: 400 }
      );
    }
    const product = await createProduct({
      name:               body.name,
      manufacturerName:   body.manufacturerName,
      unitCostUSD:        parseFloat(body.unitCostUSD) || 0,
      manufacturerNumbers: Array.isArray(body.manufacturerNumbers)
        ? body.manufacturerNumbers
        : [],
    });
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/products]', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }
    await updateProduct(body.id, body);
    return NextResponse.json({ message: 'Updated' });
  } catch (error) {
    console.error('[PATCH /api/products]', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
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
