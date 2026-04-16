'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { ReturnCondition, ReturnDecision } from '@/types';

const CONDITIONS: ReturnCondition[] = [
  'Sealed',
  'Open - Good Condition',
  'Open - Damaged Packaging',
  'Faulty',
];

const DECISIONS: ReturnDecision[] = [
  'Full Refund',
  'Exchange',
  'Refund + Restocking Fee',
  'Refund - Return Label Fee',
  'Replacement',
  'Pending',
];

const REFUND_DECISIONS = new Set(['Full Refund', 'Refund + Restocking Fee', 'Refund - Return Label Fee']);

const PROCESSED_BY_KEY = 'returns_processed_by';

interface FormState {
  date: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  product: string;
  condition: ReturnCondition;
  decision: ReturnDecision;
  restockingFee: number;
  refundAmount: number;
  assignedTo: string;
  needsFollowUp: boolean;
  notes: string;
  processedBy: string;
  conversationLink: string;
}

function blankForm(processedBy = ''): FormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    orderNumber: '',
    customerName: '',
    customerEmail: '',
    product: '',
    condition: 'Sealed',
    decision: 'Full Refund',
    restockingFee: 0,
    refundAmount: 0,
    assignedTo: '',
    needsFollowUp: false,
    notes: '',
    processedBy,
    conversationLink: '',
  };
}

export default function NewReturnPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(blankForm());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'submit', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedId, setSavedId] = useState('');

  // Remember Processed By across sessions
  useEffect(() => {
    const saved = localStorage.getItem(PROCESSED_BY_KEY);
    if (saved) setForm(f => ({ ...f, processedBy: saved }));
  }, []);

  function set(field: keyof FormState, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
    if (field === 'processedBy') {
      localStorage.setItem(PROCESSED_BY_KEY, String(value));
    }
  }

  function validate() {
    const e: typeof errors = {};
    if (!form.orderNumber) e.orderNumber = 'Required';
    if (!form.customerName) e.customerName = 'Required';
    if (!form.product) e.product = 'Required';
    if (form.decision === 'Refund + Restocking Fee' && !form.restockingFee) {
      e.restockingFee = 'Enter a restocking fee %';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to save');
      setSavedId(json.data.id);
      setSuccess(true);
    } catch (err: any) {
      setErrors(e => ({ ...e, submit: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Return Logged</h2>
          <p className="text-slate-500 text-sm mb-6">The return has been recorded successfully.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { setSuccess(false); setForm(blankForm(form.processedBy)); setSavedId(''); }} className="btn-secondary">
              Log Another
            </button>
            <button onClick={() => router.push(`/returns/${savedId}`)} className="btn-primary">
              View Return
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/returns" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ChevronLeft size={16} /> Back to Returns
        </Link>
        <h1 className="page-title">Log Return</h1>
        <p className="page-subtitle">Record a customer return received in the office</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">Return Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date Received <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Order Number <span className="text-red-500">*</span></label>
              <input type="text" value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)}
                placeholder="e.g. ORD-12345" className={`form-input ${errors.orderNumber ? 'border-red-300' : ''}`} />
              {errors.orderNumber && <p className="form-error">{errors.orderNumber}</p>}
            </div>
            <div>
              <label className="form-label">Customer Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.customerName} onChange={e => set('customerName', e.target.value)}
                placeholder="Full name" className={`form-input ${errors.customerName ? 'border-red-300' : ''}`} />
              {errors.customerName && <p className="form-error">{errors.customerName}</p>}
            </div>
            <div>
              <label className="form-label">Customer Email</label>
              <input type="email" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)}
                placeholder="email@example.com" className="form-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Product <span className="text-red-500">*</span></label>
              <input type="text" value={form.product} onChange={e => set('product', e.target.value)}
                placeholder="Product name" className={`form-input ${errors.product ? 'border-red-300' : ''}`} />
              {errors.product && <p className="form-error">{errors.product}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Conversation Link</label>
              <input type="url" value={form.conversationLink} onChange={e => set('conversationLink', e.target.value)}
                placeholder="https://..." className="form-input font-mono text-xs" />
              <p className="text-xs text-slate-400 mt-1">Paste the link to the customer conversation (Commslayer, email, etc.)</p>
            </div>
          </div>
        </div>

        {/* Inspection */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">Inspection</h2>
          <div>
            <label className="form-label">Condition <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {CONDITIONS.map(c => (
                <button key={c} type="button" onClick={() => set('condition', c)}
                  className={`px-3 py-2.5 rounded-lg border text-sm text-left font-medium transition-all ${
                    form.condition === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Decision <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {DECISIONS.map(d => (
                <button key={d} type="button" onClick={() => set('decision', d)}
                  className={`px-3 py-2.5 rounded-lg border text-sm text-left font-medium transition-all ${
                    form.decision === d ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>{d}</button>
              ))}
            </div>
          </div>

          {/* Refund amount — shown for any refund-type decision */}
          {REFUND_DECISIONS.has(form.decision) && (
            <div>
              <label className="form-label">Refund Amount</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">$</span>
                <input type="number" min={0} step={0.01} value={form.refundAmount || ''}
                  onChange={e => set('refundAmount', Number(e.target.value))}
                  placeholder="0.00" className="form-input w-36" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Total amount refunded to the customer</p>
            </div>
          )}

          {form.decision === 'Refund + Restocking Fee' && (
            <div>
              <label className="form-label">Restocking Fee % <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={30} value={form.restockingFee}
                  onChange={e => set('restockingFee', Number(e.target.value))}
                  className={`form-input w-32 ${errors.restockingFee ? 'border-red-300' : ''}`} />
                <span className="text-sm text-slate-500">% (max 30%)</span>
              </div>
              {errors.restockingFee && <p className="form-error">{errors.restockingFee}</p>}
            </div>
          )}

          <div>
            <label className="form-label">Inspection Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Condition details, what was missing, customer comments..."
              className="form-input resize-none" />
          </div>
        </div>

        {/* Team */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Team Member</label>
              <input type="text" value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}
                placeholder="Who dealt with the customer?" className="form-input" />
            </div>
            <div>
              <label className="form-label">Processed By</label>
              <input type="text" value={form.processedBy} onChange={e => set('processedBy', e.target.value)}
                placeholder="Your name" className="form-input" />
              <p className="text-xs text-slate-400 mt-1">Remembered from last time</p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <input type="checkbox" checked={form.needsFollowUp}
              onChange={e => setForm(f => ({ ...f, needsFollowUp: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
              Needs follow-up with customer
            </span>
          </label>
        </div>

        {(errors as any).submit && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{(errors as any).submit}</p>
          </div>
        )}

        <div className="flex items-center justify-between pb-4">
          <Link href="/returns" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
            ) : 'Log Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
