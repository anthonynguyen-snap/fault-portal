'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, TrendingUp, Clock, DollarSign, AlertCircle, Package } from 'lucide-react';
import { CorporateOrder, CorporateStatus } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

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

const ACTIVE_STATUSES: CorporateStatus[] = [
  'Inquiry','Quote Sent','Quote Approved','Details Received',
  'Mockup Sent','Mockup Approved','Sent to Supplier','Supplier Quoted','In Production',
];

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmt(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function CorporateDashboard() {
  const [orders, setOrders] = useState<CorporateOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/corporate')
      .then(r => r.json())
      .then(json => { setOrders(json.data || []); setLoading(false); });
  }, []);

  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const pipeline = active.reduce((s, o) => s + (o.quoteAmount || 0), 0);
  const totalRevenue = orders
    .filter(o => o.status === 'Delivered' || o.status === 'Completed')
    .reduce((s, o) => s + (o.quoteAmount || 0), 0);
  const totalMargin = orders
    .filter(o => o.status === 'Delivered' || o.status === 'Completed')
    .reduce((s, o) => s + ((o.quoteAmount || 0) - (o.supplierQuote || 0)), 0);
  const overduePayments = orders.filter(o => o.paymentStatus === 'Overdue').length;

  const overdueDeliveries = orders.filter(o => {
    const d = daysUntil(o.requestedDeliveryDate);
    return d !== null && d < 0 && o.status !== 'Delivered' && o.status !== 'Completed';
  });

  const upcoming = orders
    .filter(o => {
      const d = daysUntil(o.requestedDeliveryDate);
      return d !== null && d >= 0 && d <= 14 && o.status !== 'Delivered';
    })
    .sort((a, b) => new Date(a.requestedDeliveryDate).getTime() - new Date(b.requestedDeliveryDate).getTime());

  // Stage pipeline counts
  const stageCounts: Partial<Record<CorporateStatus, number>> = {};
  for (const o of active) {
    stageCounts[o.status] = (stageCounts[o.status] || 0) + 1;
  }

  if (loading) return <TableSkeleton rows={4} cols={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Corporate / Wholesale</h1>
          <p className="page-subtitle">Track orders, quotes, and production</p>
        </div>
        <Link href="/corporate/orders/new" className="btn-primary flex items-center gap-2">
          <PlusCircle size={16} /> New Order
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package size={18} className="text-blue-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">Active Jobs</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{active.length}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-indigo-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">Pipeline Value</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${pipeline.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-600" />
            </div>
            <span className="text-sm text-slate-500 font-medium">Total Margin</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">${totalMargin.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
          <p className="text-xs text-slate-400 mt-1">from ${totalRevenue.toLocaleString('en-AU', { minimumFractionDigits: 0 })} revenue</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${overduePayments > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <AlertCircle size={18} className={overduePayments > 0 ? 'text-red-500' : 'text-slate-400'} />
            </div>
            <span className="text-sm text-slate-500 font-medium">Overdue Payments</span>
          </div>
          <p className={`text-3xl font-bold ${overduePayments > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overduePayments}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline by stage */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Jobs by Stage</h3>
          {ACTIVE_STATUSES.map(s => {
            const count = stageCounts[s] || 0;
            return (
              <div key={s} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[s]}`}>{s}</span>
                <span className="text-sm font-semibold text-slate-700">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Upcoming & overdue deliveries */}
        <div className="card p-5 space-y-4">
          {/* Overdue */}
          {overdueDeliveries.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={15} className="text-red-500" />
                <h3 className="text-sm font-semibold text-red-600">Overdue Deliveries</h3>
              </div>
              <div className="space-y-2">
                {overdueDeliveries.map(o => {
                  const days = Math.abs(daysUntil(o.requestedDeliveryDate)!);
                  return (
                    <Link key={o.id} href={`/corporate/orders/${o.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors border border-red-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{o.companyName}</p>
                        <p className="text-xs text-slate-400">Due {fmt(o.requestedDeliveryDate)}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-600">
                        {days}d overdue
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-700">Upcoming Deliveries (14 days)</h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No upcoming deliveries.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(o => {
                  const days = daysUntil(o.requestedDeliveryDate)!;
                  return (
                    <Link key={o.id} href={`/corporate/orders/${o.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{o.companyName}</p>
                        <p className="text-xs text-slate-400">{fmt(o.requestedDeliveryDate)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        days <= 3 ? 'bg-red-100 text-red-600' : days <= 7 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active orders list */}
      {active.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Active Orders</h3>
            <Link href="/corporate/orders" className="text-xs text-brand-600 hover:underline font-medium">View all</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Company</th>
                <th className="px-5 py-3 text-left font-medium">Stage</th>
                <th className="px-5 py-3 text-left font-medium">Delivery</th>
                <th className="px-5 py-3 text-right font-medium">Quote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {active.slice(0, 8).map(o => (
                <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/corporate/orders/${o.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                      {o.companyName}
                    </Link>
                    {o.contactName && <p className="text-xs text-slate-400">{o.contactName}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[o.status]}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{fmt(o.requestedDeliveryDate)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-700">
                    {o.quoteAmount ? `$${o.quoteAmount.toLocaleString('en-AU')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orders.length === 0 && (
        <div className="card p-12 text-center">
          <Package size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No corporate orders yet</p>
          <Link href="/corporate/orders/new" className="btn-primary mt-4 inline-flex items-center gap-2">
            <PlusCircle size={15} /> Create First Order
          </Link>
        </div>
      )}
    </div>
  );
}
