import React, { useState, useEffect } from 'react'
import NotificationsPanel from '../../components/modals/NotificationsPanel.jsx'
import { useQueue } from '../../context/QueueContext.jsx'
import ToastContainer from '../../components/ui/Toast.jsx'
import { useAuth } from '../../services/Authcontext.jsx'

const STAFF_TERMINAL_KEY = 'swumed_staff_terminal';

export default function Topbar({ title, subtitle }) {
  const [online, setOnline] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedTerminal, setSelectedTerminal] = useState(null)

  const { unreadCount } = useQueue()
  const { user } = useAuth()

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STAFF_TERMINAL_KEY);
      if (!raw) {
        setSelectedTerminal(null);
        return;
      }

      const parsed = JSON.parse(raw);
      setSelectedTerminal(parsed ?? null);
    } catch {
      setSelectedTerminal(null);
    }
  }, [])

  const staffName = `${user?.first_name || 'Ruth'} ${
    user?.last_name || 'Abella'
  }`

  const initials = `${user?.first_name?.[0] || 'R'}${
    user?.last_name?.[0] || 'A'
  }`

  const department =
    subtitle?.match(/department: (.*?) \(/)?.[1] ||
    user?.department ||
    'Billing Department'

  return (
    <div className="flex h-[74px] min-h-[74px] w-full items-center justify-between border-b border-slate-200 bg-white">

      {/* LEFT SIDE
          Intentionally pushed farther from the sidebar
          to match the reference design.
      */}
      <div className="min-w-0 pl-[50px]">
        <h1 className="truncate text-[18px] font-bold text-slate-800">
          Staff · {department}
        </h1>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex flex-shrink-0 items-center gap-2 pr-4">

        {/* Notification */}
        <div className="relative">
          <button
            onClick={() => setShowPanel((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50"
          >
            <BellIcon />

            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showPanel && (
            <NotificationsPanel
              onClose={() => setShowPanel(false)}
            />
          )}

          <ToastContainer />
        </div>

        {/* Terminal */}
        <div className="hidden items-center gap-1 rounded-full border border-slate-300 px-2 py-1 text-[9px] text-slate-500 sm:flex">
          <span>{selectedTerminal?.name || 'Select terminal'}</span>

          <span className="h-1.5 w-1.5 rounded-full bg-[#0067a8]" />

          <span>Online</span>
        </div>

        {/* Staff */}
        <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex">

          <div className="text-right leading-tight">
            <p className="text-[8px] font-bold uppercase text-slate-500">
              Staff
            </p>

            <p className="text-[8px] text-slate-500">
              {staffName}
            </p>
          </div>

          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dce8f9] text-[9px] font-bold text-[#315a91]">
            {initials}
          </span>

        </div>

        {/* Online state */}
        <button
          onClick={() => setOnline((v) => !v)}
          className="hidden"
          aria-label="Toggle online status"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              online ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
        </button>

      </div>
    </div>
  )
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
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