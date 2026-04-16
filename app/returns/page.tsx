'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, RefreshCw, RotateCcw, ChevronRight, Mail } from 'lucide-react';
import { Return, ReturnCondition, ReturnDecision, ReturnStatus, FollowUpStatus } from '@/types';

function conditionBadge(c: ReturnCondition) {
  const map: Record<ReturnCondition, string> = {
    'Sealed':                 'bg-blue-100 text-blue-700',
    'Open - Good Condition':  'bg-emerald-100 text-emerald-700',
    'Open - Damaged Packaging':'bg-amber-100 text-amber-700',
    'Faulty':                 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[c]}`}>{c}</span>;
}

function decisionBadge(d: ReturnDecision) {
  const map: Record<ReturnDecision, string> = {
    'Full Refund':             'bg-emerald-100 text-emerald-700',
    'Exchange':                'bg-blue-100 text-blue-700',
    'Refund + Restocking Fee': 'bg-amber-100 text-amber-700',
    'Refund - Return Label Fee':'bg-orange-100 text-orange-700',
    'Replacement':             'bg-purple-100 text-purple-700',
    'Pending':                 'bg-slate-100 text-slate-600',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[d]}`}>{d}</span>;
}

function followUpBadge(f: FollowUpStatus) {
  const map: Record<FollowUpStatus, string> = {
    'N/A':       'bg-slate-100 text-slate-500',
    'Pending':   'bg-amber-100 text-amber-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[f]}`}>{f}</span>;
}

function statusBadge(s: ReturnStatus) {
  const map: Record<ReturnStatus, string> = {
    'Received':  'bg-blue-100 text-blue-700',
    'Inspected': 'bg-amber-100 text-amber-700',
    'Processed': 'bg-emerald-100 text-emerald-700',
    'Closed':    'bg-slate-100 text-slate-500',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[s]}`}>{s}</span>;
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ReturnStatus | 'follow-up'>('all');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/returns');
    const json = await res.json();
    setReturns((json.data || []).slice().reverse());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = returns.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'follow-up') return r.followUpStatus === 'Pending';
    return r.status === filter;
  });

  const counts = {
    all: returns.length,
    Received:  returns.filter(r => r.status === 'Received').length,
    Processed: returns.filter(r => r.status === 'Processed').length,
    'follow-up': returns.filter(r => r.followUpStatus === 'Pending').length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Returns</h1>
          <p className="page-subtitle">Track and manage customer returns</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <Link href="/returns/new" className="btn-primary flex items-center gap-2">
            <PlusCircle size={16} /> Log Return
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: 'all',       label: 'All' },
          { key: 'Received',  label: 'Received' },
          { key: 'Processed', label: 'Processed' },
          { key: 'follow-up', label: 'Needs Follow-up' },
        ] as { key: typeof filter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              filter === key ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {counts[key as keyof typeof counts] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <RotateCcw size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No returns yet</p>
          <p className="text-slate-400 text-sm mt-1">Log your first return to get started</p>
          <Link href="/returns/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <PlusCircle size={15} /> Log Return
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date / Order</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Condition</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Decision</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Follow-up</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.date}</p>
                    <p className="text-xs text-slate-400 font-mono">{r.orderNumber}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.customerName}</p>
                    {r.customerEmail && (
                      <a href={`mailto:${r.customerEmail}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                        <Mail size={10} />{r.customerEmail}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.product}</td>
                  <td className="px-4 py-3">{conditionBadge(r.condition)}</td>
                  <td className="px-4 py-3">
                    {decisionBadge(r.decision)}
                    {r.restockingFee > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">{r.restockingFee}% fee</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3">
                    {followUpBadge(r.followUpStatus)}
                    {r.assignedTo && <p className="text-xs text-slate-400 mt-0.5">{r.assignedTo}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/returns/${r.id}`} className="text-slate-400 hover:text-brand-600 transition-colors">
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
