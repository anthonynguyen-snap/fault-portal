'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PlusCircle, RefreshCw, RotateCcw, ChevronRight, ChevronLeft,
  ChevronDown, ChevronUp, Mail, Search, Copy, Check, X,
  Package, Truck, AlertCircle, CheckCircle2, Trash2, Pencil,
} from 'lucide-react';
import { Return, ReturnCondition, ReturnDecision, ReturnStatus, FollowUpStatus } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Week helpers ───────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function weekLabel(mon: Date): string {
  const sun = addDays(mon, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const isThisWeek = fmtDate(mon) === fmtDate(getMondayOf(new Date()));
  if (isThisWeek) return 'This Week';
  return `${mon.toLocaleDateString('en-AU', opts)} – ${sun.toLocaleDateString('en-AU', opts)}`;
}
function daysSince(dateStr: string): number {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Badges ─────────────────────────────────────────────────────────────────────
function conditionBadge(c: ReturnCondition) {
  const map: Record<ReturnCondition, string> = {
    'Sealed':                   'bg-blue-100 text-blue-700',
    'Open - Good Condition':    'bg-emerald-100 text-emerald-700',
    'Open - Damaged Packaging': 'bg-amber-100 text-amber-700',
    'Faulty':                   'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[c]}`}>{c}</span>;
}
function decisionBadge(d: ReturnDecision) {
  const map: Record<ReturnDecision, string> = {
    'Full Refund':               'bg-emerald-100 text-emerald-700',
    'Exchange':                  'bg-blue-100 text-blue-700',
    'Refund + Restocking Fee':   'bg-amber-100 text-amber-700',
    'Refund - Return Label Fee': 'bg-orange-100 text-orange-700',
    'Replacement':               'bg-purple-100 text-purple-700',
    'Pending':                   'bg-slate-100 text-slate-600',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[d]}`}>{d}</span>;
}
function followUpBadge(f: FollowUpStatus) {
  const map: Record<FollowUpStatus, string> = {
    'N/A':       'bg-slate-100 text-slate-500',
    'Pending':   'bg-amber-100 text-amber-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[f]}`}>{f}</span>;
}

function FollowUpAgePill({ date }: { date: string }) {
  const days = daysSince(date);
  if (days < 3) return null;
  const cls = days >= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${cls}`}>{days}d pending</span>;
}

// ── Log Request Slide-over ─────────────────────────────────────────────────────
interface RequestForm {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  conversationLink: string;
  trackingNumber: string;
  starshipitOrderNumber: string;
  products: { name: string }[];
  notes: string;
  submittedBy: string;
}

function blankRequest(): RequestForm {
  return {
    orderNumber: '',
    customerName: '',
    customerEmail: '',
    conversationLink: '',
    trackingNumber: '',
    starshipitOrderNumber: '',
    products: [{ name: '' }],
    notes: '',
    submittedBy: '',
  };
}

function LogRequestSlideOver({
  open, onClose, onSaved, existingRequests, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (r: Return) => void;
  existingRequests: Return[];
  editing?: Return | null;
}) {
  const [form, setForm] = useState<RequestForm>(blankRequest());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/staff').then(r => r.json()).then(d => setStaff(d.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        orderNumber:           editing.orderNumber,
        customerName:          editing.customerName,
        customerEmail:         editing.customerEmail,
        conversationLink:      editing.conversationLink,
        trackingNumber:        editing.trackingNumber,
        starshipitOrderNumber: editing.starshipitOrderNumber ?? '',
        products:              editing.items.length > 0
                                 ? editing.items.map(i => ({ name: i.product }))
                                 : [{ name: '' }],
        notes:                 editing.notes,
        submittedBy:           editing.processedBy,
      });
    } else {
      setForm(blankRequest());
    }
    setError('');
  }, [open, editing]);

  // Duplicate detection — skip when editing (the match IS the record being edited)
  const duplicate = useMemo(() => {
    if (editing) return null;
    if (!form.orderNumber.trim() && !form.conversationLink.trim()) return null;
    return existingRequests.find(r =>
      (form.orderNumber.trim() && r.orderNumber.toLowerCase() === form.orderNumber.trim().toLowerCase()) ||
      (form.conversationLink.trim() && r.conversationLink && r.conversationLink.toLowerCase() === form.conversationLink.trim().toLowerCase())
    ) ?? null;
  }, [form.orderNumber, form.conversationLink, existingRequests, editing]);

  async function submit() {
    if (!form.orderNumber.trim()) return setError('Order number is required');
    if (!form.customerName.trim()) return setError('Customer name is required');
    setSaving(true); setError('');
    try {
      const productItems = form.products
        .map(p => p.name.trim())
        .filter(Boolean)
        .map(name => ({ product: name, condition: 'Sealed', decision: 'Pending', refundAmount: 0, restockingFee: 0 }));

      const payload = {
        orderNumber:           form.orderNumber.trim(),
        customerName:          form.customerName.trim(),
        customerEmail:         form.customerEmail.trim(),
        conversationLink:      form.conversationLink.trim(),
        trackingNumber:        form.trackingNumber.trim(),
        starshipitOrderNumber: form.starshipitOrderNumber.trim(),
        notes:                 form.notes.trim(),
        processedBy:           form.submittedBy.trim(),
        items:                 productItems,
      };

      let json;
      if (editing) {
        const res = await fetch(`/api/returns/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        json = await res.json();
      } else {
        const res = await fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, stage: 'requested', needsFollowUp: false }),
        });
        json = await res.json();
      }
      if (json.error) throw new Error(json.error);
      onSaved(json.data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save request');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Return Request' : 'Log Return Request'}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Duplicate warning */}
          {duplicate && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold">Possible duplicate</p>
                <p>A request already exists for <span className="font-mono font-bold">{duplicate.orderNumber}</span> — {duplicate.customerName} ({new Date(duplicate.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })})</p>
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Order Number <span className="text-red-400">*</span></label>
            <input value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} placeholder="e.g. 12345AU" className="form-input" />
          </div>
          <div>
            <label className="form-label">Customer Name <span className="text-red-400">*</span></label>
            <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Jane Smith" className="form-input" />
          </div>
          <div>
            <label className="form-label">Customer Email</label>
            <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="jane@example.com" className="form-input" />
          </div>
          <div>
            <label className="form-label">Conversation Link</label>
            <input value={form.conversationLink} onChange={e => setForm(f => ({ ...f, conversationLink: e.target.value }))} placeholder="Commslayer / Chatwoot URL" className="form-input" />
          </div>
          <div>
            <label className="form-label">Inbound Tracking Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} placeholder="e.g. 1Z999AA10123456784" className="form-input font-mono" />
          </div>
          <div>
            <label className="form-label">Starshipit Order Number <span className="text-slate-400 font-normal">(prepaid return label)</span></label>
            <input value={form.starshipitOrderNumber} onChange={e => setForm(f => ({ ...f, starshipitOrderNumber: e.target.value }))} placeholder="e.g. SS-123456" className="form-input font-mono" />
          </div>

          {/* Products being returned */}
          <div>
            <label className="form-label mb-2 block">Products Being Returned</label>
            <div className="space-y-2">
              {form.products.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.name}
                    onChange={e => {
                      const products = [...form.products];
                      products[i] = { name: e.target.value };
                      setForm(f => ({ ...f, products }));
                    }}
                    placeholder={`Product / SKU ${i + 1}`}
                    className="form-input flex-1"
                  />
                  {form.products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, products: f.products.filter((_, j) => j !== i) }))}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, products: [...f.products, { name: '' }] }))}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              <PlusCircle size={13} /> Add Another Product
            </button>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any context about this return…" className="form-input resize-none" />
          </div>
          <div>
            <label className="form-label">Logged By</label>
            <select value={form.submittedBy} onChange={e => setForm(f => ({ ...f, submittedBy: e.target.value }))} className="form-input">
              <option value="">Select your name…</option>
              {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex gap-2">
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Request'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </>
  );
}

