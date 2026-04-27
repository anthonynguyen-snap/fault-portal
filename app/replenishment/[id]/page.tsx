'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Truck, Package, Send, CheckCircle,
  Clock, AlertTriangle, Save, ExternalLink, Plus, Pencil, Lock, Copy,
} from 'lucide-react';
import { ReplenishmentRequest, ReplenishmentStatus, ReplenishmentLineItem, StockItem } from '@/types';
import { useToast } from '@/components/ui/Toast';

const STATUS_ORDER: ReplenishmentStatus[] = ['Pending', 'Ordered', 'Partially Dispatched', 'Dispatched', 'Delivered'];
const STORES = ['Adelaide Popup', 'Sydney Store'] as const;

const STATUS_STYLES: Record<ReplenishmentStatus, string> = {
  'Pending':             'bg-amber-100 text-amber-700 border-amber-200',
  'Ordered':             'bg-blue-100 text-blue-700 border-blue-200',
  'Partially Dispatched':'bg-orange-100 text-orange-700 border-orange-200',
  'Dispatched':          'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Delivered':           'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICONS: Record<ReplenishmentStatus, React.ReactNode> = {
  'Pending':             <Clock size={14} />,
  'Ordered':             <Package size={14} />,
  'Partially Dispatched':<Send size={14} />,
  'Dispatched':          <Send size={14} />,
  'Delivered':           <CheckCircle size={14} />,
};

