'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Plus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { FaultCase, ClaimStatus } from '@/types';
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT, CLAIM_STATUSES, truncate } from '@/lib/utils';

const PAGE_SIZE = 20;

type SortKey = keyof FaultCase;
type SortDir = 'asc' | 'desc';

export default function CasesPage() {
  const [cases, setCases] = useState<FaultCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/api/cases')
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setCases(json.data || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Unique manufacturers for filter dropdown
  const manufacturers = useMemo(() => {
    const set = new Set(cases.map(c => c.manufacturerName).filter(Boolean));
    return Array.from(set).sort();
  }, [cases]);

  // Filtered & sorted cases
  const filtered = useMemo(() => {
    let result = [...cases];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.orderNumber.toLowerCase().includes(q)     ||
        c.customerName.toLowerCase().includes(q)    ||
        c.product.toLowerCase().includes(q)         ||
        c.manufacturerName.toLowerCase().includes(q)||
        c.faultType.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter(c => c.claimStatus === statusFilter);
    }

    if (manufacturerFilter) {
      result = result.filter(c => c.manufacturerName === manufacturerFilter);
    }

    if (fromDate) {
      result = result.filter(c => c.date >= fromDate);
    }

    if (toDate) {
      result = result.filter(c => c.date <= toDate);
    }

    // Sort
    result.sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return result;
  }, [cases, search, statusFilter, manufacturerFilter, fromDate, toDate, sortKey, sortDir]);

  // Paginated
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown size={13} className="text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-brand-600" />
      : <ChevronDown size={13} className="text-brand-600" />;
  }

  function exportCsv() {
    const headers = ['ID','Date','Order #','Customer','Product','Manufacturer','Fault Type','Status','Cost USD','Evidence'];
    const rows = filtered.map(c => [
      c.id, c.date, c.orderNumber, c.customerName, c.product,
      c.manufacturerName, c.faultType, c.claimStatus,
      c.unitCostUSD, c.evidenceLink,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fault-cases-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">All Cases</h1>
          <p className="page-subtitle">
            {filtered.length} case{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== cases.length ? ` (filtered from ${cases.length})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="btn-secondary">
            <Download size={14} />
            Export CSV
          </button>
          <Link href="/cases/new" className="btn-primary">
            <Plus size={15} />
            Submit Fault
          </Link>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order number, customer, product, manufacturer…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="form-input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn-secondary gap-2 ${showFilters ? 'bg-slate-100 border-slate-300' : ''}`}
          >
            <Filter size={14} />
            Filters
            {(statusFilter || manufacturerFilter || fromDate || toDate) && (
              <span className="w-2 h-2 bg-brand-600 rounded-full" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="form-label text-xs">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-input text-xs"
              >
                <option value="">All Statuses</option>
                {CLAIM_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Manufacturer</label>
              <select
                value={manufacturerFilter}
                onChange={e => { setManufacturerFilter(e.target.value); setPage(1); }}
                className="form-input text-xs"
              >
                <option value="">All Manufacturers</option>
                {manufacturers.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => { setFromDate(e.target.value); setPage(1); }}
                className="form-input text-xs"
              />
            </div>
            <div>
              <label className="form-label text-xs">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => { setToDate(e.target.value); setPage(1); }}
                className="form-input text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  { key: 'date' as SortKey,         label: 'Date'         },
                  { key: 'orderNumber' as SortKey,  label: 'Order #'      },
                  { key: 'customerName' as SortKey, label: 'Customer'     },
                  { key: 'product' as SortKey,      label: 'Product'      },
                  { key: 'manufacturerName' as SortKey, label: 'Manufacturer' },
                  { key: 'faultType' as SortKey,    label: 'Fault Type'   },
                  { key: 'claimStatus' as SortKey,  label: 'Status'       },
                  { key: 'unitCostUSD' as SortKey,  label: 'Cost'         },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </div>
                  </th>
                ))}
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    {cases.length === 0 ? 'No cases submitted yet.' : 'No cases match your filters.'}
                  </td>
                </tr>
              ) : (
                paginated.map(c => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => window.location.href = `/cases/${c.id}`}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(c.date)}</td>
                    <td>
                      <span className="font-semibold text-brand-600 hover:underline">{c.orderNumber}</span>
                    </td>
                    <td className="font-medium">{truncate(c.customerName, 24)}</td>
                    <td className="text-slate-500">{truncate(c.product, 24)}</td>
                    <td className="text-slate-500">{truncate(c.manufacturerName, 20)}</td>
                    <td>
                      <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {c.faultType}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_STYLES[c.claimStatus]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                        {c.claimStatus}
                      </span>
                    </td>
                    <td className="font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(c.unitCostUSD)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {c.evidenceLink ? (
                        <a
                          href={c.evidenceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                        >
                          View <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
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
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost p-1.5 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = Math.max(1, page - 2) + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${
                      page === p
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-1.5 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
