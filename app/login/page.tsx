'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Auto-focus email on mount
  useEffect(() => {
    document.getElementById('email')?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-lg mb-5 overflow-hidden">
            <Image
              src="/snap-logo.jpg"
              alt="SNAP Logo"
              width={56}
              height={56}
              className="object-contain w-full h-full"
            />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SNAP Customer Care</h1>
          <p className="text-slate-500 text-sm mt-1">Internal Portal</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl p-7 shadow-2xl border border-slate-800">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@snapwireless.com.au"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1591b3] focus:border-transparent text-sm transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1591b3] focus:border-transparent text-sm transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-900/60 rounded-lg px-3.5 py-2.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1591b3] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: loading ? '#0e7290' : '#1591b3' }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#127ba0'; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#1591b3'; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>

          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-5">
          Trouble signing in? Contact your admin.
        </p>

      </div>
    </div>
  );
}