// ── Region helpers ─────────────────────────────────────────────────────────────
type RegionFilter = 'all' | 'AU' | 'US';

function detectRegion(orderNumber: string): 'AU' | 'US' | 'other' {
  const upper = orderNumber.trim().toUpperCase();
  if (upper.endsWith('AU'))  return 'AU';
  if (upper.endsWith('US'))  return 'US';
  return 'other';
}

function regionMatchesFilter(orderNumber: string, filter: RegionFilter): boolean {
  if (filter === 'all') return true;
  return detectRegion(orderNumber) === filter;
}

// Build a carrier tracking URL from a bare tracking number or a raw pasted URL
function buildTrackingUrl(orderNumber: string, trackingNumber: string): string {
  if (!trackingNumber) return '';
  if (trackingNumber.startsWith('http')) return trackingNumber;
  const region = detectRegion(orderNumber);
  if (region === 'US') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  return `https://auspost.com.au/mypost/track/#/details/${trackingNumber}`;
}

// Strip a pasted URL down to just the bare tracking number for display
function displayTracking(trackingNumber: string): string {
  if (!trackingNumber) return '';
  if (!trackingNumber.startsWith('http')) return trackingNumber;
  try {
    const url = new URL(trackingNumber);
    // AusPost: /mypost/track/#/details/TRACKINGNUM
    const hashParts = url.hash.split('/');
    const last = hashParts[hashParts.length - 1];
    if (last && last !== 'details' && last !== 'track') return last;
    // USPS: ?tLabels=TRACKINGNUM
    const tLabels = url.searchParams.get('tLabels');
    if (tLabels) return tLabels;
  } catch { /* ignore */ }
  return trackingNumber;
}

