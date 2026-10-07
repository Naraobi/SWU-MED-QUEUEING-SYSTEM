import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import { canAccessStaffPage } from '../../services/accessControl';
import LogoutModal from '../../components/modals/LogoutModal.jsx';
import logo from '../../../assets/logo.png';
import { useStaffPreferences } from './StaffPreferencesContext.jsx';

const LINKS = [
  { key: 'today', to: '/staff', labelKey: 'nav.today', icon: TodayIcon },
  { key: 'history', to: '/staff/history', labelKey: 'nav.history', icon: HistoryIcon },
  { key: 'settings', to: '/staff/settings', labelKey: 'nav.settings', icon: SettingsIcon },
];

// Asks before leaving Settings while there are unsaved edits. "Leave"
// discards them back to the last saved values (Settings registers that
// discard callback via useStaffPreferences); "Stay" just closes the
// prompt. Mirrors Admin's LeaveSettingsModal.
function LeaveSettingsModal({ t, onStay, onLeave }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-lg font-bold text-[#1F2937]">{t('settings.leaveTitle')}</h2>
        <p className="mt-1 text-sm text-[#4B5563]">{t('settings.leaveBody')}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStay}
            className="flex-1 rounded-lg border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]"
          >
            {t('settings.leaveStay')}
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="flex-1 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white hover:bg-[#7d0809]"
          >
            {t('settings.leaveDiscard')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ isCollapsed = false, onToggle, onClose, mobileOpen = false }) {
  const [showLogout, setShowLogout] = useState(false);
  const [pendingTo, setPendingTo] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isDirty, discardChanges, logoUrl } = useStaffPreferences();
  const visibleLinks = LINKS.filter(({ key }) => canAccessStaffPage(user, key));

  // Keep restricted staff from remaining on Today's Queue if their permissions change.
  React.useEffect(() => {
    if (user && !canAccessStaffPage(user, 'today') && canAccessStaffPage(user, 'history')) {
      navigate('/staff/history', { replace: true });
    }
  }, [user, navigate]);

  function handleNavClick(event, to) {
    const onSettingsPage = location.pathname.startsWith('/staff/settings');
    if (onSettingsPage && to !== location.pathname && isDirty) {
      event.preventDefault();
      setPendingTo(to);
    }
  }

  function handleLeaveConfirmed() {
    discardChanges();
    const target = pendingTo;
    setPendingTo(null);
    if (target) navigate(target);
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[50] bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`staff-sidebar fixed lg:sticky top-0 flex h-screen flex-shrink-0 flex-col border-r border-slate-200 bg-white z-[51] transition-all duration-200 ease-out ${
          isCollapsed ? 'w-18' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ fontFamily: 'Inter, sans-serif' }}
        aria-label="Sidebar"
      >
        <div className={`flex h-[74px] shrink-0 items-center border-b border-slate-200 px-3 justify-center`}>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={t('nav.toggleSidebar') || 'Toggle sidebar'}
              title={t('nav.toggleSidebar') || 'Toggle sidebar'}
              className="hidden lg:flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9D0A0E]/40 rounded-md group"
            >
              <img src={logoUrl || logo} alt="SWUMed Logo" className="h-9 w-auto object-contain group-hover:scale-105 transition-transform duration-200" />
              {!isCollapsed && <p className="text-xs text-slate-400">{t('nav.terminalLabel')}</p>}
            </button>
          )}
          {!onToggle && (
            <div className="flex flex-1 items-center justify-center gap-2">
              <img src={logoUrl || logo} alt="SWUMed Logo" className="h-9 w-auto object-contain" />
              {!isCollapsed && <p className="text-xs text-slate-400">{t('nav.terminalLabel')}</p>}
            </div>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          {visibleLinks.map(({ key, to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/staff'}
              onClick={(event) => { handleNavClick(event, to); if (mobileOpen && onClose) onClose(); }}
              title={isCollapsed ? t(labelKey) : undefined}
              aria-label={isCollapsed ? t(labelKey) : undefined}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[#9D0A0E] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                } ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`
              }
            >
              <Icon />
              {!isCollapsed && <span>{t(labelKey)}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex h-[var(--bottom-bar-height)] shrink-0 items-center border-t border-slate-100 px-2">
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            title={isCollapsed ? t('nav.logout') : undefined}
            aria-label={isCollapsed ? t('nav.logout') : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-semibold text-[#9D0A0E] transition hover:bg-[#9D0A0E]/5 ${
              isCollapsed ? 'justify-center px-0' : 'justify-start'
            }`}
          >
            <LogoutIcon />
            {!isCollapsed && <span>{t('nav.logout')}</span>}
          </button>
        </div>

      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}

      {pendingTo && (
        <LeaveSettingsModal
          t={t}
          onStay={() => setPendingTo(null)}
          onLeave={handleLeaveConfirmed}
        />
      )}
      </aside>
    </>
  );
}

function TodayIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>; }
function HistoryIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 3" /></svg>; }
function SettingsIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>; }
function LogoutIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>; }
function ChevronIcon({ collapsed }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={collapsed ? 'rotate-180' : ''}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}