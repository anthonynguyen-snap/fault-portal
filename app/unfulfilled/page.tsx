'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardPaste,
  Clock3,
  Mail,
  MessageSquareText,
  PackageX,
  Search,
  Send,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { UnfulfilledOrder, UnfulfilledOutcome } from '@/types';

const OUTCOMES: UnfulfilledOutcome[] = [
  'Waiting for stock',
  'Split fulfilment',
  'Cancelled',
  'Colour swap',
  'Alternative product',
  'Other',
];

type ViewFilter = 'active' | 'needs-contact' | 'follow-up' | 'contacted' | 'resolved';
type TeamMember = { id: string; name: string; colour?: string };

const DEFAULT_BACKORDER_PRODUCT = 'PowerBase 4';

function localDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normaliseProductVariant(value: string, defaultProduct: string): string {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  const product = defaultProduct.trim().replace(/\s+/g, ' ');
  if (!cleaned) return product;
  if (!product) return cleaned;
  if (cleaned.toLowerCase().startsWith(product.toLowerCase())) return cleaned;
  return `${product} — ${cleaned}`;
}

function displayProductVariant(value: string): string {
  return normaliseProductVariant(value, DEFAULT_BACKORDER_PRODUCT);
}

function commslayerComposeHref(order: UnfulfilledOrder): string {
  const params = new URLSearchParams({
    email: order.customerEmail,
    name: order.customerName,
    order: order.orderNumber,
    product: displayProductVariant(order.productVariant),
  });
  return `/api/commslayer/compose?${params.toString()}`;
}

function backorderEmailDraft(order: UnfulfilledOrder): string {
  const subject = `Backorder update for ${order.orderNumber}`;
  const body = [
    order.customerName ? `Hi ${order.customerName},` : 'Hi,',
    '',
    `We’re getting in touch with an update on your backorder${order.productVariant ? ` for ${displayProductVariant(order.productVariant)}` : ''}.`,
    '',
    'Thanks for your patience — we’ll keep you posted as soon as there is movement on fulfilment.',
    '',
    'Kind regards,',
    'SnapWireless',
  ].join('\n');
  return [
    `To: ${order.customerEmail}`,
    `Subject: ${subject}`,
    '',
    body,
  ].join('\n');
}

function parsePastedRows(text: string, defaultProduct: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const dataLines = lines[0]?.toLowerCase().includes('order') ? lines.slice(1) : lines;
  return dataLines.map((line, index) => {
    const cells = line.split('\t').map(cell => cell.trim());
    if (cells.length < 3) throw new Error(`Row ${index + 1} needs at least 3 columns.`);
    const productVariant = cells.length >= 5
      ? normaliseProductVariant(`${cells[3]} — ${cells.slice(4).join(' ')}`, '')
      : normaliseProductVariant(cells.slice(3).join(' '), defaultProduct);
    return {
      orderNumber: cells[0],
      customerName: cells[1],
      customerEmail: cells[2],
      productVariant,
    };
  });
}

function responseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message?: unknown }).message ?? fallback);
    }
  }
  return fallback;
}

