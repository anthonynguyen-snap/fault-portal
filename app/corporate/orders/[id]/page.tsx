'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, CheckCircle, ExternalLink, Mail, Phone, Trash2, PlusCircle, Copy, MessageSquare } from 'lucide-react';
import { CorporateOrder, CorporateStatus, PaymentStatus, CorporateItem } from '@/types';

const STATUSES: CorporateStatus[] = [
  'Inquiry','Quote Sent','Quote Approved','Details Received',
  'Mockup Sent','Mockup Approved','Sent to Supplier','Supplier Quoted',
  'In Production','Completed','Delivered',
];
const PAYMENT_STATUSES: PaymentStatus[] = ['Unpaid','Invoiced','Paid','Overdue'];
const SUPPLIERS = ['Kwik Kopy', 'Manufacturer', 'Other'];

const STATUS_COLOURS: Record<CorporateStatus, string> = {
  'Inquiry':         'bg-slate-100 text-slate-600',
  'Quote Sent':      'bg-blue-100 text-blue-700',
  'Quote Approved':  'bg-indigo-100 text-indigo-700',
  'Details Received':'bg-purple-100 text-purple-700',
  'Mockup Sent':     'bg-amber-100 text-amber-700',
  'Mockup Approved': 'bg-orange-100 text-orange-700',
  'Sent to Supplier':'bg-cyan-100 text-cyan-700',
  'Supplier Quoted': 'bg-teal-100 text-teal-700',
  'In Production':   'bg-yellow-100 text-yellow-700',
  'Completed':       'bg-emerald-100 text-emerald-700',
  'Delivered':       'bg-green-100 text-green-700',
};

const PAYMENT_COLOURS: Record<PaymentStatus, string> = {
  'Unpaid':   'bg-slate-100 text-slate-500',
  'Invoiced': 'bg-blue-100 text-blue-600',
  'Paid':     'bg-emerald-100 text-emerald-700',
  'Overdue':  'bg-red-100 text-red-600',
};

function fmt(dateStr: string) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

interface EditableItem { id?: string; product: string; quantity: string; unitPrice: string; }
const blankItem = (): EditableItem => ({ product: '', quantity: '', unitPrice: '' });

