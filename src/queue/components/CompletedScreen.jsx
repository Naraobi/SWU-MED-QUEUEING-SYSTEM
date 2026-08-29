import React from 'react'
import TrackerShell from './TrackerShell.jsx'

export default function CompletedScreen({ ticket }) {
  return (
    <TrackerShell title="Patient Queue Tracker" footer="Thank you for using SWUMed Hospital Queue Tracker.">
      <div className="rounded-xl border border-slate-200 px-6 py-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600 shadow-sm">
          ✓
        </div>
        <h1 className="mt-3 text-xl font-bold text-slate-800">Queue Completed</h1>
        <p className="mt-1 text-sm text-slate-500">Your transaction has been completed.</p>

        <hr className="my-5 border-slate-100" />

        <p className="text-xs font-semibold tracking-wide text-slate-400">SERVICE</p>
        <p className="mt-1 text-base font-semibold text-slate-800">{ticket.department}</p>

        <p className="mt-4 text-xs font-semibold tracking-wide text-slate-400">QUEUE NUMBER</p>
        <div className="mt-1 rounded-lg bg-blue-50 py-2.5 text-2xl font-extrabold text-brand-blue">
          {ticket.queueNumber}
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Transaction completed
        </div>
      </div>
    </TrackerShell>
  )
}
