'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import { Claim, ClaimStatus } from '@/types';
import { formatCurrency, STATUS_STYLES, STATUS_DOT, CLAIM_STATUSES } from '@/lib/utils';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2].map(String);

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [formData, setFormData] = useState<Partial<Claim>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => { loadClaims(); }, []);

  async function loadClaims() {
    setLoading(true);
    try {
      const res = await fetch('/api/claims');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setClaims(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Totals
  const totals = useMemo(() => ({
    totalCostAtRisk:      claims.reduce((s, c) => s + c.costAtRisk, 0),
    totalAmountRecovered: claims.reduce((s, c) => s + c.amountRecovered, 0),
    totalFaults:          claims.reduce((s, c) => s + c.faultCount, 0),
    creditReceived:       claims.filter(c => c.status === 'Credit Received').length,
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
      faultCount: 0,
      costAtRisk: 0,
      amountRecovered: 0,
      status: 'Unsubmitted',
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
    setSaving(true);
    setSaveError('');
    try {
      const method = editingClaim ? 'PATCH' : 'POST';
      const body = editingClaim ? { ...formData, id: editingClaim.id } : formData;

      const res = await fetch('/api/claims', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setShowModal(false);
      await loadClaims();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save. Please try again.');
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
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
          { label: 'Total Cost at Risk',    value: formatCurrency(totals.totalCostAtRisk),      icon: AlertCircle, color: 'bg-red-500' },
          { label: 'Amount Recovered',      value: formatCurrency(totals.totalAmountRecovered), icon: DollarSign,  color: 'bg-emerald-500' },
          { label: 'Total Fault Items',     value: totals.totalFaults,                          icon: TrendingUp,  color: 'bg-brand-600' },
          { label: 'Claims Fully Resolved', value: totals.creditReceived,                       icon: CheckCircle, color: 'bg-violet-600' },
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
        <div className="card p-12 text-center">
          <p className="text-slate-400 text-sm">No claim batches yet. Click "New Claim Batch" to get started.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([manufacturer, mfrClaims]) => (
          <div key={manufacturer} className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">{manufacturer}</h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{mfrClaims.length} batch{mfrClaims.length !== 1 ? 'es' : ''}</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(mfrClaims.reduce((s, c) => s + c.costAtRisk, 0))} at risk
                </span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(mfrClaims.reduce((s, c) => s + c.amountRecovered, 0))} recovered
                </span>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Faults</th>
                  <th>Cost at Risk</th>
                  <th>Recovered</th>
                  <th>Recovery %</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mfrClaims.map(claim => {
                  const recoveryPct = claim.costAtRisk > 0
                    ? Math.round((claim.amountRecovered / claim.costAtRisk) * 100)
                    : 0;
                  return (
                    <tr key={claim.id}>
                      <td className="font-medium whitespace-nowrap">
                        {claim.month} {claim.year}
                      </td>
                      <td>
                        <span className="font-semibold">{claim.faultCount}</span> items
                      </td>
                      <td className="font-semibold text-red-600">
                        {formatCurrency(claim.costAtRisk)}
                      </td>
                      <td className="font-semibold text-emerald-600">
                        {formatCurrency(claim.amountRecovered)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full ${recoveryPct === 100 ? 'bg-emerald-500' : recoveryPct > 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(recoveryPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{recoveryPct}%</span>
                        </div>
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
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className="form-label">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer || ''}
                    onChange={e => setFormData(f => ({...f, manufacturer: e.target.value}))}
                    className="form-input"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
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
                <div>
                  <label className="form-label">Fault Count</label>
                  <input type="number" value={formData.faultCount || ''} onChange={e => setFormData(f => ({...f, faultCount: parseInt(e.target.value)||0}))} className="form-input" min={0} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Cost at Risk (USD)</label>
                  <input type="number" step="0.01" value={formData.costAtRisk || ''} onChange={e => setFormData(f => ({...f, costAtRisk: parseFloat(e.target.value)||0}))} className="form-input" min={0} />
                </div>
                <div>
                  <label className="form-label">Amount Recovered (USD)</label>
                  <input type="number" step="0.01" value={formData.amountRecovered || ''} onChange={e => setFormData(f => ({...f, amountRecovered: parseFloat(e.target.value)||0}))} className="form-input" min={0} />
                </div>
              </div>

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
