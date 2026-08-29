import React from 'react'
import { useQueue } from '../../context/QueueContext.jsx'

const ICONS = {
  performance: { bg: 'bg-blue-100', color: 'text-blue-600', glyph: '🏆' },
  queue: { bg: 'bg-slate-100', color: 'text-slate-600', glyph: '👥' },
  system: { bg: 'bg-blue-100', color: 'text-blue-600', glyph: 'ℹ️' },
  urgent: { bg: 'bg-rose-100', color: 'text-rose-600', glyph: '⚠️' },
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useQueue()

  return (
    <div className="pointer-events-none absolute right-full top-1 mr-3 z-[100] flex w-80 flex-col gap-3">
        {toasts.map((t) => {
          const icon = ICONS[t.type] || ICONS.system
          return (
            <div
              key={t.toastId}
              layout
              className="pointer-events-auto flex items-start gap-3 rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-xl"
            >
              <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${icon.bg} ${icon.color}`}>
                {icon.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.message}</p>
              </div>
              <button
                onClick={() => dismissToast(t.toastId)}
                className="flex-shrink-0 text-slate-300 hover:text-slate-500"
              >
                ✕
              </button>
            </div>
          )
        })}
    </div>
  )
}
