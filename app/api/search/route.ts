import { NextRequest, NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';
import { getSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export interface SearchResult {
  type: 'case' | 'refund' | 'return';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface ApiResponse {
  results: SearchResult[];
}

/**
 * GET /api/search?q=searchterm
 *
 * Unified search across Cases, Refunds, and Returns.
 * - Returns up to 5 results per source, sorted: cases first, then refunds, then returns
 * - Max 12 total results
 * - Returns empty arrays (doesn't throw) if any source fails
 * - Returns 503 if q is missing or < 2 chars
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';

    // Validate query
    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 503 }
      );
    }

    const lowerQ = q.toLowerCase();
    const results: SearchResult[] = [];

    // === CASES (Google Sheets) ===
    try {
      const cases = await getCases();
      const casesResults = cases
        .filter(c =>
          c.orderNumber.toLowerCase().includes(lowerQ) ||
          c.customerName.toLowerCase().includes(lowerQ) ||
          c.product.toLowerCase().includes(lowerQ) ||
          c.manufacturerName.toLowerCase().includes(lowerQ) ||
          c.faultType.toLowerCase().includes(lowerQ)
        )
        .slice(0, 5)
        .map(c => ({
          type: 'case' as const,
          id: c.id,
          title: `${c.orderNumber} — ${c.customerName}`,
          subtitle: `${c.product} · ${c.faultType}`,
          href: `/cases/${c.id}`,
        }));
      results.push(...casesResults);
    } catch (err) {
      console.error('[search] Cases fetch failed:', err);
      // Don't throw, just skip this source
    }

    // === REFUNDS (Supabase) ===
    try {
      const { data: refunds, error: refundErr } = await getSupabase()
        .from('refund_requests')
        .select('id, order_number, customer_name, amount, status');

      if (refundErr) throw refundErr;

      const refundsResults = (refunds || [])
        .filter(r =>
          String(r.order_number).toLowerCase().includes(lowerQ) ||
          String(r.customer_name).toLowerCase().includes(lowerQ)
        )
        .slice(0, 5)
        .map(r => ({
          type: 'refund' as const,
          id: String(r.id),
          title: `${r.order_number} — ${r.customer_name}`,
          subtitle: `$${Number(r.amount).toFixed(2)} · ${r.status}`,
          href: '/refunds',
        }));
      results.push(...refundsResults);
    } catch (err) {
      console.error('[search] Refunds fetch failed:', err);
      // Don't throw, just skip this source
    }

    // === RETURNS (Supabase) ===
    try {
      const { data: returns, error: returnsErr } = await getSupabase()
        .from('returns')
        .select('id, order_number, customer_name, status');

      if (returnsErr) throw returnsErr;

      const returnsResults = (returns || [])
        .filter(r =>
          String(r.order_number).toLowerCase().includes(lowerQ) ||
          String(r.customer_name).toLowerCase().includes(lowerQ)
        )
        .slice(0, 5)
        .map(r => ({
          type: 'return' as const,
          id: String(r.id),
          title: `${r.order_number} — ${r.customer_name}`,
          subtitle: String(r.status),
          href: '/returns',
        }));
      results.push(...returnsResults);
    } catch (err) {
      console.error('[search] Returns fetch failed:', err);
      // Don't throw, just skip this source
    }

    // Limit to 12 total results (cases are already first, then refunds, then returns)
    const finalResults = results.slice(0, 12);

    return NextResponse.json({ results: finalResults });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/search] Unexpected error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
