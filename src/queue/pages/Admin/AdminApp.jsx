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

import { LanguageProvider, useLanguage } from './LanguageContext';
import { AppearanceProvider, useAppearance } from './AppearanceContext';
import { UnsavedChangesProvider, useUnsavedChanges } from './UnsavedChangesContext';

// Asks before leaving Settings while there are unsaved edits. "Leave"
// discards them back to the last saved values (Settings registers that
// discard callback); "Stay" just closes the prompt.
function LeaveSettingsModal({ onStay, onLeave }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold text-[#1F2937]">{t('settingsPage.leaveTitle')}</h2>
        <p className="mt-1 text-sm text-[#4B5563]">{t('settingsPage.leaveBody')}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStay}
            className="flex-1 rounded-lg border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]"
          >
            {t('settingsPage.leaveStay')}
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="flex-1 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white hover:bg-[#7d0809]"
          >
            {t('settingsPage.leaveDiscard')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminShell() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const [pendingItem, setPendingItem] = useState(null);
  const { accent, isDark } = useAppearance();
  const { isDirty, discardChanges } = useUnsavedChanges();

  function handleSelect(item) {
    if (item === activeItem) return;

    if (activeItem === 'settings' && isDirty) {
      setPendingItem(item);
      return;
    }

    setActiveItem(item);
  }

  function handleLeave() {
    discardChanges();
    setActiveItem(pendingItem);
    setPendingItem(null);
  }

  function handleStay() {
    setPendingItem(null);
  }

  // The theme class and accent variable live on this element, not on
  // <html>, so Staff/SuperAdmin/TV/Patient screens are never restyled
  // by an admin's appearance choice.
  return (
    <div
      className={`admin-shell flex min-h-screen bg-slate-100${isDark ? ' admin-dark' : ''}`}
      style={{ '--admin-accent': accent }}
    >
      <AdminSidebar activeItem={activeItem} onSelect={handleSelect} />

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

      {pendingItem && <LeaveSettingsModal onStay={handleStay} onLeave={handleLeave} />}
    </div>
  );
}

function AdminApp() {
  return (
    <AppearanceProvider>
      <LanguageProvider>
        <UnsavedChangesProvider>
          <AdminShell />
        </UnsavedChangesProvider>
      </LanguageProvider>
    </AppearanceProvider>
  );
}

export default AdminApp;