import React from 'react'

const STYLES = {
  Completed: 'bg-emerald-50 text-emerald-600',
  Skipped: 'bg-rose-50 text-rose-600',
  Serving: 'bg-blue-50 text-blue-700',
  Waiting: 'bg-amber-50 text-amber-600',
}

export default function Badge({ children }) {
  const style = STYLES[children] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
