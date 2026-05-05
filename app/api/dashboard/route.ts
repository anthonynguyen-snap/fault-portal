import { NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';
import {
  DashboardStats,
  ManufacturerStat,
  FaultTypeStat,
  TrendPoint,
  ProductStat,
} from '@/types';
import { getMonthName } from '@/lib/utils';
import { getCached, setCached } from '@/lib/cache';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const CACHE_KEY = 'dashboard:stats';
const CACHE_TTL = 60_000; // 60 seconds

export async function GET() {
  try {
    // Return cached result if fresh
    const cached = getCached<DashboardStats>(CACHE_KEY);
    if (cached) return NextResponse.json({ data: cached, cached: true });

    const cases = await getCases();

    // ── Pre-compute all time boundaries once ─────────────────────────────────
    const now = new Date();

    // This week (Monday 00:00)
    const daysToMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const thisWeekMonday = new Date(now);
    thisWeekMonday.setDate(now.getDate() - daysToMonday);
    thisWeekMonday.setHours(0, 0, 0, 0);

    // Last week
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
    const lastWeekSunday = new Date(lastWeekMonday);
    lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
    lastWeekSunday.setHours(23, 59, 59, 999);

    // This month / last month
    const thisMonthStart = startOfMonth(now);
    const lastMonthDate  = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd   = endOfMonth(lastMonthDate);
    const lastMonthLabel = format(lastMonthDate, 'MMMM');

    // Financial year (AU: Jul 1 – Jun 30)
    const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(`${fyStartYear}-07-01T00:00:00`);
    const fyEnd   = new Date(`${fyStartYear + 1}-06-30T23:59:59`);
    const fyLabel = `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`;

    // Weekly bins (last 8 weeks, index 0 = 8 weeks ago, index 7 = current week)
    const weekBinStarts: Date[] = [];
    const weekBinEnds: Date[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date(now);
      wStart.setDate(wStart.getDate() - i * 7 - wStart.getDay() + 1);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      weekBinStarts.push(wStart);
      weekBinEnds.push(wEnd);
    }

    // Monthly bins (last 6 months, index 0 = 5 months ago, index 5 = current month)
    const monthBinStarts: Date[] = [];
    const monthBinEnds: Date[] = [];
    const monthBinLabels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      monthBinStarts.push(startOfMonth(m));
      monthBinEnds.push(endOfMonth(m));
      monthBinLabels.push(format(m, 'MMM'));
    }

    // ── Single pass over all cases ────────────────────────────────────────────
    const mfrMap     = new Map<string, ManufacturerStat>();
    const ftMap      = new Map<string, number>();
    const productMap = new Map<string, ProductStat>();
    const weekCounts = Array(8).fill(0);
    const weekCosts  = Array(8).fill(0);
    const monthCounts = Array(6).fill(0);
    const monthCosts  = Array(6).fill(0);
    const weekProductCounts: Map<string, number>[] = Array.from({ length: 8 }, () => new Map());
    const monthProductCounts: Map<string, number>[] = Array.from({ length: 6 }, () => new Map());

    let faultsThisWeek = 0,  costLostThisWeek = 0;
    let faultsThisMonth = 0, costLostThisMonth = 0;
    let faultsLastWeek = 0,  costLostLastWeek = 0;
    let faultsLastMonth = 0, costLostLastMonth = 0;
    let faultsFY = 0,        costFY = 0;

    const recentCases = [...cases]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    for (const c of cases) {
      let d: Date;
      try {
        d = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
        if (isNaN(d.getTime())) continue;
      } catch { continue; }

      const cost = c.unitCostUSD || 0;

      // Core window stats
      if (d >= thisWeekMonday)                              { faultsThisWeek++;  costLostThisWeek  += cost; }
      if (d >= thisMonthStart)                              { faultsThisMonth++; costLostThisMonth += cost; }
      if (d >= lastWeekMonday && d <= lastWeekSunday)       { faultsLastWeek++;  costLostLastWeek  += cost; }
      if (d >= lastMonthStart && d <= lastMonthEnd)         { faultsLastMonth++; costLostLastMonth += cost; }
      if (d >= fyStart        && d <= fyEnd)                { faultsFY++;        costFY            += cost; }

      // Manufacturer
      const mfr = c.manufacturerName || 'Unknown';
      const mfrE = mfrMap.get(mfr) ?? { name: mfr, count: 0, cost: 0 };
      mfrE.count++; mfrE.cost += cost;
      mfrMap.set(mfr, mfrE);

      // Fault type
      const ft = c.faultType || 'Unknown';
      ftMap.set(ft, (ftMap.get(ft) ?? 0) + 1);

      // Product
      const prod = c.product || 'Unknown';
      const prodE = productMap.get(prod) ?? { name: prod, count: 0, cost: 0 };
      prodE.count++; prodE.cost += cost;
      productMap.set(prod, prodE);

      // Weekly bins
      for (let i = 0; i < 8; i++) {
        if (d >= weekBinStarts[i] && d <= weekBinEnds[i]) {
          weekCounts[i]++;
          weekCosts[i] += cost;
          const wpMap = weekProductCounts[i];
          wpMap.set(prod, (wpMap.get(prod) ?? 0) + 1);
          break;
        }
      }

      // Monthly bins
      for (let i = 0; i < 6; i++) {
        if (d >= monthBinStarts[i] && d <= monthBinEnds[i]) {
          monthCounts[i]++;
          monthCosts[i] += cost;
          const mpMap = monthProductCounts[i];
          mpMap.set(prod, (mpMap.get(prod) ?? 0) + 1);
          break;
        }
      }
    }

    // ── Assemble results ──────────────────────────────────────────────────────
    const faultsByManufacturer: ManufacturerStat[] = Array.from(mfrMap.values())
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const topFaultTypes: FaultTypeStat[] = Array.from(ftMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);

    const productFaultCounts: ProductStat[] = Array.from(productMap.values())
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const top5Products = productFaultCounts.slice(0, 5).map(p => p.name);

    const weeklyTrend: TrendPoint[] = weekCounts.map((count, i) => ({
      label: `W${i + 1}`,
      count,
      cost: weekCosts[i],
    }));

    const monthlyTrend: TrendPoint[] = monthCounts.map((count, i) => ({
      label: monthBinLabels[i],
      count,
      cost: monthCosts[i],
    }));

    const productWeeklyTrend = weekCounts.map((_, i) => {
      const point: Record<string, number | string> = { label: `W${i + 1}` };
      for (const p of top5Products) point[p] = weekProductCounts[i].get(p) ?? 0;
      return point;
    });

    const productMonthlyTrend = monthCounts.map((_, i) => {
      const point: Record<string, number | string> = { label: monthBinLabels[i] };
      for (const p of top5Products) point[p] = monthProductCounts[i].get(p) ?? 0;
      return point;
    });

    const stats: DashboardStats = {
      totalFaults: cases.length,
      faultsThisWeek,
      faultsThisMonth,
      costLostThisWeek,
      costLostThisMonth,
      faultsLastWeek,
      costLostLastWeek,
      faultsLastMonth,
      costLostLastMonth,
      lastMonthLabel,
      faultsFY,
      costFY,
      fyLabel,
      faultsByManufacturer,
      topFaultTypes,
      recentCases,
      weeklyTrend,
      monthlyTrend,
      productFaultCounts,
      topProductNames: top5Products,
      productWeeklyTrend,
      productMonthlyTrend,
    };

    setCached(CACHE_KEY, stats, CACHE_TTL);
    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
