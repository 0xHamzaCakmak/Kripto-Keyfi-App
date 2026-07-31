import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthState, restoreSession, type MockAuthUser } from '../services/authService';

type AuthContextValue = { user: MockAuthUser | null; loading: boolean };
const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MockAuthUser | null>(() => getAuthState());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    restoreSession().catch(() => null).finally(() => {
      if (active) { setUser(getAuthState()); setLoading(false); }
    });
    const sync = () => { if (active) setUser(getAuthState()); };
    window.addEventListener('kriptokeyfi-auth-change', sync);
    window.addEventListener('kriptokeyfi-session-expired', sync);
    return () => {
      active = false;
      window.removeEventListener('kriptokeyfi-auth-change', sync);
      window.removeEventListener('kriptokeyfi-session-expired', sync);
    };
  }, []);

  return <AuthContext.Provider value={useMemo(() => ({ user, loading }), [user, loading])}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

