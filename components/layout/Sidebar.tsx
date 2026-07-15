'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Home,
  AlertTriangle,
  FileText,
  BarChart2,
  Settings,
  RotateCcw,
  Briefcase,
  Package,
  CreditCard,
  PlusCircle,
  Tag,
  LogOut,
  Users2,
  ShoppingBag,
  Truck,
  CalendarDays,
  ClipboardList,
  Activity,
  BookOpen,
  X,
  PackageOpen,
  Ship,
  Eye,
  ChevronLeft,
  ChevronRight,
  PackageX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { CHANGELOG_SEEN_KEY, LATEST_VERSION } from '@/lib/changelog';

const COLLAPSED_KEY = 'sidebar-collapsed';

type AlertLevel = 'red' | 'amber' | null;

function ReturnAlertBadge({ collapsed }: { collapsed: boolean }) {
  const [level, setLevel] = useState<AlertLevel>(null);
  useEffect(() => {
    fetch('/api/returns/alerts')
      .then(r => r.json())
      .then(d => setLevel(d.level ?? null))
      .catch(err => console.warn('[ReturnAlertBadge]', err));
  }, []);
  if (!level) return null;
  if (collapsed) return (
    <span className={cn(
      'absolute top-1 right-1 w-2 h-2 rounded-full',
      level === 'red' ? 'bg-red-400' : 'bg-amber-400'
    )} />
  );
  return (
    <AlertTriangle
      size={12}
      className={level === 'red' ? 'text-red-400' : 'text-amber-400'}
    />
  );
}

function RefundAlertBadge({ collapsed }: { collapsed: boolean }) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    function check() {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/refunds/alerts')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(err => console.warn('[RefundAlertBadge]', err));
    }
    check();
    const interval = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!count) return null;
  if (collapsed) return (
    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
  );
  return (
    <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
      {count}
    </span>
  );
}

function ReplenishmentAlertBadge({ collapsed }: { collapsed: boolean }) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    function check() {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/replenishment/alerts')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(err => console.warn('[ReplenishmentAlertBadge]', err));
    }
    check();
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!count) return null;
  if (collapsed) return (
    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
  );
  return (
    <span className="text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
      {count}
    </span>
  );
}

function UnfulfilledAlertBadge({ collapsed }: { collapsed: boolean }) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    function check() {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/unfulfilled-orders/alerts')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(err => console.warn('[UnfulfilledAlertBadge]', err));
    }
    check();
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!count) return null;
  if (collapsed) return (
    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
  );
  return (
    <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
      {count}
    </span>
  );
}

function ChangelogNewBadge({ collapsed }: { collapsed: boolean }) {
  const [show, setShow] = useState(false);

  function check() {
    try {
      const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
      setShow(seen !== LATEST_VERSION);
    } catch { /* no-op */ }
  }

  useEffect(() => {
    check();
    window.addEventListener('changelog-seen', check);
    return () => window.removeEventListener('changelog-seen', check);
  }, []);

  if (!show) return null;
  if (collapsed) return (
    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
  );
  return (
    <span className="text-[9px] font-bold bg-brand-500 text-white px-1.5 py-0.5 rounded-full leading-none">
      New
    </span>
  );
}

// Fixed-position tooltip rendered at root level to escape overflow clipping
function SidebarTooltip({ label, y }: { label: string; y: number }) {
  return (
    <div
      className="fixed z-[200] pointer-events-none"
      style={{ top: y, left: 64, transform: 'translateY(-50%)' }}
    >
      <span className="whitespace-nowrap rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg">
        {label}
      </span>
    </div>
  );
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  isAction?: boolean;
  shortcut?: string;
};

type NavGroup = {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
};

const quickActions: NavItem[] = [
  { label: 'Submit Fault',    href: '/cases/new',            icon: PlusCircle, shortcut: '⌘K, F', isAction: true },
  { label: 'Return Request',  href: '/returns/request/new',  icon: RotateCcw,  shortcut: '⌘K, R', isAction: true },
  { label: 'Request Refund',  href: '/refunds/new',          icon: CreditCard, shortcut: '⌘K, P', isAction: true },
];

