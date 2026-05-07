'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, PlusCircle, Trash2, CheckCircle2, X, CheckCircle, RotateCcw } from 'lucide-react';
import { Return, ReturnCondition, ReturnDecision } from '@/types';

const CONDITIONS: ReturnCondition[] = ['Sealed', 'Open - Good Condition', 'Open - Damaged Packaging', 'Faulty'];
const DECISIONS: ReturnDecision[]   = ['Full Refund', 'Exchange', 'Refund + Restocking Fee', 'Refund - Return Label Fee', 'Replacement', 'Pending'];
const REFUND_DECISIONS = new Set(['Full Refund', 'Refund + Restocking Fee', 'Refund - Return Label Fee']);
const PROCESSED_BY_KEY = 'returns_processed_by';
const LABEL_FEE = 9.50;

interface LineItem {
  product: string;
  condition: ReturnCondition;
  decision: ReturnDecision;
  refundAmount: string;   // gross amount entered by user
  restockingPct: string;  // restocking fee percentage (for Refund + Restocking Fee)
  restockingFee: number;
}

function netRefund(item: LineItem): number {
  const gross = parseFloat(item.refundAmount) || 0;
  if (item.decision === 'Refund - Return Label Fee') return Math.max(0, gross - LABEL_FEE);
  if (item.decision === 'Refund + Restocking Fee') {
    const pct = parseFloat(item.restockingPct) || 0;
    return Math.max(0, gross - (gross * pct / 100));
  }
  return gross;
}

function restockingFeeAmount(item: LineItem): number {
  if (item.decision !== 'Refund + Restocking Fee') return 0;
  const gross = parseFloat(item.refundAmount) || 0;
  const pct = parseFloat(item.restockingPct) || 0;
  return Math.max(0, gross * pct / 100);
}

interface FormState {
  date: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  trackingNumber: string;
  items: LineItem[];
  assignedTo: string;
  processedBy: string;
  needsFollowUp: boolean;
  followUpNotes: string;
  notes: string;
  conversationLink: string;
}

function blankItem(): LineItem {
  return { product: '', condition: 'Sealed', decision: 'Pending', refundAmount: '', restockingPct: '', restockingFee: 0 };
}

function blankForm(processedBy = ''): FormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    orderNumber: '',
    customerName: '',
    customerEmail: '',
    trackingNumber: '',
    items: [blankItem()],
    assignedTo: '',
    processedBy,
    needsFollowUp: false,
    followUpNotes: '',
    notes: '',
    conversationLink: '',
  };
}

