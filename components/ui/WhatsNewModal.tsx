'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { CHANGELOG, CHANGELOG_SEEN_KEY, LATEST_VERSION, ChangeCategory } from '@/lib/changelog';

// ── Category pill colours ─────────────────────────────────────────────────────
const CATEGORY_STYLES: Record<ChangeCategory, string> = {
  Dashboard:     'bg-violet-100 text-violet-700',
  Returns:       'bg-sky-100 text-sky-700',
  Refunds:       'bg-emerald-100 text-emerald-700',
  Roster:        'bg-amber-100 text-amber-700',
  Admin:         'bg-slate-100 text-slate-600',
  Cases:         'bg-rose-100 text-rose-700',
  Orders:        'bg-indigo-100 text-indigo-700',
  Inventory:     'bg-orange-100 text-orange-700',
  Promotions:    'bg-pink-100 text-pink-700',
  Replenishment: 'bg-teal-100 text-teal-700',
  Performance:   'bg-lime-100 text-lime-700',
  Security:      'bg-red-100 text-red-700',
  'UI/UX':       'bg-fuchsia-100 text-fuchsia-700',
};

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  // Check on mount whether there's an unseen version
  useEffect(() => {
    try {
      const seen = localStorage.getItem(CHANGELOG_SEEN_KEY);
      if (seen !== LATEST_VERSION) setOpen(true);
    } catch { /* localStorage unavailable */ }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_VERSION ?? '');
    } catch { /* no-op */ }
    setOpen(false);
    // Notify sidebar badge to clear
    window.dispatchEvent(new Event('changelog-seen'));
  }

  if (!open) return null;

  const latest = CHANGELOG.find(v => v.isLatest) ?? CHANGELOG[0];
  if (!latest) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto animate-in zoom-in-95 fade-in duration-200">

          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-brand-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
                  What&apos;s New · {latest.version}
                </p>
                <h2 id="whats-new-title" className="text-base font-bold text-slate-900 leading-tight">
                  {latest.label}
                </h2>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{latest.summary}</p>
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Change list */}
          <div className="px-6 py-4 space-y-3 max-h-72 overflow-y-auto">
            {latest.changes.map((change, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${CATEGORY_STYLES[change.category] ?? 'bg-slate-100 text-slate-600'}`}>
                  {change.category}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">{change.text}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <Link
              href="/admin"
              onClick={dismiss}
              className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1"
            >
              View full changelog <ArrowRight size={11} />
            </Link>
            <button
              onClick={dismiss}
              className="btn-primary text-sm px-5 py-2"
            >
              Got it
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
