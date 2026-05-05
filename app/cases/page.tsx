'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Filter, Plus, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, CheckSquare, Square, X, RefreshCw,
  Copy, Check, User, ChevronRight as ChevronRightSm,
} from 'lucide-react';
import { FaultCase, ClaimStatus } from '@/types';
import { formatCurrency, formatDate, CLAIM_STATUSES, truncate, faultTypeBadge, STATUS_STYLES } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/auth/AuthProvider';

const PAGE_SIZE = 20;
type SortKey = keyof FaultCase;
type SortDir = 'asc' | 'desc';

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

export default function CasesPage() {
  const { user } = useAuth();

  // Data state
  const [cases, setCases]         = useState<FaultCase[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Filters
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter]           = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
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

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 300);
  }

  // Load manufacturers once on mount
  useEffect(() => {
    fetch('/api/manufacturers')
      .then(r => r.json())
      .then(json => {
        const names: string[] = (json.data ?? []).map((m: { name: string }) => m.name).sort();
        setManufacturers(names);
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
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, statusFilter, manufacturerFilter, fromDate, toDate, mineOnly, user?.name, sortKey, sortDir, page]);

  useEffect(() => { load(); }, [load]);

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
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
    setManufacturerFilter('');
    setFromDate('');
    setToDate('');
    setMineOnly(false);
    setPage(1);
  }

  function applyDatePreset(preset: 'today' | 'week' | 'month' | '30days') {
    const today = isoToday();
    if (preset === 'today')  { setFromDate(today);        setToDate(today);  }
    if (preset === 'week')   { setFromDate(isoMonday());  setToDate(today);  }
    if (preset === 'month')  { setFromDate(today.slice(0, 8) + '01'); setToDate(today); }
    if (preset === '30days') { setFromDate(isoNDaysAgo(30)); setToDate(today); }
    setPage(1);
    if (!showFilters) setShowFilters(true);
  }

  const isFiltered = !!(search || statusFilter || manufacturerFilter || fromDate || toDate || mineOnly);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (search)              params.set('search', search);
    if (statusFilter)        params.set('status', statusFilter);
    if (manufacturerFilter)  params.set('manufacturer', manufacturerFilter);
    if (fromDate)            params.set('from', fromDate);
    if (toDate)              params.set('to', toDate);
    if (mineOnly && user?.name) params.set('submittedBy', user.name);
    params.set('sortKey', sortKey as string);
    params.set('sortDir', sortDir);
    params.set('limit', '9999');

    const json = await fetch(`/api/cases?${params}`).then(r => r.json());
    const allFiltered: FaultCase[] = json.data ?? [];

    const headers = ['ID','Date','Order #','Customer','Product','Manufacturer','Fault Type','Status','Cost','Evidence Link'];
    const rows = allFiltered.map(c => [
      c.id, c.date, c.orderNumber, c.customerName, c.product,
      c.manufacturerName, c.faultType, c.claimStatus, c.unitCostUSD,
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
              placeholder="Search by order number, customer, product…"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              className="form-input pl-9"
            />
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
            {(statusFilter || manufacturerFilter || fromDate || toDate) && (
              <span className="w-2 h-2 bg-brand-600 rounded-full" />
            )}
          </button>
        </div>
        {showFilters && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Quick:</span>
              {([
                { label: 'Today',      key: 'today'  as const },
                { label: 'This Week',  key: 'week'   as const },
                { label: 'This Month', key: 'month'  as const },
                { label: 'Last 30d',   key: '30days' as const },
              ]).map(p => {
                const isActive =
                  p.key === 'today'  ? fromDate === isoToday() && toDate === isoToday() :
                  p.key === 'week'   ? fromDate === isoMonday() && toDate === isoToday() :
                  p.key === 'month'  ? fromDate === isoToday().slice(0, 8) + '01' && toDate === isoToday() :
                  p.key === '30days' ? fromDate === isoNDaysAgo(30) && toDate === isoToday() : false;
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
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}
                  className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-red-500 transition-colors">
                  Clear dates
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="form-label text-xs">Status</label>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="form-input text-xs">
                  <option value="">All Statuses</option>
                  {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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
                  cases.map(c => (
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
                      <td className="text-slate-500 text-sm" title={c.product}>{truncate(c.product, 22)}</td>
                      <td>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${faultTypeBadge(c.faultType)}`}>
                          {c.faultType}
                        </span>
                        {c.faultType === 'Other' && c.faultNotes && (
                          <p className="text-xs text-slate-400 mt-1 max-w-[160px] truncate" title={c.faultNotes}>
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
    </div>
  );
}
