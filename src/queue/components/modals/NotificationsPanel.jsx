import React, { useState } from 'react'
import { useQueue } from '../../context/QueueContext.jsx'

const ICONS = {
  performance: { bg: 'bg-blue-100', color: 'text-blue-600', glyph: '🏆' },
  queue: { bg: 'bg-slate-100', color: 'text-slate-600', glyph: '👥' },
  system: { bg: 'bg-blue-100', color: 'text-blue-600', glyph: 'ℹ️' },
  urgent: { bg: 'bg-rose-100', color: 'text-rose-600', glyph: '⚠️' },
}

export default function NotificationsPanel({ onClose }) {
  const { notifications, markAllNotificationsRead } = useQueue()
  const [showAll, setShowAll] = useState(false)

  const notificationRows = (expanded = false) => (
    <div className={`${expanded ? 'max-h-[70vh]' : 'max-h-96'} divide-y divide-slate-100 overflow-y-auto`}>
      {notifications.map((n) => {
        const icon = ICONS[n.type] || ICONS.system
        return (
          <div key={n.id} className={`flex gap-3 px-4 py-3 ${n.unread ? 'bg-blue-50/40' : ''}`}>
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${icon.bg} ${icon.color}`}>
              {icon.glyph}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                <span className="flex-shrink-0 text-[11px] text-slate-400">{n.time}</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.message}</p>
              {n.action && (
                <button className="mt-2 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  {n.action}
                </button>
              )}
            </div>
            {n.unread && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
          </div>
        )
      })}
      {notifications.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
      )}
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="font-semibold text-slate-800">Notifications</p>
          <button onClick={markAllNotificationsRead} className="text-xs font-medium text-brand-blue hover:underline">
            Mark all as read
          </button>
        </div>

        {notificationRows()}

        <div className="border-t border-slate-100 px-4 py-2 text-center">
          <button onClick={() => setShowAll(true)} className="text-xs font-medium text-slate-500 hover:underline">
            View All Notifications
          </button>
        </div>
      </div>

      {showAll && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40">
          <section className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-hidden border-l border-slate-200 bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">All Notifications</h2>
                <p className="mt-0.5 text-xs text-slate-400">Your queue activity and system updates.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={markAllNotificationsRead} className="text-xs font-medium text-brand-blue hover:underline">
                  Mark all as read
                </button>
                <button onClick={() => setShowAll(false)} className="text-lg leading-none text-slate-400 hover:text-slate-700" aria-label="Close notifications">
                  ×
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-hidden">
              {notificationRows(true)}
            </div>
            <footer className="flex justify-end border-t border-slate-100 px-5 py-3">
              <button onClick={onClose} className="rounded-md bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800">
                Done
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
