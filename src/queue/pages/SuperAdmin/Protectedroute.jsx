  import { Navigate } from 'react-router-dom';
  import { useAuth } from '../../services/Authcontext';

  export default function ProtectedRoute({ children, allowedRole }) {
    const { user, loading } = useAuth();

    // Wait until AuthContext finishes checking Supabase
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
    // This catches:
    // - User never logged in
    // - User logged out
    // - Supabase session expired
    // - Invalid/removed user profile
    //
    // AuthContext will also clear the stored user/session.
    if (!user) {
      return (
        <Navigate
          to="/superadmin/login"
          replace
        />
      );
    }

    // =========================================================
    // GET ACTUAL ROLE
    // =========================================================
    const userRole = String(
      user?.role?.role ?? ''
    )
      .trim()
      .toLowerCase();

    // =========================================================
    // INVALID / MISSING ROLE
    // =========================================================
    if (!userRole) {
      return (
        <Navigate
          to="/superadmin/login"
          replace
        />
      );
    }

    // =========================================================
    // ROLE DOES NOT MATCH THIS ROUTE
    // =========================================================
    if (
      allowedRole &&
      userRole !== allowedRole.toLowerCase()
    ) {
      // Superadmin trying to access Admin/Staff
      if (userRole === 'superadmin') {
        return (
          <Navigate
            to="/superadmin/Dashboard"
            replace
          />
        );
      }

      // Admin trying to access Superadmin/Staff
      if (userRole === 'admin') {
        return (
          <Navigate
            to="/admin"
            replace
          />
        );
      }

      // Staff trying to access Superadmin/Admin
      if (userRole === 'staff') {
        return (
          <Navigate
            to="/staff"
            replace
          />
        );
      }

      // Unknown role
      return (
        <Navigate
          to="/superadmin/login"
          replace
        />
      );
    }

    // =========================================================
    // AUTHENTICATED + CORRECT ROLE
    // =========================================================
    return children;
  }