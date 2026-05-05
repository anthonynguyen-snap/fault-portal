'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, PlusCircle, Trash2 } from 'lucide-react';
import { CorporateStatus, PaymentStatus } from '@/types';

const STATUSES: CorporateStatus[] = [
  'Inquiry','Quote Sent','Quote Approved','Details Received',
  'Mockup Sent','Mockup Approved','Sent to Supplier','Supplier Quoted',
  'In Production','Completed','Delivered',
];
const PAYMENT_STATUSES: PaymentStatus[] = ['Unpaid','Invoiced','Paid','Overdue'];
const SUPPLIERS = ['Kwik Kopy', 'Manufacturer', 'Other'];

interface LineItem { product: string; quantity: string; unitPrice: string; }
const blankItem = (): LineItem => ({ product: '', quantity: '', unitPrice: '' });

interface FormData {
  companyName: string; contactName: string; contactEmail: string; contactPhone: string;
  billingAddress: string; shippingAddress: string;
  status: CorporateStatus; inquiryDate: string; requestedDeliveryDate: string;
  supplierQuote: string; shippingCost: string; paymentStatus: PaymentStatus;
  supplier: string; logoUrl: string; mockupUrl: string; notes: string; conversationLink: string;
}

const blankForm = (): FormData => ({
  companyName: '', contactName: '', contactEmail: '', contactPhone: '',
  billingAddress: '', shippingAddress: '',
  status: 'Inquiry', inquiryDate: new Date().toISOString().split('T')[0], requestedDeliveryDate: '',
  supplierQuote: '', shippingCost: '', paymentStatus: 'Unpaid',
  supplier: '', logoUrl: '', mockupUrl: '', notes: '', conversationLink: '',
});

