'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Download, Printer, Eye, EyeOff, ExternalLink,
  CheckCircle, Loader2, AlertTriangle, FileText, Filter,
} from 'lucide-react';
import { FaultCase } from '@/types';
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { StatCardsSkeleton } from '@/components/ui/Skeleton';

const COLORS = ['#1591b3','#2ab0d9','#94D8EE','#059669','#d97706','#dc2626'];

function ProductFilterPopover({
  manufacturer,
  products,
  excluded,
  onToggle,
  onClear,
}: {
  manufacturer: string;
  products: string[];
  excluded: string[];
  onToggle: (product: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const excludedCount = excluded.length;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        title={excludedCount > 0 ? `${excludedCount} product${excludedCount !== 1 ? 's' : ''} excluded` : 'Filter products from this claim'}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
          excludedCount > 0
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
        }`}
      >
        <Filter size={11} />
        {excludedCount > 0 ? `${excludedCount} excluded` : 'Filter products'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Exclude from claim</span>
            {excludedCount > 0 && (
              <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {products.length === 0 ? (
              <p className="text-xs text-slate-400 px-3 py-3 text-center">No products found</p>
            ) : products.map(product => {
              const isExcluded = excluded.includes(product);
              return (
                <label key={product} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isExcluded}
                    onChange={() => onToggle(product)}
                    className="w-3.5 h-3.5 rounded border-slate-300 accent-brand-600"
                  />
                  <span className={`text-xs leading-snug ${isExcluded ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {product}
                  </span>
                </label>
              );
            })}
          </div>
          {excludedCount > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-amber-50">
              <p className="text-[10px] text-amber-600">
                {excludedCount} product{excludedCount !== 1 ? 's' : ''} excluded from this manufacturer's claim
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [cases, setCases] = useState<FaultCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportType, setReportType] = useState<'internal' | 'external'>('internal');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [claimMonth, setClaimMonth] = useState('');
  const [rowStates, setRowStates] = useState<Record<string, 'idle' | 'generating' | 'done' | 'error'>>({});
  const [rowResults, setRowResults] = useState<Record<string, { id: string; count: number } | string>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Per-manufacturer product exclusion lists, persisted to localStorage
  const [excludedProducts, setExcludedProducts] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem('reportProductExclusions');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem('reportProductExclusions', JSON.stringify(excludedProducts)); } catch {}
  }, [excludedProducts]);

  function toggleProductExclusion(manufacturer: string, product: string) {
    setExcludedProducts(prev => {
      const current = prev[manufacturer] ?? [];
      const next = current.includes(product)
        ? current.filter(p => p !== product)
        : [...current, product];
      return { ...prev, [manufacturer]: next };
    });
  }

  function clearExclusions(manufacturer: string) {
    setExcludedProducts(prev => ({ ...prev, [manufacturer]: [] }));
  }

  // Last 13 months for the claim month dropdown
  const months = useMemo(() => {
    const result: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
      result.push({ value, label });
    }
    return result;
  }, []);

  async function loadCases() {
    setLoading(true);
    setError('');
    try {
      const json = await fetch('/api/cases').then(r => r.json());
      if (json.error) throw new Error(json.error);
      setCases(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCases(); }, []);

  // Auto-set date range when claim month is selected
  useEffect(() => {
    if (!claimMonth) return;
    const [year, month] = claimMonth.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    setFromDate(first.toISOString().slice(0, 10));
    setToDate(last.toISOString().slice(0, 10));
  }, [claimMonth]);

  // Reset row states when month changes
  useEffect(() => {
    setRowStates({});
    setRowResults({});
  }, [claimMonth]);

  const manufacturers = useMemo(() => {
    const set = new Set(cases.map(c => c.manufacturerName).filter(Boolean));
    return Array.from(set).sort();
  }, [cases]);

  const filteredCases = useMemo(() => {
    let result = [...cases];
    if (selectedManufacturer) {
      result = result.filter(c => c.manufacturerName === selectedManufacturer);
      const excluded = excludedProducts[selectedManufacturer] ?? [];
      if (excluded.length > 0) result = result.filter(c => !excluded.includes(c.product));
    } else {
      result = result.filter(c => {
        const excluded = excludedProducts[c.manufacturerName] ?? [];
        return !excluded.includes(c.product);
      });
    }
    if (fromDate) result = result.filter(c => c.date >= fromDate);
    if (toDate)   result = result.filter(c => c.date <= toDate);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [cases, selectedManufacturer, fromDate, toDate, excludedProducts]);

  // All cases in the selected month (regardless of manufacturer filter) for the claim summary
  const allMonthCases = useMemo(() => {
    if (!claimMonth || !fromDate || !toDate) return [];
    return cases.filter(c => c.date >= fromDate && c.date <= toDate);
  }, [cases, claimMonth, fromDate, toDate]);

  // All products per manufacturer (before exclusions, so the popover shows everything)
  const manufacturerProducts = useMemo(() => {
    const byMfr: Record<string, Set<string>> = {};
    for (const c of allMonthCases) {
      if (c.claimStatus !== 'Unsubmitted') continue;
      if (!c.manufacturerName || !c.product) continue;
      if (!byMfr[c.manufacturerName]) byMfr[c.manufacturerName] = new Set();
      byMfr[c.manufacturerName].add(c.product);
    }
    return Object.fromEntries(
      Object.entries(byMfr).map(([mfr, products]) => [mfr, Array.from(products).sort()])
    );
  }, [allMonthCases]);

  // Per-manufacturer summary of unsubmitted faults for the selected month (respects exclusions)
  const manufacturerSummary = useMemo(() => {
    const byMfr: Record<string, FaultCase[]> = {};
    for (const c of allMonthCases) {
      if (c.claimStatus !== 'Unsubmitted') continue;
      if (!c.manufacturerName) continue;
      const excluded = excludedProducts[c.manufacturerName] ?? [];
      if (excluded.includes(c.product)) continue;
      if (!byMfr[c.manufacturerName]) byMfr[c.manufacturerName] = [];
      byMfr[c.manufacturerName].push(c);
    }
    return Object.entries(byMfr)
      .map(([manufacturer, mfrCases]) => ({ manufacturer, cases: mfrCases, count: mfrCases.length }))
      .sort((a, b) => b.count - a.count);
  }, [allMonthCases, excludedProducts]);

  const stats = useMemo(() => {
    const totalCost = filteredCases.reduce((s, c) => s + c.unitCostUSD, 0);
    const byFaultType: Record<string, number> = {};
    const byProduct: Record<string, { count: number; cost: number }> = {};
    for (const c of filteredCases) {
      byFaultType[c.faultType] = (byFaultType[c.faultType] || 0) + 1;
      if (!byProduct[c.product]) byProduct[c.product] = { count: 0, cost: 0 };
      byProduct[c.product].count += 1;
      byProduct[c.product].cost += c.unitCostUSD;
    }
    return {
      totalCases: filteredCases.length,
      totalCost,
      faultTypeChart: Object.entries(byFaultType)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      productTable: Object.entries(byProduct)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count),
    };
  }, [filteredCases]);

  function handlePrint() { window.print(); }

  function exportCsv() {
    const isInternal = reportType === 'internal';
    const headers = isInternal
      ? ['Date','Order #','Customer','Product','Manufacturer','Fault Type','Notes','Manufacturer Number','Evidence Link']
      : ['Date','Order #','Product','Manufacturer','Fault Type','Notes','Manufacturer Number','Evidence Link'];
    const rows = filteredCases.map(c => isInternal
      ? [c.date, c.orderNumber, c.customerName, c.product, c.manufacturerName, c.faultType, c.faultNotes, c.manufacturerNumber, c.evidenceLink || '']
      : [c.date, c.orderNumber, c.product, c.manufacturerName, c.faultType, c.faultNotes, c.manufacturerNumber, c.evidenceLink || '']
    );
    const title = selectedManufacturer ? `${selectedManufacturer} Fault Report` : 'Fault Report';
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleGenerateForManufacturer(manufacturer: string, caseIds: string[]) {
    if (!claimMonth || !caseIds.length) return;
    setRowStates(s => ({ ...s, [manufacturer]: 'generating' }));
    try {
      const [year, month] = claimMonth.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleDateString('en-AU', { month: 'long' });
      const res = await fetch('/api/reports/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manufacturer, month: monthName, year, caseIds }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRowStates(s => ({ ...s, [manufacturer]: 'done' }));
      setRowResults(r => ({ ...r, [manufacturer]: { id: json.data.id, count: caseIds.length } }));
      await loadCases();
    } catch (e: any) {
      setRowStates(s => ({ ...s, [manufacturer]: 'error' }));
      setRowResults(r => ({ ...r, [manufacturer]: e.message || 'Failed to generate' }));
    }
  }

  async function handleGenerateAll() {
    setGeneratingAll(true);
    for (const row of manufacturerSummary) {
      if (rowStates[row.manufacturer] === 'done') continue;
      await handleGenerateForManufacturer(row.manufacturer, row.cases.map(c => c.id));
    }
    setGeneratingAll(false);
  }

  if (loading) {
    return <StatCardsSkeleton count={4} />;
  }

  const isExternal = reportType === 'external';
  const claimMonthLabel = claimMonth ? (months.find(m => m.value === claimMonth)?.label ?? claimMonth) : '';
  const allDone = manufacturerSummary.length > 0 && manufacturerSummary.every(r => rowStates[r.manufacturer] === 'done');
  const anyGenerating = manufacturerSummary.some(r => rowStates[r.manufacturer] === 'generating') || generatingAll;
  const totalUnsubmitted = manufacturerSummary.reduce((s, r) => s + r.count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate internal and manufacturer-facing fault reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="btn-secondary"><Download size={14} /> Export CSV</button>
          <button onClick={handlePrint} className="btn-secondary"><Printer size={14} /> Print / Save PDF</button>
        </div>
      </div>

      {/* Filters + Claim Summary */}
      <div className="card p-5 no-print">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="form-label">Report Type</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {([
                { value: 'internal', label: 'Internal', icon: Eye },
                { value: 'external', label: 'Manufacturer', icon: EyeOff },
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => setReportType(opt.value)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${reportType === opt.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  <opt.icon size={14} /> {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Manufacturer</label>
            <select value={selectedManufacturer}
              onChange={e => setSelectedManufacturer(e.target.value)}
              className="form-input w-48">
              <option value="">All Manufacturers</option>
              {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Claim Month</label>
            <select value={claimMonth}
              onChange={e => setClaimMonth(e.target.value)}
              className="form-input w-44">
              <option value="">— or use date range —</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">From</label>
            <input type="date" value={fromDate}
              onChange={e => { setFromDate(e.target.value); setClaimMonth(''); }}
              className="form-input" />
          </div>
          <div>
            <label className="form-label">To</label>
            <input type="date" value={toDate}
              onChange={e => { setToDate(e.target.value); setClaimMonth(''); }}
              className="form-input" />
          </div>
        </div>

        {isExternal && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-brand-50 border border-brand-200 rounded-lg text-sm text-brand-700">
            <EyeOff size={14} />
            <span>Manufacturer view — costs are hidden, evidence links are visible.</span>
          </div>
        )}

        {/* Manufacturer claim summary table — shown when a month is selected */}
        {claimMonth && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {manufacturerSummary.length === 0 ? (
              <p className="text-sm text-slate-500">No unsubmitted faults for {claimMonthLabel} — all may already be claimed.</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Claim Batches — {claimMonthLabel}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {totalUnsubmitted} unsubmitted fault{totalUnsubmitted !== 1 ? 's' : ''} across {manufacturerSummary.length} manufacturer{manufacturerSummary.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateAll}
                    disabled={allDone || anyGenerating}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {anyGenerating
                      ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                      : allDone
                        ? <><CheckCircle size={14} /> All Done</>
                        : <><FileText size={14} /> Generate All ({totalUnsubmitted})</>
                    }
                  </button>
                </div>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Manufacturer</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unsubmitted Faults</th>
                        <th className="px-4 py-2.5 w-48"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manufacturerSummary.map(row => {
                        const state = rowStates[row.manufacturer] || 'idle';
                        const result = rowResults[row.manufacturer];
                        return (
                          <tr key={row.manufacturer} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{row.manufacturer}</td>
                            <td className="px-4 py-3 text-slate-600">
                              <div className="flex items-center gap-2">
                                <span>{row.count} fault{row.count !== 1 ? 's' : ''}</span>
                                {(excludedProducts[row.manufacturer] ?? []).length > 0 && (
                                  <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                    {(excludedProducts[row.manufacturer] ?? []).length} excluded
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <ProductFilterPopover
                                  manufacturer={row.manufacturer}
                                  products={manufacturerProducts[row.manufacturer] ?? []}
                                  excluded={excludedProducts[row.manufacturer] ?? []}
                                  onToggle={product => toggleProductExclusion(row.manufacturer, product)}
                                  onClear={() => clearExclusions(row.manufacturer)}
                                />
                              {state === 'idle' && (
                                <button
                                  onClick={() => handleGenerateForManufacturer(row.manufacturer, row.cases.map(c => c.id))}
                                  className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                                >
                                  <FileText size={12} /> Generate
                                </button>
                              )}
                              {state === 'generating' && (
                                <span className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                                  <Loader2 size={12} className="animate-spin" /> Generating…
                                </span>
                              )}
                              {state === 'done' && typeof result === 'object' && result && (
                                <span className="flex items-center justify-end gap-1.5 text-xs text-green-600 font-medium">
                                  <CheckCircle size={12} /> Done · Ref {(result as { id: string; count: number }).id}
                                </span>
                              )}
                              {state === 'error' && (
                                <span className="flex items-center justify-end gap-1.5 text-xs text-red-500">
                                  <AlertTriangle size={12} /> {typeof result === 'string' ? result : 'Error'}
                                </span>
                              )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {allDone && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <CheckCircle size={14} />
                    <span>All claims generated. Switch to <strong>Manufacturer</strong> view and hit <strong>Print / Save PDF</strong> to download the manufacturer copy.</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Report printable content */}
      <div ref={printRef} className="space-y-6">

        {/* Summary header */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedManufacturer ? `${selectedManufacturer} — Fault Report` : 'All Manufacturers — Fault Report'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {fromDate && toDate
                  ? `Period: ${formatDate(fromDate)} – ${formatDate(toDate)}`
                  : fromDate ? `From: ${formatDate(fromDate)}`
                  : toDate ? `To: ${formatDate(toDate)}`
                  : 'All time'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Generated {formatDate(new Date().toISOString())} · {isExternal ? 'Manufacturer copy' : 'Internal use only'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-slate-900">{stats.totalCases}</p>
              <p className="text-xs text-slate-400">Total fault cases</p>
              {!isExternal && (
                <>
                  <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(stats.totalCost)}</p>
                  <p className="text-xs text-slate-400">Total cost at risk</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Fault Type Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.faultTypeChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.faultTypeChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Product Summary</h3>
            <table className="data-table text-xs">
              <thead>
                <tr><th>Product</th><th>Faults</th>{!isExternal && <th>Cost USD</th>}</tr>
              </thead>
              <tbody>
                {stats.productTable.slice(0, 8).map(p => (
                  <tr key={p.name}>
                    <td className="font-medium">{p.name}</td>
                    <td>{p.count}</td>
                    {!isExternal && <td className="font-semibold">{formatCurrency(p.cost)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cases table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Fault Cases</h3>
            <p className="text-xs text-slate-500">{filteredCases.length} records</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order #</th>
                  {!isExternal && <th>Customer</th>}
                  <th>Product</th>
                  {!isExternal && <th>Manufacturer</th>}
                  <th>Fault Type</th>
                  <th>Notes</th>
                  <th>Status</th>
                  {!isExternal && <th>Cost</th>}
                  {isExternal && <th>Evidence</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={isExternal ? 7 : 9} className="text-center py-8 text-slate-400">
                      No cases match the selected filters.
                    </td>
                  </tr>
                ) : filteredCases.map(c => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-xs">{formatDate(c.date)}</td>
                    <td className="font-medium">{c.orderNumber}</td>
                    {!isExternal && <td>{c.customerName}</td>}
                    <td className="text-slate-500">{c.product}</td>
                    {!isExternal && <td className="text-slate-500">{c.manufacturerName}</td>}
                    <td>
                      <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {c.faultType}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500 max-w-[180px] truncate">{c.faultNotes || '—'}</td>
                    <td>
                      <span className={`badge text-[10px] ${STATUS_STYLES[c.claimStatus]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                        {c.claimStatus}
                      </span>
                    </td>
                    {!isExternal && (
                      <td className="font-semibold whitespace-nowrap">{formatCurrency(c.unitCostUSD)}</td>
                    )}
                    {isExternal && (
                      <td>
                        {c.evidenceLink ? (
                          <a href={c.evidenceLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline font-medium">
                            View <ExternalLink size={11} />
                          </a>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {!isExternal && filteredCases.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={8} className="text-right text-sm pr-4 py-3">Total Cost at Risk:</td>
                    <td className="text-red-600 text-sm py-3">{formatCurrency(stats.totalCost)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
