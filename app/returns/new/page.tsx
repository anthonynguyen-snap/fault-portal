'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, PlusCircle, Trash2, CheckCircle2, X, CheckCircle, RotateCcw, Search, ExternalLink } from 'lucide-react';
import { Return, ReturnCondition, ReturnDecision } from '@/types';

const CONDITIONS: ReturnCondition[] = ['Sealed', 'Open - Good Condition', 'Open - Damaged Packaging', 'Faulty'];
const DECISIONS: ReturnDecision[]   = ['Full Refund', 'Exchange', 'Refund + Restocking Fee', 'Refund - Return Label Fee', 'Replacement', 'Pending'];
const REFUND_DECISIONS = new Set(['Full Refund', 'Refund + Restocking Fee', 'Refund - Return Label Fee']);
const PROCESSED_BY_KEY = 'returns_processed_by';
const LABEL_FEE = 9.50;
const SHOPIFY_ORDER_SEARCH_URL = 'https://admin.shopify.com/store/snapwireless/orders?query=';

interface LineItem {
  product: string;
  condition: ReturnCondition;
  decision: ReturnDecision;
  refundAmount: string;   // gross amount entered by user
  restockingPct: string;  // restocking fee percentage (for Refund + Restocking Fee)
  restockingFee: number;
  restockingReason: string; // reason for applying restocking fee
  addToStock: boolean;      // prompt to add back to storeroom
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

function shopifyOrderHref(orderNumber: string): string {
  const normalized = orderNumber.replace(/^#/, '').trim();
  return normalized ? `${SHOPIFY_ORDER_SEARCH_URL}${encodeURIComponent(normalized)}` : '';
}

interface FormState {
  date: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  trackingNumber: string;
  starshipitOrderNumber: string;
  items: LineItem[];
  assignedTo: string;
  processedBy: string;
  needsFollowUp: boolean;
  followUpNotes: string;
  notes: string;
  conversationLink: string;
  overrideTotal: boolean;
  overrideTotalAmount: string;
  discountType: '%' | '$';
  discountValue: string;
}

const RESTOCK_CONDITIONS = new Set<ReturnCondition>(['Sealed', 'Open - Good Condition']);

function blankItem(): LineItem {
  return { product: '', condition: 'Sealed', decision: 'Pending', refundAmount: '', restockingPct: '', restockingFee: 0, restockingReason: '', addToStock: false };
}

function blankForm(processedBy = ''): FormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    orderNumber: '',
    customerName: '',
    customerEmail: '',
    trackingNumber: '',
    starshipitOrderNumber: '',
    items: [blankItem()],
    assignedTo: '',
    processedBy,
    needsFollowUp: false,
    followUpNotes: '',
    notes: '',
    conversationLink: '',
    overrideTotal: false,
    overrideTotalAmount: '',
    discountType: '%',
    discountValue: '',
  };
}

