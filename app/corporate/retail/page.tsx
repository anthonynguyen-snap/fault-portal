'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  PlusCircle, Search, X, Package, Truck, MapPin, Phone, Mail,
  Copy, ExternalLink, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, Loader2, Pencil, Trash2, Check, Building2,
} from 'lucide-react';
import { RetailOrder, RetailOrderItem, RetailOrderStatus } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

// ── Tab bar (shared with wholesale) ──────────────────────────────────────────
function CorporateTabs({ active }: { active: 'wholesale' | 'retail' }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6">
      <Link
        href="/corporate"
        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
          active === 'wholesale'
            ? 'border-brand-600 text-brand-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        Wholesale
      </Link>
      <Link
        href="/corporate/retail"
        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
          active === 'retail'
            ? 'border-brand-600 text-brand-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
      >
        Retail Orders
      </Link>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<RetailOrderStatus, { colour: string; dot: string; icon: React.ElementType }> = {
  Pending:    { colour: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400',   icon: Clock },
  Processing: { colour: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    icon: Loader2 },
  Picked:     { colour: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500',  icon: Package },
  Packed:     { colour: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500',  icon: Package },
  Shipped:    { colour: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   icon: Truck },
  Delivered:  { colour: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   icon: CheckCircle2 },
  Exception:  { colour: 'bg-red-100 text-red-700',       dot: 'bg-red-500',     icon: AlertTriangle },
  Cancelled:  { colour: 'bg-slate-100 text-slate-400',   dot: 'bg-slate-300',   icon: X },
};

const ALL_STATUSES: RetailOrderStatus[] = ['Pending','Processing','Picked','Packed','Shipped','Delivered','Exception','Cancelled'];
const PLATFORMS = ['Shopify','Manual','B2B','Amazon','Other'];

function fmt(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function StatusBadge({ status }: { status: RetailOrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.colour}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

// ── Blank order form ──────────────────────────────────────────────────────────
function blankOrder(): Omit<RetailOrder, 'id' | 'createdAt'> {
  return {
    orderNumber: '', platform: 'Shopify', orderDate: new Date().toISOString().split('T')[0],
    customerName: '', customerEmail: '', customerPhone: '',
    shippingAddress: '', shippingCity: '', shippingState: '', shippingPostcode: '', shippingCountry: 'AU',
    thirdPlReference: '', warehouse: '', thirdPlNotes: '',
    carrier: '', trackingNumber: '', trackingUrl: '', status: 'Pending',
    shippedDate: '', deliveredDate: '', estimatedDelivery: '', notes: '',
    items: [],
  };
}

// ── Detail / Create slide-over ────────────────────────────────────────────────
function OrderPanel({
  order,
  onClose,
  onSaved,
  onDeleted,
}: {
  order: RetailOrder | null; // null = create mode
  onClose: () => void;
  onSaved: (o: RetailOrder) => void;
  onDeleted: (id: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit'>(order ? 'view' : 'edit');
  const [form, setForm] = useState<Omit<RetailOrder, 'id' | 'createdAt'>>(
    order ? { ...order } : blankOrder()
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function setItem(idx: number, key: keyof RetailOrderItem, value: string | number) {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...f, items };
    });
  }

  function addItem() {
    setForm(f => ({
      ...f,
      items: [...f.items, { id: '', orderId: '', product: '', sku: '', quantityOrdered: 1, quantityShipped: 0 }],
    }));
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  async function save() {
    if (!form.orderNumber.trim()) { setError('Order number is required.'); return; }
    if (!form.customerName.trim()) { setError('Customer name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const method = order ? 'PATCH' : 'POST';
      const url = order ? `/api/retail-orders/${order.id}` : '/api/retail-orders';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      onSaved(json.data);
      setMode('view');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!order) return;
    setDeleting(true);
    try {
      await fetch(`/api/retail-orders/${order.id}`, { method: 'DELETE' });
      onDeleted(order.id);
    } finally {
      setDeleting(false);
    }
  }

  function copyTracking() {
    if (form.trackingNumber) {
      navigator.clipboard.writeText(form.trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const isEdit = mode === 'edit';
  const currentOrder = order ?? { ...form, id: '', createdAt: '' };

  // Discrepancy detection
  const hasDiscrepancy = form.items.some(i => i.quantityShipped !== i.quantityOrdered && i.quantityShipped > 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
              {order ? 'Retail Order' : 'New Retail Order'}
            </p>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {order ? order.orderNumber : 'Create order'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {order && mode === 'view' && (
              <>
                <button
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600"
                >
                  <Pencil size={12} /> Edit
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1">
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                      {deleting ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isEdit ? (
            /* ── Edit form ── */
            <div className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {/* Order Info */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Order Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Order Number *</label>
                    <input className="form-input w-full" value={form.orderNumber}
                      onChange={e => set('orderNumber', e.target.value)} placeholder="#1234" />
                  </div>
                  <div>
                    <label className="form-label">Platform</label>
                    <select className="form-input w-full" value={form.platform} onChange={e => set('platform', e.target.value)}>
                      {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Order Date</label>
                    <input type="date" className="form-input w-full" value={form.orderDate}
                      onChange={e => set('orderDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-input w-full" value={form.status} onChange={e => set('status', e.target.value as RetailOrderStatus)}>
                      {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Customer */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="form-label">Name *</label>
                    <input className="form-input w-full" value={form.customerName}
                      onChange={e => set('customerName', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input w-full" value={form.customerEmail}
                      onChange={e => set('customerEmail', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <input className="form-input w-full" value={form.customerPhone}
                      onChange={e => set('customerPhone', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Street Address</label>
                    <input className="form-input w-full" value={form.shippingAddress}
                      onChange={e => set('shippingAddress', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">City</label>
                    <input className="form-input w-full" value={form.shippingCity}
                      onChange={e => set('shippingCity', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">State</label>
                    <input className="form-input w-full" value={form.shippingState}
                      onChange={e => set('shippingState', e.target.value)} placeholder="VIC" />
                  </div>
                  <div>
                    <label className="form-label">Postcode</label>
                    <input className="form-input w-full" value={form.shippingPostcode}
                      onChange={e => set('shippingPostcode', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Country</label>
                    <input className="form-input w-full" value={form.shippingCountry}
                      onChange={e => set('shippingCountry', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Items */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items Ordered vs Shipped</h3>
                  <button onClick={addItem} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <PlusCircle size={12} /> Add item
                  </button>
                </div>
                {form.items.length === 0 ? (
                  <button onClick={addItem}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-4 text-xs text-slate-400 hover:border-brand-300 hover:text-brand-500 transition-colors">
                    + Add first item
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">
                      <span className="col-span-4">Product</span>
                      <span className="col-span-2">SKU</span>
                      <span className="col-span-2 text-center">Ordered</span>
                      <span className="col-span-2 text-center">Shipped</span>
                      <span className="col-span-2"></span>
                    </div>
                    {form.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input className="form-input col-span-4 text-xs" value={item.product}
                          onChange={e => setItem(idx, 'product', e.target.value)} placeholder="Product name" />
                        <input className="form-input col-span-2 text-xs" value={item.sku}
                          onChange={e => setItem(idx, 'sku', e.target.value)} placeholder="SKU" />
                        <input type="number" min="0" className="form-input col-span-2 text-xs text-center" value={item.quantityOrdered}
                          onChange={e => setItem(idx, 'quantityOrdered', parseInt(e.target.value) || 0)} />
                        <input type="number" min="0" className="form-input col-span-2 text-xs text-center" value={item.quantityShipped}
                          onChange={e => setItem(idx, 'quantityShipped', parseInt(e.target.value) || 0)} />
                        <button onClick={() => removeItem(idx)}
                          className="col-span-2 flex justify-center text-slate-300 hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 3PL */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">3PL / Warehouse</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">3PL Reference</label>
                    <input className="form-input w-full" value={form.thirdPlReference}
                      onChange={e => set('thirdPlReference', e.target.value)} placeholder="WH-12345" />
                  </div>
                  <div>
                    <label className="form-label">Warehouse</label>
                    <input className="form-input w-full" value={form.warehouse}
                      onChange={e => set('warehouse', e.target.value)} placeholder="Sydney DC" />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">3PL Notes</label>
                    <textarea rows={2} className="form-input w-full resize-none" value={form.thirdPlNotes}
                      onChange={e => set('thirdPlNotes', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Tracking */}
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Shipping & Tracking</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Carrier</label>
                    <input className="form-input w-full" value={form.carrier}
                      onChange={e => set('carrier', e.target.value)} placeholder="Australia Post" />
                  </div>
                  <div>
                    <label className="form-label">Tracking Number</label>
                    <input className="form-input w-full" value={form.trackingNumber}
                      onChange={e => set('trackingNumber', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Tracking URL</label>
                    <input className="form-input w-full" value={form.trackingUrl}
                      onChange={e => set('trackingUrl', e.target.value)} placeholder="https://auspost.com.au/track?id=..." />
                  </div>
                  <div>
                    <label className="form-label">Shipped Date</label>
                    <input type="date" className="form-input w-full" value={form.shippedDate}
                      onChange={e => set('shippedDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Est. Delivery</label>
                    <input type="date" className="form-input w-full" value={form.estimatedDelivery}
                      onChange={e => set('estimatedDelivery', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Delivered Date</label>
                    <input type="date" className="form-input w-full" value={form.deliveredDate}
                      onChange={e => set('deliveredDate', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Notes */}
              <section>
                <label className="form-label">Notes</label>
                <textarea rows={3} className="form-input w-full resize-none" value={form.notes}
                  onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
              </section>
            </div>
          ) : (
            /* ── View mode ── */
            <div className="p-6 space-y-6">
              {/* Order meta strip */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={currentOrder.status} />
                <span className="text-xs text-slate-400">
                  {currentOrder.platform} · {fmt(currentOrder.orderDate)}
                </span>
                {currentOrder.thirdPlReference && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                    3PL: {currentOrder.thirdPlReference}
                  </span>
                )}
              </div>

              {/* Two-col: Customer + Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Customer */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</h3>
                  <div>
                    <p className="font-semibold text-slate-900">{currentOrder.customerName || '—'}</p>
                    {currentOrder.customerEmail && (
                      <a href={`mailto:${currentOrder.customerEmail}`}
                        className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline mt-1">
                        <Mail size={12} /> {currentOrder.customerEmail}
                      </a>
                    )}
                    {currentOrder.customerPhone && (
                      <a href={`tel:${currentOrder.customerPhone}`}
                        className="flex items-center gap-1.5 text-sm text-slate-600 mt-0.5">
                        <Phone size={12} /> {currentOrder.customerPhone}
                      </a>
                    )}
                  </div>
                  {(currentOrder.shippingAddress || currentOrder.shippingCity) && (
                    <div className="flex items-start gap-1.5 text-sm text-slate-600">
                      <MapPin size={13} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      <div>
                        {currentOrder.shippingAddress && <p>{currentOrder.shippingAddress}</p>}
                        <p>
                          {[currentOrder.shippingCity, currentOrder.shippingState, currentOrder.shippingPostcode]
                            .filter(Boolean).join(' ')}
                        </p>
                        {currentOrder.shippingCountry && currentOrder.shippingCountry !== 'AU' && (
                          <p>{currentOrder.shippingCountry}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tracking */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipment</h3>
                  {currentOrder.carrier && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Truck size={13} className="text-slate-400" />
                      <span className="font-medium">{currentOrder.carrier}</span>
                    </div>
                  )}
                  {currentOrder.trackingNumber && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {currentOrder.trackingNumber}
                      </span>
                      <button onClick={copyTracking}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors" title="Copy">
                        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                      </button>
                      {currentOrder.trackingUrl && (
                        <a href={currentOrder.trackingUrl} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded text-slate-400 hover:text-brand-600 transition-colors" title="Track">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    {currentOrder.shippedDate && (
                      <><span className="text-slate-400">Shipped</span><span className="font-medium text-slate-700">{fmtShort(currentOrder.shippedDate)}</span></>
                    )}
                    {currentOrder.estimatedDelivery && (
                      <><span className="text-slate-400">Est. delivery</span><span className="font-medium text-slate-700">{fmtShort(currentOrder.estimatedDelivery)}</span></>
                    )}
                    {currentOrder.deliveredDate && (
                      <><span className="text-slate-400">Delivered</span><span className="font-medium text-green-600">{fmtShort(currentOrder.deliveredDate)}</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Items ordered vs shipped */}
              {currentOrder.items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items Ordered vs Shipped</h3>
                    {hasDiscrepancy && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={9} /> Discrepancy
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Product</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">SKU</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Ordered</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Shipped</th>
                          <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Δ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {currentOrder.items.map((item, i) => {
                          const diff = item.quantityShipped - item.quantityOrdered;
                          return (
                            <tr key={i} className={diff !== 0 && item.quantityShipped > 0 ? 'bg-amber-50/50' : ''}>
                              <td className="px-4 py-2.5 font-medium text-slate-800">{item.product || '—'}</td>
                              <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{item.sku || '—'}</td>
                              <td className="px-3 py-2.5 text-center">{item.quantityOrdered}</td>
                              <td className="px-3 py-2.5 text-center font-semibold">{item.quantityShipped}</td>
                              <td className="px-3 py-2.5 text-center">
                                {item.quantityShipped > 0 && diff !== 0 ? (
                                  <span className={`text-xs font-bold ${diff > 0 ? 'text-blue-500' : 'text-amber-600'}`}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                ) : item.quantityShipped === item.quantityOrdered && item.quantityShipped > 0 ? (
                                  <CheckCircle2 size={13} className="text-green-500 mx-auto" />
                                ) : <span className="text-slate-200">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3PL details */}
              {(currentOrder.warehouse || currentOrder.thirdPlNotes) && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">3PL Details</h3>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
                    {currentOrder.warehouse && (
                      <div className="flex items-center gap-2">
                        <Building2 size={13} className="text-slate-400" />
                        <span className="text-slate-700 font-medium">{currentOrder.warehouse}</span>
                      </div>
                    )}
                    {currentOrder.thirdPlNotes && (
                      <p className="text-slate-500 text-xs">{currentOrder.thirdPlNotes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {currentOrder.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</h3>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{currentOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {isEdit && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <button
              onClick={() => order ? setMode('view') : onClose()}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save Order</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RetailOrdersPage() {
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RetailOrderStatus | ''>('');
  const [selected, setSelected] = useState<RetailOrder | null | undefined>(undefined); // undefined = closed, null = create
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Retail Orders · SNAP Portal';
    fetch('/api/retail-orders')
      .then(r => r.json())
      .then(json => { setOrders(json.data || []); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    let result = [...orders];
    if (statusFilter) result = result.filter(o => o.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.trackingNumber.toLowerCase().includes(q) ||
        o.thirdPlReference.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, search, statusFilter]);

  function handleSaved(order: RetailOrder) {
    setOrders(prev => {
      const exists = prev.find(o => o.id === order.id);
      return exists ? prev.map(o => o.id === order.id ? order : o) : [order, ...prev];
    });
    setSelected(order);
  }

  function handleDeleted(id: string) {
    setOrders(prev => prev.filter(o => o.id !== id));
    setSelected(undefined);
  }

  // Status summary counts
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<RetailOrderStatus, number>> = {};
    for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
    return counts;
  }, [orders]);

  const activeStatuses: RetailOrderStatus[] = ['Pending','Processing','Picked','Packed','Shipped'];
  const exceptions = orders.filter(o => o.status === 'Exception').length;

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Corporate / Wholesale</h1>
          <p className="page-subtitle">Retail orders, 3PL fulfilment, and tracking</p>
        </div>
        <button onClick={() => setSelected(null)} className="btn-primary flex items-center gap-2">
          <PlusCircle size={16} /> New Order
        </button>
      </div>

      <CorporateTabs active="retail" />

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2">
        {activeStatuses.map(s => {
          const count = statusCounts[s] || 0;
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(f => f === s ? '' : s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? `${cfg.colour} border-current`
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {s} <span className="font-bold">{count}</span>
            </button>
          );
        })}
        {exceptions > 0 && (
          <button
            onClick={() => setStatusFilter(f => f === 'Exception' ? '' : 'Exception')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === 'Exception'
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-red-50 border-red-200 text-red-600 hover:border-red-300'
            }`}
          >
            <AlertTriangle size={11} /> Exceptions <span className="font-bold">{exceptions}</span>
          </button>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search order #, customer, tracking…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as RetailOrderStatus | '')}
          className="form-input text-sm"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X size={12} /> Clear
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} of {orders.length} orders
        </span>
      </div>

      {/* Orders table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {orders.length === 0 ? 'No retail orders yet' : 'No orders match your filters'}
            </p>
            {orders.length === 0 && (
              <button onClick={() => setSelected(null)} className="btn-primary mt-4 inline-flex items-center gap-2">
                <PlusCircle size={14} /> Add first order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-5 py-3 text-left font-semibold">Order</th>
                  <th className="px-5 py-3 text-left font-semibold">Customer</th>
                  <th className="px-5 py-3 text-left font-semibold">Items</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-left font-semibold">Tracking</th>
                  <th className="px-5 py-3 text-left font-semibold">Delivery</th>
                  <th className="px-5 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(order => {
                  const totalOrdered = order.items.reduce((s, i) => s + i.quantityOrdered, 0);
                  const hasDisc = order.items.some(i => i.quantityShipped !== i.quantityOrdered && i.quantityShipped > 0);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{order.platform} · {fmtShort(order.orderDate)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{order.customerName || '—'}</p>
                        {order.shippingCity && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {[order.shippingCity, order.shippingState].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-700">{order.items.length} line{order.items.length !== 1 ? 's' : ''}</span>
                          {totalOrdered > 0 && <span className="text-xs text-slate-400">({totalOrdered} units)</span>}
                          {hasDisc && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                              Discrepancy
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {order.trackingNumber ? (
                          <div>
                            <p className="font-mono text-xs text-slate-700">{order.trackingNumber}</p>
                            {order.carrier && <p className="text-xs text-slate-400">{order.carrier}</p>}
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {order.deliveredDate ? (
                          <div>
                            <p className="text-xs font-medium text-green-600">{fmtShort(order.deliveredDate)}</p>
                            <p className="text-[10px] text-slate-400">Delivered</p>
                          </div>
                        ) : order.estimatedDelivery ? (
                          <div>
                            <p className="text-xs font-medium text-slate-700">{fmtShort(order.estimatedDelivery)}</p>
                            <p className="text-[10px] text-slate-400">Est. delivery</p>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3.5">
                        <ChevronRight size={14} className="text-slate-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over panel */}
      {selected !== undefined && (
        <OrderPanel
          order={selected}
          onClose={() => setSelected(undefined)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
