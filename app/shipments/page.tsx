'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Ship, Plane, Plus, X, ChevronDown, ChevronUp, RefreshCw,
  Pencil, Trash2, Package, Clock, CheckCircle2, AlertTriangle,
  Anchor, MapPin, Hash, FileText, UploadCloud, CheckSquare, Square,
} from 'lucide-react';
import { Shipment, ShipmentItem, ShipmentStatus, ShipmentTransport } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/auth/AuthProvider';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';

// ── CSV parsing (client-side) ──────────────────────────────────────────────────
export interface ImportedShipmentItem {
  productName: string; sku: string; quantity: number; notes: string;
}
export interface ImportedShipment {
  shipmentNumber: string; location: string; transportType: 'Sea' | 'Air';
  provider: string; trackingNumber: string; eta: string | null; status: string;
  costUsd: number; costAud: number; cartons: string; weightKg: string;
  branchTransferNumber: string; asnNumber: string; notes: string;
  items: ImportedShipmentItem[];
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

function parseSheetDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const longM = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (longM) {
    const m: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const mo = m[longM[2].toLowerCase().slice(0,3)];
    if (mo) return `${longM[3]}-${mo}-${longM[1].padStart(2,'0')}`;
  }
  const slashM = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashM) return `${slashM[3]}-${slashM[2].padStart(2,'0')}-${slashM[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseCost(raw: string): number {
  return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
}

function mapShipStatus(raw: string): string {
  const s = raw.toUpperCase().trim();
  if (s.includes('PORT') || s.includes('CUSTOMS')) return 'At Port';
  if (s.includes('DELIVER')) return 'Delivered';
  if (s.includes('DELAY')) return 'Delayed';
  if (s.includes('PENDING')) return 'Pending';
  return 'In Transit'; // IN PROGRESS → In Transit
}

const ROW_LABELS: Record<string, string> = {
  location:'Location', transport:'Air/Sea', provider:'Provider',
  tracking:'Tracking', eta:'ETA', status:'Status', notes:'Notes',
  costUsd:'Cost (USD)', costAud:'Cost (AUD)', cartons:'Cartons',
  weight:'Weight', trf:'Branch Transfer', asn:'ASN',
};

function parseShipments(csv: string): ImportedShipment[] {
  const rows = parseCSV(csv);
  if (!rows.length) return [];

  // Find header row with SHIPMENT #
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    if (rows[r].some(c => /SHIPMENT\s*#/i.test(c))) { headerRowIdx = r; break; }
  }
  if (headerRowIdx === -1) return [];

  // Find shipment columns
  const headerRow = rows[headerRowIdx];
  const shipCols: Array<{ col: number; number: string }> = [];
  for (let c = 0; c < headerRow.length; c++) {
    const m = headerRow[c].match(/SHIPMENT\s*#\s*(\d+)/i);
    if (m) shipCols.push({ col: c, number: m[1] });
  }
  if (!shipCols.length) return [];

  // Build label → row index map
  const labelRowMap: Record<string, number> = {};
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const label = (rows[r][0] || rows[r][1] || '').trim();
    if (!label) continue;
    for (const [key, pattern] of Object.entries(ROW_LABELS)) {
      if (label.toLowerCase().includes(pattern.toLowerCase()) && !(key in labelRowMap)) {
        labelRowMap[key] = r;
      }
    }
  }

  // Find Main Sellers section
  let mainSellersRow = -1;
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const label = (rows[r][0] || rows[r][1] || '').trim().toLowerCase();
    if (label.includes('main seller') || label.includes('main product')) { mainSellersRow = r; break; }
  }

  // Collect product rows
  const productRows: Array<{ rowIdx: number; name: string }> = [];
  if (mainSellersRow !== -1) {
    for (let r = mainSellersRow + 1; r < rows.length; r++) {
      const name = (rows[r][0] || rows[r][1] || '').trim();
      if (!name) continue;
      productRows.push({ rowIdx: r, name });
    }
  }

  const getCell = (key: string, col: number) =>
    labelRowMap[key] !== undefined ? (rows[labelRowMap[key]]?.[col] ?? '') : '';

  return shipCols.map(({ col, number }) => {
    const rawT = getCell('transport', col).trim().toUpperCase();
    const items: ImportedShipmentItem[] = productRows
      .map(({ rowIdx, name }) => {
        const qty = parseInt((rows[rowIdx]?.[col] ?? '').replace(/[^0-9]/g, ''), 10) || 0;
        return qty > 0 ? { productName: name, sku: '', quantity: qty, notes: '' } : null;
      })
      .filter((x): x is ImportedShipmentItem => x !== null);
    return {
      shipmentNumber: number,
      location: getCell('location', col),
      transportType: rawT.includes('AIR') ? 'Air' : 'Sea',
      provider: getCell('provider', col),
      trackingNumber: getCell('tracking', col),
      eta: parseSheetDate(getCell('eta', col)),
      status: mapShipStatus(getCell('status', col)),
      costUsd: parseCost(getCell('costUsd', col)),
      costAud: parseCost(getCell('costAud', col)),
      cartons: getCell('cartons', col),
      weightKg: getCell('weight', col),
      branchTransferNumber: getCell('trf', col),
      asnNumber: getCell('asn', col),
      notes: getCell('notes', col),
      items,
    };
  });
}

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
  const { effectiveRole } = useAuth();
  const canEdit = effectiveRole === 'admin';
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
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

  // CSV import
  const [isDragOver, setIsDragOver]             = useState(false);
  const [importPreview, setImportPreview]       = useState<ImportedShipment[] | null>(null);
  const [importSelected, setImportSelected]     = useState<Set<number>>(new Set());
  const [importError, setImportError]           = useState('');
  const [importSaving, setImportSaving]         = useState(false);
  const fileInputRef                            = useRef<HTMLInputElement>(null);

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
    if (!canEdit) return;
    setForm(blankShipment());
    setEditingId(null);
    setPanel('add');
  }

  function openEdit(s: Shipment) {
    if (!canEdit) return;
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
    if (!canEdit) return;
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
    if (!canEdit) return;
    setShipments(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    await fetch(`/api/shipments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function deleteShipment(id: string) {
    if (!canEdit) return;
    const ok = await confirm({
      title: 'Delete shipment?',
      message: 'This removes the shipment and its item list from the portal.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setShipments(prev => prev.filter(s => s.id !== id));
    await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
  }

  // ── CSV import ───────────────────────────────────────────────────────────────
  const handleCSV = useCallback((text: string) => {
    if (!canEdit) return;
    setImportError('');
    const preview = parseShipments(text);
    if (!preview.length) {
      setImportError('No shipments found in this CSV. Make sure you exported the correct tab from Google Sheets.');
      return;
    }
    const existing = new Set(shipments.map(s => s.shipmentNumber));
    setImportPreview(preview);
    setImportSelected(new Set(
      preview.map((_, i) => i).filter(i => !existing.has(preview[i].shipmentNumber))
    ));
  }, [canEdit, shipments]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleCSV(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = ''; // reset so same file can be re-selected
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setImportError('Please drop a .csv file (File → Download → CSV in Google Sheets).');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => handleCSV(ev.target?.result as string);
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!canEdit) return;
    if (!importPreview) return;
    setImportSaving(true);
    try {
      const toImport = importPreview.filter((_, i) => importSelected.has(i));
      for (const s of toImport) {
        const res  = await fetch('/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        });
        const json = await res.json();
        if (json.data) setShipments(prev => [json.data, ...prev]);
      }
      setImportPreview(null);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImportSaving(false);
    }
  }

  function toggleImportSelect(idx: number) {
    setImportSelected(prev => {
      const s = new Set(prev);
      s.has(idx) ? s.delete(idx) : s.add(idx);
      return s;
    });
  }

  function toggleImportAll() {
    if (!importPreview) return;
    if (importSelected.size === importPreview.length) {
      setImportSelected(new Set());
    } else {
      setImportSelected(new Set(importPreview.map((_, i) => i)));
    }
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
    <div
      className={`max-w-5xl mx-auto space-y-6 transition-all ${isDragOver ? 'ring-2 ring-brand-400 ring-inset rounded-2xl' : ''}`}
      onDragOver={e => { e.preventDefault(); if (canEdit) setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {confirmDialog}

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
          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary gap-1.5"
              title="Import from CSV export of Google Sheet"
            >
              <UploadCloud size={14} className="text-emerald-600" />
              Import CSV
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
          {canEdit && <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Shipment</button>}
        </div>
      </div>

      {!canEdit && (
        <div className="card px-4 py-3 border-blue-200 bg-blue-50 text-sm text-blue-800">
          Team view is read-only. Ask an admin to import, edit, or mark incoming shipments.
        </div>
      )}

      {(error || importError) && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error || importError}</p>
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
            {shipments.length === 0 ? (
              <>
                <UploadCloud size={36} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Drop your CSV here to import</p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  In Google Sheets: <span className="font-medium text-slate-500">File → Download → Comma Separated Values (.csv)</span>
                </p>
                {canEdit && (
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="btn-secondary gap-1.5">
                      <UploadCloud size={14} className="text-emerald-600" /> Browse for CSV
                    </button>
                    <span className="text-slate-300 text-xs">or</span>
                    <button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Manually</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Ship size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No shipments match this filter</p>
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Products</th>
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
                            <span className={`badge flex items-center gap-1 select-none ${canEdit ? 'cursor-pointer' : ''} ${STATUS_STYLES[s.status]}`}>
                              {STATUS_ICONS[s.status]}
                              {s.status}
                              {canEdit && <ChevronDown size={10} className="opacity-60" />}
                            </span>
                            {canEdit && <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover/status:block">
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
                            </div>}
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

                        {/* Products */}
                        <td className="px-5 py-3.5 max-w-[220px]">
                          {s.items.length > 0 ? (
                            <div className="space-y-1">
                              {s.items.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <span className={`text-xs truncate ${isDelivered ? 'text-slate-400' : 'text-slate-700'}`}>{item.productName}</span>
                                  <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${isDelivered ? 'text-slate-400' : 'text-slate-600'}`}>×{item.quantity.toLocaleString()}</span>
                                </div>
                              ))}
                              {s.items.length > 3 && (
                                <p className="text-[11px] text-slate-400">+{s.items.length - 3} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Units */}
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-lg font-bold ${isDelivered ? 'text-slate-400' : units > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                            {units > 0 ? units.toLocaleString() : '—'}
                          </span>
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
                          {canEdit && <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(s)} className="btn-ghost p-1.5" title="Edit">
                              <Pencil size={13} className="text-slate-400" />
                            </button>
                            <button onClick={() => deleteShipment(s.id)} className="btn-ghost p-1.5" title="Delete">
                              <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                            </button>
                          </div>}
                        </td>
                      </tr>

                      {/* Expanded product rows */}
                      {isExpanded && (
                        <tr key={`${s.id}-expanded`} className="bg-slate-50/60 border-b border-slate-100">
                          <td colSpan={8} className="px-5 py-4">
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

      {/* Import preview modal */}
      {importPreview && (
        <>
          <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={() => setImportPreview(null)} />
          <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[760px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <UploadCloud size={16} className="text-emerald-600" /> Import from Google Sheet
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {importPreview.length} shipment{importPreview.length !== 1 ? 's' : ''} found ·{' '}
                  <span className="text-brand-600 font-medium">{importSelected.size} selected</span>
                  {' '}— new shipments pre-selected
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleImportAll} className="flex items-center justify-center text-slate-400 hover:text-brand-600">
                        {importSelected.size === importPreview.length
                          ? <CheckSquare size={15} className="text-brand-600" />
                          : <Square size={15} />}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipment</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ETA</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Products</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((s, idx) => {
                    const isSelected   = importSelected.has(idx);
                    const alreadyInDb  = shipments.some(db => db.shipmentNumber === s.shipmentNumber);
                    const totalUnits   = s.items.reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <tr
                        key={idx}
                        onClick={() => toggleImportSelect(idx)}
                        className={`border-b border-slate-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-50/40' : 'hover:bg-slate-50'
                        } ${alreadyInDb ? 'opacity-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-center">
                          {isSelected
                            ? <CheckSquare size={15} className="text-brand-600 mx-auto" />
                            : <Square size={15} className="text-slate-300 mx-auto" />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {s.transportType === 'Sea' ? <Ship size={13} className="text-blue-400" /> : <Plane size={13} className="text-purple-400" />}
                            <span className="font-semibold text-slate-800">#{s.shipmentNumber}</span>
                            {alreadyInDb && <span className="text-[10px] text-slate-400 font-medium ml-1">already imported</span>}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{s.location}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {s.eta ? new Date(s.eta + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {totalUnits > 0 ? totalUnits.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {s.items.length > 0
                            ? s.items.slice(0, 2).map(i => i.productName).join(', ') + (s.items.length > 2 ? ` +${s.items.length - 2} more` : '')
                            : <span className="text-slate-300">No products detected</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${STATUS_STYLES[s.status as ShipmentStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0">
              <p className="text-xs text-slate-500">
                Importing will add selected shipments. Existing shipments won&apos;t be duplicated.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setImportPreview(null)} className="btn-secondary px-4">Cancel</button>
                <button
                  onClick={confirmImport}
                  disabled={importSelected.size === 0 || importSaving}
                  className="btn-primary disabled:opacity-50"
                >
                  {importSaving ? 'Importing…' : `Import ${importSelected.size} Shipment${importSelected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
