'use client';

/**
 * DashboardCharts — all Recharts-dependent chart sections for the dashboard.
 * Loaded lazily via next/dynamic (ssr: false) so Recharts is excluded from
 * the initial JS bundle and only fetched after the page becomes interactive.
 *
 * Since all exports live in this single file, Next.js/webpack emits one shared
 * chunk for all four dynamic() calls in page.tsx.
 */

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
import { getMondayOf, addDays, fmtDateISO } from '@/lib/utils';

// ── Shared style constants ────────────────────────────────────────────────────
const CARD_STYLE = { background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)' };
const TT = { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const TICK = { fontSize: 11, fill: '#94a3b8' };
const GRID = '#f1f5f9';

function shortWeekLabel(mon: Date): string {
  return mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── Skeleton shown while the lazy chunk loads ────────────────────────────────
export function ChartRowSkeleton({ height = 270 }: { height?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card h-[270px] animate-pulse bg-slate-50" style={{ minHeight: height }} />
      <div className="card h-[270px] animate-pulse bg-slate-50" style={{ minHeight: height }} />
    </div>
  );
}
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <div className="card animate-pulse bg-slate-50" style={{ minHeight: height }} />;
}

// ── 1. TrendCharts — Monthly + Weekly bar charts ─────────────────────────────
interface TrendChartsProps {
  monthlyTrend: DashboardStats['monthlyTrend'];
  weeklyTrend: DashboardStats['weeklyTrend'];
}
export function TrendCharts({ monthlyTrend, weeklyTrend }: TrendChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5" style={CARD_STYLE}>
        <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Monthly Trend</h3>
        <p className="text-xs text-slate-400 mb-4">Faults logged over the past 6 months</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TT} formatter={(v: number) => [v, 'Faults']} />
            <Bar dataKey="count" fill="#1591b3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5" style={CARD_STYLE}>
        <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Weekly Trend</h3>
        <p className="text-xs text-slate-400 mb-4">Fault count and cost at risk over the past 8 weeks</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={weeklyTrend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={TICK} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={TT} formatter={(v: number, name: string) => [name === 'Cost ($)' ? `$${v.toFixed(2)}` : v, name]} />
            <Bar yAxisId="left" dataKey="count" name="Faults" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar yAxisId="right" dataKey="cost" name="Cost ($)" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 1b. WeeklyFaultChart — prominent single chart for the new dashboard ──────
export function WeeklyFaultChartSkeleton() {
  return <div className="card h-[320px] animate-pulse bg-slate-50" />;
}

interface WeeklyFaultChartProps {
  weeklyTrend: DashboardStats['weeklyTrend'];
  weekCountDelta: number | null;
  weekCostDelta: number | null;
}
export function WeeklyFaultChart({ weeklyTrend, weekCountDelta, weekCostDelta }: WeeklyFaultChartProps) {
  const fmt = (d: number) => `${Math.abs(d) < 1 ? '<1' : Math.round(Math.abs(d))}%`;
  return (
    <div className="card p-5 h-full" style={CARD_STYLE}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Weekly Fault Trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">Fault count and cost at risk — last 8 weeks</p>
        </div>
        {/* Week-over-week deltas */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {weekCountDelta !== null && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${weekCountDelta > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
              {weekCountDelta > 0 ? '↑' : '↓'} {fmt(weekCountDelta)} faults
            </span>
          )}
          {weekCostDelta !== null && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${weekCostDelta > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
              {weekCostDelta > 0 ? '↑' : '↓'} {fmt(weekCostDelta)} cost
            </span>
          )}
          {(weekCountDelta !== null || weekCostDelta !== null) && (
            <span className="text-[10px] text-slate-400">vs prev wk</span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={weeklyTrend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={TICK} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `$${v}`} />
          <Tooltip contentStyle={TT} formatter={(v: number, name: string) => [name === 'Cost ($)' ? `$${(v as number).toFixed(2)}` : v, name]} />
          <Bar yAxisId="left" dataKey="count" name="Faults" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={44} />
          <Bar yAxisId="right" dataKey="cost" name="Cost ($)" fill="#e879a0" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 2. ProductBarChart — top 10 products by fault count ──────────────────────
interface ProductBarChartProps {
  productFaultCounts: DashboardStats['productFaultCounts'];
}
export function ProductBarChart({ productFaultCounts }: ProductBarChartProps) {
  return (
    <div className="card p-5" style={CARD_STYLE}>
      <h3 className="text-sm font-semibold text-slate-900 mb-0.5">By Product</h3>
      <p className="text-xs text-slate-400 mb-4">Top 10 products by fault count</p>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart
          data={productFaultCounts.slice(0, 10).map(p => ({
            ...p,
            name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
          }))}
          margin={{ top: 4, right: 16, left: -20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0} />
          <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [v, 'Faults']} />
          <Bar dataKey="count" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 3. ProductTrendChart — top 5 products over time ──────────────────────────
interface ProductTrendChartProps {
  topProductNames: string[];
  productWeeklyTrend: DashboardStats['productWeeklyTrend'];
  productMonthlyTrend: DashboardStats['productMonthlyTrend'];
  productTrendView: 'weekly' | 'monthly';
  setProductTrendView: (v: 'weekly' | 'monthly') => void;
}
export function ProductTrendChart({
  topProductNames,
  productWeeklyTrend,
  productMonthlyTrend,
  productTrendView,
  setProductTrendView,
}: ProductTrendChartProps) {
  if (!topProductNames || topProductNames.length === 0) return null;
  return (
    <div className="card p-5" style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Product Trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">Top 5 products over time</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setProductTrendView('weekly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              productTrendView === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setProductTrendView('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              productTrendView === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230} className="mt-4">
        <LineChart
          data={productTrendView === 'weekly' ? productWeeklyTrend : productMonthlyTrend}
          margin={{ top: 8, right: 16, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {(['#4f46e5', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4'] as const).map((colour, i) => {
            const product = topProductNames[i];
            if (!product) return null;
            return (
              <Line
                key={product}
                type="monotone"
                dataKey={product}
                stroke={colour}
                strokeWidth={2}
                dot={{ r: 3, fill: colour }}
                activeDot={{ r: 5 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 4. ReturnsVolumeChart — 6-week returns bar chart ─────────────────────────
interface ReturnsVolumeChartProps {
  allReturns: Return[];
}
export function ReturnsVolumeChart({ allReturns }: ReturnsVolumeChartProps) {
  const sixWeeksData = Array.from({ length: 6 }, (_, i) => {
    const mon = getMondayOf(addDays(new Date(), -(5 - i) * 7));
    const sun = addDays(mon, 6);
    const monStr = fmtDateISO(mon);
    const sunStr = fmtDateISO(sun);
    const weekRows = allReturns.filter(r => r.date >= monStr && r.date <= sunStr);
    return {
      label:    shortWeekLabel(mon),
      count:    weekRows.length,
      refunded: weekRows.reduce((s, r) => s + (r.totalRefundAmount || 0), 0),
    };
  });

  return (
    <div className="card p-5" style={CARD_STYLE}>
      <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Returns Volume</h3>
      <p className="text-xs text-slate-500 mb-4">Return count and amount refunded per week over the last 6 weeks</p>
      {allReturns.length === 0 ? (
        <div className="flex items-center justify-center h-[160px]">
          <p className="text-sm text-slate-400">No returns logged yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sixWeeksData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} width={24} />
            <YAxis yAxisId="right" orientation="right" tick={TICK} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number, name: string) => [name === 'Refunded ($)' ? `$${v.toFixed(2)}` : v, name]} />
            <Bar yAxisId="left" dataKey="count" name="Returns" fill="#1591b3" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar yAxisId="right" dataKey="refunded" name="Refunded ($)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
