'use client';
import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Truck, Plus, RefreshCw, ChevronRight, Package,
  AlertTriangle, CheckCircle, Clock, Send, Bell, ChevronDown,
  BarChart3, ClipboardList,
} from 'lucide-react';
import { ReplenishmentRequest, ReplenishmentStatus, StockItem } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

const STORES = ['Adelaide Popup', 'Sydney Store'] as const;

function generateOrderNumber(store: string): string {
  const prefix = store === 'Sydney Store' ? 'SYD' : 'ADE';
  const now    = new Date();
  const dd     = String(now.getDate()).padStart(2, '0');
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const yy     = String(now.getFullYear()).slice(-2);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${dd}${mm}${yy}-${suffix}`;
}
const SOURCES = ['Storeroom', '3PL'] as const;

const STATUS_STYLES: Record<ReplenishmentStatus, string> = {
  'Pending':              'bg-amber-100 text-amber-700',
  'Ordered':              'bg-blue-100 text-blue-700',
  'Partially Dispatched': 'bg-orange-100 text-orange-700',
  'Dispatched':           'bg-emerald-100 text-emerald-700',
  'Delivered':            'bg-slate-100 text-slate-600',
};

const STATUS_ICONS: Record<ReplenishmentStatus, React.ReactNode> = {
  'Pending':              <Clock size={11} />,
  'Ordered':              <Package size={11} />,
  'Partially Dispatched': <Send size={11} />,
  'Dispatched':           <Send size={11} />,
  'Delivered':            <CheckCircle size={11} />,
};

function StatusBadge({ status }: { status: ReplenishmentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_ICONS[status]} {status}
    </span>
  );
}

function daysSince(dateStr: string) {
  if (!dateStr) return 0;
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

const STATUS_ORDER: ReplenishmentStatus[] = ['Pending', 'Ordered', 'Partially Dispatched', 'Dispatched', 'Delivered'];

function StatusChanger({ id, status, onChange }: { id: string; status: ReplenishmentStatus; onChange: (next: ReplenishmentStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function pick(next: ReplenishmentStatus, e: React.MouseEvent) {
    e.stopPropagation();
    if (next === status) { setOpen(false); return; }
    setSaving(true);
    try {
      await fetch(`/api/replenishment/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
      onChange(next);
    } finally { setSaving(false); setOpen(false); }
  }

  return (
    <div ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={saving}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-80 ${STATUS_STYLES[status]} ${saving ? 'opacity-50' : ''}`}
      >
        {STATUS_ICONS[status]} {status} <ChevronDown size={9} className="ml-0.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[180px]">
          {STATUS_ORDER.map(s => (
            <button key={s} onClick={e => pick(s, e)}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${s === status ? 'font-semibold' : ''}`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[s]}`}>
                {STATUS_ICONS[s]} {s}
              </span>
              {s === status && <span className="ml-auto text-slate-400 text-[10px]">current</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


interface NewItemRow {
  stockItemId: string;
  stockItemName: string;
  sku: string;
  quantityRequested: number;
  quantityOnHand: number;
  source: 'Storeroom' | '3PL';
  skipped: boolean;
}

type SmartImportLine = {
  sku: string;
  requested: number;
  slackOnHand: number | null;
  stock?: StockItem;
  rows: NewItemRow[];
  warning?: string;
};

function normaliseSku(value: string) {
  return value
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase()
    .trim();
}

function parseSlackRequest(text: string, stockBySku: Map<string, StockItem>, store?: string) {
  const lines: SmartImportLine[] = [];
  const unmatched: Array<{ sku: string; requested: number; raw: string }> = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[–—−]/g, '-').trim();
    if (!/\bsend\s+\d+/i.test(line)) continue;

    const qtyMatch = line.match(/\bsend\s+(\d+)/i);
    const skuMatches = Array.from(line.matchAll(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/gi));
    const sku = normaliseSku(skuMatches.at(-1)?.[0] ?? '');
    const requested = Number(qtyMatch?.[1] ?? 0);
    if (!sku || !requested) continue;
    if (seen.has(`${sku}:${requested}:${line}`)) continue;
    seen.add(`${sku}:${requested}:${line}`);

    const stock = stockBySku.get(sku);
    const slackOnHandMatch = line.match(/on hand:\s*(\d+)/i);
    const slackOnHand = slackOnHandMatch ? Number(slackOnHandMatch[1]) : null;

    if (!stock) {
      unmatched.push({ sku, requested, raw: rawLine.trim() });
      continue;
    }

    const available = Math.max(0, Number(stock.quantity) || 0);
    // Sydney Store always sources from 3PL — skip storeroom split
    const isSydney = store === 'Sydney Store';
    const storeroomQty = isSydney ? 0 : Math.min(available, requested);
    const tplQty = isSydney ? requested : Math.max(0, requested - storeroomQty);
    const rows: NewItemRow[] = [];

    if (storeroomQty > 0) {
      rows.push({
        stockItemId: stock.id,
        stockItemName: stock.name,
        sku: stock.sku,
        quantityRequested: storeroomQty,
        quantityOnHand: available,
        source: 'Storeroom',
        skipped: false,
      });
    }

    if (tplQty > 0) {
      rows.push({
        stockItemId: stock.id,
        stockItemName: stock.name,
        sku: stock.sku,
        quantityRequested: tplQty,
        quantityOnHand: available,
        source: '3PL',
        skipped: false,
      });
    }

    lines.push({
      sku,
      requested,
      slackOnHand,
      stock,
      rows,
      warning: stock.discontinued ? 'EOL item' : undefined,
    });
  }

  const splitCount = lines.filter(line => line.rows.length > 1).length;
  const storeroomUnits = lines.flatMap(line => line.rows).filter(row => row.source === 'Storeroom').reduce((sum, row) => sum + row.quantityRequested, 0);
  const tplUnits = lines.flatMap(line => line.rows).filter(row => row.source === '3PL').reduce((sum, row) => sum + row.quantityRequested, 0);

  return {
    lines,
    unmatched,
    splitCount,
    storeroomUnits,
    tplUnits,
    totalUnits: storeroomUnits + tplUnits,
  };
}

function ReplenishmentPageInner() {
  const searchParams = useSearchParams();
  const [requests, setRequests]     = useState<ReplenishmentRequest[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'All' | ReplenishmentStatus>('All');
  const [view, setView]             = useState<'list' | 'insights'>('list');
  const [showModal, setShowModal]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [includeEOL, setIncludeEOL]     = useState(false);
  const [filterFrom, setFilterFrom]     = useState('');
  const [filterTo,   setFilterTo]       = useState('');
  const [expandedRow, setExpandedRow]   = useState<string | null>(null);
  const { success, error: toastError } = useToast();

  // 3PL tracking alerts
  const [trackingAlerts, setTrackingAlerts] = useState<{ id: string; store: string; tplDispatchDate: string }[]>([]);

  // New request form state
  const [form, setForm] = useState({
    store:       'Adelaide Popup' as typeof STORES[number],
    orderNumber: generateOrderNumber('Adelaide Popup'),
    requestedBy: '',
    date:        new Date().toISOString().slice(0, 10),
    notes:       '',
  });
  const [newItems, setNewItems] = useState<NewItemRow[]>([]);
  const [formError, setFormError] = useState('');
  const [smartImportText, setSmartImportText] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [reqRes, stockRes] = await Promise.all([
        fetch('/api/replenishment'),
        fetch('/api/stock/items'),
      ]);
      const reqJson   = await reqRes.json();
      const stockJson = await stockRes.json();
      setRequests(reqJson.data ?? []);
      setStockItems(stockJson.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { document.title = 'Replenishment · SNAP Portal'; }, []);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch('/api/replenishment/alerts')
      .then(r => r.json())
      .then(d => setTrackingAlerts(d.items ?? []))
      .catch(err => console.warn('[ReplenishmentPage] alerts fetch failed:', err));
  }, [requests]); // re-check whenever requests reload

  // Auto-open modal — new request or duplicate
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const store = searchParams.get('store');
      if (store && (STORES as readonly string[]).includes(store)) {
        setForm(f => ({ ...f, store: store as typeof STORES[number] }));
      }
      setShowModal(true);
      window.history.replaceState({}, '', '/replenishment');
    }
    const dupId = searchParams.get('duplicate');
    if (dupId) {
      window.history.replaceState({}, '', '/replenishment');
      fetch(`/api/replenishment/${dupId}`)
        .then(r => r.json())
        .then(({ data }) => {
          if (!data) return;
          setForm(f => ({ ...f, store: data.store, orderNumber: '', requestedBy: data.requestedBy, notes: data.notes }));
          setNewItems(data.items.map((i: { stockItemId: string; stockItemName: string; sku: string; quantityRequested: number; quantityOnHand: number; source: string }) => ({
            stockItemId:       i.stockItemId,
            stockItemName:     i.stockItemName,
            sku:               i.sku,
            quantityRequested: i.quantityRequested,
            quantityOnHand:    i.quantityOnHand,
            source:            i.source as 'Storeroom' | '3PL',
            skipped:           false,
          })));
          setShowModal(true);
        })
        .catch(err => console.error('[ReplenishmentPage] duplicate prefill failed:', err));
    }
  }, [searchParams]);

  const displayed = useMemo(() => {
    let list = filter === 'All' ? requests : requests.filter(r => r.status === filter);
    if (filterFrom) list = list.filter(r => r.date >= filterFrom);
    if (filterTo)   list = list.filter(r => r.date <= filterTo);
    return list;
  }, [requests, filter, filterFrom, filterTo]);

  const counts = {
    All:                  requests.length,
    Pending:              requests.filter(r => r.status === 'Pending').length,
    Ordered:              requests.filter(r => r.status === 'Ordered').length,
    'Partially Dispatched': requests.filter(r => r.status === 'Partially Dispatched').length,
    Dispatched:           requests.filter(r => r.status === 'Dispatched').length,
    Delivered:            requests.filter(r => r.status === 'Delivered').length,
  };

  const insightsSource = useMemo(() => {
    let list = [...requests];
    if (filterFrom) list = list.filter(r => r.date >= filterFrom);
    if (filterTo)   list = list.filter(r => r.date <= filterTo);
    return list;
  }, [requests, filterFrom, filterTo]);

  const insightStores = useMemo(() => {
    return STORES.map(store => {
      const storeRequests = insightsSource.filter(r => r.store === store);
      const activeItems = storeRequests.flatMap(r => r.items.filter(i => !i.skipped).map(item => ({ request: r, item })));
      const totalUnits = activeItems.reduce((sum, row) => sum + row.item.quantityRequested, 0);
      const productMap = new Map<string, { name: string; sku: string; units: number; requests: Set<string> }>();
      const requesterMap = new Map<string, { name: string; units: number; requests: number }>();

      for (const row of activeItems) {
        const key = row.item.sku || row.item.stockItemName;
        const product = productMap.get(key) ?? { name: row.item.stockItemName, sku: row.item.sku, units: 0, requests: new Set<string>() };
        product.units += row.item.quantityRequested;
        product.requests.add(row.request.id);
        productMap.set(key, product);
      }

      for (const request of storeRequests) {
        const name = request.requestedBy || 'Unknown';
        const current = requesterMap.get(name) ?? { name, units: 0, requests: 0 };
        current.requests += 1;
        current.units += request.items.filter(i => !i.skipped).reduce((sum, item) => sum + item.quantityRequested, 0);
        requesterMap.set(name, current);
      }

      const openAgeing = storeRequests
        .filter(r => r.status !== 'Delivered')
        .map(r => ({
          id: r.id,
          orderNumber: r.orderNumber,
          status: r.status,
          days: daysSince(r.date),
          units: r.items.filter(i => !i.skipped).reduce((sum, item) => sum + item.quantityRequested, 0),
        }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 4);

      return {
        store,
        requests: storeRequests.length,
        totalUnits,
        averageUnits: storeRequests.length ? Math.round(totalUnits / storeRequests.length) : 0,
        topProducts: Array.from(productMap.values())
          .map(product => ({ ...product, requests: product.requests.size }))
          .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
          .slice(0, 8),
        topRequesters: Array.from(requesterMap.values())
          .sort((a, b) => b.units - a.units || b.requests - a.requests)
          .slice(0, 4),
        openAgeing,
      };
    });
  }, [insightsSource]);

  const insightTotals = useMemo(() => {
    const totalRequests = insightStores.reduce((sum, store) => sum + store.requests, 0);
    const totalUnits = insightStores.reduce((sum, store) => sum + store.totalUnits, 0);
    return { totalRequests, totalUnits, averageUnits: totalRequests ? Math.round(totalUnits / totalRequests) : 0 };
  }, [insightStores]);

  const insightTakeaways = useMemo(() => {
    const storeByUnits = [...insightStores].sort((a, b) => b.totalUnits - a.totalUnits);
    const busiest = storeByUnits[0];
    const quieter = storeByUnits[1];
    const oldestOpen = insightStores
      .flatMap(store => store.openAgeing.map(open => ({ ...open, store: store.store })))
      .sort((a, b) => b.days - a.days)[0];
    const topProductMap = new Map<string, { name: string; sku: string; units: number }>();

    for (const store of insightStores) {
      for (const product of store.topProducts) {
        const key = product.sku || product.name;
        const current = topProductMap.get(key) ?? { name: product.name, sku: product.sku, units: 0 };
        current.units += product.units;
        topProductMap.set(key, current);
      }
    }

    const topProduct = Array.from(topProductMap.values()).sort((a, b) => b.units - a.units)[0];
    const avgRatio = busiest && quieter && quieter.averageUnits > 0
      ? (busiest.averageUnits / quieter.averageUnits).toFixed(1)
      : '';

    return {
      busiest,
      quieter,
      busiestShare: busiest && insightTotals.totalUnits ? Math.round((busiest.totalUnits / insightTotals.totalUnits) * 100) : 0,
      avgRatio,
      oldestOpen,
      topProduct,
    };
  }, [insightStores, insightTotals.totalUnits]);

  const stockBySku = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const item of stockItems) {
      if (item.sku) map.set(normaliseSku(item.sku), item);
    }
    return map;
  }, [stockItems]);

  const smartImport = useMemo(() => parseSlackRequest(smartImportText, stockBySku, form.store), [smartImportText, stockBySku, form.store]);

  // ── New item management ────────────────────────────────────────────────────
  function addItem() {
    setNewItems(prev => [...prev, {
      stockItemId: '', stockItemName: '', sku: '',
      quantityRequested: 1, quantityOnHand: 0, source: form.store === 'Sydney Store' ? '3PL' : 'Storeroom', skipped: false,
    }]);
  }

  function removeItem(idx: number) {
    setNewItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<NewItemRow>) {
    setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  function selectStockItem(idx: number, stockItemId: string) {
    const stock = stockItems.find(s => s.id === stockItemId);
    if (!stock) return;
    updateItem(idx, {
      stockItemId,
      stockItemName: stock.name,
      sku:           stock.sku,
      quantityOnHand: stock.quantity,
    });
  }

  function applySmartImport(mode: 'append' | 'replace') {
    const rows = smartImport.lines.flatMap(line => line.rows);
    if (!rows.length) {
      setFormError('No matched SKU lines found to import.');
      return;
    }
    setNewItems(prev => mode === 'replace' ? rows : [...prev, ...rows]);
    setFormError('');
    success(
      mode === 'replace' ? 'Request items replaced' : 'Slack request imported',
      `${rows.length} replenishment line${rows.length !== 1 ? 's' : ''} added from ${smartImport.lines.length} matched SKU${smartImport.lines.length !== 1 ? 's' : ''}.`
    );
  }

  function handleSlackDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (text) setSmartImportText(text);
  }

  // ── Submit new request ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!newItems.length) { setFormError('Add at least one item.'); return; }
    if (newItems.some(i => !i.stockItemId)) { setFormError('Select a product for every item.'); return; }
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch('/api/replenishment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items: newItems }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequests(prev => [json.data, ...prev]);
      setShowModal(false);
      setNewItems([]);
      setSmartImportText('');
      setIncludeEOL(false);
      setForm({ store: 'Adelaide Popup', orderNumber: generateOrderNumber('Adelaide Popup'), requestedBy: '', date: new Date().toISOString().slice(0, 10), notes: '' });
      success('Request created', `Replenishment request for ${form.store} logged.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError('Failed to save', msg);
    } finally {
      setSaving(false);
    }
  }

  const totalUnits = (req: ReplenishmentRequest) =>
    req.items.reduce((s, i) => s + i.quantityRequested, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Replenishment</h1>
          <p className="page-subtitle">Manage stock dispatch to Adelaide Popup and Sydney Store</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => { setForm(f => ({ ...f, orderNumber: generateOrderNumber(f.store) })); setShowModal(true); }} className="btn-primary">
            <Plus size={15} /> New Request
          </button>
        </div>
      </div>

      {/* 3PL Tracking Alert Banner */}
      {trackingAlerts.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <Bell size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">
                {trackingAlerts.length === 1
                  ? '1 order needs a 3PL tracking number'
                  : `${trackingAlerts.length} orders need a 3PL tracking number`}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                These orders were dispatched via 3PL 2+ business days ago but have no tracking number yet.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {trackingAlerts.map(a => (
                  <a
                    key={a.id}
                    href={`/replenishment/${a.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-orange-200 text-orange-700 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Truck size={11} />
                    {a.store}
                    <span className="text-orange-400">·</span>
                    <span className="font-mono text-[10px]">{a.tplDispatchDate}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: 'Pending',    count: counts.Pending,    color: 'bg-amber-500' },
          { label: 'Ordered',    count: counts.Ordered,    color: 'bg-blue-500' },
          { label: 'Dispatched', count: counts.Dispatched, color: 'bg-emerald-500' },
          { label: 'Delivered',  count: counts.Delivered,  color: 'bg-slate-400' },
        ]).map(card => (
          <div key={card.label} className="card p-4 flex items-center gap-3">
            <div className={`w-2.5 h-8 rounded-full ${card.color}`} />
            <div>
              <p className="text-2xl font-bold font-mono text-slate-900">{card.count}</p>
              <p className="text-xs text-slate-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs + date range */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView('insights')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
              view === 'insights' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 size={14} /> Insights
          </button>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['All', 'Pending', 'Ordered', 'Partially Dispatched', 'Dispatched', 'Delivered'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {f}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-600" />
          <span className="text-slate-400 text-xs">→</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 text-slate-600" />
          {(filterFrom || filterTo) && (
            <button onClick={() => { setFilterFrom(''); setFilterTo(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors">✕</button>
          )}
        </div>
      </div>

      {/* Filter count */}
      {!loading && view === 'list' && (filter !== 'All' || filterFrom || filterTo) && (
        <p className="text-xs text-slate-400 -mt-2">
          Showing <span className="font-semibold text-slate-600">{displayed.length}</span> of <span className="font-semibold text-slate-600">{requests.length}</span> requests
        </p>
      )}

      {view === 'insights' && !loading && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Key takeaways</h2>
                <p className="text-xs text-slate-500 mt-0.5">Use this to understand where popup replenishment demand is coming from and what needs follow-up.</p>
              </div>
              {(filterFrom || filterTo) && (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  Date filtered
                </span>
              )}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Demand split</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {insightTakeaways.busiest
                    ? `${insightTakeaways.busiest.store} is ${insightTakeaways.busiestShare}% of units`
                    : 'No replenishment demand yet'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Higher share means that popup is driving most stock movement.</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Request size</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {insightTakeaways.busiest && insightTakeaways.quieter && insightTakeaways.avgRatio
                    ? `${insightTakeaways.busiest.store} requests are ${insightTakeaways.avgRatio}x larger`
                    : `${insightTotals.averageUnits} units per request`}
                </p>
                <p className="mt-1 text-xs text-slate-500">Larger averages mean fewer, bulkier restocks.</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Most requested</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                  {insightTakeaways.topProduct ? insightTakeaways.topProduct.name : 'No product demand yet'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {insightTakeaways.topProduct ? `${insightTakeaways.topProduct.units} units requested overall.` : 'Products will appear once requests are logged.'}
                </p>
              </div>
              <div className={`rounded-lg px-3 py-3 ${insightTakeaways.oldestOpen?.days && insightTakeaways.oldestOpen.days >= 3 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Needs follow-up</p>
                <p className={`mt-1 text-sm font-semibold ${insightTakeaways.oldestOpen?.days && insightTakeaways.oldestOpen.days >= 3 ? 'text-amber-800' : 'text-slate-900'}`}>
                  {insightTakeaways.oldestOpen
                    ? `${insightTakeaways.oldestOpen.store}: ${insightTakeaways.oldestOpen.days}d open`
                    : 'No open requests'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Older open requests may need dispatch, tracking, or delivery follow-up.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Requests</p>
              <p className="mt-2 text-2xl font-bold font-mono text-slate-900">{insightTotals.totalRequests}</p>
              <p className="mt-1 text-xs text-slate-400">How many replenishment orders were created.</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Units Requested</p>
              <p className="mt-2 text-2xl font-bold font-mono text-slate-900">{insightTotals.totalUnits}</p>
              <p className="mt-1 text-xs text-slate-400">Total product units requested by popups.</p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Average Request Size</p>
              <p className="mt-2 text-2xl font-bold font-mono text-slate-900">{insightTotals.averageUnits}</p>
              <p className="mt-1 text-xs text-slate-400">Higher means fewer but larger restocks.</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {insightStores.map(store => (
              <div key={store.store} className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{store.store}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{store.requests} requests · {store.totalUnits} units · {store.averageUnits} avg/request</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    store.store === 'Adelaide Popup' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                  }`}>
                    {store.totalUnits} units
                  </span>
                </div>

                <div className="p-5 space-y-5">
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Most Requested Products</h3>
                      <span className="text-[11px] text-slate-400">higher units = more popup demand</span>
                    </div>
                    {store.topProducts.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4">No product demand yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {store.topProducts.map(product => {
                          const pct = store.totalUnits ? Math.round((product.units / store.totalUnits) * 100) : 0;
                          return (
                            <div key={`${store.store}-${product.sku || product.name}`}>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800 truncate">{product.name}</p>
                                  <p className="text-[11px] text-slate-400 font-mono truncate">{product.sku || 'No SKU'} · {product.requests} request{product.requests !== 1 ? 's' : ''}</p>
                                </div>
                                <span className="font-bold font-mono text-slate-900">{product.units}</span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${store.store === 'Adelaide Popup' ? 'bg-emerald-400' : 'bg-sky-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <section>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top Requesters</h3>
                      <div className="space-y-2">
                        {store.topRequesters.length === 0 ? (
                          <p className="text-sm text-slate-400">No requester data.</p>
                        ) : store.topRequesters.map(requester => (
                          <div key={`${store.store}-${requester.name}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{requester.name}</p>
                              <p className="text-[11px] text-slate-400">{requester.requests} request{requester.requests !== 1 ? 's' : ''}</p>
                            </div>
                            <span className="text-sm font-bold font-mono text-slate-800">{requester.units}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Needs Follow-up</h3>
                      <div className="space-y-2">
                        {store.openAgeing.length === 0 ? (
                          <p className="text-sm text-slate-400">No open requests.</p>
                        ) : store.openAgeing.map(open => (
                          <Link key={open.id} href={`/replenishment/${open.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{open.orderNumber || open.status}</p>
                              <p className="text-[11px] text-slate-400">{open.status} · {open.units} units</p>
                            </div>
                            <span className={`text-xs font-semibold ${open.days >= 7 ? 'text-red-600' : open.days >= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {open.days}d
                            </span>
                          </Link>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {view === 'list' && (loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : displayed.length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState
            icon={Truck}
            title="No replenishment requests"
            description={filter === 'All' ? 'Create your first request to get started.' : `No ${filter.toLowerCase()} requests.`}
            action={filter === 'All' ? { label: 'New Request', onClick: () => setShowModal(true) } : { label: 'View all', onClick: () => setFilter('All') }}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Store</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Order #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requested by</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, idx) => {
                const isExpanded = expandedRow === r.id;
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                return (
                  <>
                    <tr key={r.id}
                      className={`border-b border-slate-100 hover:bg-brand-50/30 cursor-pointer transition-colors ${isExpanded ? 'bg-brand-50/20 border-l-2 border-l-brand-400' : rowBg}`}
                      onClick={() => window.location.href = `/replenishment/${r.id}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.date}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.store === 'Adelaide Popup' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                        }`}>{r.store}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.orderNumber || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-all ${
                            isExpanded
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}>
                          {r.items.length} <span className={isExpanded ? 'opacity-80' : 'text-slate-400'}>items</span>
                          <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ fontSize: 9 }}>▾</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">{totalUnits(r)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{r.requestedBy || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <StatusChanger
                          id={r.id}
                          status={r.status as ReplenishmentStatus}
                          onChange={(next) => setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: next } : x))}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-400"><ChevronRight size={16} /></td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-items`} className="border-b border-brand-100 border-l-2 border-l-brand-400">
                        <td colSpan={8} className="px-6 pb-4 pt-2 bg-brand-50/20">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Items in this order</p>
                          <div className="flex flex-wrap gap-2">
                            {r.items.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                <span className="text-xs text-slate-700">{item.stockItemName}</span>
                                <span className="text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">×{item.quantityRequested}</span>
                              </div>
                            ))}
                            <div className="flex items-center gap-1.5 ml-auto text-xs text-slate-500 self-center">
                              <span className="text-slate-400">Total:</span>
                              <span className="font-bold text-slate-800">{totalUnits(r)} units</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ))}

      {/* ── New Request Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">New Replenishment Request</h2>
              <button onClick={() => { setShowModal(false); setIncludeEOL(false); setSmartImportText(''); }} className="text-slate-400 hover:text-slate-600 p-1 text-lg leading-none">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Store + Order # */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Store</label>
                  <select value={form.store} onChange={e => { const s = e.target.value as typeof STORES[number]; setForm(f => ({ ...f, store: s, orderNumber: generateOrderNumber(s) })); }} className="form-input">
                    {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Order Number <span className="text-slate-400 font-normal text-[11px]">(auto-generated)</span></label>
                  <div className="relative">
                    <input value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} className="form-input font-mono pr-20" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, orderNumber: generateOrderNumber(f.store) }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-2 py-0.5 rounded transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>

              {/* Requested by + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Requested by</label>
                  <input value={form.requestedBy} onChange={e => setForm(f => ({ ...f, requestedBy: e.target.value }))} className="form-input" placeholder="e.g. Michael" />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
                </div>
              </div>

              {/* Smart import */}
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClipboardList size={15} className="text-brand-600" />
                      <p className="text-sm font-semibold text-slate-900">Smart import from Slack</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Paste or drop the Slack replenishment message. The portal matches SKUs, uses Stock Room first, then puts any shortfall on 3PL.
                    </p>
                  </div>
                  {smartImportText.trim() && (
                    <button onClick={() => setSmartImportText('')} className="text-xs font-medium text-slate-400 hover:text-slate-600">
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  value={smartImportText}
                  onChange={e => setSmartImportText(e.target.value)}
                  onDrop={handleSlackDrop}
                  onDragOver={e => e.preventDefault()}
                  rows={4}
                  className="mt-3 form-input resize-y bg-white"
                  placeholder="Paste Slack request here, e.g. PPU2-PNK · send 4 (on hand: 2)"
                />
                {smartImportText.trim() && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white px-3 py-2 text-center">
                        <p className="text-lg font-bold text-slate-900">{smartImport.lines.length}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Matched SKUs</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 text-center">
                        <p className="text-lg font-bold text-emerald-700">{smartImport.storeroomUnits}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Stock Room</p>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-2 text-center">
                        <p className="text-lg font-bold text-sky-700">{smartImport.tplUnits}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">3PL</p>
                      </div>
                    </div>

                    {smartImport.lines.length > 0 && (
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                        {smartImport.lines.slice(0, 12).map(line => (
                          <div key={`${line.sku}-${line.requested}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">{line.stock?.name ?? line.sku}</p>
                              <p className="font-mono text-[11px] text-slate-400">
                                {line.sku} · requested {line.requested}
                                {line.slackOnHand != null ? ` · Slack on hand ${line.slackOnHand}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold">
                              {line.rows.map(row => (
                                <span
                                  key={`${line.sku}-${row.source}`}
                                  className={`rounded-full px-2 py-0.5 ${
                                    row.source === 'Storeroom' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                                  }`}
                                >
                                  {row.source} {row.quantityRequested}
                                </span>
                              ))}
                              {line.warning && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{line.warning}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {smartImport.unmatched.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800">{smartImport.unmatched.length} SKU{smartImport.unmatched.length !== 1 ? 's' : ''} could not be matched</p>
                        <p className="mt-1 text-[11px] text-amber-700">
                          {smartImport.unmatched.slice(0, 4).map(row => `${row.sku} (${row.requested})`).join(', ')}
                          {smartImport.unmatched.length > 4 ? '…' : ''}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        {smartImport.splitCount > 0 ? `${smartImport.splitCount} SKU${smartImport.splitCount !== 1 ? 's' : ''} split between Stock Room and 3PL.` : 'No split needed for matched lines.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => applySmartImport('replace')} disabled={smartImport.lines.length === 0} className="btn-secondary text-xs disabled:opacity-40">
                          Replace Items
                        </button>
                        <button onClick={() => applySmartImport('append')} disabled={smartImport.lines.length === 0} className="btn-primary text-xs disabled:opacity-40">
                          Add Matched Items
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Items</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeEOL}
                        onChange={e => setIncludeEOL(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-amber-500"
                      />
                      <span className="text-xs text-slate-500">Include EOL items</span>
                    </label>
                    <button onClick={addItem} className="text-xs text-brand-600 hover:underline font-medium flex items-center gap-1">
                      <Plus size={12} /> Add item
                    </button>
                  </div>
                </div>

                {newItems.length === 0 ? (
                  <button onClick={addItem}
                    className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 text-slate-400 text-sm hover:border-brand-300 hover:text-brand-500 transition-colors flex flex-col items-center gap-1">
                    <Package size={20} />
                    Click to add items from the stockroom
                  </button>
                ) : (
                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="grid grid-cols-[24px_1fr_80px_80px_90px_24px] gap-2 px-1">
                      <span />
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Product</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">On Hand</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Qty Req.</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Source</p>
                      <span />
                    </div>
                    {newItems.map((item, idx) => (
                      <div key={idx} className={`grid grid-cols-[24px_1fr_80px_80px_90px_24px] gap-2 items-center rounded-lg px-2 py-2 transition-colors ${item.skipped ? 'bg-red-50' : 'bg-slate-50'}`}>
                        {/* Skip toggle */}
                        <button
                          onClick={() => updateItem(idx, { skipped: !item.skipped })}
                          title={item.skipped ? 'Undo skip' : 'Mark as out of stock'}
                          className={`text-base leading-none transition-colors ${item.skipped ? 'text-red-400 hover:text-slate-400' : 'text-slate-300 hover:text-red-400'}`}>
                          {item.skipped ? '↩' : '⊘'}
                        </button>
                        <select
                          value={item.stockItemId}
                          onChange={e => selectStockItem(idx, e.target.value)}
                          disabled={item.skipped}
                          className={`form-input text-xs py-1.5 ${item.skipped ? 'line-through text-red-400' : ''}`}>
                          <option value="">Select product…</option>
                          {stockItems.filter(s => includeEOL || !s.discontinued).map(s => (
                            <option key={s.id} value={s.id}>{s.name}{s.sku ? ` · ${s.sku}` : ''}{s.discontinued ? ' · EOL' : ''}</option>
                          ))}
                        </select>
                        <div className="text-center">
                          {item.source === '3PL' ? (
                            <span className="font-mono text-sm text-slate-300">—</span>
                          ) : (
                            <span className={`font-mono text-sm font-semibold ${
                              item.skipped ? 'text-slate-300' :
                              item.quantityOnHand === 0 ? 'text-red-500' :
                              item.quantityOnHand < (item.quantityRequested || 1) ? 'text-amber-500' :
                              'text-emerald-600'
                            }`}>
                              {item.stockItemId ? item.quantityOnHand : '—'}
                            </span>
                          )}
                        </div>
                        <input
                          type="number" min={1}
                          value={item.quantityRequested}
                          onChange={e => updateItem(idx, { quantityRequested: parseInt(e.target.value) || 0 })}
                          disabled={item.skipped}
                          className="form-input text-xs py-1.5 text-center font-mono"
                        />
                        <select
                          value={item.source}
                          onChange={e => updateItem(idx, { source: e.target.value as 'Storeroom' | '3PL' })}
                          disabled={item.skipped}
                          className="form-input text-xs py-1.5">
                          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 pt-1">
                      Total: <span className="font-mono font-semibold text-slate-700">{newItems.filter(i => !i.skipped).reduce((s, i) => s + (i.quantityRequested || 0), 0)} units</span>
                      {newItems.some(i => i.skipped) && (
                        <span className="ml-2 text-slate-300">({newItems.filter(i => i.skipped).length} skipped)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="form-input resize-none" placeholder="Any extra context…" />
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500" />
                  <p className="text-xs text-red-700">{formError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setShowModal(false); setIncludeEOL(false); setSmartImportText(''); }} className="btn-secondary">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReplenishmentPage() {
  return (
    <Suspense>
      <ReplenishmentPageInner />
    </Suspense>
  );
}
