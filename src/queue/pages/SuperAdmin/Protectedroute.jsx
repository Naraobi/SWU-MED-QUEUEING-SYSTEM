import { Navigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Checking session...
      </div>
    );
  }

  if (!user) {
    // FIX: Changed from "/login" to "/superadmin/login"
    return <Navigate to="/superadmin/login" replace />;
  }

  return children;
}