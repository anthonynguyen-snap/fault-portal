'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trash2, Edit2, Check, X, Plus, RefreshCw } from 'lucide-react';
import { RosterAgent, RosterLeave, LeaveType } from '@/types';
import { useToast } from '@/components/ui/Toast';

const LEAVE_LABELS: Record<LeaveType, string>  = { sick: 'Sick', makeup: 'Make-up', other: 'Other' };
const LEAVE_BADGE: Record<LeaveType, string> = {
  sick:   'bg-red-100 text-red-700',
  makeup: 'bg-amber-100 text-amber-700',
  other:  'bg-slate-100 text-slate-600',
};

function fmt(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LeavePage() {
  const { addToast } = useToast();

  const [agents, setAgents]   = useState<RosterAgent[]>([]);
  const [records, setRecords] = useState<RosterLeave[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAgent, setFilterAgent] = useState('');
  const [filterType,  setFilterType]  = useState<LeaveType | ''>('');
  const [filterFrom,  setFilterFrom]  = useState('');
  const [filterTo,    setFilterTo]    = useState('');

  // Add leave modal
  const [showAdd,      setShowAdd]      = useState(false);
  const [addAgent,     setAddAgent]     = useState('');
  const [addDate,      setAddDate]      = useState('');
  const [addType,      setAddType]      = useState<LeaveType>('sick');
  const [addNotes,     setAddNotes]     = useState('');
  const [addHoursOwed, setAddHoursOwed] = useState('');
  const [saving,       setSaving]       = useState(false);

  // Inline edit
  const [editId,     setEditId]     = useState<string | null>(null);
  const [editNotes,  setEditNotes]  = useState('');
  const [editType,   setEditType]   = useState<LeaveType>('sick');
  const [editHoursOwed,      setEditHoursOwed]      = useState('');
  const [editHoursCompleted, setEditHoursCompleted] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [agentRes, leaveRes] = await Promise.all([
        fetch('/api/roster/agents'),
        fetch('/api/roster/leave'),
      ]);
      const agentData = await agentRes.json();
      const leaveData = await leaveRes.json();
      setAgents(agentData.data ?? []);
      setRecords(leaveData.data ?? []);
    } catch {
      addToast('Failed to load leave records', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterAgent && r.agentId !== filterAgent) return false;
      if (filterType  && r.leaveType !== filterType)  return false;
      if (filterFrom  && r.date < filterFrom)          return false;
      if (filterTo    && r.date > filterTo)             return false;
      return true;
    });
  }, [records, filterAgent, filterType, filterFrom, filterTo]);

  // Make-up summary for selected agent (or all)
  const makeupSummary = useMemo(() => {
    const relevant = filterAgent
      ? records.filter(r => r.agentId === filterAgent && r.leaveType === 'makeup')
      : records.filter(r => r.leaveType === 'makeup');
    const owed      = relevant.reduce((s, r) => s + r.hoursOwed, 0);
    const completed = relevant.reduce((s, r) => s + r.hoursCompleted, 0);
    return { owed, completed, remaining: Math.max(0, owed - completed) };
  }, [records, filterAgent]);

  async function handleAdd() {
    if (!addAgent || !addDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roster/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId:   addAgent,
          date:      addDate,
          leaveType: addType,
          notes:     addNotes,
          hoursOwed:      addType === 'makeup' ? Number(addHoursOwed) || 0 : 0,
          hoursCompleted: 0,
        }),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setRecords(prev => [data, ...prev].sort((a,b) => b.date.localeCompare(a.date)));
      setShowAdd(false);
      setAddAgent(''); setAddDate(''); setAddType('sick'); setAddNotes(''); setAddHoursOwed('');
      addToast('Leave record added', 'success');
    } catch {
      addToast('Failed to add leave record', 'error');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: RosterLeave) {
    setEditId(r.id);
    setEditType(r.leaveType);
    setEditNotes(r.notes);
    setEditHoursOwed(String(r.hoursOwed));
    setEditHoursCompleted(String(r.hoursCompleted));
  }

  async function handleEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/roster/leave/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType:      editType,
          notes:          editNotes,
          hoursOwed:      Number(editHoursOwed) || 0,
          hoursCompleted: Number(editHoursCompleted) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      setRecords(prev => prev.map(r => r.id === editId
        ? { ...r, leaveType: editType, notes: editNotes, hoursOwed: Number(editHoursOwed)||0, hoursCompleted: Number(editHoursCompleted)||0 }
        : r
      ));
      setEditId(null);
      addToast('Leave record updated', 'success');
    } catch {
      addToast('Failed to update leave record', 'error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/roster/leave/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRecords(prev => prev.filter(r => r.id !== id));
      setDeleteId(null);
      addToast('Leave record deleted', 'success');
    } catch {
      addToast('Failed to delete leave record', 'error');
    }
  }

  const agentMap = useMemo(() => Object.fromEntries(agents.map(a => [a.id, a])), [agents]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/roster" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Leave Log</h1>
              <p className="text-xs text-slate-500">All leave records — sick, make-up &amp; other</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus size={15} />
              Add Leave
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Make-up hours summary */}
        {makeupSummary.owed > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-6">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Make-up Hours</p>
              <p className="text-xs text-amber-600 mt-0.5">{filterAgent ? (agentMap[filterAgent]?.name ?? 'Selected agent') : 'All agents'}</p>
            </div>
            <div className="flex items-center gap-6 ml-auto">
              <div className="text-center">
                <p className="text-xl font-bold text-amber-700">{makeupSummary.owed}</p>
                <p className="text-[10px] text-amber-600 font-medium">Owed</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-700">{makeupSummary.completed}</p>
                <p className="text-[10px] text-amber-600 font-medium">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-800">{makeupSummary.remaining}</p>
                <p className="text-[10px] text-amber-700 font-medium">Remaining</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Agent</label>
              <select
                value={filterAgent}
                onChange={e => setFilterAgent(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">All agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Type</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as LeaveType | '')}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">All types</option>
                <option value="sick">Sick</option>
                <option value="makeup">Make-up</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">From</label>
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">To</label>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
          {(filterAgent || filterType || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterAgent(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); }}
              className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">No leave records found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Agent</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Notes</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Hrs Owed</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Hrs Done</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => {
                  const agent = agentMap[r.agentId];
                  const isEditing = editId === r.id;
                  const isDeleting = deleteId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-700 whitespace-nowrap font-medium">{fmt(r.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {agent && (
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: agent.colour }}
                            />
                          )}
                          <span className="text-slate-700">{r.agentName ?? agent?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={e => setEditType(e.target.value as LeaveType)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          >
                            <option value="sick">Sick</option>
                            <option value="makeup">Make-up</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEAVE_BADGE[r.leaveType]}`}>
                            {LEAVE_LABELS[r.leaveType]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
                            placeholder="Notes…"
                          />
                        ) : (
                          <span className="text-slate-500 text-xs">{r.notes || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editHoursOwed}
                            onChange={e => setEditHoursOwed(e.target.value)}
                            className="w-16 text-sm text-center border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          />
                        ) : (
                          <span className={r.leaveType === 'makeup' && r.hoursOwed > 0 ? 'font-semibold text-amber-700' : 'text-slate-400'}>
                            {r.leaveType === 'makeup' ? r.hoursOwed : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editHoursCompleted}
                            onChange={e => setEditHoursCompleted(e.target.value)}
                            className="w-16 text-sm text-center border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          />
                        ) : (
                          <span className={r.leaveType === 'makeup' && r.hoursCompleted > 0 ? 'font-semibold text-green-700' : 'text-slate-400'}>
                            {r.leaveType === 'makeup' ? r.hoursCompleted : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleEdit}
                                disabled={editSaving}
                                className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                                title="Save"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : isDeleting ? (
                            <>
                              <span className="text-xs text-red-600 font-medium mr-1">Delete?</span>
                              <button
                                onClick={() => handleDelete(r.id)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                                title="Confirm delete"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(r)}
                                className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setDeleteId(r.id)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-slate-400 text-right">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Add Leave Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Add Leave Record</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Agent</label>
                <select
                  value={addAgent}
                  onChange={e => setAddAgent(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">Select agent…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={e => setAddDate(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                <div className="flex gap-2">
                  {(['sick','makeup','other'] as LeaveType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setAddType(t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        addType === t
                          ? t === 'sick'   ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                          : t === 'makeup' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                          :                  'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {LEAVE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              {addType === 'makeup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Hours Owed</label>
                  <input
                    type="number"
                    min={0}
                    value={addHoursOwed}
                    onChange={e => setAddHoursOwed(e.target.value)}
                    placeholder="e.g. 4"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  rows={2}
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  placeholder="Add any notes…"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !addAgent || !addDate}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
