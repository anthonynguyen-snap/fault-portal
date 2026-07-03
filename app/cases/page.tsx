'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Filter, Plus, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, CheckSquare, Square, X, RefreshCw,
  Copy, Check, User, ChevronRight as ChevronRightSm,
  BarChart3, Trophy, TrendingDown, TrendingUp,
} from 'lucide-react';
import { FaultCase, ClaimStatus } from '@/types';
import { formatCurrency, formatDate, CLAIM_STATUSES, truncate, faultTypeBadge, STATUS_STYLES } from '@/lib/utils';
import { FAULT_PARENT_TYPES, getFaultSubtypes } from '@/lib/fault-taxonomy';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/auth/AuthProvider';

const PAGE_SIZE = 20;
const CASES_VIEW_STORAGE_KEY = 'fault-portal:cases-view';
type SortKey = keyof FaultCase;
type SortDir = 'asc' | 'desc';
type FaultMetric = { name: string; count: number; cost: number };
type FaultInsights = {
  currentMonth: string;
  thisMonthTotal: number;
  previousMonthTotal: number;
  thisMonthRanking: FaultMetric[];
  allTimeRanking: FaultMetric[];
  monthlyLeaders: Array<{ month: string; total: number; leader: FaultMetric | null }>;
};

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().slice(0, 10); }
function isoNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}
function isoLastMonthRange(): { from: string; to: string } {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const to   = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// ── Inline status change ──────────────────────────────────────────────────────
function InlineStatusBadge({
  caseId,
  status,
  onChanged,
}: {
  caseId: string;
  status: ClaimStatus;
  onChanged: (id: string, newStatus: ClaimStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function pick(newStatus: ClaimStatus) {
    if (newStatus === status) { setOpen(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimStatus: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      onChanged(caseId, newStatus);
    } catch { /* toast handled upstream */ }
    finally { setSaving(false); setOpen(false); }
  }

  const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600';

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className={`badge ${style} hover:brightness-95 transition-all cursor-pointer flex items-center gap-1`}
      >
        {saving
          ? <RefreshCw size={10} className="animate-spin" />
          : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />}
        {status}
        <ChevronRightSm size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden py-1">
          {CLAIM_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => pick(s)}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                s === status
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_STYLES[s]?.includes('emerald') ? 'bg-emerald-500' : STATUS_STYLES[s]?.includes('amber') ? 'bg-amber-500' : STATUS_STYLES[s]?.includes('blue') ? 'bg-blue-500' : STATUS_STYLES[s]?.includes('red') ? 'bg-red-500' : STATUS_STYLES[s]?.includes('sky') ? 'bg-sky-500' : 'bg-slate-400'}`} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Fault Type multi-select checkbox dropdown
function FaultTypeMultiSelect({
  options,
  selected,
  onChange,
  emptyLabel = 'All Fault Types',
  pluralLabel = 'fault types',
}: {
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  emptyLabel?: string;
  pluralLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(val: string) {
    onChange(
      selected.includes(val)
        ? selected.filter(s => s !== val)
        : [...selected, val]
    );
  }

  const label =
    selected.length === 0 ? emptyLabel :
    selected.length === 1 ? selected[0] :
    selected.length + ` ${pluralLabel}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`form-input text-xs w-full flex items-center justify-between gap-1 text-left ${selected.length > 0 ? 'border-brand-400 bg-brand-50 text-brand-700' : 'text-slate-500'}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="flex-shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
          {selected.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{selected.length} selected</span>
              <button onClick={() => onChange([])} className="text-xs text-red-500 hover:text-red-600 font-medium">Clear all</button>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 rounded border-slate-300 accent-[#1591b3] flex-shrink-0"
                />
                <span className={`text-xs truncate ${selected.includes(opt) ? 'text-brand-700 font-medium' : 'text-slate-700'}`}>
                  {opt}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fault Summary Strip ─────────────────────────────────────────────────────
function FaultSummaryStrip({
  total, byFaultType, byMonth, otherNotes, search, activeFaultTypes, onFaultTypeClick, onMonthClick,
}: {
  total: number;
  byFaultType: Record<string, number>;
  byMonth: Record<string, number>;
  otherNotes: Record<string, number>;
  search: string;
  activeFaultTypes: string[];
  onFaultTypeClick: (ft: string) => void;
  onMonthClick: (from: string, to: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const sortedFaults = Object.entries(byFaultType).sort((a, b) => b[1] - a[1]);
  const sortedMonths = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const sortedNotes  = Object.entries(otherNotes).sort((a, b) => b[1] - a[1]);
  const showNotes = activeFaultTypes.includes('Other') && sortedNotes.length > 0;

  function fmtMonth(ym: string) {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString('en-AU', { month: 'short', year: '2-digit' });
  }

  function lastDayOfMonth(ym: string) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).toISOString().slice(0, 10);
  }

  function copyText() {
    const label = search ? `"${search}"` : 'this filter';
    const faultLines = sortedFaults.map(([ft, n]) => `  • ${ft || '(Blank)'}: ${n}`).join('\n');
    const monthLines = sortedMonths.map(([ym, n]) => `  • ${fmtMonth(ym)}: ${n}`).join('\n');
    const noteLines = sortedNotes.map(([note, n]) => `  • ${note}: ${n}`).join('\n');
    const noteSection = sortedNotes.length > 0 ? `\n\nOther — Fault Notes:\n${noteLines}` : '';
    navigator.clipboard.writeText(
      `Fault Summary for ${label}\nTotal: ${total} fault${total !== 1 ? 's' : ''}\n\nBy Fault Type:\n${faultLines}\n\nBy Month:\n${monthLines}${noteSection}`
    ).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="card px-4 py-4 space-y-3">
      {/* Fault type row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By Fault Type</span>
          <span className="text-xs font-bold text-slate-800">{total} total</span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          {sortedFaults.map(([ft, n]) => {
            const active = activeFaultTypes.includes(ft);
            return (
              <button
                key={ft || '__blank__'}
                type="button"
                onClick={() => ft && onFaultTypeClick(ft)}
                disabled={!ft}
                title={ft ? (active ? `Remove "${ft}" filter` : `Filter by "${ft}"`) : 'Cannot filter blank fault type'}
                className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 transition-colors ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : ft
                      ? 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-default'
                }`}
              >
                <span className="font-medium">{ft || '(Blank)'}</span>
                <span className={`font-bold rounded-full px-1.5 py-0.5 text-[11px] leading-none ${active ? 'bg-brand-500 text-white' : 'bg-white text-slate-900'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Other fault notes row */}
      {showNotes && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0 pt-1">"Other" Notes</span>
          <div className="flex flex-wrap gap-2 flex-1">
            {sortedNotes.map(([note, n]) => (
              <span key={note} className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 rounded-full px-2.5 py-1">
                <span className="font-medium">{note}</span>
                {n > 1 && <span className="font-bold text-amber-900 bg-white rounded-full px-1.5 py-0.5 text-[11px] leading-none">{n}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Monthly row */}
      {sortedMonths.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">By Month</span>
          <div className="flex flex-wrap gap-2 flex-1">
            {sortedMonths.map(([ym, n]) => (
              <button
                key={ym}
                type="button"
                onClick={() => onMonthClick(`${ym}-01`, lastDayOfMonth(ym))}
                title={`Filter to ${fmtMonth(ym)}`}
                className="inline-flex items-center gap-1.5 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-full px-2.5 py-1 transition-colors cursor-pointer"
              >
                <span className="font-medium">{fmtMonth(ym)}</span>
                <span className="font-bold text-sky-900 bg-white rounded-full px-1.5 py-0.5 text-[11px] leading-none">{n}</span>
              </button>
            ))}
          </div>
          <button
            onClick={copyText}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 flex-shrink-0"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy summary'}
          </button>
        </div>
      )}
    </div>
  );
}

function FaultInsightsPanel({
  insights,
  onFaultTypeClick,
}: {
  insights: FaultInsights;
  onFaultTypeClick: (faultType: string) => void;
}) {
  const [range, setRange] = useState<'month' | 'all'>('month');
  const [metric, setMetric] = useState<'count' | 'cost'>('count');
  const ranking = range === 'month' ? insights.thisMonthRanking : insights.allTimeRanking;
  const ranked = [...ranking]
    .sort((a, b) => metric === 'count' ? b.count - a.count : b.cost - a.cost)
    .slice(0, 5);
  const topValue = ranked[0]?.[metric] ?? 0;
  const leader = ranked[0];
  const totalForRange = range === 'month'
    ? insights.thisMonthTotal
    : insights.allTimeRanking.reduce((sum, item) => sum + item.count, 0);
  const change = insights.previousMonthTotal > 0
    ? Math.round(((insights.thisMonthTotal - insights.previousMonthTotal) / insights.previousMonthTotal) * 100)
    : null;

  function formatMonth(month: string, long = false) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-AU', {
      month: long ? 'long' : 'short', year: 'numeric',
    });
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="fault-insights-title">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <BarChart3 size={18} />
          </span>
          <div>
            <h2 id="fault-insights-title" className="text-sm font-semibold text-slate-900">Fault Insights</h2>
            <p className="text-xs text-slate-500">What customers are reporting most often</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" aria-label="Analysis period">
            {([['month', 'This month'], ['all', 'All time']] as const).map(([value, label]) => (
              <button key={value} onClick={() => setRange(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${range === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" aria-label="Ranking metric">
            {([['count', 'Cases'], ['cost', 'Cost']] as const).map(([value, label]) => (
              <button key={value} onClick={() => setMetric(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${metric === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Biggest fault · {range === 'month' ? formatMonth(insights.currentMonth, true) : 'All time'}</p>
              {leader ? (
                <button onClick={() => onFaultTypeClick(leader.name)} className="mt-1 text-left group">
                  <span className="text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">{leader.name}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {metric === 'count' ? `${leader.count} cases` : formatCurrency(leader.cost)}
                  </span>
                </button>
              ) : <p className="mt-1 text-sm text-slate-500">No faults recorded this month</p>}
            </div>
            {leader && <Trophy size={20} className="text-amber-500 flex-shrink-0" />}
          </div>

          <div className="space-y-3">
            {ranked.map((item, index) => {
              const value = item[metric];
              const share = totalForRange > 0 ? Math.round((item.count / totalForRange) * 100) : 0;
              return (
                <button key={item.name} onClick={() => onFaultTypeClick(item.name)}
                  className="w-full text-left group" title={`Filter cases to ${item.name}`}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="w-4 text-xs font-semibold text-slate-400">{index + 1}</span>
                    <span className="text-sm text-slate-700 group-hover:text-brand-700 truncate flex-1">{item.name}</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {metric === 'count' ? item.count : formatCurrency(item.cost)}
                    </span>
                    <span className="w-9 text-right text-[11px] text-slate-400">{share}%</span>
                  </div>
                  <div className="ml-7 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${topValue ? Math.max(5, (value / topValue) * 100) : 0}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          {range === 'month' && change !== null && (
            <div className={`mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs ${change > 0 ? 'text-amber-700' : change < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {change > 0 ? <TrendingUp size={14} /> : change < 0 ? <TrendingDown size={14} /> : null}
              <span className="font-medium">{Math.abs(change)}% {change > 0 ? 'more' : change < 0 ? 'fewer' : 'change'} faults than last month</span>
              <span className="text-slate-400">({insights.thisMonthTotal} vs {insights.previousMonthTotal})</span>
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase mb-3">Monthly leaders</h3>
          <div className="divide-y divide-slate-100">
            {insights.monthlyLeaders.map(({ month, total, leader: monthLeader }) => (
              <div key={month} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500">{formatMonth(month)}</span>
                  <span className="text-[11px] text-slate-400">{total} total</span>
                </div>
                {monthLeader && (
                  <button onClick={() => onFaultTypeClick(monthLeader.name)} className="mt-1 flex items-center justify-between gap-3 w-full text-left group">
                    <span className="text-sm text-slate-800 group-hover:text-brand-700 truncate">{monthLeader.name}</span>
                    <span className="text-xs font-semibold text-slate-600 flex-shrink-0">{monthLeader.count}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function CasesPage() {
  const { user } = useAuth();

  // Data state
  const [cases, setCases]         = useState<FaultCase[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [faultSummary, setFaultSummary] = useState<Record<string, number>>({});
  const [monthSummary, setMonthSummary] = useState<Record<string, number>>({});
  const [otherNotes, setOtherNotes]     = useState<Record<string, number>>({});
  const [faultInsights, setFaultInsights] = useState<FaultInsights | null>(null);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [nonClaimableProducts, setNonClaimableProducts] = useState<Set<string>>(new Set());
  const [claimableOnly, setClaimableOnly] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Filters
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter]           = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [faultTypeFilter, setFaultTypeFilter]       = useState<string[]>([]);
  const [faultSubtypeFilter, setFaultSubtypeFilter] = useState<string[]>([]);
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
  const [mineOnly, setMineOnly]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortKey, setSortKey]     = useState<SortKey>('createdAt');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');

  // Pagination
  const [page, setPage]           = useState(1);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState<ClaimStatus | ''>('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError]   = useState('');
  const { success, error: toastError } = useToast();
  const [noteTooltip, setNoteTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [viewRestored, setViewRestored] = useState(false);

  // Restore the cases view after returning from a case. sessionStorage keeps it
  // scoped to this browser tab and lets "Clear all" remain the explicit reset.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CASES_VIEW_STORAGE_KEY);
      if (saved) {
        const view = JSON.parse(saved);
        setSearch(typeof view.search === 'string' ? view.search : '');
        setSearchInput(typeof view.search === 'string' ? view.search : '');
        setStatusFilter(typeof view.statusFilter === 'string' ? view.statusFilter : '');
        setManufacturerFilter(typeof view.manufacturerFilter === 'string' ? view.manufacturerFilter : '');
        setFaultTypeFilter(Array.isArray(view.faultTypeFilter) ? view.faultTypeFilter : []);
        setFaultSubtypeFilter(Array.isArray(view.faultSubtypeFilter) ? view.faultSubtypeFilter : []);
        setFromDate(typeof view.fromDate === 'string' ? view.fromDate : '');
        setToDate(typeof view.toDate === 'string' ? view.toDate : '');
        setMineOnly(view.mineOnly === true);
        setClaimableOnly(view.claimableOnly === true);
        setShowFilters(view.showFilters === true);
        setSortKey(typeof view.sortKey === 'string' ? view.sortKey as SortKey : 'createdAt');
        setSortDir(view.sortDir === 'asc' ? 'asc' : 'desc');
        setPage(Number.isInteger(view.page) && view.page > 0 ? view.page : 1);
      }
    } catch {
      sessionStorage.removeItem(CASES_VIEW_STORAGE_KEY);
    } finally {
      setViewRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!viewRestored) return;
    sessionStorage.setItem(CASES_VIEW_STORAGE_KEY, JSON.stringify({
      search, statusFilter, manufacturerFilter, faultTypeFilter, faultSubtypeFilter,
      fromDate, toDate, mineOnly, claimableOnly, showFilters,
      sortKey, sortDir, page,
    }));
  }, [viewRestored, search, statusFilter, manufacturerFilter, faultTypeFilter, faultSubtypeFilter, fromDate, toDate, mineOnly, claimableOnly, showFilters, sortKey, sortDir, page]);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 300);
  }

  // Load editable supporting data once on mount. Fault types come from the
  // canonical V10 taxonomy so legacy configuration cannot leak into filters.
  useEffect(() => {
    fetch('/api/manufacturers')
      .then(r => r.json())
      .then(json => {
        const names: string[] = (json.data ?? []).map((m: { name: string }) => m.name).sort();
        setManufacturers(names);
      })
      .catch(() => {});
    fetch('/api/products')
      .then(r => r.json())
      .then(json => {
        const nonClaimable = new Set<string>(
          (json.data ?? []).filter((p: { name: string; claimable: boolean }) => p.claimable === false).map((p: { name: string }) => p.name.toLowerCase().trim())
        );
        setNonClaimableProducts(nonClaimable);
      })
      .catch(() => {});
  }, []);

  // Main fetch
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search)              params.set('search', search);
    if (statusFilter)        params.set('status', statusFilter);
    if (manufacturerFilter)  params.set('manufacturer', manufacturerFilter);
    faultTypeFilter.forEach(ft => params.append('faultType', ft));
    faultSubtypeFilter.forEach(st => params.append('faultSubtype', st));
    if (fromDate)            params.set('from', fromDate);
    if (toDate)              params.set('to', toDate);
    if (mineOnly && user?.name) params.set('submittedBy', user.name);
    params.set('sortKey', sortKey as string);
    params.set('sortDir', sortDir);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));

    fetch(`/api/cases?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setCases(json.data || []);
        setTotal(json.total ?? json.data?.length ?? 0);
        setTotalPages(json.pages ?? 1);
        setFaultSummary(json.byFaultType ?? {});
        setMonthSummary(json.byMonth ?? {});
        setOtherNotes(json.otherNotes ?? {});
        setFaultInsights(json.insights ?? null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, statusFilter, manufacturerFilter, faultTypeFilter, faultSubtypeFilter, fromDate, toDate, mineOnly, user?.name, sortKey, sortDir, page]);

  useEffect(() => {
    if (viewRestored) load();
  }, [load, viewRestored]);

  // Inline status update — optimistic
  function handleInlineStatusChange(id: string, newStatus: ClaimStatus) {
    setCases(prev => prev.map(c => c.id === id ? { ...c, claimStatus: newStatus } : c));
    success('Status updated', `Case set to "${newStatus}"`);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown size={13} className="text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-brand-600" />
      : <ChevronDown size={13} className="text-brand-600" />;
  }

  function CopyOrderNumber({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    function copy(e: React.MouseEvent) {
      e.stopPropagation();
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    return (
      <span className="group/copy inline-flex items-center gap-1">
        <span className="font-semibold font-mono text-brand-600">{value}</span>
        <button onClick={copy} title="Copy order number"
          className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-slate-400 hover:text-brand-600 p-0.5 rounded">
          {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
        </button>
      </span>
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === cases.length && cases.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cases.map(c => c.id)));
    }
  }

  async function applyBatchStatus() {
    if (!batchStatus || selectedIds.size === 0) return;
    setBatchLoading(true);
    setBatchError('');
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map(id =>
          fetch(`/api/cases/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimStatus: batchStatus }),
          }).then(r => { if (!r.ok) throw new Error(`Failed for ${id}`); })
        )
      );
      load();
      success(`${ids.length} case${ids.length !== 1 ? 's' : ''} updated`, `Status set to "${batchStatus}"`);
      setSelectedIds(new Set());
      setBatchStatus('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setBatchError(msg);
      toastError('Batch update failed', msg);
    } finally {
      setBatchLoading(false);
    }
  }

  function clearFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    sessionStorage.removeItem(CASES_VIEW_STORAGE_KEY);
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setManufacturerFilter('');
    setFaultTypeFilter([]);
    setFaultSubtypeFilter([]);
    setFromDate('');
    setToDate('');
    setMineOnly(false);
    setClaimableOnly(false);
    setPage(1);
  }

  const displayedCases = claimableOnly
    ? cases.filter(c => !nonClaimableProducts.has(c.product.toLowerCase().trim()))
    : cases;

  function applyDatePreset(preset: 'today' | 'week' | 'month' | 'lastMonth' | '30days') {
    const today = isoToday();
    if (preset === 'today')     { setFromDate(today);        setToDate(today);  }
    if (preset === 'week')      { setFromDate(isoMonday());  setToDate(today);  }
    if (preset === 'month')     { setFromDate(today.slice(0, 8) + '01'); setToDate(today); }
    if (preset === 'lastMonth') { const r = isoLastMonthRange(); setFromDate(r.from); setToDate(r.to); }
    if (preset === '30days')    { setFromDate(isoNDaysAgo(30)); setToDate(today); }
    setPage(1);
    if (!showFilters) setShowFilters(true);
  }

  const availableFaultSubtypes = Array.from(new Set(faultTypeFilter.flatMap(type => [...getFaultSubtypes(type)])));
  const isFiltered = !!(search || statusFilter || manufacturerFilter || faultTypeFilter.length || faultSubtypeFilter.length || fromDate || toDate || mineOnly || claimableOnly);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (search)              params.set('search', search);
    if (statusFilter)        params.set('status', statusFilter);
    if (manufacturerFilter)  params.set('manufacturer', manufacturerFilter);
    faultTypeFilter.forEach(ft => params.append('faultType', ft));
    faultSubtypeFilter.forEach(st => params.append('faultSubtype', st));
    if (fromDate)            params.set('from', fromDate);
    if (toDate)              params.set('to', toDate);
    if (mineOnly && user?.name) params.set('submittedBy', user.name);
    params.set('sortKey', sortKey as string);
    params.set('sortDir', sortDir);
    params.set('limit', '9999');

    const json = await fetch(`/api/cases?${params}`).then(r => r.json());
    const allFiltered: FaultCase[] = claimableOnly
      ? (json.data ?? []).filter((c: FaultCase) => !nonClaimableProducts.has(c.product.toLowerCase().trim()))
      : (json.data ?? []);

    const headers = ['ID','Date','Order #','Customer','Product','Manufacturer','Manufacturer Number','Fault Type','Fault Subtype','Taxonomy Status','Original Fault Type','Fault Notes','Status','Evidence Link'];
    const rows = allFiltered.map(c => [
      c.id, c.date, c.orderNumber, c.customerName, c.product,
      c.manufacturerName, c.manufacturerNumber || '', c.faultType, c.faultSubtype || '', c.taxonomyStatus || '', c.originalFaultType || '', c.faultNotes || '', c.claimStatus,
      c.evidenceLink,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fault-cases-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success('Export ready', `${allFiltered.length} cases exported to CSV`);
  }

  const allPageSelected = cases.length > 0 && cases.every(c => selectedIds.has(c.id));
  const startRow = (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, (page - 1) * PAGE_SIZE + cases.length);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Cases</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${total} case${total !== 1 ? 's' : ''}${isFiltered ? ' (filtered)' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="btn-secondary">
            <Download size={14} /> Export CSV
          </button>
          <Link href="/cases/new" className="btn-primary">
            <Plus size={15} /> Submit Fault
          </Link>
        </div>
      </div>

      {!loading && faultInsights && (
        <FaultInsightsPanel
          insights={faultInsights}
          onFaultTypeClick={faultType => {
            if (faultType !== 'Not specified') setFaultTypeFilter([faultType]);
            setPage(1);
          }}
        />
      )}

      {/* Fault Summary Strip */}
      {isFiltered && !loading && total > 0 && Object.keys(faultSummary).length > 0 && (
        <FaultSummaryStrip
          total={total}
          byFaultType={faultSummary}
          byMonth={monthSummary}
          otherNotes={otherNotes}
          search={search}
          activeFaultTypes={faultTypeFilter}
          onFaultTypeClick={ft => {
            setFaultTypeFilter(prev => prev.includes(ft) ? prev.filter(f => f !== ft) : [...prev, ft]);
            setPage(1);
          }}
          onMonthClick={(from, to) => { setFromDate(from); setToDate(to); setPage(1); }}
        />
      )}

      {/* Batch Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="card p-3 bg-brand-50 border border-brand-200 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-brand-800">
            {selectedIds.size} case{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={batchStatus}
              onChange={e => setBatchStatus(e.target.value as ClaimStatus | '')}
              className="form-input text-sm py-1.5 w-44"
            >
              <option value="">Change status to…</option>
              {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={applyBatchStatus}
              disabled={!batchStatus || batchLoading}
              className="btn-primary py-1.5 px-3 text-sm disabled:opacity-50"
            >
              {batchLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckSquare size={14} />}
              Apply to {selectedIds.size}
            </button>
          </div>
          {batchError && <p className="text-xs text-red-600">{batchError}</p>}
          <button onClick={() => setSelectedIds(new Set())} className="btn-ghost p-1.5 ml-auto">
            <X size={15} className="text-slate-500" />
          </button>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order number, customer, product, fault type or notes…"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              className={`form-input pl-9 ${isFiltered ? 'pr-20' : ''}`}
            />
            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                aria-label="Clear all search terms and filters"
              >
                Clear all
              </button>
            )}
          </div>
          <button
            onClick={() => { setMineOnly(v => !v); setPage(1); }}
            className={`btn-secondary gap-2 flex-shrink-0 ${mineOnly ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
          >
            <User size={14} /> Mine
            {mineOnly && <span className="w-2 h-2 bg-brand-600 rounded-full" />}
          </button>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary gap-2 flex-shrink-0 ${showFilters ? 'bg-slate-100 border-slate-300' : ''}`}
          >
            <Filter size={14} /> Filters
            {(statusFilter || manufacturerFilter || faultTypeFilter.length > 0 || fromDate || toDate) && (
              <span className="w-2 h-2 bg-brand-600 rounded-full" />
            )}
          </button>
        </div>
        {showFilters && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Date:</span>
              {([
                { label: 'Today',      key: 'today'     as const },
                { label: 'This Week',  key: 'week'      as const },
                { label: 'This Month', key: 'month'     as const },
                { label: 'Last Month', key: 'lastMonth' as const },
                { label: 'Last 30d',   key: '30days'    as const },
              ]).map(p => {
                const lm = isoLastMonthRange();
                const isActive =
                  p.key === 'today'     ? fromDate === isoToday() && toDate === isoToday() :
                  p.key === 'week'      ? fromDate === isoMonday() && toDate === isoToday() :
                  p.key === 'month'     ? fromDate === isoToday().slice(0, 8) + '01' && toDate === isoToday() :
                  p.key === 'lastMonth' ? fromDate === lm.from && toDate === lm.to :
                  p.key === '30days'    ? fromDate === isoNDaysAgo(30) && toDate === isoToday() : false;
                return (
                  <button key={p.key} onClick={() => applyDatePreset(p.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                    }`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            {manufacturers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Manufacturer:</span>
                {manufacturers.map(m => (
                  <button key={m} onClick={() => { setManufacturerFilter(manufacturerFilter === m ? '' : m); setPage(1); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      manufacturerFilter === m
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {(fromDate || toDate) && (
              <div className="flex items-center">
                <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
                  className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-red-500 transition-colors">
                  Clear dates
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Claims:</span>
              <button onClick={() => { setClaimableOnly(!claimableOnly); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  claimableOnly
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                }`}>
                Claimable only
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="form-label text-xs">Status</label>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="form-input text-xs">
                  <option value="">All Statuses</option>
                  {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label text-xs">Fault Type</label>
                <FaultTypeMultiSelect
                  options={[...FAULT_PARENT_TYPES]}
                  selected={faultTypeFilter}
                  onChange={vals => {
                    setFaultTypeFilter(vals);
                    const validSubtypes = new Set(vals.flatMap(type => [...getFaultSubtypes(type)]));
                    setFaultSubtypeFilter(current => current.filter(subtype => validSubtypes.has(subtype)));
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <label className="form-label text-xs">Fault Subtype</label>
                <FaultTypeMultiSelect
                  options={availableFaultSubtypes}
                  selected={faultSubtypeFilter}
                  onChange={vals => { setFaultSubtypeFilter(vals); setPage(1); }}
                  emptyLabel={faultTypeFilter.length ? 'All Subtypes' : 'Select fault type first'}
                  pluralLabel="subtypes"
                />
              </div>
              <div>
                <label className="form-label text-xs">Manufacturer</label>
                <select value={manufacturerFilter} onChange={e => { setManufacturerFilter(e.target.value); setPage(1); }} className="form-input text-xs">
                  <option value="">All Manufacturers</option>
                  {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label text-xs">From Date</label>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="form-input text-xs" />
              </div>
              <div>
                <label className="form-label text-xs">To Date</label>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} className="form-input text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={10} cols={8} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {allPageSelected
                        ? <CheckSquare size={16} className="text-brand-600" />
                        : <Square size={16} className="text-slate-300" />}
                    </button>
                  </th>
                  {[
                    { key: 'date' as SortKey,         label: 'Date'      },
                    { key: 'orderNumber' as SortKey,  label: 'Order #'   },
                    { key: 'customerName' as SortKey, label: 'Customer'  },
                    { key: 'product' as SortKey,      label: 'Product'   },
                    { key: 'faultType' as SortKey,    label: 'Fault Type'},
                    { key: 'claimStatus' as SortKey,  label: 'Status'    },
                    { key: 'unitCostUSD' as SortKey,  label: 'Cost', num: true },
                  ].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={`cursor-pointer select-none hover:bg-slate-100 transition-colors ${'num' in col && col.num ? 'num' : ''}`}>
                      <div className={`flex items-center gap-1 ${'num' in col && col.num ? 'justify-end' : ''}`}>{col.label}<SortIcon col={col.key} /></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {isFiltered ? (
                        <EmptyState
                          icon={AlertTriangle}
                          title="No matching cases"
                          description="No cases match your current filters. Try broadening your criteria."
                          action={{ label: 'Clear filters', onClick: clearFilters }}
                        />
                      ) : (
                        <EmptyState
                          icon={AlertTriangle}
                          title="No cases yet"
                          description="Submit your first fault case to get started."
                          action={{ label: 'Submit Fault', href: '/cases/new' }}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedCases.map(c => (
                    <tr key={c.id}
                      className={`cursor-pointer ${selectedIds.has(c.id) ? 'bg-brand-50' : ''}`}
                      onClick={() => window.location.href = `/cases/${c.id}`}>
                      <td onClick={e => { e.stopPropagation(); toggleSelect(c.id); }} className="text-center">
                        {selectedIds.has(c.id)
                          ? <CheckSquare size={16} className="text-brand-600 mx-auto" />
                          : <Square size={16} className="text-slate-300 mx-auto" />}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500 font-mono">{formatDate(c.date)}</td>
                      <td><CopyOrderNumber value={c.orderNumber} /></td>
                      <td className="font-medium" title={c.customerName}>{truncate(c.customerName, 22)}</td>
                      <td title={c.product}><span className="text-slate-700 text-sm">{truncate(c.product, 24)}</span>{c.manufacturerNumber && (<p className="text-[11px] text-slate-400 mt-0.5 font-mono">{c.manufacturerNumber}</p>)}</td>
                      <td
                        onMouseEnter={c.faultNotes ? e => { const r = (e.currentTarget as HTMLTableCellElement).getBoundingClientRect(); setNoteTooltip({ text: c.faultNotes!, x: r.left, y: r.top - 8 }); } : undefined}
                        onMouseLeave={() => setNoteTooltip(null)}
                      >
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${faultTypeBadge(c.faultType)}`}>
                          {c.faultType}
                        </span>
                        {c.faultSubtype && (
                          <p className="text-[11px] font-medium text-brand-600 mt-1">{c.faultSubtype}</p>
                        )}
                        {c.taxonomyStatus === 'Historical — migrated' && (
                          <p className="text-[10px] font-medium text-amber-600 mt-1">Historical</p>
                        )}
                        {c.faultNotes && (
                          <p className="text-xs text-slate-400 mt-1 max-w-[160px] truncate">
                            {c.faultNotes}
                          </p>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <InlineStatusBadge
                          caseId={c.id}
                          status={c.claimStatus}
                          onChanged={handleInlineStatusChange}
                        />
                      </td>
                      <td className="num font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(c.unitCostUSD)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Showing {startRow}–{endRow} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="btn-ghost p-1.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = Math.max(1, page - 2) + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${page === p ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}
      {noteTooltip && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ top: noteTooltip.y, left: noteTooltip.x, transform: "translateY(-100%)" }}
        >
          <div className="bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-[280px] whitespace-normal leading-relaxed mb-1.5">
            {noteTooltip.text}
          </div>
        </div>
      )}
    </div>
  );
}
