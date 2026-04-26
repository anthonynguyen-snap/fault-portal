'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, RefreshCw, Search } from 'lucide-react';
import { CorporateOrder, CorporateStatus, PaymentStatus } from '@/types';

const STATUS_COLOURS: Record<CorporateStatus, string> = {
  'Inquiry':         'bg-slate-100 text-slate-600',
  'Quote Sent':      'bg-blue-100 text-blue-700',
  'Quote Approved':  'bg-indigo-100 text-indigo-700',
  'Details Received':'bg-purple-100 text-purple-700',
  'Mockup Sent':     'bg-amber-100 text-amber-700',
  'Mockup Approved': 'bg-orange-100 text-orange-700',
  'Sent to Supplier':'bg-cyan-100 text-cyan-700',
  'Supplier Quoted': 'bg-teal-100 text-teal-700',
  'In Production':   'bg-yellow-100 text-yellow-700',
  'Completed':       'bg-emerald-100 text-emerald-700',
  'Delivered':       'bg-green-100 text-green-700',
};

const PAYMENT_COLOURS: Record<PaymentStatus, string> = {
  'Unpaid':   'bg-slate-100 text-slate-500',
  'Invoiced': 'bg-blue-100 text-blue-600',
  'Paid':     'bg-emerald-100 text-emerald-700',
  'Overdue':  'bg-red-100 text-red-600',
};

const ALL_STATUSES: CorporateStatus[] = [
  'Inquiry','Quote Sent','Quote Approved','Details Received',
  'Mockup Sent','Mockup Approved','Sent to Supplier','Supplier Quoted',
  'In Production','Completed','Delivered',
];

function fmt(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function CorporateOrdersPage() {
  const [orders, setOrders] = useState<CorporateOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CorporateStatus | 'All'>('All');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/corporate');
    const json = await res.json();
    setOrders(json.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: CorporateStatus) {
    setUpdatingId(id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    await fetch(`/api/corporate/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setUpdatingId(null);
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.companyName.toLowerCase().includes(search.toLowerCase()) ||
      o.contactName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">All Orders</h1>
          <p className="page-subtitle">Corporate & wholesale order tracker</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" title="Refresh"><RefreshCw size={15} /></button>
          <Link href="/corporate/orders/new" className="btn-primary flex items-center gap-2">
            <PlusCircle size={16} /> New Order
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search company or contact..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 text-sm py-2"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as CorporateStatus | 'All')}
          className="form-input text-sm py-2"
        >
          <option value="All">All Stages</option>
          {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500">No orders found.</p>
          <Link href="/corporate/orders/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <PlusCircle size={15} /> New Order
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Company</th>
                <th className="px-5 py-3 text-left font-medium">Stage</th>
                <th className="px-5 py-3 text-left font-medium">Delivery</th>
                <th className="px-5 py-3 text-left font-medium">Quote</th>
                <th className="px-5 py-3 text-left font-medium">Margin</th>
                <th className="px-5 py-3 text-left font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(o => {
                const margin = (o.quoteAmount || 0) - (o.supplierQuote || 0);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/corporate/orders/${o.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                        {o.companyName}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        {o.contactName && <p className="text-xs text-slate-400">{o.contactName}</p>}
                        {o.referenceNumber && <span className="text-xs font-mono text-slate-400">{o.referenceNumber}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={o.status}
                        onChange={e => updateStatus(o.id, e.target.value as CorporateStatus)}
                        disabled={updatingId === o.id}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-1 focus:ring-brand-400 ${STATUS_COLOURS[o.status]}`}
                      >
                        {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{fmt(o.requestedDeliveryDate)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-700">
                      {o.quoteAmount ? `$${o.quoteAmount.toLocaleString('en-AU')}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {o.supplierQuote ? (
                        <span className={`font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          ${margin.toLocaleString('en-AU')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_COLOURS[o.paymentStatus]}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