const navGroups: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { label: 'All Cases',    href: '/cases',     icon: AlertTriangle },
      { label: 'Claims',       href: '/claims',    icon: FileText,    adminOnly: true },
      { label: 'Returns',      href: '/returns',   icon: RotateCcw },
      { label: 'Refunds',      href: '/refunds',   icon: CreditCard },
      { label: 'Order Lookup', href: '/orders',    icon: ShoppingBag },
      { label: 'Unfulfilled Orders', href: '/unfulfilled', icon: PackageX },
      { label: 'Corporate',    href: '/corporate', icon: Briefcase,   adminOnly: true },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Stock Room',         href: '/stock',          icon: Package,     adminOnly: true },
      { label: 'Incoming Shipments', href: '/shipments',      icon: Ship },
      { label: 'Restock Tracker',    href: '/stock/restock',  icon: PackageOpen },
      { label: 'Replenishment',      href: '/replenishment',  icon: Truck,       adminOnly: true },
      { label: 'Promotions',         href: '/promotions',     icon: Tag },
    ],
  },
  {
    label: 'Team',
    items: [
      { label: 'Roster',      href: '/roster',       icon: CalendarDays },
      { label: 'Leave Log',   href: '/roster/leave', icon: ClipboardList },
      { label: 'Performance', href: '/performance',  icon: Users2 },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Admin',        href: '/admin',   icon: Settings,  adminOnly: true },
      { label: 'Reports',      href: '/reports', icon: BarChart2, adminOnly: true },
      { label: 'Activity Log', href: '/log',     icon: Activity },
      { label: 'CC&E SOP',     href: '/sop',     icon: BookOpen },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const { user, effectiveRole, viewingAsTeam, setViewingAsTeam, loading, logout } = useAuth();
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'management';
  const isManagement = effectiveRole === 'management';
  const canSeeManagementPages = isAdmin || isManagement;
  const canPreviewTeam = user?.role === 'admin' || user?.role === 'management';

  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null);

  // Load persisted state
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch { /* no-op */ }
  }, []);

  function showTooltip(e: React.MouseEvent<HTMLElement>, label: string) {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ label, y: rect.top + rect.height / 2 });
  }
  function hideTooltip() { setTooltip(null); }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { /* no-op */ }
  }

  useEffect(() => { close(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    if (href.includes('?')) return false;
    if (href === '/cases') return pathname === '/cases' || (pathname.startsWith('/cases/') && !pathname.startsWith('/cases/new'));
    if (href === '/cases/new') return pathname === '/cases/new';
    return pathname.startsWith(href);
  }

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CC';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={close} aria-hidden="true" />
      )}

      <aside className={cn(
        'bg-[#111827] border-r border-slate-950/80 flex flex-col flex-shrink-0 h-full z-50 shadow-[1px_0_0_rgba(255,255,255,0.03)_inset]',
        'transition-[width] duration-200 ease-in-out',
        'lg:relative lg:translate-x-0',
        'fixed inset-y-0 left-0',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        collapsed ? 'w-14 overflow-visible' : 'w-60 overflow-hidden',
      )}>

        {/* Logo */}
        <div className={cn(
          'border-b border-slate-800/80 flex items-center flex-shrink-0',
          collapsed ? 'px-0 py-3.5 justify-center' : 'px-4 py-4 gap-2.5',
        )}>
          {collapsed ? (
            <Link href="/" className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center shadow-sm" title="SNAP Customer Care">
              <Image src="/snap-logo.jpg" alt="SNAP Logo" width={28} height={28} className="object-contain w-full h-full" />
            </Link>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
                  <Image src="/snap-logo.jpg" alt="SNAP Logo" width={28} height={28} className="object-contain w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm leading-tight truncate">SNAP Customer Care</p>
                  <p className="text-slate-400 text-[10px] font-medium">Operations portal</p>
                </div>
              </Link>
              <button
                onClick={close}
                className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 flex-shrink-0"
                aria-label="Close menu"
              >
                <X size={15} />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 py-3 overflow-y-auto', collapsed ? 'px-1.5 overflow-x-visible' : 'px-3 overflow-x-hidden')}>

          {/* Home */}
          <div className="mb-2">
            <Link
              href="/"
              onMouseEnter={e => showTooltip(e, 'Home')}
              onMouseLeave={hideTooltip}
              className={cn(
                'flex items-center rounded-lg text-sm transition-all',
                collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
                isActive('/')
                  ? 'nav-active-home text-white font-semibold'
                  : 'font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white'
              )}
            >
              <Home size={15} className={cn('flex-shrink-0', isActive('/') ? 'text-brand-300' : '')} />
              {!collapsed && <span className="flex-1">Home</span>}
            </Link>
          </div>

          {/* Quick Actions */}
          {collapsed ? (
            <div className="mb-3 space-y-0.5">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={e => showTooltip(e, item.label)}
                    onMouseLeave={hideTooltip}
                    className="flex justify-center items-center py-2 rounded-lg transition-all text-brand-300 hover:bg-white/10 hover:text-brand-100"
                  >
                    <div className="w-6 h-6 rounded-lg bg-brand-900/80 border border-brand-700/40 flex items-center justify-center">
                      <Icon size={12} className="text-brand-300" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-slate-700/70 bg-slate-900/45 p-1.5 space-y-0.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
              <p className="px-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Quick actions</p>
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-semibold transition-all text-brand-200 hover:bg-white/10 hover:text-white"
                  >
                    <div className="w-6 h-6 rounded-lg bg-brand-900/80 border border-brand-700/40 flex items-center justify-center flex-shrink-0">
                      <Icon size={12} className="text-brand-300" />
                    </div>
                    <span className="flex-1 truncate text-xs">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="text-[9px] leading-none text-slate-400 bg-slate-950/70 border border-slate-700 rounded px-1.5 py-1 font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Groups */}
          <div className={cn('space-y-4', collapsed && 'space-y-2')}>
            {navGroups.map((group) => {
              if (group.adminOnly && !canSeeManagementPages) return null;
              const visibleItems = group.items.filter(item =>
                !item.adminOnly || isAdmin
              );
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.label}>
                  {!collapsed && (
                    <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      {group.label}
                    </p>
                  )}
                  {collapsed && <div className="mx-1 mb-1 border-t border-slate-800/90" />}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      return (
                        <div key={item.href} className="relative">
                          <Link
                            href={item.href}
                            onMouseEnter={e => showTooltip(e, item.label)}
                            onMouseLeave={hideTooltip}
                            className={cn(
                              'flex items-center rounded-lg text-sm transition-all',
                              collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
                              active
                                ? 'nav-active text-white font-semibold'
                                : 'font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white'
                            )}
                          >
                            <Icon
                              size={15}
                              className={cn('flex-shrink-0', active ? 'text-brand-300' : '')}
                            />
                            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                            {!collapsed && item.href === '/returns'       && <ReturnAlertBadge collapsed={false} />}
                            {!collapsed && item.href === '/refunds'       && <RefundAlertBadge collapsed={false} />}
                            {!collapsed && item.href === '/replenishment' && <ReplenishmentAlertBadge collapsed={false} />}
                            {!collapsed && item.href === '/unfulfilled'   && <UnfulfilledAlertBadge collapsed={false} />}
                            {!collapsed && item.href === '/admin'         && <ChangelogNewBadge collapsed={false} />}
                            {collapsed  && item.href === '/returns'       && <ReturnAlertBadge collapsed={true} />}
                            {collapsed  && item.href === '/refunds'       && <RefundAlertBadge collapsed={true} />}
                            {collapsed  && item.href === '/replenishment' && <ReplenishmentAlertBadge collapsed={true} />}
                            {collapsed  && item.href === '/unfulfilled'   && <UnfulfilledAlertBadge collapsed={true} />}
                            {collapsed  && item.href === '/admin'         && <ChangelogNewBadge collapsed={true} />}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Collapse toggle — desktop only, floating on the right edge */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="
            hidden lg:flex
            absolute -right-3 top-1/2 -translate-y-1/2
            w-6 h-6 rounded-full
            bg-white hover:bg-slate-50
            border border-slate-200 hover:border-slate-300
            items-center justify-center
            text-slate-500 hover:text-slate-700
            shadow-md transition-all duration-150
            z-10
          "
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Footer */}
        <div className={cn('border-t border-slate-800/80 bg-slate-950/20', collapsed ? 'px-1.5 py-3' : 'px-3 py-3')}>
          {canPreviewTeam && !collapsed && (
            <button
              type="button"
              onClick={() => setViewingAsTeam(!viewingAsTeam)}
              className={cn(
                'mb-3 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors',
                viewingAsTeam
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-white/[0.08] hover:text-white'
              )}
              title={viewingAsTeam ? 'Return to admin navigation' : 'Preview team member navigation'}
            >
              <Eye size={13} className="flex-shrink-0" />
              <span className="flex-1 truncate">{viewingAsTeam ? 'Viewing team view' : 'View as team'}</span>
              <span className={cn(
                'h-4 w-7 rounded-full border p-0.5 transition-colors',
                viewingAsTeam ? 'border-amber-400 bg-amber-400/30' : 'border-slate-600 bg-slate-900'
              )}>
                <span className={cn(
                  'block h-2.5 w-2.5 rounded-full transition-transform',
                  viewingAsTeam ? 'translate-x-3 bg-amber-200' : 'bg-slate-500'
                )} />
              </span>
            </button>
          )}

          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              {canPreviewTeam && (
                <button
                  onClick={() => setViewingAsTeam(!viewingAsTeam)}
                  onMouseEnter={e => showTooltip(e, viewingAsTeam ? 'Viewing team view' : 'View as team')}
                  onMouseLeave={hideTooltip}
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                    viewingAsTeam ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-white/10'
                  )}
                >
                  <Eye size={13} />
                </button>
              )}
              <Link
                href="/account/password"
                onMouseEnter={e => showTooltip(e, loading ? 'Loading…' : user?.name || 'Account')}
                onMouseLeave={hideTooltip}
                className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center hover:bg-brand-600 transition-colors"
              >
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </Link>
              <button
                onClick={logout}
                onMouseEnter={e => showTooltip(e, 'Sign out')}
                onMouseLeave={hideTooltip}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                href="/account/password"
                title="Change password"
                className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0 hover:bg-brand-600 transition-colors"
              >
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">
                  {loading ? 'Checking session…' : user?.name || 'Not signed in'}
                </p>
                {user?.role === 'management' ? (
                  <p className="text-[10px] font-medium text-amber-400">Management · admin access</p>
                ) : (
                  <Link href="/account/password" className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors">
                    Change password
                  </Link>
                )}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-white/10"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Fixed tooltip rendered outside overflow context */}
        {collapsed && tooltip && <SidebarTooltip label={tooltip.label} y={tooltip.y} />}

      </aside>
    </>
  );
}
