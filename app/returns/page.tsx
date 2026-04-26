'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { PlusCircle, RefreshCw, RotateCcw, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Mail, Search, Copy, Check } from 'lucide-react';
import { Return, ReturnCondition, ReturnDecision, ReturnStatus, FollowUpStatus } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

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

// ── Age helpers ───────────────────────────────────────────────────────────────
function daysSince(dateStr: string): number {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function FollowUpAgePill({ date }: { date: string }) {
  const days = daysSince(date);
  if (days < 3) return null;
  const cls = days >= 7
    ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${cls}`}>
      {days}d pending
    </span>
  );
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
type ReturnSortKey = 'date' | 'customerName' | 'totalRefundAmount' | 'status';
type SortDir = 'asc' | 'desc';

export default function ReturnsPage() {
  const [allReturns, setAllReturns] = useState<Return[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterTab>('all');
  const [weekStart, setWeekStart]   = useState<Date>(() => getMondayOf(new Date()));
  const [teamSearch, setTeamSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sortKey, setSortKey]       = useState<ReturnSortKey>('date');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [copiedId, setCopiedId]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/returns');
    const json = await res.json();
    setAllReturns(json.data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: ReturnStatus) {
    setUpdatingId(id);
    setAllReturns(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdatingId(null);
  }

  async function updateFollowUp(id: string, newFollowUp: FollowUpStatus) {
    setUpdatingId(id);
    setAllReturns(prev => prev.map(r => r.id === id ? { ...r, followUpStatus: newFollowUp } : r));
    await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpStatus: newFollowUp }),
    });
    setUpdatingId(null);
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

  function handleSort(key: ReturnSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: ReturnSortKey }) {
    if (sortKey !== col) return <ChevronDown size={12} className="text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-brand-600" />
      : <ChevronDown size={12} className="text-brand-600" />;
  }

  function copyOrder(e: React.MouseEvent, id: string, value: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const displayed = useMemo(() => {
    let base: Return[];
    if (filter === 'follow-up') base = pendingFollowUp;
    else {
      const filtered = teamFiltered(weekReturns);
      base = filter === 'all' ? filtered : filtered.filter(r => r.status === filter);
    }
    return [...base].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'date')             { av = a.date; bv = b.date; }
      else if (sortKey === 'customerName') { av = a.customerName.toLowerCase(); bv = b.customerName.toLowerCase(); }
      else if (sortKey === 'totalRefundAmount') { av = a.totalRefundAmount; bv = b.totalRefundAmount; }
      else if (sortKey === 'status')      { av = a.status; bv = b.status; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filter, weekReturns, teamSearch, allReturns, sortKey, sortDir]);

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
        <TableSkeleton rows={6} cols={6} />
      ) : displayed.length === 0 ? (
        <div className="card overflow-clip">
          {filter === 'follow-up' ? (
            <EmptyState
              icon={RotateCcw}
              title="No pending follow-ups"
              description="All follow-ups are resolved — nice work!"
            />
          ) : filter !== 'all' ? (
            <EmptyState
              icon={RotateCcw}
              title={`No ${filter.toLowerCase()} returns this week`}
              description="No returns match this status for the selected week."
              action={{ label: 'View all returns', onClick: () => setFilter('all') }}
            />
          ) : (
            <EmptyState
              icon={RotateCcw}
              title={`No returns for ${weekLabel(weekStart).toLowerCase()}`}
              description={isThisWeek ? 'Log a return to get started.' : 'No returns were logged for this week.'}
              action={isThisWeek ? { label: 'Log Return', href: '/returns/new' } : undefined}
            />
          )}
        </div>
      ) : (
        <div className="card overflow-clip">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                {([
                  { key: 'date' as ReturnSortKey,             label: 'Date / Order' },
                  { key: 'customerName' as ReturnSortKey,     label: 'Customer'     },
                ] as { key: ReturnSortKey; label: string }[]).map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key} /></div>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Condition</th>
                <th onClick={() => handleSort('totalRefundAmount')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1">Decision<SortIcon col="totalRefundAmount" /></div>
                </th>
                <th onClick={() => handleSort('status')}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1">Status<SortIcon col="status" /></div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Follow-up</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, idx) => (
                <tr key={r.id} className={`transition-colors group border-b border-slate-100 last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-[#e0f4fa]`}>
                  <td className="px-4 py-3">
                    <p className="font-medium font-mono text-slate-800">{r.date}</p>
                    <span className="group/copy inline-flex items-center gap-1">
                      <span className="text-xs text-slate-400 font-mono">{r.orderNumber}</span>
                      <button
                        onClick={e => copyOrder(e, r.id, r.orderNumber)}
                        title="Copy order number"
                        className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-slate-400 hover:text-brand-600 p-0.5 rounded">
                        {copiedId === r.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    </span>
                    {r.followUpStatus === 'Pending' && <FollowUpAgePill date={r.date} />}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.customerName}</p>
                    {r.customerEmail && (
                      <a href={`mailto:${r.customerEmail}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                        <Mail size={10} />{r.customerEmail}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700 font-medium text-sm">{r.items[0]?.product || '—'}</p>
                    {r.items.length > 1 && (
                      <p className="text-xs text-slate-400">+{r.items.length - 1} more item{r.items.length > 2 ? 's' : ''}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.items[0] && conditionBadge(r.items[0].condition)}
                    {r.items.length > 1 && <p className="text-xs text-slate-400 mt-0.5">mixed</p>}
                  </td>
                  <td className="px-4 py-3">
                    {r.items[0] && decisionBadge(r.items[0].decision)}
                    {r.items.length > 1 && <p className="text-xs text-slate-400 mt-0.5">mixed</p>}
                    {r.totalRefundAmount > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">${r.totalRefundAmount.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      value={r.status}
                      disabled={updatingId === r.id}
                      onChange={e => updateStatus(r.id, e.target.value as ReturnStatus)}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none focus:ring-2 focus:ring-brand-400 focus:outline-none transition-opacity ${updatingId === r.id ? 'opacity-50' : ''} ${
                        r.status === 'Received'  ? 'bg-blue-100 text-blue-700' :
                        r.status === 'Inspected' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'Processed' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <option value="Received">Received</option>
                      <option value="Inspected">Inspected</option>
                      <option value="Processed">Processed</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      value={r.followUpStatus}
                      disabled={updatingId === r.id}
                      onChange={e => updateFollowUp(r.id, e.target.value as FollowUpStatus)}
                      className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none focus:ring-2 focus:ring-brand-400 focus:outline-none transition-opacity ${updatingId === r.id ? 'opacity-50' : ''} ${
                        r.followUpStatus === 'Pending'   ? 'bg-amber-100 text-amber-700' :
                        r.followUpStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <option value="N/A">N/A</option>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
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
