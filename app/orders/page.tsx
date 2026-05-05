'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, AlertTriangle, CreditCard, RotateCcw,
  Package, ExternalLink, ChevronRight, CheckCircle,
  Clock, XCircle, FileText,
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

// ── Status badge helpers ───────────────────────────────────────────────────────
const CLAIM_COLORS: Record<string, string> = {
  'Submitted':   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'Unsubmitted': 'bg-slate-100 text-slate-600',
  'Approved':    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  'Rejected':    'bg-red-50 text-red-700 ring-1 ring-red-200',
  'Pending':     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

const REFUND_STATUS_ICON: Record<string, React.ElementType> = {
  'Approved': CheckCircle,
  'Rejected': XCircle,
  'Pending':  Clock,
};

function StatusBadge({ status, colors }: { status: string; colors?: Record<string, string> }) {
  const cls = (colors ?? CLAIM_COLORS)[status] ?? 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, label, count, color, href,
}: {
  icon: React.ElementType; label: string; count: number;
  color: string; href: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <Icon size={15} className={color} />
        <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
        <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      {count > 0 && (
        <Link href={href} className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1">
          View all <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-6 text-center text-xs text-slate-400 italic">{message}</div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OrderLookupPage() {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<OrderResults | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
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
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const searchHref = results
    ? encodeURIComponent(results.orderNumber)
    : '';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Order Lookup</h1>
        <p className="page-subtitle">Find all portal records for an order number — cases, refunds, and returns in one place</p>
      </div>

      {/* Search bar */}
      <form onSubmit={lookup} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Enter order number e.g. 1234 or #1234"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="card p-8 flex items-center justify-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Searching cases, refunds, and returns…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Search failed</p>
            <p className="text-xs text-slate-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && !error && searched && results?.total === 0 && (
        <div className="card p-10 text-center">
          <Package size={28} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">No portal records found</p>
          <p className="text-xs text-slate-400 mt-1">
            No cases, refunds, or returns match order <span className="font-mono font-semibold">#{results.orderNumber}</span>
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results && results.total > 0 && (
        <div className="space-y-4">

          {/* Summary strip */}
          <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 border border-brand-100 rounded-xl">
            <Search size={14} className="text-brand-500 flex-shrink-0" />
            <p className="text-sm text-brand-800">
              Found <span className="font-bold">{results.total} record{results.total !== 1 ? 's' : ''}</span> for order{' '}
              <span className="font-mono font-semibold">#{results.orderNumber}</span>
            </p>
          </div>

          {/* Cases */}
          <div className="card overflow-hidden">
            <SectionHeader
              icon={AlertTriangle} label="Fault Cases" count={results.cases.length}
              color="text-red-500" href={`/cases?search=${searchHref}`}
            />
            {results.cases.length === 0 ? (
              <EmptyRow message="No fault cases for this order" />
            ) : (
              <div className="divide-y divide-slate-50">
                {results.cases.map(c => (
                  <Link key={c.id} href={`/cases/${c.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-800">{c.customerName || '—'}</span>
                        <StatusBadge status={c.claimStatus} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {c.product}{c.faultType ? ` · ${c.faultType}` : ''}{c.manufacturerName ? ` · ${c.manufacturerName}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(c.unitCostUSD)}</p>
                      <p className="text-xs text-slate-400">{formatDate(c.date)}</p>
                    </div>
                    {c.evidenceLink && (
                      <a href={c.evidenceLink} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-brand-500 hover:text-brand-700 flex-shrink-0">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Refunds */}
          <div className="card overflow-hidden">
            <SectionHeader
              icon={CreditCard} label="Refund Requests" count={results.refunds.length}
              color="text-amber-500" href={`/refunds?search=${searchHref}`}
            />
            {results.refunds.length === 0 ? (
              <EmptyRow message="No refund requests for this order" />
            ) : (
              <div className="divide-y divide-slate-50">
                {results.refunds.map(r => {
                  const Icon = REFUND_STATUS_ICON[r.status] ?? Clock;
                  const statusCls =
                    r.status === 'Approved' ? 'text-emerald-500' :
                    r.status === 'Rejected' ? 'text-red-400' : 'text-amber-500';
                  return (
                    <Link key={r.id} href={`/refunds?open=${r.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                      <Icon size={16} className={`flex-shrink-0 ${statusCls}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-slate-800">{r.customerName || '—'}</span>
                          <StatusBadge status={r.status} colors={{
                            'Approved': 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
                            'Rejected': 'bg-red-50 text-red-700 ring-1 ring-red-200',
                            'Pending':  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
                          }} />
                        </div>
                        <p className="text-xs text-slate-500 truncate">{r.reason}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">${r.amount.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {r.shopifyLink && (
                        <a href={r.shopifyLink} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-brand-500 hover:text-brand-700 flex-shrink-0">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Returns */}
          <div className="card overflow-hidden">
            <SectionHeader
              icon={RotateCcw} label="Returns" count={results.returns.length}
              color="text-blue-500" href={`/returns?search=${searchHref}`}
            />
            {results.returns.length === 0 ? (
              <EmptyRow message="No returns for this order" />
            ) : (
              <div className="divide-y divide-slate-50">
                {results.returns.map(r => (
                  <Link key={r.id} href={`/returns/${r.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-800">{r.customerName || '—'}</span>
                        {r.status && <StatusBadge status={r.status} colors={{
                          'Pending':   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
                          'Approved':  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
                          'Rejected':  'bg-red-50 text-red-700 ring-1 ring-red-200',
                          'Completed': 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
                        }} />}
                        {r.followUpStatus === 'Pending' && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Follow-up needed</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.assignedTo ? `Assigned to ${r.assignedTo}` : 'Unassigned'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {r.totalRefundAmount > 0 && (
                        <p className="text-sm font-semibold text-slate-800">${r.totalRefundAmount.toFixed(2)}</p>
                      )}
                      <p className="text-xs text-slate-400">{formatDate(r.date)}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tip */}
          <p className="text-xs text-slate-400 text-center pb-2">
            <FileText size={11} className="inline mr-1" />
            Click any record to open it, or use "View all" to see the full filtered list
          </p>

        </div>
      )}
    </div>
  );
}
