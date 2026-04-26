'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Clock, Star, Zap, ChevronLeft, ChevronRight,
  TrendingUp, MessageSquare, CheckCircle, Bot, AlertCircle, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { StatCardsSkeleton, SkeletonBlock, TableSkeleton } from '@/components/ui/Skeleton';

// ── KPI targets (default) ─────────────────────────────────────────────────────
const DEFAULT_TARGETS = { repliesPerDay: 60, resolveRate: 30, csat: 3.0 };

// ── Agent groups ──────────────────────────────────────────────────────────────
const PRIMARY_AGENT_IDS: (number | string)[] = [6525, 6988, 3007]; // Niko, Gabriel, Charles

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentStat {
  agent_id: number | string;
  agent: string;
  agent_name?: string;
  agent_type: 'user' | 'ai_agent';
  closed_tickets: number;
  closed_tickets_percentage: number;
  avg_csat: number;
  tickets_replied: number;
  messages_sent: number;
  first_response_time: number;
  avg_response_time: number;
  resolution_time: number;
  one_touch_tickets: number;
  ticket_handle_time: number;
}

interface PerformanceData {
  agents: Record<string, unknown>;
  overview: Record<string, unknown>;
  csat: Record<string, unknown>;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

function weekRange(monday: Date) {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  return { from: toISO(monday), to: toISO(sun) };
}

function daysBetween(from: string, to: string) {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1);
}

function fmtTime(s: number) {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.round(h / 24)}d`;
  if (h >= 1)  return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtShortDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── RAG ───────────────────────────────────────────────────────────────────────
type Rag = 'green' | 'amber' | 'red' | 'none';

const RAG_BADGE: Record<Rag, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  amber: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
  red:   'bg-red-50    text-red-700    ring-1 ring-red-200',
  none:  'bg-slate-100 text-slate-400',
};
const RAG_DOT: Record<Rag, string> = {
  green: 'bg-emerald-400', amber: 'bg-amber-400', red: 'bg-red-400', none: 'bg-slate-300',
};

interface KPITargets {
  repliesPerDay: number;
  resolveRate: number;
  csat: number;
}

function ragReplies(sent: number, days: number, targets: KPITargets): Rag {
  const d = sent / days;
  if (d >= targets.repliesPerDay)        return 'green';
  if (d >= targets.repliesPerDay * 0.65) return 'amber';
  return 'red';
}
function ragResolve(pct: number, targets: KPITargets): Rag {
  if (!pct) return 'none';
  if (pct >= targets.resolveRate)        return 'green';
  if (pct >= targets.resolveRate * 0.65) return 'amber';
  return 'red';
}
function ragCsat(score: number, targets: KPITargets): Rag {
  if (!score) return 'none';
  if (score >= 4.0)          return 'green';
  if (score >= targets.csat) return 'amber';
  return 'red';
}

function RagBadge({ value, rag, label }: { value: string; rag: Rag; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${RAG_BADGE[rag]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RAG_DOT[rag]}`} />
      {value}{label && <span className="font-normal opacity-70">{label}</span>}
    </span>
  );
}

