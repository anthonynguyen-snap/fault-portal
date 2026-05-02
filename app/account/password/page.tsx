'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { KeyRound, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (form.next !== form.confirm) {
      setError('New passwords do not match');
      return;
    }
    if (form.next.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (form.current === form.next) {
      setError('New password must be different from your current one');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        return;
      }
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="page-title">Change Password</h1>
        {user && <p className="page-subtitle">Signed in as {user.name} · {user.email}</p>}
      </div>

      <div className="card p-6">
        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-slate-900 mb-1">Password updated</h2>
            <p className="text-sm text-slate-500 mb-5">Your new password is active immediately.</p>
            <button
              onClick={() => setSuccess(false)}
              className="btn-secondary text-sm"
            >
              Change again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <KeyRound size={16} className="text-indigo-600" />
              </div>
              <p className="text-sm text-slate-600">
                Choose a strong password that&apos;s at least 6 characters long.
              </p>
            </div>

            {/* Current password */}
            <div>
              <label className="form-label">Current password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={form.current}
                  onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                  className="form-input pr-10"
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="form-label">New password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={form.next}
                  onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
                  className="form-input pr-10"
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label className="form-label">Confirm new password</label>
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                className={`form-input ${form.confirm && form.confirm !== form.next ? 'border-red-300' : ''}`}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {form.confirm && form.confirm !== form.next && (
                <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || !form.current || !form.next || !form.confirm}
                className="btn-primary w-full"
              >
                {saving ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
