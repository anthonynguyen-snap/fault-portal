'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ExternalLink,
  Edit2,
  Calendar,
  Package,
  User,
  Building2,
  AlertTriangle,
  DollarSign,
  FileText,
  Hash,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { FaultCase, ClaimStatus } from '@/types';
import { formatCurrency, formatDate, formatDateTime, STATUS_STYLES, STATUS_DOT, CLAIM_STATUSES } from '@/lib/utils';

function InfoRow({ icon: Icon, label, value, href }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-0.5">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
            {value} <ExternalLink size={12} />
          </a>
        ) : (
          <p className="text-sm font-medium text-slate-900">{value || '—'}</p>
        )}
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [caseData, setCaseData] = useState<FaultCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<FaultCase>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setCaseData(json.data);
        setEditForm(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!caseData) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCaseData(json.data);
      setEditForm(json.data);
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="text-center py-20">
        <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-900 font-semibold">Case not found</p>
        <p className="text-slate-500 text-sm mt-1 mb-4">{error}</p>
        <Link href="/cases" className="btn-primary">Back to Cases</Link>
      </div>
    );
  }

  const c = caseData;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/cases" className="btn-ghost -ml-2 mb-3 inline-flex">
          <ChevronLeft size={16} /> Back to Cases
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="page-title">{c.orderNumber}</h1>
              <span className={`badge ${STATUS_STYLES[c.claimStatus]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                {c.claimStatus}
              </span>
            </div>
            <p className="page-subtitle">
              Submitted {formatDateTime(c.createdAt)}
              {c.submittedBy && ` by ${c.submittedBy}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                <CheckCircle size={14} /> Saved
              </div>
            )}
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setEditForm(c); }} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="btn-secondary">
                <Edit2 size={14} /> Edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Case Info */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Case Information</h2>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Date</label>
                    <input type="date" value={editForm.date || ''} onChange={e => setEditForm(f => ({...f, date: e.target.value}))} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Order Number</label>
                    <input type="text" value={editForm.orderNumber || ''} onChange={e => setEditForm(f => ({...f, orderNumber: e.target.value}))} className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Customer Name</label>
                  <input type="text" value={editForm.customerName || ''} onChange={e => setEditForm(f => ({...f, customerName: e.target.value}))} className="form-input" />
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={Calendar}   label="Date"         value={formatDate(c.date)} />
                <InfoRow icon={Hash}       label="Order Number" value={c.orderNumber} />
                <InfoRow icon={User}       label="Customer"     value={c.customerName} />
                <InfoRow icon={Clock}      label="Submitted"    value={formatDateTime(c.createdAt)} />
              </>
            )}
          </div>

          {/* Product Info */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Product Information</h2>
            <InfoRow icon={Package}   label="Product"              value={c.product} />
            <InfoRow icon={Building2} label="Manufacturer"         value={c.manufacturerName} />
            <InfoRow icon={Hash}      label="Manufacturer Number"  value={c.manufacturerNumber || '—'} />
            <InfoRow icon={DollarSign} label="Unit Cost"           value={formatCurrency(c.unitCostUSD)} />
          </div>

          {/* Fault Details */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Fault Details</h2>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="form-label">Fault Type</label>
                  <input type="text" value={editForm.faultType || ''} onChange={e => setEditForm(f => ({...f, faultType: e.target.value}))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Fault Notes</label>
                  <textarea value={editForm.faultNotes || ''} onChange={e => setEditForm(f => ({...f, faultNotes: e.target.value}))} rows={4} className="form-input resize-none" />
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={AlertTriangle} label="Fault Type" value={c.faultType} />
                {c.faultNotes && (
                  <div className="pt-3">
                    <p className="text-xs text-slate-400 mb-1.5">Notes</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{c.faultNotes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Evidence */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Evidence</h2>
            {c.evidenceLink ? (
              <div className="space-y-2">
                {c.evidenceLink.split(',').filter(Boolean).map((link, idx, arr) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {arr.length > 1 ? `Evidence File ${idx + 1}` : 'Evidence File'}
                      </p>
                      <p className="text-xs text-slate-400">Stored in Google Drive</p>
                    </div>
                    <a
                      href={link.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      View <ExternalLink size={11} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No evidence uploaded.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Claim Status */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Claim Status</h2>
            {editing ? (
              <select
                value={editForm.claimStatus || c.claimStatus}
                onChange={e => setEditForm(f => ({...f, claimStatus: e.target.value as ClaimStatus}))}
                className="form-input"
              >
                {CLAIM_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                {CLAIM_STATUSES.map(s => (
                  <div
                    key={s}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      c.claimStatus === s
                        ? STATUS_STYLES[s] + ' ring-1 ring-current ring-opacity-20'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.claimStatus === s ? STATUS_DOT[s] : 'bg-slate-200'}`} />
                    {s}
                    {c.claimStatus === s && (
                      <CheckCircle size={13} className="ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Cost at Risk</h2>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(c.unitCostUSD)}</p>
            <p className="text-xs text-slate-400 mt-1">Unit cost for this product</p>
          </div>

          {/* Case ID */}
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">Case ID</p>
            <p className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1.5 rounded break-all">{c.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