export default function NewCorporateOrderPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(blankForm());
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function setItemField(i: number, k: keyof LineItem, v: string) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    setSubmitting(true); setError('');
    const res = await fetch('/api/corporate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quoteAmount: orderTotal || null,
        supplierQuote: parseFloat(form.supplierQuote) || null,
        shippingCost: parseFloat(form.shippingCost) || null,
        items: items
          .filter(i => i.product.trim())
          .map(i => ({ product: i.product, quantity: parseInt(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Failed to create order.'); setSubmitting(false); return; }
    router.push(`/corporate/orders/${json.data.id}`);
  }

  const orderTotal = items.filter(i => i.product.trim()).reduce((s, i) => s + (parseInt(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const profit = orderTotal - (parseFloat(form.supplierQuote) || 0) - (parseFloat(form.shippingCost) || 0);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/corporate" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ChevronLeft size={16} /> Back to Corporate
      </Link>
      <h1 className="page-title mb-1">New Corporate Order</h1>
      <p className="page-subtitle mb-6">Log a new wholesale or corporate enquiry</p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Customer details */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Customer Details</h3>
          <div>
            <label className="form-label">Company Name *</label>
            <input value={form.companyName} onChange={e => setField('companyName', e.target.value)}
              className="form-input" placeholder="e.g. Acme Corp" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Contact Name</label>
              <input value={form.contactName} onChange={e => setField('contactName', e.target.value)}
                className="form-input" placeholder="e.g. Jane Smith" />
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input value={form.contactPhone} onChange={e => setField('contactPhone', e.target.value)}
                className="form-input" placeholder="e.g. 0400 000 000" />
            </div>
          </div>
          <div>
            <label className="form-label">Contact Email</label>
            <input type="email" value={form.contactEmail} onChange={e => setField('contactEmail', e.target.value)}
              className="form-input" placeholder="e.g. jane@acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Billing Address</label>
              <textarea value={form.billingAddress} onChange={e => setField('billingAddress', e.target.value)}
                className="form-input resize-none text-sm" rows={2} placeholder="Billing address" />
            </div>
            <div>
              <label className="form-label">Shipping Address</label>
              <textarea value={form.shippingAddress} onChange={e => setField('shippingAddress', e.target.value)}
                className="form-input resize-none text-sm" rows={2} placeholder="Same as billing?" />
            </div>
          </div>
        </div>

        {/* Order items */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Products Ordered</h3>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-end">
              <div>
                {i === 0 && <label className="form-label">Product / SKU</label>}
                <input value={item.product} onChange={e => setItemField(i, 'product', e.target.value)}
                  className="form-input text-sm" placeholder="e.g. PP-UNI2-BLK" />
              </div>
              <div>
                {i === 0 && <label className="form-label">Qty</label>}
                <input type="number" min="0" value={item.quantity} onChange={e => setItemField(i, 'quantity', e.target.value)}
                  className="form-input text-sm" placeholder="0" />
              </div>
              <div>
                {i === 0 && <label className="form-label">Unit Price (AUD)</label>}
                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => setItemField(i, 'unitPrice', e.target.value)}
                  className="form-input text-sm" placeholder="0.00" />
              </div>
              <button type="button" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                disabled={items.length === 1}
                className="h-9 w-8 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {orderTotal > 0 && (
            <p className="text-sm font-semibold text-slate-700 text-right">
              Order Total: ${orderTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <button type="button" onClick={() => setItems(p => [...p, blankItem()])}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm text-slate-400 hover:border-brand-400 hover:text-brand-500 transition-colors flex items-center justify-center gap-2">
            <PlusCircle size={15} /> Add Another Item
          </button>
        </div>

        {/* Status & dates */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Status & Dates</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Stage</label>
              <select value={form.status} onChange={e => setField('status', e.target.value as CorporateStatus)} className="form-input">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Inquiry Date</label>
              <input type="date" value={form.inquiryDate} onChange={e => setField('inquiryDate', e.target.value)} className="form-input" />
            </div>
          </div>
          <div>
            <label className="form-label">Requested Delivery Date</label>
            <input type="date" value={form.requestedDeliveryDate} onChange={e => setField('requestedDeliveryDate', e.target.value)} className="form-input" />
          </div>
        </div>

        {/* Financials */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Financials</h3>

          {/* Customer quote — auto from products */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Customer Quote Total (ex GST)</p>
              <p className="text-xs text-slate-400 italic">Unit price × quantity from Products section</p>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {orderTotal > 0 ? `$${orderTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Supplier Quote (inc GST)</label>
              <input type="number" min="0" step="0.01" value={form.supplierQuote}
                onChange={e => setField('supplierQuote', e.target.value)}
                className="form-input" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Shipping Cost (inc GST)</label>
              <input type="number" min="0" step="0.01" value={form.shippingCost}
                onChange={e => setField('shippingCost', e.target.value)}
                className="form-input" placeholder="0.00 (if applicable)" />
            </div>
          </div>

          {(form.supplierQuote || form.shippingCost) && orderTotal > 0 && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Estimated Profit</p>
                <p className="text-xs text-slate-300 italic">Customer total − supplier − shipping</p>
              </div>
              <p className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ${profit.toFixed(2)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Payment Status</label>
              <select value={form.paymentStatus} onChange={e => setField('paymentStatus', e.target.value as PaymentStatus)} className="form-input">
                {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Supplier</label>
              <select value={form.supplier} onChange={e => setField('supplier', e.target.value)} className="form-input">
                <option value="">Select supplier...</option>
                {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Files & notes */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Files & Notes</h3>
          <div>
            <label className="form-label">Customer Conversation Link</label>
            <input value={form.conversationLink} onChange={e => setField('conversationLink', e.target.value)}
              className="form-input" placeholder="Email thread / chat link" />
          </div>
          <div>
            <label className="form-label">Logo File URL</label>
            <input value={form.logoUrl} onChange={e => setField('logoUrl', e.target.value)}
              className="form-input" placeholder="Google Drive / Dropbox link to logo file" />
          </div>
          <div>
            <label className="form-label">Mockup File URL</label>
            <input value={form.mockupUrl} onChange={e => setField('mockupUrl', e.target.value)}
              className="form-input" placeholder="Link to mockup file" />
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
              className="form-input resize-none" rows={3} placeholder="Any additional notes..." />
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <Link href="/corporate" className="btn-secondary flex-1 text-center">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
