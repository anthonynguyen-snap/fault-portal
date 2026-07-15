'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Loader2, Bell, CreditCard, RotateCcw, Tag, AlertTriangle, Menu } from 'lucide-react';
import { useSidebar } from './SidebarContext';

// ── Breadcrumb label map ──────────────────────────────────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  '/':               'Home',
  '/cases':          'All Cases',
  '/cases/new':      'Submit Fault',
  '/claims':         'Claims',
  '/returns':        'Returns',
  '/returns/request/new': 'Log Return Request',
  '/returns/new':    'Process Office Return',
  '/refunds':        'Refunds',
  '/refunds/new':    'Request Refund',
  '/orders':         'Order Lookup',
  '/stock':          'Stock Room',
  '/replenishment':  'Replenishment',
  '/promotions':     'Promotions',
  '/corporate':      'Corporate Orders',
  '/roster':         'Roster',
  '/roster/leave':   'Leave Log',
  '/performance':    'Team Performance',
  '/reports':        'Reports',
  '/admin':          'Admin',
  '/log':            'Activity Log',
  '/sop':            'CC&E SOP',
  '/account/password': 'Change Password',
};

function useBreadcrumb() {
  const pathname = usePathname();
  if (!pathname || pathname === '/') return null;

  // Detail pages — e.g. /cases/abc123
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && !['new', 'leave'].includes(parts[1])) {
    const section = '/' + parts[0];
    const sectionLabel = ROUTE_LABELS[section] ?? parts[0];
    const isDetailPage = !ROUTE_LABELS[pathname];
    if (isDetailPage) return { section: sectionLabel, sectionHref: section, current: 'Detail' };
  }

  const label = ROUTE_LABELS[pathname];
  if (!label) return null;

  // Multi-level: /roster/leave → Team › Leave Log
  if (pathname.startsWith('/roster/')) {
    return { section: 'Team', sectionHref: '/roster', current: label };
  }
  if (pathname.startsWith('/corporate/')) {
    return { section: 'Corporate', sectionHref: '/corporate', current: label };
  }
  if (pathname.startsWith('/cases/')) {
    return { section: 'All Cases', sectionHref: '/cases', current: label };
  }
  return { section: null, sectionHref: null, current: label };
}

// ── Notification types ────────────────────────────────────────────────────────
interface PortalNotification {
  id: string;
  type: 'refund' | 'return' | 'promo';
  severity: 'red' | 'amber' | 'info';
  title: string;
  subtitle: string;
  href: string;
}

const NOTIF_ICON: Record<string, React.ElementType> = {
  refund: CreditCard,
  return: RotateCcw,
  promo:  Tag,
};

const NOTIF_COLOR: Record<string, string> = {
  red:   'bg-red-100 text-red-600',
  amber: 'bg-amber-100 text-amber-600',
  info:  'bg-slate-100 text-slate-500',
};

const NOTIF_DOT: Record<string, string> = {
  red:   'bg-red-500',
  amber: 'bg-amber-400',
  info:  'bg-slate-400',
};

