import { NextRequest, NextResponse } from 'next/server';
import { getClaims, createClaim, updateClaim } from '@/lib/google-sheets';

export async function GET() {
  try {
    const claims = await getClaims();
    // Sort: most recent year+month first
    claims.sort((a, b) => {
      const aKey = `${a.year}-${String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(a.month.slice(0,3)) + 1).padStart(2,'0')}`;
      const bKey = `${b.year}-${String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(b.month.slice(0,3)) + 1).padStart(2,'0')}`;
      return bKey.localeCompare(aKey);
    });
    return NextResponse.json({ data: claims });
  } catch (error) {
    console.error('[GET /api/claims]', error);
    return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.manufacturer || !body.month || !body.year) {
      return NextResponse.json(
        { error: 'Manufacturer, month, and year are required' },
        { status: 400 }
      );
    }
    const claim = await createClaim({
      manufacturer:    body.manufacturer,
      month:           body.month,
      year:            body.year,
      faultCount:      parseInt(body.faultCount)      || 0,
      costAtRisk:      parseFloat(body.costAtRisk)    || 0,
      amountRecovered: parseFloat(body.amountRecovered) || 0,
      status:          body.status || 'Unsubmitted',
      notes:           body.notes || '',
      caseIds:         Array.isArray(body.caseIds) ? body.caseIds : [],
    });
    return NextResponse.json({ data: claim }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/claims]', error);
    return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Claim ID required' }, { status: 400 });
    }
    const updated = await updateClaim(body.id, body);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[PATCH /api/claims]', error);
    return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
  }
}
