'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  Ship, Plane, Plus, X, ChevronDown, ChevronUp, RefreshCw,
  Pencil, Trash2, Package, Clock, CheckCircle2, AlertTriangle,
  Anchor, MapPin, Hash, CalendarDays, FileText,
} from 'lucide-react';
import { Shipment, ShipmentItem, ShipmentStatus, ShipmentTransport } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES: ShipmentStatus[] = ['Pending', 'In Transit', 'At Port', 'Delivered', 'Delayed'];
const LOCATIONS = ['AUSTRALIA - NP', 'US - Borderless', 'UK', 'Other'];

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  'Pending':    'bg-slate-100 text-slate-600',
  'In Transit': 'bg-blue-100 text-blue-700',
  'At Port':    'bg-amber-100 text-amber-700',
  'Delivered':  'bg-emerald-100 text-emerald-700',
  'Delayed':    'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<ShipmentStatus, React.ReactNode> = {
  'Pending':    <Clock size={11} />,
  'In Transit': <Ship size={11} />,
  'At Port':    <Anchor size={11} />,
  'Delivered':  <CheckCircle2 size={11} />,
  'Delayed':    <AlertTriangle size={11} />,
};

// ── Local form types ──────────────────────────────────────────────────────────
interface FormItem {
  productName: string;
  sku: string;
  quantity: number;
  notes: string;
}

interface ShipmentForm {
  shipmentNumber: string;
  location: string;
  transportType: ShipmentTransport;
  provider: string;
  trackingNumber: string;
  eta: string | null;
  status: ShipmentStatus;
  costUsd: number;
  costAud: number;
  cartons: string;
  weightKg: string;
  branchTransferNumber: string;
  asnNumber: string;
  notes: string;
  items: FormItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000);
}

