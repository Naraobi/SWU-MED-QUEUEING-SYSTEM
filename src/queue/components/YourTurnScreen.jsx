import React from 'react'

export default function YourTurnScreen({ ticket }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border-2 border-rose-300 bg-gradient-to-b from-white to-blue-50/40 p-8 text-center shadow-xl sm:max-w-lg">
        <p className="text-xl font-bold">
          <span className="text-brand-red">SWU</span>
          <span className="text-slate-800">Med</span>
        </p>

        <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center text-3xl animate-pulse">
          🔔
        </div>

        <h1 className="mt-2 text-2xl font-extrabold text-slate-800">IT'S YOUR TURN!</h1>

        <div className="mt-5 rounded-xl bg-blue-50 px-5 py-4">
          <p className="text-xs font-semibold tracking-wide text-slate-400">TICKET NUMBER</p>
          <p className="mt-1 text-4xl font-extrabold text-brand-blue">{ticket.queueNumber}</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
            👤 {ticket.department}
          </span>
        </div>

        <p className="mt-5 text-sm text-slate-600">
          Please proceed to the <span className="font-semibold text-brand-blue">{ticket.terminal}</span>.
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Now Serving {ticket.queueNumber}
        </div>
        <p className="mt-1 text-xs text-slate-400">Your queue is being served</p>
      </div>
    </div>
  )
}
