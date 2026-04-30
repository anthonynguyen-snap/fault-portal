'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Plus, Settings, RefreshCw,
  Users, Save, Trash2, UserPlus, X,
} from 'lucide-react';
import { RosterAgent, RosterConfig, RosterLeave, RosterOverride, ShiftType, LeaveType } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { PH_HOLIDAY_MAP } from '@/lib/ph-holidays';

// ── Constants ──────────────────────────────────────────────────────────────
const SHIFT_DAYS: Record<ShiftType, number[]> = {
  'mon-fri': [1, 2, 3, 4, 5],
  'tue-sat': [2, 3, 4, 5, 6],
  'sun-thu': [0, 1, 2, 3, 4],
};
const SHIFT_LABELS: Record<ShiftType, string> = {
  'mon-fri': 'Mon – Fri',
  'tue-sat': 'Tue – Sat',
  'sun-thu': 'Sun – Thu',
};
const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LEAVE_LABELS: Record<LeaveType, string>  = { sick: 'Sick', makeup: 'Make-up', other: 'Other', 'ph-holiday': 'PH Holiday' };
const LEAVE_COLOURS: Record<LeaveType, string> = { sick: '#ef4444', makeup: '#f59e0b', other: '#6b7280', 'ph-holiday': '#3b82f6' };

// ── Utilities ──────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function getAgentShiftForWeek(agent: RosterAgent, weekMonday: Date, config: RosterConfig): ShiftType {
  if (agent.shiftType === 'mon-fri') return 'mon-fri';
  const startMonday   = getMonday(new Date(config.rotationStartDate));
  const weeksElapsed  = Math.round((getMonday(weekMonday).getTime() - startMonday.getTime()) / (7 * 86400000));
  const isSwapped     = ((weeksElapsed % 2) + 2) % 2 === 1;
  if (!isSwapped) return agent.shiftType as ShiftType;
  return agent.shiftType === 'tue-sat' ? 'sun-thu' : 'tue-sat';
}
function isWorkingDay(shift: ShiftType, date: Date): boolean {
  return SHIFT_DAYS[shift].includes(date.getDay());
}

