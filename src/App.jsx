import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './queue/services/Authcontext';
import ProtectedRoute from './queue/pages/SuperAdmin/Protectedroute';
import Login from './queue/pages/SuperAdmin/Login';
import SuperAdminApp from './queue/pages/SuperAdmin/SuperAdminApp';
import AdminApp from './queue/pages/Admin/AdminApp';
import PatientView from './queue/pages/Patient/PatientView';
import TvDisplay from './queue/pages/TV/TvDisplay';
import TrackerPage from './queue/pages/WebTracker/TrackerPage';
import StaffApp from './queue/pages/Staff/StaffApp';
import { QueueProvider } from './queue/context/QueueContext';

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (user && user.role) {
    const roleName = user.role.role;

    if (roleName === 'Superadmin') {
      return <Navigate to="/superadmin/Dashboard" replace />;
    } else if (roleName === 'Admin') {
      return <Navigate to="/admin" replace />;
    } else if (roleName === 'Staff') {
      return <Navigate to="/staff" replace />;
    }
  }

  return <Navigate to="/patient" replace />;
}

function App() {
  return (
    <AuthProvider>
      <QueueProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />

            <Route path="/patient" element={<PatientView />} />
            <Route path="/display" element={<TvDisplay />} />
            <Route path="/tracker" element={<TrackerPage />} />
            <Route path="/track" element={<TrackerPage />} />

            {/* Login */}
            <Route path="/superadmin/login" element={<Login />} />

            {/* Superadmin base route */}
            <Route
              path="/superadmin"
              element={
                <Navigate
                  to="/superadmin/Dashboard"
                  replace
                />
              }
            />

            {/* Preview route - intentionally not protected */}
            <Route
              path="/__preview_superadmin"
              element={<SuperAdminApp />}
            />

            {/* SUPERADMIN ONLY */}
            <Route
              path="/superadmin/Dashboard"
              element={
                <ProtectedRoute allowedRole="superadmin">
                  <SuperAdminApp />
                </ProtectedRoute>
              }
            />

            {/* STAFF ONLY */}
            <Route
              path="/staff/*"
              element={
                <ProtectedRoute allowedRole="staff">
                  <StaffApp />
                </ProtectedRoute>
              }
            />

            {/* ADMIN ONLY */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRole="admin">
                  <AdminApp />
                </ProtectedRoute>
              }
            />

            {/* Unknown routes */}
            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />
          </Routes>
        </BrowserRouter>
      </QueueProvider>
    </AuthProvider>
  );
}

export default App;