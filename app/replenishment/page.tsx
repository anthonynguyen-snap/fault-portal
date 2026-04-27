'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Truck, Plus, RefreshCw, ChevronRight, Package,
  AlertTriangle, CheckCircle, Clock, Send,
} from 'lucide-react';
import { ReplenishmentRequest, ReplenishmentStatus, StockItem } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

const STORES = ['Adelaide Popup', 'Sydney Store'] as const;
const SOURCES = ['Storeroom', '3PL'] as const;

const STATUS_STYLES: Record<ReplenishmentStatus, string> = {
  Pending:    'bg-amber-100 text-amber-700',
  Ordered:    'bg-blue-100 text-blue-700',
  Dispatched: 'bg-emerald-100 text-emerald-700',
  Delivered:  'bg-slate-100 text-slate-600',
};

const STATUS_ICONS: Record<ReplenishmentStatus, React.ReactNode> = {
  Pending:    <Clock size={11} />,
  Ordered:    <Package size={11} />,
  Dispatched: <Send size={11} />,
  Delivered:  <CheckCircle size={11} />,
};

function StatusBadge({ status }: { status: ReplenishmentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_ICONS[status]} {status}
    </span>
  );
}

interface NewItemRow {
  stockItemId: string;
  stockItemName: string;
  sku: string;
  quantityRequested: number;
  quantityOnHand: number;
  source: 'Storeroom' | '3PL';
  skipped: boolean;
}

