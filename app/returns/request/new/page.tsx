'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  PlusCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Return } from '@/types';

const STARSHIPIT_RETURN_LABEL_URL = 'https://admin.shopify.com/store/snapwireless/apps/starship/Templates/Admin4/Orders.aspx?ShopifyApp=true&disablenewui=true';
const RETURN_REASONS = [
  'Exchange',
  'Change of mind',
  'Did not meet expectations',
  'Faulty - for refund',
  'For further inspection',
] as const;
type ReturnReason = typeof RETURN_REASONS[number] | '';
const RETURN_REASON_PREFIX = 'Return reason: ';

interface RequestForm {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  conversationLink: string;
  trackingNumber: string;
  starshipitOrderNumber: string;
  returnReason: ReturnReason;
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
    returnReason: '',
    products: [{ name: '' }],
    notes: '',
    submittedBy: '',
  };
}

function buildReturnNotes(reason: ReturnReason, notes: string): string {
  const cleanNotes = notes.trim();
  if (!reason) return cleanNotes;
  return cleanNotes ? `${RETURN_REASON_PREFIX}${reason}\n\n${cleanNotes}` : `${RETURN_REASON_PREFIX}${reason}`;
}

export default function NewReturnRequestPage() {
  return (
    <Suspense>
      <NewReturnRequestInner />
    </Suspense>
  );
}

function NewReturnRequestInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'management';
  const [form, setForm] = useState<RequestForm>(() => ({
    ...blankRequest(),
    orderNumber: searchParams.get('order') ?? '',
  }));
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [existingRequests, setExistingRequests] = useState<Return[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const effectiveSubmittedBy = form.submittedBy.trim() || user?.name || '';

  useEffect(() => {
    setForm(f => ({ ...f, submittedBy: f.submittedBy || user?.name || '' }));
  }, [user?.name]);

  useEffect(() => {
    Promise.all([
      fetch('/api/staff').then(r => r.json()),
      fetch('/api/returns').then(r => r.json()),
    ])
      .then(([staffJson, returnsJson]) => {
        if (staffJson.data) setStaff(staffJson.data);
        if (returnsJson.data) setExistingRequests(returnsJson.data);
      })
      .catch(() => setError('Could not load return form context. Please refresh.'));
  }, []);

  const duplicate = useMemo(() => {
    if (!form.orderNumber.trim() && !form.conversationLink.trim()) return null;
    return existingRequests.find(r =>
      (form.orderNumber.trim() && r.orderNumber.toLowerCase() === form.orderNumber.trim().toLowerCase()) ||
      (form.conversationLink.trim() && r.conversationLink && r.conversationLink.toLowerCase() === form.conversationLink.trim().toLowerCase())
    ) ?? null;
  }, [form.orderNumber, form.conversationLink, existingRequests]);

  async function submit() {
    if (!form.orderNumber.trim()) return setError('Order number is required');
    if (!form.customerName.trim()) return setError('Customer name is required');
    if (!effectiveSubmittedBy) return setError('Please select your name');

    setSaving(true);
    setError('');
    try {
      const productItems = form.products
        .map(p => p.name.trim())
        .filter(Boolean)
        .map(name => ({ product: name, condition: 'Sealed', decision: 'Pending', refundAmount: 0, restockingFee: 0 }));

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: form.orderNumber.trim(),
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim(),
          conversationLink: form.conversationLink.trim(),
          trackingNumber: form.trackingNumber.trim(),
          starshipitOrderNumber: form.starshipitOrderNumber.trim(),
          notes: buildReturnNotes(form.returnReason, form.notes),
          processedBy: effectiveSubmittedBy,
          items: productItems,
          stage: 'requested',
          needsFollowUp: false,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      router.push(`/returns?order=${encodeURIComponent(form.orderNumber.trim())}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save return request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/returns" className="btn-secondary px-3">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="page-title">Log Return Request</h1>
          <p className="page-subtitle">Create a return request when a customer asks to send an item back.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-[#f7f8fa] px-5 py-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-800">Request Details</h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {duplicate && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold">Possible duplicate</p>
                <p>A request already exists for <span className="font-mono font-bold">{duplicate.orderNumber}</span> - {duplicate.customerName}.</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Order Number <span className="text-red-400">*</span></label>
              <input value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} placeholder="e.g. 12345AU" className="form-input" />
            </div>
            <div>
              <label className="form-label">Customer Name <span className="text-red-400">*</span></label>
              <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Jane Smith" className="form-input" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Customer Email</label>
              <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="jane@example.com" className="form-input" />
            </div>
            <div>
              <label className="form-label">Conversation Link</label>
              <input value={form.conversationLink} onChange={e => setForm(f => ({ ...f, conversationLink: e.target.value }))} placeholder="Commslayer / Chatwoot URL" className="form-input" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Inbound Tracking Number</label>
              <input value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} placeholder="e.g. 1Z999AA10123456784" className="form-input font-mono" />
            </div>
            <div>
              <label className="form-label">Reason for Return</label>
              <select value={form.returnReason} onChange={e => setForm(f => ({ ...f, returnReason: e.target.value as ReturnReason }))} className="form-input">
                <option value="">Select reason...</option>
                {RETURN_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">Create prepaid return label</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Open Starshipit, create the return label, then paste the Starshipit order number below.
                </p>
              </div>
              <a href={STARSHIPIT_RETURN_LABEL_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-3">
                Open <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div>
            <label className="form-label">Starshipit Order Number</label>
            <input value={form.starshipitOrderNumber} onChange={e => setForm(f => ({ ...f, starshipitOrderNumber: e.target.value }))} placeholder="e.g. SS-123456" className="form-input font-mono" />
          </div>

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
                    <button type="button" onClick={() => setForm(f => ({ ...f, products: f.products.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, products: [...f.products, { name: '' }] }))} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
              <PlusCircle size={13} /> Add Another Product
            </button>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Any extra context, or use this when the reason is Other..." className="form-input resize-none" />
          </div>

          <div>
            <label className="form-label">Logged By</label>
            {isAdmin ? (
              <select value={form.submittedBy} onChange={e => setForm(f => ({ ...f, submittedBy: e.target.value }))} className="form-input">
                <option value="">Select name...</option>
                {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <div className="form-input bg-slate-50 text-slate-700 cursor-default select-none">
                {effectiveSubmittedBy || 'Loading...'}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="border-t border-slate-100 bg-[#f7f8fa] px-5 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/returns" className="btn-secondary">Cancel</Link>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Log Return Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