export default function UnfulfilledOrdersPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  const [orders, setOrders] = useState<UnfulfilledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewFilter>('active');
  const [importOpen, setImportOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [defaultProduct, setDefaultProduct] = useState(DEFAULT_BACKORDER_PRODUCT);
  const [importing, setImporting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => { toastRef.current = toast; }, [toast]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/unfulfilled-orders', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, 'Unable to load orders'));
      setOrders(payload.orders ?? []);
      setLastSyncedAt(new Date());
    } catch (error) {
      toastRef.current.error('Could not load unfulfilled orders', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/roster/agents', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, 'Unable to load team'));
      setTeamMembers((payload.data ?? []).map((member: Record<string, unknown>) => ({
        id: String(member.id ?? member.name ?? ''),
        name: String(member.name ?? ''),
        colour: member.colour ? String(member.colour) : undefined,
      })).filter((member: TeamMember) => member.id && member.name));
    } catch (error) {
      toastRef.current.error('Could not load team', error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadOrders();
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadOrders]);

  async function patchOrder(id: string, patch: Record<string, unknown>) {
    setUpdatingIds(previous => new Set(previous).add(id));
    try {
      const response = await fetch('/api/unfulfilled-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, 'Update failed'));
      setOrders(previous => previous.map(order => order.id === id ? payload.order : order));
      setLastSyncedAt(new Date());
      return payload.order as UnfulfilledOrder;
    } catch (error) {
      toast.error('Update failed', error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setUpdatingIds(previous => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }

  async function importOrders(event: FormEvent) {
    event.preventDefault();
    setImporting(true);
    try {
      const parsed = parsePastedRows(pasteText, defaultProduct);
      if (parsed.length === 0) throw new Error('Paste at least one row from Excel.');
      const response = await fetch('/api/unfulfilled-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: parsed }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, 'Import failed'));
      await loadOrders();
      setPasteText('');
      setImportOpen(false);
      toast.success(`${payload.imported} order${payload.imported === 1 ? '' : 's'} imported`);
    } catch (error) {
      toast.error('Import failed', error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  const selectedOrder = orders.find(order => order.id === selectedId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const activeOrders = useMemo(() => orders.filter(order => !order.resolvedAt), [orders]);
  const assignees = useMemo(() => Array.from(new Set(orders.map(order => order.assignedTo).filter(Boolean))).sort(), [orders]);

  const counts = useMemo(() => ({
    active: orders.filter(order => !order.resolvedAt).length,
    needsContact: orders.filter(order => !order.resolvedAt && !order.contactedAt).length,
    followUp: orders.filter(order => !order.resolvedAt && order.followUpRequired).length,
    contacted: orders.filter(order => !order.resolvedAt && order.contactedAt).length,
    resolved: orders.filter(order => Boolean(order.resolvedAt)).length,
  }), [orders]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter(order => {
      const matchesView =
        (view === 'active' && !order.resolvedAt) ||
        (view === 'needs-contact' && !order.resolvedAt && !order.contactedAt) ||
        (view === 'follow-up' && !order.resolvedAt && order.followUpRequired) ||
        (view === 'contacted' && !order.resolvedAt && Boolean(order.contactedAt)) ||
        (view === 'resolved' && Boolean(order.resolvedAt));
      if (!matchesView) return false;
      if (assigneeFilter === 'unassigned' && order.assignedTo) return false;
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && order.assignedTo !== assigneeFilter) return false;
      if (!query) return true;
      return [order.orderNumber, order.customerName, order.customerEmail, order.productVariant, order.assignedTo]
        .some(value => value.toLowerCase().includes(query));
    });
  }, [orders, search, view, assigneeFilter]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrder || !noteText.trim()) return;
    setSavingNote(true);
    const updated = await patchOrder(selectedOrder.id, { addNote: noteText.trim() });
    if (updated) {
      setNoteText('');
      toast.success('Note added');
    }
    setSavingNote(false);
  }

  async function openCustomerEmail(order: UnfulfilledOrder) {
    try {
      await navigator.clipboard.writeText(backorderEmailDraft(order));
      toast.success('Email draft copied', 'Commslayer is opening now — paste the draft into the new email.');
    } catch {
      toast.info('Opening Commslayer', 'Copy was blocked by the browser, but the customer details are still on this row.');
    }
    window.open(commslayerComposeHref(order), '_blank', 'noopener,noreferrer');
  }

  async function openAssignTeam() {
    setAssignOpen(true);
    if (teamMembers.length === 0) await loadTeamMembers();
  }

  function toggleTeamMember(name: string) {
    setSelectedTeam(previous => (
      previous.includes(name)
        ? previous.filter(member => member !== name)
        : [...previous, name]
    ));
  }

  async function assignTeam(event: FormEvent) {
    event.preventDefault();
    if (selectedTeam.length === 0) {
      toast.warning('Choose at least one person');
      return;
    }

    const assignable = activeOrders
      .slice()
      .sort((a, b) => displayProductVariant(a.productVariant).localeCompare(displayProductVariant(b.productVariant)) || a.orderNumber.localeCompare(b.orderNumber));

    if (assignable.length === 0) {
      toast.info('No active orders to assign');
      return;
    }

    setAssigning(true);
    try {
      await Promise.all(assignable.map((order, index) => {
        const assignedTo = selectedTeam[index % selectedTeam.length];
        return patchOrder(order.id, { assignedTo });
      }));
      await loadOrders();
      setAssignOpen(false);
      toast.success('Team assigned', `${assignable.length} active order${assignable.length === 1 ? '' : 's'} split across ${selectedTeam.length} people.`);
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1500px] mx-auto space-y-5">
        <h1 className="text-xl font-bold text-slate-900">Unfulfilled Orders</h1>
        <TableSkeleton rows={8} cols={8} />
      </div>
    );
  }

  const filterCards: Array<{ key: ViewFilter; label: string; count: number; icon: typeof PackageX; tone: string }> = [
    { key: 'active', label: 'Active', count: counts.active, icon: PackageX, tone: 'text-slate-700 bg-slate-100' },
    { key: 'needs-contact', label: 'Needs contact', count: counts.needsContact, icon: Mail, tone: 'text-red-700 bg-red-100' },
    { key: 'follow-up', label: 'Follow-up', count: counts.followUp, icon: Clock3, tone: 'text-amber-700 bg-amber-100' },
    { key: 'contacted', label: 'Contacted', count: counts.contacted, icon: UserRoundCheck, tone: 'text-blue-700 bg-blue-100' },
    { key: 'resolved', label: 'Resolved', count: counts.resolved, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-100' },
  ];

  return (
    <div className="max-w-[1500px] mx-auto space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PackageX size={20} className="text-slate-400" />
            Unfulfilled Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Keep customer contact, follow-ups, outcomes and notes together.
            {lastSyncedAt && (
              <span className="ml-2 text-xs text-slate-400">
                Syncs every 15s · last checked {lastSyncedAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void openAssignTeam()} className="btn-secondary">
            <UsersRound size={15} /> Assign team
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className="btn-primary">
            <ClipboardPaste size={15} /> Paste from Excel
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3" aria-label="Order filters">
        {filterCards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setView(card.key)}
              className={cn(
                'card p-3 text-left transition-all hover:border-slate-300',
                view === card.key && 'ring-2 ring-brand-500 border-transparent',
              )}
            >
              <span className={cn('inline-flex p-1.5 rounded-lg mb-2', card.tone)}><Icon size={15} /></span>
              <span className="block text-2xl font-bold text-slate-900">{card.count}</span>
              <span className="text-xs text-slate-500">{card.label}</span>
            </button>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-lg">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search order, customer, email, product, colour or assignee…"
            className="form-input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAssigneeFilter('all')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border', assigneeFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}
          >
            Everyone
          </button>
          <button
            type="button"
            onClick={() => setAssigneeFilter('unassigned')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border', assigneeFilter === 'unassigned' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}
          >
            Unassigned
          </button>
          {assignees.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => setAssigneeFilter(name)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border', assigneeFilter === name ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200')}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={orders.length === 0 ? 'No orders imported yet' : 'Nothing in this view'}
          description={orders.length === 0
            ? 'Paste the four columns from your backorder spreadsheet to get started.'
            : 'Try another filter or clear your search.'}
          action={orders.length === 0 ? { label: 'Paste from Excel', onClick: () => setImportOpen(true) } : undefined}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Contacted</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product / variant</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Follow up</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const busy = updatingIds.has(order.id);
                const followUpDue = order.followUpRequired && (!order.followUpOn || order.followUpOn <= today);
                return (
                  <tr key={order.id} className={cn('border-b border-slate-100 last:border-0 align-top', busy && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(order.contactedAt)}
                          disabled={busy}
                          onChange={event => void patchOrder(order.id, { contacted: event.target.checked })}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-xs text-slate-500 leading-5">
                          {order.contactedAt ? <>{localDate(order.contactedAt)}<br />{order.contactedBy}</> : 'Not yet'}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{order.orderNumber}</td>
                    <td className="px-4 py-3 min-w-[240px]">
                      <p className="font-medium text-slate-700">{order.customerName}</p>
                      <button
                        type="button"
                        onClick={() => void openCustomerEmail(order)}
                        className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                        title="Copy draft and open Commslayer"
                      >
                        <Mail size={11} />
                        {order.customerEmail}
                      </button>
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      <p className="font-medium text-slate-700">{order.productVariant ? displayProductVariant(order.productVariant) : '—'}</p>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <select
                        value={order.assignedTo}
                        disabled={busy}
                        onChange={event => void patchOrder(order.id, { assignedTo: event.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="">Unassigned</option>
                        {assignees.concat(teamMembers.map(member => member.name))
                          .filter((name, index, names) => name && names.indexOf(name) === index)
                          .sort()
                          .map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 min-w-[175px]">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={order.followUpRequired}
                          disabled={busy}
                          onChange={event => void patchOrder(order.id, { followUpRequired: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className={cn('text-xs', followUpDue ? 'font-semibold text-amber-700' : 'text-slate-500')}>Required</span>
                      </label>
                      {order.followUpRequired && (
                        <input
                          type="date"
                          value={order.followUpOn ?? ''}
                          disabled={busy}
                          onChange={event => void patchOrder(order.id, { followUpOn: event.target.value })}
                          className="block mt-1.5 text-xs border border-slate-200 rounded px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">
                      <select
                        value={order.outcome}
                        disabled={busy}
                        onChange={event => void patchOrder(order.id, { outcome: event.target.value })}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        {OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(order.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 whitespace-nowrap"
                      >
                        <MessageSquareText size={14} />
                        {order.internalNotes.length || 'Add'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(order.resolvedAt)}
                          disabled={busy}
                          onChange={event => void patchOrder(order.id, { resolved: event.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-500">{order.resolvedAt ? localDate(order.resolvedAt) : 'Open'}</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <form onSubmit={importOrders} className="card w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="import-title" className="text-lg font-semibold text-slate-900">Paste orders from Excel</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Copy order number, name, email and variant. If the sheet only has a colour, we’ll add the product name below.
                </p>
              </div>
              <button type="button" onClick={() => setImportOpen(false)} className="btn-ghost p-1.5" aria-label="Close import"><X size={17} /></button>
            </div>
            <div>
              <label htmlFor="default-product" className="form-label">Product for this import</label>
              <input
                id="default-product"
                value={defaultProduct}
                onChange={event => setDefaultProduct(event.target.value)}
                placeholder="e.g. PowerBase 4m, PowerPack Universal 2"
                className="form-input"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use this for any backorder batch. If your pasted sheet already includes product names, this won’t double them up.
              </p>
            </div>
            <textarea
              value={pasteText}
              onChange={event => setPasteText(event.target.value)}
              rows={12}
              autoFocus
              placeholder={'Order Number\tName\tEmail\tVariant\nSNAPC-420561AU\tMorgan Shepherd\tmorgan@example.com\tMidnight Black'}
              className="form-input resize-y font-mono text-xs"
            />
            <p className="text-xs text-slate-500">Re-importing an existing order refreshes the customer details without clearing contact history or notes.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={importing || !pasteText.trim()} className="btn-primary">
                <ClipboardPaste size={15} /> {importing ? 'Importing…' : 'Import orders'}
              </button>
            </div>
          </form>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="assign-title">
          <form onSubmit={assignTeam} className="card w-full max-w-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="assign-title" className="text-lg font-semibold text-slate-900">Assign today’s team</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Pick who is working this backorder list today. Active orders will be split evenly across the selected names.
                </p>
              </div>
              <button type="button" onClick={() => setAssignOpen(false)} className="btn-ghost p-1.5" aria-label="Close assign team"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {teamMembers.map(member => {
                const selected = selectedTeam.includes(member.name);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleTeamMember(member.name)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm transition-all',
                      selected ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full mr-2"
                      style={{ backgroundColor: member.colour ?? '#64748b' }}
                    />
                    {member.name}
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {selectedTeam.length > 0
                ? `${activeOrders.length} active orders will be split across ${selectedTeam.join(', ')}.`
                : 'Choose the team members working this list today.'}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAssignOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={assigning || selectedTeam.length === 0} className="btn-primary">
                <UsersRound size={15} /> {assigning ? 'Assigning…' : 'Split and assign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/30" role="dialog" aria-modal="true" aria-labelledby="notes-title">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setSelectedId(null)} aria-label="Close notes" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 id="notes-title" className="font-semibold text-slate-900">{selectedOrder.orderNumber}</h2>
                <p className="text-sm text-slate-500">{selectedOrder.customerName} · {selectedOrder.productVariant ? displayProductVariant(selectedOrder.productVariant) : '—'}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="btn-ghost p-1.5" aria-label="Close notes"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedOrder.internalNotes.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No notes yet. Add what was agreed with the customer.</p>
              ) : selectedOrder.internalNotes.map(note => (
                <article key={note.id} className="bg-slate-50 rounded-lg px-3 py-2.5">
                  <div className="flex justify-between gap-3 text-xs mb-1.5">
                    <span className="font-semibold text-slate-700">{note.author}</span>
                    <time className="text-slate-400">{localDate(note.createdAt)}</time>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>
                </article>
              ))}
            </div>
            <form onSubmit={addNote} className="border-t border-slate-200 p-5">
              <label htmlFor="customer-note" className="form-label">Add note</label>
              <textarea
                id="customer-note"
                value={noteText}
                onChange={event => setNoteText(event.target.value)}
                rows={3}
                placeholder="e.g. Customer agreed to swap to Jade Green…"
                className="form-input resize-none"
              />
              <button type="submit" disabled={savingNote || !noteText.trim()} className="btn-primary mt-3 ml-auto">
                <Send size={14} /> {savingNote ? 'Saving…' : 'Add note'}
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
