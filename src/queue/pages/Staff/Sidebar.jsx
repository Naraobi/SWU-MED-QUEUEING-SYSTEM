import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/Authcontext';
import { canAccessStaffPage } from '../../services/accessControl';
import LogoutModal from '../../components/modals/LogoutModal.jsx';
import logo from '../../../assets/logo.png';

const LINKS = [
  { key: 'today', to: '/staff', label: "Today's Queue", icon: TodayIcon },
  { key: 'history', to: '/staff/history', label: 'Queue History', icon: HistoryIcon },
];

export default function Sidebar() {
  const [showLogout, setShowLogout] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const visibleLinks = LINKS.filter(({ key }) => canAccessStaffPage(user, key));

  // Keep restricted staff from remaining on Today's Queue if their permissions change.
  React.useEffect(() => {
    if (user && !canAccessStaffPage(user, 'today') && canAccessStaffPage(user, 'history')) {
      navigate('/staff/history', { replace: true });
    }
  }, [user, navigate]);

  return (
    <aside className="staff-sidebar sticky top-0 flex h-screen flex-shrink-0 flex-col border-r border-slate-200 bg-white z-40">
      <div className="flex h-[74px] flex-col items-center justify-center border-b border-slate-200 px-3 text-center">
        <img src={logo} alt="SWUMed Logo" className="h-9 w-auto object-contain" />
        <p className="mt-0.5 text-[9px] font-medium text-slate-400">Queue Terminal</p>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-7">
        {visibleLinks.map(({ key, to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/staff'}
            className={({ isActive }) =>
              `flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide transition ${
                isActive
                  ? 'bg-[#851010] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <button
          type="button"
          onClick={() => setShowLogout(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 cursor-pointer"
        >
          <LogoutIcon />
          <span>Logout</span>
        </button>
      </div>

      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}
    </aside>
  );
}

function TodayIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>; }
function HistoryIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 3" /></svg>; }
function LogoutIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>; }