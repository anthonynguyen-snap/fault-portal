'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  LucideIcon,
  Sparkles,
  Tag,
  Truck,
  Package,
  Bell,
  Clock,
  CheckCircle,
  Send,
  Activity,
  CreditCard,
  Inbox,
  MessageSquare,
  Mail,
  UserX,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { DashboardStats, Return, ReplenishmentRequest, ReplenishmentStatus } from '@/types';
import {
  WeeklyFaultChartSkeleton,
} from '@/components/dashboard/DashboardCharts';

// Lazily loaded — Recharts excluded from initial bundle
const WeeklyFaultChart = dynamic(
  () => import('@/components/dashboard/DashboardCharts').then(m => ({ default: m.WeeklyFaultChart })),
  { ssr: false, loading: () => <WeeklyFaultChartSkeleton /> },
);
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT, faultTypeBadge } from '@/lib/utils';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/auth/AuthProvider';
import { WhatsNewModal } from '@/components/ui/WhatsNewModal';

// ── Today's Team Strip ────────────────────────────────────────────────────────
const SHIFT_LABELS: Record<string, string> = {
  'mon-fri': 'Mon–Fri',
  'tue-sat': 'Tue–Sat',
  'sun-thu': 'Sun–Thu',
};
type TeamMember = {
  id: string;
  name: string;
  colour: string;
  shift: string;
  scheduled: boolean;
  loggedIn: boolean;
  source?: 'roster' | 'override' | 'leave';
  statusLabel?: string;
  notes?: string;
};
type RosterChangeover = {
  date: string;
  members: { id: string; name: string; shift: string }[];
};

function TodaysTeam() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [changeover, setChangeover] = useState<RosterChangeover | null>(null);
  useEffect(() => {
    fetch('/api/team/status').then(r => r.json()).then(d => {
      setTeam(d.data || []);
      setChangeover(d.changeover || null);
    }).catch(() => {});
  }, []);
  if (!team.length) return null;
  const onShift = team.filter(m => m.scheduled);
  const offShift = team.filter(m => !m.scheduled);
  const missingLoginCount = onShift.filter(m => !m.loggedIn).length;
  const changeoverDate = changeover
    ? new Date(`${changeover.date}T00:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
    : '';
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">Today&apos;s Team</span>
        <div className="flex items-center gap-3 flex-wrap flex-1">
        {onShift.map(m => (
          <div
            key={m.id}
            title={[m.statusLabel, m.notes].filter(Boolean).join(' · ')}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
              m.loggedIn
                ? 'border-emerald-100 bg-emerald-50/50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <span className="relative flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: m.colour }} />
              {m.loggedIn && (
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-white" />
              )}
            </span>
            <span className="text-sm font-medium text-slate-700">{m.name}</span>
            <span className="text-xs text-slate-400">{SHIFT_LABELS[m.shift]}</span>
            {m.source === 'override' && (
              <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-100 rounded-full px-1.5 py-0.5">override</span>
            )}
            {!m.loggedIn && (
              <span className="text-[10px] text-red-600 font-semibold">not signed in</span>
            )}
          </div>
        ))}
        {offShift.length > 0 && (
          <>
            <span className="text-slate-200 text-xs">|</span>
            {offShift.map(m => (
              <div
                key={m.id}
                title={[m.statusLabel, m.notes].filter(Boolean).join(' · ')}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
                  m.source === 'leave'
                    ? 'bg-red-50 text-red-500'
                    : m.source === 'override'
                      ? 'bg-slate-100 text-slate-500'
                      : 'opacity-40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full block ${m.source === 'leave' ? 'bg-red-400' : 'bg-slate-300'}`} />
                <span className={`text-xs ${m.source === 'leave' ? 'text-red-600' : 'text-slate-400 line-through'}`}>{m.name}</span>
                {m.source !== 'roster' && (
                  <span className="text-[9px] font-bold uppercase">{m.source === 'leave' ? 'leave' : 'override off'}</span>
                )}
              </div>
            ))}
          </>
        )}
        </div>
        <div className="text-[10px] hidden sm:flex items-center gap-3 text-slate-400 flex-shrink-0">
          <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />signed in</span>
          {missingLoginCount > 0 && <span className="text-red-500 font-semibold">{missingLoginCount} not signed in</span>}
        </div>
      </div>
      {changeover && changeover.members.length > 0 && (
        <Link
          href={`/roster?date=${changeover.date}`}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 transition-colors hover:bg-amber-100"
        >
          <RotateCcw size={13} className="flex-shrink-0" />
          <span className="font-semibold">Weekend roster changeover this week</span>
          <span className="text-amber-700">From {changeoverDate}:</span>
          <span>
            {changeover.members.map(member => `${member.name} → ${SHIFT_LABELS[member.shift] ?? member.shift}`).join(' · ')}
          </span>
          <ArrowRight size={12} className="ml-auto flex-shrink-0" />
        </Link>
      )}
    </div>
  );
}

