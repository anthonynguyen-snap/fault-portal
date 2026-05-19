'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  PackageOpen, Plus, X, CheckCircle2, Clock, Truck, AlertTriangle,
  Pencil, Trash2, ChevronDown, RefreshCw, CheckCheck, Sparkles,
} from 'lucide-react';
import { RestockItem, RestockStatus } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

const STATUSES: RestockStatus[] = ['Out of Stock', 'Backordered', 'On Order', 'New Release', 'Back in Stock'];

const STATUS_STYLES: Record<RestockStatus, string> = {
  'Out of Stock':  'bg-red-100 text-red-700',
  'Backordered':   'bg-amber-100 text-amber-700',
  'On Order':      'bg-blue-100 text-blue-700',
  'New Release':   'bg-purple-100 text-purple-700',
  'Back in Stock': 'bg-emerald-100 text-emerald-700',
};

const STATUS_ICONS: Record<RestockStatus, React.ReactNode> = {
  'Out of Stock':  <AlertTriangle size={11} />,
  'Backordered':   <Clock size={11} />,
  'On Order':      <Truck size={11} />,
  'New Release':   <Sparkles size={11} />,
  'Back in Stock': <CheckCircle2 size={11} />,
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d + 'T00:00:00').getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function blankItem(): Partial<RestockItem> {
  return {
    productName: '',
    sku: '',
    status: 'Out of Stock',
    expectedRestockDate: null,
    supplier: '',
    notes: '',
  };
}

// ── Slide-over ─────────────────────────────────────────────────────────────────
function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