export default function ReplenishmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { success, error: toastError } = useToast();

  const [request, setRequest]     = useState<ReplenishmentRequest | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Per-item state
  const [qtySent, setQtySent]       = useState<Record<string, number>>({});
  const [itemSource, setItemSource] = useState<Record<string, string>>({});
  const [itemSkipped, setItemSkipped] = useState<Record<string, boolean>>({});

  // Split dispatch panels
  const [showStoreroomDispatch, setShowStoreroomDispatch] = useState(false);
  const [showTplDispatch, setShowTplDispatch]             = useState(false);
  const [storeroomDate, setStoreroomDate]                 = useState(new Date().toISOString().slice(0, 10));
  const [tplTracking, setTplTracking]                     = useState('');
  const [tplDate, setTplDate]                             = useState(new Date().toISOString().slice(0, 10));

  // Add item to existing order
  const [showAddItem, setShowAddItem]     = useState(false);
  const [addItemId,   setAddItemId]       = useState('');
  const [addItemQty,  setAddItemQty]      = useState(1);
  const [addItemSrc,  setAddItemSrc]      = useState<'Storeroom' | '3PL'>('Storeroom');
  const [addItemSaving, setAddItemSaving] = useState(false);

  // Inline tracking update for 3PL card (post-dispatch)
  const [editTplTracking, setEditTplTracking]   = useState(false);
  const [tplTrackingInput, setTplTrackingInput] = useState('');
  const [savingTracking, setSavingTracking]     = useState(false);

  // Legacy single dispatch (kept for fallback)
  const [showDispatch, setShowDispatch] = useState(false);
  const [trackingNumber, setTracking]   = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));

  // Status edit
  const [editStatus, setEditStatus]     = useState<ReplenishmentStatus | null>(null);
  const [editNotes, setEditNotes]       = useState('');
  const [editOrderNum, setEditOrderNum] = useState('');
  const [editStore, setEditStore]       = useState<typeof STORES[number]>('Adelaide Popup');

  // Allow editing even after dispatch
  const [unlocked, setUnlocked] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [res, stockRes] = await Promise.all([
        fetch(`/api/replenishment/${id}`),
        fetch('/api/stock/items'),
      ]);
      const stockJson = await stockRes.json();
      setStockItems(stockJson.data ?? []);
      const json = await res.json();
      const req: ReplenishmentRequest = json.data;
      setRequest(req);
      // Initialise per-item state
      const sentMap:    Record<string, number>  = {};
      const srcMap:     Record<string, string>  = {};
      const skippedMap: Record<string, boolean> = {};
      req.items.forEach(item => {
        sentMap[item.id]    = item.quantitySent || item.quantityRequested;
        srcMap[item.id]     = item.source;
        skippedMap[item.id] = item.skipped ?? false;
      });
      setQtySent(sentMap);
      setItemSource(srcMap);
      setItemSkipped(skippedMap);
      setTracking(req.trackingNumber ?? '');
      setDispatchDate(req.dispatchDate ?? new Date().toISOString().slice(0, 10));
      setEditStatus(req.status as ReplenishmentStatus);
      setEditNotes(req.notes ?? '');
      setEditOrderNum(req.orderNumber ?? '');
      setEditStore((req.store as typeof STORES[number]) ?? 'Adelaide Popup');
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
        body: JSON.stringify({ status: editStatus, notes: editNotes, orderNumber: editOrderNum, store: editStore }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequest(json.data);
      success('Saved', 'Request updated.');
    } catch (err: unknown) {
      toastError('Save failed', err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  async function toggleSkip(itemId: string) {
    const newSkipped = !itemSkipped[itemId];
    setItemSkipped(prev => ({ ...prev, [itemId]: newSkipped }));
    // Persist immediately
    await fetch(`/api/replenishment/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toggleSkipped: { id: itemId, skipped: newSkipped } }),
    });
  }

  async function handleDispatch() {
    if (!request) return;
    setSaving(true);
    try {
      const itemUpdates = request.items.map(item => ({
        id:           item.id,
        stockItemId:  item.stockItemId,
        quantitySent: qtySent[item.id] ?? item.quantityRequested,
        source:       itemSource[item.id] ?? item.source,
        skipped:      itemSkipped[item.id] ?? item.skipped ?? false,
      }));
      const res = await fetch(`/api/replenishment/${id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchSource: 'All', trackingNumber, dispatchDate, itemUpdates, store: request.store }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      success('Dispatched!', `Tracking: ${trackingNumber || '—'}`);
      await load();
      setShowDispatch(false);
    } catch (err: unknown) {
      toastError('Dispatch failed', err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  async function handleSplitDispatch(dispatchSource: 'Storeroom' | '3PL') {
    if (!request) return;
    setSaving(true);
    const tracking = dispatchSource === 'Storeroom' ? '' : tplTracking;
    const date     = dispatchSource === 'Storeroom' ? storeroomDate     : tplDate;
    try {
      const itemUpdates = request.items.map(item => ({
        id:           item.id,
        stockItemId:  item.stockItemId,
        quantitySent: qtySent[item.id] ?? item.quantityRequested,
        source:       itemSource[item.id] ?? item.source,
        skipped:      itemSkipped[item.id] ?? item.skipped ?? false,
      }));
      const res = await fetch(`/api/replenishment/${id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchSource, trackingNumber: tracking, dispatchDate: date, itemUpdates, store: request.store }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const label = dispatchSource === 'Storeroom' ? 'Storeroom dispatched' : '3PL dispatched';
      success(label, `Tracking: ${tracking || '—'}`);
      await load();
      setShowStoreroomDispatch(false);
      setShowTplDispatch(false);
    } catch (err: unknown) {
      toastError('Dispatch failed', err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  async function saveTplTracking() {
    if (!request) return;
    setSavingTracking(true);
    try {
      const res = await fetch(`/api/replenishment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tplTracking: tplTrackingInput }),
      });
      if (!res.ok) throw new Error();
      success('Tracking saved');
      await load();
      setEditTplTracking(false);
    } catch {
      toastError('Failed to save tracking');
    } finally { setSavingTracking(false); }
  }

  async function saveAddItem() {
    if (!request || !addItemId) return;
    const stock = stockItems.find(s => s.id === addItemId);
    if (!stock) return;
    setAddItemSaving(true);
    try {
      const res = await fetch(`/api/replenishment/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addItem: {
            stockItemId:       stock.id,
            stockItemName:     stock.name,
            sku:               stock.sku,
            quantityRequested: addItemQty,
            quantityOnHand:    stock.quantity,
            source:            addItemSrc,
          },
        }),
      });
      if (!res.ok) throw new Error();
      success('Item added');
      await load();
      setShowAddItem(false);
      setAddItemId(''); setAddItemQty(1); setAddItemSrc('Storeroom');
    } catch {
      toastError('Failed to add item');
    } finally { setAddItemSaving(false); }
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

  const isDispatched = (request.status === 'Dispatched' || request.status === 'Delivered') && !unlocked;

  const storeroomItems = request.items.filter(i =>
    !(itemSkipped[i.id] ?? i.skipped) && (itemSource[i.id] ?? i.source) === 'Storeroom'
  );
  const activeStoreroomItems = storeroomItems; // non-skipped storeroom items
  const activeTplItems = request.items.filter(i =>
    !(itemSkipped[i.id] ?? i.skipped) && (itemSource[i.id] ?? i.source) === '3PL'
  );
  const isMixedSource = activeStoreroomItems.length > 0 && activeTplItems.length > 0;
  const activeItems = request.items.filter(i => !(itemSkipped[i.id] ?? i.skipped));
  const totalSent   = activeItems.reduce((s, i) => s + (qtySent[i.id] ?? i.quantityRequested), 0);

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
          {!isDispatched ? (
            <select
              value={editStore}
              onChange={e => setEditStore(e.target.value as typeof STORES[number])}
              className="form-input text-sm py-1">
              {STORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              request.store === 'Adelaide Popup' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
            }`}>{request.store}</span>
          )}
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

      {/* Split dispatch info cards */}
      {(request.storeroomDispatched || request.tplDispatched ||
        request.status === 'Dispatched' || request.status === 'Partially Dispatched') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Storeroom panel */}
          {activeStoreroomItems.length > 0 && (
            <div className={`card p-4 flex items-start gap-3 ${request.storeroomDispatched ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50'}`}>
              <div className={`mt-0.5 ${request.storeroomDispatched ? 'text-emerald-600' : 'text-slate-300'}`}>
                {request.storeroomDispatched ? <CheckCircle size={18} /> : <Clock size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${request.storeroomDispatched ? 'text-emerald-800' : 'text-slate-500'}`}>
                  Storeroom — {request.storeroomDispatched ? 'Dispatched' : 'Pending'}
                </p>
                {request.storeroomDispatched ? (
                  <>
                    <p className="text-xs text-emerald-600 mt-0.5">Date: {request.storeroomDispatchDate}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Stock deducted ✓</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">{activeStoreroomItems.length} item{activeStoreroomItems.length !== 1 ? 's' : ''} to dispatch</p>
                )}
              </div>
            </div>
          )}
          {/* 3PL panel */}
          {activeTplItems.length > 0 && (
            <div className={`card p-4 flex items-start gap-3 ${request.tplDispatched ? 'bg-sky-50 border-sky-200' : 'bg-slate-50'}`}>
              <div className={`mt-0.5 ${request.tplDispatched ? 'text-sky-600' : 'text-slate-300'}`}>
                {request.tplDispatched ? <CheckCircle size={18} /> : <Clock size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${request.tplDispatched ? 'text-sky-800' : 'text-slate-500'}`}>
                  3PL — {request.tplDispatched ? 'Dispatched' : 'Pending'}
                </p>
                {request.tplDispatched ? (
                  <>
                    <p className="text-xs text-sky-600 mt-0.5">Date: {request.tplDispatchDate}</p>
                    {request.tplTracking ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <a
                          href={`https://auspost.com.au/mypost/track/#/details/${request.tplTracking}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono text-sky-700 hover:text-sky-900 underline truncate flex items-center gap-1"
                        >
                          {request.tplTracking} <ExternalLink size={10} />
                        </a>
                        <button
                          onClick={() => { setTplTrackingInput(request.tplTracking); setEditTplTracking(true); }}
                          className="text-[10px] text-sky-400 hover:text-sky-600 underline transition-colors"
                        >edit</button>
                      </div>
                    ) : editTplTracking ? (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <input
                          autoFocus
                          value={tplTrackingInput}
                          onChange={e => setTplTrackingInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveTplTracking(); if (e.key === 'Escape') setEditTplTracking(false); }}
                          placeholder="Enter tracking ref…"
                          className="text-xs font-mono border border-sky-300 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                        <button onClick={saveTplTracking} disabled={savingTracking || !tplTrackingInput}
                          className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-2 py-1 rounded transition-colors disabled:opacity-40">
                          {savingTracking ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setEditTplTracking(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setTplTrackingInput(''); setEditTplTracking(true); }}
                        className="mt-1 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors"
                      >
                        <AlertTriangle size={11} /> Add tracking number
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">{activeTplItems.length} item{activeTplItems.length !== 1 ? 's' : ''} to dispatch</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items table */}
      <div className="card overflow-clip">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Items</h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 inline-block" /> Storeroom
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-200 inline-block" /> 3PL
            </span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {!isDispatched && <th className="w-8 px-2 py-2.5" />}
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requested</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item: ReplenishmentLineItem, idx) => {
              const skipped = itemSkipped[item.id] ?? item.skipped ?? false;
              const source  = itemSource[item.id] ?? item.source;
              const onHand  = item.quantityOnHand;
              const short   = onHand < item.quantityRequested;
              return (
                <tr key={item.id} className={`border-b border-slate-50 last:border-0 transition-colors ${
                  skipped
                    ? 'bg-red-50/60'
                    : source === 'Storeroom'
                      ? 'bg-emerald-50/40'
                      : 'bg-sky-50/30'
                }`}>
                  {!isDispatched && (
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => toggleSkip(item.id)}
                        title={skipped ? 'Restore item' : 'Mark as out of stock'}
                        className={`text-base leading-none transition-colors ${skipped ? 'text-red-400 hover:text-slate-400' : 'text-slate-300 hover:text-red-400'}`}>
                        {skipped ? '↩' : '⊘'}
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${skipped ? 'line-through text-red-400' : 'text-slate-800'}`}>{item.stockItemName}</span>
                      {skipped && <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-600">OOS</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {source === '3PL' ? (
                      <span className="font-mono text-sm text-slate-300">—</span>
                    ) : (
                      <>
                        <span className={`font-mono text-sm font-semibold ${
                          skipped ? 'text-slate-300' :
                          onHand === 0 ? 'text-red-500' : short ? 'text-amber-500' : 'text-emerald-600'
                        }`}>{onHand}</span>
                        {!skipped && short && <span className="text-[10px] text-amber-500 block">short {item.quantityRequested - onHand}</span>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-sm font-semibold text-slate-700">{item.quantityRequested}</td>
                  <td className="px-4 py-3 text-center">
                    {skipped ? (
                      <span className="text-slate-300 font-mono text-sm">—</span>
                    ) : isDispatched ? (
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
                        source === 'Storeroom'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}>{source}</span>
                    ) : (
                      <select
                        value={source}
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
              <td colSpan={3} className="px-4 py-2.5 text-xs text-slate-500 font-medium">
                Totals
              </td>
              <td className="px-4 py-2.5 text-center font-mono text-sm font-bold text-slate-800">
                {request.items.filter(i => !(itemSkipped[i.id] ?? i.skipped)).reduce((s, i) => s + i.quantityRequested, 0)}
              </td>
              <td className="px-4 py-2.5 text-center font-mono text-sm font-bold text-slate-800">
                {isDispatched
                  ? request.items.filter(i => !(itemSkipped[i.id] ?? i.skipped)).reduce((s, i) => s + i.quantitySent, 0)
                  : totalSent}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        {/* Add item row */}
        {!isDispatched && (
          <div className="border-t border-slate-100 px-4 py-3">
            {showAddItem ? (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={addItemId}
                  onChange={e => setAddItemId(e.target.value)}
                  className="form-input text-xs py-1.5 flex-1 min-w-48">
                  <option value="">Select product…</option>
                  {stockItems.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.sku})</option>
                  ))}
                </select>
                <input
                  type="number" min={1}
                  value={addItemQty}
                  onChange={e => setAddItemQty(parseInt(e.target.value) || 1)}
                  className="form-input text-xs py-1.5 w-20 text-center font-mono"
                  placeholder="Qty"
                />
                <select
                  value={addItemSrc}
                  onChange={e => setAddItemSrc(e.target.value as 'Storeroom' | '3PL')}
                  className="form-input text-xs py-1.5 w-28">
                  <option value="Storeroom">Storeroom</option>
                  <option value="3PL">3PL</option>
                </select>
                <button onClick={saveAddItem} disabled={addItemSaving || !addItemId}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                  {addItemSaving ? 'Adding…' : 'Add'}
                </button>
                <button onClick={() => { setShowAddItem(false); setAddItemId(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowAddItem(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-600 font-medium transition-colors">
                <Plus size={13} /> Add item
              </button>
            )}
          </div>
        )}
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
          <div className="flex items-center gap-2">
            <button onClick={handleStatusSave} disabled={saving} className="btn-secondary flex items-center gap-2">
              <Save size={14} /> Save Changes
            </button>
            <button
              onClick={() => router.push(`/replenishment?duplicate=${request.id}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
              <Copy size={14} /> Duplicate
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isMixedSource ? (
              <>
                {!request.storeroomDispatched && (
                  <button onClick={() => setShowStoreroomDispatch(true)} disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                    <Send size={14} /> Dispatch Storeroom
                  </button>
                )}
                {!request.tplDispatched && (
                  <button onClick={() => setShowTplDispatch(true)} disabled={saving}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors">
                    <Send size={14} /> Dispatch 3PL
                  </button>
                )}
              </>
            ) : (
              <button onClick={() => setShowDispatch(true)} disabled={saving} className="btn-primary flex items-center gap-2">
                <Send size={14} /> Mark as Dispatched
              </button>
            )}
          </div>
        </div>
      )}

      {(request.status === 'Dispatched' || request.status === 'Delivered' || request.status === 'Partially Dispatched') && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={handleStatusSave} disabled={saving} className="btn-secondary flex items-center gap-2">
              <Save size={14} /> Save Changes
            </button>
            <button
              onClick={() => setUnlocked(u => !u)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                unlocked
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
              {unlocked ? <><Lock size={14} /> Lock</> : <><Pencil size={14} /> Edit</>}
            </button>
            <button
              onClick={() => router.push(`/replenishment?duplicate=${request.id}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
              <Copy size={14} /> Duplicate
            </button>
          </div>
          <button
            onClick={() => router.push(`/replenishment?new=1&store=${encodeURIComponent(request.store)}`)}
            className="btn-primary flex items-center gap-2">
            <Plus size={14} /> New Request for {request.store}
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
                {storeroomItems.length > 0 && (
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
              {storeroomItems.length > 0 && (
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

      {/* ── Storeroom dispatch modal ────────────────────────────────────────── */}
      {showStoreroomDispatch && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Dispatch Storeroom Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">{activeStoreroomItems.length} item{activeStoreroomItems.length !== 1 ? 's' : ''} · stock will be deducted</p>
              </div>
              <button onClick={() => setShowStoreroomDispatch(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Dispatch Date</label>
                <input type="date" value={storeroomDate} onChange={e => setStoreroomDate(e.target.value)} className="form-input" />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Storeroom deduction</p>
                {activeStoreroomItems.map(i => (
                  <p key={i.id} className="text-xs text-emerald-600 font-mono">
                    {i.stockItemName} — {qtySent[i.id] ?? i.quantityRequested} units
                  </p>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowStoreroomDispatch(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleSplitDispatch('Storeroom')} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                <Send size={14} /> {saving ? 'Dispatching…' : 'Confirm Storeroom Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3PL dispatch modal ──────────────────────────────────────────────── */}
      {showTplDispatch && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Dispatch 3PL Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">{activeTplItems.length} item{activeTplItems.length !== 1 ? 's' : ''} · fulfilled by 3PL warehouse</p>
              </div>
              <button onClick={() => setShowTplDispatch(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">3PL Order Reference / Tracking</label>
                <input value={tplTracking} onChange={e => setTplTracking(e.target.value)}
                  className="form-input font-mono" placeholder="e.g. 3PL-ORD-20260427" />
              </div>
              <div>
                <label className="form-label">Dispatch Date</label>
                <input type="date" value={tplDate} onChange={e => setTplDate(e.target.value)} className="form-input" />
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-sky-700 mb-1">3PL items</p>
                {activeTplItems.map(i => (
                  <p key={i.id} className="text-xs text-sky-600 font-mono">
                    {i.stockItemName} — {qtySent[i.id] ?? i.quantityRequested} units
                  </p>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowTplDispatch(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleSplitDispatch('3PL')} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors">
                <Send size={14} /> {saving ? 'Dispatching…' : 'Confirm 3PL Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
