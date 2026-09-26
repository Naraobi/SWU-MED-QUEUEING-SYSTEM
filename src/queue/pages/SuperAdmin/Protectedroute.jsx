import { Navigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';
import logo from '../../../assets/logo.png';

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();

  /*
   * Wait until AuthContext restores/checks the local session.
   *
   * The signed-in session is restored from Firebase on every reload, so this
   * screen shows for a moment each time. It carries the SWUMed mark rather
   * than bare text so a refresh looks like the app, not a blank page.
   */
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F9FA] px-6">
        <img
          src={logo}
          alt="SWUMed Queuing System"
          className="swu-pop h-12 w-auto opacity-90"
        />

        <div className="flex items-center gap-2.5">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F0DADA] border-t-[#9D0A0E]" />

          <span className="text-sm font-medium text-[#4B5563]">
            Restoring your session
          </span>
        </div>

        <p className="text-xs text-[#9CA3AF]">
          Signing you back in&hellip;
        </p>
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