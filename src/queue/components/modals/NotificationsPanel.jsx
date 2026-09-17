import React, { useState } from 'react'
import { useQueue } from '../../context/QueueContext.jsx'

// ============================================================
// ICON MAP — matches exactly what's shown in the design
// ============================================================

function NotifIcon({ type }) {
  const base = 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F3F5]'

  // Performance Recognition — trophy / award icon
  if (type === 'performance') return (
    <div className={base}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
        <path d="M6 9H3a1 1 0 0 0-1 1v1a5 5 0 0 0 5 5h0M18 9h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h0" strokeLinecap="round"/>
        <path d="M12 17v3M9 20h6" strokeLinecap="round"/>
        <path d="M7 4h10l-1 9a4 4 0 0 1-8 0L7 4z"/>
      </svg>
    </div>
  )

  // Queue Update — circular sync / refresh arrows
  if (type === 'queue') return (
    <div className={base}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  // System Notice — megaphone / announcement icon
  if (type === 'system') return (
    <div className={base}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
        <path d="M3 11v2a2 2 0 0 0 2 2h1l2 4h0a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 5c1.5 1 2.5 3 2.5 5S19.5 14 18 15L9 13V7l9-2z" strokeLinejoin="round"/>
        <path d="M9 7H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  // Shift Target Reached — checkmark in circle
  if (type === 'target') return (
    <div className={base}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  // Terminal Maintenance — settings / gear with clock hands
  if (type === 'maintenance') return (
    <div className={base}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round"/>
      </svg>
    </div>
  )

  // Urgent / fallback — exclamation triangle
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fce8e8]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9D0A0E" strokeWidth="1.8">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round"/>
      </svg>
    </div>
  )
}



// ============================================================
// TABS
// ============================================================

const TABS = ['All', 'Queue', 'System']

// ============================================================
// COMPONENT
// ============================================================

export default function NotificationsPanel({ onClose }) {
  const { notifications, markAllNotificationsRead } = useQueue()
  const [activeTab, setActiveTab] = useState('All')

  const filtered = notifications.filter((n) => {
    if (activeTab === 'All')    return true
    if (activeTab === 'Queue')  return ['queue', 'performance', 'target'].includes(n.type)
    if (activeTab === 'System') return ['system', 'urgent', 'maintenance'].includes(n.type)
    return true
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] flex-col overflow-hidden border-l border-[#E5E7EB] bg-white shadow-2xl">

        {/* ================================================
            HEADER
        ================================================ */}
        <div className="flex items-start justify-between px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-[#1F2937]">Notifications</h2>
            <p className="mt-0.5 text-[9px] text-[#4B5563]">
              Stay updated with your queue activity and system notices.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[#4B5563] hover:bg-[#F1F3F5] transition"
            aria-label="Close"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ================================================
            TABS
        ================================================ */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5">
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative py-2.5 px-3 text-[10px] font-semibold transition-colors ${
                  activeTab === tab
                    ? "text-[#1F2937] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#9D0A0E] after:content-['']"
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={markAllNotificationsRead}
            className="text-[9px] font-semibold text-[#9D0A0E] hover:underline"
          >
            Mark all as read
          </button>
        </div>

        {/* ================================================
            NOTIFICATION LIST
        ================================================ */}
        <div className="flex-1 divide-y divide-[#E5E7EB] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-[10px] text-[#4B5563]">No notifications yet.</p>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 px-5 py-3.5 ${n.unread ? 'bg-[#F8F9FA]' : ''}`}
              >
                {/* Icon */}
                <NotifIcon type={n.type} />

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-[#1F2937]">{n.title}</p>
                    <span
                      className="flex-shrink-0 text-[8px] font-medium"
                      style={{ color: n.unread ? '#9D0A0E' : '#4B5563' }}
                    >
                      {n.time}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-[#4B5563]">{n.message}</p>
                  {n.action && (
                    <button className="mt-1.5 rounded-md border border-[#E5E7EB] px-2.5 py-1 text-[8px] font-medium text-[#1F2937] hover:bg-[#F1F3F5] transition">
                      {n.action}
                    </button>
                  )}
                </div>

                {/* Unread dot */}
                {n.unread && (
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#9D0A0E]" />
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </>
  )
}
