'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type Entitlements, type Me } from './api';

interface AuthState {
  user: Me | null;
  entitlements: Entitlements | null;
  /** แอดมิน (เห็นเมนูหลังบ้าน) */
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (token: string, remember?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setEntitlements(null); setLoading(false); return; }
    try {
      const res = await api<{ user: Me; entitlements: Entitlements; isAdmin?: boolean }>('/api/auth/me');
      setUser(res.user);
      setEntitlements(res.entitlements);
      setIsAdmin(!!res.isAdmin);
    } catch {
      setUser(null);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (token: string, remember = true) => {
    setToken(token, remember);
    setLoading(true);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setEntitlements(null);
  }, []);

  return <AuthContext.Provider value={{ user, entitlements, isAdmin, loading, refresh, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องอยู่ใน <AuthProvider>');
  return ctx;
}
