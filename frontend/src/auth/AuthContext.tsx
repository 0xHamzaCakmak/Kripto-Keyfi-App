import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearAuthState, getAuthState, restoreSession, type MockAuthUser } from '../services/authService';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'refreshing' | 'error';
type AuthContextValue = { user: MockAuthUser | null; status: AuthStatus; loading: boolean; error: string | null };
const AuthContext = createContext<AuthContextValue>({ user: null, status: 'initializing', loading: true, error: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockAuthUser | null>(() => getAuthState());
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void restoreSession()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setStatus('authenticated');
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        clearAuthState();
        setUser(null);
        const statusCode = typeof cause === 'object' && cause && 'response' in cause
          ? (cause as { response?: { status?: number } }).response?.status
          : undefined;
        setStatus(statusCode === 401 ? 'unauthenticated' : 'error');
        setError(statusCode === 401 ? null : 'Oturum servisine erişilemedi.');
      });

    const sync = () => {
      if (!active) return;
      const current = getAuthState();
      setUser(current);
      setStatus(current ? 'authenticated' : 'unauthenticated');
      setError(null);
    };
    const refreshing = () => { if (active) setStatus('refreshing'); };
    const expired = () => {
      if (!active) return;
      clearAuthState();
      setUser(null);
      setStatus('unauthenticated');
      setError('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
    };

    window.addEventListener('kripto-keyfi-auth-change', sync);
    window.addEventListener('kriptokeyfi-session-refreshing', refreshing);
    window.addEventListener('kriptokeyfi-session-refreshed', sync);
    window.addEventListener('kriptokeyfi-session-expired', expired);
    return () => {
      active = false;
      window.removeEventListener('kripto-keyfi-auth-change', sync);
      window.removeEventListener('kriptokeyfi-session-refreshing', refreshing);
      window.removeEventListener('kriptokeyfi-session-refreshed', sync);
      window.removeEventListener('kriptokeyfi-session-expired', expired);
    };
  }, []);

  const value = useMemo(() => ({
    user,
    status,
    loading: status === 'initializing' || status === 'refreshing',
    error,
  }), [user, status, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