function NotificationBell() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(err => console.warn('[Header notifications]', err));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const redCount   = notifications.filter(n => n.severity === 'red').length;
  const totalCount = notifications.length;
  const badgeCount = totalCount;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {badgeCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 ${redCount > 0 ? 'bg-red-500' : 'bg-amber-400'}`}>
            {badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-[var(--shadow-popover)] overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#f7f8fa]">
            <div className="flex items-center gap-1.5">
              <Bell size={13} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Notifications</span>
            </div>
            {totalCount > 0 && (
              <span className="text-[10px] font-medium text-slate-400">{totalCount} active</span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={20} className="text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
              {notifications.map(n => {
                const Icon = NOTIF_ICON[n.type] ?? AlertTriangle;
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${NOTIF_COLOR[n.severity]}`}>
                      <Icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${NOTIF_DOT[n.severity]}`} />
                        <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                      </div>
                      <p className="text-xs text-slate-400 leading-snug">{n.subtitle}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchResult {
  type: 'case' | 'refund' | 'return';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface RecentOrder {
  orderNumber: string;
  customerName: string;
  total: number;
  viewedAt: string;
}

interface CommandItem {
  kind: 'action' | 'page' | 'result' | 'recent';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  resultType?: SearchResult['type'];
  shortcut?: string;
}

interface GroupedResults {
  cases: SearchResult[];
  refunds: SearchResult[];
  returns: SearchResult[];
}

const groupResults = (results: SearchResult[]): GroupedResults => {
  return {
    cases: results.filter(r => r.type === 'case'),
    refunds: results.filter(r => r.type === 'refund'),
    returns: results.filter(r => r.type === 'return'),
  };
};

const getBadgeColor = (type: 'case' | 'refund' | 'return'): string => {
  switch (type) {
    case 'case':
      return 'bg-blue-100 text-blue-700';
    case 'refund':
      return 'bg-amber-100 text-amber-700';
    case 'return':
      return 'bg-purple-100 text-purple-700';
  }
};

const getTypeLabel = (type: 'case' | 'refund' | 'return'): string => {
  switch (type) {
    case 'case':
      return 'Cases';
    case 'refund':
      return 'Refunds';
    case 'return':
      return 'Returns';
  }
};

const QUICK_ACTIONS: CommandItem[] = [
  { kind: 'action', id: 'fault-case', title: 'Submit Fault Case', subtitle: 'Create a product fault case', href: '/cases/new', shortcut: 'F' },
  { kind: 'action', id: 'return-request', title: 'Log Return Request', subtitle: 'Customer has asked to send something back', href: '/returns/request/new', shortcut: 'R' },
  { kind: 'action', id: 'refund-request', title: 'Request Refund', subtitle: 'Raise a refund for approval', href: '/refunds/new', shortcut: 'P' },
  { kind: 'action', id: 'process-return', title: 'Process Office Return', subtitle: 'Inspect a received parcel and close the return', href: '/returns/new' },
  { kind: 'action', id: 'order-lookup', title: 'Lookup Order', subtitle: 'Search cases, returns, and refunds for an order', href: '/orders' },
];

const PAGE_COMMANDS: CommandItem[] = [
  { kind: 'page', id: 'home', title: 'Dashboard', subtitle: 'Portal overview and daily priorities', href: '/' },
  { kind: 'page', id: 'cases', title: 'Cases', subtitle: 'Fault cases and warranty evidence', href: '/cases' },
  { kind: 'page', id: 'returns', title: 'Returns', subtitle: 'Return requests and office processing', href: '/returns' },
  { kind: 'page', id: 'refunds', title: 'Refunds', subtitle: 'Refund requests and approvals', href: '/refunds' },
  { kind: 'page', id: 'orders', title: 'Order Lookup', subtitle: 'Unified order timeline', href: '/orders' },
  { kind: 'page', id: 'stock', title: 'Stock Room', subtitle: 'Office inventory and movements', href: '/stock' },
  { kind: 'page', id: 'replenishment', title: 'Replenishment', subtitle: 'Store replenishment orders', href: '/replenishment' },
  { kind: 'page', id: 'roster', title: 'Roster', subtitle: 'Team schedule and coverage', href: '/roster' },
  { kind: 'page', id: 'performance', title: 'Team Performance', subtitle: 'Commslayer performance reporting', href: '/performance' },
  { kind: 'page', id: 'sop', title: 'SOP', subtitle: 'Customer care procedures', href: '/sop' },
  { kind: 'page', id: 'admin', title: 'Admin', subtitle: 'Staff, settings, products, changelog', href: '/admin' },
];

function matchesCommand(item: CommandItem, q: string) {
  if (!q) return true;
  if (item.shortcut?.toLowerCase() === q) return true;
  const haystack = `${item.title} ${item.subtitle} ${item.href}`.toLowerCase();
  return haystack.includes(q);
}

function resultToCommand(result: SearchResult): CommandItem {
  return {
    kind: 'result',
    id: `${result.type}-${result.id}`,
    title: result.title,
    subtitle: `${getTypeLabel(result.type)} · ${result.subtitle}`,
    href: result.href,
    resultType: result.type,
  };
}

function recentOrderToCommand(order: RecentOrder): CommandItem {
  return {
    kind: 'recent',
    id: `recent-${order.orderNumber}`,
    title: order.orderNumber,
    subtitle: `${order.customerName || 'Recent order'} · ${order.total} portal record${order.total === 1 ? '' : 's'}`,
    href: `/orders?order=${encodeURIComponent(order.orderNumber)}`,
  };
}

export default function Header() {
  const router = useRouter();
  const { toggle } = useSidebar();
  const breadcrumb = useBreadcrumb();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // ⌘K / Ctrl+K global shortcut to focus search
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowDropdown(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    function loadRecentOrders() {
      try {
        const parsed = JSON.parse(localStorage.getItem('portal_recent_orders') || '[]');
        setRecentOrders(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
      } catch {
        setRecentOrders([]);
      }
    }

    loadRecentOrders();
    window.addEventListener('storage', loadRecentOrders);
    window.addEventListener('portal:recent-orders-updated', loadRecentOrders);
    return () => {
      window.removeEventListener('storage', loadRecentOrders);
      window.removeEventListener('portal:recent-orders-updated', loadRecentOrders);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  // Close dropdown on escape or outside click
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  const grouped = groupResults(results);
  const q = query.trim().toLowerCase();
  const actionCommands = QUICK_ACTIONS
    .filter(item => matchesCommand(item, q))
    .sort((a, b) => Number(b.shortcut?.toLowerCase() === q) - Number(a.shortcut?.toLowerCase() === q))
    .slice(0, query ? 5 : 4);
  const recentCommands = recentOrders.map(recentOrderToCommand).filter(item => matchesCommand(item, q)).slice(0, query ? 5 : 3);
  const pageCommands = PAGE_COMMANDS.filter(item => matchesCommand(item, q)).slice(0, query ? 6 : 5);
  const resultCommands = results.map(resultToCommand);
  const hasResults = actionCommands.length > 0 || recentCommands.length > 0 || pageCommands.length > 0 || resultCommands.length > 0;

  // Flat ordered list for keyboard navigation: actions → recents → pages → record results
  const flatResults = useMemo(
    () => [...actionCommands, ...recentCommands, ...pageCommands, ...resultCommands],
    [actionCommands, recentCommands, pageCommands, resultCommands]
  );

  // Reset focused index whenever results change
  useEffect(() => { setFocusedIndex(-1); }, [flatResults]);

  const handleResultClick = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setFocusedIndex(-1);
  };

  function navigateTo(item: CommandItem) {
    router.push(item.href);
    handleResultClick();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const quickAction = QUICK_ACTIONS.find(item => item.shortcut?.toLowerCase() === e.key.toLowerCase());
    if (showDropdown && !query.trim() && quickAction && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      navigateTo(quickAction);
      return;
    }

    if (!showDropdown || !hasResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const selected = flatResults[focusedIndex];
      if (selected) navigateTo(selected);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex items-center px-3 sm:px-4 py-2.5 min-h-[56px] gap-3">
        {/* Hamburger — only on small screens */}
        <button
          onClick={toggle}
          className="lg:hidden flex-shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Search Input */}
        <div ref={searchRef} className="flex-1 min-w-0 max-w-xl">
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search or run a command…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-16 py-2.5 text-sm bg-[#f7f8fa] border border-slate-200 rounded-lg shadow-[0_1px_0_rgba(0,0,0,0.03)] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-brand-600 focus:shadow-[var(--focus-ring)] transition-colors"
                autoComplete="off"
              />
              {!query && !isLoading && (
                <kbd className="absolute right-3 text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono pointer-events-none select-none hidden sm:block">
                  ⌘K
                </kbd>
              )}
              {isLoading && (
                <Loader2 className="absolute right-3 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Dropdown Results */}
            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-[34rem] max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-lg shadow-[var(--shadow-popover)] overflow-hidden">
                {hasResults ? (
                  <div className="max-h-[420px] overflow-y-auto">
                    {[
                      { label: 'Quick Actions', items: actionCommands, offset: 0 },
                      { label: 'Recent Orders', items: recentCommands, offset: actionCommands.length },
                      { label: 'Pages', items: pageCommands, offset: actionCommands.length + recentCommands.length },
                      { label: 'Records', items: resultCommands, offset: actionCommands.length + recentCommands.length + pageCommands.length },
                    ].filter(group => group.items.length > 0).map(group => (
                      <div key={group.label} className="border-b border-slate-100 last:border-b-0">
                        <div className="px-3 py-2 bg-[#f7f8fa] text-[11px] font-bold uppercase tracking-normal text-slate-500">{group.label}</div>
                        {group.items.map((item, i) => {
                          const globalIdx = group.offset + i;
                          const isFocused = globalIdx === focusedIndex;
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              onClick={handleResultClick}
                              className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${isFocused ? 'bg-brand-50 shadow-[inset_2px_0_0_var(--brand-600)]' : 'hover:bg-slate-50'}`}
                            >
                              <span className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                                item.kind === 'action'
                                  ? 'bg-brand-100 text-brand-700'
                                  : item.kind === 'page' || item.kind === 'recent'
                                    ? 'bg-slate-100 text-slate-600'
                                    : getBadgeColor(item.resultType ?? 'case')
                              }`}>
                                {item.kind === 'action' ? 'Action' : item.kind === 'page' ? 'Page' : item.kind === 'recent' ? 'Recent' : getTypeLabel(item.resultType ?? 'case')}
                              </span>
                              <div className="min-w-0">
                                <div className="font-medium text-sm text-slate-900 truncate">{item.title}</div>
                                <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                              </div>
                              {item.kind === 'action' && item.shortcut && (
                                <kbd className="ml-auto mt-0.5 text-[10px] leading-none text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 font-mono flex-shrink-0">
                                  ⌘K, {item.shortcut}
                                </kbd>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-slate-400 italic">
                    {query.length < 2 ? 'Start typing to search records, or choose a quick action.' : `No results for "${query}"`}
                  </div>
                )}
                {hasResults && (
                  <div className="px-3 py-2 border-t border-slate-100 bg-[#f7f8fa] flex items-center gap-2 text-[10px] text-slate-400">
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↑↓</kbd> navigate
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↵</kbd> open
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Esc</kbd> close
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Breadcrumb — fills remaining space */}
        <div className="hidden md:flex flex-1 items-center gap-1.5 min-w-0 ml-1">
          {breadcrumb && (
            <>
              {breadcrumb.section && breadcrumb.sectionHref ? (
                <>
                  <Link href={breadcrumb.sectionHref} className="text-sm text-slate-500 hover:text-slate-700 transition-colors truncate">
                    {breadcrumb.section}
                  </Link>
                  <span className="text-slate-300 text-xs flex-shrink-0">›</span>
                </>
              ) : null}
              <span className="text-sm font-semibold text-slate-800 truncate">{breadcrumb.current}</span>
            </>
          )}
        </div>

        <NotificationBell />
      </div>
    </header>
  );
}
