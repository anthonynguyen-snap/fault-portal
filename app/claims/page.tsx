'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,

  TrendingUp,  Clock,  FileCheck,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import { Claim, ClaimStatus, FaultCase } from '@/types';
import { formatCurrency, STATUS_STYLES, STATUS_DOT, CLAIM_STATUSES } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2].map(String);

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [cases, setCases] = useState<FaultCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [formData, setFormData] = useState<Partial<Claim>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [claimsRes, casesRes] = await Promise.all([
        fetch('/api/claims'),
        fetch('/api/cases'),
      ]);
      const claimsJson = await claimsRes.json();
      if (claimsJson.error) throw new Error(claimsJson.error);
      setClaims(claimsJson.data || []);
      const casesJson = await casesRes.json();
      setCases(casesJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadClaims() {
    try {
      const res = await fetch('/api/claims');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setClaims(json.data || []);
    } catch { /* silent */ }
  }

  // Unique manufacturers derived from actual fault cases
  const manufacturers = useMemo(() => {
    const names = new Set(cases.map(c => c.manufacturerName).filter(Boolean));
    return Array.from(names).sort();
  }, [cases]);

  // Auto-calculate matching cases for selected manufacturer + month + year
  const matchingCases = useMemo(() => {
    if (!formData.manufacturer || !formData.month || !formData.year) return [];
    const targetMonthIndex = MONTHS.indexOf(formData.month); // 0-based
    const targetYear = parseInt(formData.year);
    return cases.filter(c => {
      if (c.manufacturerName !== formData.manufacturer) return false;
      try {
        // Parse as local date by appending T00:00:00 (no Z) so JS treats it as local time
        const dateStr = c.date.includes('T') ? c.date : c.date + 'T00:00:00';
        const d = new Date(dateStr);
        return d.getMonth() === targetMonthIndex && d.getFullYear() === targetYear;
      } catch { return false; }
    });
  }, [cases, formData.manufacturer, formData.month, formData.year]);

  // Totals
  const totals = useMemo(() => ({
    claimRaised:    claims.filter(c => c.status === 'Claim Raised').length,
    acknowledged:   claims.filter(c => c.status === 'Acknowledged').length,
    totalFaults:    claims.reduce((s, c) => s + c.faultCount, 0),
    creditReceived: claims.filter(c => c.status === 'Credit Received').length,
  }), [claims]);

  // Group claims by manufacturer then year+month
  const grouped = useMemo(() => {
    const byMfr: Record<string, Claim[]> = {};
    for (const c of claims) {
      const key = c.manufacturer || 'Unknown';
      if (!byMfr[key]) byMfr[key] = [];
      byMfr[key].push(c);
    }
    return byMfr;
  }, [claims]);

  function openNew() {
    setEditingClaim(null);
    setFormData({
      manufacturer: '',
      month: MONTHS[new Date().getMonth()],
      year: String(currentYear),
      status: 'Claim Raised',
      notes: '',
      caseIds: [],
    });
    setSaveError('');
    setShowModal(true);
  }

  function openEdit(claim: Claim) {
    setEditingClaim(claim);
    setFormData({ ...claim });
    setSaveError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.manufacturer) { setSaveError('Please select a manufacturer.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const method = editingClaim ? 'PATCH' : 'POST';
      // For new claims, inject auto-calculated values from matching cases
      const autoFields = !editingClaim ? {
        faultCount: matchingCases.length,
        costAtRisk: matchingCases.reduce((s, c) => s + c.unitCostUSD, 0),
        caseIds: matchingCases.map(c => c.id),
      } : {};
      const body = editingClaim
        ? { ...formData, id: editingClaim.id }
        : { ...formData, ...autoFields };

      const res = await fetch('/api/claims', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setShowModal(false);
      await loadClaims();
      success(editingClaim ? 'Claim updated' : 'Claim batch created', editingClaim ? 'Changes saved successfully.' : `Batch for ${formData.manufacturer} logged.`);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save. Please try again.');
      toastError('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(claim: Claim, status: ClaimStatus) {
    try {
      await fetch('/api/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: claim.id, status }),
      });
      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status } : c));
    } catch {
      // Silent fail — user can retry
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="card p-5 space-y-3"><div className="h-3 w-24 bg-slate-200 rounded animate-pulse" /><div className="h-8 w-12 bg-slate-200 rounded animate-pulse" /></div>)}
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Claims</h1>
          <p className="page-subtitle">Track manufacturer claims, recovery status, and credit received</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={15} />
          New Claim Batch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Claim Raised',         value: totals.claimRaised,    icon: Clock,       color: 'bg-amber-500' },
          { label: 'Acknowledged',          value: totals.acknowledged,   icon: FileCheck,   color: 'bg-blue-500' },
          { label: 'Total Fault Items',     value: totals.totalFaults,    icon: TrendingUp,  color: 'bg-brand-600' },
          { label: 'Claims Fully Resolved', value: totals.creditReceived, icon: CheckCircle, color: 'bg-violet-600' },
        ].map(card => (
          <div key={card.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon size={18} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Claims by Manufacturer */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState
            icon={FileCheck}
            title="No claim batches yet"
            description="Create your first batch to start tracking manufacturer claims and recoveries."
            action={{ label: 'New Claim Batch', onClick: openNew }}
          />
        </div>
      ) : (
        Object.entries(grouped).map(([manufacturer, mfrClaims]) => (
          <div key={manufacturer} className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">{manufacturer}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{mfrClaims.length} batch{mfrClaims.length !== 1 ? 'es' : ''}</span>
                <span>{mfrClaims.reduce((s, c) => s + c.faultCount, 0)} faults</span>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Faults</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mfrClaims.map(claim => {
                  return (
                    <tr key={claim.id}>
                      <td className="font-medium whitespace-nowrap">
                        {claim.month} {claim.year}
                      </td>
                      <td>
                        <span className="font-semibold">{claim.faultCount}</span> items
                      </td>
                      <td>
                        <select
                          value={claim.status}
                          onChange={e => updateStatus(claim, e.target.value as ClaimStatus)}
                          className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_STYLES[claim.status]}`}
                        >
                          {CLAIM_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-slate-500 max-w-[200px]">
                        <span className="text-xs line-clamp-2">{claim.notes || '—'}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => openEdit(claim)}
                          className="text-xs text-brand-600 hover:underline font-medium"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {editingClaim ? 'Edit Claim Batch' : 'New Claim Batch'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Manufacturer</label>
                <select
                  value={formData.manufacturer || ''}
                  onChange={e => setFormData(f => ({ ...f, manufacturer: e.target.value }))}
                  className="form-input"
                >
                  <option value="">Select manufacturer…</option>
                  {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Month</label>
                  <select value={formData.month || ''} onChange={e => setFormData(f => ({...f, month: e.target.value}))} className="form-input">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Year</label>
                  <select value={formData.year || ''} onChange={e => setFormData(f => ({...f, year: e.target.value}))} className="form-input">
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {/* Auto-calculated preview */}
              {!editingClaim && formData.manufacturer && (
                <div className={`rounded-xl p-4 border ${matchingCases.length > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  {matchingCases.length > 0 ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">
                          {matchingCases.length} fault{matchingCases.length !== 1 ? 's' : ''} found
                        </p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          {formData.manufacturer} · {formData.month} {formData.year}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-800">
                          {formatCurrency(matchingCases.reduce((s, c) => s + c.unitCostUSD, 0))}
                        </p>
                        <p className="text-xs text-emerald-600">cost at risk</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center">
                      No fault cases found for {formData.manufacturer} in {formData.month} {formData.year}
                    </p>
                  )}
                </div>
              )}


              <div>
                <label className="form-label">Status</label>
                <select value={formData.status || 'Unsubmitted'} onChange={e => setFormData(f => ({...f, status: e.target.value as ClaimStatus}))} className="form-input">
                  {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Notes</label>
                <textarea value={formData.notes || ''} onChange={e => setFormData(f => ({...f, notes: e.target.value}))} rows={3} className="form-input resize-none" placeholder="Reference numbers, contacts, follow-up dates…" />
              </div>

              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={14} className="text-red-500" />
                  <p className="text-xs text-red-700">{saveError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : editingClaim ? 'Save Changes' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
