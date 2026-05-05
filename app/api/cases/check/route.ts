import { NextRequest, NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  try {
    const orderNumber = req.nextUrl.searchParams.get('orderNumber')?.trim();
    if (!orderNumber) return NextResponse.json({ data: [] });
    const cases = await getCases();
    const matches = cases
      .filter(c => c.orderNumber.trim().toLowerCase() === orderNumber.toLowerCase())
      .map(c => ({
        id: c.id,
        product: c.product,
        date: c.date,
        faultType: c.faultType,
        claimStatus: c.claimStatus,
      }));
    return NextResponse.json({ data: matches });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
