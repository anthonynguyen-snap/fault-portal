import { NextRequest, NextResponse } from 'next/server';
import { getCases, createCase } from '@/lib/google-sheets';
import { logActivity } from '@/lib/activity';
import { getFaultSubtypes, isFaultParentType, isValidFaultSubtype, requiresFaultNotes } from '@/lib/fault-taxonomy';

// GET /api/cases — returns all fault cases
export async function GET(req: NextRequest) {
  try {
    const cases = await getCases();

    type FaultMetric = { name: string; count: number; cost: number };
    const aggregateFaults = (source: typeof cases): FaultMetric[] => {
      const totals = new Map<string, FaultMetric>();
      for (const faultCase of source) {
        const name = faultCase.faultType?.trim() || 'Not specified';
        const current = totals.get(name) ?? { name, count: 0, cost: 0 };
        current.count += 1;
        current.cost += Number(faultCase.unitCostUSD) || 0;
        totals.set(name, current);
      }
      return Array.from(totals.values()).sort((a, b) => b.count - a.count || b.cost - a.cost);
    };

    const adelaideDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit',
    }).formatToParts(new Date());
    const currentYear = adelaideDateParts.find(part => part.type === 'year')?.value;
    const currentMonthNumber = adelaideDateParts.find(part => part.type === 'month')?.value;
    const currentMonth = `${currentYear}-${currentMonthNumber}`;
    const currentMonthDate = new Date(Number(currentYear), Number(currentMonthNumber) - 1, 1);
    const previousMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthCases = cases.filter(faultCase => faultCase.date?.slice(0, 7) === currentMonth);
    const previousMonthCases = cases.filter(faultCase => faultCase.date?.slice(0, 7) === previousMonth);
    const allTimeRanking = aggregateFaults(cases);
    const thisMonthRanking = aggregateFaults(thisMonthCases);

    const monthlyGroups = new Map<string, typeof cases>();
    for (const faultCase of cases) {
      const month = faultCase.date?.slice(0, 7);
      if (!month) continue;
      const group = monthlyGroups.get(month) ?? [];
      group.push(faultCase);
      monthlyGroups.set(month, group);
    }
    const monthlyLeaders = Array.from(monthlyGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([month, monthCases]) => ({
        month,
        total: monthCases.length,
        leader: aggregateFaults(monthCases)[0] ?? null,
      }));

    const insights = {
      currentMonth,
      thisMonthTotal: thisMonthCases.length,
      previousMonthTotal: previousMonthCases.length,
      thisMonthRanking,
      allTimeRanking,
      monthlyLeaders,
    };

    // Optional query filters
    const { searchParams } = new URL(req.url);
    const search      = searchParams.get('search')?.toLowerCase();
    const manufacturer= searchParams.get('manufacturer');
    const products     = searchParams.getAll('product');
    const status      = searchParams.get('status');
    const faultTypes  = searchParams.getAll('faultType');
    const faultSubtypes = searchParams.getAll('faultSubtype');
    const from        = searchParams.get('from');
    const to          = searchParams.get('to');
    const submittedBy = searchParams.get('submittedBy')?.toLowerCase();

    let filtered = cases;

    if (search) {
      filtered = filtered.filter(c =>
        c.orderNumber.toLowerCase().includes(search)      ||
        c.customerName.toLowerCase().includes(search)     ||
        c.product.toLowerCase().includes(search)          ||
        c.manufacturerName.toLowerCase().includes(search) ||
        (c.manufacturerNumber || '').toLowerCase().includes(search) ||
        c.faultType.toLowerCase().includes(search)        ||
        (c.faultSubtype || '').toLowerCase().includes(search) ||
        (c.originalFaultType || '').toLowerCase().includes(search) ||
        (c.faultNotes || '').toLowerCase().includes(search)
      );
    }

    if (faultTypes.length > 0) {
      const lower = faultTypes.map(f => f.toLowerCase());
      filtered = filtered.filter(c => lower.includes(c.faultType.toLowerCase()));
    }

    if (faultSubtypes.length > 0) {
      const lower = faultSubtypes.map(subtype => subtype.toLowerCase());
      filtered = filtered.filter(c => lower.includes((c.faultSubtype || '').toLowerCase()));
    }

    if (manufacturer) {
      filtered = filtered.filter(c =>
        c.manufacturerName.toLowerCase() === manufacturer.toLowerCase()
      );
    }

    if (products.length > 0) {
      const lower = products.map(product => product.trim().toLowerCase());
      filtered = filtered.filter(c => lower.includes(c.product.trim().toLowerCase()));
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

    if (submittedBy) {
      const sq = submittedBy.trim();
      filtered = filtered.filter(c => {
        const stored = c.submittedBy.toLowerCase().trim();
        return stored === sq || stored.includes(sq) || sq.includes(stored);
      });
    }

    // Sort
    const sortKey  = (searchParams.get('sortKey')  || 'createdAt') as keyof typeof filtered[0];
    const sortDir  = searchParams.get('sortDir') === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (search) {
        const rank = (item: typeof a) => {
          const identifiers = [item.orderNumber, item.manufacturerNumber || ''].map(value => value.trim().toLowerCase());
          if (identifiers.some(value => value === search)) return 0;
          if (identifiers.some(value => value.startsWith(search))) return 1;
          return 2;
        };
        const rankDifference = rank(a) - rank(b);
        if (rankDifference) return rankDifference;
      }
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });

    // Pagination
    const total  = filtered.length;
    const limit  = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '20', 10)));
    const page   = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pages  = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paged  = filtered.slice(offset, offset + limit);

    // Aggregate fault type counts across all filtered results
    const byFaultType: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const otherNotes: Record<string, number> = {};
    for (const c of filtered) {
      byFaultType[c.faultType] = (byFaultType[c.faultType] || 0) + 1;
      if (c.date) {
        const ym = c.date.slice(0, 7); // 'YYYY-MM'
        byMonth[ym] = (byMonth[ym] || 0) + 1;
      }
      if (c.faultType === 'Other' && c.faultNotes?.trim()) {
        const note = c.faultNotes.trim();
        otherNotes[note] = (otherNotes[note] || 0) + 1;
      }
    }

    return NextResponse.json({ data: paged, total, page, pages, limit, byFaultType, byMonth, otherNotes, insights });
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
      'manufacturerName', 'faultType', 'commslayerChatLink', 'evidenceLink',
    ];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: 'Missing required field: ' + field },
          { status: 400 }
        );
      }
    }

    if (!isFaultParentType(body.faultType)) {
      return NextResponse.json({ error: 'A valid fault type is required' }, { status: 400 });
    }
    if (!isValidFaultSubtype(body.faultType, body.faultSubtype || '')) {
      const required = getFaultSubtypes(body.faultType).length > 0;
      return NextResponse.json({ error: required ? 'A valid fault subtype is required' : 'This fault type does not use a subtype' }, { status: 400 });
    }
    if (requiresFaultNotes(body.faultType, body.faultSubtype || '') && !String(body.faultNotes || '').trim()) {
      return NextResponse.json({ error: 'Fault notes are required for safety-critical or Other faults' }, { status: 400 });
    }

    // Validate unitCostUSD bounds
    const unitCost = parseFloat(body.unitCostUSD) || 0;
    if (unitCost < 0 || unitCost > 99999) {
      return NextResponse.json({ error: 'unitCostUSD must be between 0 and 99,999' }, { status: 400 });
    }

    // Validate evidenceLink is a non-empty string (URLs already validated client-side)
    if (typeof body.evidenceLink !== 'string' || !body.evidenceLink.trim()) {
      return NextResponse.json({ error: 'Evidence link is required' }, { status: 400 });
    }

    // A case must link back to the Commslayer customer conversation.
    if (typeof body.commslayerChatLink !== 'string') {
      return NextResponse.json({ error: 'A valid Commslayer chat link is required' }, { status: 400 });
    }
    try {
      const commslayerUrl = new URL(body.commslayerChatLink.trim());
      if (!['http:', 'https:'].includes(commslayerUrl.protocol)) throw new Error('Invalid protocol');
    } catch {
      return NextResponse.json({ error: 'A valid Commslayer chat link is required' }, { status: 400 });
    }

    const newCase = await createCase({
      date:               body.date,
      orderNumber:        body.orderNumber.trim(),
      customerName:       body.customerName.trim(),
      product:            body.product,
      manufacturerName:   body.manufacturerName,
      manufacturerNumber: body.manufacturerNumber || '',
      faultType:          body.faultType,
      faultSubtype:       body.faultSubtype || '',
      taxonomyStatus:     'Current taxonomy',
      originalFaultType:  '',
      faultNotes:         body.faultNotes || '',
      commslayerChatLink: body.commslayerChatLink.trim(),
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
