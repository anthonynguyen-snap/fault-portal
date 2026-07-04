import { NextRequest, NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const query = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() || '';
    if (query.length < 2) return NextResponse.json({ groups: [] });
    const cases = await getCases();
    const unique = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
    const matching = (value: string) => value.toLowerCase().includes(query);
    const ranked = (values: string[]) => unique(values)
      .filter(matching)
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aRank = aLower === query ? 0 : aLower.startsWith(query) ? 1 : 2;
        const bRank = bLower === query ? 0 : bLower.startsWith(query) ? 1 : 2;
        return aRank - bRank || a.localeCompare(b);
      })
      .slice(0, 5);

    const groups = [
      { label: 'Order numbers', values: ranked(cases.map(item => item.orderNumber)) },
      { label: 'Manufacturer numbers', values: ranked(cases.map(item => item.manufacturerNumber || '')) },
      { label: 'Customers', values: ranked(cases.map(item => item.customerName)) },
      { label: 'Products', values: ranked(cases.map(item => item.product)) },
      { label: 'Faults', values: ranked(cases.flatMap(item => [item.faultType, item.faultSubtype || ''])) },
    ].filter(group => group.values.length > 0);

    return NextResponse.json({ groups }, { headers: { 'Cache-Control': 'private, max-age=15' } });
  } catch (error) {
    console.error('[GET /api/cases/suggestions]', error);
    return NextResponse.json({ groups: [] }, { status: 500 });
  }
}
