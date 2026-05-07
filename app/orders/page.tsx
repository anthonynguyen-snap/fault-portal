'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search, AlertTriangle, CreditCard, RotateCcw,
  Package, ExternalLink, ChevronRight, CheckCircle,
  Clock, XCircle, FileText, PlusCircle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface PortalCase {
  id: string;
  date: string;
  orderNumber: string;
  customerName: string;
  product: string;
  manufacturerName: string;
  faultType: string;
  claimStatus: string;
  unitCostUSD: number;
  submittedBy: string;
  evidenceLink: string;
}

interface PortalRefund {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  reason: string;
  status: string;
  resolution: string;
  createdAt: string;
  shopifyLink: string;
  submittedBy: string;
}

interface PortalReturn {
  id: string;
  orderNumber: string;
  customerName: string;
  date: string;
  status: string;
  followUpStatus: string;
  totalRefundAmount: number;
  assignedTo: string;
}

interface OrderResults {
  orderNumber: string;
  cases: PortalCase[];
  refunds: PortalRefund[];
  returns: PortalReturn[];
  total: number;
}

type TimelineEvent = {
  id: string;
  type: 'case' | 'refund' | 'return';
  date: string;
  title: string;
  subtitle: string;
  detail: string;
  href: string;
  amount?: number;
  status?: string;
  externalHref?: string;
};

// ── Status badge helpers ───────────────────────────────────────────────────────
const CLAIM_COLORS: Record<string, string> = {
  'Submitted':   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'Unsubmitted': 'bg-slate-100 text-slate-600',
  'Approved':    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  'Rejected':    'bg-red-50 text-red-700 ring-1 ring-red-200',
  'Pending':     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  'Closed':      'bg-slate-100 text-slate-600',
  'Processed':   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  'Received':    'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'N/A':         'bg-slate-100 text-slate-500',
};

const REFUND_STATUS_ICON: Record<string, React.ElementType> = {
  'Approved': CheckCircle,
  'Rejected': XCircle,
  'Pending':  Clock,
};

