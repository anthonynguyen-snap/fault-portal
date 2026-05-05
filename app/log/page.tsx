'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CreditCard, RotateCcw, AlertTriangle, Truck, Activity,
  ChevronRight, Filter, Clock,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface ActivityRow {
  id:          string;
  ts:          string;
  actor:       string;
  action:      string;
  entityType:  string;
  entityId:    string;
  entityLabel: string;
  detail:      Record<string, unknown>;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const ENTITY_CONFIG: Record<string, {
  label:  string;
  color:  string;
  bg:     string;
  icon:   React.ElementType;
}> = {
  Refund:        { label: 'Refund',        color: 'text-blue-600',   bg: 'bg-blue-500',   icon: CreditCard    },
  Return:        { label: 'Return',        color: 'text-orange-600', bg: 'bg-orange-500', icon: RotateCcw     },
  Case:          { label: 'Fault Case',    color: 'text-red-600',    bg: 'bg-red-500',    icon: AlertTriangle },
  Replenishment: { label: 'Replenishment', color: 'text-purple-600', bg: 'bg-purple-500', icon: Truck         },
};

const ACTION_LABELS: Record<string, string> = {
  'refund.submitted':        'Refund request submitted',
  'refund.processed':        'Refund processed',
  'refund.rejected':         'Refund rejected',
  'refund.updated':          'Refund updated',
  'return.logged':           'Return logged',
  'return.updated':          'Return updated',
  'case.created':            'Fault case opened',
  'case.updated':            'Fault case updated',
  'replenishment.created':   'Replenishment requested',
  'replenishment.status':    'Replenishment status updated',
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  Refund:        id => `/refunds?open=${id}`,
  Return:        id => `/returns?open=${id}`,
  Case:          id => `/cases/${id}`,
  Replenishment: id => `/replenishment/${id}`,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDayHeading(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const day       = new Date(d);    day.setHours(0,0,0,0);
  if (day.getTime() === today.getTime())     return 'Today';
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function detailLine(row: ActivityRow): string | null {
  const d = row.detail;
  if (row.action === 'refund.submitted' || row.action === 'refund.processed') {
    const amt = d.amount != null ? `${d.currency ?? 'AUD'} ${Number(d.amount).toFixed(2)}` : null;
    const parts = [amt, d.reason as string].filter(Boolean);
    return parts.join(' · ') || null;
  }
  if (row.action === 'replenishment.created') {
    return `${d.store ?? ''} · ${d.itemCount ?? 0} items`;
  }
  if (row.action === 'replenishment.status') {
    return `Status → ${d.status ?? ''}`;
  }
  if (row.action === 'case.created') {
    return [d.product, d.faultType].filter(Boolean).join(' · ') || null;
  }
  if (row.action === 'return.logged') {
    return `${d.customerName ?? ''} · ${d.itemCount ?? 0} items`;
  }
  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ActivityLogPage() {
  const [rows, setRows]       = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [days, setDays]       = useState(7);
  const [filterType, setFilterType] = useState('All');
  const [filterActor, setFilterActor] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (filterType !== 'All') params.set('type', filterType);
      if (filterActor) params.set('actor', filterActor);
      const res  = await fetch(`/api/activity?${params}`);
      const json = await res.json();
      setRows(json.data ?? []);
    } catch {
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [days, filterType, filterActor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique actors for the dropdown
  const actors = useMemo(() => {
    const names = Array.from(new Set(rows.map(r => r.actor).filter(Boolean))).sort();
    return names;
  }, [rows]);

  // Group by calendar date
  const grouped = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const row of rows) {
      const dateKey = row.ts.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(row);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const totalToday = grouped.find(([d]) => d === new Date().toISOString().slice(0, 10))?.[1].length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity size={20} className="text-brand-600" />
              Activity Log
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {totalToday > 0
                ? `${totalToday} action${totalToday !== 1 ? 's' : ''} today`
                : 'All portal actions, day by day'}
            </p>
          </div>

          {/* Days range selector */}
          <div className="flex items-center gap-1.5">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  days === d
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Filter size={13} className="text-slate-400 flex-shrink-0" />

          {/* Entity type pills */}
          <div className="flex gap-1.5 flex-wrap">
            {['All', 'Refund', 'Return', 'Case', 'Replenishment'].map(type => {
              const cfg = ENTITY_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    filterType === type
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {type === 'All' ? 'All types' : cfg?.label ?? type}
                </button>
              );
            })}
          </div>

          {/* Actor dropdown */}
          {actors.length > 0 && (
            <select
              value={filterActor}
              onChange={e => setFilterActor(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white"
            >
              <option value="">All staff</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="space-y-3 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16 text-red-500 text-sm">{error}</div>
        )}

        {!loading && !error && grouped.length === 0 && (
          <div className="text-center py-20">
            <Clock size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No activity in the last {days} days</p>
          </div>
        )}

        {!loading && !error && grouped.map(([dateKey, dayRows]) => (
          <div key={dateKey} className="mb-6">
            {/* Day header */}
            <div className="flex items-center gap-3 mb-3 sticky top-0 bg-slate-50 py-1.5 -mx-1 px-1 z-10">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {fmtDayHeading(dateKey)}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {dayRows.length} action{dayRows.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Entries */}
            <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
              {dayRows.map(row => {
                const cfg   = ENTITY_CONFIG[row.entityType];
                const Icon  = cfg?.icon ?? Activity;
                const href  = ENTITY_HREF[row.entityType]?.(row.entityId);
                const extra = detailLine(row);

                return (
                  <div key={row.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    {/* Icon */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg?.bg ?? 'bg-slate-400'}`}>
                      <Icon size={13} className="text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug">
                        <span className="font-medium">
                          {ACTION_LABELS[row.action] ?? row.action}
                        </span>
                        {row.entityLabel && (
                          <>
                            {' '}
                            {href ? (
                              <Link
                                href={href}
                                className={`font-mono text-xs font-semibold ${cfg?.color ?? 'text-brand-600'} hover:underline`}
                              >
                                {row.entityLabel}
                              </Link>
                            ) : (
                              <span className="font-mono text-xs font-semibold text-slate-500">
                                {row.entityLabel}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                      {extra && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{extra}</p>
                      )}
                    </div>

                    {/* Right: actor + time */}
                    <div className="text-right flex-shrink-0 ml-2">
                      {row.actor && (
                        <p className="text-xs font-medium text-slate-600">{row.actor}</p>
                      )}
                      <p className="text-xs text-slate-400">{fmtTime(row.ts)}</p>
                    </div>

                    {href && <ChevronRight size={13} className="text-slate-300 flex-shrink-0 self-center" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
