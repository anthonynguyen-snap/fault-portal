import { NextRequest, NextResponse } from 'next/server';
import { getReturnById, updateReturn } from '@/lib/google-sheets';

export const runtime = 'nodejs';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await getReturnById(params.id);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const updates = await req.json();
    const updated = await updateReturn(params.id, updates);
    return NextResponse.json({ data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
