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
      size={12}
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
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!count) return null;
  return (
    <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
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
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!count) return null;
  return (
    <span className="text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
      {count}
    </span>
  );
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  isAction?: boolean;
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
      { label: 'Submit Fault', href: '/cases/new', icon: PlusCircle, isAction: true },
      { label: 'All Cases',    href: '/cases',     icon: AlertTriangle },
      { label: 'Claims',       href: '/claims',    icon: FileText, adminOnly: true },
    ],
  },
  {
    label: 'Customer',
    items: [
      { label: 'Request Refund', href: '/refunds?new=1', icon: CreditCard, isAction: true },
      { label: 'Order Lookup',   href: '/orders',        icon: ShoppingBag },
      { label: 'Returns',        href: '/returns',       icon: RotateCcw },
      { label: 'Refunds',        href: '/refunds',       icon: CreditCard },
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
      { label: 'Roster',    href: '/roster',       icon: CalendarDays },
      { label: 'Leave Log', href: '/roster/leave', icon: ClipboardList },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Activity Log',     href: '/log',         icon: Activity },
      { label: 'Reports',          href: '/reports',     icon: BarChart2, adminOnly: true },
      { label: 'Team Performance', href: '/performance', icon: Users2 },
      { label: 'Admin',            href: '/admin',       icon: Settings,  adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => { close(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    if (href.includes('?')) return false; // query-param action links never show as active
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
        'w-56 bg-slate-900 flex flex-col flex-shrink-0 h-full z-50 transition-transform duration-300',
        'lg:relative lg:translate-x-0',
        'fixed inset-y-0 left-0',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* Logo */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
              <Image src="/snap-logo.jpg" alt="SNAP Logo" width={28} height={28} className="object-contain w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">SNAP Customer Care</p>
              <p className="text-slate-500 text-[10px]">Internal Portal</p>
            </div>
          </Link>
          <button
            onClick={close}
            className="lg:hidden text-slate-500 hover:text-white transition-colors p-1 rounded flex-shrink-0"
            aria-label="Close menu"
          >
            <X size={15} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">

          {/* Home — standalone, no group label */}
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group mb-3',
              isActive('/')
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Home size={15} className={cn('flex-shrink-0', isActive('/') ? 'text-white' : 'group-hover:text-white')} />
            <span className="flex-1">Home</span>
            {isActive('/') && <ChevronRight size={12} className="text-white/50" />}
          </Link>

          {/* Groups */}
          <div className="space-y-4">
            {navGroups.map((group) => {
              if (group.adminOnly && !isAdmin) return null;
              const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.label}>
                  <p className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      if (item.isAction) {
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all text-brand-300 hover:bg-slate-800 hover:text-brand-200"
                          >
                            <Icon size={14} className="flex-shrink-0 text-brand-400" />
                            <span className="flex-1 truncate">{item.label}</span>
                          </Link>
                        );
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group',
                            active
                              ? 'bg-brand-600 text-white'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          )}
                        >
                          <Icon
                            size={15}
                            className={cn('flex-shrink-0', active ? 'text-white' : 'group-hover:text-white')}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.href === '/returns'       && <ReturnAlertBadge />}
                          {item.href === '/refunds'       && <RefundAlertBadge />}
                          {item.href === '/replenishment' && <ReplenishmentAlertBadge />}
                          {active && <ChevronRight size={12} className="text-white/50" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5">
            <Link
              href="/account/password"
              title="Change password"
              className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0 hover:bg-indigo-600 transition-colors"
            >
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user?.name || 'Loading…'}</p>
              <Link href="/account/password" className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors">
                Change password
              </Link>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0 p-1 rounded hover:bg-slate-800"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

      </aside>
    </>
  );
}
