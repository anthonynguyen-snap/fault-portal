import { NextRequest, NextResponse } from 'next/server';
import { getCases, createCase } from '@/lib/google-sheets';
import { logActivity } from '@/lib/activity';

// GET /api/cases — returns all fault cases
export async function GET(req: NextRequest) {
  try {
    const cases = await getCases();

    // Optional query filters
    const { searchParams } = new URL(req.url);
    const search      = searchParams.get('search')?.toLowerCase();
    const manufacturer= searchParams.get('manufacturer');
    const status      = searchParams.get('status');
    const from        = searchParams.get('from');
    const to          = searchParams.get('to');

    let filtered = cases;

    if (search) {
      filtered = filtered.filter(c =>
        c.orderNumber.toLowerCase().includes(search)   ||
        c.customerName.toLowerCase().includes(search)  ||
        c.product.toLowerCase().includes(search)       ||
        c.manufacturerName.toLowerCase().includes(search) ||
        c.faultType.toLowerCase().includes(search)
      );
    }

    if (manufacturer) {
      filtered = filtered.filter(c =>
        c.manufacturerName.toLowerCase() === manufacturer.toLowerCase()
      );
    }

    if (status) {
      filtered = filtered.filter(c => c.claimStatus === status);
    }

    if (from) {
      filtered = filtered.filter(c => c.date >= from);
    }

    if (to) {
      filtered = filtered.filter(c => c.date <= to);
    }

    // Sort newest first
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error('[GET /api/cases]', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

// POST /api/cases — create a new fault case
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    const required = [
      'date', 'orderNumber', 'customerName', 'product',
      'manufacturerName', 'faultType', 'evidenceLink',
    ];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate unitCostUSD bounds
    const unitCost = parseFloat(body.unitCostUSD) || 0;
    if (unitCost < 0 || unitCost > 99_999) {
      return NextResponse.json({ error: 'unitCostUSD must be between 0 and 99,999' }, { status: 400 });
    }

    // Validate evidenceLink is a non-empty string (URLs already validated client-side)
    if (typeof body.evidenceLink !== 'string' || !body.evidenceLink.trim()) {
      return NextResponse.json({ error: 'Evidence link is required' }, { status: 400 });
    }

    const newCase = await createCase({
      date:               body.date,
      orderNumber:        body.orderNumber.trim(),
      customerName:       body.customerName.trim(),
      product:            body.product,
      manufacturerName:   body.manufacturerName,
      manufacturerNumber: body.manufacturerNumber || '',
      faultType:          body.faultType,
      faultNotes:         body.faultNotes || '',
      evidenceLink:       body.evidenceLink.trim(),
      unitCostUSD:        unitCost,
      claimStatus:        body.claimStatus || 'Unsubmitted',
      submittedBy:        body.submittedBy || '',
    });

    void logActivity({
      actor:       body.submittedBy ?? '',
      action:      'case.created',
      entityType:  'Case',
      entityId:    newCase.id ?? '',
      entityLabel: body.orderNumber,
      detail:      { product: body.product, faultType: body.faultType, manufacturer: body.manufacturerName },
    });
    return NextResponse.json({ data: newCase }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/cases]', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
