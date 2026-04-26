import { NextResponse } from 'next/server';
import { getCases } from '@/lib/google-sheets';
import {
  DashboardStats,
  ManufacturerStat,
  FaultTypeStat,
  TrendPoint,
  ProductStat,
} from '@/types';
import {
  isThisWeek,
  isThisMonth,
  getMonthName,
} from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';

export async function GET() {
  try {
    const cases = await getCases();

    // --- Core Stats ---
    const totalFaults = cases.length;

    const faultsThisWeek = cases.filter(c => isThisWeek(c.date)).length;
    const faultsThisMonth = cases.filter(c => isThisMonth(c.date)).length;

    const costLostThisWeek = cases
      .filter(c => isThisWeek(c.date))
      .reduce((sum, c) => sum + c.unitCostUSD, 0);

    const costLostThisMonth = cases
      .filter(c => isThisMonth(c.date))
      .reduce((sum, c) => sum + c.unitCostUSD, 0);

    // --- Last Week Stats ---
    const today = new Date();
    const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const thisWeekMonday = new Date(today);
    thisWeekMonday.setDate(today.getDate() - daysToMonday);
    thisWeekMonday.setHours(0, 0, 0, 0);
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
    const lastWeekSunday = new Date(lastWeekMonday);
    lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
    lastWeekSunday.setHours(23, 59, 59, 999);
    const lastWeekCases = cases.filter(c => {
      try {
        const d = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
        return d >= lastWeekMonday && d <= lastWeekSunday;
      } catch { return false; }
    });
    const faultsLastWeek = lastWeekCases.length;
    const costLostLastWeek = lastWeekCases.reduce((sum, c) => sum + c.unitCostUSD, 0);

    // --- Last Month Stats ---
    const lastMonthDate = subMonths(new Date(), 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);
    const lastMonthCases = cases.filter(c => {
      try {
        const d = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
        return d >= lastMonthStart && d <= lastMonthEnd;
      } catch { return false; }
    });
    const faultsLastMonth = lastMonthCases.length;
    const costLostLastMonth = lastMonthCases.reduce((sum, c) => sum + c.unitCostUSD, 0);
    const lastMonthLabel = format(lastMonthDate, 'MMMM');

    // --- Financial Year Stats (AU: Jul 1 – Jun 30) ---
    const now = new Date();
    const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(`${fyStartYear}-07-01T00:00:00`);
    const fyEnd   = new Date(`${fyStartYear + 1}-06-30T23:59:59`);
    const fyCases = cases.filter(c => {
      try {
        const d = new Date(c.date.includes('T') ? c.date : c.date + 'T00:00:00');
        return d >= fyStart && d <= fyEnd;
      } catch { return false; }
    });
    const faultsFY  = fyCases.length;
    const costFY    = fyCases.reduce((sum, c) => sum + c.unitCostUSD, 0);
    const fyLabel   = `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`;

    // --- Faults by Manufacturer ---
    const mfrMap = new Map<string, ManufacturerStat>();
    for (const c of cases) {
      const key = c.manufacturerName || 'Unknown';
      const existing = mfrMap.get(key) || { name: key, count: 0, cost: 0 };
      existing.count += 1;
      existing.cost += c.unitCostUSD;
      mfrMap.set(key, existing);
    }
    const faultsByManufacturer: ManufacturerStat[] = Array.from(mfrMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Top Fault Types ---
    const ftMap = new Map<string, number>();
    for (const c of cases) {
      const key = c.faultType || 'Unknown';
      ftMap.set(key, (ftMap.get(key) || 0) + 1);
    }
    const topFaultTypes: FaultTypeStat[] = Array.from(ftMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // --- Monthly Trend (last 6 months) ---
    const monthlyTrend: TrendPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      const monthCases = cases.filter(c => {
        try {
          const d = new Date(c.date);
          return isAfter(d, start) && isBefore(d, end);
        } catch { return false; }
      });

      monthlyTrend.push({
        label: format(month, 'MMM'),
        count: monthCases.length,
        cost: monthCases.reduce((sum, c) => sum + c.unitCostUSD, 0),
      });
    }

    // --- Weekly Trend (last 8 weeks) ---
    const weeklyTrend: TrendPoint[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekCases = cases.filter(c => {
        try {
          const d = new Date(c.date);
          return d >= weekStart && d <= weekEnd;
        } catch { return false; }
      });

      weeklyTrend.push({
        label: `W${8 - i}`,
        count: weekCases.length,
        cost: weekCases.reduce((sum, c) => sum + c.unitCostUSD, 0),
      });
    }

    // --- Product Fault Counts ---
    const productMap = new Map<string, ProductStat>();
    for (const c of cases) {
      const key = c.product || 'Unknown';
      const existing = productMap.get(key) || { name: key, count: 0, cost: 0 };
      existing.count += 1;
      existing.cost += c.unitCostUSD;
      productMap.set(key, existing);
    }
    const productFaultCounts: ProductStat[] = Array.from(productMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Per-product trend (top 5 products) ---
    const top5Products = productFaultCounts.slice(0, 5).map(p => p.name);

    // Weekly breakdown per product (last 8 weeks)
    const productWeeklyTrend: Record<string, number | string>[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = new Date();
      wStart.setDate(wStart.getDate() - i * 7 - wStart.getDay() + 1);
      wStart.setHours(0, 0, 0, 0);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      const wCases = cases.filter(c => { try { const d = new Date(c.date); return d >= wStart && d <= wEnd; } catch { return false; } });
      const point: Record<string, number | string> = { label: `W${8 - i}` };
      for (const p of top5Products) point[p] = wCases.filter(c => c.product === p).length;
      productWeeklyTrend.push(point);
    }

    // Monthly breakdown per product (last 6 months)
    const productMonthlyTrend: Record<string, number | string>[] = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);
      const mCases = cases.filter(c => { try { const d = new Date(c.date); return isAfter(d, mStart) && isBefore(d, mEnd); } catch { return false; } });
      const point: Record<string, number | string> = { label: format(month, 'MMM') };
      for (const p of top5Products) point[p] = mCases.filter(c => c.product === p).length;
      productMonthlyTrend.push(point);
    }

    // --- Recent Cases (last 10) ---
    const recentCases = [...cases]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    const stats: DashboardStats = {
      totalFaults,
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

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('[GET /api/dashboard]', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