// ── Week helpers ───────────────────────────────────────────────────────────────
function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
// ── Quick Stat Cell ────────────────────────────────────────────────────────────
function QuickStat({
  label, value, sub, href, alert = false, trend,
}: {
  label: string; value: string | number; sub: string;
  href?: string; alert?: boolean; trend?: number | null;
}) {
  const cell = (
    <div className={`card p-4 h-full transition-shadow hover:shadow-md ${alert ? 'border-amber-200 bg-amber-50/40' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <p className={`text-3xl font-bold font-mono leading-none ${alert ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
      <div className="flex items-center justify-between mt-2 gap-2">
        <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>
        {trend != null && (
          <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
            trend > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {trend > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {Math.abs(trend) < 1 ? '<1' : Math.round(Math.abs(trend))}%
          </span>
        )}
      </div>
    </div>
  );
  return href
    ? <Link href={href} className="block h-full">{cell}</Link>
    : cell;
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, title, href, linkLabel,
}: {
  icon: LucideIcon;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-1 h-5 bg-brand-600 rounded-full flex-shrink-0" />
      <Icon size={15} className="text-slate-500 flex-shrink-0" />
      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
      <div className="flex-1 h-px bg-slate-200" />
      {href && linkLabel && (
        <Link href={href} className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1 flex-shrink-0">
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

// ── Main Dashboard Page ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { effectiveRole, viewingAsTeam, setViewingAsTeam } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allReturns, setAllReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Commslayer queue
  interface BreachingTicket { id: string; title: string; customer: string; inbox: string; ageSeconds: number; url: string; }
  interface QueueData { date: string; created: number; closed: number; frtSeconds: number; messagesSent: number; breachingTickets?: BreachingTicket[]; liveQueueError?: string; unassignedQueueUrl?: string; fetchedAt: string; }
  type FrtLevel = 'ok' | 'amber' | 'red';
  const FRT_AMBER_SECONDS = 24 * 3600;
  const FRT_RED_SECONDS = 48 * 3600;
  function fmtFRT(s: number) { if (!s || s <= 0) return '—'; const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60); if (d >= 1) return h > 0 ? `${d}d ${h}h` : `${d}d`; if (h>=1) return `${h}h ${m}m`; return `${m}m`; }
  function frtLevel(s: number): FrtLevel {
    if (s > FRT_RED_SECONDS) return 'red';
    if (s > FRT_AMBER_SECONDS) return 'amber';
    return 'ok';
  }
  const FRT_CARD: Record<FrtLevel, { card: string; iconBg: string; icon: string; value: string; sub: string; label: string }> = {
    ok:    { card: 'bg-emerald-50 border-emerald-200', iconBg: 'bg-emerald-100', icon: 'text-emerald-600', value: 'text-emerald-700', sub: 'under 24h target', label: 'Great pace' },
    amber: { card: 'bg-amber-50 border-amber-200', iconBg: 'bg-amber-100', icon: 'text-amber-500', value: 'text-amber-700', sub: 'within 48h max', label: 'Within target' },
    red:   { card: 'bg-red-50 border-red-200', iconBg: 'bg-red-100', icon: 'text-red-500', value: 'text-red-700', sub: 'over 48h max', label: 'Response needed' },
  };
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [queueError, setQueueError] = useState('');
  const [queueLoading, setQueueLoading] = useState(true);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [launches, setLaunches] = useState<{ id: string; name: string; description: string; price_aud: number | null; image_url: string; launch_date: string | null; link: string }[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function liveFRTSeconds(data: QueueData) {
    const fetchedAt = Date.parse(data.fetchedAt);
    if (Number.isNaN(fetchedAt)) return data.frtSeconds;
    return data.frtSeconds + Math.max(0, Math.floor((clockNow - fetchedAt) / 1000));
  }

  async function loadStats() {
    try {
      const [dashRes, returnsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/returns'),
      ]);
      const json = await dashRes.json();
      if (json.error) throw new Error(json.error);
      setStats(json.data);
      const returnsJson = await returnsRes.json();
      setAllReturns(returnsJson.data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Queue — non-fatal
    setQueueLoading(true);
    fetch('/api/commslayer/queue')
      .then(r => r.json())
      .then(j => { if (j?.error) setQueueError(j.error); else setQueue(j); })
      .catch(e => setQueueError(e.message ?? 'Failed'))
      .finally(() => setQueueLoading(false));
  }

  useEffect(() => {
    loadStats();
    fetch('/api/product-launches').then(r => r.json()).then(d => setLaunches(d.data ?? [])).catch(() => {});
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    loadStats();
  }

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={24} className="text-red-600" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">Failed to load dashboard</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={loadStats} className="btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // ── Action Required: pending follow-ups ───────────────────────────────────
  const actionPending = allReturns.filter(r => r.followUpStatus === 'Pending');
  const actionAges = actionPending.map(r => {
    const d = new Date(r.date.includes('T') ? r.date : r.date + 'T00:00:00');
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  });
  const oldestFollowUp = actionAges.length > 0 ? Math.max(...actionAges) : 0;
  const followUpLevel = oldestFollowUp >= 7 ? 'red' : oldestFollowUp >= 3 ? 'amber' : null;
  const actionNames = Array.from(new Set(actionPending.map(r => r.assignedTo.trim()).filter(Boolean))).join(', ');

  // ── Returns calculations ───────────────────────────────────────────────────
  const thisMonday = getMondayOf(new Date());
  const thisSunday = addDays(thisMonday, 6);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(thisMonday, -1);
  const weekReturns = allReturns.filter(r => r.stage === 'processed' && r.date >= fmtDate(thisMonday) && r.date <= fmtDate(thisSunday));
  const lastWeekReturns = allReturns.filter(r => r.stage === 'processed' && r.date >= fmtDate(lastMonday) && r.date <= fmtDate(lastSunday));
  const weekReturnsDelta = lastWeekReturns.length > 0
    ? ((weekReturns.length - lastWeekReturns.length) / lastWeekReturns.length) * 100 : null;
  const weekRefunded = weekReturns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
  const pendingFollowUps = allReturns.filter(r => r.followUpStatus === 'Pending').length;

  // ── Week-over-week trend deltas ───────────────────────────────────────────
  const wt = stats.weeklyTrend ?? [];
  const wtCurr = wt.length >= 1 ? wt[wt.length - 1] : null;
  const wtPrev = wt.length >= 2 ? wt[wt.length - 2] : null;
  const weekCountDelta = wtCurr && wtPrev && wtPrev.count > 0
    ? ((wtCurr.count - wtPrev.count) / wtPrev.count) * 100 : null;
  const weekCostDelta = wtCurr && wtPrev && wtPrev.cost > 0
    ? ((wtCurr.cost - wtPrev.cost) / wtPrev.cost) * 100 : null;

  // ── Awaiting parcel count ─────────────────────────────────────────────────
  const awaitingParcel = allReturns.filter(r => r.stage === 'requested' && !r.parcelReceived).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── What's New modal ──────────────────────────────────────────────── */}
      <WhatsNewModal />

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of fault cases, claims and returns</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/cases/new" className="btn-primary">+ Submit Fault</Link>
        </div>
      </div>

      {/* Product Launches tile */}
      {launches.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-purple-50">
            <span className="text-base">🚀</span>
            <h2 className="text-sm font-semibold text-brand-900">Product Launches</h2>
          </div>
          <div className={`grid divide-slate-100 ${launches.length === 1 ? 'grid-cols-1' : launches.length === 2 ? 'grid-cols-2 divide-x' : 'grid-cols-3 divide-x'}`}>
            {launches.map(l => {
              const isLive = l.launch_date ? new Date(l.launch_date) <= new Date() : true;
              return (
                <div key={l.id} className="p-4 flex gap-3 items-start">
                  {l.image_url && (
                    <img src={l.image_url} alt={l.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-slate-100" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{l.name}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isLive ? '✅ Live' : '🚀 Coming Soon'}
                      </span>
                    </div>
                    {l.price_aud != null && <p className="text-sm font-bold text-brand-700 mt-0.5">${l.price_aud.toFixed(2)} AUD</p>}
                    {l.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{l.description}</p>}
                    {l.launch_date && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {isLive ? 'Launched' : 'Launches'} {new Date(l.launch_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    {l.link && (
                      <a href={l.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-brand-600 hover:underline">
                        View product →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewingAsTeam && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div>
            <p className="font-semibold">Viewing as team member</p>
            <p className="text-xs text-amber-700">Dashboard sections and sidebar tabs are previewing the team view. Your admin access has not changed.</p>
          </div>
          <button
            type="button"
            onClick={() => setViewingAsTeam(false)}
            className="ml-auto rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            Return to admin view
          </button>
        </div>
      )}

      {/* ── Action Required Banner ─────────────────────────────────────────── */}
      {followUpLevel && (
        <Link href="/returns?filter=follow-up" className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
          followUpLevel === 'red'
            ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
            : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
        }`}>
          <AlertTriangle size={16} className={followUpLevel === 'red' ? 'text-red-500 flex-shrink-0' : 'text-amber-500 flex-shrink-0'} />
          <span>
            <span className="font-semibold">Action required: </span>
            {actionPending.length} return{actionPending.length !== 1 ? 's' : ''} pending follow-up
            {actionNames && <span className="font-normal"> — {actionNames}</span>}
            {oldestFollowUp > 0 && <span className="font-normal opacity-75"> — oldest {oldestFollowUp} day{oldestFollowUp !== 1 ? 's' : ''}</span>}
          </span>
          <ArrowRight size={14} className="ml-auto flex-shrink-0 opacity-60" />
        </Link>
      )}

      {/* ── Major sale team alert ───────────────────────────────────────────── */}
      <MajorSaleBanner />

      {/* ── Quick Stat Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickStat
          label="Faults This Week"
          value={stats.faultsThisWeek}
          sub={`${stats.faultsFY} faults this financial year`}
          trend={weekCountDelta}
          href="/cases"
        />
        <QuickStat
          label="Cost at Risk"
          value={formatCurrency(stats.costLostThisWeek)}
          sub="this week"
          trend={weekCostDelta}
        />

        <QuickStat
          label="Follow-ups Due"
          value={pendingFollowUps}
          sub="returns need action"
          href="/returns?filter=follow-up"
          alert={pendingFollowUps > 0}
        />
        <QuickStat
          label="Returns This Week"
          value={weekReturns.length}
          sub="processed this week"
          trend={weekReturnsDelta}
          href="/returns"
        />
      </div>

      {/* ── Today's Team ─────────────────────────────────────────────────────── */}
      <TodaysTeam />

      {/* ── Today's Activity (Commslayer) ────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex">
              <Inbox size={15} className="text-brand-600" />
              {!queueLoading && !queueError && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white animate-pulse" />}
            </div>
            <span className="text-sm font-semibold text-slate-800">Today's Activity</span>
            <span className="text-xs text-slate-400">· Commslayer</span>
          </div>
          {queue && <span className="text-[10px] text-slate-400 font-mono">{queue.date} · {new Date(queue.fetchedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {queueLoading && (
          <div className="grid grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        )}
        {!queueLoading && queueError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-mono">{queueError}</p>
        )}
        {!queueLoading && queue && (() => {
          const liveFrt = liveFRTSeconds(queue);
          const level = frtLevel(liveFrt);
          const tone = FRT_CARD[level];
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0"><MessageSquare size={14} className="text-brand-600" /></div>
                  <div><p className="text-xs text-slate-500 font-medium">Created</p><p className="text-xl font-bold text-slate-900 leading-tight">{queue.created}</p><p className="text-[10px] text-slate-400">tickets today</p></div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><UserX size={14} className="text-emerald-600" /></div>
                  <div><p className="text-xs text-slate-500 font-medium">Closed</p><p className="text-xl font-bold text-emerald-700 leading-tight">{queue.closed}</p><p className="text-[10px] text-slate-400">resolved today</p></div>
                </div>
                <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${tone.card}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.iconBg}`}><Clock size={14} className={tone.icon} /></div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-slate-500 font-medium">Avg FRT</p>
                      <span className={`text-[9px] font-bold uppercase ${
                        level === 'red' ? 'text-red-600' : level === 'amber' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>{tone.label}</span>
                    </div>
                    <p className={`text-xl font-bold leading-tight ${tone.value}`}>{fmtFRT(liveFrt)}</p>
                    <p className="text-[10px] text-slate-400">{tone.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0"><Mail size={14} className="text-indigo-500" /></div>
                  <div><p className="text-xs text-slate-500 font-medium">Messages</p><p className="text-xl font-bold text-slate-900 leading-tight">{queue.messagesSent}</p><p className="text-[10px] text-slate-400">sent today</p></div>
                </div>
              </div>
              {/* ── Oldest unassigned ticket alert ───────────────────────── */}
              {(() => {
                const oldest = queue.breachingTickets?.[0];
                if (!oldest || oldest.ageSeconds < 86400) return null; // < 24h, skip
                const isRed = oldest.ageSeconds >= 72 * 3600; // 3+ days = red
                return (
                  <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                    isRed
                      ? 'bg-red-50 border-red-300 text-red-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <AlertTriangle size={15} className={`mt-0.5 flex-shrink-0 ${isRed ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isRed && (
                          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                          </span>
                        )}
                        <p className="text-xs font-bold">
                          {isRed ? 'Neglected ticket: unassigned for over 3 days' : 'Old unassigned ticket needs attention'}
                        </p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isRed
                            ? 'border-red-300 bg-white/70 text-red-700'
                            : 'border-amber-300 bg-white/70 text-amber-700'
                        }`}>
                          {fmtFRT(oldest.ageSeconds)} old
                        </span>
                      </div>
                      <p className="text-xs opacity-80 mt-0.5">
                        {isRed
                          ? 'Assign this ticket immediately — it has been waiting over 3 days with no response.'
                          : 'This ticket has been unassigned for over a day. Assign it soon to stay within SLA.'}
                      </p>
                      <a
                        href={oldest.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-white transition-colors ${
                          isRed ? 'border-red-200/70 bg-white/60 text-red-800' : 'border-amber-200/70 bg-white/60 text-amber-800'
                        }`}
                      >
                        <span className="font-mono font-bold">#{oldest.id}</span>
                        <span className="font-semibold">{fmtFRT(oldest.ageSeconds)}</span>
                        <span className="max-w-[260px] truncate opacity-80">{oldest.customer} · {oldest.title}</span>
                        <ExternalLink size={11} className="flex-shrink-0 opacity-60" />
                      </a>
                    </div>
                  </div>
                );
              })()}

              {queue.frtSeconds > 0 && (
                <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                  level === 'red'
                    ? 'bg-red-50 border-red-300 text-red-800 shadow-[0_0_0_1px_rgba(248,113,113,0.12)]'
                    : level === 'amber'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  {level === 'ok'
                    ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                    : <AlertTriangle size={15} className={`mt-0.5 flex-shrink-0 ${level === 'red' ? 'text-red-500' : 'text-amber-500'}`} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {level === 'red' && (
                        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                        </span>
                      )}
                      <p className="text-xs font-bold">
                        {level === 'red'
                          ? 'FRT BREACH: unassigned first replies overdue'
                          : level === 'amber'
                            ? 'Within target: keep first replies under 48h'
                            : 'Great pace: first replies under 24h'}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        level === 'red'
                          ? 'border-red-300 bg-white/70 text-red-700'
                          : level === 'amber'
                            ? 'border-amber-300 bg-white/70 text-amber-700'
                            : 'border-emerald-300 bg-white/70 text-emerald-700'
                      }`}>
                        Current {fmtFRT(liveFrt)} · Max 48h
                      </span>
                      {level === 'red' && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {fmtFRT(liveFrt - FRT_RED_SECONDS)} over breach
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-80 mt-0.5">
                      {level === 'red'
                        ? 'Work unassigned tickets oldest-first until FRT is back under 48h.'
                        : level === 'amber'
                          ? 'Still within guidelines. Prioritise unassigned tickets if volume climbs.'
                          : 'Kudos to the team. Keep this rhythm.'}
                    </p>
                    {level === 'red' && queue.breachingTickets && queue.breachingTickets.length > 0 && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {queue.breachingTickets.slice(0, 4).map(ticket => (
                          <a
                            key={ticket.id}
                            href={ticket.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-red-200/70 bg-white/70 px-2.5 py-2 text-red-800 hover:bg-white transition-colors"
                          >
                            <span className="font-mono text-[11px] font-bold">#{ticket.id}</span>
                            <span className="text-xs font-semibold whitespace-nowrap">{fmtFRT(ticket.ageSeconds)}</span>
                            <span className="min-w-0 flex-1 truncate text-xs">{ticket.customer} · {ticket.title}</span>
                            <ExternalLink size={11} className="flex-shrink-0 opacity-60" />
                          </a>
                        ))}
                      </div>
                    )}
                    {level === 'red' && !queue.breachingTickets?.length && queue.unassignedQueueUrl && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <a
                          href={queue.unassignedQueueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                            level === 'red'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-amber-600 text-white hover:bg-amber-700'
                          }`}
                        >
                          Open Unassigned in Commslayer <ExternalLink size={11} />
                        </a>
                        <span className="text-[11px] opacity-70">Ticket list not available via API yet.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Chart + AI Briefing (2/3 + 1/3) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <WeeklyFaultChart
            weeklyTrend={stats.weeklyTrend}
            weekCountDelta={weekCountDelta}
            weekCostDelta={weekCostDelta}
          />
        </div>
        <div className="lg:col-span-1">
          {isAdmin ? <AiBriefingCard /> : <TodayActivityCard />}
        </div>
      </div>

      {/* ── Recent Cases + Today's Activity (admin) ───────────────────────────── */}
      <div className={`grid grid-cols-1 gap-5 ${isAdmin ? 'lg:grid-cols-3' : ''}`}>
        {/* Recent Cases */}
        <div className={`card overflow-hidden ${isAdmin ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 8 fault cases submitted</p>
            </div>
            <Link href="/cases" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Product</th>
                  <th>Fault</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCases.slice(0, 8).map((c) => (
                  <Link key={c.id} href={`/cases/${c.id}`} legacyBehavior>
                    <tr className="cursor-pointer">
                      <td className="font-semibold font-mono text-brand-600">{c.orderNumber}</td>
                      <td className="max-w-[160px] truncate" title={c.product}>{c.product}</td>
                      <td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${faultTypeBadge(c.faultType)}`}>{c.faultType}</span></td>
                      <td className="text-slate-400 text-xs font-mono whitespace-nowrap">{formatDate(c.date)}</td>
                      <td>
                        <span className={`badge text-[10px] ${STATUS_STYLES[c.claimStatus]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                          {c.claimStatus}
                        </span>
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today's Activity — admin only, beside recent cases */}
        {isAdmin && (
          <div className="lg:col-span-1">
            <TodayActivityCard />
          </div>
        )}
      </div>

      {/* ── Manufacturer + Fault Type breakdown ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By Manufacturer */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">By Manufacturer</h3>
              <p className="text-xs text-slate-400 mt-0.5">Top manufacturers by fault count</p>
            </div>
            <Link href="/cases" className="text-xs text-brand-600 hover:underline flex items-center gap-1">View all <ArrowRight size={11} /></Link>
          </div>
          <div className="space-y-3">
            {stats.faultsByManufacturer.slice(0, 6).map((mfr, i) => {
              const max = stats.faultsByManufacturer[0]?.count || 1;
              const pct = Math.round((mfr.count / max) * 100);
              const barColors = ['#1591b3', '#1591b3cc', '#1591b3aa', '#1591b388', '#1591b366', '#1591b344'];
              return (
                <div key={mfr.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                      <span className="font-medium text-slate-700 truncate">{mfr.name}</span>
                    </div>
                    <span className="text-slate-400 ml-2 flex-shrink-0 font-mono text-[11px]">{mfr.count} · {formatCurrency(mfr.cost)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColors[i] ?? '#1591b344' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Fault Type */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">By Fault Type</h3>
              <p className="text-xs text-slate-400 mt-0.5">Most common fault categories</p>
            </div>
          </div>
          <div className="space-y-0.5">
            {stats.topFaultTypes.map((ft, i) => {
              const rankStyles = ['bg-brand-600 text-white','bg-brand-500 text-white','bg-brand-400 text-white','bg-slate-200 text-slate-600','bg-slate-100 text-slate-500','bg-slate-100 text-slate-400'];
              return (
                <div key={ft.name} className={`flex items-center justify-between px-3 py-2 rounded-lg ${i < 3 ? 'bg-brand-50/60' : 'hover:bg-slate-50'} transition-colors`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${rankStyles[i] ?? 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                    <span className="text-sm text-slate-700">{ft.name}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>{ft.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Returns summary row ───────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">Returns</h3>
          </div>
          <Link href="/returns" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">View all <ArrowRight size={11} /></Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className="px-5 py-4">
            <p className="text-2xl font-bold font-mono text-slate-900">{weekReturns.length}</p>
            <p className="text-xs text-slate-400 mt-1">Returns this week</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold font-mono text-slate-900">{formatCurrency(weekRefunded)}</p>
            <p className="text-xs text-slate-400 mt-1">Refunded this week</p>
          </div>
          <div className="px-5 py-4">
            <p className={`text-2xl font-bold font-mono ${pendingFollowUps > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{pendingFollowUps}</p>
            <p className="text-xs text-slate-400 mt-1">Pending follow-ups</p>
          </div>
        </div>
      </div>

      {/* ── Replenishment summary row — admin only ────────────────────────────── */}
      {isAdmin && <ReplenishmentSummaryRow />}

      {/* ── Promotions strip ─────────────────────────────────────────────────── */}
      <ActivePromosStrip />

    </div>
  );
}

// ── Replenishment Section ─────────────────────────────────────────────────────
const REPL_STATUS_STYLES: Record<ReplenishmentStatus, string> = {
  'Pending':              'bg-amber-100 text-amber-700',
  'Ordered':              'bg-blue-100 text-blue-700',
  'Partially Dispatched': 'bg-orange-100 text-orange-700',
  'Dispatched':           'bg-emerald-100 text-emerald-700',
  'Delivered':            'bg-slate-100 text-slate-600',
};
const REPL_STATUS_ICONS: Record<ReplenishmentStatus, React.ReactNode> = {
  'Pending':              <Clock size={10} />,
  'Ordered':              <Package size={10} />,
  'Partially Dispatched': <Send size={10} />,
  'Dispatched':           <Send size={10} />,
  'Delivered':            <CheckCircle size={10} />,
};

function ReplenishmentSection({ sectionHeader }: { sectionHeader: React.ReactNode }) {
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/replenishment').then(r => r.json()),
      fetch('/api/replenishment/alerts').then(r => r.json()),
    ]).then(([reqJson, alertJson]) => {
      setRequests(reqJson.data ?? []);
      setAlertCount(alertJson.count ?? 0);
    }).catch(err => {
      console.error('[ReplenishmentSection] fetch failed:', err);
      setError(true);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <>
      {sectionHeader}
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    </>
  );

  if (error) return (
    <>
      {sectionHeader}
      <p className="text-sm text-slate-500 px-1">Could not load replenishment data. Please refresh.</p>
    </>
  );

  const pending = requests.filter(r => r.status === 'Pending').length;
  const active  = requests.filter(r => ['Ordered','Partially Dispatched'].includes(r.status)).length;
  const recent  = requests
    .filter(r => ['Pending','Ordered','Partially Dispatched'].includes(r.status))
    .slice(0, 5);

  if (!requests.length) return null;

  return (
    <>
      {sectionHeader}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-slate-900">{pending}</p>
            <p className="text-xs text-amber-600 font-medium">Pending orders</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Truck size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-slate-900">{active}</p>
            <p className="text-xs text-blue-600 font-medium">In transit</p>
          </div>
        </div>
        <div className={`card p-4 flex items-center gap-3 ${alertCount > 0 ? 'border-orange-200' : ''}`}
          style={{ background: alertCount > 0 ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${alertCount > 0 ? 'bg-orange-100' : 'bg-slate-100'}`}>
            <Bell size={16} className={alertCount > 0 ? 'text-orange-500' : 'text-slate-400'} />
          </div>
          <div>
            <p className={`text-2xl font-bold font-mono ${alertCount > 0 ? 'text-orange-700' : 'text-slate-400'}`}>{alertCount}</p>
            <p className={`text-xs font-medium ${alertCount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
              3PL tracking needed
            </p>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card overflow-hidden" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Active Orders</h3>
            <p className="text-xs text-slate-400 mt-0.5">Pending and in-progress replenishment requests</p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {recent.map(r => (
                <Link key={r.id} href={`/replenishment/${r.id}`} legacyBehavior>
                  <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-400">{r.date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.store === 'Adelaide Popup' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                      }`}>{r.store}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {r.items.length} items
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${REPL_STATUS_STYLES[r.status as ReplenishmentStatus]}`}>
                        {REPL_STATUS_ICONS[r.status as ReplenishmentStatus]}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400"><ArrowRight size={13} /></td>
                  </tr>
                </Link>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}

// ── Replenishment Summary Row (dashboard) ─────────────────────────────────────
function ReplenishmentSummaryRow() {
  const [pending, setPending]       = useState<number | null>(null);
  const [inTransit, setInTransit]   = useState<number | null>(null);
  const [alertCount, setAlertCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/replenishment').then(r => r.json()),
      fetch('/api/replenishment/alerts').then(r => r.json()),
    ]).then(([reqJson, alertJson]) => {
      const requests: ReplenishmentRequest[] = reqJson.data ?? [];
      setPending(requests.filter(r => r.status === 'Pending').length);
      setInTransit(requests.filter(r => ['Ordered', 'Partially Dispatched'].includes(r.status)).length);
      setAlertCount(alertJson.count ?? 0);
    }).catch(err => console.error('[ReplenishmentSummaryRow]', err));
  }, []);

  // Don't render until data loaded — keeps layout stable
  if (pending === null) return null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Truck size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Replenishment</h3>
        </div>
        <Link href="/replenishment" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
          View all <ArrowRight size={11} />
        </Link>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div className="px-5 py-4">
          <p className="text-2xl font-bold font-mono text-slate-900">{pending}</p>
          <p className="text-xs text-slate-400 mt-1">Pending orders</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-2xl font-bold font-mono text-slate-900">{inTransit}</p>
          <p className="text-xs text-slate-400 mt-1">In transit</p>
        </div>
        <div className="px-5 py-4">
          <p className={`text-2xl font-bold font-mono ${alertCount && alertCount > 0 ? 'text-orange-600' : 'text-slate-900'}`}>{alertCount ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Tracking alerts</p>
        </div>
      </div>
    </div>
  );
}

// ── AI Briefing Card ───────────────────────────────────────────────────────────
type SummaryMode = 'briefing' | 'trends' | 'monthly' | 'digest';

const MODES: { key: SummaryMode; label: string; description: string }[] = [
  { key: 'briefing', label: 'Daily Briefing',   description: 'What needs your attention today' },
  { key: 'trends',   label: 'Fault Trends',     description: 'Patterns and spikes in fault data' },
  { key: 'monthly',  label: 'Monthly Trends',   description: '12-month fault breakdown by product and type' },
  { key: 'digest',   label: 'Weekly Digest',    description: 'Full summary across all areas' },
];

// ── Today's Activity Card ──────────────────────────────────────────────────────
interface ActivityRow {
  id: string; ts: string; actor: string; action: string;
  entityType: string; entityId: string; entityLabel: string;
  detail: Record<string, unknown>;
}

const ACTIVITY_ENTITY_CONFIG: Record<string, { color: string; icon: LucideIcon }> = {
  Refund:        { color: 'bg-blue-500',   icon: CreditCard    },
  Return:        { color: 'bg-orange-500', icon: RotateCcw     },
  Case:          { color: 'bg-red-500',    icon: AlertTriangle },
  Replenishment: { color: 'bg-purple-500', icon: Truck         },
};

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  'refund.submitted':      'Refund submitted',
  'refund.processed':      'Refund processed',
  'refund.rejected':       'Refund rejected',
  'refund.updated':        'Refund updated',
  'return.logged':         'Return logged',
  'return.updated':        'Return updated',
  'case.created':          'Fault case opened',
  'case.updated':          'Fault case updated',
  'replenishment.created': 'Replenishment requested',
  'replenishment.status':  'Replenishment updated',
};

function TodayActivityCard({ sectionHeader }: { sectionHeader?: React.ReactNode }) {
  const [rows, setRows]       = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    fetch('/api/activity?days=1')
      .then(r => r.json())
      .then(d => setRows(d.data ?? []))
      .catch(err => {
        console.error('[TodayActivityCard] fetch failed:', err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col">
      {sectionHeader && sectionHeader}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1">
        {loading && (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                  <div className="h-2.5 bg-slate-50 rounded animate-pulse w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="px-4 py-3 text-sm text-slate-500">Could not load activity. Please refresh.</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <Activity size={24} className="text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No activity yet today</p>
            <p className="text-xs text-slate-300 mt-0.5">Actions will appear here as the team works</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="divide-y divide-slate-50">
            {rows.slice(0, 8).map(row => {
              const cfg  = ACTIVITY_ENTITY_CONFIG[row.entityType];
              const Icon = cfg?.icon ?? Activity;
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg?.color ?? 'bg-slate-400'}`}>
                    <Icon size={13} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">
                      <span className="font-medium">{ACTIVITY_ACTION_LABELS[row.action] ?? row.action}</span>
                      {row.entityLabel && (
                        <span className="text-slate-400 font-mono text-xs ml-1.5">{row.entityLabel}</span>
                      )}
                    </p>
                    {row.actor && <p className="text-xs text-slate-400">{row.actor}</p>}
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(row.ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              );
            })}
            {rows.length > 8 && (
              <div className="px-4 py-2.5 text-center">
                <Link href="/log" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  +{rows.length - 8} more — view full log
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AiBriefingCard() {
  const [mode, setMode]           = useState<SummaryMode>('briefing');
  const [summary, setSummary]     = useState<Partial<Record<SummaryMode, string>>>({});
  const [generated, setGenerated] = useState<Partial<Record<SummaryMode, Date>>>({});
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: mode }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSummary(prev => ({ ...prev, [mode]: json.summary }));
      setGenerated(prev => ({ ...prev, [mode]: new Date() }));
    } catch {
      setError('Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const currentSummary   = summary[mode];
  const currentGenerated = generated[mode];
  const currentMode      = MODES.find(m => m.key === mode)!;

  function fmtAgo(d: Date) {
    const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
            <Sparkles size={14} className="text-brand-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">AI Summary</h2>
            <p className="text-xs text-slate-400">Powered by Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentGenerated && !loading && (
            <span className="text-[10px] text-slate-400 font-medium">
              Updated {fmtAgo(currentGenerated)}
            </span>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary text-xs py-1.5 px-3 gap-1.5 disabled:opacity-60"
          >
            {loading
              ? <><RefreshCw size={12} className="animate-spin" /> Generating...</>
              : <><Sparkles size={12} /> {currentSummary ? 'Regenerate' : 'Generate'}</>
            }
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === m.key
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="px-5 py-5 min-h-[120px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <RefreshCw size={20} className="animate-spin text-brand-400" />
            <p className="text-xs text-slate-400">Analysing your portal data...</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">
            <AlertTriangle size={14} /> {error}
          </div>
        ) : currentSummary ? (
          <p className="text-sm text-slate-700 leading-relaxed">{currentSummary}</p>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <Sparkles size={22} className="text-slate-200" />
            <p className="text-sm font-medium text-slate-500">{currentMode.label}</p>
            <p className="text-xs text-slate-400">{currentMode.description}</p>
            <button onClick={generate} className="mt-2 btn-primary text-xs py-1.5 px-4 gap-1.5">
              <Sparkles size={12} /> Generate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Shared promo helpers ───────────────────────────────────────────────────────
type PromoStrip = {
  id: string; name: string; code: string; platform: string;
  description: string; discountType: string; discountValue: string;
  productsCovered: string; notes: string; startDate: string; startTime: string; endDate: string | null; endTime: string;
  isMajor: boolean; enabled?: boolean;
};

const STORE_ORDER = ['All Stores', 'AU (+ Popup)', 'US', 'UK-NZ-ROW'] as const;

const STORE_META: Record<string, { label: string; bg: string; text: string }> = {
  'AU (+ Popup)': { label: '🇦🇺 AU',  bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'US':           { label: '🇺🇸 US',  bg: 'bg-blue-100',    text: 'text-blue-700'    },
  'UK-NZ-ROW':    { label: '🌐 ROW',  bg: 'bg-purple-100',  text: 'text-purple-700'  },
  'All Stores':   { label: '🌐 All',  bg: 'bg-brand-100',   text: 'text-brand-700'   },
};

function fmtShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
function fmtPromoTime(time?: string | null) {
  if (!time) return '';
  const [hh = '0', mm = '0'] = time.split(':');
  const date = new Date();
  date.setHours(Number(hh), Number(mm), 0, 0);
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}
function fmtShortDateTime(date: string, time?: string | null) {
  return `${fmtShort(date)}${time ? `, ${fmtPromoTime(time)}` : ''}`;
}
function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(isoDate + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
}
function discountStr(p: PromoStrip): string | null {
  if (!p.discountValue) return null;
  if (p.discountType === '% Off') return `${p.discountValue}% off`;
  if (p.discountType === '$ Off') return `$${p.discountValue} off`;
  return `${p.discountValue} ${p.discountType}`;
}

// ── Major Sale Banner ─────────────────────────────────────────────────────────
function MajorSaleBanner() {
  const [sales, setSales] = useState<PromoStrip[]>([]);

  useEffect(() => {
    fetch('/api/promotions')
      .then(r => r.json())
      .then(d => {
        const today = new Date().toISOString().slice(0, 10);
        const todayStart = new Date(today + 'T00:00:00');
        const soonCutoff = new Date(todayStart);
        soonCutoff.setDate(soonCutoff.getDate() + 14);
        setSales((d.data ?? []).filter((p: PromoStrip) =>
          p.isMajor &&
          p.enabled !== false &&
          (!p.endDate || p.endDate >= today) &&
          new Date(p.startDate + 'T00:00:00') <= soonCutoff
        ));
      })
      .catch(err => console.error('[MajorSaleBanner]', err));
  }, []);

  if (!sales.length) return null;

  return (
    <>
      {sales.map(p => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const startsAt = new Date(p.startDate + 'T00:00:00');
        const startsIn = Math.ceil((startsAt.getTime() - today.getTime()) / 86400000);
        const isUpcoming = startsIn > 0;
        const daysLeft = p.endDate ? Math.ceil((new Date(p.endDate + 'T00:00:00').getTime() - today.getTime()) / 86400000) : null;
        const disc = discountStr(p);

        return (
          <div key={p.id} className={`card overflow-hidden ${isUpcoming ? 'border-orange-300 shadow-sm shadow-orange-100' : 'border-amber-200'}`}>
            {/* Amber header bar */}
            <div className={`flex items-center gap-2.5 px-5 py-3 border-b ${isUpcoming ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isUpcoming ? 'bg-orange-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isUpcoming ? 'bg-orange-500' : 'bg-amber-500'}`} />
              </span>
              <span className={`text-xs font-bold uppercase tracking-widest ${isUpcoming ? 'text-orange-700' : 'text-amber-700'}`}>
                {isUpcoming ? 'Major Sale Coming Soon' : 'Major Sale Active'}
              </span>
              <span className={`text-xs opacity-80 ${isUpcoming ? 'text-orange-700' : 'text-amber-600'}`}>
                {isUpcoming ? '— prepare team replies and order expectations' : '— all other promotions are overridden'}
              </span>
              <Link href="/promotions" className={`ml-auto hidden sm:flex items-center gap-1 text-xs font-semibold hover:underline ${isUpcoming ? 'text-orange-700' : 'text-amber-700'}`}>
                View details <ArrowRight size={11} />
              </Link>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              {/* Main info */}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 leading-snug">{p.name}</p>
                {p.description && <p className="text-sm text-slate-500 mt-0.5">{p.description}</p>}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {disc && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                      {disc}
                    </span>
                  )}
                  {p.code && (
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 tracking-wider">
                      {p.code}
                    </span>
                  )}
                  {p.platform && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STORE_META[p.platform]?.bg ?? 'bg-slate-100'} ${STORE_META[p.platform]?.text ?? 'text-slate-600'}`}>
                      {STORE_META[p.platform]?.label ?? p.platform}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {fmtShortDateTime(p.startDate, p.startTime)} → {p.endDate ? fmtShortDateTime(p.endDate, p.endTime) : 'ongoing'}
                  </span>
                </div>
                {p.notes && (
                  <p className={`mt-2 text-sm italic ${isUpcoming ? 'text-orange-700' : 'text-amber-700'}`}>
                    {p.notes}
                  </p>
                )}
              </div>

              {/* Countdown */}
              {(isUpcoming || (daysLeft !== null && daysLeft >= 0)) && (
                <div className={`flex-shrink-0 text-center rounded-xl border px-5 py-3 ${isUpcoming ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-3xl font-extrabold leading-none ${isUpcoming ? 'text-orange-600' : 'text-amber-600'}`}>
                    {isUpcoming ? startsIn : daysLeft}
                  </p>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide mt-1 ${isUpcoming ? 'text-orange-500' : 'text-amber-500'}`}>
                    {isUpcoming
                      ? startsIn === 1 ? 'day until start' : 'days until start'
                      : daysLeft === 1 ? 'day left' : 'days left'}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Active Promotions Strip ────────────────────────────────────────────────────
function ActivePromosStrip() {
  const [promos, setPromos] = useState<PromoStrip[]>([]);

  useEffect(() => {
    fetch('/api/promotions')
      .then(r => r.json())
      .then(d => {
        const today = new Date().toISOString().slice(0, 10);
        setPromos((d.data ?? []).filter((p: PromoStrip) =>
          !p.isMajor && p.enabled !== false && (!p.endDate || p.endDate >= today)
        ));
      })
      .catch(err => console.error('[ActivePromosStrip]', err));
  }, []);

  if (!promos.length) return null;

  // Group by store order
  const groups = STORE_ORDER
    .map(store => ({ store, items: promos.filter(p => p.platform === store) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Tag size={13} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Live Promotions</h3>
          <span className="text-xs text-slate-400">{promos.length} active</span>
        </div>
        <Link href="/promotions" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
          Manage <ArrowRight size={11} />
        </Link>
      </div>

      {/* Promo rows */}
      <div className="divide-y divide-slate-100">
        {groups.map(({ store, items }) => {
          const meta = STORE_META[store];
          return items.map((p, idx) => {
            const today2 = new Date().toISOString().slice(0, 10);
            const upcoming = p.startDate > today2;
            const days = p.endDate ? daysUntil(p.endDate) : null;
            const daysToStart = upcoming ? daysUntil(p.startDate) : null;
            const expiring = days !== null && days <= 7 && days >= 0;
            const urgent   = days !== null && days <= 2 && days >= 0;
            const disc = discountStr(p);

            return (
              <div key={p.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors ${upcoming ? 'opacity-60' : ''}`}>

                {/* Store badge — only show on first item of each group */}
                <div className="w-14 flex-shrink-0">
                  {idx === 0 && meta && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.text}`}>
                      {meta.label}
                    </span>
                  )}
                </div>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold text-slate-800 truncate ${upcoming ? 'text-slate-400' : ''}`}>{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{p.description}</p>
                  )}
                </div>

                {/* Discount */}
                {disc && (
                  <span className="flex-shrink-0 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                    {disc}
                  </span>
                )}

                {/* Code chip */}
                {p.code ? (
                  <span className="flex-shrink-0 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 tracking-wider">
                    {p.code}
                  </span>
                ) : (
                  <span className="flex-shrink-0 w-16" />
                )}

                {/* Date range */}
                <span className="flex-shrink-0 text-xs text-slate-400 whitespace-nowrap hidden md:inline">
                  {fmtShortDateTime(p.startDate, p.startTime)} → {p.endDate ? fmtShortDateTime(p.endDate, p.endTime) : <span className="italic">ongoing</span>}
                </span>

                {/* Countdown / upcoming badge */}
                <div className="flex-shrink-0 w-20 text-right">
                  {upcoming && daysToStart !== null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 whitespace-nowrap">
                      {daysToStart === 1 ? 'tomorrow' : `in ${daysToStart}d`}
                    </span>
                  )}
                  {!upcoming && expiring && days !== null && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {days === 0 ? 'ends today' : days === 1 ? 'ends tomorrow' : `${days}d left`}
                    </span>
                  )}
                </div>
              </div>
            );
          });
        })}
      </div>

      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/60">
        <p className="text-[10px] text-slate-400">Promotions cannot be combined unless otherwise stated.</p>
      </div>
    </div>
  );
}