export default function ReplenishmentPage() {
  const searchParams = useSearchParams();
  const [requests, setRequests]     = useState<ReplenishmentRequest[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'All' | ReplenishmentStatus>('All');
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [includeEOL, setIncludeEOL]     = useState(false);
  const { success, error: toastError } = useToast();

  // New request form state
  const [form, setForm] = useState({
    store:       'Adelaide Popup' as typeof STORES[number],
    orderNumber: '',
    requestedBy: '',
    date:        new Date().toISOString().slice(0, 10),
    notes:       '',
  });
  const [newItems, setNewItems] = useState<NewItemRow[]>([]);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [reqRes, stockRes] = await Promise.all([
        fetch('/api/replenishment'),
        fetch('/api/stock/items'),
      ]);
      const reqJson   = await reqRes.json();
      const stockJson = await stockRes.json();
      setRequests(reqJson.data ?? []);
      setStockItems(stockJson.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Auto-open modal if redirected from a dispatched request
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const store = searchParams.get('store');
      if (store && (STORES as readonly string[]).includes(store)) {
        setForm(f => ({ ...f, store: store as typeof STORES[number] }));
      }
      setShowModal(true);
    }
  }, [searchParams]);

  const displayed = useMemo(() =>
    filter === 'All' ? requests : requests.filter(r => r.status === filter),
    [requests, filter]
  );

  const counts = {
    All:        requests.length,
    Pending:    requests.filter(r => r.status === 'Pending').length,
    Ordered:    requests.filter(r => r.status === 'Ordered').length,
    Dispatched: requests.filter(r => r.status === 'Dispatched').length,
    Delivered:  requests.filter(r => r.status === 'Delivered').length,
  };

  // ── New item management ────────────────────────────────────────────────────
  function addItem() {
    setNewItems(prev => [...prev, {
      stockItemId: '', stockItemName: '', sku: '',
      quantityRequested: 1, quantityOnHand: 0, source: 'Storeroom', skipped: false,
    }]);
  }

  function removeItem(idx: number) {
    setNewItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<NewItemRow>) {
    setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  function selectStockItem(idx: number, stockItemId: string) {
    const stock = stockItems.find(s => s.id === stockItemId);
    if (!stock) return;
    updateItem(idx, {
      stockItemId,
      stockItemName: stock.name,
      sku:           stock.sku,
      quantityOnHand: stock.quantity,
    });
  }

  // ── Submit new request ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!newItems.length) { setFormError('Add at least one item.'); return; }
    if (newItems.some(i => !i.stockItemId)) { setFormError('Select a product for every item.'); return; }
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/replenishment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items: newItems }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequests(prev => [json.data, ...prev]);
      setShowModal(false);
      setNewItems([]);
      setIncludeEOL(false);
      setForm({ store: 'Adelaide Popup', orderNumber: '', requestedBy: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      success('Request created', `Replenishment request for ${form.store} logged.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError('Failed to save', msg);
    } finally {
      setSaving(false);
    }
  }

  const totalUnits = (req: ReplenishmentRequest) =>
    req.items.reduce((s, i) => s + i.quantityRequested, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Replenishment</h1>
          <p className="page-subtitle">Manage stock dispatch to Adelaide Popup and Sydney Store</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={15} /> New Request
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: 'Pending',    count: counts.Pending,    color: 'bg-amber-500' },
          { label: 'Ordered',    count: counts.Ordered,    color: 'bg-blue-500' },
          { label: 'Dispatched', count: counts.Dispatched, color: 'bg-emerald-500' },
          { label: 'Delivered',  count: counts.Delivered,  color: 'bg-slate-400' },
        ]).map(card => (
          <div key={card.label} className="card p-4 flex items-center gap-3">
            <div className={`w-2.5 h-8 rounded-full ${card.color}`} />
            <div>
              <p className="text-2xl font-bold font-mono text-slate-900">{card.count}</p>
              <p className="text-xs text-slate-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['All', 'Pending', 'Ordered', 'Dispatched', 'Delivered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {f}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : displayed.length === 0 ? (
        <div className="card overflow-clip">
          <EmptyState
            icon={Truck}
            title="No replenishment requests"
            description={filter === 'All' ? 'Create your first request to get started.' : `No ${filter.toLowerCase()} requests.`}
            action={filter === 'All' ? { label: 'New Request', onClick: () => setShowModal(true) } : { label: 'View all', onClick: () => setFilter('All') }}
          />
        </div>
      ) : (
        <div className="card overflow-clip">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Store</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requested by</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, idx) => (
                <tr key={r.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-brand-50/30 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  onClick={() => window.location.href = `/replenishment/${r.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.store === 'Adelaide Popup' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                    }`}>{r.store}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.orderNumber || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.items.length}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{totalUnits(r)}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.requestedBy || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status as ReplenishmentStatus} /></td>
                  <td className="px-4 py-3 text-slate-400"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New Request Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">New Replenishment Request</h2>
              <button onClick={() => { setShowModal(false); setIncludeEOL(false); }} className="text-slate-400 hover:text-slate-600 p-1 text-lg leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Store + Order # */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Store</label>
                  <select value={form.store} onChange={e => setForm(f => ({ ...f, store: e.target.value as typeof STORES[number] }))} className="form-input">
                    {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Order Number <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} className="form-input" placeholder="e.g. PO-2026-001" />
                </div>
              </div>

              {/* Requested by + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Requested by</label>
                  <input value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} className="form-input" placeholder="e.g. Michael" />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Items</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeEOL}
                        onChange={e => setIncludeEOL(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-amber-500"
                      />
                      <span className="text-xs text-slate-500">Include EOL items</span>
                    </label>
                    <button onClick={addItem} className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1">
                      <Plus size={12} /> Add item
                    </button>
                  </div>
                </div>

                {newItems.length === 0 ? (
                  <button onClick={addItem}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 text-slate-400 text-sm hover:border-brand-300 hover:text-brand-500 transition-colors flex flex-col items-center gap-1">
                    <Package size={20} />
                    Click to add items from the stockroom
                  </button>
                ) : (
                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="grid grid-cols-[24px_1fr_80px_80px_90px_24px] gap-2 px-1">
                      <span />
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Product</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">On Hand</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Qty Req.</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Source</p>
                      <span />
                    </div>
                    {newItems.map((item, idx) => (
                      <div key={idx} className={`grid grid-cols-[24px_1fr_80px_80px_90px_24px] gap-2 items-center rounded-lg px-2 py-2 transition-colors ${item.skipped ? 'bg-red-50' : 'bg-slate-50'}`}>
                        {/* Skip toggle */}
                        <button
                          onClick={() => updateItem(idx, { skipped: !item.skipped })}
                          title={item.skipped ? 'Undo skip' : 'Mark as out of stock'}
                          className={`text-base leading-none transition-colors ${item.skipped ? 'text-red-400 hover:text-slate-400' : 'text-slate-300 hover:text-red-400'}`}>
                          {item.skipped ? '↩' : '⊘'}
                        </button>
                        <select
                          value={item.stockItemId}
                          onChange={e => selectStockItem(idx, e.target.value)}
                          disabled={item.skipped}
                          className={`form-input text-xs py-1.5 ${item.skipped ? 'line-through text-red-400' : ''}`}>
                          <option value="">Select product…</option>
                          {stockItems.filter(s => includeEOL || !s.discontinued).map(s => (
                            <option key={s.id} value={s.id}>{s.name}{s.sku ? ` · ${s.sku}` : ''}{s.discontinued ? ' · EOL' : ''}</option>
                          ))}
                        </select>
                        <div className="text-center">
                          {item.source === '3PL' ? (
                            <span className="font-mono text-sm text-slate-300">—</span>
                          ) : (
                            <span className={`font-mono text-sm font-semibold ${
                              item.skipped ? 'text-slate-300' :
                              item.quantityOnHand === 0 ? 'text-red-500' :
                              item.quantityOnHand < (item.quantityRequested || 1) ? 'text-amber-500' :
                              'text-emerald-600'
                            }`}>
                              {item.stockItemId ? item.quantityOnHand : '—'}
                            </span>
                          )}
                        </div>
                        <input
                          type="number" min={1}
                          value={item.quantityRequested}
                          onChange={e => updateItem(idx, { quantityRequested: parseInt(e.target.value) || 0 })}
                          disabled={item.skipped}
                          className="form-input text-xs py-1.5 text-center font-mono"
                        />
                        <select
                          value={item.source}
                          onChange={e => updateItem(idx, { source: e.target.value as 'Storeroom' | '3PL' })}
                          disabled={item.skipped}
                          className="form-input text-xs py-1.5">
                          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 pt-1">
                      Total: <span className="font-mono font-semibold text-slate-700">{newItems.filter(i => !i.skipped).reduce((s, i) => s + (i.quantityRequested || 0), 0)} units</span>
                      {newItems.some(i => i.skipped) && (
                        <span className="ml-2 text-slate-300">({newItems.filter(i => i.skipped).length} skipped)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="form-input resize-none" placeholder="Any extra context…" />
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="text-xs text-red-700">{formError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setShowModal(false); setIncludeEOL(false); }} className="btn-secondary">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
