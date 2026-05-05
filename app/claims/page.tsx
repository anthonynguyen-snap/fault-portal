'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Clock,
  FileCheck,
  AlertCircle,
  CheckCircle,
  X,
  DollarSign,
  BarChart2,
  CircleDot,
} from 'lucide-react';
import { Claim, ClaimStatus, FaultCase } from '@/types';
import { formatCurrency, STATUS_STYLES, STATUS_DOT, CLAIM_STATUSES } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2].map(String);

// Statuses that represent a terminal outcome — trigger the outcome modal
const OUTCOME_STATUSES: ClaimStatus[] = ['Credit Received', 'Partial Credit', 'Rejected'];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [cases, setCases] = useState<FaultCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [formData, setFormData] = useState<Partial<Claim>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Record Outcome modal
  const [outcomeTarget, setOutcomeTarget] = useState<{ claim: Claim; status: ClaimStatus } | null>(null);
  const [outcomeForm, setOutcomeForm] = useState<{ amountRecovered: string; outcomeDate: string; outcomeNotes: string }>({
    amountRecovered: '',
    outcomeDate: new Date().toISOString().slice(0, 10),
    outcomeNotes: '',
  });
  const [savingOutcome, setSavingOutcome] = useState(false);

  // Expanded rows (show outcome details inline)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
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

  const manufacturers = useMemo(() => {
    const names = new Set(cases.map(c => c.manufacturerName).filter(Boolean));
    return Array.from(names).sort();
  }, [cases]);

  const matchingCases = useMemo(() => {
    if (!formData.manufacturer || !formData.month || !formData.year) return [];
    const targetMonthIndex = MONTHS.indexOf(formData.month);
    const targetYear = parseInt(formData.year);
    return cases.filter(c => {
      if (c.manufacturerName !== formData.manufacturer) return false;
      try {
        const dateStr = c.date.includes('T') ? c.date : c.date + 'T00:00:00';
        const d = new Date(dateStr);
        return d.getMonth() === targetMonthIndex && d.getFullYear() === targetYear;
      } catch { return false; }
    });
  }, [cases, formData.manufacturer, formData.month, formData.year]);

  // ── Recovery stats ─────────────────────────────────────────────────────────
  const recoveryStats = useMemo(() => {
    const totalAtRisk   = claims.reduce((s, c) => s + c.costAtRisk, 0);
    const totalRecovered = claims
      .filter(c => c.status === 'Credit Received' || c.status === 'Partial Credit')
      .reduce((s, c) => s + c.amountRecovered, 0);
    const openAtRisk = claims
      .filter(c => !OUTCOME_STATUSES.includes(c.status))
      .reduce((s, c) => s + c.costAtRisk, 0);
    const rate = totalAtRisk > 0 ? Math.round((totalRecovered / totalAtRisk) * 100) : 0;
    return { totalAtRisk, totalRecovered, openAtRisk, rate };
  }, [claims]);

  const totals = useMemo(() => ({
    claimRaised:    claims.filter(c => c.status === 'Claim Raised').length,
    acknowledged:   claims.filter(c => c.status === 'Acknowledged').length,
    totalFaults:    claims.reduce((s, c) => s + c.faultCount, 0),
    resolved:       claims.filter(c => OUTCOME_STATUSES.includes(c.status)).length,
  }), [claims]);

  const grouped = useMemo(() => {
    const byMfr: Record<string, Claim[]> = {};
    for (const c of claims) {
      const key = c.manufacturer || 'Unknown';
      if (!byMfr[key]) byMfr[key] = [];
      byMfr[key].push(c);
    }
    return byMfr;
  }, [claims]);

  // ── Create / edit modal ────────────────────────────────────────────────────
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
      success(
        editingClaim ? 'Claim updated' : 'Claim batch created',
        editingClaim ? 'Changes saved successfully.' : `Batch for ${formData.manufacturer} logged.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setSaveError(msg);
      toastError('Save failed', msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Status dropdown change ─────────────────────────────────────────────────
  function handleStatusChange(claim: Claim, status: ClaimStatus) {
    if (OUTCOME_STATUSES.includes(status)) {
      // Pre-fill amount: full cost for Credit Received, 0 for Rejected
      const defaultAmount = status === 'Credit Received'
        ? String(claim.costAtRisk)
        : status === 'Partial Credit'
          ? ''
          : '0';
      setOutcomeForm({
        amountRecovered: defaultAmount,
        outcomeDate: new Date().toISOString().slice(0, 10),
        outcomeNotes: '',
      });
      setOutcomeTarget({ claim, status });
    } else {
      applyStatusOnly(claim, status);
    }
  }

  async function applyStatusOnly(claim: Claim, status: ClaimStatus) {
    try {
      await fetch('/api/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: claim.id, status }),
      });
      setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status } : c));
    } catch { /* silent */ }
  }

  // ── Record Outcome save ────────────────────────────────────────────────────
  async function handleOutcomeSave() {
    if (!outcomeTarget) return;
    setSavingOutcome(true);
    try {
      const payload = {
        id: outcomeTarget.claim.id,
        status: outcomeTarget.status,
        amountRecovered: parseFloat(outcomeForm.amountRecovered) || 0,
        outcomeDate: outcomeForm.outcomeDate,
        outcomeNotes: outcomeForm.outcomeNotes,
      };
      const res = await fetch('/api/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setClaims(prev => prev.map(c =>
        c.id === outcomeTarget.claim.id ? { ...c, ...payload } : c
      ));
      setOutcomeTarget(null);
      success('Outcome recorded', `${outcomeTarget.status} logged for ${outcomeTarget.claim.manufacturer}.`);
    } catch (err: unknown) {
      toastError('Failed to save outcome', err instanceof Error ? err.message : '');
    } finally {
      setSavingOutcome(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <PageSkeleton cols={5} rows={6} showStats statCount={4} showSearch={false} />;

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
          { label: 'Claim Raised',    value: totals.claimRaised,  icon: Clock,       color: 'bg-amber-500' },
          { label: 'Acknowledged',    value: totals.acknowledged, icon: FileCheck,   color: 'bg-blue-500' },
          { label: 'Total Faults',    value: totals.totalFaults,  icon: TrendingUp,  color: 'bg-brand-600' },
          { label: 'Outcome Recorded',value: totals.resolved,     icon: CheckCircle, color: 'bg-violet-600' },
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

      {/* Recovery Rate Strip */}
      {claims.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-brand-600" />
            <span className="text-sm font-semibold text-slate-700">Recovery Summary</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total at Risk</p>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{formatCurrency(recoveryStats.totalAtRisk)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Recovered</p>
              <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">{formatCurrency(recoveryStats.totalRecovered)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Still Open</p>
              <p className="text-xl font-bold text-amber-700 mt-1 font-mono">{formatCurrency(recoveryStats.openAtRisk)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Recovery Rate</p>
              <div className="flex items-end gap-2 mt-1">
                <p className="text-xl font-bold text-slate-900 font-mono">{recoveryStats.rate}%</p>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(recoveryStats.rate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

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
        Object.entries(grouped).map(([manufacturer, mfrClaims]) => {
          const mfrAtRisk    = mfrClaims.reduce((s, c) => s + c.costAtRisk, 0);
          const mfrRecovered = mfrClaims
            .filter(c => c.status === 'Credit Received' || c.status === 'Partial Credit')
            .reduce((s, c) => s + c.amountRecovered, 0);
          return (
            <div key={manufacturer} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">{manufacturer}</h2>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{mfrClaims.length} batch{mfrClaims.length !== 1 ? 'es' : ''}</span>
                  <span>{mfrClaims.reduce((s, c) => s + c.faultCount, 0)} faults</span>
                  <span className="font-mono">{formatCurrency(mfrAtRisk)} at risk</span>
                  {mfrRecovered > 0 && (
                    <span className="text-emerald-600 font-mono font-semibold">{formatCurrency(mfrRecovered)} recovered</span>
                  )}
                </div>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Faults</th>
                    <th>Cost at Risk</th>
                    <th>Status</th>
                    <th>Recovered</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mfrClaims.map(claim => {
                    const isResolved = OUTCOME_STATUSES.includes(claim.status);
                    const isExpanded = expanded.has(claim.id);
                    return (
                      <>
                        <tr key={claim.id}>
                          <td className="font-medium font-mono whitespace-nowrap">
                            {claim.month} {claim.year}
                          </td>
                          <td>
                            <span className="font-semibold font-mono">{claim.faultCount}</span>
                            <span className="text-slate-400 text-xs ml-1">items</span>
                          </td>
                          <td className="font-mono text-slate-700">{formatCurrency(claim.costAtRisk)}</td>
                          <td>
                            <select
                              value={claim.status}
                              onChange={e => handleStatusChange(claim, e.target.value as ClaimStatus)}
                              className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_STYLES[claim.status]}`}
                            >
                              {CLAIM_STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="font-mono">
                            {isResolved ? (
                              <span className={claim.amountRecovered > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                                {claim.amountRecovered > 0 ? formatCurrency(claim.amountRecovered) : '—'}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">pending</span>
                            )}
                          </td>
                          <td className="text-slate-500 max-w-[180px]">
                            <span className="text-xs line-clamp-2">{claim.notes || '—'}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(claim)}
                                className="text-xs text-brand-600 hover:underline font-medium"
                              >
                                Edit
                              </button>
                              {isResolved && (claim.outcomeDate || claim.outcomeNotes) && (
                                <button
                                  onClick={() => toggleExpand(claim.id)}
                                  className="text-slate-400 hover:text-slate-600"
                                  title="Show outcome details"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Outcome detail row */}
                        {isExpanded && (
                          <tr key={`${claim.id}-outcome`} className="bg-slate-50">
                            <td colSpan={7} className="px-5 py-3">
                              <div className="flex items-start gap-6 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <CircleDot size={12} className={
                                    claim.status === 'Credit Received' ? 'text-emerald-500' :
                                    claim.status === 'Partial Credit'  ? 'text-teal-500' : 'text-red-500'
                                  } />
                                  <span className={`font-semibold ${STATUS_STYLES[claim.status]} px-2 py-0.5 rounded-full`}>
                                    {claim.status}
                                  </span>
                                </div>
                                {claim.outcomeDate && (
                                  <div>
                                    <span className="text-slate-400">Outcome date: </span>
                                    <span className="text-slate-700 font-medium">{fmtDate(claim.outcomeDate)}</span>
                                  </div>
                                )}
                                {claim.outcomeNotes && (
                                  <div className="flex-1">
                                    <span className="text-slate-400">Notes: </span>
                                    <span className="text-slate-700">{claim.outcomeNotes}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {/* Create / Edit Modal */}
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
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData(f => ({...f, notes: e.target.value}))}
                  rows={3}
                  className="form-input resize-none"
                  placeholder="Reference numbers, contacts, follow-up dates…"
                />
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

      {/* Record Outcome Modal */}
      {outcomeTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Record Outcome</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {outcomeTarget.claim.manufacturer} · {outcomeTarget.claim.month} {outcomeTarget.claim.year}
                </p>
              </div>
              <button onClick={() => setOutcomeTarget(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Outcome:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLES[outcomeTarget.status]}`}>
                  {outcomeTarget.status}
                </span>
              </div>

              {/* Cost at risk reference */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                <span className="text-slate-500">Cost at risk</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatCurrency(outcomeTarget.claim.costAtRisk)}
                </span>
              </div>

              {/* Amount recovered */}
              {outcomeTarget.status !== 'Rejected' && (
                <div>
                  <label className="form-label">Amount Recovered</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={outcomeForm.amountRecovered}
                      onChange={e => setOutcomeForm(f => ({ ...f, amountRecovered: e.target.value }))}
                      className="form-input pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  {outcomeTarget.status === 'Partial Credit' && outcomeForm.amountRecovered && outcomeTarget.claim.costAtRisk > 0 && (
                    <p className="text-xs text-teal-600 mt-1">
                      {Math.round((parseFloat(outcomeForm.amountRecovered) / outcomeTarget.claim.costAtRisk) * 100)}% of cost at risk recovered
                    </p>
                  )}
                </div>
              )}

              {/* Outcome date */}
              <div>
                <label className="form-label">Outcome Date</label>
                <input
                  type="date"
                  value={outcomeForm.outcomeDate}
                  onChange={e => setOutcomeForm(f => ({ ...f, outcomeDate: e.target.value }))}
                  className="form-input"
                />
              </div>

              {/* Outcome notes */}
              <div>
                <label className="form-label">
                  {outcomeTarget.status === 'Rejected' ? 'Rejection reason' : 'Notes'}
                </label>
                <textarea
                  value={outcomeForm.outcomeNotes}
                  onChange={e => setOutcomeForm(f => ({ ...f, outcomeNotes: e.target.value }))}
                  rows={3}
                  className="form-input resize-none"
                  placeholder={
                    outcomeTarget.status === 'Rejected'
                      ? 'Reason given by manufacturer…'
                      : outcomeTarget.status === 'Partial Credit'
                        ? 'What was disputed or adjusted…'
                        : 'Credit note reference, timeline…'
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setOutcomeTarget(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleOutcomeSave} disabled={savingOutcome} className="btn-primary">
                {savingOutcome ? 'Saving…' : 'Save Outcome'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
