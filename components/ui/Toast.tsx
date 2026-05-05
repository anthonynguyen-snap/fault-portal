'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error:   (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info:    (title: string, message?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIGS: Record<ToastType, {
  icon: React.ElementType;
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
}> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-emerald-500',
    iconColor: 'text-emerald-500',
    titleColor: 'text-slate-900',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-red-500',
    iconColor: 'text-red-500',
    titleColor: 'text-slate-900',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-amber-500',
    iconColor: 'text-amber-500',
    titleColor: 'text-slate-900',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-l-4 border-l-blue-500',
    iconColor: 'text-blue-500',
    titleColor: 'text-slate-900',
  },
};

// ─── Single Toast Item ─────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = CONFIGS[toast.type];
  const Icon = cfg.icon;
  return (
    <div
      className={`
        flex items-start gap-3 w-80 rounded-xl shadow-lg border border-slate-200
        ${cfg.bg} ${cfg.border} px-4 py-3
        animate-in slide-in-from-right-full duration-300
      `}
      style={{ animation: 'toastIn 0.3s ease-out' }}
    >
      <Icon size={18} className={`${cfg.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${cfg.titleColor}`}>{toast.title}</p>
        {toast.message && <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-3), { id, type, title, message }]); // max 4
    const timer = setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  const value: ToastContextValue = {
    toast,
    success: (t, m) => toast('success', t, m),
    error:   (t, m) => toast('error',   t, m),
    warning: (t, m) => toast('warning', t, m),
    info:    (t, m) => toast('info',    t, m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
