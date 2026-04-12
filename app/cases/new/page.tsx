'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, X, CheckCircle, AlertCircle, ChevronLeft,
  File, Image, Video, Zap, LayoutList, ChevronDown, ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { Product, FaultType } from '@/types';
import { formatCurrency } from '@/lib/utils';

type Mode = 'standard' | 'quick';

interface FormData {
  date: string;
  orderNumber: string;
  customerName: string;
  product: string;
  manufacturerName: string;
  manufacturerNumber: string;
  faultType: string;
  faultNotes: string;
  evidenceLink: string;
  unitCostUSD: number;
  submittedBy: string;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image size={20} className="text-blue-500" />;
  if (type.startsWith('video/')) return <Video size={20} className="text-purple-500" />;
  return <File size={20} className="text-slate-500" />;
}

export default function NewCasePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [faultTypes, setFaultTypes] = useState<FaultType[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mode, setMode] = useState<Mode>('standard');
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const [form, setForm] = useState<FormData>({
    date: new Date().toISOString().slice(0, 10),
    orderNumber: '',
    customerName: '',
    product: '',
    manufacturerName: '',
    manufacturerNumber: '',
    faultType: '',
    faultNotes: '',
    evidenceLink: '',
    unitCostUSD: 0,
    submittedBy: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'file' | 'submit', string>>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; link: string; previewUrl?: string; fileType?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; product: string; date: string; faultType: string; claimStatus: string }[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const tempCaseId = useRef(`CASE-${Date.now()}`);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/fault-types').then(r => r.json()),
    ]).then(([pRes, ftRes]) => {
      setProducts(pRes.data || []);
      setFaultTypes(ftRes.data || []);
    });
  }, []);

  // When switching modes, auto-expand More Details if it has values
  function handleModeSwitch(newMode: Mode) {
    setMode(newMode);
    setErrors({});
    if (newMode === 'quick') setShowMoreDetails(false);
  }

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
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  async function handleFileUpload(file: File) {
    if (!file) return;
    setErrors(e => ({ ...e, file: '' }));
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrors(e => ({ ...e, file: `${file.name}: File too large. Maximum 50MB.` }));
      return;
    }
    const allowed = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/x-msvideo','video/x-ms-wmv','video/avi','application/pdf'];
    const isVideo = file.type.startsWith('video/') || /\.(mov|mp4|avi|wmv|mkv)$/i.test(file.name);
    if (!allowed.includes(file.type) && !isVideo) {
      setErrors(e => ({ ...e, file: 'Invalid file type. Use images, videos (MP4, MOV, AVI), or PDF.' }));
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    const fileType = file.type;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caseId', tempCaseId.current);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const newFile = { name: file.name, link: json.data.link, previewUrl, fileType };
      setUploadedFiles(prev => {
        const updated = [...prev, newFile];
        setForm(f => ({ ...f, evidenceLink: updated.map(u => u.link).join(',') }));
        return updated;
      });
    } catch (err: any) {
      setErrors(e => ({ ...e, file: err.message || 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      await handleFileUpload(file);
    }
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.date)         newErrors.date = 'Date is required';
    if (!form.orderNumber)  newErrors.orderNumber = 'Order number is required';
    if (!form.product)      newErrors.product = 'Product is required';
    if (!form.faultType)    newErrors.faultType = 'Fault type is required';
    if (!form.evidenceLink) newErrors.file = 'Evidence upload is required';

    // In Standard mode, customerName is also required
    if (mode === 'standard' && !form.customerName) {
      newErrors.customerName = 'Customer name is required';
    }

    // In Quick mode, if More Details fields have errors, auto-expand the section
    const moreDetailFields: (keyof FormData)[] = ['customerName','manufacturerNumber','faultNotes','submittedBy'];
    const hasMoreDetailErrors = moreDetailFields.some(f => newErrors[f]);
    if (mode === 'quick' && hasMoreDetailErrors) {
      setShowMoreDetails(true);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSuccess(true);
      setTimeout(() => router.push(`/cases/${json.data.id}`), 1500);
    } catch (err: any) {
      setErrors(e => ({ ...e, submit: err.message }));
    } finally {
      setSubmitting(false);
    }
  }

  // Count how many "More Details" fields have values (for the badge)
  const moreDetailsFilled = [
    form.customerName, form.manufacturerNumber, form.faultNotes, form.submittedBy,
  ].filter(Boolean).length;

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Case Submitted!</h2>
          <p className="text-slate-500 text-sm">Redirecting to case details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/cases" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ChevronLeft size={16} /> Back to Cases
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">Submit Fault Case</h1>
            <p className="page-subtitle">Log a new faulty product case with evidence</p>
          </div>
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 mt-1">
            <button
              type="button"
              onClick={() => handleModeSwitch('standard')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                mode === 'standard'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <LayoutList size={13} />
              Standard
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('quick')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                mode === 'quick'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Zap size={13} />
              Quick
            </button>
          </div>
        </div>
        {mode === 'quick' && (
          <div className="mt-3 flex items-center gap-2 p-2.5 bg-brand-50 border border-brand-200 rounded-lg text-xs text-brand-700">
            <Zap size={12} />
            <span>Quick Mode — showing essential fields only. Use <strong>More Details</strong> below for optional info.</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── STANDARD MODE ── */}
        {mode === 'standard' && (
          <>
            {/* Section 1: Basic Info */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                Case Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  {duplicates.length > 0 && (
                    <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Heads up — this order number has {duplicates.length} existing fault{duplicates.length !== 1 ? 's' : ''}:</p>
                      <ul className="space-y-0.5">
                        {duplicates.map(d => (
                          <li key={d.id} className="text-xs text-amber-700">
                            {d.product} · {d.faultType} · <span className="font-medium">{d.claimStatus}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-600 mt-1">You can still submit if this is a different product or fault.</p>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Customer Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.customerName}
                    onChange={e => handleChange('customerName', e.target.value)}
                    placeholder="Full name of the customer"
                    className={`form-input ${errors.customerName ? 'border-red-300' : ''}`} />
                  {errors.customerName && <p className="form-error">{errors.customerName}</p>}
                </div>
                <div>
                  <label className="form-label">Submitted By</label>
                  <input type="text" value={form.submittedBy}
                    onChange={e => handleChange('submittedBy', e.target.value)}
                    placeholder="Your name (optional)" className="form-input" />
                </div>
              </div>
            </div>

            {/* Section 2: Product */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                Product Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="form-label">Product <span className="text-red-500">*</span></label>
                  <select value={form.product} onChange={e => handleProductChange(e.target.value)}
                    className={`form-input ${errors.product ? 'border-red-300' : ''}`}>
                    <option value="">Select a product…</option>
                    {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  {errors.product && <p className="form-error">{errors.product}</p>}
                </div>
                <div>
                  <label className="form-label">Manufacturer <span className="text-slate-400 font-normal">(auto-filled)</span></label>
                  <input type="text" value={form.manufacturerName} readOnly
                    className="form-input bg-slate-50 text-slate-500 cursor-not-allowed"
                    placeholder="Auto-filled from product" />
                </div>
                <div>
                  <label className="form-label">Unit Cost <span className="text-slate-400 font-normal">(auto-filled)</span></label>
                  <input type="text" value={form.unitCostUSD > 0 ? formatCurrency(form.unitCostUSD) : ''} readOnly
                    className="form-input bg-slate-50 text-slate-500 cursor-not-allowed"
                    placeholder="Auto-filled from product" />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Manufacturer Number</label>
                  {selectedProduct && selectedProduct.manufacturerNumbers.length > 0 ? (
                    <select value={form.manufacturerNumber}
                      onChange={e => handleChange('manufacturerNumber', e.target.value)}
                      className="form-input">
                      <option value="">Select manufacturer number…</option>
                      {selectedProduct.manufacturerNumbers.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={form.manufacturerNumber}
                      onChange={e => handleChange('manufacturerNumber', e.target.value)}
                      placeholder="Enter manufacturer number" className="form-input" />
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Fault Details */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                Fault Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label">Fault Type <span className="text-red-500">*</span></label>
                  <select value={form.faultType} onChange={e => handleChange('faultType', e.target.value)}
                    className={`form-input ${errors.faultType ? 'border-red-300' : ''}`}>
                    <option value="">Select fault type…</option>
                    {faultTypes.map(ft => <option key={ft.id} value={ft.name}>{ft.name}</option>)}
                  </select>
                  {errors.faultType && <p className="form-error">{errors.faultType}</p>}
                </div>
                <div>
                  <label className="form-label">Fault Notes</label>
                  <textarea value={form.faultNotes}
                    onChange={e => handleChange('faultNotes', e.target.value)}
                    rows={4}
                    placeholder="Describe the fault in detail — what happened, how it was discovered, customer feedback…"
                    className="form-input resize-none" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── QUICK MODE ── */}
        {mode === 'quick' && (
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
              Essential Details
            </h2>

            {/* Row 1: Date + Order Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
            </div>

            {/* Row 2: Product */}
            <div>
              <label className="form-label">Product <span className="text-red-500">*</span></label>
              <select value={form.product} onChange={e => handleProductChange(e.target.value)}
                className={`form-input ${errors.product ? 'border-red-300' : ''}`}>
                <option value="">Select a product…</option>
                {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {errors.product && <p className="form-error">{errors.product}</p>}
            </div>

            {/* Row 3: Fault Type */}
            <div>
              <label className="form-label">Fault Type <span className="text-red-500">*</span></label>
              <select value={form.faultType} onChange={e => handleChange('faultType', e.target.value)}
                className={`form-input ${errors.faultType ? 'border-red-300' : ''}`}>
                <option value="">Select fault type…</option>
                {faultTypes.map(ft => <option key={ft.id} value={ft.name}>{ft.name}</option>)}
              </select>
              {errors.faultType && <p className="form-error">{errors.faultType}</p>}
            </div>

            {/* More Details collapsible */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMoreDetails(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span>More Details</span>
                  {moreDetailsFilled > 0 && (
                    <span className="text-[10px] font-semibold bg-brand-600 text-white px-1.5 py-0.5 rounded-full">
                      {moreDetailsFilled}
                    </span>
                  )}
                </div>
                {showMoreDetails
                  ? <ChevronUp size={15} className="text-slate-400" />
                  : <ChevronDown size={15} className="text-slate-400" />}
              </button>
              {showMoreDetails && (
                <div className="p-4 space-y-4 border-t border-slate-200 bg-white">
                  <div>
                    <label className="form-label">Customer Name</label>
                    <input type="text" value={form.customerName}
                      onChange={e => handleChange('customerName', e.target.value)}
                      placeholder="Full name of the customer"
                      className={`form-input ${errors.customerName ? 'border-red-300' : ''}`} />
                    {errors.customerName && <p className="form-error">{errors.customerName}</p>}
                  </div>
                  <div>
                    <label className="form-label">Manufacturer <span className="text-slate-400 font-normal">(auto-filled)</span></label>
                    <input type="text" value={form.manufacturerName} readOnly
                      className="form-input bg-slate-50 text-slate-500 cursor-not-allowed"
                      placeholder="Auto-filled from product" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Unit Cost <span className="text-slate-400 font-normal">(auto-filled)</span></label>
                      <input type="text" value={form.unitCostUSD > 0 ? formatCurrency(form.unitCostUSD) : ''} readOnly
                        className="form-input bg-slate-50 text-slate-500 cursor-not-allowed"
                        placeholder="Auto-filled from product" />
                    </div>
                    <div>
                      <label className="form-label">Manufacturer Number</label>
                      {selectedProduct && selectedProduct.manufacturerNumbers.length > 0 ? (
                        <select value={form.manufacturerNumber}
                          onChange={e => handleChange('manufacturerNumber', e.target.value)}
                          className="form-input">
                          <option value="">Select manufacturer number…</option>
                          {selectedProduct.manufacturerNumbers.map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" value={form.manufacturerNumber}
                          onChange={e => handleChange('manufacturerNumber', e.target.value)}
                          placeholder="Enter manufacturer number" className="form-input" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Fault Notes</label>
                    <textarea value={form.faultNotes}
                      onChange={e => handleChange('faultNotes', e.target.value)}
                      rows={3}
                      placeholder="Describe the fault in detail…"
                      className="form-input resize-none" />
                  </div>
                  <div>
                    <label className="form-label">Submitted By</label>
                    <input type="text" value={form.submittedBy}
                      onChange={e => handleChange('submittedBy', e.target.value)}
                      placeholder="Your name (optional)" className="form-input" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Evidence Upload (shared across both modes) ── */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-1 pb-2 border-b border-slate-100">
            Evidence Upload <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Upload photos, videos (MP4, MOV, AVI), or PDFs of the fault. Max 50MB.
          </p>
          <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-brand-600 bg-brand-50'
                  : errors.file
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50'
              }`}
            >
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Upload size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                {uploading ? 'Uploading…' : uploadedFiles.length > 0 ? 'Add more files' : 'Drop files here or click to browse'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Images, MP4, PDF · Max 50MB each · Multiple allowed</p>
              {uploading && (
                <div className="mt-3">
                  <div className="w-32 h-1 bg-slate-200 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full animate-pulse" style={{ width: '70%' }} />
                  </div>
                  <p className="text-xs text-brand-600 mt-1">Uploading to Google Drive…</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.mov,.mp4,.avi,.wmv,.mkv,.pdf"
                multiple
                className="hidden"
                onChange={e => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          {errors.file && (
            <div className="flex items-center gap-2 mt-2">
              <AlertCircle size={14} className="text-red-500" />
              <p className="form-error mt-0">{errors.file}</p>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2 mt-3">
              {uploadedFiles.map((uf, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {uf.previewUrl
                      ? <img src={uf.previewUrl} alt="" className="w-9 h-9 object-cover rounded-lg" />
                      : uf.fileType?.startsWith('video/')
                      ? <span className="text-lg">🎬</span>
                      : uf.fileType === 'application/pdf'
                      ? <span className="text-lg">📄</span>
                      : <CheckCircle size={18} className="text-emerald-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800 truncate">{uf.name}</p>
                    <a href={uf.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:underline">
                      View in Google Drive
                    </a>
                  </div>
                  <button type="button"
                    onClick={() => {
                      setUploadedFiles(prev => {
                        const updated = prev.filter((_, i) => i !== idx);
                        setForm(f => ({ ...f, evidenceLink: updated.map(u => u.link).join(',') }));
                        return updated;
                      });
                    }}
                    className="text-emerald-500 hover:text-emerald-700 p-1 flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit error */}
        {(errors as any).submit && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{(errors as any).submit}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pb-4">
          <Link href="/cases" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={submitting || uploading} className="btn-primary px-8">
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </>
            ) : 'Submit Case'}
          </button>
        </div>
      </form>
    </div>
  );
}
