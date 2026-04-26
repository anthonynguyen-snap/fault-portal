'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
  RefreshCw,
  ArrowRight,
  RotateCcw,
  Mail,
  LucideIcon,
  Sparkles,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { DashboardStats, Return } from '@/types';
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT, faultTypeBadge } from '@/lib/utils';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

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
function shortWeekLabel(mon: Date): string {
  return mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── Paired Stat Card ───────────────────────────────────────────────────────────
function PairedStatCard({
  label, count, countSub, cost, costSub, icon: Icon, gradient,
}: {
  label: string;
  count: string | number;
  countSub: string;
  cost: string;
  costSub: string;
  icon: LucideIcon;
  gradient: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: gradient }}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-5">
          <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest">{label}</p>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/15">
            <Icon size={17} className="text-white" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-white leading-none">{count}</p>
            <p className="text-[11px] text-white/55 mt-1.5">{countSub}</p>
          </div>
          <div className="text-right border-l border-white/20 pl-4">
            <p className="text-xl font-bold text-white/90 leading-none">{cost}</p>
            <p className="text-[11px] text-white/55 mt-1.5">{costSub}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simple Stat Card (for returns) ────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  gradient: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: gradient }}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest">{label}</p>
            <p className="text-3xl font-bold text-white mt-1.5">{value}</p>
            {sub && <p className="text-[11px] text-white/55 mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/15">
            <Icon size={20} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
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

type PeriodView = 'thisWeek' | 'lastWeek' | 'thisMonth';

// ── Main Dashboard Page ────────────────────────────────────────────────────────
export default function DashboardPage() {

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allReturns, setAllReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [productTrendView, setProductTrendView] = useState<'weekly' | 'monthly'>('weekly');
  const [periodView, setPeriodView] = useState<PeriodView>('thisWeek');

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
  }

  useEffect(() => { loadStats(); }, []);

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
  const weekReturns = allReturns.filter(r => r.date >= fmtDate(thisMonday) && r.date <= fmtDate(thisSunday));
  const weekRefunded = weekReturns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
  const pendingFollowUps = allReturns.filter(r => r.followUpStatus === 'Pending').length;
  const sixWeeksData = Array.from({ length: 6 }, (_, i) => {
    const mon = getMondayOf(addDays(new Date(), -(5 - i) * 7));
    const sun = addDays(mon, 6);
    const count = allReturns.filter(r => r.date >= fmtDate(mon) && r.date <= fmtDate(sun)).length;
    const refunded = allReturns
      .filter(r => r.date >= fmtDate(mon) && r.date <= fmtDate(sun))
      .reduce((s, r) => s + (r.totalRefundAmount || 0), 0);
    return { label: shortWeekLabel(mon), count, refunded };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
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

      {/* ── Major Sale Banner + Active Promotions Strip ──────────────────── */}
      <MajorSaleBanner />
      <ActivePromosStrip />

      {/* ══════════════════════════════════════════════════════════════════════
          FAULT CASES
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <SectionHeader icon={AlertTriangle} title="Fault Cases" href="/cases" linkLabel="View all cases" />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0">
          {([
            { key: 'thisWeek',  label: 'This Week'  },
            { key: 'lastWeek',  label: 'Last Week'  },
            { key: 'thisMonth', label: 'This Month' },
          ] as { key: PeriodView; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodView(key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                periodView === key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Paired stat cards */}
      {(() => {
        const card2 = periodView === 'thisWeek'
          ? { label: 'This Week',  count: stats.faultsThisWeek,  cost: formatCurrency(stats.costLostThisWeek),  countSub: 'faults this week',  costSub: 'cost at risk', icon: Calendar,   gradient: 'linear-gradient(135deg, #1591b3 0%, #0b5572 100%)' }
          : periodView === 'lastWeek'
          ? { label: 'Last Week',  count: stats.faultsLastWeek,  cost: formatCurrency(stats.costLostLastWeek),  countSub: 'faults last week',  costSub: 'cost at risk', icon: Calendar,   gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }
          : { label: 'This Month', count: stats.faultsThisMonth, cost: formatCurrency(stats.costLostThisMonth), countSub: 'faults this month', costSub: 'cost at risk', icon: TrendingUp, gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' };

        const card3 = periodView === 'thisMonth'
          ? { label: stats.lastMonthLabel, count: stats.faultsLastMonth, cost: formatCurrency(stats.costLostLastMonth), countSub: 'faults last month', costSub: 'cost at risk', icon: Calendar,   gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }
          : { label: 'This Month',         count: stats.faultsThisMonth, cost: formatCurrency(stats.costLostThisMonth), countSub: 'faults this month', costSub: 'cost at risk', icon: TrendingUp, gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PairedStatCard
              label={stats.fyLabel}
              count={stats.faultsFY}
              countSub="faults this financial year"
              cost={formatCurrency(stats.costFY)}
              costSub="cost at risk this FY"
              icon={AlertTriangle}
              gradient="linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
            />
            <PairedStatCard
              label={card2.label}
              count={card2.count}
              countSub={card2.countSub}
              cost={card2.cost}
              costSub={card2.costSub}
              icon={card2.icon}
              gradient={card2.gradient}
            />
            <PairedStatCard
              label={card3.label}
              count={card3.count}
              countSub={card3.countSub}
              cost={card3.cost}
              costSub={card3.costSub}
              icon={card3.icon}
              gradient={card3.gradient}
            />
          </div>
        );
      })()}

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Monthly Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Faults logged over the past 6 months</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={stats.monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => [v, 'Faults']} />
              <Bar dataKey="count" fill="#1591b3" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Weekly Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Fault count and cost at risk over the past 8 weeks</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={stats.weeklyTrend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number, name: string) => [name === 'Cost ($)' ? `$${v.toFixed(2)}` : v, name]} />
              <Bar yAxisId="left" dataKey="count" name="Faults" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar yAxisId="right" dataKey="cost" name="Cost ($)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Manufacturer + Fault Types side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faults by Manufacturer */}
        <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">By Manufacturer</h3>
          <p className="text-xs text-slate-400 mb-4">Top manufacturers by fault count</p>
          <div className="space-y-3.5">
            {stats.faultsByManufacturer.slice(0, 6).map((mfr, i) => {
              const max = stats.faultsByManufacturer[0]?.count || 1;
              const pct = Math.round((mfr.count / max) * 100);
              // Fade bar color from brand to lighter as rank drops
              const barColors = ['#1591b3', '#1591b3cc', '#1591b3aa', '#1591b388', '#1591b366', '#1591b344'];
              return (
                <div key={mfr.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 w-4 flex-shrink-0">{i + 1}</span>
                      <span className="font-medium text-slate-700 truncate">{mfr.name}</span>
                    </div>
                    <span className="text-slate-400 ml-3 flex-shrink-0 font-mono text-[11px]">{mfr.count} · {formatCurrency(mfr.cost)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColors[i] ?? '#1591b344' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Fault Types */}
        <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">By Fault Type</h3>
          <p className="text-xs text-slate-400 mb-4">Most common fault categories</p>
          <div className="space-y-0.5">
            {stats.topFaultTypes.map((ft, i) => {
              const rankStyles = [
                'bg-brand-600 text-white',
                'bg-brand-500 text-white',
                'bg-brand-400 text-white',
                'bg-slate-200 text-slate-600',
                'bg-slate-100 text-slate-500',
                'bg-slate-100 text-slate-400',
              ];
              return (
                <div key={ft.name} className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${i < 3 ? 'bg-brand-50/60' : 'hover:bg-slate-50'} transition-colors`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${rankStyles[i] ?? 'bg-slate-100 text-slate-400'}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700">{ft.name}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                    {ft.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Faults by Product */}
      <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
        <h3 className="text-sm font-semibold text-slate-900 mb-0.5">By Product</h3>
        <p className="text-xs text-slate-400 mb-4">Top 10 products by fault count</p>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart
            data={stats.productFaultCounts.slice(0, 10).map(p => ({ ...p, name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name }))}
            margin={{ top: 4, right: 16, left: -20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => [v, 'Faults']} />
            <Bar dataKey="count" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-Product Trend */}
      {stats.topProductNames && stats.topProductNames.length > 0 && (
        <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Product Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Top 5 products over time</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setProductTrendView('weekly')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${productTrendView === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Weekly
              </button>
              <button
                onClick={() => setProductTrendView('monthly')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${productTrendView === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Monthly
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230} className="mt-4">
            <LineChart
              data={productTrendView === 'weekly' ? stats.productWeeklyTrend : stats.productMonthlyTrend}
              margin={{ top: 8, right: 16, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {(['#4f46e5', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4'] as const).map((colour, i) => {
                const product = stats.topProductNames[i];
                if (!product) return null;
                return (
                  <Line key={product} type="monotone" dataKey={product} stroke={colour} strokeWidth={2} dot={{ r: 3, fill: colour }} activeDot={{ r: 5 }} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Cases */}
      <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Cases</h3>
            <p className="text-xs text-slate-500 mt-0.5">Last 10 fault cases submitted</p>
          </div>
          <Link href="/cases" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 pr-4">Order</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 pr-4">Product</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 pr-4">Fault</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2 pr-4">Date</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCases.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/cases/${c.id}`} legacyBehavior>
                  <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="py-2.5 pr-4 font-semibold text-brand-600">{c.orderNumber}</td>
                    <td className="py-2.5 pr-4 text-slate-600 max-w-[160px] truncate" title={c.product}>{c.product}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${faultTypeBadge(c.faultType)}`}>{c.faultType}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 text-xs whitespace-nowrap">{formatDate(c.date)}</td>
                    <td className="py-2.5">
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

      {/* ══════════════════════════════════════════════════════════════════════
          RETURNS
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={RotateCcw} title="Returns" href="/returns" linkLabel="View all returns" />

      {/* Returns stat cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard label="Returns This Week" value={weekReturns.length} sub="logged this week" icon={RotateCcw} gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)" />
        <StatCard label="Refunded This Week" value={`$${weekRefunded.toFixed(2)}`} sub="total refunded" icon={DollarSign} gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" />
        <StatCard label="Pending Follow-ups" value={pendingFollowUps} sub="across all returns" icon={Mail} gradient={pendingFollowUps > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'} />
      </div>

      {/* Returns volume chart */}
      <div className="card p-5" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' }}>
        <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Returns Volume</h3>
        <p className="text-xs text-slate-500 mb-4">Return count and amount refunded per week over the last 6 weeks</p>
        {allReturns.length === 0 ? (
          <div className="flex items-center justify-center h-[160px]">
            <p className="text-sm text-slate-400">No returns logged yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sixWeeksData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number, name: string) => [name === 'Refunded ($)' ? `$${v.toFixed(2)}` : v, name]} />
              <Bar yAxisId="left" dataKey="count" name="Returns" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar yAxisId="right" dataKey="refunded" name="Refunded ($)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* AI Briefing */}
      <AiBriefingCard />

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

// ── Major Sale Banner ─────────────────────────────────────────────────────────
function MajorSaleBanner() {
  const [sales, setSales] = useState<PromoStrip[]>([]);

  useEffect(() => {
    fetch('/api/promotions')
      .then(r => r.json())
      .then(d => {
        const today = new Date().toISOString().slice(0, 10);
        const major = (d.data ?? []).filter((p: any) =>
          p.isMajor && p.enabled !== false && (!p.endDate || p.endDate >= today)
        );
        setSales(major);
      })
      .catch(() => {});
  }, []);

  if (!sales.length) return null;

  return (
    <>
      {sales.map(p => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysLeft = p.endDate
          ? Math.ceil((new Date(p.endDate + 'T00:00:00').getTime() - today.getTime()) / 86400000)
          : null;

        // Build ticker segments — repeat 6× for a seamless infinite loop
        const tickerLabel = [
          p.name,
          p.discountValue ? `${p.discountValue}${p.discountType === '% Off' ? '% OFF' : p.discountType === '$ Off' ? ' OFF' : ` · ${p.discountType}`}` : null,
          p.productsCovered || null,
        ].filter(Boolean).join('  ·  ');

        return (
          <div key={p.id} className="overflow-hidden rounded-xl border border-amber-300 shadow-sm">

            {/* ── Scrolling ticker bar ───────────────────────────────────────── */}
            <div className="overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 h-9 flex items-center">
              <div className="animate-marquee flex whitespace-nowrap">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="inline-flex items-center gap-3 px-6 text-white text-[11px] font-bold uppercase tracking-widest">
                    <span>⭐</span>
                    <span>{tickerLabel}</span>
                    <span className="opacity-40 text-lg font-thin">|</span>
                  </span>
                ))}
              </div>
            </div>

            {/* ── Main body ─────────────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50/60 to-yellow-50 px-5 py-4 flex items-center gap-6">

              {/* Left: meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">⭐ Major Sale</span>
                  {p.platform && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      {p.platform}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 leading-tight tracking-tight">{p.name}</h3>
                {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
                {p.productsCovered && <p className="text-xs text-slate-400 mt-0.5">{p.productsCovered}</p>}
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  {p.code && (
                    <span className="font-mono text-sm font-bold bg-white border border-amber-300 text-amber-800 px-3 py-1 rounded-lg tracking-wider shadow-sm">
                      {p.code}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {fmtShort(p.startDate)} – {p.endDate ? fmtShort(p.endDate) : 'ongoing'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-600/70 italic mt-3">
                  ⚠️ During a major sale, all other promo codes and discounts are overridden.
                </p>
              </div>

              {/* Right: discount + countdown */}
              <div className="flex items-center gap-4 flex-shrink-0">
                {p.discountValue && (
                  <div className="text-center bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl px-5 py-3 shadow-md text-white">
                    <p className="text-4xl font-black leading-none">
                      {p.discountValue}{p.discountType === '% Off' ? '%' : ''}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-90">
                      {p.discountType === '% Off' ? 'OFF' : p.discountType}
                    </p>
                  </div>
                )}
                {daysLeft !== null && daysLeft >= 0 && (
                  <div className="text-center bg-white border border-amber-200 rounded-xl px-4 py-3 shadow-sm">
                    <p className="text-3xl font-extrabold text-amber-500 leading-none">{daysLeft}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">
                      {daysLeft === 1 ? 'day left' : 'days left'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Active Promotions Strip ────────────────────────────────────────────────────
type PromoStrip = { id: string; name: string; code: string; platform: string; description: string; discountType: string; discountValue: string; productsCovered: string; startDate: string; endDate: string | null; isMajor: boolean };

const STORE_ORDER = ['All Stores', 'AU (+ Popup)', 'US', 'UK-NZ-ROW'] as const;
const STORE_LABEL: Record<string, { label: string; color: string }> = {
  'AU (+ Popup)': { label: 'AU',  color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'US':           { label: 'US',  color: 'text-blue-700 bg-blue-50 border-blue-200'         },
  'UK-NZ-ROW':    { label: 'ROW', color: 'text-purple-700 bg-purple-50 border-purple-200'   },
  'All Stores':   { label: 'All', color: 'text-brand-700 bg-brand-50 border-brand-200'      },
};

function fmtShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(isoDate + 'T00:00:00');
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

// Store-tinted pill colours
const PILL_STORE_STYLE: Record<string, { pill: string; code: string }> = {
  'AU (+ Popup)': { pill: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300', code: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'US':           { pill: 'bg-blue-50 border-blue-200 hover:border-blue-300',           code: 'bg-blue-100 text-blue-700 border-blue-200'           },
  'UK-NZ-ROW':    { pill: 'bg-purple-50 border-purple-200 hover:border-purple-300',     code: 'bg-purple-100 text-purple-700 border-purple-200'     },
  'All Stores':   { pill: 'bg-brand-50 border-brand-200 hover:border-brand-300',        code: 'bg-brand-100 text-brand-700 border-brand-200'        },
};

function PromoPill({ p, store }: { p: PromoStrip; store: string }) {
  const days     = p.endDate ? daysUntil(p.endDate) : null;
  const expiring = days !== null && days <= 7 && days >= 0;
  const urgent   = days !== null && days <= 2;
  const storeStyle = PILL_STORE_STYLE[store] ?? { pill: 'bg-white border-slate-200 hover:border-slate-300', code: 'bg-slate-100 text-slate-600 border-slate-200' };

  const borderCls = expiring
    ? (urgent ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50')
    : storeStyle.pill;

  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border shadow-sm transition-colors ${borderCls}`}>
      <span className="font-semibold text-slate-800 leading-snug">{p.name}</span>

      {p.description && (
        <span className="text-slate-500 font-normal hidden sm:inline">{p.description}</span>
      )}

      {p.discountValue && (
        <span className="font-bold text-slate-700">
          {p.discountValue}{p.discountType === '% Off' ? '% off' : p.discountType === '$ Off' ? ' off' : ` · ${p.discountType}`}
        </span>
      )}

      {p.code && (
        <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border tracking-wider ${storeStyle.code}`}>
          {p.code}
        </span>
      )}

      <span className="text-slate-400 text-[10px] font-normal whitespace-nowrap">
        {fmtShort(p.startDate)} – {p.endDate ? fmtShort(p.endDate) : 'ongoing'}
      </span>

      {expiring && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${urgent ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
          {days === 0 ? 'Today!' : `${days}d left`}
        </span>
      )}
    </span>
  );
}

// ── Letterboard scramble helpers ──────────────────────────────────────────────
const BOARD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·×—';

function ScrambleRow({ text, delay = 0 }: { text: string; delay?: number }) {
  const [display, setDisplay] = useState(() =>
    text.split('').map(c =>
      c === ' ' ? ' ' : BOARD_CHARS[Math.floor(Math.random() * BOARD_CHARS.length)]
    ).join('')
  );

  useEffect(() => {
    if (!text) { setDisplay(text); return; }
    const duration = Math.max(900, 700 + text.length * 16);
    let raf: number;
    let t0: number | null = null;

    const id = setTimeout(() => {
      const step = (ts: number) => {
        if (t0 === null) t0 = ts;
        const pct = Math.min((ts - t0) / duration, 1);
        const resolved = Math.floor(pct * text.length);
        setDisplay(
          text.split('').map((c, i) => {
            if (c === ' ') return ' ';
            if (i < resolved) return c;
            return BOARD_CHARS[Math.floor(Math.random() * BOARD_CHARS.length)];
          }).join('')
        );
        if (pct < 1) raf = requestAnimationFrame(step);
        else setDisplay(text);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [text, delay]);

  return <>{display}</>;
}

function buildBoardLine(p: PromoStrip): string {
  const parts: string[] = [];
  if (p.discountValue) {
    const discount = p.discountType === '% Off' ? `${p.discountValue}% OFF` :
                     p.discountType === '$ Off' ? `$${p.discountValue} OFF` :
                     `${p.discountValue} ${p.discountType}`.toUpperCase();
    parts.push(discount);
  }
  if (p.name) parts.push(p.name.toUpperCase());
  if (p.code) parts.push(p.code.toUpperCase());
  if (p.endDate) parts.push(`ENDS ${fmtShort(p.endDate).toUpperCase()}`);
  return parts.join('  ·  ');
}

function ActivePromosStrip() {
  const [promos, setPromos] = useState<PromoStrip[]>([]);

  useEffect(() => {
    fetch('/api/promotions')
      .then(r => r.json())
      .then(d => {
        const today = new Date().toISOString().slice(0, 10);
        const active = (d.data ?? []).filter((p: any) => !p.isMajor && p.enabled !== false && (!p.endDate || p.endDate >= today));
        setPromos(active);
      })
      .catch(() => {});
  }, []);

  if (!promos.length) return null;

  const groups = STORE_ORDER
    .map(store => ({ store, items: promos.filter(p => p.platform === store) }))
    .filter(g => g.items.length > 0);

  const tickerItems = groups.flatMap(({ store, items }) => {
    const meta = STORE_LABEL[store] ?? { label: store, color: '' };
    return items.map(p => {
      const parts = [p.name, p.code, p.description].filter(Boolean).join(' · ');
      return `[${meta.label}]  ${parts}`;
    });
  });

  // Flatten all rows for consistent staggered delay
  const flatRows: { store: string; p: PromoStrip; isFirstInGroup: boolean; delay: number }[] = [];
  groups.forEach(({ store, items }) => {
    items.forEach((p, i) => {
      flatRows.push({ store, p, isFirstInGroup: i === 0, delay: flatRows.length * 160 });
    });
  });

  return (
    <div className="bg-brand-50 border border-brand-100 rounded-xl overflow-hidden">

      {/* ── Scrolling ticker ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden bg-brand-600 h-8 flex items-center">
        <div className="animate-marquee flex whitespace-nowrap" style={{ animationDuration: '55s' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="inline-flex items-center gap-3 px-5 text-white text-[11px] font-semibold">
              {tickerItems.map((item, j) => (
                <span key={j} className="inline-flex items-center gap-3">
                  <span>{item}</span>
                  <span className="opacity-30 font-thin text-base">|</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-2">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Tag size={12} className="text-brand-600 flex-shrink-0" />
        <span className="text-xs font-bold text-brand-700 uppercase tracking-widest">Live Promos</span>
      </div>

      {/* ── Letterboard panel ────────────────────────────────────────────────── */}
      <div className="mx-4 mb-4 rounded-lg overflow-hidden border border-slate-200" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>

        {/* Column header row */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/80">
          <div className="w-12 flex-shrink-0 border-r border-slate-100 py-1.5 flex items-center justify-center">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">STR</span>
          </div>
          <div className="flex-1 px-4 py-1.5">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">PROMOTION</span>
          </div>
          <div className="w-14 flex-shrink-0 pr-3 flex items-center justify-end">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">LEFT</span>
          </div>
        </div>

        {/* Promo rows */}
        <div className="divide-y divide-slate-100">
          {flatRows.map(({ store, p, isFirstInGroup, delay }) => {
            const meta   = STORE_LABEL[store] ?? { label: store };
            const line   = buildBoardLine(p);
            const days   = p.endDate ? daysUntil(p.endDate) : null;
            const urgent   = days !== null && days <= 2;
            const expiring = days !== null && days <= 7;
            const storeColor =
              store === 'AU (+ Popup)' ? 'text-emerald-600' :
              store === 'US'           ? 'text-sky-600'     :
              store === 'UK-NZ-ROW'    ? 'text-purple-600'  : 'text-brand-600';

            return (
              <div key={p.id} className="flex items-center hover:bg-brand-50/40 transition-colors">

                {/* Store column — label shown only for first row of each group */}
                <div className="w-12 flex-shrink-0 self-stretch flex items-center justify-center border-r border-slate-100">
                  {isFirstInGroup && (
                    <span className={`text-[9px] font-black tracking-widest ${storeColor}`}>
                      {meta.label}
                    </span>
                  )}
                </div>

                {/* Scrambling promo text */}
                <div className="flex-1 px-4 py-2.5 font-mono text-[11.5px] tracking-wide leading-snug text-slate-700 overflow-hidden">
                  <ScrambleRow text={line} delay={delay} />
                </div>

                {/* Days remaining */}
                <div className="w-14 flex-shrink-0 pr-3 flex items-center justify-end">
                  {days !== null ? (
                    <span className={`font-mono text-[10px] font-bold tabular-nums ${
                      urgent   ? 'text-red-500'   :
                      expiring ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {days === 0 ? 'TODAY' : `${days}D`}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-slate-300">—</span>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 italic px-4 pb-3">* Promotions cannot be combined unless otherwise stated.</p>
    </div>
  );
}
