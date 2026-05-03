'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Filter, Plus, ExternalLink, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, CheckSquare, Square, X, RefreshCw, Pencil,
  Copy, Check,
} from 'lucide-react';
import { FaultCase, ClaimStatus } from '@/types';
import { formatCurrency, formatDate, CLAIM_STATUSES, truncate, faultTypeBadge } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

const PAGE_SIZE = 20;
type SortKey = keyof FaultCase;
type SortDir = 'asc' | 'desc';

export default function CasesPage() {
  // Data state
  const [cases, setCases]         = useState<FaultCase[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Filters
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState(''); // debounced from this
  const [statusFilter, setStatusFilter]           = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');
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
      .catch(() => {/* silently ignore */});
  }, []);

  // Main fetch — refires whenever filters/sort/page change
  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search)              params.set('search', search);
    if (statusFilter)        params.set('status', statusFilter);
    if (manufacturerFilter)  params.set('manufacturer', manufacturerFilter);
    if (fromDate)            params.set('from', fromDate);
    if (toDate)              params.set('to', toDate);
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
  }, [search, statusFilter, manufacturerFilter, fromDate, toDate, sortKey, sortDir, page]);

  useEffect(() => { load(); }, [load]);

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
      // Reload page to reflect updated statuses
      load();
      success(`${ids.length} case${ids.length !== 1 ? 's' : ''} updated`, `Status set to "${batchStatus}"`);
      setSelectedIds(new Set());
      setBatchStatus('');
    } catch (err: any) {
      setBatchError(err.message);
      toastError('Batch update failed', err.message);
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
    setPage(1);
  }

  const isFiltered = !!(search || statusFilter || manufacturerFilter || fromDate || toDate);

  async function exportCsv() {
    // Fetch all matching records without pagination
    const params = new URLSearchParams();
    if (search)              params.set('search', search);
    if (statusFilter)        params.set('status', statusFilter);
    if (manufacturerFilter)  params.set('manufacturer', manufacturerFilter);
    if (fromDate)            params.set('from', fromDate);
    if (toDate)              params.set('to', toDate);
    params.set('sortKey', sortKey as string);
    params.set('sortDir', sortDir);
    params.set('limit', '9999');

    const json = await fetch(`/api/cases?${params}`).then(r => r.json());
    const allFiltered: FaultCase[] = json.data ?? [];

    const headers = ['ID','Date','Order #','Customer','Product','Manufacturer','Fault Type','Manufacturer Number','Evidence Link'];
    const rows = allFiltered.map(c => [
      c.id, c.date, c.orderNumber, c.customerName, c.product,
      c.manufacturerName, c.faultType, c.manufacturerNumber,
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
              Apply
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
              placeholder="Search by order number, customer, product, manufacturer…"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              className="form-input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary gap-2 ${showFilters ? 'bg-slate-100 border-slate-300' : ''}`}
          >
            <Filter size={14} /> Filters
            {(statusFilter || manufacturerFilter || fromDate || toDate) && (
              <span className="w-2 h-2 bg-brand-600 rounded-full" />
            )}
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
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
                    { key: 'date' as SortKey,             label: 'Date'         },
                    { key: 'orderNumber' as SortKey,      label: 'Order #'      },
                    { key: 'customerName' as SortKey,     label: 'Customer'     },
                    { key: 'product' as SortKey,          label: 'Product'      },
                    { key: 'manufacturerName' as SortKey, label: 'Manufacturer' },
                    { key: 'faultType' as SortKey,        label: 'Fault Type'   },
                    { key: 'submittedBy' as SortKey,      label: 'Submitted By' },
                    { key: 'unitCostUSD' as SortKey,      label: 'Cost', num: true },
                  ].map(col => (
                    <th key={col.key} onClick={() => handleSort(col.key)}
                      className={`cursor-pointer select-none hover:bg-slate-100 transition-colors ${'num' in col && col.num ? 'num' : ''}`}>
                      <div className={`flex items-center gap-1 ${'num' in col && col.num ? 'justify-end' : ''}`}>{col.label}<SortIcon col={col.key} /></div>
                    </th>
                  ))}
                  <th>Evidence</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
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
                      <td className="font-medium" title={c.customerName}>{truncate(c.customerName, 24)}</td>
                      <td className="text-slate-500" title={c.product}>{truncate(c.product, 24)}</td>
                      <td className="text-slate-500" title={c.manufacturerName}>{truncate(c.manufacturerName, 20)}</td>
                      <td>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${faultTypeBadge(c.faultType)}`}>
                          {c.faultType}
                        </span>
                        {c.faultType === 'Other' && c.faultNotes && (
                          <p className="text-xs text-slate-400 mt-1 max-w-[180px] truncate" title={c.faultNotes}>
                            {c.faultNotes}
                          </p>
                        )}
                      </td>
                      <td className="text-sm text-slate-600">
                        {c.submittedBy || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="num font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(c.unitCostUSD)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {c.evidenceLink ? (
                          <a href={c.evidenceLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                            View <ExternalLink size={11} />
                          </a>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <Link
                          href={`/cases/${c.id}`}
                          className="btn-ghost p-1.5 text-slate-400 hover:text-brand-600"
                          title="Edit case"
                        >
                          <Pencil size={13} />
                        </Link>
                      </td>
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
