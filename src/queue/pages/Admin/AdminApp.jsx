import { useState } from 'react';
import AdminSidebar, { AdminHeaderBar } from './AdminSidebar';
import AdminDashboard from './AdminDashboard';
import StaffManagementPage from './StaffManagementPage';
import {
  QueueManagementPage,
  ReportsPage,
  SettingsPage,
  TerminalManagementPage,
} from './AdminScreens';

import { LanguageProvider } from './LanguageContext';
import { AppearanceProvider, useAppearance } from './AppearanceContext';

function AdminShell() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const { accent, isDark } = useAppearance();

  // The theme class and accent variable live on this element, not on
  // <html>, so Staff/SuperAdmin/TV/Patient screens are never restyled
  // by an admin's appearance choice.
  return (
    <div
      className={`admin-shell flex min-h-screen bg-slate-100${isDark ? ' admin-dark' : ''}`}
      style={{ '--admin-accent': accent }}
    >
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

function AdminApp() {
  return (
    <AppearanceProvider>
      <LanguageProvider>
        <AdminShell />
      </LanguageProvider>
    </AppearanceProvider>
  );
}

export default AdminApp;