// ── Today Status Bar ───────────────────────────────────────────────────────
function TodayStatusBar({
  agents, config, leaveToday, overrideMap,
}: {
  agents: RosterAgent[];
  config: RosterConfig | null;
  leaveToday: RosterLeave[];
  overrideMap: Record<string, RosterOverride>;
}) {
  if (!config || !agents.length) return null;
  const today    = new Date(); today.setHours(0,0,0,0);
  const todayStr = toDateStr(today);

  const statuses = agents.map(agent => {
    const agentLeave = leaveToday.find(l => l.agentId === agent.id);
    const ov = overrideMap[`${agent.id}:${todayStr}`];
    let state: 'online' | 'leave' | 'off';
    if (agentLeave) {
      state = 'leave';
    } else if (ov) {
      state = ov.isWorking ? 'online' : 'off';
    } else {
      const shift = getAgentShiftForWeek(agent, today, config);
      state = isWorkingDay(shift, today) ? 'online' : 'off';
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors"
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

// ── Main component ─────────────────────────────────────────────────────────
function RosterPageInner() {
  const searchParams = useSearchParams();
  const { success, error: toastError } = useToast();

  const [agents,    setAgents]    = useState<RosterAgent[]>([]);
  const [config,    setConfig]    = useState<RosterConfig | null>(null);
  const [leave,     setLeave]     = useState<RosterLeave[]>([]);
  const [overrides, setOverrides] = useState<RosterOverride[]>([]);
  const [loading,   setLoading]   = useState(true);

  const [view,        setView]        = useState<'week' | 'month'>('week');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [weekStart,   setWeekStart]   = useState<Date>(getMonday(new Date()));
  const [monthDate,   setMonthDate]   = useState<Date>(new Date());

  // Modals
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAdmin,    setShowAdmin]    = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<{ date: string; agentId: string } | null>(null);

  // Add Leave form
  const emptyLeaveForm = { agentId: '', date: toDateStr(new Date()), leaveType: 'sick' as LeaveType, notes: '', hoursOwed: 0, hoursCompleted: 0 };
  const [leaveForm, setLeaveForm] = useState(emptyLeaveForm);
  const [savingLeave, setSavingLeave] = useState(false);

  // Admin state
  const [adminAgents,  setAdminAgents]  = useState<RosterAgent[]>([]);
  const [adminConfig,  setAdminConfig]  = useState({ rotationStartDate: '' });
  const [savingAdmin,  setSavingAdmin]  = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  // Override form
  const [overrideForm, setOverrideForm] = useState({ isWorking: false, notes: '', hours: 0 });
  const [savingOverride, setSavingOverride] = useState(false);

  async function fetchLeaveAndOverrides(from: string, to: string) {
    const [l, o] = await Promise.all([
      fetch(`/api/roster/leave?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/roster/overrides?from=${from}&to=${to}`).then(r => r.json()),
    ]);
    setLeave(l.data ?? []);
    setOverrides(o.data ?? []);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const from = toDateStr(weekStart);
      const to   = toDateStr(addDays(weekStart, 6));
      const [agentsRes, configRes] = await Promise.all([
        fetch('/api/roster/agents').then(r => r.json()),
        fetch('/api/roster/config').then(r => r.json()),
      ]);
      setAgents(agentsRes.data ?? []);
      setConfig(configRes.data ?? null);
      await fetchLeaveAndOverrides(from, to);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  useEffect(() => {
    if (searchParams.get('addLeave') === '1') setShowAddLeave(true);
  }, [searchParams]);

  useEffect(() => {
    if (!loading) {
      const from = toDateStr(weekStart);
      const to   = view === 'month'
        ? toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 7))
        : toDateStr(addDays(weekStart, 6));
      fetchLeaveAndOverrides(from, to);
    }
  }, [weekStart, view, monthDate]); // eslint-disable-line

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const leaveByDate = useMemo(() => {
    const map: Record<string, RosterLeave[]> = {};
    for (const l of leave) { if (!map[l.date]) map[l.date] = []; map[l.date].push(l); }
    return map;
  }, [leave]);

  const overrideMap = useMemo(() => {
    const map: Record<string, RosterOverride> = {};
    for (const o of overrides) map[`${o.agentId}:${o.date}`] = o;
    return map;
  }, [overrides]);

  function getWorkingState(agent: RosterAgent, date: Date): 'working' | 'off' | 'leave' {
    if (!config) return 'off';
    const ds = toDateStr(date);
    const dayLeave = leaveByDate[ds] ?? [];
    if (dayLeave.some(l => l.agentId === agent.id)) return 'leave';
    const ov = overrideMap[`${agent.id}:${ds}`];
    if (ov) return ov.isWorking ? 'working' : 'off';
    const shift = getAgentShiftForWeek(agent, date, config);
    return isWorkingDay(shift, date) ? 'working' : 'off';
  }

  const filteredAgents = useMemo(() =>
    filterAgent === 'all' ? agents : agents.filter(a => a.id === filterAgent),
    [agents, filterAgent]
  );

  // ── Week label ─────────────────────────────────────────────────────────
  const weekLabel = (() => {
    const end = addDays(weekStart, 6);
    if (weekStart.getMonth() === end.getMonth())
      return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${weekStart.getFullYear()}`;
    return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${weekStart.getFullYear()}`;
  })();

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleAddLeave() {
    if (!leaveForm.agentId) { toastError('Missing agent', 'Please select an agent.'); return; }
    setSavingLeave(true);
    try {
      const res  = await fetch('/api/roster/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(leaveForm) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      success('Leave added', `${LEAVE_LABELS[leaveForm.leaveType]} recorded for ${agents.find(a => a.id === leaveForm.agentId)?.name}.`);
      setShowAddLeave(false);
      setLeaveForm(emptyLeaveForm);
      await fetchLeaveAndOverrides(toDateStr(weekStart), toDateStr(addDays(weekStart, 6)));
    } catch (err: unknown) {
      toastError('Failed', err instanceof Error ? err.message : String(err));
    } finally { setSavingLeave(false); }
  }

  async function handleSaveOverride() {
    if (!overrideTarget) return;
    setSavingOverride(true);
    try {
      const res  = await fetch('/api/roster/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...overrideTarget, ...overrideForm }) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      success('Override saved', `Day override applied.`);
      setOverrideTarget(null);
      await fetchLeaveAndOverrides(toDateStr(weekStart), toDateStr(addDays(weekStart, 6)));
    } catch (err: unknown) {
      toastError('Failed', err instanceof Error ? err.message : String(err));
    } finally { setSavingOverride(false); }
  }

  async function handleSaveAdmin() {
    setSavingAdmin(true);
    try {
      await fetch('/api/roster/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adminConfig) });
      for (const a of adminAgents) {
        await fetch(`/api/roster/agents/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colour: a.colour, shiftType: a.shiftType, name: a.name }) });
      }
      success('Settings saved', 'Roster config updated.');
      setShowAdmin(false);
      loadAll();
    } catch (err: unknown) {
      toastError('Failed', err instanceof Error ? err.message : String(err));
    } finally { setSavingAdmin(false); }
  }

  async function handleAddAgent() {
    if (!newAgentName.trim()) return;
    try {
      const res  = await fetch('/api/roster/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newAgentName.trim(), colour: '#6366f1', shiftType: 'tue-sat' }) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAdminAgents(prev => [...prev, json.data]);
      setNewAgentName('');
    } catch (err: unknown) {
      toastError('Failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemoveAgent(id: string) {
    await fetch(`/api/roster/agents/${id}`, { method: 'DELETE' });
    setAdminAgents(prev => prev.filter(a => a.id !== id));
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="card h-80 animate-pulse bg-slate-100" />
      </div>
    );
  }

  // ── Monthly calendar helpers ───────────────────────────────────────────
  function buildMonthGrid(year: number, month: number): (Date | null)[][] {
    const first   = new Date(year, month, 1);
    const last    = new Date(year, month + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Mon=0
    const cells: (Date | null)[] = [
      ...Array(startDow).fill(null),
      ...Array.from({ length: last.getDate() }, (_, i) => new Date(year, month, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  const monthGrid = buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth());

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Roster</h1>
          <p className="page-subtitle">Team schedule · auto-rotating weekly</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="btn-ghost" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => { setAdminAgents([...agents]); setAdminConfig({ rotationStartDate: config?.rotationStartDate ?? '' }); setShowAdmin(true); }}
            className="btn-ghost" title="Settings"><Settings size={15} /></button>
          <button onClick={() => { setLeaveForm({ ...emptyLeaveForm, agentId: agents[0]?.id ?? '' }); setShowAddLeave(true); }}
            className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Add Leave
          </button>
        </div>
      </div>

      {/* Today's status */}
      <TodayStatusBar
        agents={agents}
        config={config}
        leaveToday={leaveByDate[toDateStr(today)] ?? []}
        overrideMap={overrideMap}
      />

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Week nav */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setWeekStart(w => addDays(w, -7)); setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - (view === 'month' ? 1 : 0), 1)); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-sm font-semibold text-slate-800 min-w-[220px] text-center">
            {view === 'week' ? weekLabel : `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`}
          </span>
          <button onClick={() => { setWeekStart(w => addDays(w, 7)); setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + (view === 'month' ? 1 : 0), 1)); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"><ChevronRight size={18} /></button>
          <button onClick={() => { setWeekStart(getMonday(new Date())); setMonthDate(new Date()); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 ml-1">
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent filter */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
            <button onClick={() => setFilterAgent('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterAgent === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              <Users size={12} /> Team
            </button>
            {agents.map(a => (
              <button key={a.id} onClick={() => setFilterAgent(f => f === a.id ? 'all' : a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterAgent === a.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.colour }} />
                {a.name}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            {(['week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${view === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent shift legend */}
      <div className="flex flex-wrap items-center gap-4">
        {filteredAgents.map(a => {
          const shift = config ? getAgentShiftForWeek(a, weekStart, config) : a.shiftType as ShiftType;
          return (
            <div key={a.id} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.colour }} />
              <span className="text-xs font-semibold text-slate-700">{a.name}</span>
              <span className="text-xs text-slate-400">{SHIFT_LABELS[shift]}</span>
            </div>
          );
        })}
      </div>

      {/* ── Weekly view ──────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-100">
            {weekDays.map(day => {
              const isToday   = toDateStr(day) === toDateStr(today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const ds        = toDateStr(day);
              const dayLeave  = leaveByDate[ds] ?? [];
              const phHoliday = PH_HOLIDAY_MAP[ds];

              return (
                <div key={ds} className={`${phHoliday ? 'bg-blue-50/40' : isWeekend ? 'bg-amber-50/50' : 'bg-white'} ${isToday ? 'ring-2 ring-inset ring-brand-400' : ''}`}>
                  {/* Day header */}
                  <div className={`px-2.5 py-2.5 border-b border-slate-100 ${isToday ? 'bg-brand-50' : phHoliday ? 'bg-blue-50/60' : isWeekend ? 'bg-amber-50/80' : ''}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${phHoliday ? 'text-blue-600' : isWeekend ? 'text-amber-600' : 'text-slate-400'}`}>
                      {DAY_NAMES[day.getDay()]}
                    </p>
                    <p className={`text-xl font-bold leading-tight mt-0.5 ${isToday ? 'text-brand-600' : phHoliday ? 'text-blue-700' : isWeekend ? 'text-amber-700' : 'text-slate-800'}`}>
                      {day.getDate()}
                    </p>
                    <p className="text-[9px] text-slate-400">{MONTH_NAMES[day.getMonth()].slice(0,3)}</p>
                    {phHoliday && (
                      <p className="text-[8px] font-bold text-blue-500 uppercase tracking-wide mt-0.5 leading-tight">
                        🇵🇭 {phHoliday.name}
                      </p>
                    )}
                  </div>

                  {/* Agent slots */}
                  <div className="p-1.5 space-y-1 min-h-[120px]">
                    {filteredAgents.map(agent => {
                      const state      = getWorkingState(agent, day);
                      const agentLeave = dayLeave.find(l => l.agentId === agent.id);

                      if (state === 'off' && filterAgent === 'all') return null;

                      if (state === 'leave') {
                        const lt = agentLeave?.leaveType ?? 'other';
                        return (
                          <div key={agent.id} className="flex items-center gap-1 px-2 py-1.5 rounded-md"
                            style={{ backgroundColor: hexToRgba(agent.colour, 0.06), border: `1px dashed ${hexToRgba(agent.colour, 0.35)}` }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: LEAVE_COLOURS[lt] }} />
                            <span className="text-[11px] font-semibold truncate" style={{ color: agent.colour }}>{agent.name}</span>
                            <span className="text-[9px] text-slate-400 ml-auto flex-shrink-0">{LEAVE_LABELS[lt]}</span>
                          </div>
                        );
                      }

                      if (state === 'working') {
                        return (
                          <div key={agent.id}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:opacity-75 transition-opacity select-none"
                            style={{ backgroundColor: hexToRgba(agent.colour, 0.12), borderLeft: `3px solid ${agent.colour}` }}
                            onClick={() => { setOverrideTarget({ date: ds, agentId: agent.id }); setOverrideForm({ isWorking: false, notes: '', hours: 0 }); }}>
                            <span className="text-[11px] font-bold truncate" style={{ color: agent.colour }}>{agent.name}</span>
                            {phHoliday && (
                              <span className="ml-auto text-[8px] font-bold bg-blue-100 text-blue-600 px-1 py-0.5 rounded flex-shrink-0">2×</span>
                            )}
                          </div>
                        );
                      }

                      // Off (shown only in single-agent view)
                      return (
                        <div key={agent.id} className="flex items-center justify-center px-2 py-1.5 rounded-md border border-dashed border-slate-200 bg-slate-50">
                          <span className="text-[11px] text-slate-300 font-medium">Off</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekend coverage indicator */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
            {[{ label: 'Sat coverage', idx: 5 }, { label: 'Sun coverage', idx: 6 }].map(({ label, idx }) => {
              const day = weekDays[idx];
              const working = agents.filter(a => getWorkingState(a, day) === 'working');
              return (
                <span key={label} className={`text-xs font-medium flex items-center gap-1.5 ${working.length > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${working.length > 0 ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {label}: {working.length > 0 ? working.map(a => a.name).join(', ') : 'Nobody scheduled'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monthly view ─────────────────────────────────────────────────── */}
      {view === 'month' && (
        <div className="card overflow-hidden">
          {/* Day name headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
              <div key={d} className={`px-3 py-2.5 text-xs font-semibold text-center uppercase tracking-wider ${i >= 5 ? 'text-amber-600 bg-amber-50/50' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>
          {monthGrid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 divide-x divide-slate-100 border-b border-slate-100 last:border-0">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="min-h-[80px] bg-slate-50/50" />;
                const isToday   = toDateStr(day) === toDateStr(today);
                const isWeekend = di >= 5;
                const ds        = toDateStr(day);
                const phHoliday = PH_HOLIDAY_MAP[ds];
                const working   = filteredAgents.filter(a => getWorkingState(a, day) === 'working');
                const onLeave   = filteredAgents.filter(a => getWorkingState(a, day) === 'leave');
                return (
                  <div key={ds}
                    className={`min-h-[80px] p-2 cursor-pointer hover:bg-brand-50/30 transition-colors ${phHoliday ? 'bg-blue-50/30' : isWeekend ? 'bg-amber-50/40' : 'bg-white'} ${isToday ? 'ring-2 ring-inset ring-brand-400' : ''}`}
                    onClick={() => { setWeekStart(getMonday(day)); setView('week'); }}>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <p className={`text-sm font-bold ${isToday ? 'text-brand-600' : phHoliday ? 'text-blue-700' : isWeekend ? 'text-amber-700' : 'text-slate-700'}`}>
                        {day.getDate()}
                      </p>
                      {phHoliday && (
                        <span className="text-[7px] font-bold text-blue-500 leading-tight text-right">🇵🇭</span>
                      )}
                    </div>
                    {phHoliday && (
                      <p className="text-[8px] font-semibold text-blue-500 leading-tight mb-1 truncate">{phHoliday.name}</p>
                    )}
                    <div className="space-y-0.5">
                      {working.map(a => (
                        <div key={a.id} className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.colour }} />
                          <span className="text-[10px] font-medium truncate" style={{ color: a.colour }}>{a.name}</span>
                          {phHoliday && <span className="text-[8px] font-bold text-blue-500 ml-auto flex-shrink-0">2×</span>}
                        </div>
                      ))}
                      {onLeave.map(a => (
                        <div key={a.id} className="flex items-center gap-1 opacity-60">
                          <span className="w-1.5 h-1.5 rounded-full border flex-shrink-0" style={{ borderColor: a.colour }} />
                          <span className="text-[10px] truncate text-slate-400">{a.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Personal summary (single agent view) ─────────────────────────── */}
      {filterAgent !== 'all' && (() => {
        const agent = agents.find(a => a.id === filterAgent);
        if (!agent || !config) return null;
        const shift     = getAgentShiftForWeek(agent, weekStart, config);
        const workDays  = weekDays.filter(d => getWorkingState(agent, d) === 'working');
        const leaveDays = weekDays.filter(d => getWorkingState(agent, d) === 'leave');
        const offDays   = weekDays.filter(d => getWorkingState(agent, d) === 'off');
        return (
          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold font-mono" style={{ color: agent.colour }}>{workDays.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Days On</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-slate-400">{offDays.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Days Off</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-red-400">{leaveDays.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">On Leave</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{SHIFT_LABELS[shift]}</p>
                <p className="text-xs text-slate-500 mt-0.5">This week</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Add Leave Modal ───────────────────────────────────────────────── */}
      {showAddLeave && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Add Leave</h2>
              <button onClick={() => setShowAddLeave(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Agent</label>
                <select value={leaveForm.agentId} onChange={e => setLeaveForm(f => ({ ...f, agentId: e.target.value }))} className="form-input">
                  <option value="">Select agent…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={leaveForm.date} onChange={e => setLeaveForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Type</label>
                  <select value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value as LeaveType }))} className="form-input">
                    <option value="sick">Sick</option>
                    <option value="makeup">Make-up Hours</option>
                    <option value="other">Other</option>
                    <option value="ph-holiday">🇵🇭 PH Holiday</option>
                  </select>
                </div>
              </div>
              {leaveForm.leaveType === 'makeup' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Hours Owed</label>
                    <input type="number" min={0} step={0.5} value={leaveForm.hoursOwed}
                      onChange={e => setLeaveForm(f => ({ ...f, hoursOwed: parseFloat(e.target.value) || 0 }))} className="form-input font-mono" />
                  </div>
                  <div>
                    <label className="form-label">Hours Completed</label>
                    <input type="number" min={0} step={0.5} value={leaveForm.hoursCompleted}
                      onChange={e => setLeaveForm(f => ({ ...f, hoursCompleted: parseFloat(e.target.value) || 0 }))} className="form-input font-mono" />
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea value={leaveForm.notes} onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="form-input resize-none" placeholder="Any context…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowAddLeave(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAddLeave} disabled={savingLeave} className="btn-primary">
                {savingLeave ? 'Saving…' : 'Add Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Override Modal ────────────────────────────────────────────────── */}
      {overrideTarget && (() => {
        const agent = agents.find(a => a.id === overrideTarget.agentId);
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-semibold text-slate-900">Override Day</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{agent?.name} · {overrideTarget.date}</p>
                </div>
                <button onClick={() => setOverrideTarget(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="form-label">Mark as</label>
                  <div className="flex gap-2 mt-1">
                    {[{ label: 'Working', val: true }, { label: 'Day Off', val: false }].map(opt => (
                      <button key={String(opt.val)} onClick={() => setOverrideForm(f => ({ ...f, isWorking: opt.val }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${overrideForm.isWorking === opt.val ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input value={overrideForm.notes} onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))}
                    className="form-input" placeholder="Reason for override…" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
                <button onClick={() => setOverrideTarget(null)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveOverride} disabled={savingOverride} className="btn-primary">
                  {savingOverride ? 'Saving…' : 'Save Override'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Admin Modal ───────────────────────────────────────────────────── */}
      {showAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Roster Settings</h2>
              <button onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-6">
              {/* Rotation start */}
              <div>
                <label className="form-label">Rotation Start Date</label>
                <input type="date" value={adminConfig.rotationStartDate}
                  onChange={e => setAdminConfig(c => ({ ...c, rotationStartDate: e.target.value }))} className="form-input" />
                <p className="text-xs text-slate-400 mt-1">The Monday of Week 1 (initial assignments). Week 2 swaps automatically.</p>
              </div>

              {/* Agents */}
              <div>
                <label className="form-label mb-2">Agents</label>
                <div className="space-y-2">
                  {adminAgents.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <input type="color" value={a.colour}
                        onChange={e => setAdminAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, colour: e.target.value } : ag))}
                        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" title="Agent colour" />
                      <input value={a.name}
                        onChange={e => setAdminAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, name: e.target.value } : ag))}
                        className="form-input flex-1 text-sm py-1.5" />
                      <select value={a.shiftType}
                        onChange={e => setAdminAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, shiftType: e.target.value as ShiftType } : ag))}
                        className="form-input text-xs py-1.5 w-28">
                        <option value="mon-fri">Mon–Fri</option>
                        <option value="tue-sat">Tue–Sat</option>
                        <option value="sun-thu">Sun–Thu</option>
                      </select>
                      {!a.isAdmin && (
                        <button onClick={() => handleRemoveAgent(a.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add new agent */}
                <div className="flex gap-2 mt-3">
                  <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddAgent()}
                    className="form-input flex-1 text-sm" placeholder="New agent name…" />
                  <button onClick={handleAddAgent} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <UserPlus size={14} /> Add
                  </button>
                </div>
              </div>

              {/* Leave key */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Leave Indicators</p>
                <div className="flex gap-4">
                  {(Object.entries(LEAVE_LABELS) as [LeaveType, string][]).map(([k, v]) => (
                    <span key={k} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LEAVE_COLOURS[k] }} />{v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowAdmin(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveAdmin} disabled={savingAdmin} className="btn-primary flex items-center gap-2">
                <Save size={14} /> {savingAdmin ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RosterPage() {
  return <Suspense><RosterPageInner /></Suspense>;
}
