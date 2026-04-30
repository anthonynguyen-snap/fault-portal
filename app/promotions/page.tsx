'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  Tag, Plus, X, RefreshCw, CheckCircle, Calendar,
  Pencil, Trash2, Search, Archive, PauseCircle, PlayCircle, RotateCcw,
} from 'lucide-react';
import { Promotion, PromoRun, PROMO_STORES, PROMO_DISCOUNT_TYPES } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(iso + 'T00:00:00');
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function DaysLeftBadge({ endDate }: { endDate: string | null }) {
  if (!endDate) return null;
  const days = daysUntil(endDate);
  if (days < 0) return null; // already ended

  let label: string;
  let cls: string;

  if (days === 0)      { label = 'Ends today';  cls = 'bg-red-100 text-red-700 border border-red-200'; }
  else if (days === 1) { label = 'Tomorrow';    cls = 'bg-red-100 text-red-700 border border-red-200'; }
  else if (days <= 7)  { label = `${days} days left`; cls = 'bg-red-50 text-red-600 border border-red-200'; }
  else if (days <= 14) { label = `${days} days left`; cls = 'bg-amber-50 text-amber-600 border border-amber-200'; }
  else                 { label = `${days} days left`; cls = 'bg-slate-100 text-slate-500 border border-slate-200'; }

  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

const STORE_DISPLAY: Record<string, string> = {
  'AU (+ Popup)': '🇦🇺 AU',
  'US':           '🇺🇸 US',
  'UK-NZ-ROW':    '🌐 ROW',
  'All Stores':   '🌐 All',
};
function StorePill({ store }: { store: string }) {
  const cls = store === 'AU (+ Popup)'  ? 'bg-emerald-100 text-emerald-700'
            : store === 'US'            ? 'bg-blue-100 text-blue-700'
            : store === 'UK-NZ-ROW'     ? 'bg-purple-100 text-purple-700'
            : 'bg-brand-100 text-brand-700';
  return <span className={`badge ${cls}`}>{STORE_DISPLAY[store] ?? store}</span>;
}

function PreviousRuns({ runs }: { runs: PromoRun[] }) {
  if (!runs.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {runs.map((r, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
          <RotateCcw size={9} />
          {fmtDate(r.startDate)} – {r.endDate ? fmtDate(r.endDate) : 'ongoing'}
        </span>
      ))}
    </div>
  );
}

// ── Promo Form ────────────────────────────────────────────────────────────────
function PromoForm({
  initial, onSave, onCancel, saving,
}: {
  initial?: Partial<Promotion>;
  onSave: (data: Partial<Promotion>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name:            initial?.name            ?? '',
    code:            initial?.code            ?? '',
    platform:        initial?.platform        ?? 'AU (+ Popup)',
    description:     initial?.description     ?? '',
    discountType:    initial?.discountType    ?? '',
    discountValue:   initial?.discountValue   ?? '',
    productsCovered: initial?.productsCovered ?? '',
    notes:           initial?.notes           ?? '',
    startDate:       initial?.startDate       ?? '',
    endDate:         initial?.endDate         ?? '',
    isMajor:         initial?.isMajor         ?? false,
  });
  const [err, setErr] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.name.trim())   return setErr('Name is required');
    if (!form.startDate)     return setErr('Start date is required');
    if (!form.discountType)  return setErr('Discount type is required');
    setErr('');
    onSave({ ...form, endDate: form.endDate || null });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Promo Name <span className="text-red-400">*</span></label>
        <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. EOFY Sale 2026" className="form-input" autoFocus />
      </div>
      <div>
        <label className="form-label">Promo Code <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
          placeholder="e.g. SNAP20" className="form-input font-mono" />
      </div>
      <div>
        <label className="form-label">Description <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="e.g. 20% off all PowerPack chargers" className="form-input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Store <span className="text-red-400">*</span></label>
          <select value={form.platform} onChange={e => set('platform', e.target.value)} className="form-input">
            {PROMO_STORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Discount Type <span className="text-red-400">*</span></label>
          <select value={form.discountType} onChange={e => set('discountType', e.target.value)} className="form-input">
            <option value="">Select…</option>
            {PROMO_DISCOUNT_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="form-label">Discount Value <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="text" value={form.discountValue} onChange={e => set('discountValue', e.target.value)}
          placeholder={form.discountType === '% Off' ? 'e.g. 20' : form.discountType === '$ Off' ? 'e.g. 10' : 'e.g. Orders over $50'}
          className="form-input" />
        <p className="text-xs text-slate-400 mt-1">Just the number or value — e.g. "20" for 20% off</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Start Date <span className="text-red-400">*</span></label>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="form-input" />
        </div>
        <div>
          <label className="form-label">End Date <span className="text-slate-400 font-normal">(leave blank if ongoing)</span></label>
          <input type="date" value={form.endDate ?? ''} onChange={e => set('endDate', e.target.value)} className="form-input" />
        </div>
      </div>
      <div>
        <label className="form-label">Products / Categories Covered <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="text" value={form.productsCovered} onChange={e => set('productsCovered', e.target.value)}
          placeholder="e.g. All PowerPack range, or Sitewide" className="form-input" />
      </div>
      <div>
        <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Any extra context…" rows={2} className="form-input resize-none text-sm" />
      </div>
      <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors">
        <input
          type="checkbox"
          checked={form.isMajor}
          onChange={e => setForm(f => ({ ...f, isMajor: e.target.checked }))}
          className="mt-0.5 accent-amber-500"
        />
        <div>
          <p className="text-sm font-semibold text-amber-800">Major Sale</p>
          <p className="text-xs text-amber-600 mt-0.5">Displays a prominent banner on the dashboard — use for big events like Black Friday or Snap Birthday Sale.</p>
        </div>
      </label>
      {err && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</div>
      )}
      <div className="flex gap-3 pt-2">
        <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {initial?.id ? 'Save Changes' : 'Add Promotion'}
        </button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

// ── Reactivate Form ───────────────────────────────────────────────────────────
function ReactivateForm({
  promo, onSave, onCancel, saving,
}: {
  promo: Promotion;
  onSave: (newStart: string, newEnd: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState('');
  const [err, setErr]             = useState('');

  function submit() {
    if (!startDate) return setErr('Start date is required');
    setErr('');
    onSave(startDate, endDate);
  }

  // All previous runs including the current (now-ended) one
  const allPrevious = [
    ...promo.previousRuns,
    { startDate: promo.startDate, endDate: promo.endDate },
  ];

  return (
    <div className="space-y-5">
      {/* Run history */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Previous Runs</p>
        {allPrevious.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
            <RotateCcw size={11} className="text-slate-400 flex-shrink-0" />
            <span>{fmtDate(r.startDate)} – {r.endDate ? fmtDate(r.endDate) : 'ongoing'}</span>
          </div>
        ))}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Set new dates for this run:</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">New Start Date <span className="text-red-400">*</span></label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">New End Date <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
          </div>
        </div>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</div>}

      <div className="flex gap-3 pt-1">
        <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <PlayCircle size={14} />}
          Reactivate
        </button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PromotionsPage() {
  const [promos, setPromos]         = useState<Promotion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [editing, setEditing]       = useState<Promotion | null>(null);
  const [reactivating, setReactivating] = useState<Promotion | null>(null);

  // Date lookup
  const [lookupDate, setLookupDate] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch('/api/promotions');
      const json = await res.json();
      setPromos(json.data ?? []);
    } catch {
      setError('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addPromo(data: Partial<Promotion>) {
    setSaving(true);
    try {
      const res  = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setPromos(prev => [json.data, ...prev]);
      setShowAdd(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(data: Partial<Promotion>) {
    if (!editing) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/promotions/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
      setEditing(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function endPromo(promo: Promotion) {
    const today = new Date().toISOString().slice(0, 10);
    setSaving(true);
    try {
      await fetch(`/api/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: today }),
      });
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, endDate: today, isActive: false } : p));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(promo: Promotion) {
    const newEnabled = !promo.enabled;
    // Optimistic
    setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, enabled: newEnabled } : p));
    try {
      await fetch(`/api/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
    } catch (e: any) {
      // Revert on failure
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, enabled: promo.enabled } : p));
      setError(e.message);
    }
  }

  async function reactivatePromo(promo: Promotion, newStart: string, newEnd: string) {
    setSaving(true);
    try {
      // Save old dates into previous_runs
      const newRun = { startDate: promo.startDate, endDate: promo.endDate };
      const updatedRuns = [...promo.previousRuns, newRun];

      await fetch(`/api/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate:    newStart,
          endDate:      newEnd || null,
          enabled:      true,
          previousRuns: updatedRuns,
        }),
      });
      await load();
      setReactivating(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePromo(id: string) {
    if (!confirm('Delete this promotion?')) return;
    try {
      await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
      setPromos(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Derived — split active into live vs paused
  const live     = useMemo(() => promos.filter(p => p.isActive && p.enabled),  [promos]);
  const paused   = useMemo(() => promos.filter(p => p.isActive && !p.enabled), [promos]);
  const archived = useMemo(() => promos.filter(p => !p.isActive),              [promos]);

  // Date lookup results
  const lookupResults = useMemo(() => {
    if (!lookupDate) return [];
    return promos.filter(p =>
      p.startDate <= lookupDate && (!p.endDate || p.endDate >= lookupDate)
    );
  }, [lookupDate, promos]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Promotions</h1>
          <p className="page-subtitle">SnapWireless active and archived promotions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={14} /> Add Promotion</button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="btn-ghost p-1"><X size={14} /></button>
        </div>
      )}

      {/* Date Lookup */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Search size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">What promos were running on…</span>
          </div>
          <input
            type="date"
            value={lookupDate}
            onChange={e => setLookupDate(e.target.value)}
            className="form-input w-44 text-sm"
          />
          {lookupDate && (
            <button onClick={() => setLookupDate('')} className="btn-ghost p-1.5">
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>
        {lookupDate && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {lookupResults.length === 0 ? (
              <p className="text-sm text-slate-400">No promotions were running on {fmtDate(lookupDate)}.</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">{lookupResults.length} promo{lookupResults.length !== 1 ? 's' : ''} active on {fmtDate(lookupDate)}:</p>
                {lookupResults.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-sm text-slate-700 bg-brand-50 px-3 py-2 rounded-lg">
                    <Tag size={12} className="text-brand-500 flex-shrink-0" />
                    <span className="font-medium">{p.name}</span>
                    {p.code && <span className="font-mono text-xs bg-white border border-brand-200 px-1.5 py-0.5 rounded">{p.code}</span>}
                    {p.discountValue && <span className="text-brand-600 text-xs">{p.discountValue}{p.discountType === '% Off' ? '% off' : p.discountType === '$ Off' ? ' off' : ''}</span>}
                    <StorePill store={p.platform} />
                    <span className="text-xs text-slate-400 ml-auto">{fmtDate(p.startDate)} – {p.endDate ? fmtDate(p.endDate) : 'ongoing'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active / Live Promotions */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-800">Active Promotions</h2>
            <span className="text-xs text-slate-400">({live.length})</span>
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : live.length === 0 ? (
          <div className="py-12 text-center">
            <Tag size={28} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No active promotions</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Add one to track what's currently running</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
              <Plus size={13} /> Add Promotion
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {live.map(p => (
              <div key={p.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                    {p.isMajor && <span className="badge bg-amber-100 text-amber-700 border border-amber-200">⭐ Major Sale</span>}
                    {p.code && <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">{p.code}</span>}
                    <StorePill store={p.platform} />
                    {p.discountValue && (
                      <span className="badge bg-emerald-100 text-emerald-700">
                        {p.discountValue}{p.discountType === '% Off' ? '% off' : p.discountType === '$ Off' ? ' off' : ` · ${p.discountType}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> Started {fmtDate(p.startDate)}
                    </span>
                    {p.endDate ? (
                      <span>Ends {fmtDate(p.endDate)}</span>
                    ) : (
                      <span className="text-amber-500">No end date set</span>
                    )}
                    <DaysLeftBadge endDate={p.endDate ?? null} />
                    {p.productsCovered && <span>· {p.productsCovered}</span>}
                  </div>
                  {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                  {p.notes && <p className="text-xs text-slate-400 mt-1 italic">{p.notes}</p>}
                  <PreviousRuns runs={p.previousRuns} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => toggleEnabled(p)}
                    className="text-xs px-2.5 py-1 rounded-md border border-amber-200 text-amber-600 hover:bg-amber-50 font-medium flex items-center gap-1"
                    title="Pause this promo"
                  >
                    <PauseCircle size={12} /> Pause
                  </button>
                  <button
                    onClick={() => endPromo(p)}
                    className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 font-medium"
                    title="End this promo today"
                  >
                    End
                  </button>
                  <button onClick={() => setEditing(p)} className="btn-ghost p-1.5" title="Edit">
                    <Pencil size={13} className="text-slate-400" />
                  </button>
                  <button onClick={() => deletePromo(p.id)} className="btn-ghost p-1.5" title="Delete">
                    <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paused Promotions */}
      {paused.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <PauseCircle size={14} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-800">Paused</h2>
            <span className="text-xs text-slate-400">({paused.length})</span>
          </div>
          <div className="divide-y divide-slate-50">
            {paused.map(p => (
              <div key={p.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-500">{p.name}</span>
                    {p.code && <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-400">{p.code}</span>}
                    <StorePill store={p.platform} />
                    {p.discountValue && (
                      <span className="badge bg-slate-100 text-slate-500">
                        {p.discountValue}{p.discountType === '% Off' ? '% off' : p.discountType === '$ Off' ? ' off' : ` · ${p.discountType}`}
                      </span>
                    )}
                    <span className="badge bg-amber-50 text-amber-600 border border-amber-200">Paused</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> Started {fmtDate(p.startDate)}
                    </span>
                    {p.endDate ? <span>Ends {fmtDate(p.endDate)}</span> : <span className="text-amber-500">No end date set</span>}
                    <DaysLeftBadge endDate={p.endDate ?? null} />
                  </div>
                  {p.description && <p className="text-xs text-slate-400 mt-1">{p.description}</p>}
                  <PreviousRuns runs={p.previousRuns} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => toggleEnabled(p)}
                    className="text-xs px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-medium flex items-center gap-1"
                    title="Resume this promo"
                  >
                    <PlayCircle size={12} /> Resume
                  </button>
                  <button onClick={() => setEditing(p)} className="btn-ghost p-1.5" title="Edit">
                    <Pencil size={13} className="text-slate-400" />
                  </button>
                  <button onClick={() => deletePromo(p.id)} className="btn-ghost p-1.5" title="Delete">
                    <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archive */}
      {archived.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Archive size={14} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Archive</h2>
            <span className="text-xs text-slate-400">({archived.length})</span>
          </div>
          <div className="divide-y divide-slate-50">
            {archived.map(p => (
              <div key={p.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-500">{p.name}</span>
                    {p.code && <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-400">{p.code}</span>}
                    <StorePill store={p.platform} />
                    {p.discountValue && (
                      <span className="badge bg-slate-100 text-slate-500">
                        {p.discountValue}{p.discountType === '% Off' ? '% off' : p.discountType === '$ Off' ? ' off' : ` · ${p.discountType}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {fmtDate(p.startDate)} – {p.endDate ? fmtDate(p.endDate) : '?'}
                    {p.productsCovered && ` · ${p.productsCovered}`}
                  </p>
                  {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
                  <PreviousRuns runs={p.previousRuns} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => setReactivating(p)}
                    className="text-xs px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-medium flex items-center gap-1"
                    title="Reactivate this promo with new dates"
                  >
                    <PlayCircle size={12} /> Reactivate
                  </button>
                  <button onClick={() => setEditing(p)} className="btn-ghost p-1.5" title="Edit">
                    <Pencil size={13} className="text-slate-400" />
                  </button>
                  <button onClick={() => deletePromo(p.id)} className="btn-ghost p-1.5" title="Delete">
                    <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Slide-over */}
      <SlideOver open={showAdd} onClose={() => setShowAdd(false)} title="Add Promotion">
        <PromoForm onSave={addPromo} onCancel={() => setShowAdd(false)} saving={saving} />
      </SlideOver>

      {/* Edit Slide-over */}
      <SlideOver open={!!editing} onClose={() => setEditing(null)} title="Edit Promotion">
        {editing && (
          <PromoForm initial={editing} onSave={saveEdit} onCancel={() => setEditing(null)} saving={saving} />
        )}
      </SlideOver>

      {/* Reactivate Slide-over */}
      <SlideOver open={!!reactivating} onClose={() => setReactivating(null)} title={`Reactivate "${reactivating?.name}"`}>
        {reactivating && (
          <ReactivateForm
            promo={reactivating}
            onSave={(s, e) => reactivatePromo(reactivating, s, e)}
            onCancel={() => setReactivating(null)}
            saving={saving}
          />
        )}
      </SlideOver>

    </div>
  );
}