export default function NewReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm]           = useState<FormState>(blankForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [successOrder, setSuccessOrder] = useState<string | null>(null);
  const [openRequests, setOpenRequests] = useState<Return[]>([]);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const [matchLinked, setMatchLinked] = useState<string | null>(null); // id of linked request
  const [linkedRequest, setLinkedRequest] = useState<Return | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PROCESSED_BY_KEY) || '';
    setForm(blankForm(saved));
    const requestId = searchParams.get('requestId');
    fetch('/api/returns?stage=requested')
      .then(r => r.json())
      .then(d => {
        const requests = d.data ?? [];
        setOpenRequests(requests);
        if (requestId) {
          const req = requests.find((r: Return) => r.id === requestId);
          if (req) void acceptMatch(req, { fromProcessLink: true });
        }
      })
      .catch(err => console.error('[ProcessOfficeReturnPage] failed to load return requests:', err));
  }, [searchParams]);

  // Auto-match: exact order number match against open requests
  const matchedRequest = useMemo((): Return | null => {
    if (!form.orderNumber.trim() || matchDismissed || matchLinked) return null;
    return openRequests.find(r =>
      r.orderNumber.toLowerCase() === form.orderNumber.trim().toLowerCase()
    ) ?? null;
  }, [form.orderNumber, openRequests, matchDismissed, matchLinked]);

  async function acceptMatch(req: Return, options?: { fromProcessLink?: boolean }) {
    setMatchLinked(req.id);
    setLinkedRequest(req);
    setMatchDismissed(false);
    // Map request items → form line items (keep blank item if request has none)
    const mappedItems: LineItem[] = req.items?.length
      ? req.items.map(ri => ({
          product:       ri.product,
          condition:     ri.condition,
          decision:      ri.decision,
          refundAmount:  ri.refundAmount ? String(ri.refundAmount) : '',
          restockingPct: '',
          restockingFee: ri.restockingFee || 0,
        }))
      : [blankItem()];
    // Auto-fill customer details + items from the request
    setForm(prev => ({
      ...prev,
      orderNumber:      req.orderNumber,
      customerName:     prev.customerName || req.customerName,
      customerEmail:    prev.customerEmail || req.customerEmail,
      trackingNumber:   prev.trackingNumber || req.trackingNumber,
      conversationLink: prev.conversationLink || req.conversationLink,
      items: mappedItems,
    }));
    if (!req.parcelReceived || options?.fromProcessLink) {
      await fetch(`/api/returns/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelReceived: true }),
      });
    }
  }

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'processedBy') localStorage.setItem(PROCESSED_BY_KEY, value as string);
  }

  function setOrderNumber(value: string) {
    setForm(prev => ({ ...prev, orderNumber: value }));
    setMatchDismissed(false);
    setMatchLinked(null);
    setLinkedRequest(null);
  }

  function setItemField(index: number, field: keyof LineItem, value: string | number | ReturnCondition | ReturnDecision) {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, blankItem()] }));
  }

  function removeItem(index: number) {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.orderNumber.trim() || !form.customerName.trim()) {
      setError('Order number and customer name are required.');
      return;
    }
    if (form.items.length === 0) {
      setError('At least one item is required. Use "Add Another Item" to add one.');
      return;
    }
    if (form.items.some(item => !item.product.trim())) {
      setError('All items must have a product / SKU filled in.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        stage: 'processed',
        trackingNumber:  form.trackingNumber.trim(),
        linkedRequestId: matchLinked ?? undefined,
        items: form.items.map(item => ({
          ...item,
          refundAmount: netRefund(item),
          restockingFee: restockingFeeAmount(item),
        })),
      };
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSuccessOrder(form.orderNumber);
    } catch (err: any) {
      setError(err.message || 'Failed to submit return.');
    } finally {
      setSubmitting(false);
    }
  }

  function logAnother() {
    const processedBy = localStorage.getItem(PROCESSED_BY_KEY) || '';
    setForm(blankForm(processedBy));
    setSuccessOrder(null);
    setError('');
    setMatchDismissed(false);
    setMatchLinked(null);
    setLinkedRequest(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (successOrder) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Return processed</h2>
          <p className="text-slate-500 text-sm mb-8">
            <span className="font-mono font-semibold text-slate-700">{successOrder}</span> has been saved successfully.
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <Link href="/returns" className="btn-secondary flex-1 text-center">
              View Returns
            </Link>
            <button onClick={logAnother} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <RotateCcw size={14} /> Process Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/returns" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ChevronLeft size={16} /> Back to Returns
      </Link>
      <h1 className="page-title mb-1">Process Office Return</h1>
      <p className="page-subtitle mb-4">Inspect a received parcel and close the return unless follow-up is required</p>

      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-amber-500 text-base">⚠️</span>
        <p className="text-sm text-amber-800 font-medium">This form is for Anthony only. If you're not Anthony, please don't proceed.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Auto-match banner */}
        {matchedRequest && !matchLinked && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-900">Return request found</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                <span className="font-mono font-bold">{matchedRequest.orderNumber}</span> — {matchedRequest.customerName}
                {matchedRequest.trackingNumber && <span className="ml-1.5 font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">{matchedRequest.trackingNumber}</span>}
                <span className="ml-1.5 text-emerald-600">· Logged {new Date(matchedRequest.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
              </p>
              <p className="text-xs text-emerald-700 mt-1">Link this request to prefill the office processing form.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" onClick={() => acceptMatch(matchedRequest)} className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                Link Request
              </button>
              <button type="button" onClick={() => setMatchDismissed(true)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {matchLinked && linkedRequest && (
          <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Linked return request</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                <span className="font-mono font-bold">{linkedRequest.orderNumber}</span> · {linkedRequest.customerName} · {linkedRequest.items.length || 1} item{(linkedRequest.items.length || 1) === 1 ? '' : 's'}
                {linkedRequest.processedBy && <span> · logged by {linkedRequest.processedBy}</span>}
              </p>
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Order Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="form-input" required />
            </div>
            <div>
              <label className="form-label">Order Number <span className="text-red-400">*</span></label>
              <input type="text" value={form.orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="e.g. #12345" className="form-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Customer Name <span className="text-red-400">*</span></label>
              <input type="text" value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Full name" className="form-input" required />
            </div>
            <div>
              <label className="form-label">Customer Email</label>
              <input type="email" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)} placeholder="email@example.com" className="form-input" />
            </div>
          </div>
          <div>
            <label className="form-label">Conversation Link</label>
            <input type="url" value={form.conversationLink} onChange={e => set('conversationLink', e.target.value)} placeholder="https://..." className="form-input" />
          </div>
          <div>
            <label className="form-label">Inbound Tracking Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={form.trackingNumber} onChange={e => set('trackingNumber', e.target.value)} placeholder="e.g. 1Z999AA10123456784" className="form-input font-mono" />
          </div>
        </div>

        {/* Line Items */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Return Items</h2>

          {form.items.map((item, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item {i + 1}</span>
                {(form.items.length > 1 || !!matchLinked) && (
                  <button type="button" onClick={() => removeItem(i)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div>
                <label className="form-label">Product / SKU <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={item.product}
                  onChange={e => setItemField(i, 'product', e.target.value)}
                  placeholder="e.g. PP-UNI2-BLK"
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Condition</label>
                  <select value={item.condition} onChange={e => setItemField(i, 'condition', e.target.value as ReturnCondition)} className="form-input">
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Decision</label>
                  <select value={item.decision} onChange={e => setItemField(i, 'decision', e.target.value as ReturnDecision)} className="form-input">
                    {DECISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {REFUND_DECISIONS.has(item.decision) && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Gross Refund Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.refundAmount}
                          onChange={e => setItemField(i, 'refundAmount', e.target.value)}
                          placeholder="0.00"
                          className="form-input pl-7"
                        />
                      </div>
                    </div>
                    {item.decision === 'Refund + Restocking Fee' && (
                      <div>
                        <label className="form-label">Restocking Fee %</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.restockingPct}
                            onChange={e => setItemField(i, 'restockingPct', e.target.value)}
                            placeholder="e.g. 15"
                            className="form-input pr-7"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Deduction breakdown */}
                  {(parseFloat(item.refundAmount) > 0) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Gross amount</span>
                        <span className="font-mono">${(parseFloat(item.refundAmount) || 0).toFixed(2)}</span>
                      </div>
                      {item.decision === 'Refund - Return Label Fee' && (
                        <div className="flex justify-between text-red-500">
                          <span>Return label fee</span>
                          <span className="font-mono">−${LABEL_FEE.toFixed(2)}</span>
                        </div>
                      )}
                      {item.decision === 'Refund + Restocking Fee' && parseFloat(item.restockingPct) > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>Restocking fee ({item.restockingPct}%)</span>
                          <span className="font-mono">−${((parseFloat(item.refundAmount) || 0) * (parseFloat(item.restockingPct) || 0) / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-800 font-semibold border-t border-slate-200 pt-1 mt-1">
                        <span>Net refund</span>
                        <span className="font-mono text-emerald-700">${netRefund(item).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <button type="button" onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
            <PlusCircle size={15} /> Add Another Item
          </button>
        </div>

        {/* Team */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Processing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Processed By</label>
              <input type="text" value={form.processedBy} onChange={e => set('processedBy', e.target.value)} placeholder="Your name" className="form-input" />
            </div>
            <div>
              <label className="form-label">Return Outcome</label>
              <div className="form-input bg-slate-50 text-slate-700 cursor-default select-none">
                {form.needsFollowUp ? 'Follow-up required' : 'Closed after saving'}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
            <input type="checkbox" checked={form.needsFollowUp} onChange={e => set('needsFollowUp', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-slate-700">Follow-up required after processing</span>
          </label>
          {form.needsFollowUp && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Follow-up Owner</label>
                <input type="text" value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} placeholder="Who should follow up?" className="form-input" />
              </div>
              <div>
                <label className="form-label">Follow-up Notes</label>
                <input type="text" value={form.followUpNotes} onChange={e => set('followUpNotes', e.target.value)} placeholder="What needs to happen next?" className="form-input" />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Notes</h2>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            placeholder="Inspection notes, condition details, anything relevant…"
            className="form-input resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

        <div className="flex gap-3 pb-8">
          <Link href="/returns" className="btn-secondary flex-1 text-center">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Saving…' : 'Save Processed Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
