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
  ChevronRight,
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import { useAuth } from '@/components/auth/AuthProvider';

type AlertLevel = 'red' | 'amber' | null;

function ReturnAlertBadge() {
  const [level, setLevel] = useState<AlertLevel>(null);

  useEffect(() => {
    fetch('/api/returns/alerts')
      .then(r => r.json())
      .then(d => setLevel(d.level ?? null))
      .catch(() => {});
  }, []);

  if (!level) return null;

  return (
    <AlertTriangle
      size={13}
      className={level === 'red' ? 'text-red-400' : 'text-amber-400'}
    />
  );
}

function RefundAlertBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    function check() {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/refunds/alerts')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(() => {});
    }
    check();
    const interval = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!count) return null;

  return (
    <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  );
}

function ReplenishmentAlertBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    function check() {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/replenishment/alerts')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(() => {});
    }
    check();
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!count) return null;

  return (
    <span className="text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  );
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

type NavGroup = {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Fault Management',
    items: [
      { label: 'All Cases', href: '/cases',   icon: AlertTriangle },
      { label: 'Claims',    href: '/claims',  icon: FileText, adminOnly: true },
    ],
  },
  {
    label: 'Customer',
    items: [
      { label: 'Order Lookup', href: '/orders',   icon: ShoppingBag },
      { label: 'Returns',      href: '/returns',  icon: RotateCcw },
      { label: 'Refunds',      href: '/refunds',  icon: CreditCard },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Promotions',    href: '/promotions',    icon: Tag },
      { label: 'Stock Room',    href: '/stock',         icon: Package,  adminOnly: true },
      { label: 'Replenishment', href: '/replenishment', icon: Truck,    adminOnly: true },
    ],
  },
  {
    label: 'Wholesale',
    adminOnly: true,
    items: [
      { label: 'Corporate', href: '/corporate', icon: Briefcase },
    ],
  },
  {
    label: 'Team',
    items: [
      { label: 'Roster',     href: '/roster',       icon: CalendarDays },
      { label: 'Leave Log',  href: '/roster/leave',  icon: ClipboardList },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Activity Log',      href: '/log',         icon: Activity },
      { label: 'Reports',           href: '/reports',     icon: BarChart2,  adminOnly: true },
      { label: 'Team Performance',  href: '/performance', icon: Users2 },
      { label: 'Admin',             href: '/admin',       icon: Settings,   adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Close drawer on route change (iPad nav)
  useEffect(() => { close(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  // Get initials for avatar
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CC';

  return (
    <>
      {/* Backdrop — only on small screens when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside className={cn(
        'w-60 bg-slate-900 flex flex-col flex-shrink-0 h-full z-50 transition-transform duration-300',
        // On lg+ always visible in normal flow
        'lg:relative lg:translate-x-0',
        // Below lg: fixed overlay, slide in/out
        'fixed inset-y-0 left-0',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
            <Image
              src="/snap-logo.jpg"
              alt="SNAP Logo"
              width={32}
              height={32}
              className="object-contain w-full h-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">SNAP Customer Care</p>
            <p className="text-slate-400 text-xs">Internal Portal</p>
          </div>
          {/* Close button — only visible on small screens */}
          <button
            onClick={close}
            className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800 flex-shrink-0"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Submit actions */}
      <div className="px-3 pt-4 pb-3 border-b border-slate-800 space-y-1.5">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em] px-2 mb-2">Submit</p>
        <Link
          href="/cases/new"
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
            isActive('/cases/new')
              ? 'bg-brand-700 text-white'
              : 'bg-brand-600 hover:bg-brand-700 text-white'
          )}
        >
          <PlusCircle size={15} className="flex-shrink-0" />
          Submit Fault
        </Link>
        <Link
          href="/refunds?new=1"
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
            'bg-slate-700 hover:bg-slate-600 text-slate-100'
          )}
        >
          <CreditCard size={15} className="flex-shrink-0" />
          Request Refund
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => {
          // Hide admin-only groups from staff
          if (group.adminOnly && !isAdmin) return null;

          // Filter items
          const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <div className="flex items-center gap-2 px-3 mb-1.5">
                <div className="w-3 h-px bg-slate-700 flex-shrink-0" />
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em] flex-shrink-0">
                  {group.label}
                </p>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                        active
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <Icon
                        size={16}
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          active ? 'text-white' : 'group-hover:text-white'
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.href === '/returns'       && <ReturnAlertBadge />}
                      {item.href === '/refunds'       && <RefundAlertBadge />}
                      {item.href === '/replenishment' && <ReplenishmentAlertBadge />}
                      {active && <ChevronRight size={13} className="text-white/50" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Pinned Home button */}
      <div className="px-3 pb-2 border-t border-slate-800 pt-2">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
            isActive('/')
              ? 'bg-brand-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          )}
        >
          <Home
            size={16}
            className={cn(
              'flex-shrink-0 transition-colors',
              isActive('/') ? 'text-white' : 'group-hover:text-white'
            )}
          />
          <span className="flex-1 truncate">Home</span>
          {isActive('/') && <ChevronRight size={13} className="text-white/50" />}
        </Link>
      </div>

      {/* Footer — user info + logout */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5">
          <Link href="/account/password" title="Change password" className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 hover:bg-indigo-600 transition-colors">
            <span className="text-[11px] font-semibold text-white">{initials}</span>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">
              {user?.name || 'Loading…'}
            </p>
            <Link href="/account/password" className="text-xs text-slate-500 hover:text-slate-400 truncate capitalize transition-colors">
              Change password
            </Link>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
