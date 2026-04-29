'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard, Plus, X, RefreshCw, CheckCircle, XCircle,
  ExternalLink, Clock, ChevronDown, ChevronUp, AlertTriangle, Pencil,
  Copy, Check, ArrowUpDown,
} from 'lucide-react';
import { RefundRequest, RefundResolution, REFUND_REASONS } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StaffMember { id: string; name: string; }

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

// ── Currency config ───────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'AUD', symbol: '$',  locale: 'en-AU', label: 'AUD — Australian Dollar' },
  { code: 'USD', symbol: '$',  locale: 'en-US', label: 'USD — US Dollar' },
  { code: 'GBP', symbol: '£',  locale: 'en-GB', label: 'GBP — British Pound' },
  { code: 'NZD', symbol: '$',  locale: 'en-NZ', label: 'NZD — New Zealand Dollar' },
  { code: 'SGD', symbol: '$',  locale: 'en-SG', label: 'SGD — Singapore Dollar' },
  { code: 'EUR', symbol: '€',  locale: 'de-DE', label: 'EUR — Euro' },
] as const;

type CurrencyCode = typeof CURRENCIES[number]['code'];

function detectCurrency(orderNumber: string): CurrencyCode {
  const upper = orderNumber.trim().toUpperCase();
  if (upper.endsWith('ROW') || upper.endsWith('UK')) return 'GBP';
  if (upper.endsWith('US')) return 'USD';
  if (upper.endsWith('AU')) return 'AUD';
  return 'AUD';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(iso: string) {
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function fmt(amount: number, currency = 'AUD') {
  const c = CURRENCIES.find(x => x.code === currency) ?? CURRENCIES[0];
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code }).format(amount);
}

function AgePill({ createdAt }: { createdAt: string }) {
  const days = daysSince(createdAt);
  if (days < 1) return <span className="text-xs text-slate-400">Today</span>;
  const cls = days >= 3 ? 'text-red-600 font-semibold' : days >= 1 ? 'text-amber-600' : 'text-slate-400';
  return <span className={`text-xs ${cls}`}>{days}d ago</span>;
}

function StatusBadge({ status }: { status: RefundRequest['status'] }) {
  if (status === 'Processed') return <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle size={11} /> Processed</span>;
  if (status === 'Rejected')  return <span className="badge bg-red-100 text-red-700"><XCircle size={11} /> Rejected</span>;
  return <span className="badge bg-amber-100 text-amber-700"><Clock size={11} /> Pending</span>;
}

