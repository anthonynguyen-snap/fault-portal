import { NextRequest, NextResponse } from 'next/server';
import { getCases, createClaim, bulkUpdateCaseStatuses } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  try {
    const { manufacturer, month, year, caseIds } = await req.json();

    if (!manufacturer || !month || !year || !Array.isArray(caseIds) || !caseIds.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const allCases = await getCases();
    const eligible = allCases.filter(c =>
      caseIds.includes(c.id) &&
      c.manufacturerName === manufacturer &&
      c.claimStatus === 'Unsubmitted'
    );

    if (!eligible.length) {
      return NextResponse.json(
        { error: 'No eligible unsubmitted cases found for this manufacturer and period' },
        { status: 400 }
      );
    }

    const claim = await createClaim({
      manufacturer,
      month,
      year,
      faultCount: eligible.length,
      costAtRisk: eligible.reduce((s, c) => s + c.unitCostUSD, 0),
      amountRecovered: 0,
      status: 'Claim Raised',
      notes: '',
      caseIds: eligible.map(c => c.id),
    });

    await bulkUpdateCaseStatuses(eligible.map(c => c.id), 'Claim Raised');

    return NextResponse.json({ data: claim });
  } catch (e: any) {
    console.error('[POST /api/reports/claim]', e);
    return NextResponse.json({ error: e.message || 'Failed to generate claim' }, { status: 500 });
  }
}