function totalUnits(items: ShipmentItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

function blankShipment(): ShipmentForm {
  return {
    shipmentNumber: '',
    location: 'AUSTRALIA - NP',
    transportType: 'Sea',
    provider: 'JANE - Forwarder',
    trackingNumber: '',
    eta: null,
    status: 'In Transit',
    costUsd: 0,
    costAud: 0,
    cartons: '',
    weightKg: '',
    branchTransferNumber: '',
    asnNumber: '',
    notes: '',
    items: [{ productName: '', sku: '', quantity: 0, notes: '' }],
  };
}

// ── SlideOver ─────────────────────────────────────────────────────────────────
function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  // Panel
  const [panel, setPanel]           = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<ShipmentForm>(blankShipment());

  // Expand rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filter
  const [filterStatus, setFilterStatus] = useState<ShipmentStatus | 'All'>('All');

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch('/api/shipments');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShipments(json.data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(blankShipment());
    setEditingId(null);
    setPanel('add');
  }

  function openEdit(s: Shipment) {
    setEditingId(s.id);
    setForm({
      shipmentNumber:       s.shipmentNumber,
      location:             s.location,
      transportType:        s.transportType,
      provider:             s.provider,
      trackingNumber:       s.trackingNumber,
      eta:                  s.eta,
      status:               s.status,
      costUsd:              s.costUsd,
      costAud:              s.costAud,
      cartons:              s.cartons,
      weightKg:             s.weightKg,
      branchTransferNumber: s.branchTransferNumber,
      asnNumber:            s.asnNumber,
      notes:                s.notes,
      items:                s.items.length > 0
        ? s.items.map(i => ({ productName: i.productName, sku: i.sku, quantity: i.quantity, notes: i.notes }))
        : [{ productName: '', sku: '', quantity: 0, notes: '' }],
    });
    setPanel('edit');
  }

  function closePanel() {
    setPanel(null);
    setEditingId(null);
    setForm(blankShipment());
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────
  function setField(key: keyof ShipmentForm, val: unknown) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function setItemField(idx: number, key: keyof FormItem, val: unknown) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [key]: val } : item),
    }));
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, { productName: '', sku: '', quantity: 0, notes: '' }] }));
  }

  function removeItem(idx: number) {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    if (!form.shipmentNumber?.trim()) return;
    setSaving(true);
    try {
      const validItems = form.items.filter(i => i.productName?.trim());
      const payload = { ...form, items: validItems };

      let res: Response;
      if (panel === 'add') {
        res = await fetch('/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/shipments/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      if (panel === 'add') {
        setShipments(prev => [json.data, ...prev]);
      } else {
        setShipments(prev => prev.map(s => s.id === editingId ? json.data : s));
      }
      closePanel();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(id: string, status: ShipmentStatus) {
    setShipments(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    await fetch(`/api/shipments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteShipment(id: string) {
    if (!confirm('Delete this shipment?')) return;
    setShipments(prev => prev.filter(s => s.id !== id));
    await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const active     = useMemo(() => shipments.filter(s => s.status !== 'Delivered'), [shipments]);
  const inTransit  = useMemo(() => shipments.filter(s => s.status === 'In Transit'), [shipments]);
  const atPort     = useMemo(() => shipments.filter(s => s.status === 'At Port'), [shipments]);
  const delayed    = useMemo(() => shipments.filter(s => s.status === 'Delayed'), [shipments]);
  const totalIncoming = useMemo(() => active.reduce((s, sh) => s + totalUnits(sh.items), 0), [active]);

  const filtered = useMemo(() => {
    if (filterStatus === 'All') return shipments;
    return shipments.filter(s => s.status === filterStatus);
  }, [shipments, filterStatus]);

  // ── Form panel ────────────────────────────────────────────────────────────────
  const FormContent = (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Shipment # <span className="text-red-500">*</span></label>
          <input
            value={form.shipmentNumber ?? ''}
            onChange={e => setField('shipmentNumber', e.target.value)}
            className="form-input"
            placeholder="e.g. 152"
            autoFocus
          />
        </div>
        <div>
          <label className="form-label">Status</label>
          <select value={form.status ?? 'In Transit'} onChange={e => setField('status', e.target.value)} className="form-input">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Location</label>
          <input
            value={form.location ?? ''}
            onChange={e => setField('location', e.target.value)}
            className="form-input"
            placeholder="e.g. AUSTRALIA - NP"
            list="location-options"
          />
          <datalist id="location-options">
            {LOCATIONS.map(l => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div>
          <label className="form-label">Transport</label>
          <div className="grid grid-cols-2 gap-2">
            {(['Sea', 'Air'] as ShipmentTransport[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setField('transportType', t)}
                className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                  form.transportType === t
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t === 'Sea' ? <Ship size={14} /> : <Plane size={14} />} {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">ETA (To Door)</label>
          <input
            type="date"
            value={form.eta ?? ''}
            onChange={e => setField('eta', e.target.value || null)}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Provider / Forwarder</label>
          <input
            value={form.provider ?? ''}
            onChange={e => setField('provider', e.target.value)}
            className="form-input"
            placeholder="e.g. JANE - Forwarder"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Tracking Number</label>
        <input
          value={form.trackingNumber ?? ''}
          onChange={e => setField('trackingNumber', e.target.value)}
          className="form-input font-mono"
          placeholder="e.g. SKP4534309240"
        />
      </div>

      {/* Shipping details */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Shipping Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Cost (USD)</label>
            <input
              type="number"
              value={form.costUsd ?? 0}
              onChange={e => setField('costUsd', parseFloat(e.target.value) || 0)}
              className="form-input"
              min={0}
              step={0.01}
            />
          </div>
          <div>
            <label className="form-label">Cost (AUD)</label>
            <input
              type="number"
              value={form.costAud ?? 0}
              onChange={e => setField('costAud', parseFloat(e.target.value) || 0)}
              className="form-input"
              min={0}
              step={0.01}
            />
          </div>
          <div>
            <label className="form-label">Cartons / Pallets</label>
            <input
              value={form.cartons ?? ''}
              onChange={e => setField('cartons', e.target.value)}
              className="form-input"
              placeholder="e.g. 113ctns"
            />
          </div>
          <div>
            <label className="form-label">Weight</label>
            <input
              value={form.weightKg ?? ''}
              onChange={e => setField('weightKg', e.target.value)}
              className="form-input"
              placeholder="e.g. 1147kg"
            />
          </div>
          <div>
            <label className="form-label">Branch Transfer # (TRF)</label>
            <input
              value={form.branchTransferNumber ?? ''}
              onChange={e => setField('branchTransferNumber', e.target.value)}
              className="form-input font-mono"
              placeholder="e.g. TRF-224978"
            />
          </div>
          <div>
            <label className="form-label">ASN Number</label>
            <input
              value={form.asnNumber ?? ''}
              onChange={e => setField('asnNumber', e.target.value)}
              className="form-input font-mono"
              placeholder="e.g. SNAPC00498"
            />
          </div>
        </div>
      </div>

      {/* Product line items */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Products in Shipment</p>
          <button onClick={addItem} className="btn-ghost text-xs gap-1.5 text-brand-600">
            <Plus size={12} /> Add Product
          </button>
        </div>
        <div className="space-y-2">
          {form.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_80px_28px] gap-2 items-start">
              <div>
                <input
                  value={item.productName ?? ''}
                  onChange={e => setItemField(idx, 'productName', e.target.value)}
                  className="form-input text-sm"
                  placeholder="Product name"
                />
                <input
                  value={item.sku ?? ''}
                  onChange={e => setItemField(idx, 'sku', e.target.value)}
                  className="form-input text-xs font-mono mt-1"
                  placeholder="SKU"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={item.quantity ?? 0}
                  onChange={e => setItemField(idx, 'quantity', parseInt(e.target.value) || 0)}
                  className="form-input text-sm text-right"
                  min={0}
                  placeholder="Qty"
                />
                <p className="text-[10px] text-slate-400 text-center mt-1">units</p>
              </div>
              <div>
                <input
                  value={item.notes ?? ''}
                  onChange={e => setItemField(idx, 'notes', e.target.value)}
                  className="form-input text-xs"
                  placeholder="Notes"
                />
              </div>
              <button
                onClick={() => removeItem(idx)}
                disabled={form.items.length === 1}
                className="btn-ghost p-1 disabled:opacity-30 mt-1"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-xs text-slate-500">
          Total: <span className="font-semibold text-slate-700">{form.items.reduce((s, i) => s + (i.quantity ?? 0), 0).toLocaleString()} units</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="form-label">Notes</label>
        <textarea
          value={form.notes ?? ''}
          onChange={e => setField('notes', e.target.value)}
          className="form-input min-h-[64px] resize-y"
          placeholder="e.g. Luggage S x 4kpc + 2600pc Gan 30W"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={submit}
          disabled={!form.shipmentNumber?.trim() || saving}
          className="btn-primary flex-1 justify-center"
        >
          {saving ? 'Saving…' : panel === 'add' ? 'Add Shipment' : 'Save Changes'}
        </button>
        <button onClick={closePanel} className="btn-secondary px-4">Cancel</button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Ship size={22} className="text-brand-600" />
            Incoming Shipments
          </h1>
          <p className="page-subtitle">Track 3PL shipments — quantities, ETAs, and status</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Shipment</button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Incoming',  value: totalIncoming.toLocaleString() + ' units', sub: `${active.length} active shipment${active.length !== 1 ? 's' : ''}`, accent: 'text-brand-600', bg: '' },
          { label: 'In Transit',      value: inTransit.length,  sub: 'on the water / air', accent: 'text-blue-600',    bg: inTransit.length > 0 ? 'border-blue-200 bg-blue-50' : '' },
          { label: 'At Port',         value: atPort.length,     sub: 'clearing customs',   accent: 'text-amber-600',   bg: atPort.length > 0 ? 'border-amber-200 bg-amber-50' : '' },
          { label: 'Delayed',         value: delayed.length,    sub: 'need attention',     accent: 'text-red-600',     bg: delayed.length > 0 ? 'border-red-200 bg-red-50' : '' },
        ].map(({ label, value, sub, accent, bg }) => (
          <div key={label} className={`card p-4 ${bg}`}>
            <p className={`text-2xl font-bold ${accent}`}>{value}</p>
            <p className="text-xs font-medium text-slate-600 mt-0.5">{label}</p>
            <p className="text-[11px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['All', ...STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filterStatus === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s}
            {s !== 'All' && (
              <span className="ml-1.5 opacity-70">
                {shipments.filter(sh => sh.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Shipments table */}
      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Ship size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">
              {shipments.length === 0 ? 'No shipments yet' : 'No shipments match this filter'}
            </p>
            {shipments.length === 0 && (
              <>
                <p className="text-xs text-slate-400 mt-1 mb-4">Add your first incoming shipment</p>
                <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Shipment</button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8" />
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ETA</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tracking</th>
                  <th className="px-5 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isExpanded = expanded.has(s.id);
                  const days       = daysUntil(s.eta);
                  const overdue    = s.status !== 'Delivered' && days !== null && days < 0;
                  const soon       = days !== null && days >= 0 && days <= 7;
                  const units      = totalUnits(s.items);
                  const isDelivered = s.status === 'Delivered';

                  return (
                    <>
                      <tr
                        key={s.id}
                        className={`group border-b border-slate-50 transition-colors cursor-pointer ${
                          isDelivered ? 'bg-slate-50/40 hover:bg-slate-50' : 'hover:bg-slate-50/70'
                        }`}
                        onClick={() => toggleExpand(s.id)}
                      >
                        {/* Expand toggle */}
                        <td className="px-3 py-3.5 text-center">
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </td>

                        {/* Shipment info */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {s.transportType === 'Sea'
                              ? <Ship size={14} className="text-blue-500 flex-shrink-0" />
                              : <Plane size={14} className="text-purple-500 flex-shrink-0" />}
                            <div>
                              <p className={`font-semibold ${isDelivered ? 'text-slate-400' : 'text-slate-800'}`}>
                                #{s.shipmentNumber}
                              </p>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin size={9} /> {s.location || '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="relative group/status">
                            <span className={`badge flex items-center gap-1 cursor-pointer select-none ${STATUS_STYLES[s.status]}`}>
                              {STATUS_ICONS[s.status]}
                              {s.status}
                              <ChevronDown size={10} className="opacity-60" />
                            </span>
                            <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover/status:block">
                              <div className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                                {STATUSES.map(st => (
                                  <button
                                    key={st}
                                    onClick={() => quickStatus(s.id, st)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 ${s.status === st ? 'font-semibold text-brand-700 bg-brand-50' : 'text-slate-700'}`}
                                  >
                                    {STATUS_ICONS[st]} {st}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ETA */}
                        <td className="px-5 py-3.5">
                          {s.eta ? (
                            <div>
                              <p className={`text-sm font-medium ${overdue ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-700'}`}>
                                {fmtDate(s.eta)}
                              </p>
                              {!isDelivered && days !== null && (
                                <p className={`text-[11px] mt-0.5 ${overdue ? 'text-red-500' : soon ? 'text-amber-500' : 'text-slate-400'}`}>
                                  {overdue ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue` : days === 0 ? 'Due today' : `${days} day${days !== 1 ? 's' : ''} away`}
                                </p>
                              )}
                            </div>
                          ) : <span className="text-slate-400 text-xs">TBC</span>}
                        </td>

                        {/* Units */}
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-lg font-bold ${isDelivered ? 'text-slate-400' : units > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                            {units > 0 ? units.toLocaleString() : '—'}
                          </span>
                          {s.items.length > 0 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{s.items.length} product{s.items.length !== 1 ? 's' : ''}</p>
                          )}
                        </td>

                        {/* Tracking */}
                        <td className="px-5 py-3.5">
                          {s.trackingNumber ? (
                            <p className="text-xs font-mono text-slate-500 truncate max-w-[120px]">{s.trackingNumber}</p>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                          {s.asnNumber && <p className="text-[10px] text-slate-400 mt-0.5">{s.asnNumber}</p>}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(s)} className="btn-ghost p-1.5" title="Edit">
                              <Pencil size={13} className="text-slate-400" />
                            </button>
                            <button onClick={() => deleteShipment(s.id)} className="btn-ghost p-1.5" title="Delete">
                              <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded product rows */}
                      {isExpanded && (
                        <tr key={`${s.id}-expanded`} className="bg-slate-50/60 border-b border-slate-100">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="ml-8 space-y-3">
                              {/* Meta badges */}
                              <div className="flex flex-wrap gap-2">
                                {s.provider && (
                                  <span className="badge bg-white border border-slate-200 text-slate-600 text-[11px]">
                                    <FileText size={10} /> {s.provider}
                                  </span>
                                )}
                                {s.branchTransferNumber && (
                                  <span className="badge bg-white border border-slate-200 text-slate-600 text-[11px]">
                                    <Hash size={10} /> {s.branchTransferNumber}
                                  </span>
                                )}
                                {s.cartons && (
                                  <span className="badge bg-white border border-slate-200 text-slate-600 text-[11px]">
                                    <Package size={10} /> {s.cartons}
                                  </span>
                                )}
                                {s.weightKg && (
                                  <span className="badge bg-white border border-slate-200 text-slate-600 text-[11px]">
                                    ⚖️ {s.weightKg}
                                  </span>
                                )}
                                {(s.costUsd > 0 || s.costAud > 0) && (
                                  <span className="badge bg-white border border-slate-200 text-slate-600 text-[11px]">
                                    {s.costUsd > 0 && `USD $${s.costUsd.toLocaleString()}`}
                                    {s.costUsd > 0 && s.costAud > 0 && ' · '}
                                    {s.costAud > 0 && `AUD $${s.costAud.toLocaleString()}`}
                                  </span>
                                )}
                              </div>

                              {/* Product line items */}
                              {s.items.length > 0 ? (
                                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Product</th>
                                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">SKU</th>
                                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Qty</th>
                                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.items.map(item => (
                                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                                          <td className="px-4 py-2.5 font-medium text-slate-700">{item.productName}</td>
                                          <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{item.sku || '—'}</td>
                                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{item.quantity.toLocaleString()}</td>
                                          <td className="px-4 py-2.5 text-xs text-slate-500">{item.notes || '—'}</td>
                                        </tr>
                                      ))}
                                      <tr className="bg-slate-50 border-t border-slate-200">
                                        <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-slate-500">Total</td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-800">{totalUnits(s.items).toLocaleString()}</td>
                                        <td />
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No product line items — click edit to add products</p>
                              )}

                              {s.notes && (
                                <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3">{s.notes}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over */}
      <SlideOver
        open={panel !== null}
        onClose={closePanel}
        title={panel === 'add' ? 'Add Shipment' : `Edit Shipment #${form.shipmentNumber}`}
      >
        {FormContent}
      </SlideOver>
    </div>
  );
}
