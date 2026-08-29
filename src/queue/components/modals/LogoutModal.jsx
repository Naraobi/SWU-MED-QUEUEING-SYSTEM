import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../services/Authcontext.jsx'

export default function LogoutModal({ onClose }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/superadmin/login', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-800">Log Out?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Are you sure you want to log out of the Staff Terminal? You will need to sign in again to access
          your assigned terminal.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
