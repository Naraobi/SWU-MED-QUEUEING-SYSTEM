import { useEffect, useState } from 'react';
import AdminSidebar, { AdminHeaderBar } from './AdminSidebar';
import AdminDashboard from './AdminDashboard';
import StaffManagementPage from './StaffManagementPage';
import {
  QueueManagementPage,
  ReportsPage,
  SettingsPage,
  TerminalManagementPage,
  applyTheme,
  loadStoredTheme,
} from './AdminScreens';

function AdminApp() {
  const [activeItem, setActiveItem] = useState('dashboard');

  // Re-apply the admin's saved theme choice on every load, not just when
  // they visit Settings.
  useEffect(() => {
    const stored = loadStoredTheme();
    if (stored) applyTheme(stored);
  }, []);

  return (
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
  );
}

export default AdminApp;