const EVENT_META: Record<TimelineEvent['type'], { icon: React.ElementType; label: string; color: string; badge: string }> = {
  case:   { icon: AlertTriangle, label: 'Fault Case', color: 'text-red-500', badge: 'bg-red-50 text-red-700 ring-1 ring-red-100' },
  refund: { icon: CreditCard,    label: 'Refund',     color: 'text-amber-500', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' },
  return: { icon: RotateCcw,     label: 'Return',     color: 'text-blue-500', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' },
};

function StatusBadge({ status, colors }: { status: string; colors?: Record<string, string> }) {
  const cls = (colors ?? CLAIM_COLORS)[status] ?? 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <div className="px-5 py-6 text-center text-xs text-slate-400 italic">{message}</div>;
}

function firstValue(...values: string[]) {
  return values.find(v => v && v.trim()) || '—';
}

function normalizeDate(date: string) {
  if (!date) return 0;
  const parsed = new Date(date.includes('T') ? date : `${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function eventDateLabel(date: string) {
  if (!date) return 'Unknown date';
  return formatDate(date);
}

function buildTimeline(results: OrderResults): TimelineEvent[] {
  const caseEvents: TimelineEvent[] = results.cases.map(c => ({
    id: `case-${c.id}`,
    type: 'case',
    date: c.date,
    title: 'Fault case submitted',
    subtitle: `${c.product || 'Product'}${c.faultType ? ` · ${c.faultType}` : ''}`,
    detail: c.manufacturerName ? `${c.manufacturerName} · ${c.claimStatus}` : c.claimStatus,
    href: `/cases/${c.id}`,
    amount: c.unitCostUSD,
    status: c.claimStatus,
    externalHref: c.evidenceLink,
  }));

  const refundEvents: TimelineEvent[] = results.refunds.map(r => ({
    id: `refund-${r.id}`,
    type: 'refund',
    date: r.createdAt,
    title: 'Refund request created',
    subtitle: r.reason || 'Refund request',
    detail: `${r.status}${r.submittedBy ? ` · submitted by ${r.submittedBy}` : ''}`,
    href: `/refunds?open=${r.id}`,
    amount: r.amount,
    status: r.status,
    externalHref: r.shopifyLink,
  }));

  const returnEvents: TimelineEvent[] = results.returns.map(r => ({
    id: `return-${r.id}`,
    type: 'return',
    date: r.date,
    title: r.status === 'Closed' || r.status === 'Processed' ? 'Return processed' : 'Return request logged',
    subtitle: r.followUpStatus === 'Pending' ? 'Follow-up required' : r.status || 'Return',
    detail: r.assignedTo ? `Assigned to ${r.assignedTo}` : 'Awaiting customer or office processing',
    href: `/returns/${r.id}`,
    amount: r.totalRefundAmount,
    status: r.followUpStatus === 'Pending' ? 'Follow-up Required' : r.status,
  }));

  return [...caseEvents, ...refundEvents, ...returnEvents]
    .sort((a, b) => normalizeDate(b.date) - normalizeDate(a.date));
}

function SummaryChip({ label, active, tone = 'slate' }: { label: string; active: boolean; tone?: 'slate' | 'blue' | 'amber' | 'red' | 'emerald' }) {
  if (!active) return null;
  const map = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${map[tone]}`}>{label}</span>;
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;
  return (
    <Link href={event.href} className="group grid grid-cols-[92px_1fr] gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
      <div className="text-right">
        <p className="text-xs font-medium text-slate-500">{eventDateLabel(event.date)}</p>
      </div>
      <div className="relative pl-6 border-l border-slate-200">
        <span className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center">
          <Icon size={13} className={meta.color} />
        </span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
              {event.status && <StatusBadge status={event.status} />}
            </div>
            <p className="text-sm font-semibold text-slate-900">{event.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{event.subtitle}</p>
            <p className="text-xs text-slate-400 mt-1">{event.detail}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {event.amount !== undefined && event.amount > 0 && (
              <span className="text-sm font-semibold text-slate-800">${event.amount.toFixed(2)}</span>
            )}
            {event.externalHref && (
              <a href={event.externalHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-brand-500 hover:text-brand-700">
                <ExternalLink size={13} />
              </a>
            )}
            <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OrderLookupPage() {
  const searchParams = useSearchParams();
  const [query,    setQuery]    = useState(searchParams.get('order') || '');
  const [results,  setResults]  = useState<OrderResults | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);

  async function lookup(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const q = (override ?? query).trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResults(null);
    setSearched(true);
    try {
      const res  = await fetch(`/api/orders?order=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResults(json);
      setQuery(json.orderNumber || q);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const order = searchParams.get('order');
    if (order) void lookup(undefined, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const searchHref = results ? encodeURIComponent(results.orderNumber) : '';
  const timeline = useMemo(() => results ? buildTimeline(results) : [], [results]);
  const customerName = results ? firstValue(
    results.returns[0]?.customerName,
    results.refunds[0]?.customerName,
    results.cases[0]?.customerName,
  ) : '—';
  const refundTotal = results ? results.refunds.reduce((sum, r) => sum + r.amount, 0) : 0;
  const returnTotal = results ? results.returns.reduce((sum, r) => sum + r.totalRefundAmount, 0) : 0;
  const hasFollowUp = !!results?.returns.some(r => r.followUpStatus === 'Pending');
  const hasOpenCase = !!results?.cases.some(c => !['Credit Received', 'Rejected', 'Approved'].includes(c.claimStatus));
  const hasPendingRefund = !!results?.refunds.some(r => r.status === 'Pending');
  const hasAwaitingReturn = !!results?.returns.some(r => !['Closed', 'Processed'].includes(r.status));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Order Timeline</h1>
        <p className="page-subtitle">Search an order to see cases, returns, refunds, links, and customer-care history in one place</p>
      </div>

      <form onSubmit={lookup} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Enter order number e.g. 406849AU"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()} className="btn-primary disabled:opacity-50">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {loading && (
        <div className="card p-8 flex items-center justify-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Building order timeline...</span>
        </div>
      )}

      {!loading && error && (
        <div className="card p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Search failed</p>
            <p className="text-xs text-slate-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && searched && results?.total === 0 && (
        <div className="card p-10 text-center">
          <Package size={28} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">No portal records found</p>
          <p className="text-xs text-slate-400 mt-1">No cases, refunds, or returns match order <span className="font-mono font-semibold">#{results.orderNumber}</span></p>
        </div>
      )}

      {!loading && results && results.total > 0 && (
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 font-mono">{results.orderNumber}</h2>
                <p className="text-sm text-slate-500 mt-1">{customerName}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <SummaryChip label="Awaiting Customer" active={hasAwaitingReturn} tone="blue" />
                <SummaryChip label="Follow-up Required" active={hasFollowUp} tone="amber" />
                <SummaryChip label="Refund Pending" active={hasPendingRefund} tone="amber" />
                <SummaryChip label="Fault Case Open" active={hasOpenCase} tone="red" />
                <SummaryChip label="All Closed" active={!hasAwaitingReturn && !hasFollowUp && !hasPendingRefund && !hasOpenCase} tone="emerald" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
              <div><p className="text-xs text-slate-400">Records</p><p className="text-lg font-bold text-slate-900">{results.total}</p></div>
              <div><p className="text-xs text-slate-400">Fault Cases</p><p className="text-lg font-bold text-slate-900">{results.cases.length}</p></div>
              <div><p className="text-xs text-slate-400">Refund Requests</p><p className="text-lg font-bold text-slate-900">${refundTotal.toFixed(2)}</p></div>
              <div><p className="text-xs text-slate-400">Return Refunds</p><p className="text-lg font-bold text-slate-900">${returnTotal.toFixed(2)}</p></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/returns?order=${searchHref}`} className="btn-secondary text-sm"><RotateCcw size={14} /> Log Return Request</Link>
            <Link href="/returns/new" className="btn-secondary text-sm"><PlusCircle size={14} /> Process Office Return</Link>
            <Link href={`/refunds?new=1&order=${searchHref}`} className="btn-secondary text-sm"><CreditCard size={14} /> Request Refund</Link>
            <Link href={`/cases/new?order=${searchHref}`} className="btn-secondary text-sm"><AlertTriangle size={14} /> Submit Fault Case</Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Timeline</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {timeline.map(event => <TimelineItem key={event.id} event={event} />)}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">Related Records</div>
                <div className="divide-y divide-slate-50">
                  <Link href={`/cases?search=${searchHref}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-sm"><span>Fault Cases</span><span className="font-semibold text-slate-700">{results.cases.length}</span></Link>
                  <Link href={`/returns?search=${searchHref}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-sm"><span>Returns</span><span className="font-semibold text-slate-700">{results.returns.length}</span></Link>
                  <Link href={`/refunds?search=${searchHref}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-sm"><span>Refunds</span><span className="font-semibold text-slate-700">{results.refunds.length}</span></Link>
                </div>
              </div>

              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Latest Activity</p>
                {timeline[0] ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{timeline[0].title}</p>
                    <p className="text-xs text-slate-500 mt-1">{eventDateLabel(timeline[0].date)}</p>
                  </>
                ) : <p className="text-sm text-slate-400">No activity</p>}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center pb-2"><FileText size={11} className="inline mr-1" />Click any timeline event to open the source record.</p>
        </div>
      )}
    </div>
  );
}