function RegionPills({
  value, onChange, counts,
}: {
  value: RegionFilter;
  onChange: (v: RegionFilter) => void;
  counts: Record<RegionFilter, number>;
}) {
  const options: { key: RegionFilter; label: string; flag: string }[] = [
    { key: 'all', label: 'All',   flag: '' },
    { key: 'AU',  label: 'AU',    flag: '🇦🇺' },
    { key: 'US',  label: 'US',    flag: '🇺🇸' },
  ];
  return (
    <div className="flex items-center gap-1">
      {options.map(({ key, label, flag }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
            value === key
              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          {flag && <span>{flag}</span>}
          {label}
          <span className={`ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-bold ${
            value === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
          }`}>{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
type MainTab = 'requested' | 'processed';
type FilterTab = 'all' | ReturnStatus | 'follow-up';
type ReturnSortKey = 'date' | 'customerName' | 'totalRefundAmount' | 'status';
type SortDir = 'asc' | 'desc';

export default function ReturnsPage() {
  const [allReturns, setAllReturns] = useState<Return[]>([]);
  const [loading, setLoading]       = useState(true);
  const [mainTab, setMainTab]       = useState<MainTab>('requested');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Return | null>(null);

  // Processed tab state
  const [filter, setFilter]         = useState<FilterTab>('all');
  const [weekStart, setWeekStart]   = useState<Date>(() => getMondayOf(new Date()));
  const [teamSearch, setTeamSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sortKey, setSortKey]       = useState<ReturnSortKey>('date');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [reqSearch, setReqSearch]   = useState('');

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/returns');
    const json = await res.json();
    setAllReturns(json.data || []);
    setLoading(false);
  }

  async function markReceived(id: string) {
    setUpdatingId(id);
    setAllReturns(prev => prev.map(r => r.id === id ? { ...r, parcelReceived: true } : r));
    await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcelReceived: true }),
    });
    setUpdatingId(null);
  }

  async function updateStatus(id: string, newStatus: ReturnStatus) {
    setUpdatingId(id);
    setAllReturns(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdatingId(null);
  }

  async function updateFollowUp(id: string, newFollowUp: FollowUpStatus) {
    // If no follow-up is needed, automatically close the return
    const autoClose = newFollowUp === 'N/A';
    setUpdatingId(id);
    setAllReturns(prev => prev.map(r => r.id === id
      ? { ...r, followUpStatus: newFollowUp, ...(autoClose ? { status: 'Closed' as ReturnStatus } : {}) }
      : r
    ));
    await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpStatus: newFollowUp, ...(autoClose ? { status: 'Closed' } : {}) }),
    });
    setUpdatingId(null);
  }

  function copyOrder(e: React.MouseEvent, id: string, value: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  useEffect(() => { load(); }, []);

  // ── Requested tab data ────────────────────────────────────────────────────
  // Build a set of order numbers that already have a processed return so we
  // can hide stale request records that were never manually cleaned up.
  const processedOrderNums = useMemo(
    () => new Set(allReturns.filter(r => r.stage === 'processed').map(r => r.orderNumber.toLowerCase())),
    [allReturns]
  );

  const requests = useMemo(
    () => allReturns.filter(r => r.stage === 'requested' && !processedOrderNums.has(r.orderNumber.toLowerCase())),
    [allReturns, processedOrderNums]
  );

  const filteredRequests = useMemo(() => {
    const q = reqSearch.trim().toLowerCase();
    return requests.filter(r => {
      if (!regionMatchesFilter(r.orderNumber, regionFilter)) return false;
      if (!q) return true;
      return (
        r.orderNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.trackingNumber.toLowerCase().includes(q)
      );
    });
  }, [requests, reqSearch, regionFilter]);

  const pendingRequests   = filteredRequests.filter(r => !r.parcelReceived);
  const receivedRequests  = filteredRequests.filter(r => r.parcelReceived);

  // ── Processed tab data ────────────────────────────────────────────────────
  const weekEnd    = addDays(weekStart, 6);
  const isThisWeek = fmtDate(weekStart) === fmtDate(getMondayOf(new Date()));

  const processed = useMemo(() => allReturns.filter(r => r.stage === 'processed'), [allReturns]);

  const weekReturns = useMemo(() =>
    processed.filter(r =>
      r.date >= fmtDate(weekStart) &&
      r.date <= fmtDate(weekEnd) &&
      regionMatchesFilter(r.orderNumber, regionFilter)
    ),
    [processed, weekStart, weekEnd, regionFilter]
  );

  // Region counts for the pills (Requested tab uses requests, Processed uses weekReturns-before-region-filter)
  const reqRegionCounts: Record<RegionFilter, number> = useMemo(() => {
    const base = requests.filter(r => {
      const q = reqSearch.trim().toLowerCase();
      if (!q) return true;
      return r.orderNumber.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q) || r.trackingNumber.toLowerCase().includes(q);
    });
    return {
      all: base.length,
      AU:  base.filter(r => detectRegion(r.orderNumber) === 'AU').length,
      US:  base.filter(r => detectRegion(r.orderNumber) === 'US').length,
    };
  }, [requests, reqSearch]);

  const procRegionCounts: Record<RegionFilter, number> = useMemo(() => {
    const base = processed.filter(r => r.date >= fmtDate(weekStart) && r.date <= fmtDate(weekEnd));
    return {
      all: base.length,
      AU:  base.filter(r => detectRegion(r.orderNumber) === 'AU').length,
      US:  base.filter(r => detectRegion(r.orderNumber) === 'US').length,
    };
  }, [processed, weekStart, weekEnd]);

  const teamFiltered = (list: Return[]) =>
    teamSearch.trim() ? list.filter(r => r.assignedTo.toLowerCase().includes(teamSearch.toLowerCase())) : list;

  const pendingFollowUp = teamFiltered(processed).filter(r => r.followUpStatus === 'Pending');

  function handleSort(key: ReturnSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: ReturnSortKey }) {
    if (sortKey !== col) return <ChevronDown size={12} className="text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-brand-600" /> : <ChevronDown size={12} className="text-brand-600" />;
  }

  const displayed = useMemo(() => {
    let base: Return[];
    if (filter === 'follow-up') base = pendingFollowUp;
    else {
      const filtered = teamFiltered(weekReturns);
      base = filter === 'all' ? filtered : filtered.filter(r => r.status === filter);
    }
    return [...base].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'date')              { av = a.date; bv = b.date; }
      else if (sortKey === 'customerName') { av = a.customerName.toLowerCase(); bv = b.customerName.toLowerCase(); }
      else if (sortKey === 'totalRefundAmount') { av = a.totalRefundAmount; bv = b.totalRefundAmount; }
      else if (sortKey === 'status')       { av = a.status; bv = b.status; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filter, weekReturns, teamSearch, processed, sortKey, sortDir]);

  const counts = {
    all:        teamFiltered(weekReturns).length,
    Processed:  teamFiltered(weekReturns).filter(r => r.status === 'Processed').length,
    Received:   teamFiltered(weekReturns).filter(r => r.status === 'Received').length,
    'follow-up': pendingFollowUp.length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Returns</h1>
          <p className="page-subtitle">Track return requests and processed parcels</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" title="Refresh"><RefreshCw size={15} /></button>
          {mainTab === 'requested' ? (
            <button onClick={() => setShowRequestForm(true)} className="btn-primary flex items-center gap-2">
              <PlusCircle size={16} /> Log Request
            </button>
          ) : (
            <Link href="/returns/new" className="btn-primary flex items-center gap-2">
              <PlusCircle size={16} /> Log Return
            </Link>
          )}
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: 'requested', label: 'Requested', count: requests.length },
          { key: 'processed', label: 'Processed', count: processed.length },
        ] as { key: MainTab; label: string; count: number }[]).map(({ key, label, count }) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              mainTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              mainTab === key ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── REQUESTED TAB ─────────────────────────────────────────────────────── */}
      {mainTab === 'requested' && (
        <>
          {/* Search + Region filter */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative max-w-sm flex-1 min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={reqSearch}
                onChange={e => setReqSearch(e.target.value)}
                placeholder="Search by order, name, or tracking…"
                className="form-input pl-8 py-1.5 text-sm"
              />
            </div>
            <RegionPills value={regionFilter} onChange={setRegionFilter} counts={reqRegionCounts} />
          </div>

          {loading ? <TableSkeleton rows={5} cols={5} /> : (
            <div className="space-y-6">
              {/* Awaiting parcel */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Truck size={14} className="text-orange-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting Parcel</span>
                  <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                </div>
                {pendingRequests.length === 0 ? (
                  <div className="card p-6 text-center text-sm text-slate-400">No pending requests</div>
                ) : (
                  <div className="card overflow-clip">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date / Order</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Products</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tracking</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Logged By</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRequests.map((r, idx) => (
                          <tr key={r.id} className={`border-b border-slate-100 last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-[#e0f4fa] transition-colors group`}>
                            <td className="px-4 py-3">
                              <p className="text-xs text-slate-400 font-mono">{r.date}</p>
                              <span className="group/copy inline-flex items-center gap-1">
                                <span className="font-medium font-mono text-slate-800">{r.orderNumber}</span>
                                <button onClick={e => copyOrder(e, r.id, r.orderNumber)} className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-slate-400 hover:text-brand-600 p-0.5 rounded">
                                  {copiedId === r.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                </button>
                              </span>
                              {detectRegion(r.orderNumber) === 'AU' && (
                                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">🇦🇺 AU · Aus Post</span>
                              )}
                              {detectRegion(r.orderNumber) === 'US' && (
                                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">🇺🇸 US · via USPS</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{r.customerName}</p>
                              {r.customerEmail && (
                                <a href={`mailto:${r.customerEmail}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5 mt-0.5">
                                  <Mail size={10} />{r.customerEmail}
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {r.items.length > 0 ? (
                                <div className="space-y-0.5">
                                  <p className="text-sm text-slate-700 font-medium">{r.items[0].product}</p>
                                  {r.items.length > 1 && <p className="text-xs text-slate-400">+{r.items.length - 1} more</p>}
                                </div>
                              ) : <span className="text-xs text-slate-400 italic">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {r.trackingNumber ? (
                                <a
                                  href={buildTrackingUrl(r.orderNumber, r.trackingNumber)}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-xs text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded border border-brand-100 transition-colors max-w-[220px] truncate"
                                  title={r.trackingNumber}
                                >
                                  <span className="truncate">{displayTracking(r.trackingNumber)}</span>
                                  <ChevronRight size={10} className="flex-shrink-0 opacity-60" />
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Not yet provided</span>
                              )}
                              {r.starshipitOrderNumber && (
                                <p className="text-xs text-slate-500 mt-0.5 font-mono">SS: {r.starshipitOrderNumber}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-slate-500">{r.processedBy || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => { setEditingRequest(r); setShowRequestForm(true); }}
                                  className="text-slate-400 hover:text-brand-600 transition-colors p-1.5 rounded-md hover:bg-slate-100"
                                  title="Edit request"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => markReceived(r.id)}
                                  disabled={updatingId === r.id}
                                  className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                  <CheckCircle2 size={12} /> Mark Received
                                </button>
                                <Link href={`/returns/${r.id}`} className="text-slate-400 hover:text-brand-600 transition-colors">
                                  <ChevronRight size={18} />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Parcel received — awaiting processing */}
              {receivedRequests.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parcel Received — Awaiting Processing</span>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{receivedRequests.length}</span>
                  </div>
                  <div className="card overflow-clip">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date / Order</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tracking</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {receivedRequests.map((r, idx) => (
                          <tr key={r.id} className={`border-b border-slate-100 last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-[#e0f4fa] transition-colors`}>
                            <td className="px-4 py-3">
                              <p className="text-xs text-slate-400 font-mono">{r.date}</p>
                              <p className="font-medium font-mono text-slate-800">{r.orderNumber}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{r.customerName}</p>
                              {r.customerEmail && <a href={`mailto:${r.customerEmail}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5 mt-0.5"><Mail size={10} />{r.customerEmail}</a>}
                            </td>
                            <td className="px-4 py-3">
                              {r.trackingNumber ? (
                                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">{r.trackingNumber}</span>
                              ) : <span className="text-xs text-slate-400 italic">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                <Link href="/returns/new" className="text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                                  <PlusCircle size={12} /> Process
                                </Link>
                                <Link href={`/returns/${r.id}`} className="text-slate-400 hover:text-brand-600 transition-colors"><ChevronRight size={18} /></Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {requests.length === 0 && !loading && (
                <div className="card">
                  <EmptyState icon={RotateCcw} title="No return requests" description="Log a request when a customer asks to return an item." action={{ label: 'Log Request', onClick: () => setShowRequestForm(true) }} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PROCESSED TAB ─────────────────────────────────────────────────────── */}
      {mainTab === 'processed' && (
        <>
          {/* Week navigator + region filter + team search */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1 shadow-sm">
              <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold text-slate-700 px-2 min-w-[120px] text-center">{weekLabel(weekStart)}</span>
              <button onClick={() => setWeekStart(d => addDays(d, 7))} disabled={isThisWeek} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
            </div>
            <RegionPills value={regionFilter} onChange={setRegionFilter} counts={procRegionCounts} />
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder="Filter by team member…" className="form-input pl-8 py-1.5 text-sm" />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
            {([
              { key: 'all',       label: 'This Week'        },
              { key: 'Processed', label: 'Processed'        },
              { key: 'Received',  label: 'Received'         },
              { key: 'follow-up', label: 'Needs Follow-up'  },
            ] as { key: FilterTab; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${filter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${filter === key ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {counts[key as keyof typeof counts] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : displayed.length === 0 ? (
            <div className="card overflow-clip">
              {filter === 'follow-up' ? (
                <EmptyState icon={RotateCcw} title="No pending follow-ups" description="All follow-ups are resolved — nice work!" />
              ) : filter !== 'all' ? (
                <EmptyState icon={RotateCcw} title={`No ${filter.toLowerCase()} returns this week`} description="No returns match this status for the selected week." action={{ label: 'View all returns', onClick: () => setFilter('all') }} />
              ) : (
                <EmptyState icon={RotateCcw} title={`No returns for ${weekLabel(weekStart).toLowerCase()}`} description={isThisWeek ? 'Log a return to get started.' : 'No returns were logged for this week.'} action={isThisWeek ? { label: 'Log Return', href: '/returns/new' } : undefined} />
              )}
            </div>
          ) : (
            <div className="card overflow-clip">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                    {([
                      { key: 'date' as ReturnSortKey,         label: 'Date / Order' },
                      { key: 'customerName' as ReturnSortKey, label: 'Customer'     },
                    ] as { key: ReturnSortKey; label: string }[]).map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1">{col.label}<SortIcon col={col.key} /></div>
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Condition</th>
                    <th onClick={() => handleSort('totalRefundAmount')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-1">Decision<SortIcon col="totalRefundAmount" /></div>
                    </th>
                    <th onClick={() => handleSort('status')} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-1">Status<SortIcon col="status" /></div>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Follow-up</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r, idx) => (
                    <tr key={r.id} className={`transition-colors group border-b border-slate-100 last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} hover:bg-[#e0f4fa]`}>
                      <td className="px-4 py-3">
                        <p className="font-medium font-mono text-slate-800">{r.date}</p>
                        <span className="group/copy inline-flex items-center gap-1">
                          <span className="text-xs text-slate-400 font-mono">{r.orderNumber}</span>
                          <button onClick={e => copyOrder(e, r.id, r.orderNumber)} title="Copy order number" className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-slate-400 hover:text-brand-600 p-0.5 rounded">
                            {copiedId === r.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          </button>
                        </span>
                        {r.followUpStatus === 'Pending' && <FollowUpAgePill date={r.date} />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.customerName}</p>
                        {r.customerEmail && <a href={`mailto:${r.customerEmail}`} className="text-xs text-brand-600 hover:underline flex items-center gap-0.5"><Mail size={10} />{r.customerEmail}</a>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 font-medium text-sm">{r.items[0]?.product || '—'}</p>
                        {r.items.length > 1 && <p className="text-xs text-slate-400">+{r.items.length - 1} more item{r.items.length > 2 ? 's' : ''}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {r.items[0] && conditionBadge(r.items[0].condition)}
                        {r.items.length > 1 && <p className="text-xs text-slate-400 mt-0.5">mixed</p>}
                      </td>
                      <td className="px-4 py-3">
                        {r.items[0] && decisionBadge(r.items[0].decision)}
                        {r.totalRefundAmount > 0 && <p className="text-xs text-slate-500 mt-0.5 font-mono">${r.totalRefundAmount.toFixed(2)}</p>}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <select value={r.status} disabled={updatingId === r.id} onChange={e => updateStatus(r.id, e.target.value as ReturnStatus)}
                          className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none focus:ring-2 focus:ring-brand-400 focus:outline-none transition-opacity ${updatingId === r.id ? 'opacity-50' : ''} ${r.status === 'Received' ? 'bg-blue-100 text-blue-700' : r.status === 'Inspected' ? 'bg-amber-100 text-amber-700' : r.status === 'Processed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <option value="Received">Received</option>
                          <option value="Inspected">Inspected</option>
                          <option value="Processed">Processed</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <select value={r.followUpStatus} disabled={updatingId === r.id} onChange={e => updateFollowUp(r.id, e.target.value as FollowUpStatus)}
                          className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none focus:ring-2 focus:ring-brand-400 focus:outline-none transition-opacity ${updatingId === r.id ? 'opacity-50' : ''} ${r.followUpStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : r.followUpStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <option value="N/A">N/A</option>
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                        </select>
                        {r.assignedTo && <p className="text-xs text-slate-400 mt-0.5">{r.assignedTo}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/returns/${r.id}`} className="text-slate-400 hover:text-brand-600 transition-colors"><ChevronRight size={18} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Log Request slide-over */}
      <LogRequestSlideOver
        open={showRequestForm}
        onClose={() => { setShowRequestForm(false); setEditingRequest(null); }}
        onSaved={r => {
          if (editingRequest) {
            setAllReturns(prev => prev.map(x => x.id === r.id ? r : x));
          } else {
            setAllReturns(prev => [r, ...prev]);
          }
          setEditingRequest(null);
        }}
        existingRequests={requests}
        editing={editingRequest}
      />
    </div>
  );
}
