import React, { useState } from 'react'
import NotificationsPanel from '../../components/modals/NotificationsPanel.jsx'
import { useQueue } from '../../context/QueueContext.jsx'
import ToastContainer from '../../components/ui/Toast.jsx'

export default function Topbar({ title, subtitle }) {
  const [online, setOnline] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const { unreadCount } = useQueue()

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowPanel((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <BellIcon />

            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showPanel && (
            <NotificationsPanel onClose={() => setShowPanel(false)} />
          )}

          <ToastContainer />
        </div>

        {/* Online status */}
        <button
          onClick={() => setOnline((v) => !v)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
            online
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              online ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          {online ? 'Online' : 'Offline'}
        </button>

      </div>
    </div>
  )
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}
