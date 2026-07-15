'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload, CheckCircle, AlertCircle, ChevronLeft, PlusCircle,
  ExternalLink, ClipboardCheck, User,
} from 'lucide-react';
import Link from 'next/link';
import { Product, FaultType } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { FAULT_PARENT_TYPES, getFaultSubtypes, requiresFaultNotes, SAFETY_FAULT_TYPES } from '@/lib/fault-taxonomy';

interface StaffMember { id: string; name: string; }
import { formatCurrency } from '@/lib/utils';

interface FormData {
  date: string;
  orderNumber: string;
  customerName: string;
  product: string;
  manufacturerName: string;
  manufacturerNumber: string;
  faultType: string;
  faultSubtype: string;
  faultNotes: string;
  commslayerChatLink: string;
  evidenceLink: string;
  unitCostUSD: number;
  submittedBy: string;
}

// ── Fuzzy similarity helpers ──────────────────────────────────────────────────
function normFaultName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}
function faultSimilarity(a: string, b: string): number {
  const na = normFaultName(a);
  const nb = normFaultName(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wa = new Set(na.split(/\s+/).filter(w => w.length > 2));
  const wb = new Set(nb.split(/\s+/).filter(w => w.length > 2));
  const intersection = Array.from(wa).filter(w => wb.has(w)).length;
  const unionSet = new Set<string>(Array.from(wa).concat(Array.from(wb)));
  const union = unionSet.size;
  return union > 0 ? intersection / union : 0;
}

// ── FaultTypeSelector ─────────────────────────────────────────────────────────
interface FaultTypeSelectorProps {
  value: string;
  onChange: (val: string) => void;
  faultTypes: FaultType[];
  onFaultTypeAdded: (ft: FaultType) => void;
  error?: string;
}
function FaultTypeSelector({ value, onChange, faultTypes, onFaultTypeAdded, error }: FaultTypeSelectorProps) {
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [similar, setSimilar] = useState<FaultType[]>([]);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (newName.length >= 3) {
      setSimilar(faultTypes.filter(ft => faultSimilarity(newName, ft.name) >= 0.4));
    } else {
      setSimilar([]);
    }
  }, [newName, faultTypes]);

  function enterAddMode() {
    setAddMode(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function cancelAdd() {
    setAddMode(false);
    setNewName('');
    setSimilar([]);
  }
  function chooseSuggested(ft: FaultType) {
    onChange(ft.name);
    cancelAdd();
  }
  async function confirmAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch('/api/fault-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: '' }),
      });
      const data = await res.json();
      if (data.data) {
        onFaultTypeAdded(data.data);
        onChange(data.data.name);
        cancelAdd();
      }
    } finally {
      setAdding(false);
    }
  }

  if (addMode) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (similar.length === 0 && newName.trim().length >= 3) confirmAdd(); } if (e.key === 'Escape') cancelAdd(); }}
            placeholder="Type new fault type name…"
            className="form-input flex-1"
          />
          <button type="button" onClick={cancelAdd}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg whitespace-nowrap">
            Cancel
          </button>
        </div>
        {similar.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-700">⚠ Similar fault types already exist — use one of these instead?</p>
            <div className="flex flex-wrap gap-2">
              {similar.map(ft => (
                <button key={ft.id} type="button" onClick={() => chooseSuggested(ft)}
                  className="text-xs px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-full hover:bg-amber-100 transition-colors">
                  {ft.name}
                </button>
              ))}
            </div>
            <button type="button" onClick={confirmAdd} disabled={adding}
              className="text-xs text-amber-600 hover:text-amber-800 underline disabled:opacity-50">
              {adding ? 'Adding…' : 'Add anyway as new type'}
            </button>
          </div>
        )}
        {similar.length === 0 && newName.trim().length >= 3 && (
          <button type="button" onClick={confirmAdd} disabled={adding}
            className="w-full py-2 text-sm font-medium text-brand-600 border border-brand-200 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-50">
            {adding ? 'Adding…' : `＋ Add "${newName.trim()}" as new fault type`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select value={value}
        onChange={e => {
          if (e.target.value === '__add_new__') { enterAddMode(); }
          else { onChange(e.target.value); }
        }}
        className={`form-input ${error ? 'border-red-300' : ''}`}>
        <option value="">Select fault type…</option>
        <optgroup label="Common fault types">
          {faultTypes
            .filter(ft => !SAFETY_FAULT_TYPES.has(ft.name as never))
            .map(ft => <option key={ft.id} value={ft.name}>{ft.name}</option>)}
        </optgroup>
        <optgroup label="⚠ Safety issues">
          {faultTypes
            .filter(ft => SAFETY_FAULT_TYPES.has(ft.name as never))
            .map(ft => <option key={ft.id} value={ft.name}>⚠ SAFETY — {ft.name}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

function FaultSubtypeSelect({ parent, value, onChange, error }: { parent: string; value: string; onChange: (value: string) => void; error?: string }) {
  const subtypes = getFaultSubtypes(parent);
  if (subtypes.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
      <label className="form-label">Fault Subtype <span className="text-red-500">*</span></label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`form-input bg-white ${error ? 'border-red-300' : ''}`}>
        <option value="">Select subtype…</option>
        {subtypes.map(subtype => <option key={subtype} value={subtype}>{subtype}</option>)}
      </select>
      <p className="mt-1.5 text-xs text-slate-500">Choose the closest match. Select the Other option and add notes if the issue is not listed.</p>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export default function NewCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'management';
  const [products, setProducts] = useState<Product[]>([]);
  const [faultTypes, setFaultTypes] = useState<FaultType[]>([]);
  const handleFaultTypeAdded = useCallback((ft: FaultType) => setFaultTypes(prev => [...prev, ft]), []);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [form, setForm] = useState<FormData>({
    date: new Date().toISOString().slice(0, 10),
    orderNumber: '',
    customerName: '',
    product: '',
    manufacturerName: '',
    manufacturerNumber: '',
    faultType: '',
    faultSubtype: '',
    faultNotes: '',
    commslayerChatLink: '',
    evidenceLink: '',
    unitCostUSD: 0,
    submittedBy: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'file' | 'submit', string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFolderUrl, setEvidenceFolderUrl] = useState<string>('');

  // Load current month's evidence folder link
  useEffect(() => {
    const month = new Date().getMonth() + 1; // 1-indexed
    fetch('/api/settings/evidence-folders')
      .then(r => r.json())
      .then(d => { setEvidenceFolderUrl((d.data ?? {})[String(month)] ?? ''); })
      .catch(() => {});
  }, []);
  const [success, setSuccess] = useState(false);
  const [submittedCaseId, setSubmittedCaseId] = useState<string>('');
  const [duplicates, setDuplicates] = useState<{ id: string; product: string; date: string; faultType: string; claimStatus: string }[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/fault-types').then(r => r.json()),
      fetch('/api/staff').then(r => r.json()),
    ]).then(([pRes, ftRes, sRes]) => {
      setProducts(pRes.data || []);
      setFaultTypes(FAULT_PARENT_TYPES.map(name => ({ id: `v10-${name}`, name, description: SAFETY_FAULT_TYPES.has(name) ? 'Safety-critical fault' : '' })));
      setStaff(sRes.data || []);
    });
  }, []);

  // Auto-fill submittedBy for staff (non-admin) once user is loaded
  useEffect(() => {
    if (user && !isAdmin) {
      setForm(f => ({ ...f, submittedBy: user.name }));
    }
  }, [user, isAdmin]);

  useEffect(() => {
    const order = searchParams.get('order');
    if (!order) return;
    setForm(f => f.orderNumber ? f : { ...f, orderNumber: order });
  }, [searchParams]);

  useEffect(() => {
    const orderNumber = form.orderNumber.trim();
    if (orderNumber.length < 3) {
      setDuplicates([]);
      setCheckingDup(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCheckingDup(true);
      fetch(`/api/cases/check?orderNumber=${encodeURIComponent(orderNumber)}`, { signal: controller.signal })
        .then(r => r.json())
        .then(json => setDuplicates(json.data ?? []))
        .catch(err => {
          if (err.name !== 'AbortError') setDuplicates([]);
        })
        .finally(() => setCheckingDup(false));
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [form.orderNumber]);

  function handleProductChange(productName: string) {
    const product = products.find(p => p.name === productName) || null;
    setSelectedProduct(product);
    setForm(f => ({
      ...f,
      product: productName,
      manufacturerName: product?.manufacturerName || '',
      unitCostUSD: product?.unitCostUSD || 0,
      manufacturerNumber: '',
    }));
  }

  function handleChange(field: keyof FormData, value: string | number) {
    setForm(f => ({
      ...f,
      [field]: value,
      ...(field === 'faultType' ? { faultSubtype: '' } : {}),
    }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    const effectiveName = isAdmin ? form.submittedBy : (user?.name ?? '');
    if (!effectiveName) newErrors.submittedBy = 'Please select your name';
    if (!form.date)         newErrors.date = 'Date is required';
    if (!form.orderNumber)  newErrors.orderNumber = 'Order number is required';
    if (!form.product)      newErrors.product = 'Product is required';
    if (!form.faultType)    newErrors.faultType = 'Fault type is required';
    if (getFaultSubtypes(form.faultType).length > 0 && !form.faultSubtype) {
      newErrors.faultSubtype = 'Fault subtype is required';
    }
    if (requiresFaultNotes(form.faultType, form.faultSubtype) && !form.faultNotes.trim()) {
      newErrors.faultNotes = 'Please add notes for safety-critical or Other faults';
    }
    if (!form.commslayerChatLink) {
      newErrors.commslayerChatLink = 'Commslayer chat link is required';
    } else {
      try {
        const url = new URL(form.commslayerChatLink);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      } catch {
        newErrors.commslayerChatLink = 'Enter a valid Commslayer chat link';
      }
    }
    if (!form.customerName) newErrors.customerName = 'Customer name is required';
    if (!form.evidenceLink) newErrors.file = 'Evidence link is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        submittedBy: isAdmin ? form.submittedBy : (user?.name ?? form.submittedBy),
      };
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSubmittedCaseId(json.data.id);
      setSuccess(true);
    } catch (err: any) {
      setErrors(e => ({ ...e, submit: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    const preservedName = isAdmin ? form.submittedBy : (user?.name ?? '');
    setForm({
      date: new Date().toISOString().slice(0, 10),
      orderNumber: '',
      customerName: '',
      product: '',
      manufacturerName: '',
      manufacturerNumber: '',
      faultType: '',
      faultSubtype: '',
      faultNotes: '',
      commslayerChatLink: '',
      evidenceLink: '',
      unitCostUSD: 0,
      submittedBy: preservedName,
    });
    setErrors({});
    setSelectedProduct(null);
    setDuplicates([]);
    setSuccess(false);
    setSubmittedCaseId('');
  }

  const evidenceLinks = form.evidenceLink.split(/[,\n]/).filter((link: string) => link.trim());
  const completionItems = [
    { label: 'Order number', done: Boolean(form.orderNumber.trim()) },
    { label: 'Customer name', done: Boolean(form.customerName.trim()) },
    { label: 'Commslayer link', done: Boolean(form.commslayerChatLink.trim()) },
    { label: 'Product', done: Boolean(form.product) },
    { label: 'Fault type', done: Boolean(form.faultType && (getFaultSubtypes(form.faultType).length === 0 || form.faultSubtype)) },
    { label: 'Evidence link', done: Boolean(form.evidenceLink.trim()) },
  ];
  const missingCount = completionItems.filter(item => !item.done).length;

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Case Submitted!</h2>
          <p className="text-slate-500 text-sm mb-6">The fault case has been logged successfully.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetForm}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <PlusCircle size={16} />
              Submit Another Case
            </button>
            <button
              onClick={() => router.push(`/cases/${submittedCaseId}`)}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              View Case
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/cases" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ChevronLeft size={16} /> Back to Cases
        </Link>
        <div>
          <h1 className="page-title">Submit Fault Case</h1>
          <p className="page-subtitle">Log the customer, product, fault and evidence in one guided flow.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-[#f7f8fa] px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-brand-600" />
                <h2 className="text-sm font-semibold text-slate-800">Customer Details</h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-4">
                <div>
                  <label className="form-label">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.date}
                    onChange={e => handleChange('date', e.target.value)}
                    className={`form-input ${errors.date ? 'border-red-300' : ''}`} />
                  {errors.date && <p className="form-error">{errors.date}</p>}
                </div>
                <div>
                  <label className="form-label">Order Number <span className="text-red-500">*</span></label>
                  <input type="text" value={form.orderNumber}
                    onChange={e => handleChange('orderNumber', e.target.value)}
                    placeholder="e.g. ORD-12345"
                    className={`form-input ${errors.orderNumber ? 'border-red-300' : ''}`} />
                  {errors.orderNumber && <p className="form-error">{errors.orderNumber}</p>}
                  {checkingDup && <p className="mt-1 text-xs text-slate-400">Checking for existing faults...</p>}
                  {duplicates.length > 0 && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Heads up: this order number has {duplicates.length} existing fault{duplicates.length !== 1 ? 's' : ''}.</p>
                      <ul className="space-y-0.5">
                        {duplicates.map(d => (
                          <li key={d.id} className="text-xs text-amber-700">
                            {d.product} - {d.faultType} - <span className="font-medium">{d.claimStatus}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-600 mt-1">Submit only if this is a different product or fault.</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Commslayer Chat Link <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={form.commslayerChatLink}
                  onChange={e => handleChange('commslayerChatLink', e.target.value)}
                  placeholder="https://..."
                  autoComplete="url"
                  className={`form-input text-sm ${errors.commslayerChatLink ? 'border-red-300' : ''}`}
                />
                {errors.commslayerChatLink && <p className="form-error">{errors.commslayerChatLink}</p>}
              </div>

              <div>
                <label className="form-label">Customer Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.customerName}
                  onChange={e => handleChange('customerName', e.target.value)}
                  placeholder="Full name of the customer"
                  className={`form-input ${errors.customerName ? 'border-red-300' : ''}`} />
                {errors.customerName && <p className="form-error">{errors.customerName}</p>}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-[#f7f8fa] px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Product & Fault</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Product <span className="text-red-500">*</span></label>
                <select value={form.product} onChange={e => handleProductChange(e.target.value)}
                  className={`form-input ${errors.product ? 'border-red-300' : ''}`}>
                  <option value="">Select a product...</option>
                  {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                {errors.product && <p className="form-error">{errors.product}</p>}
              </div>

              {selectedProduct && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Manufacturer</p>
                    <p className="text-sm font-medium text-slate-700 truncate">{form.manufacturerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Unit Cost</p>
                    <p className="text-sm font-medium text-slate-700">{form.unitCostUSD > 0 ? formatCurrency(form.unitCostUSD) : '-'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Manufacturer No.</label>
                    {selectedProduct.manufacturerNumbers.length > 0 ? (
                      <select value={form.manufacturerNumber}
                        onChange={e => handleChange('manufacturerNumber', e.target.value)}
                        className="form-input mt-1 py-1.5 text-xs">
                        <option value="">Select...</option>
                        {selectedProduct.manufacturerNumbers.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.manufacturerNumber}
                        onChange={e => handleChange('manufacturerNumber', e.target.value)}
                        placeholder="Optional" className="form-input mt-1 py-1.5 text-xs" />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Fault Type <span className="text-red-500">*</span></label>
                <FaultTypeSelector
                  value={form.faultType}
                  onChange={v => handleChange('faultType', v)}
                  faultTypes={faultTypes}
                  onFaultTypeAdded={handleFaultTypeAdded}
                  error={errors.faultType}
                />
                {errors.faultType && <p className="form-error">{errors.faultType}</p>}
                <FaultSubtypeSelect parent={form.faultType} value={form.faultSubtype} onChange={v => handleChange('faultSubtype', v)} error={errors.faultSubtype} />
              </div>

              <div>
                <label className="form-label">Fault Notes {requiresFaultNotes(form.faultType, form.faultSubtype) && <span className="text-red-500">*</span>}</label>
                <textarea value={form.faultNotes}
                  onChange={e => handleChange('faultNotes', e.target.value)}
                  rows={4}
                  placeholder={requiresFaultNotes(form.faultType, form.faultSubtype) ? 'Required for safety-critical or Other faults...' : 'Add context if helpful...'}
                  className={`form-input resize-none ${errors.faultNotes ? 'border-red-300' : ''}`} />
                {errors.faultNotes && <p className="form-error">{errors.faultNotes}</p>}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-[#f7f8fa] px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Evidence <span className="text-red-500">*</span></h2>
            </div>
            <div className="p-5 space-y-4">
              {evidenceFolderUrl ? (
                <a
                  href={evidenceFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
                >
                  <Upload size={14} />
                  <span className="flex-1">Open {new Date().toLocaleString('default', { month: 'long' })} Evidence Folder</span>
                  <ExternalLink size={13} className="flex-shrink-0 opacity-60" />
                </a>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">No evidence folder set for this month</p>
                    <p className="text-xs text-amber-700 mt-0.5">Upload in Google Drive, then paste the share link below. Ask Anthony to set up the monthly folder in Admin.</p>
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Evidence Share Link</label>
                <textarea
                  value={form.evidenceLink}
                  onChange={e => { handleChange('evidenceLink', e.target.value); setErrors(prev => ({ ...prev, file: '' })); }}
                  rows={3}
                  placeholder="https://drive.google.com/file/d/..."
                  className={`form-input resize-none text-xs font-mono ${errors.file ? 'border-red-300' : ''}`}
                />
                {errors.file && <p className="form-error">{errors.file}</p>}
                <p className="mt-1.5 text-xs text-slate-500">Paste one or more Google Drive links. Separate multiple links with a comma or new line.</p>
              </div>

              {evidenceLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {evidenceLinks.map((link: string, i: number) => (
                    <a key={i} href={link.trim()} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline bg-brand-50 border border-brand-200 px-2 py-1 rounded-lg">
                      <CheckCircle size={11} /> Link {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(errors as any).submit && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{(errors as any).submit}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Before submitting</p>
            <p className="mt-1 text-xs leading-5">Remind the customer that faulty units should be taken to an e-waste collection point and not disposed of in general waste.</p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Ready to Submit</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${missingCount === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {missingCount === 0 ? 'Complete' : `${missingCount} left`}
              </span>
            </div>
            <div className="space-y-2">
              {completionItems.map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${item.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                    {item.done && <CheckCircle size={11} />}
                  </span>
                  <span className={item.done ? 'text-slate-700' : 'text-slate-400'}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <User size={15} className="text-slate-400" /> Submitted by
            </div>
            {isAdmin ? (
              <div>
                <select
                  value={form.submittedBy}
                  onChange={e => handleChange('submittedBy', e.target.value)}
                  className={`form-input ${errors.submittedBy ? 'border-red-300' : ''}`}
                >
                  <option value="">Select name...</option>
                  {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                {errors.submittedBy && <p className="form-error">{errors.submittedBy}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-700">{user?.name ?? 'Loading...'}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button type="submit" disabled={submitting} className="btn-primary justify-center px-8">
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : 'Submit Case'}
            </button>
            <Link href="/cases" className="btn-secondary justify-center">Cancel</Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