export default function CorporateOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CorporateOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Editable fields
  const [status, setStatus] = useState<CorporateStatus>('Inquiry');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [supplierQuote, setSupplierQuote] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [actualDeliveryDate, setActualDeliveryDate] = useState('');
  const [quoteSentDate, setQuoteSentDate] = useState('');
  const [quoteApprovedDate, setQuoteApprovedDate] = useState('');
  const [mockupSentDate, setMockupSentDate] = useState('');
  const [mockupApprovedDate, setMockupApprovedDate] = useState('');
  const [orderSentDate, setOrderSentDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [mockupUrl, setMockupUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [conversationLink, setConversationLink] = useState('');
  const [items, setItems] = useState<EditableItem[]>([blankItem()]);

  useEffect(() => {
    fetch(`/api/corporate/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          const d: CorporateOrder = json.data;
          setData(d);
          setStatus(d.status);
          setPaymentStatus(d.paymentStatus);
          setSupplierQuote(d.supplierQuote ? String(d.supplierQuote) : '');
          setShippingCost(d.shippingCost ? String(d.shippingCost) : '');
          setSupplier(d.supplier || '');
          setRequestedDeliveryDate(fmt(d.requestedDeliveryDate));
          setActualDeliveryDate(fmt(d.actualDeliveryDate));
          setQuoteSentDate(fmt(d.quoteSentDate));
          setQuoteApprovedDate(fmt(d.quoteApprovedDate));
          setMockupSentDate(fmt(d.mockupSentDate));
          setMockupApprovedDate(fmt(d.mockupApprovedDate));
          setOrderSentDate(fmt(d.orderSentDate));
          setExpectedCompletionDate(fmt(d.expectedCompletionDate));
          setLogoUrl(d.logoUrl || '');
          setMockupUrl(d.mockupUrl || '');
          setNotes(d.notes || '');
          setConversationLink(d.conversationLink || '');
          setItems(
            d.items.length > 0
              ? d.items.map(i => ({ id: i.id, product: i.product, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
              : [blankItem()]
          );
        }
        setLoading(false);
      });
  }, [id]);

  const itemsTotal = items.filter(i => i.product).reduce((s, i) => s + (parseInt(i.quantity)||0) * (parseFloat(i.unitPrice)||0), 0);
  const profit = itemsTotal - (parseFloat(supplierQuote) || 0) - (parseFloat(shippingCost) || 0);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/corporate/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status, paymentStatus,
        quoteAmount: itemsTotal || null,
        supplierQuote: parseFloat(supplierQuote) || null,
        shippingCost: parseFloat(shippingCost) || null,
        supplier,
        requestedDeliveryDate: requestedDeliveryDate || null,
        actualDeliveryDate: actualDeliveryDate || null,
        quoteSentDate: quoteSentDate || null,
        quoteApprovedDate: quoteApprovedDate || null,
        mockupSentDate: mockupSentDate || null,
        mockupApprovedDate: mockupApprovedDate || null,
        orderSentDate: orderSentDate || null,
        expectedCompletionDate: expectedCompletionDate || null,
        logoUrl, mockupUrl, notes, conversationLink,
        items: items
          .filter(i => i.product.trim())
          .map(i => ({ product: i.product, quantity: parseInt(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
      }),
    });
    const json = await res.json();
    if (json.data) { setData(json.data); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  function copySupplierEmail() {
    const productLines = items
      .filter(i => i.product.trim())
      .map(i => `- ${i.product}${i.quantity ? ` x${i.quantity}` : ''}`)
      .join('\n');
    const deliveryLine = [
      data?.shippingAddress,
      requestedDeliveryDate ? `Required by: ${new Date(requestedDeliveryDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : null,
    ].filter(Boolean).join('\n');

    const email = `Hi team,

I'm looking to get a quote for the following:

Product(s) & Quantities:
${productLines || '[Insert details]'}

I've attached a mockup of the design the client is after.

This will also require delivery, so if you could include that in the quote as well, that would be great.

Please find the delivery details and required timeline below:
${deliveryLine || '[Insert address + deadline]'}

Let me know if there are any issues or if you need anything further from my end.

Thanks,
Anthony`;

    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function duplicateOrder() {
    if (!data) return;
    setDuplicating(true);
    const res = await fetch('/api/corporate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: `${data.companyName} (Copy)`,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
        status: 'Inquiry',
        supplier: data.supplier,
        notes: data.notes,
        items: items.filter(i => i.product).map(i => ({
          product: i.product,
          quantity: parseInt(i.quantity) || 0,
          unitPrice: parseFloat(i.unitPrice) || 0,
        })),
      }),
    });
    const json = await res.json();
    setDuplicating(false);
    if (json.data) router.push(`/corporate/orders/${json.data.id}`);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return <div className="text-center py-20 text-slate-500">Order not found. <Link href="/corporate" className="text-brand-600 hover:underline">Back</Link></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/corporate/orders" className="btn-ghost -ml-2 mb-4 inline-flex">
        <ChevronLeft size={16} /> Back to Orders
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="page-title">{data.companyName}</h1>
            {data.referenceNumber && (
              <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">{data.referenceNumber}</span>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${STATUS_COLOURS[status]}`}>{status}</span>
            Created {new Date(data.createdAt).toLocaleDateString('en-AU')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copySupplierEmail}
            className={`btn-ghost flex items-center gap-1.5 text-sm ${copied ? 'text-emerald-600' : ''}`}
            title="Copy supplier email">
            {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Email</>}
          </button>
          <button onClick={duplicateOrder} disabled={duplicating}
            className="btn-ghost text-sm flex items-center gap-1.5">
            <PlusCircle size={14} /> {duplicating ? 'Duplicating...' : 'Duplicate'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">

          {/* Customer */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer</h3>
            <p className="font-semibold text-slate-900">{data.companyName}</p>
            {data.contactName && <p className="text-sm text-slate-600 mt-0.5">{data.contactName}</p>}
            {data.contactEmail && (
              <a href={`mailto:${data.contactEmail}`} className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mt-1">
                <Mail size={13} />{data.contactEmail}
              </a>
            )}
            {data.contactPhone && (
              <a href={`tel:${data.contactPhone}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:underline mt-1 ml-3">
                <Phone size={13} />{data.contactPhone}
              </a>
            )}
            {conversationLink && (
              <a href={conversationLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-brand-600 hover:underline font-medium">
                <MessageSquare size={13} /> View Conversation
              </a>
            )}
            {(data.billingAddress || data.shippingAddress) && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                {data.billingAddress && <div><p className="text-xs text-slate-400 mb-0.5">Billing</p><p className="text-sm text-slate-600 whitespace-pre-line">{data.billingAddress}</p></div>}
                {data.shippingAddress && <div><p className="text-xs text-slate-400 mb-0.5">Shipping</p><p className="text-sm text-slate-600 whitespace-pre-line">{data.shippingAddress}</p></div>}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Products Ordered</h3>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-end">
                <div>
                  {i === 0 && <label className="form-label">Product / SKU</label>}
                  <input value={item.product} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, product: e.target.value } : x))}
                    className="form-input text-sm" placeholder="e.g. PP-UNI2-BLK" />
                </div>
                <div>
                  {i === 0 && <label className="form-label">Qty</label>}
                  <input type="number" min="0" value={item.quantity} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))}
                    className="form-input text-sm" placeholder="0" />
                </div>
                <div>
                  {i === 0 && <label className="form-label">Unit Price (AUD)</label>}
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, unitPrice: e.target.value } : x))}
                    className="form-input text-sm" placeholder="0.00" />
                </div>
                <button type="button" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="h-9 w-8 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {items.filter(i => i.product && i.quantity && i.unitPrice).length > 0 && (
              <p className="text-sm font-semibold text-slate-700 text-right">
                Order Total: ${items.filter(i => i.product).reduce((s, i) => s + (parseInt(i.quantity)||0) * (parseFloat(i.unitPrice)||0), 0)
                  .toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </p>
            )}
            <button type="button" onClick={() => setItems(p => [...p, blankItem()])}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm text-slate-400 hover:border-brand-400 hover:text-brand-500 transition-colors flex items-center justify-center gap-2">
              <PlusCircle size={15} /> Add Item
            </button>
          </div>

          {/* Key dates */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Key Dates</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Quote Sent', quoteSentDate, setQuoteSentDate],
                ['Quote Approved', quoteApprovedDate, setQuoteApprovedDate],
                ['Mockup Sent', mockupSentDate, setMockupSentDate],
                ['Mockup Approved', mockupApprovedDate, setMockupApprovedDate],
                ['Sent to Supplier', orderSentDate, setOrderSentDate],
                ['Expected Completion', expectedCompletionDate, setExpectedCompletionDate],
                ['Requested Delivery', requestedDeliveryDate, setRequestedDeliveryDate],
                ['Actual Delivery', actualDeliveryDate, setActualDeliveryDate],
              ].map(([label, val, setter]) => (
                <div key={label as string}>
                  <label className="form-label">{label as string}</label>
                  <input type="date" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} className="form-input text-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Files & notes */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">Files & Notes</h3>
            <div>
              <label className="form-label">Customer Conversation Link</label>
              <div className="flex gap-2">
                <input value={conversationLink} onChange={e => setConversationLink(e.target.value)}
                  className="form-input text-sm flex-1" placeholder="Email thread / chat link" />
                {conversationLink && <a href={conversationLink} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3"><ExternalLink size={14} /></a>}
              </div>
            </div>
            <div>
              <label className="form-label">Logo File URL</label>
              <div className="flex gap-2">
                <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  className="form-input text-sm flex-1" placeholder="Google Drive / Dropbox link" />
                {logoUrl && <a href={logoUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3"><ExternalLink size={14} /></a>}
              </div>
            </div>
            <div>
              <label className="form-label">Mockup File URL</label>
              <div className="flex gap-2">
                <input value={mockupUrl} onChange={e => setMockupUrl(e.target.value)}
                  className="form-input text-sm flex-1" placeholder="Link to mockup" />
                {mockupUrl && <a href={mockupUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3"><ExternalLink size={14} /></a>}
              </div>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="form-input resize-none text-sm" rows={4} placeholder="Any notes about this order..." />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Status */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Stage</h3>
            <div className="space-y-1.5">
              {STATUSES.map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs text-left font-medium transition-all ${
                    status === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Financials */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Financials</h3>

            {/* Customer total — auto from products */}
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-0.5">Customer Quote Total (ex GST)</p>
              <p className="text-xs text-slate-300 italic mb-1">Unit price × qty from products</p>
              <p className="text-lg font-bold text-slate-800">
                {itemsTotal > 0 ? `$${itemsTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
              </p>
              {itemsTotal > 0 && (
                <p className="text-xs text-slate-400 mt-1">inc GST: ${(itemsTotal * 1.1).toFixed(2)}</p>
              )}
            </div>

            <div>
              <label className="form-label">Supplier Quote (inc GST)</label>
              <input type="number" min="0" step="0.01" value={supplierQuote} onChange={e => setSupplierQuote(e.target.value)}
                className="form-input text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Shipping Cost (inc GST)</label>
              <input type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)}
                className="form-input text-sm" placeholder="0.00 (if applicable)" />
            </div>

            {itemsTotal > 0 && (supplierQuote || shippingCost) && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">Estimated Profit</p>
                <p className="text-xs text-slate-300 italic mb-1">Customer total − supplier − shipping</p>
                <p className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ${profit.toFixed(2)}
                </p>
              </div>
            )}
            <div>
              <label className="form-label">Payment Status</label>
              <div className="space-y-1.5">
                {PAYMENT_STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => setPaymentStatus(s)}
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs text-left font-medium transition-all ${
                      paymentStatus === s
                        ? `border-transparent ${PAYMENT_COLOURS[s]}`
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Supplier</label>
              <select value={supplier} onChange={e => setSupplier(e.target.value)} className="form-input text-sm">
                <option value="">Select...</option>
                {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className={`w-full btn-primary flex items-center justify-center gap-2 ${saved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}>
            {saved ? <><CheckCircle size={15} />Saved</> : saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : <><Save size={15} />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