export default function NewReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm]           = useState<FormState>(blankForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [successOrder, setSuccessOrder] = useState<string | null>(null);
  const [restockReminder, setRestockReminder] = useState<string[]>([]);
  const [openRequests, setOpenRequests] = useState<Return[]>([]);
  const [requestSearch, setRequestSearch] = useState('');
  const [matchDismissed, setMatchDismissed] = useState(false);
  const [matchLinked, setMatchLinked] = useState<string | null>(null); // id of linked request
  const [linkedRequest, setLinkedRequest] = useState<Return | null>(null);
  const shopifyHref = shopifyOrderHref(form.orderNumber);

  useEffect(() => {
    const saved = localStorage.getItem(PROCESSED_BY_KEY) || '';
    setForm(blankForm(saved));
    const requestId = searchParams.get('requestId');
    const orderParam = searchParams.get('order');
    if (orderParam && !requestId) {
      setForm(prev => ({ ...prev, orderNumber: orderParam }));
    }
    fetch('/api/returns')
      .then(r => r.json())
      .then(d => {
        const allReturns: Return[] = d.data ?? [];
        const processedOrderNums = new Set(
          allReturns
            .filter(r => r.stage === 'processed')
            .map(r => r.orderNumber.toLowerCase().trim())
        );
        const requests = allReturns.filter(r =>
          r.stage === 'requested' &&
          !processedOrderNums.has(r.orderNumber.toLowerCase().trim())
        );
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
          restockingReason: '',
          addToStock: false,
        }))
      : [blankItem()];
    // Auto-fill customer details + items from the request
    setForm(prev => ({
      ...prev,
      orderNumber:      req.orderNumber,
      customerName:     req.customerName,
      customerEmail:    req.customerEmail,
      trackingNumber:   req.trackingNumber,
      starshipitOrderNumber: req.starshipitOrderNumber ?? '',
      conversationLink: req.conversationLink,
      items: mappedItems,
      notes: prev.notes || req.notes,
    }));
    setRequestSearch(req.starshipitOrderNumber || req.trackingNumber || req.customerName || req.orderNumber);
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

  const requestMatches = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return openRequests
      .filter(req => {
        const fields = [
          req.orderNumber,
          req.customerName,
          req.customerEmail,
          req.trackingNumber,
          req.starshipitOrderNumber,
          req.conversationLink,
          ...(req.items ?? []).map(item => item.product),
        ];
        return fields.some(value => String(value || '').toLowerCase().includes(q));
      })
      .slice(0, 6);
  }, [openRequests, requestSearch]);

  // Calculate order-level discount amount
  const discountAmount = useMemo(() => {
    const val = parseFloat(form.discountValue) || 0;
    if (!val) return 0;
    const grossTotal = form.items
      .filter(item => REFUND_DECISIONS.has(item.decision))
      .reduce((sum, item) => sum + (parseFloat(item.refundAmount) || 0), 0);
    if (form.discountType === '%') return grossTotal * (val / 100);
    return Math.min(val, grossTotal);
  }, [form.discountValue, form.discountType, form.items]);

  const refundSummary = useMemo(() => {
    const refundableItems = form.items
      .filter(item => REFUND_DECISIONS.has(item.decision))
      .map(item => ({
        product: item.product.trim() || 'Unnamed item',
        amount: netRefund(item),
      }))
      .filter(item => item.amount > 0);

    const subtotal = refundableItems.reduce((sum, item) => sum + item.amount, 0);
    return {
      items: refundableItems,
      subtotal,
      total: Math.max(0, subtotal - discountAmount),
      discountAmount,
    };
  }, [form.items, discountAmount]);

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
      const finalTotal = form.overrideTotal && form.overrideTotalAmount.trim()
        ? parseFloat(form.overrideTotalAmount) || 0
        : refundSummary.total;
      const payload = {
        ...form,
        stage: 'processed',
        trackingNumber:  form.trackingNumber.trim(),
        starshipitOrderNumber: form.starshipitOrderNumber.trim(),
        linkedRequestId: matchLinked ?? undefined,
        totalRefundAmount: finalTotal,
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

      const restockItems = form.items.filter(item => item.addToStock && item.product.trim()).map(i => i.product.trim());
      setSuccessOrder(form.orderNumber);
      setRestockReminder(restockItems);
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
    setRestockReminder([]);
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
          <p className="text-slate-500 text-sm mb-4">
            <span className="font-mono font-semibold text-slate-700">{successOrder}</span> has been saved successfully.
          </p>
          {restockReminder.length > 0 && (
            <div className="w-full max-w-sm mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left">
              <p className="text-sm font-semibold text-amber-900 mb-1">📦 Don&apos;t forget to log stock in</p>
              <p className="text-xs text-amber-700 mb-2">You marked the following as going back to the storeroom:</p>
              <ul className="text-xs text-amber-800 space-y-0.5 mb-3">
                {restockReminder.map((sku, i) => <li key={i} className="font-mono">• {sku}</li>)}
              </ul>
              <Link href="/stock" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 underline hover:text-amber-900">
                Go to Stock → Receive to log it →
              </Link>
            </div>
          )}
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

        {/* Request lookup */}
        <div className="card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Find Existing Return Request</h2>
            <p className="mt-1 text-xs text-slate-500">Search customers who already received a return form, then pull their details into this process form.</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={requestSearch}
              onChange={e => setRequestSearch(e.target.value)}
              placeholder="Search name, order, Starshipit, tracking, or email..."
              className="form-input pl-9"
            />
          </div>

          {requestSearch.trim().length > 1 && requestMatches.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              No open return request matches that search. You can still process the return manually below.
            </div>
          )}

          {requestMatches.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {requestMatches.map(req => {
                const isLinked = matchLinked === req.id;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => acceptMatch(req)}
                    className={`w-full px-3 py-3 text-left transition-colors ${isLinked ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-900">{req.orderNumber}</span>
                          <span className="text-sm font-medium text-slate-800">{req.customerName}</span>
                          {isLinked && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Selected</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          {req.starshipitOrderNumber && <span>SS: <span className="font-mono">{req.starshipitOrderNumber}</span></span>}
                          {req.trackingNumber && <span>Tracking: <span className="font-mono">{req.trackingNumber}</span></span>}
                          {req.customerEmail && <span className="truncate">{req.customerEmail}</span>}
                        </div>
                        {req.items?.length > 0 && (
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {req.items.map(item => item.product).filter(Boolean).join(', ')}
                          </p>
                        )}
                        {req.notes?.trim() && (
                          <p className="mt-1 truncate text-xs text-slate-400 italic">
                            &ldquo;{req.notes.trim()}&rdquo;
                          </p>
                        )}
                      </div>
                      <span className="flex-shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                        Use
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
              <div className="flex gap-2">
                <input type="text" value={form.orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="e.g. #12345" className="form-input min-w-0 flex-1" required />
                {shopifyHref && (
                  <a
                    href={shopifyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-shrink-0 px-3"
                    title="Open order in Shopify"
                    aria-label="Open order in Shopify"
                  >
                    Shopify
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
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
            <div className="flex gap-2">
              <input type="url" value={form.conversationLink} onChange={e => set('conversationLink', e.target.value)} placeholder="https://..." className="form-input min-w-0 flex-1" />
              {form.conversationLink.trim() && (
                <a
                  href={form.conversationLink.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex-shrink-0 px-3"
                  title="Open conversation in Commslayer"
                  aria-label="Open conversation in Commslayer"
                >
                  Commslayer
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="form-label">Inbound Tracking Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={form.trackingNumber} onChange={e => set('trackingNumber', e.target.value)} placeholder="e.g. 1Z999AA10123456784" className="form-input font-mono" />
          </div>
          <div>
            <label className="form-label">Starshipit Order Number <span className="text-slate-400 font-normal">(return label)</span></label>
            <input type="text" value={form.starshipitOrderNumber} onChange={e => set('starshipitOrderNumber', e.target.value)} placeholder="e.g. SS-123456" className="form-input font-mono" />
          </div>
        </div>

        {/* Line Items */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Return Items</h2>
            {/* Order-level discount */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Discount code applied?</span>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 overflow-hidden">
                <button type="button"
                  onClick={() => set('discountType', '%')}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${form.discountType === '%' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                  %
                </button>
                <button type="button"
                  onClick={() => set('discountType', '$')}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${form.discountType === '$' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                  $
                </button>
              </div>
              <div className="relative w-24">
                {form.discountType === '$' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>}
                <input
                  type="number" min="0" step="0.01"
                  value={form.discountValue}
                  onChange={e => set('discountValue', e.target.value)}
                  placeholder={form.discountType === '%' ? 'e.g. 10' : 'e.g. 20'}
                  className={`form-input text-xs py-1 w-full ${form.discountType === '$' ? 'pl-6' : ''}`}
                />
                {form.discountType === '%' && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>}
              </div>
            </div>
          </div>

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
                  <select value={item.condition} onChange={e => {
                    const cond = e.target.value as ReturnCondition;
                    setItemField(i, 'condition', cond);
                    // Auto-suggest restock for good condition items
                    if (RESTOCK_CONDITIONS.has(cond)) setItemField(i, 'addToStock', true);
                    else setItemField(i, 'addToStock', false);
                  }} className="form-input">
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {RESTOCK_CONDITIONS.has(item.condition) && (
                    <label className={`mt-2 flex items-center gap-2.5 cursor-pointer select-none rounded-lg border px-3 py-2 transition-colors ${item.addToStock ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                      <input
                        type="checkbox"
                        checked={item.addToStock}
                        onChange={e => setItemField(i, 'addToStock', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        Add back to office storeroom
                      </span>
                      {item.addToStock && <span className="ml-auto text-[10px] font-semibold text-emerald-600">+1 unit</span>}
                    </label>
                  )}
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
                  {item.decision === 'Refund + Restocking Fee' && (
                    <div>
                      <label className="form-label">Reason for restocking fee <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={item.restockingReason}
                        onChange={e => setItemField(i, 'restockingReason', e.target.value)}
                        placeholder="e.g. Opened packaging, missing accessories, signs of use…"
                        className="form-input text-sm"
                      />
                      <p className="text-xs text-slate-400 mt-1">Documented in case the customer queries the deduction.</p>
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

          <div className={`rounded-xl border p-4 ${form.overrideTotal ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-semibold ${form.overrideTotal ? 'text-amber-900' : 'text-emerald-900'}`}>Total to refund</p>
                <p className={`mt-1 text-xs ${form.overrideTotal ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {form.overrideTotal
                    ? 'Manually overridden — calculated total is ignored.'
                    : 'Based on refund decisions, label fees, and restocking deductions entered above.'}
                </p>
              </div>
              <p className={`font-mono text-2xl font-bold ${form.overrideTotal ? 'text-amber-700' : 'text-emerald-700'}`}>
                ${(form.overrideTotal && form.overrideTotalAmount.trim()
                  ? parseFloat(form.overrideTotalAmount) || 0
                  : refundSummary.total
                ).toFixed(2)}
              </p>
            </div>
            {!form.overrideTotal && refundSummary.items.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-emerald-200 pt-3">
                {refundSummary.items.map((item, index) => (
                  <div key={`${item.product}-${index}`} className="flex justify-between gap-3 text-xs text-emerald-800">
                    <span className="truncate">{item.product}</span>
                    <span className="font-mono">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
                {refundSummary.discountAmount > 0 && (
                  <>
                    <div className="flex justify-between gap-3 text-xs text-slate-500 border-t border-emerald-100 pt-1 mt-1">
                      <span>Subtotal</span>
                      <span className="font-mono">${refundSummary.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-xs text-red-500">
                      <span>Discount ({form.discountType === '%' ? `${form.discountValue}%` : `$${form.discountValue}`} off order)</span>
                      <span className="font-mono">−${refundSummary.discountAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Override toggle */}
            <div className={`mt-3 border-t pt-3 ${form.overrideTotal ? 'border-amber-200' : 'border-emerald-200'}`}>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.overrideTotal}
                  onChange={e => set('overrideTotal', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <span className={`text-xs font-medium ${form.overrideTotal ? 'text-amber-800' : 'text-emerald-800'}`}>
                  Override total (bundle partial return, split refund, etc.)
                </span>
              </label>
              {form.overrideTotal && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 text-sm font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.overrideTotalAmount}
                      onChange={e => set('overrideTotalAmount', e.target.value)}
                      placeholder="Enter override amount"
                      className="form-input pl-7 border-amber-300 focus:ring-amber-400 bg-white"
                      autoFocus
                    />
                  </div>
                  {refundSummary.total > 0 && (
                    <p className="text-xs text-amber-700 whitespace-nowrap">
                      Calc: ${refundSummary.total.toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
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

        {form.orderNumber.trim() && (
          <div className="flex justify-end">
            <Link
              href={`/orders?order=${encodeURIComponent(form.orderNumber.trim())}`}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              View Order Timeline
            </Link>
          </div>
        )}

        <div className="sticky bottom-0 z-20 -mx-3 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className={`mr-auto min-w-[150px] rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ${form.overrideTotal ? 'ring-amber-300' : 'ring-slate-200'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Total to refund{form.overrideTotal && <span className="ml-1 text-amber-500">· Override</span>}
            </p>
            <p className={`font-mono text-lg font-bold ${form.overrideTotal ? 'text-amber-600' : 'text-emerald-700'}`}>
              ${(form.overrideTotal && form.overrideTotalAmount.trim()
                ? parseFloat(form.overrideTotalAmount) || 0
                : refundSummary.total
              ).toFixed(2)}
            </p>
          </div>
          <Link href="/returns" className="btn-secondary flex-1 text-center">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Saving…' : 'Save Processed Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
