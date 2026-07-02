import { NextRequest, NextResponse } from 'next/server';
import { getCases, getClaims, createClaim, updateClaim } from '@/lib/google-sheets';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function getMonthlyClaimPreview(month: string, year: string) {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex < 0 || !/^\d{4}$/.test(year)) {
    throw new Error('Invalid month or year');
  }

  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const cases = (await getCases()).filter(faultCase => faultCase.date?.slice(0, 7) === prefix);
  const grouped = new Map<string, { manufacturer: string; faultCount: number; costAtRisk: number; caseIds: string[] }>();

  for (const faultCase of cases) {
    const manufacturer = faultCase.manufacturerName.trim();
    if (!manufacturer) continue;
    const current = grouped.get(manufacturer) ?? { manufacturer, faultCount: 0, costAtRisk: 0, caseIds: [] };
    current.faultCount += 1;
    current.costAtRisk += Number(faultCase.unitCostUSD) || 0;
    current.caseIds.push(faultCase.id);
    grouped.set(manufacturer, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('preview') === '1') {
      const month = searchParams.get('month') || '';
      const year = searchParams.get('year') || '';
      const preview = await getMonthlyClaimPreview(month, year);
      return NextResponse.json({
        data: preview.map(({ manufacturer, faultCount, costAtRisk }) => ({ manufacturer, faultCount, costAtRisk })),
      });
    }

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
    const preview = await getMonthlyClaimPreview(body.month, String(body.year));
    const matching = preview.find(item => item.manufacturer === body.manufacturer);
    if (!matching) {
      return NextResponse.json(
        { error: `No fault cases found for ${body.manufacturer} in ${body.month} ${body.year}` },
        { status: 400 }
      );
    }

    const claim = await createClaim({
      manufacturer:    body.manufacturer,
      month:           body.month,
      year:            String(body.year),
      faultCount:      matching.faultCount,
      costAtRisk:      matching.costAtRisk,
      amountRecovered: parseFloat(body.amountRecovered) || 0,
      status:          body.status || 'Unsubmitted',
      notes:           body.notes || '',
      caseIds:         matching.caseIds,
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
