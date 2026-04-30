'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Trash2, Edit2, Check, X, Plus, RefreshCw } from 'lucide-react';
import { RosterAgent, RosterLeave, RosterConfig, LeaveType, ShiftType } from '@/types';
import { useToast } from '@/components/ui/Toast';

const LEAVE_LABELS: Record<LeaveType, string>  = { sick: 'Sick', makeup: 'Make-up', other: 'Other', 'ph-holiday': '🇵🇭 PH Holiday', annual: '🏖️ Annual' };

// ── Shift helpers (mirrored from roster page) ─────────────────────────────
const SHIFT_DAYS: Record<ShiftType, number[]> = {
  'mon-fri': [1, 2, 3, 4, 5],
  'tue-sat': [2, 3, 4, 5, 6],
  'sun-thu': [0, 1, 2, 3, 4],
};
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function getAgentShiftForWeek(agent: RosterAgent, weekDate: Date, config: RosterConfig): ShiftType {
  if (agent.shiftType === 'mon-fri') return 'mon-fri';
  const startMonday  = getMonday(new Date(config.rotationStartDate));
  const weeksElapsed = Math.round((getMonday(weekDate).getTime() - startMonday.getTime()) / (7 * 86400000));
  const isSwapped    = ((weeksElapsed % 2) + 2) % 2 === 1;
  if (!isSwapped) return agent.shiftType as ShiftType;
  return agent.shiftType === 'tue-sat' ? 'sun-thu' : 'tue-sat';
}
function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Today Status Bar ──────────────────────────────────────────────────────
function TodayStatusBar({ agents, config, todayLeave }: {
  agents: RosterAgent[];
  config: RosterConfig | null;
  todayLeave: RosterLeave[];
}) {
  if (!config || !agents.length) return null;
  const today = new Date(); today.setHours(0,0,0,0);

  const statuses = agents.map(agent => {
    const agentLeave = todayLeave.find(l => l.agentId === agent.id);
    let state: 'online' | 'leave' | 'off';
    if (agentLeave) {
      state = 'leave';
    } else {
      const shift = getAgentShiftForWeek(agent, today, config);
      state = SHIFT_DAYS[shift].includes(today.getDay()) ? 'online' : 'off';
    }
    return { agent, state, leaveType: agentLeave?.leaveType };
  });

  return (
    <div className="card px-4 py-3 flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-1 flex-shrink-0">Today</span>
      {statuses.map(({ agent, state, leaveType }) => {
        const bgColor  = state === 'online' ? hexToRgba(agent.colour, 0.08) : state === 'leave' ? '#fef2f2' : '#f8fafc';
        const brdColor = state === 'online' ? hexToRgba(agent.colour, 0.30) : state === 'leave' ? '#fecaca' : '#e2e8f0';
        const txtColor = state === 'online' ? agent.colour : state === 'leave' ? '#dc2626' : '#94a3b8';
        return (
          <div key={agent.id}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
            style={{ backgroundColor: bgColor, borderColor: brdColor }}>
            {state === 'online' ? (
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                  style={{ backgroundColor: agent.colour }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: agent.colour }} />
              </span>
            ) : state === 'leave' ? (
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
            )}
            <span className="text-xs font-semibold" style={{ color: txtColor }}>{agent.name}</span>
            {state === 'leave' && leaveType && (
              <span className="text-[9px] font-bold text-red-400">{LEAVE_LABELS[leaveType].toUpperCase()}</span>
            )}
            {state === 'off' && (
              <span className="text-[9px] text-slate-400">OFF</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
const LEAVE_BADGE: Record<LeaveType, string> = {
  sick:         'bg-red-100 text-red-700',
  makeup:       'bg-amber-100 text-amber-700',
  other:        'bg-slate-100 text-slate-600',
  'ph-holiday': 'bg-blue-100 text-blue-700',
  annual:       'bg-emerald-100 text-emerald-700',
};

const ANNUAL_LEAVE_DAYS = 5;

function getAnnualLeaveWindow(resetDate: string): { start: string; end: string } {
  const [, mm, dd] = resetDate.split('-');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();
  const thisYearReset = new Date(`${thisYear}-${mm}-${dd}T00:00:00`);
  const startYear = today >= thisYearReset ? thisYear : thisYear - 1;
  const start = `${startYear}-${mm}-${dd}`;
  const endDate = new Date(`${startYear + 1}-${mm}-${dd}T00:00:00`);
  endDate.setDate(endDate.getDate() - 1);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

function fmt(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LeavePage() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [agents, setAgents]   = useState<RosterAgent[]>([]);
  const [config, setConfig]   = useState<RosterConfig | null>(null);
  const [records, setRecords] = useState<RosterLeave[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterAgent, setFilterAgent] = useState('');
  const [filterType,  setFilterType]  = useState<LeaveType | ''>('');
  const [filterFrom,  setFilterFrom]  = useState('');
  const [filterTo,    setFilterTo]    = useState('');

  // Add leave modal
  const [showAdd,        setShowAdd]        = useState(false);
  const [addAgent,       setAddAgent]       = useState('');
  const [addDateFrom,    setAddDateFrom]    = useState('');
  const [addDateTo,      setAddDateTo]      = useState('');
  const [addType,        setAddType]        = useState<LeaveType>('sick');
  const [addNotes,       setAddNotes]       = useState('');
  const [addHoursOwed,   setAddHoursOwed]   = useState('');
  const [saving,         setSaving]         = useState(false);

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
      const [agentRes, configRes, leaveRes] = await Promise.all([
        fetch('/api/roster/agents'),
        fetch('/api/roster/config'),
        fetch('/api/roster/leave'),
      ]);
      const agentData  = await agentRes.json();
      const configData = await configRes.json();
      const leaveData  = await leaveRes.json();
      setAgents(agentData.data ?? []);
      setConfig(configData.data ?? null);
      setRecords(leaveData.data ?? []);
    } catch {
      toastError('Failed to load leave records');
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

  // Annual leave balance per agent (current 12-month window)
  const annualBalance = useMemo(() => {
    if (!config?.annualLeaveResetDate) return null;
    const { start, end } = getAnnualLeaveWindow(config.annualLeaveResetDate);
    const windowStart = new Date(start + 'T00:00:00');
    const windowEnd   = new Date(end   + 'T00:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const windowLabel = `${fmt(windowStart)} – ${fmt(windowEnd)}`;
    const byAgent = agents.map(agent => {
      const used = records.filter(r =>
        r.agentId === agent.id &&
        r.leaveType === 'annual' &&
        r.date >= start &&
        r.date <= end
      ).length;
      return { agent, used, remaining: Math.max(0, ANNUAL_LEAVE_DAYS - used) };
    });
    return { byAgent, windowLabel };
  }, [records, agents, config]);

  // Notice warning: annual leave date < 14 days from today
  const annualNoticeWarning = useMemo(() => {
    if (addType !== 'annual' || !addDateFrom) return null;
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const leaveDate = new Date(addDateFrom + 'T00:00:00');
    const days = Math.round((leaveDate.getTime() - today.getTime()) / 86400000);
    return days < 14 ? days : null;
  }, [addType, addDateFrom]);

  function getWeekdaysBetween(from: string, to: string): string[] {
    const dates: string[] = [];
    const cur = new Date(from + 'T00:00:00');
    const end = new Date(to   + 'T00:00:00');
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  async function handleAdd() {
    if (!addAgent || !addDateFrom) return;
    const dateTo = addDateTo || addDateFrom;
    const dates  = getWeekdaysBetween(addDateFrom, dateTo);
    if (!dates.length) return;
    setSaving(true);
    try {
      const newRecords: RosterLeave[] = [];
      for (const date of dates) {
        const res = await fetch('/api/roster/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId:        addAgent,
            date,
            leaveType:      addType,
            notes:          addNotes,
            hoursOwed:      addType === 'makeup' ? Number(addHoursOwed) || 0 : 0,
            hoursCompleted: 0,
          }),
        });
        if (!res.ok) throw new Error();
        const { data } = await res.json();
        newRecords.push(data);
      }
      setRecords(prev => [...newRecords, ...prev].sort((a,b) => b.date.localeCompare(a.date)));
      setShowAdd(false);
      setAddAgent(''); setAddDateFrom(''); setAddDateTo(''); setAddType('sick'); setAddNotes(''); setAddHoursOwed('');
      toastSuccess(dates.length === 1 ? 'Leave record added' : `${dates.length} leave records added`);
    } catch {
      toastError('Failed to add leave record');
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
      toastSuccess('Leave record updated');
    } catch {
      toastError('Failed to update leave record');
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
      toastSuccess('Leave record deleted');
    } catch {
      toastError('Failed to delete leave record');
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
        {/* Today's status */}
        <TodayStatusBar
          agents={agents}
          config={config}
          todayLeave={records.filter(r => r.date === new Date().toISOString().slice(0, 10))}
        />

        {/* Make-up hours summary */}
        {makeupSummary.owed > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <div className="flex items-center gap-6">
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
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-amber-600 mb-1">
                <span>{Math.round((makeupSummary.completed / makeupSummary.owed) * 100)}% complete</span>
                <span>{makeupSummary.completed} / {makeupSummary.owed} hrs</span>
              </div>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (makeupSummary.completed / makeupSummary.owed) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Annual leave balance */}
        {annualBalance && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Annual Leave</p>
                <p className="text-xs text-emerald-600 mt-0.5">{annualBalance.windowLabel}</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                {ANNUAL_LEAVE_DAYS} days / window
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {annualBalance.byAgent.map(({ agent, used, remaining }) => (
                <div key={agent.id} className="bg-white rounded-lg border border-emerald-100 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agent.colour }} />
                    <span className="text-xs font-semibold text-slate-700 truncate">{agent.name}</span>
                  </div>
                  <div className="flex items-end justify-between mb-1.5">
                    <span className={`text-lg font-bold ${remaining === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {remaining}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{used} / {ANNUAL_LEAVE_DAYS} used</span>
                  </div>
                  <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${remaining === 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (used / ANNUAL_LEAVE_DAYS) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
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
                <option value="ph-holiday">🇵🇭 PH Holiday</option>
                <option value="annual">🏖️ Annual</option>
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
                            <option value="ph-holiday">🇵🇭 PH Holiday</option>
                            <option value="annual">🏖️ Annual</option>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date <span className="text-slate-400 font-normal">(single day or range)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={addDateFrom}
                    onChange={e => setAddDateFrom(e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <span className="text-slate-400 text-xs">→</span>
                  <input
                    type="date"
                    value={addDateTo}
                    min={addDateFrom}
                    onChange={e => setAddDateTo(e.target.value)}
                    placeholder="End (optional)"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                {addDateFrom && addDateTo && addDateTo > addDateFrom && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {getWeekdaysBetween(addDateFrom, addDateTo).length} weekday{getWeekdaysBetween(addDateFrom, addDateTo).length !== 1 ? 's' : ''} — one record each
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['sick','makeup','other','ph-holiday','annual'] as LeaveType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setAddType(t)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        addType === t
                          ? t === 'sick'       ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                          : t === 'makeup'     ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                          : t === 'ph-holiday' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                          : t === 'annual'     ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                          :                      'bg-slate-200 text-slate-700 ring-1 ring-slate-400'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {LEAVE_LABELS[t]}
                    </button>
                  ))}
                </div>
                {/* 2-week notice warning */}
                {annualNoticeWarning !== null && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                    <span className="text-amber-500 text-xs mt-0.5">⚠️</span>
                    <p className="text-xs text-amber-700">
                      {annualNoticeWarning <= 0
                        ? 'This date is in the past or today — annual leave requires 2 weeks\' notice.'
                        : `Only ${annualNoticeWarning} day${annualNoticeWarning !== 1 ? 's' : ''} notice — annual leave requires 2 weeks' notice.`}
                    </p>
                  </div>
                )}
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
                disabled={saving || !addAgent || !addDateFrom}
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
