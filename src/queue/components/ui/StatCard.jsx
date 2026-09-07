import React from 'react'
import { CheckCircle2, History, Users, UserRound } from 'lucide-react'

const ICONS = {
  Waiting: Users,
  'Currently Serving': UserRound,
  Completed: CheckCircle2,
  Skipped: History,
}

export default function StatCard({ label, value }) {
  const Icon = ICONS[label]
  return (
    <div className="relative flex-1 rounded-lg border border-[#72acd6] bg-white px-5 py-5 shadow-card">
      <p className="text-[11px] font-semibold tracking-wide text-slate-500">{label.toUpperCase()}</p>
      <p className="mt-2 text-3xl font-bold leading-none text-slate-800">{value}</p>
      {Icon && <Icon size={20} strokeWidth={1.8} className="absolute right-4 top-4 text-slate-500" />}
    </div>
  )
}
