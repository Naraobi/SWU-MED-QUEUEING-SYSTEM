import { Navigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();

  // Wait until AuthContext restores/checks the local session
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Checking session...
      </div>
    );
  }

  // =========================================================
  // NO LOGGED-IN USER
  // =========================================================
  if (!user) {
    return <Navigate to="/superadmin/login" replace />;
  }

  // =========================================================
  // GET ROLE
  // =========================================================
  // New AuthContext stores role as a string:
  // user.role = "superadmin"
  //
  // This also supports the old nested format:
  // user.role = { role: "superadmin" }
  const userRole = String(
    typeof user.role === 'string'
      ? user.role
      : user.role?.role ?? ''
  )
    .trim()
    .toLowerCase();

  // =========================================================
  // INVALID / MISSING ROLE
  // =========================================================
  if (!userRole) {
    console.error('ProtectedRoute: User has no valid role:', user);

    return <Navigate to="/superadmin/login" replace />;
  }

  // =========================================================
  // ROLE DOES NOT MATCH THIS ROUTE
  // =========================================================
  if (
    allowedRole &&
    userRole !== String(allowedRole).trim().toLowerCase()
  ) {
    // Superadmin
    if (userRole === 'superadmin') {
      return (
        <Navigate
          to="/superadmin/Dashboard"
          replace
        />
      );
    }

    // Admin
    if (userRole === 'admin') {
      return (
        <Navigate
          to="/admin"
          replace
        />
      );
    }

    // Staff
    if (userRole === 'staff') {
      return (
        <Navigate
          to="/staff"
          replace
        />
      );
    }

    // Unknown role
    return <Navigate to="/superadmin/login" replace />;
  }

  // =========================================================
  // AUTHENTICATED + CORRECT ROLE
  // =========================================================
  return children;
}