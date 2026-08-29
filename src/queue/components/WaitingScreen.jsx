import React from 'react'
import TrackerShell from './TrackerShell.jsx'

export default function WaitingScreen({ ticket }) {
  const total = ticket.totalAheadAtIssue || Math.max(ticket.peopleAhead, 1)
  const servedSoFar = total - ticket.peopleAhead
  const progressPct = Math.min(100, Math.round((servedSoFar / total) * 100))

  return (
    <TrackerShell
      title="Laboratory Services Waiting Area"
      subtitle="Please wait for your number to be called on the screen."
      footer={
        <>
          ⟲ Data auto-updates every 30 seconds
          <br />
          Please do not close this window or lock your screen.
        </>
      }
    >
      <div className="overflow-hidden rounded-xl border border-blue-100">
        <div className="h-1.5 w-full bg-brand-blue" />
        <div className="px-5 py-4 text-center">
          <p className="text-xs font-semibold tracking-wide text-brand-blue">YOUR TICKET NUMBER</p>
          <p className="mt-1 text-4xl font-extrabold text-slate-800">{ticket.queueNumber}</p>
          <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-brand-blue">
            🔔 We will notify you when it's time.
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">📢 Now Serving</p>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-800">
          {ticket.nowServing}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 px-4 py-3 text-center">
          <p className="text-xs font-medium text-slate-400">👤 PEOPLE AHEAD</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{ticket.peopleAhead}</p>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-3 text-center">
          <p className="text-xs font-medium text-slate-400">🕐 ESTIMATED WAIT</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{ticket.estimatedWaitMinutes} min</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 px-4 py-4">
        <p className="text-sm font-semibold text-slate-800">Your Queue Progress</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-blue transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <p className="text-slate-400">
            Now Serving <span className="font-semibold text-slate-600">{ticket.nowServing}</span>
          </p>
          <p className="text-slate-400">
            Your Number <span className="font-semibold text-brand-blue">{ticket.queueNumber}</span>
          </p>
        </div>
      </div>
    </TrackerShell>
  )
}
