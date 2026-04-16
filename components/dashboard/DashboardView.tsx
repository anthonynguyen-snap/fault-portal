'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, DollarSign,
  Package, Factory, Plus, RefreshCw, ExternalLink, RotateCcw, Mail,
} from 'lucide-react';
import { DashboardStats, FaultCase, Return } from '@/types';
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT, truncate } from '@/lib/utils';

// ── Week helpers (for Returns widget) ────────────────────────────────────────
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
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return mon.toLocaleDateString('en-AU', opts);
}

const BRAND_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
  '#f97316', '#84cc16',
];

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">
          {p.name}: <span className="font-semibold">
            {p.name.toLowerCase().includes('cost') ? formatCurrency(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [allReturns, setAllReturns] = useState<Return[]>([]);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [dashRes, returnsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/returns'),
      ]);
      const dashJson = await dashRes.json();
      if (dashJson.error) throw new Error(dashJson.error);
      setStats(dashJson.data);
      const returnsJson = await returnsRes.json();
      setAllReturns(returnsJson.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-6 text-center max-w-sm">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium mb-1">Could not load dashboard</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <button onClick={() => load()} className="btn-primary text-sm">Try again</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const topMfr = stats.faultsByManufacturer[0]?.name ?? '—';
  const weekChange = stats.monthlyTrend.length >= 2
    ? stats.monthlyTrend[stats.monthlyTrend.length - 1].count - stats.monthlyTrend[stats.monthlyTrend.length - 2].count
    : 0;

  // ── Returns widget calculations ──────────────────────────────────────────
  const thisMonday = getMondayOf(new Date());
  const thisSunday = addDays(thisMonday, 6);
  const weekReturns = allReturns.filter(r => r.date >= fmtDate(thisMonday) && r.date <= fmtDate(thisSunday));
  const weekRefunded = weekReturns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
  const pendingFollowUps = allReturns.filter(r => r.followUpStatus === 'Pending').length;

  // Build 6-week bar chart (most recent week last)
  const sixWeeksData = Array.from({ length: 6 }, (_, i) => {
    const mon = getMondayOf(addDays(new Date(), -(5 - i) * 7));
    const sun = addDays(mon, 6);
    const count = allReturns.filter(r => r.date >= fmtDate(mon) && r.date <= fmtDate(sun)).length;
    const refunded = allReturns
      .filter(r => r.date >= fmtDate(mon) && r.date <= fmtDate(sun))
      .reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
    return { label: shortWeekLabel(mon), count, refunded };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Fault analytics and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-secondary gap-2"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/cases/new" className="btn-primary">
            <Plus size={15} /> Submit Fault
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Faults"
          value={stats.totalFaults.toString()}
          sub="All time"
          icon={AlertTriangle}
          color="bg-slate-600"
        />
        <StatCard
          label="This Month"
          value={stats.faultsThisMonth.toString()}
          sub={weekChange > 0 ? `↑ ${weekChange} vs prev month` : weekChange < 0 ? `↓ ${Math.abs(weekChange)} vs prev month` : 'Same as prev month'}
          icon={TrendingUp}
          color="bg-brand-600"
        />
        <StatCard
          label="Cost at Risk (Month)"
          value={formatCurrency(stats.costLostThisMonth)}
          sub={`${formatCurrency(stats.costLostThisWeek)} this week`}
          icon={DollarSign}
          color="bg-amber-500"
        />
        <StatCard
          label="Top Manufacturer"
          value={truncate(topMfr, 16)}
          sub={`${stats.faultsByManufacturer[0]?.count ?? 0} faults total`}
          icon={Factory}
          color="bg-rose-500"
        />
      </div>

      {/* Monthly Trend Chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Monthly Fault Trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={stats.monthlyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Area yAxisId="left" type="monotone" dataKey="count" name="Faults" stroke="#6366f1" strokeWidth={2} fill="url(#colorCount)" dot={{ r: 3, fill: '#6366f1' }} />
            <Area yAxisId="right" type="monotone" dataKey="cost" name="Cost (USD)" stroke="#f59e0b" strokeWidth={2} fill="url(#colorCost)" dot={{ r: 3, fill: '#f59e0b' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Two-column: Manufacturers + Fault Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Faults by Manufacturer */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Faults by Manufacturer</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={stats.faultsByManufacturer.slice(0, 7)}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={90}
                tickFormatter={(v) => truncate(v, 14)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Faults" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {stats.faultsByManufacturer.slice(0, 7).map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Fault Types */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Top Fault Types</h2>
          <div className="flex gap-4 items-center h-[220px]">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie
                  data={stats.topFaultTypes}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {stats.topFaultTypes.map((_, i) => (
                    <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[200px]">
              {stats.topFaultTypes.map((ft, i) => (
                <div key={ft.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                  <span className="text-xs text-slate-600 flex-1 truncate">{ft.name}</span>
                  <span className="text-xs font-semibold text-slate-800">{ft.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Most Faulted Products</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats.productFaultCounts.slice(0, 8)} margin={{ top: 0, right: 16, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
              angle={-30} textAnchor="end" interval={0}
              tickFormatter={(v) => truncate(v, 18)} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Faults" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Returns Section ─────────────────────────────────────────────────── */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">Returns</h2>
          </div>
          <Link href="/returns" className="text-xs text-brand-600 hover:underline font-medium">View all →</Link>
        </div>

        {/* Returns stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Returns This Week"
            value={weekReturns.length.toString()}
            sub={weekReturns.length === 1 ? '1 return logged' : `${weekReturns.length} returns logged`}
            icon={RotateCcw}
            color="bg-indigo-500"
          />
          <StatCard
            label="Refunded This Week"
            value={weekRefunded > 0 ? `$${weekRefunded.toFixed(2)}` : '$0.00'}
            sub="Total amount refunded"
            icon={DollarSign}
            color="bg-emerald-500"
          />
          <StatCard
            label="Pending Follow-ups"
            value={pendingFollowUps.toString()}
            sub="Across all time"
            icon={Mail}
            color={pendingFollowUps > 0 ? 'bg-amber-500' : 'bg-slate-400'}
          />
        </div>

        {/* 6-week returns bar chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Returns Volume — Last 6 Weeks</h3>
          {allReturns.length === 0 ? (
            <div className="flex items-center justify-center h-[180px]">
              <p className="text-sm text-slate-400">No returns data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sixWeeksData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52}
                  tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
                        <p className="font-semibold text-slate-700 mb-1">{label}</p>
                        <p className="text-xs text-indigo-600">Returns: <span className="font-semibold">{payload[0]?.value ?? 0}</span></p>
                        <p className="text-xs text-emerald-600">Refunded: <span className="font-semibold">${(payload[1]?.value ?? 0).toFixed(2)}</span></p>
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="left" dataKey="count" name="Returns" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="refunded" name="Refunded ($)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Cases */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Recent Cases</h2>
          <Link href="/cases" className="text-xs text-brand-600 hover:underline font-medium">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Order #</th>
                <th>Product</th>
                <th>Manufacturer</th>
                <th>Fault Type</th>
                <th>Cost</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 text-sm">
                    No cases yet.{' '}
                    <Link href="/cases/new" className="text-brand-600 hover:underline">Submit your first fault</Link>
                  </td>
                </tr>
              ) : (
                stats.recentCases.map((c: FaultCase) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => window.location.href = `/cases/${c.id}`}>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(c.date)}</td>
                    <td><span className="font-semibold text-brand-600">{c.orderNumber}</span></td>
                    <td className="text-slate-600">{truncate(c.product, 22)}</td>
                    <td className="text-slate-500">{truncate(c.manufacturerName, 18)}</td>
                    <td>
                      <span className="inline-block text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {c.faultType}
                      </span>
                    </td>
                    <td className="font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(c.unitCostUSD)}</td>
                    <td>
                      <span className={`badge ${STATUS_STYLES[c.claimStatus]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                        {c.claimStatus}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {c.evidenceLink && (
                        <a href={c.evidenceLink} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
