'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { REFUND_REASONS } from '@/types';

interface StaffMember { id: string; name: string; }

const CURRENCIES = [
  { code: 'AUD', locale: 'en-AU', label: 'AUD - Australian Dollar' },
  { code: 'USD', locale: 'en-US', label: 'USD - US Dollar' },
  { code: 'CAD', locale: 'en-CA', label: 'CAD - Canadian Dollar' },
  { code: 'GBP', locale: 'en-GB', label: 'GBP - British Pound' },
  { code: 'NZD', locale: 'en-NZ', label: 'NZD - New Zealand Dollar' },
  { code: 'SGD', locale: 'en-SG', label: 'SGD - Singapore Dollar' },
  { code: 'EUR', locale: 'de-DE', label: 'EUR - Euro' },
] as const;

type CurrencyCode = typeof CURRENCIES[number]['code'];

const REFUND_SKUS_PREFIX = 'Refund SKUs:';
const LABEL_FEE = 9.50;

function detectCurrency(orderNumber: string): CurrencyCode {
  const upper = orderNumber.trim().toUpperCase();
  if (upper.endsWith('ROW') || upper.endsWith('UK')) return 'GBP';
  if (upper.endsWith('US')) return 'USD';
  if (upper.endsWith('AU')) return 'AUD';
  return 'AUD';
}

function buildRefundNotes(productSkus: string[], notes: string): string {
  const cleanSkus = productSkus.map(sku => sku.trim()).filter(Boolean);
  const cleanNotes = notes.trim();
  if (cleanSkus.length === 0) return cleanNotes;
  const skuBlock = `${REFUND_SKUS_PREFIX}\n${cleanSkus.map(sku => `- ${sku}`).join('\n')}`;
  return cleanNotes ? `${skuBlock}\n\n${cleanNotes}` : skuBlock;
}

function money(amount: number, currency: CurrencyCode) {
  const c = CURRENCIES.find(x => x.code === currency) ?? CURRENCIES[0];
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code }).format(amount);
}

export default function NewRefundPage() {
  return (
    <Suspense>
      <NewRefundInner />
    </Suspense>
  );
}

function NewRefundInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'management';
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deductLabelFee, setDeductLabelFee] = useState(true);
  const [form, setForm] = useState({
    orderNumber: searchParams.get('order') || '',
    customerName: '',
    amount: '',
    currency: detectCurrency(searchParams.get('order') || ''),
    productSkus: [''],
    reason: '',
    notes: '',
    shopifyLink: '',
    commsLink: '',
    submittedBy: '',
  });

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(d => { if (d.data) setStaff(d.data); })
      .catch(() => setFormError('Could not load staff list. Please refresh.'));
  }, []);

  useEffect(() => {
    setForm(f => ({ ...f, submittedBy: f.submittedBy || user?.name || '' }));
  }, [user?.name]);

  useEffect(() => {
    setForm(f => ({ ...f, currency: detectCurrency(f.orderNumber) }));
  }, [form.orderNumber]);

  const enteredAmount = parseFloat(form.amount) || 0;
  const hasFee = (form.currency === 'USD' || form.currency === 'AUD') && deductLabelFee;
  const finalAmount = hasFee ? Math.max(0, enteredAmount - LABEL_FEE) : enteredAmount;
  const resolvedSubmittedBy = form.submittedBy || (!isAdmin && user?.name ? user.name : '');

  async function submitRequest() {
    if (!form.orderNumber.trim()) return setFormError('Order number is required');
    if (!form.customerName.trim()) return setFormError('Customer name is required');
    if (!form.reason) return setFormError('Please select a reason');
    if (!form.shopifyLink.trim()) return setFormError('Shopify order link is required');
    if (!form.commsLink.trim()) return setFormError('Conversation link is required');
    if (!resolvedSubmittedBy) return setFormError('Please select your name');

    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: form.orderNumber.trim(),
          customerName: form.customerName.trim(),
          amount: finalAmount,
          currency: form.currency,
          reason: form.reason,
          notes: buildRefundNotes(form.productSkus, form.notes),
          shopifyLink: form.shopifyLink.trim(),
          commsLink: form.commsLink.trim(),
          submittedBy: resolvedSubmittedBy,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      router.push(`/refunds?open=${encodeURIComponent(json.data.id)}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to submit refund request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/refunds" className="btn-secondary px-3">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="page-title">Request Refund</h1>
          <p className="page-subtitle">Raise a refund for review and processing.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-[#f7f8fa] px-5 py-4">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-800">Refund Details</h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
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

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div>
              <label className="form-label">Refund Amount <span className="text-red-400">*</span></label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="form-input" />
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))} className="form-input">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
          </div>

          {(form.currency === 'AUD' || form.currency === 'USD') && (
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <input type="checkbox" checked={deductLabelFee} onChange={e => setDeductLabelFee(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1591b3]" />
              <span className="text-slate-700">
                Deduct return label fee of {money(LABEL_FEE, form.currency)}. Final request amount: <span className="font-semibold">{money(finalAmount, form.currency)}</span>
              </span>
            </label>
          )}

          <div>
            <label className="form-label">Reason <span className="text-red-400">*</span></label>
            <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="form-input">
              <option value="">Select reason...</option>
              {REFUND_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label mb-2 block">Product / SKU Being Refunded</label>
            <div className="space-y-2">
              {form.productSkus.map((sku, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={sku}
                    onChange={e => {
                      const productSkus = [...form.productSkus];
                      productSkus[i] = e.target.value;
                      setForm(f => ({ ...f, productSkus }));
                    }}
                    placeholder={`Product / SKU ${i + 1}`}
                    className="form-input flex-1"
                  />
                  {form.productSkus.length > 1 && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, productSkus: f.productSkus.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, productSkus: [...f.productSkus, ''] }))} className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
              <Plus size={13} /> Add Another Product
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Shopify Order Link <span className="text-red-400">*</span></label>
              <div className="relative">
                <input value={form.shopifyLink} onChange={e => setForm(f => ({ ...f, shopifyLink: e.target.value }))} placeholder="https://admin.shopify.com/..." className="form-input pr-9" />
                {form.shopifyLink && (
                  <a href={form.shopifyLink} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="form-label">Conversation Link <span className="text-red-400">*</span></label>
              <input value={form.commsLink} onChange={e => setForm(f => ({ ...f, commsLink: e.target.value }))} placeholder="Commslayer / Chatwoot URL" className="form-input" />
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Any context Anthony needs before processing..." className="form-input resize-none" />
          </div>

          <div>
            <label className="form-label">Submitted By</label>
            {isAdmin ? (
              <select value={form.submittedBy} onChange={e => setForm(f => ({ ...f, submittedBy: e.target.value }))} className="form-input">
                <option value="">Select name...</option>
                {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <div className="form-input bg-slate-50 text-slate-700 cursor-default select-none">
                {resolvedSubmittedBy || 'Loading...'}
              </div>
            )}
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>

        <div className="border-t border-slate-100 bg-[#f7f8fa] px-5 py-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/refunds" className="btn-secondary">Cancel</Link>
          <button onClick={submitRequest} disabled={saving} className="btn-primary">
            {saving ? 'Submitting...' : 'Request Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
