'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'management' | 'staff';
}

interface AuthContextValue {
  user: User | null;
  effectiveRole: 'admin' | 'management' | 'staff' | null;
  viewingAsTeam: boolean;
  setViewingAsTeam: (value: boolean) => void;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  effectiveRole: null,
  viewingAsTeam: false,
  setViewingAsTeam: () => {},
  loading: true,
  logout: async () => {},
});

const TEAM_VIEW_KEY = 'portal_view_as_team';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [viewingAsTeam, setViewingAsTeamState] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setViewingAsTeamState(localStorage.getItem(TEAM_VIEW_KEY) === '1');
    } catch {
      setViewingAsTeamState(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setUser(data?.user ?? null);
        if (!['admin', 'management'].includes(data?.user?.role)) setViewingAsTeamState(false);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function setViewingAsTeam(value: boolean) {
    setViewingAsTeamState(value);
    try {
      if (value) localStorage.setItem(TEAM_VIEW_KEY, '1');
      else localStorage.removeItem(TEAM_VIEW_KEY);
    } catch {
      // Ignore browser storage issues; the toggle still works for this render.
    }
  }

  const hasAdminAccess = user?.role === 'admin' || user?.role === 'management';
  const effectiveRole = hasAdminAccess && viewingAsTeam ? 'staff' : user?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, effectiveRole, viewingAsTeam: hasAdminAccess && viewingAsTeam, setViewingAsTeam, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
