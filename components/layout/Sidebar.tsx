'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertTriangle,
  PlusCircle,
  FileText,
  BarChart2,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'All Cases',
    href: '/cases',
    icon: AlertTriangle,
  },
  {
    label: 'Submit Fault',
    href: '/cases/new',
    icon: PlusCircle,
    highlight: true,
  },
  {
    label: 'Claims',
    href: '/claims',
    icon: FileText,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: BarChart2,
  },
  {
    label: 'Admin',
    href: '/admin',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0 h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
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
            <p className="text-white font-bold text-sm leading-tight">Fault Portal</p>
            <p className="text-slate-400 text-xs">Customer Care</p>
          </div>
        </div>
      </div>
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-brand-600 text-white'
                  : item.highlight
                  ? 'text-brand-300 hover:bg-slate-800 hover:text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon
                size={18}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-white' : 'group-hover:text-white'
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.highlight && !isActive && (
                <span className="text-[10px] font-semibold bg-brand-600 text-white px-1.5 py-0.5 rounded-full">
                  NEW
                </span>
              )}
              {isActive && (
                <ChevronRight size={14} className="text-white/60" />
              )}
            </Link>
          );
        })}
      </nav>
      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-300">CC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">Customer Care Team</p>
            <p className="text-xs text-slate-500 truncate">Internal Portal</p>
          </div>
        </div>
      </div>
    </aside>
  );
}