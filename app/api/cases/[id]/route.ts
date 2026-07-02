import { NextRequest, NextResponse } from 'next/server';
import { getCaseById, updateCase } from '@/lib/google-sheets';
import { logActivity } from '@/lib/activity';

// GET /api/cases/[id] — get a single case
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const faultCase = await getCaseById(id);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.faultType === 'Cable Fault' && !['USB-C', 'Lightning', 'Other cable'].includes(body.faultSubtype)) {
      return NextResponse.json({ error: 'A valid cable type is required' }, { status: 400 });
    }
    const updated = await updateCase(id, body);
    void logActivity({
      actor:       body.submittedBy ?? '',
      action:      'case.updated',
      entityType:  'Case',
      entityId:    id,
      entityLabel: updated.orderNumber ?? id,
      detail:      { claimStatus: updated.claimStatus },
    });
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('[PATCH /api/cases/[id]]', error);
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}
