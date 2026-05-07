'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Package, Plus, X, ArrowDownCircle, ArrowUpCircle,
  ChevronDown, ChevronUp, AlertTriangle, Pencil, Trash2,
  CheckCircle, RefreshCw, ClipboardList, Printer, CheckSquare, Square,
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

  // ── Stocktake mode ──────────────────────────────────────────────────────────
  const [stocktakeMode, setStocktakeMode] = useState(false);
  const [stCounts, setStCounts]     = useState<Record<string, string>>({});
  const [stTicked, setStTicked]     = useState<Set<string>>(new Set());
  const [stSaving, setStSaving]     = useState(false);
  const [stSaved, setStSaved]       = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, discontinued: !next } : i));
      setError(e.message);
    }
  }

  // ── Stocktake helpers ───────────────────────────────────────────────────────
  const countableItems = useMemo(() => items.filter(i => !i.discontinued), [items]);
  const discontinuedItems = useMemo(() => items.filter(i => i.discontinued), [items]);

  const stChanges = useMemo(() => {
    return countableItems.filter(item => {
      const val = stCounts[item.id];
      if (val === undefined || val === '') return false;
      const n = parseInt(val, 10);
      return !isNaN(n) && n !== item.quantity;
    });
  }, [stCounts, countableItems]);

  function enterStocktake() {
    setStCounts({});
    setStTicked(new Set());
    setStSaving(false);
    setStSaved(false);
    setStocktakeMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exitStocktake() {
    const hasChanges = Object.values(stCounts).some(v => v !== '');
    if (hasChanges && !confirm('Exit stocktake? Any counts you\'ve entered will be lost.')) return;
    setStocktakeMode(false);
  }

  function tickAll() {
    if (stTicked.size === countableItems.length) {
      setStTicked(new Set());
    } else {
      setStTicked(new Set(countableItems.map(i => i.id)));
    }
  }

  // Tab to next input
  function handleCountKeyDown(e: React.KeyboardEvent, currentId: string) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const idx = countableItems.findIndex(i => i.id === currentId);
      const next = countableItems[idx + 1];
      if (next) {
        inputRefs.current[next.id]?.focus();
        inputRefs.current[next.id]?.select();
      }
      // Auto-tick on Enter
      if (e.key === 'Enter' && stCounts[currentId] !== undefined && stCounts[currentId] !== '') {
        setStTicked(prev => { const s = new Set(prev); s.add(currentId); return s; });
      }
    }
  }

  async function saveStocktake() {
    if (stChanges.length === 0) {
      setStocktakeMode(false);
      return;
    }
    const inItems  = stChanges
      .filter(item => parseInt(stCounts[item.id], 10) > item.quantity)
      .map(item => ({ stockItemId: item.id, quantity: parseInt(stCounts[item.id], 10) - item.quantity }));
    const outItems = stChanges
      .filter(item => parseInt(stCounts[item.id], 10) < item.quantity)
      .map(item => ({ stockItemId: item.id, quantity: item.quantity - parseInt(stCounts[item.id], 10) }));

    setStSaving(true);
    setError('');
    try {
      if (inItems.length > 0) {
        const res = await fetch('/api/stock/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'in', reason: 'Stocktake Adjustment', items: inItems }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
      }
      if (outItems.length > 0) {
        const res = await fetch('/api/stock/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'out', reason: 'Stocktake Adjustment', items: outItems }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
      }
      setStSaved(true);
      await load();
      setTimeout(() => {
        setStocktakeMode(false);
        setStSaved(false);
      }, 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStSaving(false);
    }
  }

  function printChecklist() {
    const rows = countableItems
      .map(i => `
        <tr>
          <td>${i.name}</td>
          <td style="font-family:monospace;color:#888">${i.sku || '—'}</td>
          <td style="text-align:center;font-weight:bold">${i.quantity}</td>
          <td style="border:1.5px solid #ccc;width:70px"></td>
          <td style="width:24px;border:1.5px solid #ccc;text-align:center"></td>
        </tr>`)
      .join('');
    const html = `<!DOCTYPE html>
<html><head><title>Stocktake Checklist</title>
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px}
  h2{font-size:15px;margin:0 0 4px}
  p{font-size:11px;color:#666;margin:0 0 16px}
  table{width:100%;border-collapse:collapse}
  th{background:#f4f4f4;text-align:left;padding:6px 8px;border-bottom:2px solid #ccc;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:middle;height:26px}
  tr:nth-child(even) td{background:#fafafa}
</style></head>
<body>
<h2>Stocktake Checklist</h2>
<p>Date: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; ${countableItems.length} products</p>
<table>
  <thead><tr><th>Product</th><th>SKU</th><th>On Hand</th><th>Count</th><th>✓</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  const reasons = panel === 'receive' ? IN_REASONS : OUT_REASONS;

  // ── Stocktake Mode render ───────────────────────────────────────────────────
  if (stocktakeMode) {
    const tickedCount   = stTicked.size;
    const totalCountable = countableItems.length;
    const progress      = totalCountable > 0 ? Math.round((tickedCount / totalCountable) * 100) : 0;
    const allTicked     = tickedCount === totalCountable && totalCountable > 0;

    return (
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Stocktake header */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 -mx-6 px-6 py-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList size={18} className="text-brand-600" /> Stocktake Mode
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tickedCount} of {totalCountable} products ticked off
                  {stChanges.length > 0 && (
                    <span className="ml-2 text-amber-600 font-medium">· {stChanges.length} change{stChanges.length !== 1 ? 's' : ''} pending</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={printChecklist} className="btn-secondary gap-1.5 text-xs">
                  <Printer size={13} /> Print Checklist
                </button>
                <button onClick={exitStocktake} className="btn-secondary text-xs">
                  Exit
                </button>
                <button
                  onClick={saveStocktake}
                  disabled={stSaving || stSaved}
                  className={`btn-primary text-sm flex items-center gap-2 ${stSaved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                >
                  {stSaved
                    ? <><CheckCircle size={14} /> Saved!</>
                    : stSaving
                    ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                    : stChanges.length > 0
                    ? `Save ${stChanges.length} Change${stChanges.length !== 1 ? 's' : ''}`
                    : 'Save'}
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="card p-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Stocktake table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 w-10">
                  <button onClick={tickAll} className="flex items-center justify-center text-slate-400 hover:text-brand-600 transition-colors">
                    {allTicked
                      ? <CheckSquare size={16} className="text-brand-600" />
                      : <Square size={16} />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Count</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Variance</th>
              </tr>
            </thead>
            <tbody>
              {countableItems.map((item, idx) => {
                const raw     = stCounts[item.id] ?? '';
                const counted = raw !== '' ? parseInt(raw, 10) : null;
                const delta   = counted !== null && !isNaN(counted) ? counted - item.quantity : null;
                const isTicked = stTicked.has(item.id);
                const hasValue = raw !== '' && !isNaN(parseInt(raw, 10));

                // Group header row
                const prevItem  = countableItems[idx - 1];
                const currPrefix = item.sku ? item.sku.split('-')[0].toUpperCase() : 'No SKU';
                const prevPrefix = prevItem?.sku ? prevItem.sku.split('-')[0].toUpperCase() : 'No SKU';
                const showGroup  = idx === 0 || currPrefix !== prevPrefix;

                return (
                  <>
                    {showGroup && (
                      <tr key={`st-group-${currPrefix}`}>
                        <td colSpan={6} className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currPrefix}</span>
                        </td>
                      </tr>
                    )}
                    <tr
                      key={item.id}
                      className={`border-b border-slate-50 transition-colors ${isTicked ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Tick */}
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => {
                            setStTicked(prev => {
                              const s = new Set(prev);
                              if (s.has(item.id)) s.delete(item.id); else s.add(item.id);
                              return s;
                            });
                          }}
                          className="flex items-center justify-center text-slate-300 hover:text-brand-500 transition-colors"
                        >
                          {isTicked
                            ? <CheckSquare size={16} className="text-emerald-500" />
                            : <Square size={16} />}
                        </button>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-2.5">
                        <span className={`font-medium ${isTicked ? 'text-slate-500' : 'text-slate-800'}`}>
                          {item.name}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{item.sku || '—'}</td>

                      {/* On hand */}
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-lg font-bold text-slate-400">{item.quantity}</span>
                      </td>

                      {/* Count input */}
                      <td className="px-4 py-2.5 text-center">
                        <input
                          ref={el => { inputRefs.current[item.id] = el; }}
                          type="number"
                          min="0"
                          value={raw}
                          onChange={e => setStCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={e => handleCountKeyDown(e, item.id)}
                          onFocus={e => e.target.select()}
                          placeholder="—"
                          className={`w-24 text-center text-lg font-bold rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
                            hasValue && delta !== 0
                              ? 'border-amber-300 bg-amber-50 text-slate-900 focus:ring-amber-400'
                              : hasValue
                              ? 'border-emerald-300 bg-emerald-50 text-slate-900 focus:ring-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 focus:ring-brand-400'
                          }`}
                        />
                      </td>

                      {/* Variance */}
                      <td className="px-4 py-2.5 text-right">
                        {delta !== null && !isNaN(delta) && delta !== 0 ? (
                          <span className={`text-sm font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        ) : delta === 0 && hasValue ? (
                          <span className="text-xs text-slate-300">✓</span>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })}

              {/* Discontinued items — shown greyed, no input */}
              {discontinuedItems.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End of Life — not counted</span>
                    </td>
                  </tr>
                  {discontinuedItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-50 opacity-40">
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-sm line-through text-slate-400">{item.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-300">{item.sku || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-bold">{item.quantity}</td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5" />
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom save bar */}
        {stChanges.length > 0 && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
            <div className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-4">
              <div className="text-sm">
                <span className="font-semibold">{stChanges.length} change{stChanges.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-400 ml-1.5">ready to save</span>
              </div>
              <button
                onClick={saveStocktake}
                disabled={stSaving || stSaved}
                className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {stSaving ? 'Saving…' : stSaved ? '✓ Saved' : 'Save All Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Normal mode render ──────────────────────────────────────────────────────
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
          <button onClick={enterStocktake} className="btn-secondary gap-1.5">
            <ClipboardList size={15} className="text-brand-600" /> Stocktake
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
                  <tr key={`group-${prefix}`}>
                    <td colSpan={5} className="px-5 py-2 bg-slate-50 border-y border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prefix}</span>
                        <span className="text-[10px] text-slate-400">{groupItems.length} product{groupItems.length !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                  </tr>
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
          <div>
            <label className="form-label">Reason</label>
            <select value={movReason} onChange={e => setMovReason(e.target.value)} className="form-input">
              <option value="">Select a reason…</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
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
                  placeholder={`One product per line. Optionally add SKU after a comma:\n\nPowerPack Slim 2, PPS2-BLK\nPowerPack Universal 2, PPU2-BLK`}
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
