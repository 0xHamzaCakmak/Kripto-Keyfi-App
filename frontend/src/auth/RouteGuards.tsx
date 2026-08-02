import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

function AuthSkeleton() {
  return <div className="mx-auto max-w-xl space-y-3 py-20" aria-label="Oturum doğrulanıyor"><div className="h-7 animate-pulse rounded-xl bg-surface-high" /><div className="h-24 animate-pulse rounded-2xl bg-surface" /></div>;
}

export function ProtectedRoute({ children }: { children: React.ReactNode; feature?: string }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'initializing' || status === 'refreshing') return <AuthSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'initializing' || status === 'refreshing') return <AuthSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (user.backendRole !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}