// ── Agent row ─────────────────────────────────────────────────────────────────
function AgentRow({ agent, days, isPrimary, targets }: { agent: AgentStat; days: number; isPrimary: boolean; targets: KPITargets }) {
  const daily       = agent.messages_sent / days;
  const displayName = agent.agent || agent.agent_name || 'Unknown';
  const initials    = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <tr className={`border-t border-slate-50 transition-colors ${isPrimary ? 'hover:bg-slate-50' : 'hover:bg-slate-50/60 bg-slate-50/30'}`}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPrimary ? 'bg-brand-100' : 'bg-slate-100'}`}>
            <span className={`text-xs font-bold ${isPrimary ? 'text-brand-700' : 'text-slate-500'}`}>{initials}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${isPrimary ? 'text-slate-800' : 'text-slate-600'}`}>{displayName}</span>
            {!isPrimary && <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">Mgmt</span>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <span className={`font-semibold ${isPrimary ? 'text-slate-800' : 'text-slate-500'}`}>{agent.closed_tickets}</span>
        {agent.closed_tickets_percentage > 0 && <span className="text-xs text-slate-400 ml-1">({agent.closed_tickets_percentage.toFixed(1)}%)</span>}
      </td>
      <td className="px-4 py-3.5 text-center">
        <RagBadge value={daily.toFixed(1)} rag={isPrimary ? ragReplies(agent.messages_sent, days, targets) : 'none'} label="/day" />
      </td>
      <td className="px-4 py-3.5 text-center">
        {agent.one_touch_tickets > 0
          ? <RagBadge value={`${agent.one_touch_tickets.toFixed(1)}%`} rag={isPrimary ? ragResolve(agent.one_touch_tickets, targets) : 'none'} />
          : <span className="text-xs text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3.5 text-center">
        {agent.avg_csat > 0
          ? <RagBadge value={`${agent.avg_csat.toFixed(1)} ★`} rag={ragCsat(agent.avg_csat, targets)} />
          : <span className="text-xs text-slate-300">—</span>}
      </td>
      <td className="px-5 py-3.5 text-right">
        <span className="text-sm text-slate-600 font-medium">{fmtTime(agent.first_response_time)}</span>
      </td>
    </tr>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, sub, color = 'slate' }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color?: 'slate' | 'emerald' | 'amber' | 'red' | 'brand';
}) {
  const iconBg: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-500', emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600', red: 'bg-red-100 text-red-500', brand: 'bg-brand-100 text-brand-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg[color]}`}><Icon size={17} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-0.5">{label}</p>
          <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const now = new Date();

  // ── View mode: month vs week ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(now));

  const { from, to } = viewMode === 'month' ? monthRange(year, month) : weekRange(weekStart);
  const days = daysBetween(from, to);

  // period label
  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : (() => {
        const end = new Date(weekStart); end.setDate(weekStart.getDate() + 6);
        return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
      })();

  function prevPeriod() {
    if (viewMode === 'month') {
      if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    } else {
      setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
    }
  }
  function nextPeriod() {
    if (viewMode === 'month') {
      const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
      if (isCurrent) return;
      if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    } else {
      const nextMonday = new Date(weekStart); nextMonday.setDate(weekStart.getDate() + 7);
      if (nextMonday > now) return;
      setWeekStart(nextMonday);
    }
  }
  const isCurrentPeriod = viewMode === 'month'
    ? (year === now.getFullYear() && month === now.getMonth() + 1)
    : (new Date(weekStart).setDate(weekStart.getDate() + 7) > now.getTime());

  // ── Data fetching ───────────────────────────────────────────────────────────
  const [data,    setData]    = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [showAI,  setShowAI]  = useState(false);
  const [targets, setTargets] = useState<KPITargets>(DEFAULT_TARGETS);

  // AI summary
  const [summary,        setSummary]        = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Fetch KPI targets on mount
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(json => setTargets(json))
      .catch(err => console.error('Failed to fetch KPI targets:', err));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setSummary('');
    fetch(`/api/performance?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function generateSummary() {
    if (!data || summaryLoading) return;
    setSummaryLoading(true);
    fetch('/api/performance/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, from, to, periodLabel }),
    })
      .then(r => r.json())
      .then(json => setSummary(json.summary ?? ''))
      .catch(() => setSummary(''))
      .finally(() => setSummaryLoading(false));
  }

  // ── Parse agents ────────────────────────────────────────────────────────────
  const rawAgents: AgentStat[] = (() => {
    if (!data) return [];
    const a = data.agents as any;
    return a?.data?.data ?? a?.data ?? a?.agents ?? (Array.isArray(a) ? a : []);
  })();

  const humanAgents   = rawAgents.filter(a => a.agent_type === 'user' && a.messages_sent > 0);
  const aiAgents      = rawAgents.filter(a => a.agent_type === 'ai_agent');
  const inactiveCount = rawAgents.filter(a => a.agent_type === 'user' && a.messages_sent === 0).length;

  const primaryAgents = [...humanAgents].filter(a => PRIMARY_AGENT_IDS.includes(a.agent_id)).sort((a, b) => b.closed_tickets - a.closed_tickets);
  const otherAgents   = [...humanAgents].filter(a => !PRIMARY_AGENT_IDS.includes(a.agent_id)).sort((a, b) => b.closed_tickets - a.closed_tickets);
  const sortedAgents  = [...primaryAgents, ...otherAgents];

  // ── Parse overview ───────────────────────────────────────────────────────────
  const ov      = (data?.overview as any) ?? {};
  const ovData  = ov?.data?.data ?? ov?.metrics?.data ?? ov;
  const created  = ovData?.overview?.created_tickets?.current ?? 0;
  const closed   = ovData?.overview?.closed_tickets?.current  ?? 0;
  const teamFRT  = ovData?.overview?.first_response_time?.current ?? 0;
  const oneTouch = ovData?.productivity?.one_touch_tickets?.current ?? 0;

  // Chart data: daily volume
  const createdChartRaw: { date: number; current: number }[] = ovData?.overview?.chart_data?.created_tickets ?? [];
  const closedChartRaw:  { date: number; current: number }[] = ovData?.overview?.chart_data?.closed_tickets  ?? [];
  const volumeChartData = createdChartRaw.map((d, i) => ({
    date:    fmtShortDate(d.date),
    Created: d.current,
    Closed:  closedChartRaw[i]?.current ?? 0,
  }));

  // ── Parse CSAT ───────────────────────────────────────────────────────────────
  const csatObj  = (data?.csat as any) ?? {};
  const csatSumm = csatObj?.data?.data?.summary ?? csatObj?.csat?.summary ?? csatObj?.summary ?? {};
  const teamCsat      = csatSumm?.average_rating    ?? 0;
  const csatResponses = csatSumm?.total_responses   ?? 0;
  const satisfScore   = csatSumm?.satisfaction_score ?? 0;

  // Chart data: CSAT trend
  const csatTrendRaw: { date: string; average_rating: number; total_responses: number; satisfaction_score: number }[] =
    csatObj?.data?.data?.trend ?? [];
  const csatChartData = csatTrendRaw
    .filter(d => d.total_responses > 0)
    .map(d => ({
      date:   new Date(d.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      CSAT:   d.average_rating,
      Score:  d.satisfaction_score,
    }));

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Team Performance</h1>
          <p className="page-subtitle">Live data from Commslayer</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month / Week toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >Month</button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >Week</button>
          </div>

          {/* Period navigator */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1 shadow-sm">
            <button onClick={prevPeriod} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold text-slate-800 px-3 min-w-[140px] text-center">{periodLabel}</span>
            <button onClick={nextPeriod} disabled={isCurrentPeriod}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">KPI Targets:</span>
        {[
          { icon: MessageSquare, label: `${targets.repliesPerDay} replies/day` },
          { icon: Zap,           label: `${targets.resolveRate}% one-touch` },
          { icon: Star,          label: `CSAT ≥ ${targets.csat}` },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
            <Icon size={11} /> {label}
          </span>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Commslayer not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={4} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 space-y-3">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-8 w-20" />
              </div>
            ))}
          </div>
          <div className="card p-5">
            <SkeletonBlock className="h-48 w-full rounded-xl mb-4" />
          </div>
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : !error && (
        <>
          {/* Team summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <SummaryCard icon={MessageSquare} label="Conversations Created"
              value={created.toLocaleString()}
              sub={`${closed.toLocaleString()} closed (${created ? Math.round((closed / created) * 100) : 0}%)`}
              color="brand" />
            <SummaryCard icon={Clock} label="Team Avg First Response"
              value={fmtTime(teamFRT)} sub="across all agents"
              color={teamFRT > 14400 ? 'red' : teamFRT > 7200 ? 'amber' : 'emerald'} />
            <SummaryCard icon={Star} label="Team CSAT"
              value={teamCsat ? `${teamCsat.toFixed(1)} ★` : '—'}
              sub={csatResponses ? `${csatResponses} responses · ${satisfScore.toFixed(0)}% satisfied` : 'No responses yet'}
              color={teamCsat >= 4.0 ? 'emerald' : teamCsat >= targets.csat ? 'amber' : teamCsat ? 'red' : 'slate'} />
            <SummaryCard icon={Zap} label="One-Touch Rate"
              value={oneTouch ? `${oneTouch.toFixed(1)}%` : '—'}
              sub={`Target: ${targets.resolveRate}%`}
              color={oneTouch >= targets.resolveRate ? 'emerald' : oneTouch >= targets.resolveRate * 0.65 ? 'amber' : 'red'} />
          </div>

          {/* Insight strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {sortedAgents.length > 0 && (() => {
              const top = [...sortedAgents].sort((a, b) => (b.avg_csat || 0) - (a.avg_csat || 0)).find(a => a.avg_csat > 0);
              return top ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                  <div><p className="text-xs font-semibold text-emerald-800">Top CSAT</p>
                    <p className="text-xs text-emerald-700">{top.agent || top.agent_name} — {top.avg_csat.toFixed(1)} ★</p></div>
                </div>
              ) : null;
            })()}
            {sortedAgents.length > 0 && (
              <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                <TrendingUp size={16} className="text-brand-500 flex-shrink-0" />
                <div><p className="text-xs font-semibold text-brand-800">Most Tickets Closed</p>
                  <p className="text-xs text-brand-700">{sortedAgents[0].agent || sortedAgents[0].agent_name} — {sortedAgents[0].closed_tickets} tickets</p></div>
              </div>
            )}
            {csatResponses > 0 && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <Users size={16} className="text-slate-400 flex-shrink-0" />
                <div><p className="text-xs font-semibold text-slate-700">CSAT Response Rate</p>
                  <p className="text-xs text-slate-500">{csatResponses} responses · {csatSumm?.response_rate?.toFixed(1) ?? '—'}% of tickets</p></div>
              </div>
            )}
          </div>

          {/* Charts */}
          {(volumeChartData.length > 0 || csatChartData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Daily volume */}
              {volumeChartData.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Ticket Volume</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={volumeChartData} barGap={2} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                        interval={Math.floor(volumeChartData.length / 6)} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar dataKey="Created" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Closed"  fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* CSAT trend */}
              {csatChartData.length > 0 && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">CSAT Trend</h3>
                    <span className="text-xs text-slate-400">Target: ≥ {targets.csat} ★</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={csatChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                        interval={Math.floor(csatChartData.length / 6)} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                        formatter={(v: number) => [`${v.toFixed(1)} ★`, 'Avg Rating']} />
                      {/* Target line */}
                      <Line type="monotone" dataKey={() => targets.csat} stroke="#fca5a5" strokeDasharray="4 3"
                        strokeWidth={1.5} dot={false} name="Target" legendType="none" />
                      <Line type="monotone" dataKey="CSAT" stroke="#6366f1" strokeWidth={2}
                        dot={false} activeDot={{ r: 4 }} name="Avg Rating" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Agent scorecard */}
          <div className="card overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">Agent Scorecard</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {periodLabel} · {days} day{days !== 1 ? 's' : ''} · {humanAgents.length} active agents
                  {inactiveCount > 0 && ` · ${inactiveCount} inactive`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> On target</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Near target</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Below target</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Agent</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Closed</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Replies <span className="font-normal normal-case text-slate-400">/{targets.repliesPerDay}</span></th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">One-Touch <span className="font-normal normal-case text-slate-400">/{targets.resolveRate}%</span></th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CSAT <span className="font-normal normal-case text-slate-400">/≥{targets.csat}</span></th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Avg FRT</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">No agent activity for this period.</td></tr>
                  )}
                  {primaryAgents.length > 0 && (
                    <tr><td colSpan={6} className="px-5 pt-4 pb-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Support</span>
                    </td></tr>
                  )}
                  {primaryAgents.map(a => <AgentRow key={a.agent_id} agent={a} days={days} isPrimary targets={targets} />)}
                  {otherAgents.length > 0 && (
                    <tr><td colSpan={6} className="px-5 pt-5 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Management &amp; Other</span>
                        <span className="text-[10px] text-slate-400 font-normal normal-case tracking-normal">— monitored separately</span>
                      </div>
                    </td></tr>
                  )}
                  {otherAgents.map(a => <AgentRow key={a.agent_id} agent={a} days={days} isPrimary={false} targets={targets} />)}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Agent (collapsible) */}
          {aiAgents.length > 0 && (
            <div className="card overflow-hidden mb-4">
              <button onClick={() => setShowAI(v => !v)}
                className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center"><Bot size={14} className="text-violet-600" /></div>
                  <span className="text-sm font-semibold text-slate-700">AI Agent</span>
                  <span className="text-xs text-slate-400">{aiAgents.length} agent{aiAgents.length > 1 ? 's' : ''}</span>
                </div>
                <ChevronRight size={15} className={`text-slate-400 transition-transform ${showAI ? 'rotate-90' : ''}`} />
              </button>
              {showAI && (
                <div className="border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {aiAgents.map(agent => (
                        <tr key={agent.agent_id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0"><Bot size={14} className="text-violet-600" /></div>
                              <div>
                                <span className="font-medium text-slate-800">{agent.agent || agent.agent_name}</span>
                                <span className="ml-2 text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded uppercase tracking-wide">AI</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right"><span className="font-semibold text-slate-800">{agent.closed_tickets}</span>{agent.closed_tickets_percentage > 0 && <span className="text-xs text-slate-400 ml-1">({agent.closed_tickets_percentage.toFixed(1)}%)</span>}</td>
                          <td className="px-4 py-3.5 text-center"><span className="text-xs text-slate-500">{agent.messages_sent.toLocaleString()} msgs</span></td>
                          <td className="px-4 py-3.5 text-center">{agent.one_touch_tickets > 0 ? <span className="text-xs text-slate-600">{agent.one_touch_tickets.toFixed(1)}%</span> : <span className="text-xs text-slate-300">—</span>}</td>
                          <td className="px-4 py-3.5 text-center">{agent.avg_csat > 0 ? <span className="text-xs text-slate-600">{agent.avg_csat.toFixed(1)} ★</span> : <span className="text-xs text-slate-300">—</span>}</td>
                          <td className="px-5 py-3.5 text-right"><span className="text-sm text-slate-400">{fmtTime(agent.first_response_time)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Manager Briefing — manual trigger */}
          <div className="card p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-brand-500" />
                <span className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Manager Briefing</span>
                <span className="text-xs text-slate-400">· AI-generated</span>
              </div>
              {!summaryLoading && (
                <button
                  onClick={generateSummary}
                  disabled={!data}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={11} />
                  {summary ? 'Regenerate' : 'Generate'}
                </button>
              )}
            </div>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-1">
                <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                Analysing performance data…
              </div>
            ) : summary ? (
              <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">Click Generate to create an AI-written summary of this period's performance.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
