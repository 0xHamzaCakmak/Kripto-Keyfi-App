import { Navigate, useLocation } from 'react-router-dom';
import { LoginRequiredPage } from '../components/Auth';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, feature }: { children: React.ReactNode; feature: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-20 text-center text-on-surface-variant">Oturum doğrulanıyor...</div>;
  return user ? <>{children}</> : <LoginRequiredPage feature={feature} />;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="py-20 text-center text-on-surface-variant">Oturum doğrulanıyor...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.backendRole !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

