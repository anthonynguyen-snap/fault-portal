'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PlusCircle, RefreshCw, RotateCcw, ChevronRight, ChevronLeft, Mail, Search } from 'lucide-react';
import { Return, ReturnCondition, ReturnDecision, ReturnStatus, FollowUpStatus } from '@/types';

// ── Week helpers ──────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function weekLabel(mon: Date): string {
  const sun = addDays(mon, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const isThisWeek = fmtDate(mon) === fmtDate(getMondayOf(new Date()));
  if (isThisWeek) return 'This Week';
  return `${mon.toLocaleDateString('en-AU', opts)} – ${sun.toLocaleDateString('en-AU', opts)}`;
}

// ── Badges ───────────────────────────────────────────────────────────────────
function conditionBadge(c: ReturnCondition) {
  const map: Record<ReturnCondition, string> = {
    'Sealed':                  'bg-blue-100 text-blue-700',
    'Open - Good Condition':   'bg-emerald-100 text-emerald-700',
    'Open - Damaged Packaging':'bg-amber-100 text-amber-700',
    'Faulty':                  'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[c]}`}>{c}</span>;
}
function decisionBadge(d: ReturnDecision) {
  const map: Record<ReturnDecision, string> = {
    'Full Refund':              'bg-emerald-100 text-emerald-700',
    'Exchange':                 'bg-blue-100 text-blue-700',
    'Refund + Restocking Fee':  'bg-amber-100 text-amber-700',
    'Refund - Return Label Fee':'bg-orange-100 text-orange-700',
    'Replacement':              'bg-purple-100 text-purple-700',
    'Pending':                  'bg-slate-100 text-slate-600',
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

// ── Page ─────────────────────────────────────────────────────────────────────
type FilterTab = 'all' | ReturnStatus | 'follow-up';

export default function ReturnsPage() {
  const [allReturns, setAllReturns] = useState<Return[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterTab>('all');
  const [weekStart, setWeekStart]   = useState<Date>(() => getMondayOf(new Date()));
  const [teamSearch, setTeamSearch] = useState('');

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/returns');
    const json = await res.json();
    setAllReturns(json.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const weekEnd = addDays(weekStart, 6);
  const isThisWeek = fmtDate(weekStart) === fmtDate(getMondayOf(new Date()));

  // "Needs Follow-up" is always global (ignores week); everything else is week-scoped
  const weekReturns = useMemo(() =>
    allReturns.filter(r => r.date >= fmtDate(weekStart) && r.date <= fmtDate(weekEnd)),
    [allReturns, weekStart]
  );

  const teamFiltered = (list: Return[]) =>
    teamSearch.trim()
      ? list.filter(r => r.assignedTo.toLowerCase().includes(teamSearch.toLowerCase()))
      : list;

  const pendingFollowUp = teamFiltered(allReturns).filter(r => r.followUpStatus === 'Pending');

  const displayed = useMemo(() => {
    if (filter === 'follow-up') return pendingFollowUp;
    const base = teamFiltered(weekReturns);
    if (filter === 'all') return base;
    return base.filter(r => r.status === filter);
  }, [filter, weekReturns, teamSearch, allReturns]);

  const counts = {
    all:        teamFiltered(weekReturns).length,
    Processed:  teamFiltered(weekReturns).filter(r => r.status === 'Processed').length,
    Received:   teamFiltered(weekReturns).filter(r => r.status === 'Received').length,
    'follow-up': pendingFollowUp.length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
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

      {/* Week navigator + team search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Week nav */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1 shadow-sm">
          <button onClick={() => setWeekStart(d => addDays(d, -7))}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-slate-700 px-2 min-w-[120px] text-center">
            {weekLabel(weekStart)}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))}
            disabled={isThisWeek}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Team member search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={teamSearch}
            onChange={e => setTeamSearch(e.target.value)}
            placeholder="Filter by team member…"
            className="form-input pl-8 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: 'all',       label: 'This Week' },
          { key: 'Processed', label: 'Processed' },
          { key: 'Received',  label: 'Received'  },
          { key: 'follow-up', label: 'Needs Follow-up' },
        ] as { key: FilterTab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
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
      ) : displayed.length === 0 ? (
        <div className="card p-12 text-center">
          <RotateCcw size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {filter === 'follow-up' ? 'No pending follow-ups' : `No returns for ${weekLabel(weekStart).toLowerCase()}`}
          </p>
          {isThisWeek && filter !== 'follow-up' && (
            <Link href="/returns/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <PlusCircle size={15} /> Log Return
            </Link>
          )}
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
              {displayed.map(r => (
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
                    {r.refundAmount > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">${r.refundAmount.toFixed(2)}</p>
                    )}
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
