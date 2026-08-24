'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ClipboardList,
  CreditCard,
  PackageX,
  RefreshCw,
  RotateCcw,
  Search,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

type WorkItemType = 'case' | 'return' | 'refund' | 'unfulfilled';
type WorkItem = {
  id: string;
  type: WorkItemType;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  href: string;
  priority: 'red' | 'amber' | 'blue' | 'slate';
};

const TYPE_META: Record<WorkItemType, { label: string; icon: React.ElementType; tone: string; badge: string }> = {
  case: { label: 'Case', icon: AlertTriangle, tone: 'bg-red-50 text-red-600', badge: 'bg-red-50 text-red-700 border-red-100' },
  return: { label: 'Return', icon: RotateCcw, tone: 'bg-orange-50 text-orange-600', badge: 'bg-orange-50 text-orange-700 border-orange-100' },
  refund: { label: 'Refund', icon: CreditCard, tone: 'bg-blue-50 text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  unfulfilled: { label: 'Unfulfilled', icon: PackageX, tone: 'bg-slate-100 text-slate-600', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const PRIORITY_DOT = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  blue: 'bg-brand-500',
  slate: 'bg-slate-300',
};

function fmtDate(value: string) {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function MyWorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<WorkItemType | 'all'>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/my-work', { cache: 'no-store' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(json.items ?? []);
      setCounts(json.counts ?? {});
      setName(json.name ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your work');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (!q) return true;
      return [item.title, item.subtitle, item.status].some(value => value.toLowerCase().includes(q));
    });
  }, [filter, items, search]);

  const tabs = [
    { key: 'all' as const, label: 'All', value: counts.total ?? 0 },
    { key: 'case' as const, label: 'Cases', value: counts.cases ?? 0 },
    { key: 'return' as const, label: 'Returns', value: counts.returns ?? 0 },
    { key: 'refund' as const, label: 'Refunds', value: counts.refunds ?? 0 },
    { key: 'unfulfilled' as const, label: 'Unfulfilled', value: counts.unfulfilled ?? 0 },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Work</h1>
          <p className="page-subtitle">{name ? `Open portal work for ${name}` : 'Your open portal queue'}</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tabs.map(card => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key)}
            className={`stat-tile ${filter === card.key ? 'stat-tile-active' : ''}`}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-normal">{card.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{card.value}</p>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="resource-toolbar rounded-none border-0 border-b border-slate-100 shadow-none">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-brand-600" />
            <h2 className="resource-title">Queue</h2>
            <span className="resource-count">{filtered.length} shown</span>
          </div>
          <div className="resource-controls w-full sm:w-auto">
            <div className="segmented-control overflow-x-auto max-w-full">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={filter === tab.key ? 'is-active' : ''}
                >
                  {tab.label}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${filter === tab.key ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {tab.value}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input pl-8 py-1.5 text-sm"
                placeholder="Search your queue..."
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-5"><TableSkeleton rows={6} cols={4} /></div>
        ) : error ? (
          <div className="p-8 text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing in your queue" description="Open work assigned to you or submitted by you will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work</th>
                  <th>Record</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.icon;
                  return (
                    <tr key={`${item.type}-${item.id}`} className="group cursor-pointer" onClick={() => { window.location.href = item.href; }}>
                      <td className="w-44">
                        <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-semibold ${meta.badge}`}>
                          <Icon size={13} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[item.priority]}`} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{item.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700">{item.status}</span>
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(item.date)}</td>
                      <td>
                        <Link
                          href={item.href}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700"
                          aria-label={`Open ${item.title}`}
                        >
                          <ExternalLink size={14} className="hidden sm:block" />
                          <ChevronRight size={16} className="sm:hidden" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
