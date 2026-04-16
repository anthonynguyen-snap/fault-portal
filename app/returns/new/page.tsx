'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, PlusCircle, Trash2 } from 'lucide-react';
import { ReturnCondition, ReturnDecision } from '@/types';

const CONDITIONS: ReturnCondition[] = ['Sealed', 'Open - Good Condition', 'Open - Damaged Packaging', 'Faulty'];
const DECISIONS: ReturnDecision[]   = ['Full Refund', 'Exchange', 'Refund + Restocking Fee', 'Refund - Return Label Fee', 'Replacement', 'Pending'];
const REFUND_DECISIONS = new Set(['Full Refund', 'Refund + Restocking Fee', 'Refund - Return Label Fee']);
const PROCESSED_BY_KEY = 'returns_processed_by';

interface LineItem {
  product: string;
  condition: ReturnCondition;
  decision: ReturnDecision;
  refundAmount: string;
  restockingFee: number;
}

interface FormState {
  date: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: LineItem[];
  assignedTo: string;
  processedBy: string;
  needsFollowUp: boolean;
  followUpNotes: string;
  notes: string;
  conversationLink: string;
}

function blankItem(): LineItem {
  return { product: '', condition: 'Sealed', decision: 'Pending', refundAmount: '', restockingFee: 0 };
}

function blankForm(processedBy = ''): FormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    orderNumber: '',
    customerName: '',
    customerEmail: '',
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
  const [form, setForm] = useState<FormState>(blankForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pastProducts, setPastProducts] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(PROCESSED_BY_KEY) || '';
    setForm(blankForm(saved));

    fetch('/api/returns')
      .then(r => r.json())
      .then(json => {
        const products = new Set<string>();
        for (const ret of json.data || []) {
          for (const item of ret.items || []) {
            if (item.product) products.add(item.product);
          }
        }
        setPastProducts(Array.from(products).sort());
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'processedBy') localStorage.setItem(PROCESSED_BY_KEY, value as string);
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
    if (form.items.some(item => !item.product.trim())) {
      setError('All items must have a product / SKU filled in.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        items: form.items.map(item => ({
          ...item,
          refundAmount: parseFloat(item.refundAmount) || 0,
        })),
      };
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      router.push('/returns');
    } catch (err: any) {
      setError(err.message || 'Failed to submit return.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/returns" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ChevronLeft size={16} /> Back to Returns
      </Link>
      <h1 className="page-title mb-1">Log Return</h1>
      <p className="page-subtitle mb-6">Record a new customer return</p>

      <datalist id="past-products">
        {pastProducts.map(p => <option key={p} value={p} />)}
      </datalist>

      <form onSubmit={handleSubmit} className="space-y-5">

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
              <input type="text" value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)} placeholder="e.g. #12345" className="form-input" required />
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
        </div>

        {/* Line Items */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Return Items</h2>

          {form.items.map((item, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item {i + 1}</span>
                {form.items.length > 1 && (
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
                  list="past-products"
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
                <div>
                  <label className="form-label">Refund Amount</label>
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
          <h2 className="text-sm font-semibold text-slate-700">Team</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Team Member</label>
              <input type="text" value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} placeholder="Who dealt with customer?" className="form-input" />
            </div>
            <div>
              <label className="form-label">Processed By</label>
              <input type="text" value={form.processedBy} onChange={e => set('processedBy', e.target.value)} placeholder="Your name" className="form-input" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={form.needsFollowUp} onChange={e => set('needsFollowUp', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-slate-700">Needs follow-up with customer</span>
          </label>
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
            {submitting ? 'Saving…' : 'Log Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
