import { useEffect, useState } from 'react';
import AdminSidebar, { AdminHeaderBar } from './AdminSidebar';
import AdminDashboard from './AdminDashboard';
import StaffManagementPage from './StaffManagementPage';
import {
  QueueManagementPage,
  ReportsPage,
  SettingsPage,
  TerminalManagementPage,
  SecurityPinGate,
} from './AdminScreens';

import { applyTheme, loadStoredTheme } from './adminHelpers';
import { LanguageProvider } from './LanguageContext';
import { getSecurityPinStatus } from '../../services/backendApi';
import { auth } from '../../../firebase';

function AdminApp() {
  const [activeItem, setActiveItem] = useState('dashboard');

  // Gate the whole app behind the admin's Security PIN (when they have
  // one set up) so it's the first thing shown after login, not just an
  // option buried in Settings. Re-checked - and re-locked - on every
  // fresh mount of AdminApp (sign-in, hard refresh), not persisted
  // across those, so it behaves like an actual login step.
  const [pinGateLoading, setPinGateLoading] = useState(true);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  // Re-apply the admin's saved theme choice on every load, not just when
  // they visit Settings.
  useEffect(() => {
    const stored = loadStoredTheme();
    if (stored) applyTheme(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkPinRequirement() {
      try {
        const configured = await getSecurityPinStatus(auth.currentUser);
        if (!cancelled) setPinRequired(configured);
      } catch (err) {
        console.error('Failed to check Security PIN status:', err);
      } finally {
        if (!cancelled) setPinGateLoading(false);
      }
    }

    checkPinRequirement();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LanguageProvider>
      {pinGateLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
          Checking security status...
        </div>
      ) : pinRequired && !pinVerified ? (
        <SecurityPinGate onUnlock={() => setPinVerified(true)} />
      ) : (
        <div className="flex min-h-screen bg-slate-100">
          <AdminSidebar activeItem={activeItem} onSelect={setActiveItem} />

          <div className="flex min-w-0 flex-1 flex-col">
            <AdminHeaderBar />

            <main className="min-w-0 flex-1 bg-[#f1f3f6] px-4 py-5">
              {activeItem === 'dashboard' && <AdminDashboard />}
              {activeItem === 'staff' && <StaffManagementPage />}
              {activeItem === 'terminal' && <TerminalManagementPage />}
              {activeItem === 'queues' && <QueueManagementPage />}
              {activeItem === 'reports' && <ReportsPage />}
              {activeItem === 'settings' && <SettingsPage />}
            </main>
          </div>
        </div>
      )}
    </LanguageProvider>
  );
}

export default AdminApp;