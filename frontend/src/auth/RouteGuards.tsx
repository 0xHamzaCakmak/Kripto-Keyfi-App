import { Navigate, useLocation } from 'react-router-dom';
import { LoginRequiredPage } from '../components/Auth';
import { getAuthState } from '../services/authService';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, feature }: { children: React.ReactNode; feature: string }) {
  const { user, loading } = useAuth();
  const currentUser = user ?? getAuthState();
  if (loading && !currentUser) return <div className="py-20 text-center text-on-surface-variant">Oturum doğrulanıyor...</div>;
  return currentUser ? <>{children}</> : <LoginRequiredPage feature={feature} />;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const currentUser = user ?? getAuthState();
  if (loading && !currentUser) return <div className="py-20 text-center text-on-surface-variant">Oturum doğrulanıyor...</div>;
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (currentUser.backendRole !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}
