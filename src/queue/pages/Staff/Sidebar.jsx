import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import LogoutModal from '../../components/modals/LogoutModal.jsx'
import logo from '../../../assets/logo.png'

const links = [
  { to: '/staff', label: "Today's Queue", icon: TodayIcon },
  { to: '/staff/history', label: 'Queue History', icon: HistoryIcon },
]

export default function Sidebar() {
  const [showLogout, setShowLogout] = useState(false)

  return (
<aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
  {/* BRAND & LOGO HEADER */}
  <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
    <img 
      src={logo} 
      alt="SWUMed Logo" 
      className="h-9 w-auto object-contain" 
    />
    <div>
      <p className="text-xs font-medium text-slate-400">Queue Terminal</p>
    </div>
  </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/staff'}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border border-blue-200 bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-3 py-4">
        <button
          onClick={() => setShowLogout(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          <LogoutIcon />
          Logout
        </button>
      </div>

      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}
    </aside>
  )
}

function TodayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}