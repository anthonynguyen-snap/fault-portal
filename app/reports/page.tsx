'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Download, Printer, Eye, EyeOff, Filter, BarChart2 } from 'lucide-react';
import { FaultCase } from '@/types';
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = ['#4f46e5','#7c3aed','#0891b2','#059669','#d97706','#dc2626'];

export default function ReportsPage() {
  const [cases, setCases] = useState<FaultCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Report controls
  const [reportType, setReportType] = useState<'internal' | 'external'>('internal');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

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

  const manufacturers = useMemo(() => {
    const set = new Set(cases.map(c => c.manufacturerName).filter(Boolean));
    return Array.from(set).sort();
  }, [cases]);

  // Filtered cases for report
  const filteredCases = useMemo(() => {
    let result = [...cases];
    if (selectedManufacturer) result = result.filter(c => c.manufacturerName === selectedManufacturer);
    if (fromDate) result = result.filter(c => c.date >= fromDate);
    if (toDate)   result = result.filter(c => c.date <= toDate);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [cases, selectedManufacturer, fromDate, toDate]);

  // Aggregated stats for filtered set
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

  function handlePrint() {
    window.print();
  }

  function exportCsv() {
    const isInternal = reportType === 'internal';
    const headers = isInternal
      ? ['Date','Order #','Customer','Product','Manufacturer','Fault Type','Status','Cost USD']
      : ['Date','Order #','Customer','Product','Manufacturer','Fault Type','Status'];

    const rows = filteredCases.map(c => {
      const base = [
        c.date, c.orderNumber, c.customerName,
        c.product, c.manufacturerName, c.faultType, c.claimStatus,
      ];
      return isInternal ? [...base, c.unitCostUSD] : base;
    });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isExternal = reportType === 'external';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header (no-print) */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate internal and manufacturer-facing fault reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="btn-secondary">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={handlePrint} className="btn-secondary">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Controls (no-print) */}
      <div className="card p-5 no-print">
        <div className="flex flex-wrap items-end gap-4">
          {/* Report type toggle */}
          <div>
            <label className="form-label">Report Type</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {[
                { value: 'internal', label: 'Internal', icon: Eye },
                { value: 'external', label: 'Manufacturer', icon: EyeOff },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setReportType(opt.value as any)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                    reportType === opt.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <opt.icon size={14} /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Manufacturer</label>
            <select
              value={selectedManufacturer}
              onChange={e => setSelectedManufacturer(e.target.value)}
              className="form-input w-48"
            >
              <option value="">All Manufacturers</option>
              {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="form-input" />
          </div>

          <div>
            <label className="form-label">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="form-input" />
          </div>
        </div>

        {isExternal && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <EyeOff size={14} />
            <span>External mode: cost information is hidden from this report.</span>
          </div>
        )}
      </div>

      {/* Report Content */}
      <div ref={printRef} className="space-y-6">
        {/* Report Header */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {selectedManufacturer
                  ? `${selectedManufacturer} — Fault Report`
                  : 'All Manufacturers — Fault Report'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {fromDate && toDate
                  ? `Period: ${formatDate(fromDate)} – ${formatDate(toDate)}`
                  : fromDate
                  ? `From: ${formatDate(fromDate)}`
                  : toDate
                  ? `To: ${formatDate(toDate)}`
                  : 'All time'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Generated {formatDate(new Date().toISOString())} ·{' '}
                {isExternal ? 'External / Manufacturer-facing' : 'Internal use only'}
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

        {/* Summary charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fault Types Chart */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Fault Type Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.faultTypeChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.faultTypeChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Product Summary Table */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Product Summary</h3>
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Faults</th>
                  {!isExternal && <th>Cost USD</th>}
                </tr>
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

        {/* Case Table */}
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
                  <th>Customer</th>
                  <th>Product</th>
                  {!isExternal && <th>Manufacturer</th>}
                  <th>Fault Type</th>
                  <th>Status</th>
                  {!isExternal && <th>Cost</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={isExternal ? 6 : 8} className="text-center py-8 text-slate-400">
                      No cases match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map(c => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap text-xs">{formatDate(c.date)}</td>
                      <td className="font-medium">{c.orderNumber}</td>
                      <td>{c.customerName}</td>
                      <td className="text-slate-500">{c.product}</td>
                      {!isExternal && <td className="text-slate-500">{c.manufacturerName}</td>}
                      <td>
                        <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          {c.faultType}
                        </span>
                      </td>
                      <td>
                        <span className={`badge text-[10px] ${STATUS_STYLES[c.claimStatus]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                          {c.claimStatus}
                        </span>
                      </td>
                      {!isExternal && (
                        <td className="font-semibold whitespace-nowrap">{formatCurrency(c.unitCostUSD)}</td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {!isExternal && filteredCases.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={7} className="text-right text-sm pr-4 py-3">Total Cost at Risk:</td>
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
