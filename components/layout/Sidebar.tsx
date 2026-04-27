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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      fetch('/api/refunds/alerts')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(() => {});
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!count) return null;

  return (
    <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  );
}

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Home', href: '/', icon: Home },
    ],
  },
  {
    label: 'Fault Management',
    items: [
      { label: 'All Cases', href: '/cases',   icon: AlertTriangle },
      { label: 'Claims',    href: '/claims',  icon: FileText },
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
      { label: 'Stock Room',    href: '/stock',         icon: Package },
      { label: 'Replenishment', href: '/replenishment', icon: Truck },
    ],
  },
  {
    label: 'Wholesale',
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
      { label: 'Reports',          href: '/reports',     icon: BarChart2 },
      { label: 'Team Performance', href: '/performance', icon: Users2 },
      { label: 'Admin',            href: '/admin',       icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0 h-full">
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
          <div>
            <p className="text-white font-bold text-sm leading-tight">SNAP Customer Care</p>
            <p className="text-slate-400 text-xs">Internal Portal</p>
          </div>
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
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 px-3 mb-1.5">
              <div className="w-3 h-px bg-slate-700 flex-shrink-0" />
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.12em] flex-shrink-0">
                {group.label}
              </p>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
                    {item.href === '/returns' && <ReturnAlertBadge />}
                    {item.href === '/refunds' && <RefundAlertBadge />}
                    {active && <ChevronRight size={13} className="text-white/50" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-semibold text-slate-300">CC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">Customer Care Team</p>
            <p className="text-xs text-slate-500 truncate">Internal Portal</p>
          </div>
          <a
            href="/api/auth/logout"
            title="Sign out"
            className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <LogOut size={14} />
          </a>
        </div>
      </div>
    </aside>
  );
}