function ResolutionBadge({ resolution }: { resolution: RefundResolution }) {
  if (resolution === 'Cash Refund')  return <span className="badge bg-blue-100 text-blue-700">💵 Cash Refund</span>;
  if (resolution === 'Store Credit') return <span className="badge bg-purple-100 text-purple-700">🎁 Store Credit</span>;
  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RefundsPage() {
  return (
    <Suspense>
      <RefundsInner />
    </Suspense>
  );
}

function RefundsInner() {
  const searchParams = useSearchParams();
  const [requests, setRequests]   = useState<RefundRequest[]>([]);
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [saveOk, setSaveOk]       = useState(false);

  // Form state — auto-open if ?new=1
  const [showForm, setShowForm]   = useState(searchParams.get('new') === '1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState({
    orderNumber: '', customerName: '', amount: '', currency: 'AUD' as CurrencyCode,
    reason: '', notes: '', shopifyLink: '', commsLink: '', submittedBy: '',
  });
  const [formError, setFormError] = useState('');

  // Process panel state
  const [processing, setProcessing] = useState<RefundRequest | null>(null);
  const [processNotes, setProcessNotes] = useState('');
  const [processResolution, setProcessResolution] = useState<RefundResolution>('Cash Refund');
  const [expanded, setExpanded]   = useState<string | null>(null);

  // Auto-detect currency from order number suffix (only when not manually overridden mid-session)
  useEffect(() => {
    setForm(f => ({ ...f, currency: detectCurrency(f.orderNumber) }));
  }, [form.orderNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter
  const [filter, setFilter]       = useState<'Pending' | 'All'>('Pending');

  // Sort
  type RefundSortKey = 'createdAt' | 'amount' | 'customerName' | 'status';
  const [sortKey, setSortKey] = useState<RefundSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleSort(key: RefundSortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function copyOrder(e: React.MouseEvent, id: string, value: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function load() {
    setLoading(true);
    try {
      const [refRes, staffRes] = await Promise.all([
        fetch('/api/refunds'),
        fetch('/api/staff'),
      ]);
      const refJson   = await refRes.json();
      const staffJson = await staffRes.json();
      setRequests(refJson.data ?? []);
      setStaff(staffJson.data ?? []);
    } catch {
      setError('Failed to load refund requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Auto-open a specific refund if ?open=id is in the URL
  const openId = searchParams.get('open');
  useEffect(() => {
    if (!openId || loading || requests.length === 0) return;
    const target = requests.find(r => r.id === openId);
    if (target) openEdit(target);
  }, [openId, loading, requests]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setForm({ orderNumber: '', customerName: '', amount: '', currency: 'AUD', reason: '', notes: '', shopifyLink: '', commsLink: '', submittedBy: '' });
    setFormError('');
  }

  function closeForm() { setShowForm(false); setEditingId(null); resetForm(); }

  function openEdit(req: RefundRequest) {
    setForm({
      orderNumber:  req.orderNumber,
      customerName: req.customerName,
      amount:       req.amount > 0 ? String(req.amount) : '',
      currency:     (req.currency as CurrencyCode) ?? detectCurrency(req.orderNumber),
      reason:       req.reason,
      notes:        req.notes,
      shopifyLink:  req.shopifyLink,
      commsLink:    req.commsLink,
      submittedBy:  req.submittedBy,
    });
    setEditingId(req.id);
    setFormError('');
    setShowForm(true);
  }

  async function submitRequest() {
    if (!form.orderNumber.trim()) return setFormError('Order number is required');
    if (!form.customerName.trim()) return setFormError('Customer name is required');
    if (!form.reason) return setFormError('Please select a reason');
    if (!form.shopifyLink.trim()) return setFormError('Shopify order link is required');
    if (!form.commsLink.trim()) return setFormError('Conversation link is required');
    if (!form.submittedBy) return setFormError('Please select your name');
    setSaving(true);
    setFormError('');
    const payload = {
      orderNumber:  form.orderNumber.trim(),
      customerName: form.customerName.trim(),
      amount:       parseFloat(form.amount) || 0,
      currency:     form.currency,
      reason:       form.reason,
      notes:        form.notes.trim(),
      shopifyLink:  form.shopifyLink.trim(),
      commsLink:    form.commsLink.trim(),
      submittedBy:  form.submittedBy,
    };
    try {
      if (editingId) {
        // Edit existing request
        const res = await fetch(`/api/refunds/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setRequests(prev => prev.map(r => r.id === editingId ? { ...r, ...payload } : r));
      } else {
        // New request
        const res = await fetch('/api/refunds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setRequests(prev => [json.data, ...prev]);
      }
      closeForm();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function markStatus(id: string, status: 'Processed' | 'Rejected') {
    setSaving(true);
    try {
      const resolution = status === 'Processed' ? processResolution : 'Pending';
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, processedNotes: processNotes, resolution }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequests(prev => prev.map(r =>
        r.id === id
          ? { ...r, status, processedNotes: processNotes, resolution: resolution as RefundResolution, processedAt: new Date().toISOString() }
          : r
      ));
      setProcessing(null);
      setProcessNotes('');
      setProcessResolution('Cash Refund');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Stats
  const pending      = useMemo(() => requests.filter(r => r.status === 'Pending'), [requests]);
  const pendingTotal = useMemo(() => pending.reduce((s, r) => s + r.amount, 0), [pending]);

  // This week's processed — resets naturally each Monday
  const processedThisWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return requests.filter(r => r.status === 'Processed' && r.processedAt && new Date(r.processedAt) >= monday);
  }, [requests]);
  const processedThisWeekTotal = useMemo(() => processedThisWeek.reduce((s, r) => s + r.amount, 0), [processedThisWeek]);

  const storeCreditThisWeek = useMemo(() => processedThisWeek.filter(r => r.resolution === 'Store Credit'), [processedThisWeek]);
  const cashRefundThisWeek  = useMemo(() => processedThisWeek.filter(r => r.resolution === 'Cash Refund'),  [processedThisWeek]);
  const storeCreditTotal    = useMemo(() => storeCreditThisWeek.reduce((s, r) => s + r.amount, 0), [storeCreditThisWeek]);
  const cashRefundTotal     = useMemo(() => cashRefundThisWeek.reduce((s, r)  => s + r.amount, 0), [cashRefundThisWeek]);

  const displayed = useMemo(() => {
    const base = filter === 'Pending' ? pending : requests;
    return [...base].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'createdAt')      { av = a.createdAt; bv = b.createdAt; }
      else if (sortKey === 'amount')    { av = a.amount; bv = b.amount; }
      else if (sortKey === 'customerName') { av = a.customerName.toLowerCase(); bv = b.customerName.toLowerCase(); }
      else if (sortKey === 'status')    { av = a.status; bv = b.status; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  },
    [filter, pending, requests, sortKey, sortDir]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Refund Requests</h1>
          <p className="page-subtitle">Team submits requests · Anthony processes them</p>
        </div>
        <div className="flex items-center gap-2">
          {saveOk && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle size={14} /> {editingId ? 'Saved' : 'Submitted'}
            </span>
          )}
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={14} /> Request Refund
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-slate-900">{pending.length}</p>
            <p className="text-xs text-slate-500">Pending requests</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <CreditCard size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-slate-900">{fmt(pendingTotal)}</p>
            <p className="text-xs text-slate-500">Amount pending</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-slate-900">{processedThisWeek.length}</p>
            <p className="text-xs text-slate-500">Processed this week</p>
            {processedThisWeekTotal > 0 && (
              <p className="text-xs text-emerald-600 font-medium">{fmt(processedThisWeekTotal)}</p>
            )}
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 mb-2 font-medium">This week breakdown</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-600 font-medium">💵 Cash</span>
              <span className="text-xs font-semibold font-mono text-slate-800">
                {cashRefundThisWeek.length > 0 ? fmt(cashRefundTotal) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-600 font-medium">🎁 Store Credit</span>
              <span className="text-xs font-semibold font-mono text-slate-800">
                {storeCreditThisWeek.length > 0 ? fmt(storeCreditTotal) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Queue */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-800">Requests</h2>
            {/* Sort controls */}
            <div className="flex items-center gap-1">
              {([
                { key: 'createdAt' as const, label: 'Date' },
                { key: 'amount' as const, label: 'Amount' },
                { key: 'customerName' as const, label: 'Name' },
              ]).map(s => (
                <button key={s.key} onClick={() => handleSort(s.key)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    sortKey === s.key ? 'bg-brand-50 text-brand-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}>
                  {s.label}
                  {sortKey === s.key
                    ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                    : <ArrowUpDown size={10} className="opacity-40" />}
                </button>
              ))}
            </div>
          </div>
          {/* Filter toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['Pending', 'All'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f === 'Pending' ? `Pending (${pending.length})` : 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : displayed.length === 0 ? (
          filter === 'Pending' ? (
            <EmptyState
              icon={CheckCircle}
              title="No pending requests"
              description="All caught up — no refunds waiting for action."
              action={requests.length > 0 ? { label: 'View all requests', onClick: () => setFilter('All') } : undefined}
            />
          ) : (
            <EmptyState
              icon={CreditCard}
              title="No requests yet"
              description="Submit the first refund request using the form above."
            />
          )
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(req => {
              const isExpanded = expanded === req.id;
              const isPending  = req.status === 'Pending';
              return (
                <div key={req.id}>
                  {/* Main row */}
                  <div className={`flex items-start gap-4 px-5 py-4 ${isPending ? 'hover:bg-slate-50/60' : 'bg-slate-50/30'} transition-colors`}>
                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${isPending ? 'bg-amber-400' : req.status === 'Processed' ? 'bg-emerald-400' : 'bg-red-400'}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{req.customerName}</span>
                        <span className="group/copy inline-flex items-center gap-1">
                          <span className="text-xs text-slate-400 font-mono">#{req.orderNumber}</span>
                          <button onClick={e => copyOrder(e, req.id, req.orderNumber)} title="Copy order number"
                            className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-slate-400 hover:text-brand-600 p-0.5 rounded">
                            {copiedId === req.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          </button>
                        </span>
                        <StatusBadge status={req.status} />
                        {req.status === 'Processed' && req.resolution !== 'Pending' && (
                          <ResolutionBadge resolution={req.resolution} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">{req.reason}</span>
                        {req.submittedBy && (
                          <span className="text-xs text-slate-400">by {req.submittedBy}</span>
                        )}
                        <AgePill createdAt={req.createdAt} />
                      </div>
                      {req.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">{req.notes}</p>
                      )}
                      {/* Links */}
                      {(req.shopifyLink || req.commsLink) && (
                        <div className="flex items-center gap-3 mt-2">
                          {req.shopifyLink && (
                            <a href={req.shopifyLink} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                              <ExternalLink size={11} /> Shopify Order
                            </a>
                          )}
                          {req.commsLink && (
                            <a href={req.commsLink} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
                              <ExternalLink size={11} /> Conversation
                            </a>
                          )}
                        </div>
                      )}
                      {/* Processed notes */}
                      {req.processedNotes && (
                        <p className="text-xs text-slate-500 mt-1 bg-slate-100 px-2 py-1 rounded-md inline-block">
                          Note: {req.processedNotes}
                        </p>
                      )}
                    </div>

                    {/* Amount + actions */}
                    <div className="flex-shrink-0 text-right space-y-2">
                      <p className="text-lg font-bold font-mono text-slate-900">{fmt(req.amount, req.currency)}</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => openEdit(req)}
                          className="btn-ghost text-xs py-1 px-2 gap-1"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        {isPending ? (
                          <button
                            onClick={() => { setProcessing(req); setProcessNotes(''); setProcessResolution('Cash Refund'); }}
                            className="btn-primary text-xs py-1 px-3"
                          >
                            Process
                          </button>
                        ) : (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : req.id)}
                            className="btn-ghost text-xs py-1 px-2 gap-1"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            Details
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details for processed */}
                  {isExpanded && !isPending && (
                    <div className="px-5 pb-4 bg-slate-50/50 border-t border-slate-100">
                      <div className="ml-6 grid grid-cols-2 gap-2 pt-3 text-xs text-slate-500">
                        {req.processedAt && (
                          <span>Processed: {new Date(req.processedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                        {req.resolution && req.resolution !== 'Pending' && (
                          <span>Resolution: {req.resolution === 'Cash Refund' ? '💵 Cash Refund' : '🎁 Store Credit'}</span>
                        )}
                        {req.processedNotes && <span className="col-span-2">Note: {req.processedNotes}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit / Edit Refund Request Slide-over */}
      <SlideOver open={showForm} onClose={closeForm} title={editingId ? 'Edit Refund Request' : 'Request a Refund'}>
        <div className="space-y-4">
          {/* Order number */}
          <div>
            <label className="form-label">Order Number <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.orderNumber}
              onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))}
              placeholder="e.g. 12345"
              className="form-input"
              autoFocus
            />
          </div>

          {/* Customer name */}
          <div>
            <label className="form-label">Customer Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="e.g. Jane Smith"
              className="form-input"
            />
          </div>

          {/* Amount + Currency */}
          <div>
            <label className="form-label">Refund Amount <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                className="form-input w-28 flex-shrink-0 text-sm"
                title="Currency"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {CURRENCIES.find(c => c.code === form.currency)?.symbol ?? '$'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="form-input pl-7"
                />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="form-label">Reason <span className="text-red-400">*</span></label>
            <select
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="form-input"
            >
              <option value="">Select a reason…</option>
              {REFUND_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes — always shown, labelled optional unless Other */}
          <div>
            <label className="form-label">
              Notes
              {form.reason !== 'Other' && <span className="text-slate-400 font-normal"> (optional)</span>}
              {form.reason === 'Other' && <span className="text-red-400"> *</span>}
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={form.reason === 'Other' ? 'Please describe the reason…' : 'Any additional context…'}
              rows={2}
              className="form-input resize-none text-sm"
            />
          </div>

          {/* Shopify link */}
          <div>
            <label className="form-label">Shopify Order Link <span className="text-red-400">*</span></label>
            <input
              type="url"
              value={form.shopifyLink}
              onChange={e => setForm(f => ({ ...f, shopifyLink: e.target.value }))}
              placeholder="https://admin.shopify.com/store/…"
              className="form-input"
            />
          </div>

          {/* Comms link */}
          <div>
            <label className="form-label">Conversation Link <span className="text-red-400">*</span></label>
            <input
              type="url"
              value={form.commsLink}
              onChange={e => setForm(f => ({ ...f, commsLink: e.target.value }))}
              placeholder="Commslayer / Chatwoot conversation URL"
              className="form-input"
            />
          </div>

          {/* Submitted by */}
          <div>
            <label className="form-label">Submitted By <span className="text-red-400">*</span></label>
            <select
              value={form.submittedBy}
              onChange={e => setForm(f => ({ ...f, submittedBy: e.target.value }))}
              className="form-input"
            >
              <option value="">Select your name…</option>
              {staff.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
              <AlertTriangle size={14} /> {formError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={submitRequest}
              disabled={saving}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : editingId ? <Pencil size={14} /> : <Plus size={14} />}
              {editingId ? 'Save Changes' : 'Submit Request'}
            </button>
            <button onClick={closeForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </SlideOver>

      {/* Process Slide-over */}
      <SlideOver
        open={!!processing}
        onClose={() => { setProcessing(null); setProcessNotes(''); setProcessResolution('Cash Refund'); }}
        title="Process Refund"
      >
        {processing && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">{processing.customerName}</span>
                <span className="text-xl font-bold text-slate-900">{fmt(processing.amount, processing.currency)}</span>
              </div>
              <p className="text-xs text-slate-500">Order #{processing.orderNumber}</p>
              <p className="text-xs text-slate-500">{processing.reason}</p>
              {processing.notes && <p className="text-xs text-slate-400 italic">{processing.notes}</p>}
              {processing.submittedBy && <p className="text-xs text-slate-400">Submitted by {processing.submittedBy}</p>}
            </div>

            {/* Quick links */}
            {(processing.shopifyLink || processing.commsLink) && (
              <div className="flex gap-3">
                {processing.shopifyLink && (
                  <a href={processing.shopifyLink} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 justify-center">
                    <ExternalLink size={13} /> Open in Shopify
                  </a>
                )}
                {processing.commsLink && (
                  <a href={processing.commsLink} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 justify-center">
                    <ExternalLink size={13} /> Conversation
                  </a>
                )}
              </div>
            )}

            {/* Resolution */}
            <div>
              <label className="form-label">Resolution</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Cash Refund', 'Store Credit'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setProcessResolution(opt)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      processResolution === opt
                        ? opt === 'Cash Refund'
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'bg-purple-50 border-purple-400 text-purple-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    {opt === 'Cash Refund' ? '💵' : '🎁'} {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="form-label">Processing Note <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                value={processNotes}
                onChange={e => setProcessNotes(e.target.value)}
                placeholder="e.g. Refunded $49.99 via Shopify, partial refund approved…"
                rows={3}
                className="form-input resize-none text-sm"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => markStatus(processing.id, 'Processed')}
                disabled={saving}
                className="btn-primary flex-1 justify-center disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Mark Processed
              </button>
              <button
                onClick={() => markStatus(processing.id, 'Rejected')}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
            <button
              onClick={() => { setProcessing(null); setProcessNotes(''); setProcessResolution('Cash Refund'); }}
              className="btn-secondary w-full justify-center"
            >
              Cancel
            </button>
          </div>
        )}
      </SlideOver>

    </div>
  );
}
