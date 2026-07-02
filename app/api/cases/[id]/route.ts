import { NextRequest, NextResponse } from 'next/server';
import { getCaseById, updateCase } from '@/lib/google-sheets';
import { logActivity } from '@/lib/activity';
import { getFaultSubtypes, isFaultParentType, isValidFaultSubtype, requiresFaultNotes } from '@/lib/fault-taxonomy';

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
    if (body.faultType && isFaultParentType(body.faultType)) {
      if (!isValidFaultSubtype(body.faultType, body.faultSubtype || '')) {
        const required = getFaultSubtypes(body.faultType).length > 0;
        return NextResponse.json({ error: required ? 'A valid fault subtype is required' : 'This fault type does not use a subtype' }, { status: 400 });
      }
      if (requiresFaultNotes(body.faultType, body.faultSubtype || '') && !String(body.faultNotes || '').trim()) {
        return NextResponse.json({ error: 'Fault notes are required for safety-critical or Other faults' }, { status: 400 });
      }
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
