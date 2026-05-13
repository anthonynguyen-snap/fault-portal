'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Package, Plus, X, ArrowDownCircle, ArrowUpCircle,
  ChevronDown, ChevronUp, AlertTriangle, Pencil, Trash2,
  CheckCircle, RefreshCw, ClipboardList, Printer, CheckSquare, Square,
  Camera, Keyboard, Undo2, Download, Search, Flashlight, RotateCcw,
} from 'lucide-react';
import { StockItem, StockMovement } from '@/types';
import { TableSkeleton } from '@/components/ui/Skeleton';

// ── Reason options ────────────────────────────────────────────────────────────
const IN_REASONS  = ['3PL Delivery', 'Customer Return', 'Returned from Popup', 'Stocktake Adjustment'];
const OUT_REASONS = ['Airport Run', 'Customer Exchange', 'Sent to 3PL', 'Sent to Popup', 'Written Off', 'Stocktake Adjustment'];

// ── Slide-over ────────────────────────────────────────────────────────────────
function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

// ── Movement line type ────────────────────────────────────────────────────────
type MovementLine = { stockItemId: string; quantity: number };
type BarcodeRow = { barcode: string; sku: string; productName: string; comment: string; sourcePage: string };
type ScanStatus = 'matched' | 'untracked' | 'unknown';
type ScanEvent = {
  id: string;
  timestamp: string;
  barcode: string;
  sku: string;
  productName: string;
  stockItemId: string;
  location: string;
  delta: number;
  source: 'scan' | 'manual' | 'batch';
  status: ScanStatus;
};
type FallbackMatch = BarcodeRow & { stockItem?: StockItem; reason: string; status: ScanStatus };
type ScanEntryMode = 'batch' | 'unit';

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StockPage() {
  const [items, setItems]           = useState<StockItem[]>([]);
  const [movements, setMovements]   = useState<StockMovement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saveOk, setSaveOk]         = useState(false);
  const [error, setError]           = useState('');

  // Slide-over mode
  const [panel, setPanel] = useState<'receive' | 'dispatch' | 'add-product' | null>(null);

  // Movement form
  const [movReason, setMovReason]   = useState('');
  const [movNotes, setMovNotes]     = useState('');
  const [movLines, setMovLines]     = useState<MovementLine[]>([{ stockItemId: '', quantity: 1 }]);

  // Add product form
  const [newName, setNewName]       = useState('');
  const [newSku, setNewSku]         = useState('');
  const [newThreshold, setNewThreshold] = useState(5);
  const [bulkMode, setBulkMode]     = useState(false);
  const [bulkText, setBulkText]     = useState('');
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Edit product
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState('');
  const [editThreshold, setEditThreshold] = useState(5);

  // History expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Stocktake mode ──────────────────────────────────────────────────────────
  const [stocktakeMode, setStocktakeMode] = useState(false);
  const [stCounts, setStCounts]     = useState<Record<string, string>>({});
  const [stTicked, setStTicked]     = useState<Set<string>>(new Set());
  const [stSaving, setStSaving]     = useState(false);
  const [stSaved, setStSaved]       = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Barcode stocktake mode ─────────────────────────────────────────────────
  const [scanMode, setScanMode] = useState(false);
  const [barcodeRows, setBarcodeRows] = useState<BarcodeRow[]>([]);
  const [barcodeLoadError, setBarcodeLoadError] = useState('');
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [scanLocation, setScanLocation] = useState('');
  const [scanUser, setScanUser] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanEntryMode, setScanEntryMode] = useState<ScanEntryMode>('batch');
  const [pendingCountItem, setPendingCountItem] = useState<ScanEvent | null>(null);
  const [batchQuantity, setBatchQuantity] = useState('1');
  const [finalisingStocktake, setFinalisingStocktake] = useState(false);
  const [addingScannedSku, setAddingScannedSku] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanNotice, setScanNotice] = useState('');
  const [lastConfirmedScan, setLastConfirmedScan] = useState<ScanEvent | null>(null);
  const [scanFlash, setScanFlash] = useState<ScanStatus | null>(null);
  const [scannerError, setScannerError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ barcode: string; at: number } | null>(null);
  const quantityHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quantityHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [itemsRes, movRes] = await Promise.all([
        fetch('/api/stock/items'),
        fetch('/api/stock/movements'),
      ]);
      const itemsJson = await itemsRes.json();
      const movJson   = await movRes.json();
      setItems(itemsJson.data ?? []);
      setMovements(movJson.data ?? []);
    } catch {
      setError('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openPanel(mode: 'receive' | 'dispatch') {
    setPanel(mode);
    setMovReason('');
    setMovNotes('');
    setMovLines([{ stockItemId: '', quantity: 1 }]);
  }

  function closePanel() {
    setPanel(null);
    setNewName(''); setNewSku(''); setNewThreshold(5);
    setBulkMode(false); setBulkText(''); setBulkResult(null);
  }

  function addLine() {
    setMovLines(l => [...l, { stockItemId: '', quantity: 1 }]);
  }

  function removeLine(i: number) {
    setMovLines(l => l.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof MovementLine, value: string | number) {
    setMovLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));
  }

  async function submitMovement() {
    if (!movReason) return;
    const validLines = movLines.filter(l => l.stockItemId && l.quantity > 0);
    if (!validLines.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: panel === 'receive' ? 'in' : 'out', reason: movReason, notes: movNotes, items: validLines }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      closePanel();
      await load();
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addProduct() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stock/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, sku: newSku, lowStockThreshold: newThreshold }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
      closePanel();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function bulkAddProducts() {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setSaving(true);
    setBulkResult(null);
    let added = 0;
    for (const line of lines) {
      const [name, sku] = line.split(',').map(s => s.trim());
      if (!name) continue;
      try {
        const res = await fetch('/api/stock/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, sku: sku ?? '', lowStockThreshold: newThreshold }),
        });
        const json = await res.json();
        if (!json.error) {
          setItems(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
          added++;
        }
      } catch { /* skip failed lines */ }
    }
    setSaving(false);
    setBulkResult(`${added} of ${lines.length} products added`);
    setBulkText('');
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch(`/api/stock/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, lowStockThreshold: editThreshold }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(prev => prev.map(i => i.id === id ? { ...i, name: editName, lowStockThreshold: editThreshold } : i));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Remove this product from stock tracking?')) return;
    try {
      await fetch(`/api/stock/items/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Stats (exclude discontinued from alerts)
  const totalUnits  = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const lowStock    = useMemo(() => items.filter(i => !i.discontinued && i.quantity > 0 && i.quantity <= i.lowStockThreshold), [items]);
  const outOfStock  = useMemo(() => items.filter(i => !i.discontinued && i.quantity === 0), [items]);

  // Group by SKU prefix (everything before the first dash), ungrouped items last
  const groupedItems = useMemo(() => {
    const groups = new Map<string, StockItem[]>();
    for (const item of items) {
      const prefix = item.sku ? item.sku.split('-')[0].toUpperCase() : 'No SKU';
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push(item);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'No SKU') return 1;
      if (b === 'No SKU') return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  const itemBySku = useMemo(() => {
    const map = new Map<string, StockItem>();
    for (const item of items) {
      if (item.sku) map.set(item.sku.trim().toUpperCase(), item);
    }
    return map;
  }, [items]);

  const barcodeByCode = useMemo(() => {
    const map = new Map<string, BarcodeRow>();
    for (const row of barcodeRows) map.set(row.barcode, row);
    return map;
  }, [barcodeRows]);

  const scanTotals = useMemo(() => {
    const map = new Map<string, { sku: string; productName: string; barcode: string; quantity: number; status: ScanStatus }>();
    for (const event of scanEvents) {
      const key = event.sku || event.barcode;
      const current = map.get(key) ?? {
        sku: event.sku,
        productName: event.productName,
        barcode: event.barcode,
        quantity: 0,
        status: event.status,
      };
      current.quantity += event.delta;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => a.sku.localeCompare(b.sku) || a.productName.localeCompare(b.productName));
  }, [scanEvents]);

  const fallbackMatches = useMemo<FallbackMatch[]>(() => {
    const query = manualBarcode.trim().toLowerCase();
    if (query.length < 2) return [];
    const digits = query.replace(/\D/g, '');
    const scored: Array<FallbackMatch & { score: number }> = [];

    for (const row of barcodeRows) {
      const sku = row.sku.toLowerCase();
      const product = row.productName.toLowerCase();
      const stockItem = itemBySku.get(row.sku.toUpperCase());
      let score = 0;
      let reason = '';

      if (digits.length >= 3 && row.barcode.endsWith(digits)) {
        score = 100 + digits.length;
        reason = `ends in ${digits}`;
      } else if (digits.length >= 4 && row.barcode.includes(digits)) {
        score = 80 + digits.length;
        reason = `contains ${digits}`;
      } else if (sku === query) {
        score = 75;
        reason = 'exact SKU';
      } else if (sku.includes(query)) {
        score = 55;
        reason = 'SKU match';
      } else if (query.length >= 3 && product.includes(query)) {
        score = 35;
        reason = 'product match';
      }

      if (score > 0) {
        scored.push({
          ...row,
          stockItem,
          reason,
          status: stockItem ? 'matched' : 'untracked',
          score,
        });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score || a.sku.localeCompare(b.sku))
      .slice(0, 8);
  }, [barcodeRows, itemBySku, manualBarcode]);

  function stockStatus(item: StockItem) {
    if (item.discontinued) return 'discontinued';
    if (item.quantity === 0) return 'out';
    if (item.quantity <= item.lowStockThreshold) return 'low';
    return 'ok';
  }

  async function toggleDiscontinued(item: StockItem) {
    const next = !item.discontinued;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, discontinued: next } : i));
    try {
      const res = await fetch(`/api/stock/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discontinued: next }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (e: any) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, discontinued: !next } : i));
      setError(e.message);
    }
  }

  function parseCsvLine(line: string) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  function parseBarcodeCsv(text: string): BarcodeRow[] {
    return text
      .split(/\r?\n/)
      .slice(1)
      .map(line => {
        const cols = parseCsvLine(line);
        return {
          barcode: (cols[0] ?? '').trim(),
          sku: (cols[1] ?? '').trim(),
          productName: (cols[2] ?? '').trim(),
          comment: (cols[3] ?? '').trim(),
          sourcePage: (cols[4] ?? '').trim(),
        };
      })
      .filter(row => row.barcode && row.sku);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/data/snap-master-barcodes.csv')
      .then(res => {
        if (!res.ok) throw new Error('Barcode file could not be loaded');
        return res.text();
      })
      .then(text => {
        if (!cancelled) setBarcodeRows(parseBarcodeCsv(text));
      })
      .catch(() => {
        if (!cancelled) setBarcodeLoadError('Barcode list could not be loaded');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('stocktake-scan-events');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) setScanEvents(saved);
    } catch { /* ignore old local data */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('stocktake-scan-events', JSON.stringify(scanEvents));
  }, [scanEvents]);

  function makeScanEvent(barcode: string, source: 'scan' | 'manual' | 'batch', overrideRow?: BarcodeRow, delta = 1): ScanEvent {
    const cleanBarcode = barcode.trim();
    const barcodeRow = overrideRow ?? barcodeByCode.get(cleanBarcode);
    const stockItem = barcodeRow ? itemBySku.get(barcodeRow.sku.toUpperCase()) : undefined;
    const status: ScanStatus = stockItem ? 'matched' : barcodeRow ? 'untracked' : 'unknown';
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      barcode: cleanBarcode,
      sku: barcodeRow?.sku ?? '',
      productName: barcodeRow?.productName ?? 'Unknown barcode',
      stockItemId: stockItem?.id ?? '',
      location: scanLocation.trim(),
      delta,
      source,
      status,
    };
  }

  function recordScanEvent(event: ScanEvent) {
    setScanEvents(prev => [event, ...prev]);
    setLastConfirmedScan(event);
    setScanFlash(event.status);
    setTimeout(() => setScanFlash(null), 700);
    setScanNotice(event.status === 'matched'
      ? `${event.sku} counted (${event.delta})`
      : event.status === 'untracked'
      ? `${event.sku} is not in stock items`
      : 'Unknown barcode');
    if (navigator.vibrate) navigator.vibrate(event.status === 'matched' ? 35 : [60, 40, 60]);
  }

  function selectCountItem(event: ScanEvent) {
    setPendingCountItem(event);
    setLastConfirmedScan(event);
    setScanFlash(event.status);
    setTimeout(() => setScanFlash(null), 700);
    setScanNotice(event.status === 'matched' ? `${event.sku} selected` : event.status === 'untracked' ? `${event.sku} needs review` : 'Unknown barcode');
    if (navigator.vibrate) navigator.vibrate(event.status === 'matched' ? 25 : [60, 40, 60]);
  }

  function confirmScan(barcode: string, source: 'scan' | 'manual' = 'scan', overrideRow?: BarcodeRow) {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;
    const now = Date.now();
    const last = lastScanRef.current;
    if (source === 'scan' && last?.barcode === cleanBarcode && now - last.at < 1400) {
      setScanNotice('Duplicate scan paused');
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      return;
    }
    lastScanRef.current = { barcode: cleanBarcode, at: now };
    const event = makeScanEvent(cleanBarcode, source, overrideRow);
    if (scanEntryMode === 'batch') {
      selectCountItem(event);
    } else {
      recordScanEvent(event);
    }
  }

  function countFallbackMatch(match: FallbackMatch) {
    confirmScan(match.barcode, 'manual', match);
    setManualBarcode('');
  }

  async function addScannedSkuToStock(event: ScanEvent) {
    if (!event.sku || event.status !== 'untracked') return;
    if (!confirm(`Add ${event.sku} to Stock Room with quantity 0?`)) return;
    setAddingScannedSku(true);
    setScannerError('');
    try {
      const res = await fetch('/api/stock/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: event.productName, sku: event.sku, lowStockThreshold: 5 }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const newItem = json.data as StockItem;
      setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));

      const updatedEvent: ScanEvent = {
        ...event,
        stockItemId: newItem.id,
        status: 'matched',
      };
      setPendingCountItem(prev => prev?.id === event.id ? updatedEvent : prev);
      setLastConfirmedScan(prev => prev?.id === event.id ? updatedEvent : prev);
      setScanEvents(prev => prev.map(scan => scan.id === event.id ? updatedEvent : scan));
      setScanNotice(`${event.sku} added to Stock Room`);
    } catch (e: any) {
      setScannerError(e.message || 'Could not add SKU to Stock Room');
    } finally {
      setAddingScannedSku(false);
    }
  }

  function addBatchCount() {
    if (!pendingCountItem) return;
    const quantity = Math.max(0, parseInt(batchQuantity, 10) || 0);
    if (quantity <= 0) {
      setScanNotice('Enter a quantity first');
      return;
    }
    const event = {
      ...pendingCountItem,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      location: scanLocation.trim(),
      delta: quantity,
      source: 'batch' as const,
    };
    recordScanEvent(event);
    setBatchQuantity('1');
  }

  function adjustBatchQuantity(delta: number) {
    setBatchQuantity(prev => {
      const current = parseInt(prev, 10);
      const next = Math.max(1, (Number.isFinite(current) ? current : 1) + delta);
      return String(next);
    });
  }

  function stopQuantityHold() {
    if (quantityHoldTimeoutRef.current) {
      clearTimeout(quantityHoldTimeoutRef.current);
      quantityHoldTimeoutRef.current = null;
    }
    if (quantityHoldIntervalRef.current) {
      clearInterval(quantityHoldIntervalRef.current);
      quantityHoldIntervalRef.current = null;
    }
  }

  function startQuantityHold(delta: number) {
    stopQuantityHold();
    adjustBatchQuantity(delta);
    quantityHoldTimeoutRef.current = setTimeout(() => {
      quantityHoldIntervalRef.current = setInterval(() => adjustBatchQuantity(delta), 90);
    }, 350);
  }

  function undoLastScan() {
    setScanEvents(prev => prev.slice(1));
    setLastConfirmedScan(scanEvents[1] ?? pendingCountItem ?? null);
    setScanNotice('Last scan undone');
  }

  function exportScanCsv() {
    const headers = ['event_id', 'timestamp', 'user', 'barcode', 'sku', 'product_name', 'delta', 'location', 'source', 'status'];
    const rows = scanEvents.map(event => [
      event.id,
      event.timestamp,
      scanUser,
      event.barcode,
      event.sku,
      event.productName,
      String(event.delta),
      event.location,
      event.source,
      event.status,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `stocktake-scans-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearScanSession() {
    if (!confirm('Clear this device scan session? Export first if these counts are needed.')) return;
    setScanEvents([]);
    setPendingCountItem(null);
    setLastConfirmedScan(null);
    setScanNotice('Scan session cleared');
  }

  async function finaliseScanStocktake() {
    const counted = new Map<string, { item: StockItem; quantity: number }>();
    for (const event of scanEvents) {
      if (event.status !== 'matched' || !event.stockItemId) continue;
      const item = items.find(i => i.id === event.stockItemId);
      if (!item) continue;
      const current = counted.get(item.id) ?? { item, quantity: 0 };
      current.quantity += event.delta;
      counted.set(item.id, current);
    }

    const rows = Array.from(counted.values());
    if (rows.length === 0) {
      setScanNotice('No matched counts to finalise');
      return;
    }

    const changes = rows.filter(row => row.quantity !== row.item.quantity);
    if (changes.length === 0) {
      if (!confirm(`No stock quantity changes for ${rows.length} counted SKU${rows.length !== 1 ? 's' : ''}. Clear this stocktake session?`)) return;
      clearScanSession();
      return;
    }

    if (!confirm(`Finalise stocktake for ${rows.length} counted SKU${rows.length !== 1 ? 's' : ''}? This will update Stock Room quantities for counted SKUs only.`)) return;

    const inItems = changes
      .filter(row => row.quantity > row.item.quantity)
      .map(row => ({ stockItemId: row.item.id, quantity: row.quantity - row.item.quantity }));
    const outItems = changes
      .filter(row => row.quantity < row.item.quantity)
      .map(row => ({ stockItemId: row.item.id, quantity: row.item.quantity - row.quantity }));

    setFinalisingStocktake(true);
    setScannerError('');
    try {
      const notes = `Scan stocktake finalised by ${scanUser || 'Unknown'}${scanLocation ? ` · ${scanLocation}` : ''}`;
      if (inItems.length > 0) {
        const res = await fetch('/api/stock/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'in', reason: 'Stocktake Adjustment', notes, items: inItems }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
      }
      if (outItems.length > 0) {
        const res = await fetch('/api/stock/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'out', reason: 'Stocktake Adjustment', notes, items: outItems }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
      }
      setScanNotice(`Finalised ${changes.length} stock adjustment${changes.length !== 1 ? 's' : ''}`);
      setScanEvents([]);
      setPendingCountItem(null);
      setLastConfirmedScan(null);
      await load();
    } catch (e: any) {
      setScannerError(e.message || 'Could not finalise stocktake');
    } finally {
      setFinalisingStocktake(false);
    }
  }

  async function startScanner() {
    setScannerError('');
    setTorchAvailable(false);
    setTorchOn(false);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        await scannerRef.current.clear().catch(() => {});
      }
      const scanner = new Html5Qrcode('stocktake-reader', {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(Math.min(viewfinderWidth * 0.9, 360));
            return { width, height: Math.floor(width * 0.42) };
          },
        },
        (decodedText: string) => confirmScan(decodedText, 'scan'),
        () => {}
      );
      setScannerActive(true);
      const capabilities = scanner.getRunningTrackCapabilities?.();
      setTorchAvailable(Boolean(capabilities && 'torch' in capabilities));
    } catch (e: any) {
      setScannerError(e.message || 'Camera scanner could not start');
      setScannerActive(false);
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) return;
    if (torchOn) await toggleTorch(false);
    await scannerRef.current.stop().catch(() => {});
    await scannerRef.current.clear().catch(() => {});
    scannerRef.current = null;
    setScannerActive(false);
    setTorchAvailable(false);
    setTorchOn(false);
  }

  async function resetScanner() {
    await stopScanner();
    setTimeout(() => { startScanner(); }, 150);
  }

  async function toggleTorch(force?: boolean) {
    if (!scannerRef.current) return;
    const next = force ?? !torchOn;
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setScannerError('Torch is not available on this device');
    }
  }

  function enterScanMode() {
    setScanMode(true);
    setScanNotice('');
    setScannerError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function exitScanMode() {
    await stopScanner();
    setScanMode(false);
  }

  useEffect(() => {
    if (!scanMode) return;
    return () => {
      stopQuantityHold();
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanMode]);

  // ── Stocktake helpers ───────────────────────────────────────────────────────
  const countableItems = useMemo(() => items.filter(i => !i.discontinued), [items]);
  const discontinuedItems = useMemo(() => items.filter(i => i.discontinued), [items]);

  const stChanges = useMemo(() => {
    return countableItems.filter(item => {
      const val = stCounts[item.id];
      if (val === undefined || val === '') return false;
      const n = parseInt(val, 10);
      return !isNaN(n) && n !== item.quantity;
    });
  }, [stCounts, countableItems]);

  function enterStocktake() {
    setStCounts({});
    setStTicked(new Set());
    setStSaving(false);
    setStSaved(false);
    setStocktakeMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exitStocktake() {
    const hasChanges = Object.values(stCounts).some(v => v !== '');
    if (hasChanges && !confirm('Exit stocktake? Any counts you\'ve entered will be lost.')) return;
    setStocktakeMode(false);
  }

  function tickAll() {
    if (stTicked.size === countableItems.length) {
      setStTicked(new Set());
    } else {
      setStTicked(new Set(countableItems.map(i => i.id)));
    }
  }

  // Tab to next input
  function handleCountKeyDown(e: React.KeyboardEvent, currentId: string) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const idx = countableItems.findIndex(i => i.id === currentId);
      const next = countableItems[idx + 1];
      if (next) {
        inputRefs.current[next.id]?.focus();
        inputRefs.current[next.id]?.select();
      }
      // Auto-tick on Enter
      if (e.key === 'Enter' && stCounts[currentId] !== undefined && stCounts[currentId] !== '') {
        setStTicked(prev => { const s = new Set(prev); s.add(currentId); return s; });
      }
    }
  }

  async function saveStocktake() {
    if (stChanges.length === 0) {
      setStocktakeMode(false);
      return;
    }
    const inItems  = stChanges
      .filter(item => parseInt(stCounts[item.id], 10) > item.quantity)
      .map(item => ({ stockItemId: item.id, quantity: parseInt(stCounts[item.id], 10) - item.quantity }));
    const outItems = stChanges
      .filter(item => parseInt(stCounts[item.id], 10) < item.quantity)
      .map(item => ({ stockItemId: item.id, quantity: item.quantity - parseInt(stCounts[item.id], 10) }));

    setStSaving(true);
    setError('');
    try {
      if (inItems.length > 0) {
        const res = await fetch('/api/stock/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'in', reason: 'Stocktake Adjustment', items: inItems }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
      }
      if (outItems.length > 0) {
        const res = await fetch('/api/stock/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'out', reason: 'Stocktake Adjustment', items: outItems }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
      }
      setStSaved(true);
      await load();
      setTimeout(() => {
        setStocktakeMode(false);
        setStSaved(false);
      }, 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStSaving(false);
    }
  }

  function printChecklist() {
    const rows = countableItems
      .map(i => `
        <tr>
          <td>${i.name}</td>
          <td style="font-family:monospace;color:#888">${i.sku || '—'}</td>
          <td style="text-align:center;font-weight:bold">${i.quantity}</td>
          <td style="border:1.5px solid #ccc;width:70px"></td>
          <td style="width:24px;border:1.5px solid #ccc;text-align:center"></td>
        </tr>`)
      .join('');
    const html = `<!DOCTYPE html>
<html><head><title>Stocktake Checklist</title>
<style>
  body{font-family:sans-serif;font-size:12px;color:#111;margin:24px}
  h2{font-size:15px;margin:0 0 4px}
  p{font-size:11px;color:#666;margin:0 0 16px}
  table{width:100%;border-collapse:collapse}
  th{background:#f4f4f4;text-align:left;padding:6px 8px;border-bottom:2px solid #ccc;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:middle;height:26px}
  tr:nth-child(even) td{background:#fafafa}
</style></head>
<body>
<h2>Stocktake Checklist</h2>
<p>Date: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; ${countableItems.length} products</p>
<table>
  <thead><tr><th>Product</th><th>SKU</th><th>On Hand</th><th>Count</th><th>✓</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  const reasons = panel === 'receive' ? IN_REASONS : OUT_REASONS;

  // ── Barcode Scan Mode render ───────────────────────────────────────────────
  if (scanMode) {
    const matchedCount = scanEvents.filter(e => e.status === 'matched').length;
    const unknownCount = scanEvents.filter(e => e.status !== 'matched').length;
    const isPendingSelection = Boolean(pendingCountItem && lastConfirmedScan?.id === pendingCountItem.id);
    const lastScanTotal = lastConfirmedScan
      ? scanEvents
          .filter(e => (lastConfirmedScan.sku ? e.sku === lastConfirmedScan.sku : e.barcode === lastConfirmedScan.barcode))
          .reduce((sum, e) => sum + e.delta, 0)
      : 0;

    return (
      <div className="max-w-5xl mx-auto space-y-4 pb-24 sm:pb-0">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 -mx-6 px-4 sm:px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera size={18} className="text-brand-600" /> Scan Stocktake
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {scanEvents.length} scans · {matchedCount} matched · {unknownCount} to review
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={undoLastScan} disabled={scanEvents.length === 0} className="btn-secondary px-3 disabled:opacity-40" title="Undo last scan">
                <Undo2 size={15} />
              </button>
              <button onClick={exportScanCsv} disabled={scanEvents.length === 0} className="btn-secondary px-3 disabled:opacity-40" title="Export CSV">
                <Download size={15} />
              </button>
              <button onClick={finaliseScanStocktake} disabled={scanEvents.length === 0 || finalisingStocktake} className="btn-primary disabled:opacity-40">
                {finalisingStocktake ? 'Finalising...' : 'Finalise'}
              </button>
              <button onClick={exitScanMode} className="btn-secondary">Exit</button>
            </div>
          </div>
        </div>

        {barcodeLoadError && (
          <div className="card p-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{barcodeLoadError}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)] gap-4">
          <div className="space-y-4">
            <div className="card p-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Counter</label>
                  <input value={scanUser} onChange={e => setScanUser(e.target.value)} className="form-input h-11 text-base sm:h-auto sm:text-sm" placeholder="Name" />
                </div>
                <div>
                  <label className="form-label">Location / bin</label>
                  <input value={scanLocation} onChange={e => setScanLocation(e.target.value)} className="form-input h-11 text-base sm:h-auto sm:text-sm" placeholder="e.g. Shelf A, Box 4" />
                </div>
              </div>
            </div>

            <div className="card p-4">
              <label className="form-label flex items-center gap-2">
                <Keyboard size={14} /> Find item manually
              </label>
              <div className="flex gap-2">
                <input
                  value={manualBarcode}
                  onChange={e => setManualBarcode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && fallbackMatches.length > 0) {
                      countFallbackMatch(fallbackMatches[0]);
                    } else if (e.key === 'Enter') {
                      confirmScan(manualBarcode, 'manual');
                      setManualBarcode('');
                    }
                  }}
                  inputMode={/^\d*$/.test(manualBarcode) ? 'numeric' : 'search'}
                  className="form-input h-11 text-base sm:h-auto sm:text-sm"
                  placeholder="Type last digits, SKU, or product"
                />
                <button
                  onClick={() => {
                    if (fallbackMatches.length > 0) countFallbackMatch(fallbackMatches[0]);
                    else {
                      confirmScan(manualBarcode, 'manual');
                      setManualBarcode('');
                    }
                  }}
                  className="btn-primary px-5"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">For iPhone, type the last 4-6 barcode digits to bring up quick matches.</p>
              {manualBarcode.trim().length >= 2 && (
                <div className="mt-3 rounded-lg border border-slate-100 overflow-hidden divide-y divide-slate-100">
                  {fallbackMatches.length > 0 ? fallbackMatches.map(match => (
                    <button
                      key={`${match.barcode}-${match.sku}`}
                      onClick={() => countFallbackMatch(match)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{match.productName}</p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{match.sku} · {match.barcode}</p>
                        <p className="text-[11px] text-brand-600 mt-0.5">{match.reason}</p>
                      </div>
                      <span className={`badge flex-shrink-0 ${
                        match.status === 'matched' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        +1
                      </span>
                    </button>
                  )) : (
                    <div className="px-3 py-4 text-sm text-slate-400 text-center">
                      No matches yet. Keep typing or enter the full barcode.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="card p-4 space-y-4">
              <div>
                <label className="form-label">Count mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setScanEntryMode('batch')}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      scanEntryMode === 'batch'
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Batch Count
                  </button>
                  <button
                    onClick={() => setScanEntryMode('unit')}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      scanEntryMode === 'unit'
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Scan +1
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Batch Count scans one item to identify the SKU, then lets you enter the physical quantity counted.
                </p>
              </div>

              {scanEntryMode === 'batch' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {pendingCountItem ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Selected SKU</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">{pendingCountItem.productName}</p>
                          <p className="text-[11px] font-mono text-slate-400 truncate">{pendingCountItem.sku || pendingCountItem.barcode}</p>
                        </div>
                        <button onClick={() => setPendingCountItem(null)} className="btn-ghost p-1.5">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-[56px_1fr_56px] gap-2">
                        <button
                          type="button"
                          onPointerDown={() => startQuantityHold(-1)}
                          onPointerUp={stopQuantityHold}
                          onPointerLeave={stopQuantityHold}
                          onPointerCancel={stopQuantityHold}
                          className="h-12 rounded-lg border border-slate-200 bg-white text-2xl font-bold text-slate-600 hover:bg-slate-50 active:bg-slate-100 touch-none"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          value={batchQuantity}
                          onChange={e => setBatchQuantity(e.target.value)}
                          onFocus={e => e.target.select()}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          type="number"
                          min="0"
                          className="form-input h-12 text-lg font-bold text-center"
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onPointerDown={() => startQuantityHold(1)}
                          onPointerUp={stopQuantityHold}
                          onPointerLeave={stopQuantityHold}
                          onPointerCancel={stopQuantityHold}
                          className="h-12 rounded-lg border border-slate-200 bg-white text-2xl font-bold text-slate-600 hover:bg-slate-50 active:bg-slate-100 touch-none"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button onClick={addBatchCount} disabled={pendingCountItem.status !== 'matched'} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
                          Add Count
                      </button>
                      <p className="text-[11px] text-slate-400">Tap or hold − / + to adjust before adding the count.</p>
                      {pendingCountItem.status !== 'matched' && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs text-amber-700 font-medium">This barcode is known, but it is not in Stock Room yet.</p>
                          {pendingCountItem.status === 'untracked' && (
                            <button
                              onClick={() => addScannedSkuToStock(pendingCountItem)}
                              disabled={addingScannedSku}
                              className="mt-2 btn-secondary w-full justify-center bg-white disabled:opacity-50"
                            >
                              {addingScannedSku ? 'Adding...' : 'Add to Stock Room'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Scan or search an item, then enter the counted quantity here.</p>
                  )}
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <p className="text-sm font-semibold text-slate-800">Camera scan</p>
                <p className="text-xs text-slate-500 mt-0.5">Hold steady, fill the box with the barcode, and move closer if it looks blurry.</p>
              </div>
              <div
                className={`relative border-4 transition-colors duration-150 ${
                  scanFlash === 'matched'
                    ? 'border-emerald-400'
                    : scanFlash === 'untracked'
                    ? 'border-amber-400'
                    : scanFlash === 'unknown'
                    ? 'border-red-400'
                    : 'border-slate-950'
                }`}
              >
                <div id="stocktake-reader" className="min-h-[360px] sm:min-h-[420px] bg-slate-950" />
                {lastConfirmedScan && (
                  <div className="absolute left-2 right-2 bottom-2 sm:left-3 sm:right-3 sm:bottom-3 rounded-lg bg-white/95 border border-slate-200 shadow-xl p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold uppercase tracking-wide ${
                          lastConfirmedScan.status === 'matched'
                            ? 'text-emerald-600'
                            : lastConfirmedScan.status === 'untracked'
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}>
                          {isPendingSelection
                            ? 'Ready for quantity'
                            : lastConfirmedScan.status === 'matched'
                            ? `Counted ${lastConfirmedScan.delta}`
                            : lastConfirmedScan.status === 'untracked'
                            ? 'Known barcode, review'
                            : 'Unknown barcode'}
                        </p>
                        <p className="text-base sm:text-sm font-semibold text-slate-900 truncate mt-0.5">
                          {lastConfirmedScan.productName}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          {lastConfirmedScan.sku || lastConfirmedScan.barcode}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">{isPendingSelection ? 'Enter Qty' : 'This SKU'}</p>
                        <p className="text-4xl sm:text-3xl font-bold text-slate-900 leading-none">{isPendingSelection ? batchQuantity || '0' : lastScanTotal}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500 min-w-0">
                  {barcodeRows.length} barcodes loaded
                  {scannerError && <span className="ml-2 text-red-600 font-medium">{scannerError}</span>}
                  {scanNotice && <span className="ml-2 text-brand-700 font-medium">{scanNotice}</span>}
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  {scannerActive ? (
                    <button onClick={stopScanner} className="btn-secondary justify-center">
                      <X size={14} /> Stop
                    </button>
                  ) : (
                    <button onClick={startScanner} className="btn-primary col-span-2 sm:col-span-1 justify-center py-3 sm:py-2">
                      <Camera size={14} /> Start Camera
                    </button>
                  )}
                  {scannerActive && (
                    <button onClick={resetScanner} className="btn-secondary justify-center">
                      <RotateCcw size={14} /> Reset
                    </button>
                  )}
                  {scannerActive && torchAvailable && (
                    <button onClick={() => toggleTorch()} className={`btn-secondary col-span-2 sm:col-span-1 justify-center ${torchOn ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}`}>
                      <Flashlight size={14} /> {torchOn ? 'Torch On' : 'Torch'}
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="card p-3">
                <p className="text-xl font-bold text-slate-900">{scanEvents.length}</p>
                <p className="text-[11px] text-slate-500">Scans</p>
              </div>
              <div className="card p-3">
                <p className="text-xl font-bold text-emerald-600">{matchedCount}</p>
                <p className="text-[11px] text-slate-500">Matched</p>
              </div>
              <div className="card p-3">
                <p className="text-xl font-bold text-amber-600">{unknownCount}</p>
                <p className="text-[11px] text-slate-500">Review</p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Pending Counts</h2>
                  <p className="text-[11px] text-slate-400">Stock Room updates only after Finalise</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={finaliseScanStocktake} disabled={scanEvents.length === 0 || finalisingStocktake} className="btn-ghost text-xs text-brand-600 disabled:opacity-40">
                    {finalisingStocktake ? 'Finalising...' : 'Finalise'}
                  </button>
                  <button onClick={clearScanSession} disabled={scanEvents.length === 0} className="btn-ghost text-xs disabled:opacity-40">Clear</button>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
                {scanTotals.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    <Search size={22} className="mx-auto mb-2" />
                    No scans yet
                  </div>
                ) : scanTotals.map(total => {
                  const untrackedEvent = total.status === 'untracked'
                    ? scanEvents.find(event => event.status === 'untracked' && (event.sku || event.barcode) === (total.sku || total.barcode))
                    : undefined;
                  return (
                  <div key={total.sku || total.barcode} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{total.productName}</p>
                      <p className="text-[11px] font-mono text-slate-400">{total.sku || total.barcode}</p>
                      {total.status !== 'matched' && (
                        <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                          {total.status === 'untracked' ? 'Barcode known, product not in stock list' : 'Unknown barcode'}
                        </p>
                      )}
                      {untrackedEvent && (
                        <button
                          onClick={() => addScannedSkuToStock(untrackedEvent)}
                          disabled={addingScannedSku}
                          className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                          {addingScannedSku ? 'Adding...' : 'Add to Stock Room'}
                        </button>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{total.quantity}</span>
                  </div>
                );
                })}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Last Scans</h2>
              </div>
              <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                {scanEvents.slice(0, 20).map(event => (
                  <div key={event.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{event.productName}</p>
                        <p className="text-[11px] font-mono text-slate-400">{event.barcode}</p>
                      </div>
                      <span className={`badge ${
                        event.status === 'matched'
                          ? 'bg-emerald-100 text-emerald-700'
                          : event.status === 'untracked'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(event.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                      {event.location && <span> · {event.location}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur p-3 sm:hidden">
          <div className="grid grid-cols-4 gap-2">
            <button onClick={undoLastScan} disabled={scanEvents.length === 0} className="btn-secondary justify-center py-3 disabled:opacity-40">
              <Undo2 size={15} /> Undo
            </button>
            <button onClick={exportScanCsv} disabled={scanEvents.length === 0} className="btn-secondary justify-center py-3 disabled:opacity-40">
              <Download size={15} /> Export
            </button>
            <button onClick={finaliseScanStocktake} disabled={scanEvents.length === 0 || finalisingStocktake} className="btn-primary justify-center py-3 disabled:opacity-40">
              {finalisingStocktake ? '...' : 'Final'}
            </button>
            <button onClick={exitScanMode} className="btn-primary justify-center py-3">
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stocktake Mode render ───────────────────────────────────────────────────
  if (stocktakeMode) {
    const tickedCount   = stTicked.size;
    const totalCountable = countableItems.length;
    const progress      = totalCountable > 0 ? Math.round((tickedCount / totalCountable) * 100) : 0;
    const allTicked     = tickedCount === totalCountable && totalCountable > 0;

    return (
      <div className="max-w-5xl mx-auto space-y-5 pb-24 sm:pb-0">
        {/* Stocktake header */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 -mx-6 px-4 sm:px-6 py-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-3">
              <div>
                <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList size={18} className="text-brand-600" /> Stocktake Mode
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tickedCount} of {totalCountable} products ticked off
                  {stChanges.length > 0 && (
                    <span className="ml-2 text-amber-600 font-medium">· {stChanges.length} change{stChanges.length !== 1 ? 's' : ''} pending</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <button onClick={printChecklist} className="hidden sm:inline-flex btn-secondary gap-1.5 text-xs">
                  <Printer size={13} /> Print Checklist
                </button>
                <button onClick={exitStocktake} className="btn-secondary justify-center text-xs">
                  Exit
                </button>
                <button
                  onClick={saveStocktake}
                  disabled={stSaving || stSaved}
                  className={`btn-primary justify-center text-sm flex items-center gap-2 ${stSaved ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                >
                  {stSaved
                    ? <><CheckCircle size={14} /> Saved!</>
                    : stSaving
                    ? <><RefreshCw size={14} className="animate-spin" /> Saving…</>
                    : stChanges.length > 0
                    ? `Save ${stChanges.length} Change${stChanges.length !== 1 ? 's' : ''}`
                    : 'Save'}
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="card p-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Stocktake table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 w-10">
                  <button onClick={tickAll} className="flex items-center justify-center text-slate-400 hover:text-brand-600 transition-colors">
                    {allTicked
                      ? <CheckSquare size={16} className="text-brand-600" />
                      : <Square size={16} />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">On Hand</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Count</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Variance</th>
              </tr>
            </thead>
            <tbody>
              {countableItems.map((item, idx) => {
                const raw     = stCounts[item.id] ?? '';
                const counted = raw !== '' ? parseInt(raw, 10) : null;
                const delta   = counted !== null && !isNaN(counted) ? counted - item.quantity : null;
                const isTicked = stTicked.has(item.id);
                const hasValue = raw !== '' && !isNaN(parseInt(raw, 10));

                // Group header row
                const prevItem  = countableItems[idx - 1];
                const currPrefix = item.sku ? item.sku.split('-')[0].toUpperCase() : 'No SKU';
                const prevPrefix = prevItem?.sku ? prevItem.sku.split('-')[0].toUpperCase() : 'No SKU';
                const showGroup  = idx === 0 || currPrefix !== prevPrefix;

                return (
                  <>
                    {showGroup && (
                      <tr key={`st-group-${currPrefix}`}>
                        <td colSpan={6} className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currPrefix}</span>
                        </td>
                      </tr>
                    )}
                    <tr
                      key={item.id}
                      className={`border-b border-slate-50 transition-colors ${isTicked ? 'bg-emerald-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Tick */}
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => {
                            setStTicked(prev => {
                              const s = new Set(prev);
                              if (s.has(item.id)) s.delete(item.id); else s.add(item.id);
                              return s;
                            });
                          }}
                          className="flex items-center justify-center text-slate-300 hover:text-brand-500 transition-colors"
                        >
                          {isTicked
                            ? <CheckSquare size={16} className="text-emerald-500" />
                            : <Square size={16} />}
                        </button>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-2.5">
                        <span className={`font-medium ${isTicked ? 'text-slate-500' : 'text-slate-800'}`}>
                          {item.name}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{item.sku || '—'}</td>

                      {/* On hand */}
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-lg font-bold text-slate-400">{item.quantity}</span>
                      </td>

                      {/* Count input */}
                      <td className="px-4 py-2.5 text-center">
                        <input
                          ref={el => { inputRefs.current[item.id] = el; }}
                          type="number"
                          min="0"
                          value={raw}
                          onChange={e => setStCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={e => handleCountKeyDown(e, item.id)}
                          onFocus={e => e.target.select()}
                          placeholder="—"
                          className={`w-24 text-center text-lg font-bold rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 transition-colors ${
                            hasValue && delta !== 0
                              ? 'border-amber-300 bg-amber-50 text-slate-900 focus:ring-amber-400'
                              : hasValue
                              ? 'border-emerald-300 bg-emerald-50 text-slate-900 focus:ring-emerald-400'
                              : 'border-slate-200 bg-white text-slate-700 focus:ring-brand-400'
                          }`}
                        />
                      </td>

                      {/* Variance */}
                      <td className="px-4 py-2.5 text-right">
                        {delta !== null && !isNaN(delta) && delta !== 0 ? (
                          <span className={`text-sm font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        ) : delta === 0 && hasValue ? (
                          <span className="text-xs text-slate-300">✓</span>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })}

              {/* Discontinued items — shown greyed, no input */}
              {discontinuedItems.length > 0 && (
                <>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End of Life — not counted</span>
                    </td>
                  </tr>
                  {discontinuedItems.map(item => (
                    <tr key={item.id} className="border-b border-slate-50 opacity-40">
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-sm line-through text-slate-400">{item.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-slate-300">{item.sku || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-bold">{item.quantity}</td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5" />
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Bottom save bar */}
        {stChanges.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:sticky sm:bottom-4 sm:flex sm:justify-center pointer-events-none">
            <div className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-xl px-4 sm:px-5 py-3 flex items-center justify-between sm:justify-start gap-3 sm:gap-4">
              <div className="text-sm">
                <span className="font-semibold">{stChanges.length} change{stChanges.length !== 1 ? 's' : ''}</span>
                <span className="hidden sm:inline text-slate-400 ml-1.5">ready to save</span>
              </div>
              <button
                onClick={saveStocktake}
                disabled={stSaving || stSaved}
                className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 sm:py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {stSaving ? 'Saving…' : stSaved ? '✓ Saved' : 'Save All Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Normal mode render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="page-title">Stock Room</h1>
          <p className="page-subtitle">In-house office stock only — does not reflect 3PL inventory</p>
        </div>
        <div className="hidden sm:flex sm:flex-col sm:items-end gap-2">
          {saveOk && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <CheckCircle size={14} /> Saved
            </span>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={load} className="btn-secondary justify-center">
              <RefreshCw size={14} /> Refresh
            </button>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stocktake</span>
              <button onClick={enterScanMode} className="btn-primary justify-center gap-1.5">
                <Camera size={15} /> Scan Count
              </button>
              <button onClick={enterStocktake} className="btn-secondary justify-center gap-1.5">
                <ClipboardList size={15} className="text-brand-600" /> Manual Count
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
              <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stock Movement</span>
              <button onClick={() => openPanel('receive')} className="btn-secondary justify-center">
                <ArrowDownCircle size={15} className="text-emerald-600" /> Receive
              </button>
              <button onClick={() => openPanel('dispatch')} className="btn-secondary justify-center">
                <ArrowUpCircle size={15} className="text-brand-600" /> Dispatch
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 sm:hidden">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stocktake</p>
          <button onClick={enterScanMode} className="btn-primary w-full justify-center py-3 text-base">
            <Camera size={18} /> Start Scan Count
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={enterStocktake} className="btn-secondary justify-center py-2.5">
              <ClipboardList size={14} /> Manual Count
            </button>
            <button onClick={load} className="btn-secondary justify-center py-2.5">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stock Movement</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => openPanel('receive')} className="btn-secondary justify-center py-2.5">
              <ArrowDownCircle size={14} className="text-emerald-600" /> Receive
            </button>
            <button onClick={() => openPanel('dispatch')} className="btn-secondary justify-center py-2.5">
              <ArrowUpCircle size={14} className="text-brand-600" /> Dispatch
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-lg font-bold text-slate-900">{items.length}</p>
            <p className="text-[10px] text-slate-500">Products</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-lg font-bold text-slate-900">{totalUnits}</p>
            <p className="text-[10px] text-slate-500">Units</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-lg font-bold text-slate-900">{outOfStock.length + lowStock.length}</p>
            <p className="text-[10px] text-slate-500">Alerts</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            <p className="text-xs text-slate-500">Products tracked</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ArrowDownCircle size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalUnits}</p>
            <p className="text-xs text-slate-500">Total units in stock</p>
          </div>
        </div>
        <div className={`card p-4 flex items-center gap-3 ${outOfStock.length > 0 ? 'border-red-200' : lowStock.length > 0 ? 'border-amber-200' : ''}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${outOfStock.length > 0 ? 'bg-red-50' : lowStock.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <AlertTriangle size={18} className={outOfStock.length > 0 ? 'text-red-500' : lowStock.length > 0 ? 'text-amber-500' : 'text-slate-400'} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{outOfStock.length + lowStock.length}</p>
            <p className="text-xs text-slate-500">Low / out of stock</p>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Current Stock</h2>
          <button onClick={() => setPanel('add-product')} className="btn-ghost text-xs gap-1.5">
            <Plus size={13} /> Add Product
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">No products yet</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Add your first product to start tracking stock</p>
            <button onClick={() => setPanel('add-product')} className="btn-primary">
              <Plus size={14} /> Add Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {groupedItems.map(([prefix, groupItems]) => (
                <>
                  <tr key={`group-${prefix}`}>
                    <td colSpan={5} className="px-5 py-2 bg-slate-50 border-y border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prefix}</span>
                        <span className="text-[10px] text-slate-400">{groupItems.length} product{groupItems.length !== 1 ? 's' : ''}</span>
                      </div>
                    </td>
                  </tr>
                  {groupItems.map(item => {
                    const status = stockStatus(item);
                    const isEditing = editingId === item.id;
                    const isDiscontinued = item.discontinued;
                    return (
                      <tr key={item.id} className={`group transition-colors border-b border-slate-50 ${isDiscontinued ? 'bg-slate-50/60 hover:bg-slate-100/60' : 'hover:bg-slate-50/70'}`}>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="form-input text-sm py-1.5"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isDiscontinued ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {item.name}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className={`px-5 py-3.5 text-xs font-mono ${isDiscontinued ? 'text-slate-300' : 'text-slate-400'}`}>{item.sku || '—'}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`text-2xl font-bold ${
                            isDiscontinued ? 'text-slate-300' :
                            status === 'out' ? 'text-red-500' :
                            status === 'low' ? 'text-amber-500' :
                            'text-slate-900'
                          }`}>
                            {item.quantity}
                          </span>
                          {isEditing && (
                            <div className="mt-1">
                              <label className="text-[10px] text-slate-400">Low stock at</label>
                              <input
                                type="number"
                                value={editThreshold}
                                onChange={e => setEditThreshold(Number(e.target.value))}
                                className="form-input text-xs py-1 w-16 text-center ml-1"
                                min={1}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isDiscontinued ? (
                            <span className="badge bg-slate-100 text-slate-500">EOL</span>
                          ) : status === 'out' ? (
                            <span className="badge bg-red-100 text-red-700">Out of stock</span>
                          ) : status === 'low' ? (
                            <span className="badge bg-amber-100 text-amber-700">
                              <AlertTriangle size={11} /> Low stock
                            </span>
                          ) : (
                            <span className="badge bg-emerald-100 text-emerald-700">In stock</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => toggleDiscontinued(item)}
                                className={`text-xs py-1 px-2.5 rounded-md border font-medium transition-colors ${
                                  isDiscontinued
                                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                                title={isDiscontinued ? 'Mark as active' : 'Mark as end of life'}
                              >
                                {isDiscontinued ? 'Reactivate' : 'Mark EOL'}
                              </button>
                              <button onClick={() => saveEdit(item.id)} className="btn-primary text-xs py-1 px-3">Save</button>
                              <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => toggleDiscontinued(item)}
                                className="btn-ghost p-1.5"
                                title={isDiscontinued ? 'Reactivate product' : 'Mark as end of life'}
                              >
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDiscontinued ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {isDiscontinued ? 'ACTIVE' : 'EOL'}
                                </span>
                              </button>
                              <button
                                onClick={() => { setEditingId(item.id); setEditName(item.name); setEditThreshold(item.lowStockThreshold); }}
                                className="btn-ghost p-1.5"
                                title="Edit"
                              >
                                <Pencil size={13} className="text-slate-400" />
                              </button>
                              <button onClick={() => deleteProduct(item.id)} className="btn-ghost p-1.5" title="Remove">
                                <Trash2 size={13} className="text-slate-400 hover:text-red-500" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Movement History */}
      {movements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Movement History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Last 50 stock movements</p>
          </div>
          <div className="divide-y divide-slate-50">
            {movements.map(mv => {
              const isIn       = mv.type === 'in';
              const totalUnits = mv.items.reduce((s, i) => s + i.quantity, 0);
              const expanded   = expandedId === mv.id;
              const d          = new Date(mv.createdAt);
              const dateStr    = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
              const timeStr    = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={mv.id}>
                  <button
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedId(expanded ? null : mv.id)}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-emerald-100' : 'bg-brand-50'}`}>
                      {isIn
                        ? <ArrowDownCircle size={16} className="text-emerald-600" />
                        : <ArrowUpCircle  size={16} className="text-brand-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{mv.reason}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {mv.items.length} product{mv.items.length !== 1 ? 's' : ''} · {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
                        {mv.notes && <span className="ml-1.5 text-slate-400">· {mv.notes}</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-500">{dateStr}</p>
                      <p className="text-xs text-slate-400">{timeStr}</p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-5 pb-3.5 pt-0 bg-slate-50/50">
                      <div className="ml-12 space-y-1.5">
                        {mv.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{item.stockItemName}</span>
                            <span className={`font-semibold ${isIn ? 'text-emerald-700' : 'text-brand-700'}`}>
                              {isIn ? '+' : '−'}{item.quantity} unit{item.quantity !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Receive / Dispatch Slide-over */}
      <SlideOver
        open={panel === 'receive' || panel === 'dispatch'}
        onClose={closePanel}
        title={panel === 'receive' ? 'Receive Stock' : 'Dispatch Stock'}
      >
        <div className="space-y-5">
          <div>
            <label className="form-label">Reason</label>
            <select value={movReason} onChange={e => setMovReason(e.target.value)} className="form-input">
              <option value="">Select a reason…</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Products</label>
            <div className="space-y-2">
              {movLines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={line.stockItemId}
                    onChange={e => updateLine(i, 'stockItemId', e.target.value)}
                    className="form-input flex-1 text-sm"
                  >
                    <option value="">Select product…</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={e => updateLine(i, 'quantity', Number(e.target.value))}
                    className="form-input w-20 text-sm text-center"
                  />
                  {movLines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="btn-ghost p-1.5 flex-shrink-0">
                      <X size={14} className="text-slate-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLine} className="btn-ghost text-xs mt-2 gap-1.5">
              <Plus size={12} /> Add another product
            </button>
          </div>
          <div>
            <label className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={movNotes}
              onChange={e => setMovNotes(e.target.value)}
              placeholder="e.g. Weekly airport run, order ref #1234…"
              rows={2}
              className="form-input resize-none text-sm"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={submitMovement}
              disabled={saving || !movReason || movLines.every(l => !l.stockItemId)}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : panel === 'receive' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
              {panel === 'receive' ? 'Confirm Receipt' : 'Confirm Dispatch'}
            </button>
            <button onClick={closePanel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </SlideOver>

      {/* Add Product Slide-over */}
      <SlideOver open={panel === 'add-product'} onClose={closePanel} title="Add Product">
        <div className="space-y-4">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <button onClick={() => setBulkMode(false)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${!bulkMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Single
            </button>
            <button onClick={() => setBulkMode(true)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${bulkMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Bulk Import
            </button>
          </div>
          {!bulkMode ? (
            <>
              <div>
                <label className="form-label">Product Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. PowerPack Slim 2" className="form-input" autoFocus
                  onKeyDown={e => e.key === 'Enter' && addProduct()} />
              </div>
              <div>
                <label className="form-label">SKU <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="text" value={newSku} onChange={e => setNewSku(e.target.value)}
                  placeholder="e.g. PPS2-BLK" className="form-input" />
              </div>
              <div>
                <label className="form-label">Low Stock Alert Threshold</label>
                <input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}
                  min={1} className="form-input w-24" />
                <p className="text-xs text-slate-400 mt-1">Warn when quantity drops to or below this number</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={addProduct} disabled={saving || !newName.trim()} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Product
                </button>
                <button onClick={closePanel} className="btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="form-label">Paste your product list</label>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={`One product per line. Optionally add SKU after a comma:\n\nPowerPack Slim 2, PPS2-BLK\nPowerPack Universal 2, PPU2-BLK`}
                  rows={10}
                  className="form-input resize-none text-sm font-mono"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">Format: <span className="font-mono">Product Name, SKU</span> — SKU is optional</p>
              </div>
              <div>
                <label className="form-label">Default Low Stock Threshold</label>
                <input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}
                  min={1} className="form-input w-24" />
                <p className="text-xs text-slate-400 mt-1">Applied to all imported products</p>
              </div>
              {bulkResult && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle size={14} /> {bulkResult}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={bulkAddProducts} disabled={saving || !bulkText.trim()} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  Import Products
                </button>
                <button onClick={closePanel} className="btn-secondary">Cancel</button>
              </div>
            </>
          )}
        </div>
      </SlideOver>

    </div>
  );
}
