import React from 'react'
import { Check } from 'lucide-react'
import TrackerShell from './TrackerShell.jsx'

export default function CompletedScreen({ ticket }) {
  // Priority tickets carry a "P-" prefix; they render in brand red.
  const isPriority = String(ticket.queueNumber || '')
    .toUpperCase()
    .startsWith('P-')

  const numberColor = isPriority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'

  return (
    <TrackerShell
      title="Patient Queue Tracker"
      footer="Thank you for using SWUMed Hospital Queue Tracker."
    >
      <div className="rounded-xl border border-[#E5E7EB] px-6 py-7 text-center shadow-sm">

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check size={22} strokeWidth={3} />
        </div>

        <h1 className="mt-4 text-xl font-bold text-[#1F2937] sm:text-2xl">
          Queue Completed
        </h1>

        <p className="mt-1 text-sm text-[#6B7280]">
          Your transaction has been completed.
        </p>

        <hr className="my-5 border-[#E5E7EB]" />

        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          Service
        </p>

        <p className="mt-1 text-base font-bold text-[#1F2937]">
          {ticket.department}
        </p>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          Queue Number
        </p>

        <div className={`mt-1.5 rounded-lg bg-[#EEF2FF] py-3 text-2xl font-extrabold sm:text-3xl ${numberColor}`}>
          {ticket.queueNumber}
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-emerald-500"
          />
          Transaction completed
        </div>

      </div>
    </TrackerShell>
  )
}