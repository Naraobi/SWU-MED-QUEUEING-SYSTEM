import React from 'react'

export default function TrackerShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-card sm:max-w-lg md:max-w-xl">
        <div className="border-b border-slate-100 px-6 pt-6 pb-4 text-center">
          <p className="text-2xl font-bold">
            <span className="text-brand-red">SWU</span>
            <span className="text-slate-800">Med</span>
          </p>
          {title && <p className="mt-1 text-sm font-semibold text-slate-700">{title}</p>}
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>

        <div className="px-6 py-6">{children}</div>

        {footer && (
          <div className="border-t border-slate-100 px-6 py-3 text-center text-[11px] leading-relaxed text-slate-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
