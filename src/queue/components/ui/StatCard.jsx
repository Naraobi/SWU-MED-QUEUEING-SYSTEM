import React from 'react'

export default function StatCard({ label, value }) {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-card">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400">{label.toUpperCase()}</p>
      <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
    </div>
  )
}
