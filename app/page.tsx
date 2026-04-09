'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
  RefreshCw,
  ArrowRight,
  Package,
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
} from 'recharts';
import { DashboardStats } from '@/types';
import { formatCurrency, formatDate, STATUS_STYLES, STATUS_DOT } from '@/lib/utils';

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1.5">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function loadStats() {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStats(json.data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of all fault cases and claim activity</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/cases/new" className="btn-primary">
            + Submit Fault
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Faults"
          value={stats.totalFaults}
          sub="All time"
          icon={AlertTriangle}
          color="bg-slate-700"
        />
        <StatCard
          label="This Week"
          value={stats.faultsThisWeek}
          sub="Fault cases"
          icon={Calendar}
          color="bg-brand-600"
        />
        <StatCard
          label="This Month"
          value={stats.faultsThisMonth}
          sub="Fault cases"
          icon={TrendingUp}
          color="bg-violet-600"
        />
        <StatCard
          label="Cost This Week"
          value={formatCurrency(stats.costLostThisWeek)}
          sub="At risk"
          icon={DollarSign}
          color="bg-amber-500"
        />
        <StatCard
          label="Cost This Month"
          value={formatCurrency(stats.costLostThisMonth)}
          sub="At risk"
          icon={DollarSign}
          color="bg-red-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Monthly Trend</h2>
            <p className="text-xs text-slate-500">Faults logged over the past 6 months</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v: number) => [v, 'Faults']}
              />
              <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Faults by Manufacturer */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Faults by Manufacturer</h2>
            <p className="text-xs text-slate-500">Top manufacturers by fault count</p>
          </div>
          <div className="space-y-2.5">
            {stats.faultsByManufacturer.slice(0, 6).map((mfr, i) => {
              const max = stats.faultsByManufacturer[0]?.count || 1;
              const pct = Math.round((mfr.count / max) * 100);
              return (
                <div key={mfr.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{mfr.name}</span>
                    <span className="text-slate-500 ml-2">{mfr.count} faults · {formatCurrency(mfr.cost)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Fault Types */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Top Fault Types</h2>
          </div>
          <div className="space-y-2">
            {stats.topFaultTypes.map((ft, i) => (
              <div key={ft.name} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{ft.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                  {ft.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Product Fault Counts */}
        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Products at Risk</h2>
          </div>
          <div className="space-y-2">
            {stats.productFaultCounts.slice(0, 6).map((p, i) => (
              <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate max-w-[140px]">{p.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-900">{p.count}</span>
                  <span className="text-xs text-slate-400 ml-1">faults</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Cases */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Recent Cases</h2>
            <Link href="/cases" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {stats.recentCases.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-600 transition-colors">
                    {c.orderNumber}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{c.product} · {formatDate(c.date)}</p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <span className={`badge text-[10px] ${STATUS_STYLES[c.claimStatus]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.claimStatus]}`} />
                    {c.claimStatus}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