export default function RestockTrackerPage() {
  const [items, setItems]     = useState<RestockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saveOk, setSaveOk]   = useState(false);

  // Panel state
  const [panel, setPanel]         = useState<'add' | 'edit' | null>(null);
  const [editingItem, setEditItem] = useState<RestockItem | null>(null);
  const [form, setForm]           = useState<Partial<RestockItem>>(blankItem());

  // Filter
  const [filterStatus, setFilterStatus] = useState<RestockStatus | 'Active' | 'All'>('Active');
  const [showResolved, setShowResolved] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch('/api/stock/restock');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(json.data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(blankItem());
    setEditItem(null);
    setPanel('add');
  }

  function openEdit(item: RestockItem) {
    setEditItem(item);
    setForm({
      productName:         item.productName,
      sku:                 item.sku,
      status:              item.status,
      expectedRestockDate: item.expectedRestockDate,
      supplier:            item.supplier,
      notes:               item.notes,
    });
    setPanel('edit');
  }

  function closePanel() {
    setPanel(null);
    setEditItem(null);
    setForm(blankItem());
  }

  async function submitAdd() {
    if (!form.productName?.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/stock/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(prev => [json.data, ...prev]);
      closePanel();
      flashOk();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit() {
    if (!editingItem || !form.productName?.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/stock/restock/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(prev => prev.map(i => i.id === editingItem.id ? json.data : i));
      closePanel();
      flashOk();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function markResolved(item: RestockItem) {
    const next = !item.resolved;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, resolved: next } : i));
    try {
      await fetch(`/api/stock/restock/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: next }),
      });
    } catch {
      // revert on failure
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, resolved: !next } : i));
    }
  }

  async function updateStatus(item: RestockItem, status: RestockStatus) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status } : i));
    await fetch(`/api/stock/restock/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this item from the restock tracker?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/stock/restock/${id}`, { method: 'DELETE' });
  }

  function flashOk() {
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  }

  // Computed lists
  const activeItems   = useMemo(() => items.filter(i => !i.resolved), [items]);
  const resolvedItems = useMemo(() => items.filter(i => i.resolved), [items]);

  const filteredActive = useMemo(() => {
    if (filterStatus === 'All' || filterStatus === 'Active') return activeItems;
    return activeItems.filter(i => i.status === filterStatus);
  }, [activeItems, filterStatus]);

  const outCount        = useMemo(() => activeItems.filter(i => i.status === 'Out of Stock').length, [activeItems]);
  const backordCount    = useMemo(() => activeItems.filter(i => i.status === 'Backordered').length, [activeItems]);
  const onOrderCount    = useMemo(() => activeItems.filter(i => i.status === 'On Order').length, [activeItems]);
  const newReleaseCount = useMemo(() => activeItems.filter(i => i.status === 'New Release').length, [activeItems]);
  const backInCount     = useMemo(() => activeItems.filter(i => i.status === 'Back in Stock').length, [activeItems]);

  // Form helpers
  function setField<K extends keyof RestockItem>(key: K, val: RestockItem[K] | null) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  const FormPanel = (
    <div className="space-y-5">
      <div>
        <label className="form-label">Product Name <span className="text-red-500">*</span></label>
        <input
          value={form.productName ?? ''}
          onChange={e => setField('productName', e.target.value)}
          className="form-input"
          placeholder="e.g. SNAP 12V Dual Battery"
          autoFocus
        />
      </div>
      <div>
        <label className="form-label">SKU</label>
        <input
          value={form.sku ?? ''}
          onChange={e => setField('sku', e.target.value)}
          className="form-input font-mono"
          placeholder="e.g. SNAP-DB-12V"
        />
      </div>
      <div>
        <label className="form-label">Status</label>
        <select
          value={form.status ?? 'Out of Stock'}
          onChange={e => setField('status', e.target.value as RestockStatus)}
          className="form-input"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Expected Restock Date</label>
        <input
          type="date"
          value={form.expectedRestockDate ?? ''}
          onChange={e => setField('expectedRestockDate', e.target.value || null)}
          className="form-input"
        />
      </div>
      <div>
        <label className="form-label">Supplier</label>
        <input
          value={form.supplier ?? ''}
          onChange={e => setField('supplier', e.target.value)}
          className="form-input"
          placeholder="e.g. Narva, Redarc, ARB..."
        />
      </div>
      <div>
        <label className="form-label">Notes</label>
        <textarea
          value={form.notes ?? ''}
          onChange={e => setField('notes', e.target.value)}
          className="form-input min-h-[80px] resize-y"
          placeholder="e.g. Awaiting container from China, ETA mid-June"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={panel === 'add' ? submitAdd : submitEdit}
          disabled={!form.productName?.trim() || saving}
          className="btn-primary flex-1 justify-center"
        >
          {saving ? 'Saving…' : panel === 'add' ? 'Add to Tracker' : 'Save Changes'}
        </button>
        <button onClick={closePanel} className="btn-secondary px-4">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <PackageOpen size={22} className="text-brand-600" />
            Restock Tracker
          </h1>
          <p className="page-subtitle">Track out-of-stock, backordered, and new release products at the 3PL</p>
        </div>
        <div className="flex items-center gap-2">
          {saveOk && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
              <CheckCircle2 size={13} /> Saved
            </span>
          )}
          <button onClick={load} className="btn-secondary">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Out of Stock',  count: outCount,        style: 'border-red-200 bg-red-50',        text: 'text-red-600' },
          { label: 'Backordered',   count: backordCount,    style: 'border-amber-200 bg-amber-50',    text: 'text-amber-600' },
          { label: 'On Order',      count: onOrderCount,    style: 'border-blue-200 bg-blue-50',      text: 'text-blue-600' },
          { label: 'New Release',   count: newReleaseCount, style: 'border-purple-200 bg-purple-50',  text: 'text-purple-600' },
          { label: 'Back in Stock', count: backInCount,     style: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-600' },
        ].map(({ label, count, style, text }) => (
          <button
            key={label}
            onClick={() => setFilterStatus(filterStatus === label as RestockStatus ? 'Active' : label as RestockStatus)}
            className={`card p-4 text-left transition-all ${
              filterStatus === label ? 'ring-2 ring-brand-400' : ''
            } ${count > 0 ? style : ''}`}
          >
            <p className={`text-2xl font-bold ${count > 0 ? text : 'text-slate-400'}`}>{count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Active items table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Active Items</h2>
            <p className="text-xs text-slate-400 mt-0.5">{filteredActive.length} item{filteredActive.length !== 1 ? 's' : ''}</p>
          </div>
          {filterStatus !== 'Active' && filterStatus !== 'All' && (
            <button
              onClick={() => setFilterStatus('Active')}
              className="text-xs text-brand-600 hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : filteredActive.length === 0 ? (
          <div className="py-16 text-center">
            <PackageOpen size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">
              {activeItems.length === 0 ? 'No items being tracked' : 'No items match this filter'}
            </p>
            {activeItems.length === 0 && (
              <>
                <p className="text-xs text-slate-400 mt-1 mb-4">Add a product that&apos;s currently out of stock at the 3PL</p>
                <button onClick={openAdd} className="btn-primary">
                  <Plus size={14} /> Add Item
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Est. Restock</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                  <th className="px-5 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {filteredActive.map(item => {
                  const days = daysUntil(item.expectedRestockDate);
                  const overdue = days !== null && days < 0;
                  const soon    = days !== null && days >= 0 && days <= 7;
                  return (
                    <tr key={item.id} className="group border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{item.productName}</p>
                        {item.sku && <p className="text-[11px] font-mono text-slate-400 mt-0.5">{item.sku}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="relative group/status">
                          <span className={`badge flex items-center gap-1 cursor-pointer select-none ${STATUS_STYLES[item.status]}`}>
                            {STATUS_ICONS[item.status]}
                            {item.status}
                            <ChevronDown size={10} className="opacity-60" />
                          </span>
                          {/* Status dropdown */}
                          <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover/status:block">
                            <div className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[160px]">
                              {STATUSES.map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateStatus(item, s)}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${item.status === s ? 'font-semibold text-brand-700 bg-brand-50' : 'text-slate-700'}`}
                                >
                                  {STATUS_ICONS[s]} {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {item.expectedRestockDate ? (
                          <div>
                            <p className={`text-sm font-medium ${overdue ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-700'}`}>
                              {fmtDate(item.expectedRestockDate)}
                            </p>
                            <p className={`text-[11px] mt-0.5 ${overdue ? 'text-red-500' : soon ? 'text-amber-500' : 'text-slate-400'}`}>
                              {overdue
                                ? `${Math.abs(days!)} day${Math.abs(days!) !== 1 ? 's' : ''} overdue`
                                : days === 0
                                ? 'Due today'
                                : `${days} day${days !== 1 ? 's' : ''} away`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">No date set</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{item.supplier || <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[200px]">
                        {item.notes ? (
                          <span className="line-clamp-2">{item.notes}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => markResolved(item)}
                            title="Mark as resolved"
                            className="btn-ghost p-1.5 text-emerald-600 hover:bg-emerald-50"
                          >
                            <CheckCheck size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            className="btn-ghost p-1.5"
                            title="Edit"
                          >
                            <Pencil size={13} className="text-slate-400" />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="btn-ghost p-1.5"
                            title="Delete"
                          >
                            <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved items (collapsible) */}
      {resolvedItems.length > 0 && (
        <div className="card overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 text-left hover:bg-slate-50 transition-colors"
            onClick={() => setShowResolved(v => !v)}
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-600">Resolved</h2>
              <p className="text-xs text-slate-400 mt-0.5">{resolvedItems.length} item{resolvedItems.length !== 1 ? 's' : ''} — click to {showResolved ? 'hide' : 'show'}</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${showResolved ? 'rotate-180' : ''}`} />
          </button>

          {showResolved && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <tbody>
                  {resolvedItems.map(item => (
                    <tr key={item.id} className="group border-b border-slate-50 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-500 line-through">{item.productName}</p>
                        {item.sku && <p className="text-[11px] font-mono text-slate-300 mt-0.5">{item.sku}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge bg-slate-100 text-slate-400">Resolved</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">{fmtDate(item.expectedRestockDate)}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">{item.supplier || '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-400 max-w-[200px] line-clamp-1">{item.notes || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => markResolved(item)}
                            title="Unmark as resolved"
                            className="btn-ghost p-1.5 text-slate-400 hover:text-amber-600"
                          >
                            <CheckCheck size={14} />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="btn-ghost p-1.5">
                            <Trash2 size={13} className="text-slate-300 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit slide-over */}
      <SlideOver
        open={panel !== null}
        onClose={closePanel}
        title={panel === 'add' ? 'Add Item to Tracker' : 'Edit Item'}
      >
        {FormPanel}
      </SlideOver>
    </div>
  );
}
