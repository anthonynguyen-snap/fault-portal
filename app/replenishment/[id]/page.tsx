'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Truck, Package, Send, CheckCircle,
  Clock, AlertTriangle, Save, ExternalLink,
} from 'lucide-react';
import { ReplenishmentRequest, ReplenishmentStatus, ReplenishmentLineItem } from '@/types';
import { useToast } from '@/components/ui/Toast';

const STATUS_ORDER: ReplenishmentStatus[] = ['Pending', 'Ordered', 'Dispatched', 'Delivered'];

const STATUS_STYLES: Record<ReplenishmentStatus, string> = {
  Pending:    'bg-amber-100 text-amber-700 border-amber-200',
  Ordered:    'bg-blue-100 text-blue-700 border-blue-200',
  Dispatched: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Delivered:  'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICONS: Record<ReplenishmentStatus, React.ReactNode> = {
  Pending:    <Clock size={14} />,
  Ordered:    <Package size={14} />,
  Dispatched: <Send size={14} />,
  Delivered:  <CheckCircle size={14} />,
};

export default function ReplenishmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { success, error: toastError } = useToast();

  const [request, setRequest] = useState<ReplenishmentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Dispatch form state — qty sent per item + tracking
  const [qtySent, setQtySent]         = useState<Record<string, number>>({});
  const [itemSource, setItemSource]   = useState<Record<string, string>>({});
  const [trackingNumber, setTracking] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [showDispatch, setShowDispatch] = useState(false);

  // Status edit
  const [editStatus, setEditStatus] = useState<ReplenishmentStatus | null>(null);
  const [editNotes, setEditNotes]   = useState('');
  const [editOrderNum, setEditOrderNum] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/replenishment/${id}`);
      const json = await res.json();
      const req: ReplenishmentRequest = json.data;
      setRequest(req);
      // Initialise per-item state
      const sentMap: Record<string, number> = {};
      const srcMap:  Record<string, string> = {};
      req.items.forEach(item => {
        sentMap[item.id] = item.quantitySent || item.quantityRequested;
        srcMap[item.id]  = item.source;
      });
      setQtySent(sentMap);
      setItemSource(srcMap);
      setTracking(req.trackingNumber ?? '');
      setDispatchDate(req.dispatchDate ?? new Date().toISOString().slice(0, 10));
      setEditStatus(req.status as ReplenishmentStatus);
      setEditNotes(req.notes ?? '');
      setEditOrderNum(req.orderNumber ?? '');
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusSave() {
    if (!request || !editStatus) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/replenishment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, notes: editNotes, orderNumber: editOrderNum }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequest(json.data);
      success('Saved', 'Request updated.');
    } catch (err: unknown) {
      toastError('Save failed', err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  async function handleDispatch() {
    if (!request) return;
    setSaving(true);
    try {
      const itemUpdates = request.items.map(item => ({
        id:          item.id,
        stockItemId: item.stockItemId,
        quantitySent: qtySent[item.id] ?? item.quantityRequested,
        source:      itemSource[item.id] ?? item.source,
      }));

      const res = await fetch(`/api/replenishment/${id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, dispatchDate, itemUpdates, store: request.store }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      success('Dispatched!', `Stock deducted from storeroom. Tracking: ${trackingNumber || '—'}`);
      await load();
      setShowDispatch(false);
    } catch (err: unknown) {
      toastError('Dispatch failed', err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="card p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500">Request not found.</p>
          <button onClick={() => router.back()} className="btn-secondary mt-4">Go back</button>
        </div>
      </div>
    );
  }

  const isDispatched = request.status === 'Dispatched' || request.status === 'Delivered';
  const isAdelaide   = request.store === 'Adelaide Popup';

  const storeroomItems = request.items.filter(i => (itemSource[i.id] ?? i.source) === 'Storeroom');
  const totalSent      = request.items.reduce((s, i) => s + (qtySent[i.id] ?? i.quantityRequested), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/replenishment')}
          className="btn-ghost p-1.5 text-slate-400 hover:text-slate-700">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <Truck size={20} className="text-brand-600" />
            Replenishment — {request.store}
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{request.date} · {request.items.length} items · {request.items.reduce((s,i) => s + i.quantityRequested, 0)} units</p>
        </div>
      </div>

      {/* Meta card */}
      <div className="card p-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Store</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            request.store === 'Adelaide Popup' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
          }`}>{request.store}</span>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Order #</p>
          <div className="flex items-center gap-2">
            <input value={editOrderNum} onChange={e => setEditOrderNum(e.target.value)}
              className="form-input text-xs py-1 font-mono w-full" placeholder="—" />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Requested by</p>
          <p className="text-sm font-medium text-slate-800">{request.requestedBy || <span className="text-slate-300">—</span>}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Status</p>
          <select value={editStatus ?? request.status}
            onChange={e => setEditStatus(e.target.value as ReplenishmentStatus)}
            className={`text-xs font-medium rounded-full px-2.5 py-1 border cursor-pointer appearance-none focus:ring-2 focus:ring-brand-400 focus:outline-none ${STATUS_STYLES[editStatus ?? request.status as ReplenishmentStatus]}`}>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Dispatch info (if already dispatched) */}
      {isDispatched && (
        <div className="card p-4 flex items-center gap-4 bg-emerald-50 border-emerald-200">
          <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-800">Dispatched on {request.dispatchDate}</p>
            {request.trackingNumber && (
              <p className="text-emerald-600 text-xs font-mono mt-0.5">Tracking: {request.trackingNumber}</p>
            )}
          </div>
          {isAdelaide && (
            <p className="text-xs text-emerald-600 flex-shrink-0">Storeroom deducted ✓</p>
          )}
        </div>
      )}

      {/* Items table */}
      <div className="card overflow-clip">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Items</h2>
          {isAdelaide && (
            <span className="text-xs text-slate-400">On-hand figures from storeroom</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
              {isAdelaide && <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>}
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requested</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item: ReplenishmentLineItem, idx) => {
              const onHand  = item.quantityOnHand;
              const short   = onHand < item.quantityRequested;
              return (
                <tr key={item.id} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.stockItemName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku || '—'}</td>
                  {isAdelaide && (
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-sm font-semibold ${
                        onHand === 0 ? 'text-red-500' : short ? 'text-amber-500' : 'text-emerald-600'
                      }`}>{onHand}</span>
                      {short && <span className="text-[10px] text-amber-500 block">short {item.quantityRequested - onHand}</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center font-mono text-sm font-semibold text-slate-700">{item.quantityRequested}</td>
                  <td className="px-4 py-3 text-center">
                    {isDispatched ? (
                      <span className="font-mono text-sm font-semibold text-slate-700">{item.quantitySent}</span>
                    ) : (
                      <input
                        type="number" min={0}
                        value={qtySent[item.id] ?? item.quantityRequested}
                        onChange={e => setQtySent(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                        className="form-input text-xs py-1 text-center font-mono w-16 mx-auto"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isDispatched ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        (itemSource[item.id] ?? item.source) === 'Storeroom'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>{itemSource[item.id] ?? item.source}</span>
                    ) : (
                      <select
                        value={itemSource[item.id] ?? item.source}
                        onChange={e => setItemSource(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="form-input text-xs py-1 w-28 mx-auto">
                        <option value="Storeroom">Storeroom</option>
                        <option value="3PL">3PL</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={isAdelaide ? 3 : 2} className="px-4 py-2.5 text-xs text-slate-500 font-medium">
                Totals
              </td>
              <td className="px-4 py-2.5 text-center font-mono text-sm font-bold text-slate-800">
                {request.items.reduce((s, i) => s + i.quantityRequested, 0)}
              </td>
              <td className="px-4 py-2.5 text-center font-mono text-sm font-bold text-slate-800">
                {isDispatched
                  ? request.items.reduce((s, i) => s + i.quantitySent, 0)
                  : totalSent}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <label className="form-label">Notes</label>
        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
          rows={2} className="form-input resize-none" placeholder="Any context or follow-up notes…" />
      </div>

      {/* Actions */}
      {!isDispatched && (
        <div className="flex items-center justify-between">
          <button onClick={handleStatusSave} disabled={saving} className="btn-secondary flex items-center gap-2">
            <Save size={14} /> Save Changes
          </button>
          <button
            onClick={() => setShowDispatch(true)}
            disabled={saving}
            className="btn-primary flex items-center gap-2">
            <Send size={14} /> Mark as Dispatched
          </button>
        </div>
      )}

      {isDispatched && (
        <div className="flex justify-start">
          <button onClick={handleStatusSave} disabled={saving} className="btn-secondary flex items-center gap-2">
            <Save size={14} /> Save Notes / Order #
          </button>
        </div>
      )}

      {/* ── Dispatch confirmation panel ───────────────────────────────────── */}
      {showDispatch && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Confirm Dispatch</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                This will mark the request as <strong>Dispatched</strong>
                {isAdelaide && storeroomItems.length > 0 && (
                  <> and deduct <strong>{storeroomItems.reduce((s, i) => s + (qtySent[i.id] ?? i.quantityRequested), 0)} storeroom units</strong> from stock</>
                )}.
              </p>
              <div>
                <label className="form-label">Tracking Number <span className="text-slate-400 font-normal">(optional)</span></label>
                <input value={trackingNumber} onChange={e => setTracking(e.target.value)}
                  className="form-input font-mono" placeholder="e.g. AUS123456789" />
              </div>
              <div>
                <label className="form-label">Dispatch Date</label>
                <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="form-input" />
              </div>
              {isAdelaide && storeroomItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Storeroom deduction preview</p>
                  {storeroomItems.map(i => (
                    <p key={i.id} className="text-xs text-amber-600 font-mono">
                      {i.stockItemName} — {qtySent[i.id] ?? i.quantityRequested} units
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowDispatch(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleDispatch} disabled={saving} className="btn-primary flex items-center gap-2">
                <Send size={14} /> {saving ? 'Dispatching…' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
