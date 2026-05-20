'use client';

import { useRef, useState } from 'react';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'warning' | 'danger';
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  function confirm(nextOptions: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }

  function finish(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }

  const tone = options?.tone ?? 'default';
  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : tone === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-white'
      : 'bg-brand-600 hover:bg-brand-700 text-white';

  const dialog = options ? (
    <>
      <div className="fixed inset-0 z-[70] bg-slate-900/50" onClick={() => finish(false)} />
      <div className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{options.title}</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{options.message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button type="button" onClick={() => finish(false)} className="btn-secondary px-4">Cancel</button>
          <button type="button" onClick={() => finish(true)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${confirmClass}`}>
            {options.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </>
  ) : null;

  return { confirm, dialog };
}
