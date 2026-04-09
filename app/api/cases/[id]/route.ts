import { NextRequest, NextResponse } from 'next/server';
import { getCaseById, updateCase } from '@/lib/google-sheets';

// GET /api/cases/[id] — get a single case
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const faultCase = await getCaseById(params.id);
    if (!faultCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    return NextResponse.json({ data: faultCase });
  } catch (error) {
    console.error('[GET /api/cases/[id]]', error);
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}

// PATCH /api/cases/[id] — update a case (partial update)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await updateCase(params.id, body);
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('[PATCH /api/cases/[id]]', error);
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}
