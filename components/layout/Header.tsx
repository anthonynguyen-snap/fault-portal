'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Bell, CreditCard, RotateCcw, Tag, AlertTriangle } from 'lucide-react';

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
      .catch(() => {});
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
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
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
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${NOTIF_COLOR[n.severity]}`}>
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

export default function Header() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!query || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
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
  const hasResults = Object.values(grouped).some(arr => arr.length > 0);

  // Flat ordered list for keyboard navigation: cases → refunds → returns
  const flatResults = useMemo(
    () => [...grouped.cases, ...grouped.refunds, ...grouped.returns],
    [grouped.cases, grouped.refunds, grouped.returns]
  );

  // Reset focused index whenever results change
  useEffect(() => { setFocusedIndex(-1); }, [flatResults]);

  const handleResultClick = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setFocusedIndex(-1);
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
      if (selected) {
        router.push(selected.href);
        handleResultClick();
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3 h-[52px]">
        {/* Search Input */}
        <div ref={searchRef} className="w-full max-w-md">
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search cases, refunds, returns..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => query.length >= 2 && setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="off"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Dropdown Results */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {hasResults ? (
                  <div className="max-h-[420px] overflow-y-auto">
                    {(
                      [
                        { label: 'Cases',   type: 'case'   as const, items: grouped.cases,   offset: 0 },
                        { label: 'Refunds', type: 'refund' as const, items: grouped.refunds, offset: grouped.cases.length },
                        { label: 'Returns', type: 'return' as const, items: grouped.returns, offset: grouped.cases.length + grouped.refunds.length },
                      ]
                    ).filter(g => g.items.length > 0).map(({ label, type, items, offset }) => (
                      <div key={type} className="border-b border-slate-100 last:border-b-0">
                        <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getBadgeColor(type)}`}>
                            {label}
                          </span>
                        </div>
                        {items.map((result, i) => {
                          const globalIdx = offset + i;
                          const isFocused = globalIdx === focusedIndex;
                          return (
                            <Link
                              key={`${result.type}-${result.id}`}
                              href={result.href}
                              onClick={handleResultClick}
                              className={`block px-3 py-2 transition-colors ${isFocused ? 'bg-brand-50 border-l-2 border-brand-500' : 'hover:bg-slate-50'}`}
                            >
                              <div className="font-medium text-sm text-slate-900">{result.title}</div>
                              <div className="text-xs text-slate-400">{result.subtitle}</div>
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-slate-400 italic">
                    {query.length < 2 ? 'Type at least 2 characters…' : `No results for "${query}"`}
                  </div>
                )}
                {hasResults && (
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center gap-2 text-[10px] text-slate-400">
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↑↓</kbd> navigate
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↵</kbd> open
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Esc</kbd> close
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side: notification bell */}
        <div className="flex-1" />
        <NotificationBell />
      </div>
    </header>
  );
}
