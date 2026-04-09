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
      faultsByManufacturer,
      topFaultTypes,
      recentCases,
      weeklyTrend,
      monthlyTrend,
      productFaultCounts,
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
