'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  Package, Plus, X, ArrowDownCircle, ArrowUpCircle,
  ChevronDown, ChevronUp, AlertTriangle, Pencil, Trash2,
  CheckCircle, RefreshCw,
} from 'lucide-react';
import { StockItem, StockMovement } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

// ── Reason options ────────────────────────────────────────────────────────────
const IN_REASONS  = ['3PL Delivery', 'Customer Return', 'Returned from Popup', 'Stocktake Adjustment'];
const OUT_REASONS = ['Airport Run', 'Customer Exchange', 'Sent to 3PL', 'Sent to Popup', 'Written Off', 'Stocktake Adjustment'];

// ── Slide-over ────────────────────────────────────────────────────────────────
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

// ── Movement line type ────────────────────────────────────────────────────────
type MovementLine = { stockItemId: string; quantity: number };

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [items, setItems]           = useState<StockItem[]>([]);
  const [movements, setMovements]   = useState<StockMovement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveOk, setSaveOk]         = useState(false);
  const [error, setError]           = useState('');

  // Slide-over mode
  const [panel, setPanel] = useState<'receive' | 'dispatch' | 'add-product' | null>(null);

  // Movement form
  const [movReason, setMovReason]   = useState('');
  const [movNotes, setMovNotes]     = useState('');
  const [movLines, setMovLines]     = useState<MovementLine[]>([{ stockItemId: '', quantity: 1 }]);

  // Add product form
  const [newName, setNewName]       = useState('');
  const [newSku, setNewSku]         = useState('');
  const [newThreshold, setNewThreshold] = useState(5);
  const [bulkMode, setBulkMode]     = useState(false);
  const [bulkText, setBulkText]     = useState('');
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Edit product
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState('');
  const [editThreshold, setEditThreshold] = useState(5);

  // History expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [itemsRes, movRes] = await Promise.all([
        fetch('/api/stock/items'),
        fetch('/api/stock/movements'),
      ]);
      const itemsJson = await itemsRes.json();
      const movJson   = await movRes.json();
      setItems(itemsJson.data ?? []);
      setMovements(movJson.data ?? []);
    } catch {
      setError('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openPanel(mode: 'receive' | 'dispatch') {
    setPanel(mode);
    setMovReason('');
    setMovNotes('');
    setMovLines([{ stockItemId: '', quantity: 1 }]);
  }

  function closePanel() {
    setPanel(null);
    setNewName(''); setNewSku(''); setNewThreshold(5);
    setBulkMode(false); setBulkText(''); setBulkResult(null);
  }

  function addLine() {
    setMovLines(l => [...l, { stockItemId: '', quantity: 1 }]);
  }

  function removeLine(i: number) {
    setMovLines(l => l.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof MovementLine, value: string | number) {
    setMovLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));
  }

  async function submitMovement() {
    if (!movReason) return;
    const validLines = movLines.filter(l => l.stockItemId && l.quantity > 0);
    if (!validLines.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: panel === 'receive' ? 'in' : 'out', reason: movReason, notes: movNotes, items: validLines }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      closePanel();
      await load();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addProduct() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stock/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, sku: newSku, lowStockThreshold: newThreshold }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      closePanel();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function bulkAddProducts() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSaving(true);
    setBulkResult(null);
    let added = 0;
    for (const line of lines) {
      const [name, sku] = line.split(',').map(s => s.trim());
      if (!name) continue;
      try {
        const res = await fetch('/api/stock/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, sku: sku ?? '', lowStockThreshold: newThreshold }),
        });
        const json = await res.json();
        if (!json.error) {
          setItems(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
          added++;
        }
      } catch { /* skip failed lines */ }
    }
    setSaving(false);
    setBulkResult(`${added} of ${lines.length} products added`);
    setBulkText('');
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/stock/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, lowStockThreshold: editThreshold }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(prev => prev.map(i => i.id === id ? { ...i, name: editName, lowStockThreshold: editThreshold } : i));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Remove this product from stock tracking?')) return;
    try {
      await fetch(`/api/stock/items/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Stats (exclude discontinued from alerts)
  const totalUnits  = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const lowStock    = useMemo(() => items.filter(i => !i.discontinued && i.quantity > 0 && i.quantity <= i.lowStockThreshold), [items]);
  const outOfStock  = useMemo(() => items.filter(i => !i.discontinued && i.quantity === 0), [items]);

  // Group by SKU prefix (everything before the first dash), ungrouped items last
  const groupedItems = useMemo(() => {
    const groups = new Map<string, StockItem[]>();
    for (const item of items) {
      const prefix = item.sku ? item.sku.split('-')[0].toUpperCase() : 'No SKU';
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push(item);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'No SKU') return 1;
      if (b === 'No SKU') return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  function stockStatus(item: StockItem) {
    if (item.discontinued) return 'discontinued';
    if (item.quantity === 0) return 'out';
    if (item.quantity <= item.lowStockThreshold) return 'low';
    return 'ok';
  }

  async function toggleDiscontinued(item: StockItem) {
    const next = !item.discontinued;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, discontinued: next } : i));
    try {
      const res = await fetch(`/api/stock/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discontinued: next }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (e: any) {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, discontinued: !next } : i));
      setError(e.message);
    }
  }

  const reasons = panel === 'receive' ? IN_REASONS : OUT_REASONS;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Room</h1>
          <p className="page-subtitle">In-house office stock only — does not reflect 3PL inventory</p>
        </div>
        <div className="flex items-center gap-2">
          {saveOk && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          <button onClick={load} className="btn-secondary">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => openPanel('receive')} className="btn-secondary">
            <ArrowDownCircle size={15} className="text-emerald-600" /> Receive Stock
          </button>
          <button onClick={() => openPanel('dispatch')} className="btn-primary">
            <ArrowUpCircle size={15} /> Dispatch Stock
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            <p className="text-xs text-slate-500">Products tracked</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ArrowDownCircle size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalUnits}</p>
            <p className="text-xs text-slate-500">Total units in stock</p>
          </div>
        </div>
        <div className={`card p-4 flex items-center gap-3 ${outOfStock.length > 0 ? 'border-red-200' : lowStock.length > 0 ? 'border-amber-200' : ''}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${outOfStock.length > 0 ? 'bg-red-50' : lowStock.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <AlertTriangle size={18} className={outOfStock.length > 0 ? 'text-red-500' : lowStock.length > 0 ? 'text-amber-500' : 'text-slate-400'} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{outOfStock.length + lowStock.length}</p>
            <p className="text-xs text-slate-500">Low / out of stock</p>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Current Stock</h2>
          <button onClick={() => setPanel('add-product')} className="btn-ghost text-xs gap-1.5">
            <Plus size={13} /> Add Product
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">No products yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Add your first product to start tracking stock</p>
            <button onClick={() => setPanel('add-product')} className="btn-primary">
              <Plus size={14} /> Add Product
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {groupedItems.map(([prefix, groupItems]) => (
                <>
                  {/* Group header */}
                  <tr key={`group-${prefix}`}>
                    <td colSpan={5} className="px-5 py-2 bg-slate-50 border-y border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prefix}</span>
                        <span className="text-[10px] text-slate-400">{groupItems.length} product{groupItems.length !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                  </tr>
                  {/* Group items */}
                  {groupItems.map(item => {
                    const status = stockStatus(item);
                    const isEditing = editingId === item.id;
                    const isDiscontinued = item.discontinued;
                    return (
                      <tr key={item.id} className={`group transition-colors border-b border-slate-50 ${isDiscontinued ? 'bg-slate-50/60 hover:bg-slate-100/60' : 'hover:bg-slate-50/70'}`}>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="form-input text-sm py-1.5"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isDiscontinued ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {item.name}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className={`px-5 py-3.5 text-xs font-mono ${isDiscontinued ? 'text-slate-300' : 'text-slate-400'}`}>{item.sku || '—'}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`text-2xl font-bold ${
                            isDiscontinued ? 'text-slate-300' :
                            status === 'out' ? 'text-red-500' :
                            status === 'low' ? 'text-amber-500' :
                            'text-slate-900'
                          }`}>
                            {item.quantity}
                          </span>
                          {isEditing && (
                            <div className="mt-1">
                              <label className="text-[10px] text-slate-400">Low stock at</label>
                              <input
                                type="number"
                                value={editThreshold}
                                onChange={e => setEditThreshold(Number(e.target.value))}
                                className="form-input text-xs py-1 w-16 text-center ml-1"
                                min={1}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isDiscontinued ? (
                            <span className="badge bg-slate-100 text-slate-500">EOL</span>
                          ) : status === 'out' ? (
                            <span className="badge bg-red-100 text-red-700">Out of stock</span>
                          ) : status === 'low' ? (
                            <span className="badge bg-amber-100 text-amber-700">
                              <AlertTriangle size={11} /> Low stock
                            </span>
                          ) : (
                            <span className="badge bg-emerald-100 text-emerald-700">In stock</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => toggleDiscontinued(item)}
                                className={`text-xs py-1 px-2.5 rounded-md border font-medium transition-colors ${
                                  isDiscontinued
                                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                                title={isDiscontinued ? 'Mark as active' : 'Mark as end of life'}
                              >
                                {isDiscontinued ? 'Reactivate' : 'Mark EOL'}
                              </button>
                              <button onClick={() => saveEdit(item.id)} className="btn-primary text-xs py-1 px-3">Save</button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => toggleDiscontinued(item)}
                                className="btn-ghost p-1.5"
                                title={isDiscontinued ? 'Reactivate product' : 'Mark as end of life'}
                              >
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDiscontinued ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {isDiscontinued ? 'ACTIVE' : 'EOL'}
                                </span>
                              </button>
                              <button
                                onClick={() => { setEditingId(item.id); setEditName(item.name); setEditThreshold(item.lowStockThreshold); }}
                                className="btn-ghost p-1.5"
                                title="Edit"
                              >
                                <Pencil size={13} className="text-slate-400" />
                              </button>
                              <button onClick={() => deleteProduct(item.id)} className="btn-ghost p-1.5" title="Remove">
                                <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Movement History */}
      {movements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Movement History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Last 50 stock movements</p>
          </div>
          <div className="divide-y divide-slate-50">
            {movements.map(mv => {
              const isIn       = mv.type === 'in';
              const totalUnits = mv.items.reduce((s, i) => s + i.quantity, 0);
              const expanded   = expandedId === mv.id;
              const d          = new Date(mv.createdAt);
              const dateStr    = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
              const timeStr    = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={mv.id}>
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedId(expanded ? null : mv.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-emerald-100' : 'bg-brand-50'}`}>
                      {isIn
                        ? <ArrowDownCircle size={16} className="text-emerald-600" />
                        : <ArrowUpCircle  size={16} className="text-brand-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{mv.reason}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {mv.items.length} product{mv.items.length !== 1 ? 's' : ''} · {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
                        {mv.notes && <span className="ml-1.5 text-slate-400">· {mv.notes}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-500">{dateStr}</p>
                      <p className="text-xs text-slate-400">{timeStr}</p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-5 pb-3.5 pt-0 bg-slate-50/50">
                      <div className="ml-12 space-y-1.5">
                        {mv.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{item.stockItemName}</span>
                            <span className={`font-semibold ${isIn ? 'text-emerald-700' : 'text-brand-700'}`}>
                              {isIn ? '+' : '−'}{item.quantity} unit{item.quantity !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Receive / Dispatch Slide-over */}
      <SlideOver
        open={panel === 'receive' || panel === 'dispatch'}
        onClose={closePanel}
        title={panel === 'receive' ? 'Receive Stock' : 'Dispatch Stock'}
      >
        <div className="space-y-5">
          {/* Reason */}
          <div>
            <label className="form-label">Reason</label>
            <select value={movReason} onChange={e => setMovReason(e.target.value)} className="form-input">
              <option value="">Select a reason…</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Products */}
          <div>
            <label className="form-label">Products</label>
            <div className="space-y-2">
              {movLines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={line.stockItemId}
                    onChange={e => updateLine(i, 'stockItemId', e.target.value)}
                    className="form-input flex-1 text-sm"
                  >
                    <option value="">Select product…</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                    className="form-input w-20 text-sm text-center"
                  />
                  {movLines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="btn-ghost p-1.5 flex-shrink-0">
                      <X size={14} className="text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLine} className="btn-ghost text-xs mt-2 gap-1.5">
              <Plus size={12} /> Add another product
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={movNotes}
              onChange={e => setMovNotes(e.target.value)}
              placeholder="e.g. Weekly airport run, order ref #1234…"
              rows={2}
              className="form-input resize-none text-sm"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={submitMovement}
              disabled={saving || !movReason || movLines.every(l => !l.stockItemId)}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : panel === 'receive' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
              {panel === 'receive' ? 'Confirm Receipt' : 'Confirm Dispatch'}
            </button>
            <button onClick={closePanel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </SlideOver>

      {/* Add Product Slide-over */}
      <SlideOver open={panel === 'add-product'} onClose={closePanel} title="Add Product">
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <button onClick={() => setBulkMode(false)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!bulkMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Single
            </button>
            <button onClick={() => setBulkMode(true)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${bulkMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Bulk Import
            </button>
          </div>

          {!bulkMode ? (
            <>
              <div>
                <label className="form-label">Product Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. PowerPack Slim 2" className="form-input" autoFocus
                  onKeyDown={e => e.key === 'Enter' && addProduct()} />
              </div>
              <div>
                <label className="form-label">SKU <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="text" value={newSku} onChange={e => setNewSku(e.target.value)}
                  placeholder="e.g. PPS2-BLK" className="form-input" />
              </div>
              <div>
                <label className="form-label">Low Stock Alert Threshold</label>
                <input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}
                  min={1} className="form-input w-24" />
                <p className="text-xs text-slate-400 mt-1">Warn when quantity drops to or below this number</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={addProduct} disabled={saving || !newName.trim()} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Product
                </button>
                <button onClick={closePanel} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="form-label">Paste your product list</label>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={`One product per line. Optionally add SKU after a comma:\n\nPowerPack Slim 2, PPS2-BLK\nPowerPack Universal 2, PPU2-BLK\nPPS2-BR`}
                  rows={10}
                  className="form-input resize-none text-sm font-mono"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">Format: <span className="font-mono">Product Name, SKU</span> — SKU is optional</p>
              </div>
              <div>
                <label className="form-label">Default Low Stock Threshold</label>
                <input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}
                  min={1} className="form-input w-24" />
                <p className="text-xs text-slate-400 mt-1">Applied to all imported products</p>
              </div>
              {bulkResult && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle size={14} /> {bulkResult}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={bulkAddProducts} disabled={saving || !bulkText.trim()} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Import Products
                </button>
                <button onClick={closePanel} className="btn-secondary">Cancel</button>
              </div>
            </>
          )}
        </div>
      </SlideOver>

    </div>
  );
}
