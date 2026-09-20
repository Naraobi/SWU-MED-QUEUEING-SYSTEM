import React from 'react'
import { Megaphone, Users, Clock, BellRing, RefreshCw } from 'lucide-react'
import TrackerShell from './TrackerShell.jsx'

export default function WaitingScreen({ ticket }) {
  const total = ticket.totalAheadAtIssue || Math.max(ticket.peopleAhead, 1)
  const servedSoFar = total - ticket.peopleAhead
  const progressPct = Math.min(100, Math.round((servedSoFar / total) * 100))

  // Priority tickets carry a "P-" prefix; they render in brand red.
  const isPriority = String(ticket.queueNumber || '')
    .toUpperCase()
    .startsWith('P-')

  const numberColor = isPriority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'

  return (
    <TrackerShell
      title={`${ticket.department} Waiting Area`}
      subtitle="Please wait for your number to be called on the screen."
      footer={
        <>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={12} />
            Data auto-updates every 30 seconds
          </span>
          <br />
          Please do not close this window or lock your screen.
        </>
      }
    >
      {/* TICKET NUMBER */}

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] shadow-sm">
        <div className="h-1.5 w-full bg-[#9D0A0E]" />

        <div className="px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-[#9D0A0E]">
            Your Ticket Number
          </p>

          <p className={`mt-1 text-4xl font-extrabold sm:text-5xl ${numberColor}`}>
            {ticket.queueNumber}
          </p>

          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#EBF3FE] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
            <BellRing size={12} />
            We will notify you when it&rsquo;s time.
          </span>
        </div>
      </div>

      {/* NOW SERVING */}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#F1F5F9] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
          <Megaphone size={16} className="text-[#1D4ED8]" />
          Now Serving
        </p>

        <span className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-1.5 text-sm font-bold text-[#1F2937]">
          {ticket.nowServing}
        </span>
      </div>

      {/* PEOPLE AHEAD + ESTIMATED WAIT */}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#E5E7EB] px-4 py-3 text-center">
          <Users size={16} className="mx-auto text-[#6B7280]" />

          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            People Ahead
          </p>

          <p className="mt-1 text-2xl font-bold text-[#1F2937]">
            {ticket.peopleAhead}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] px-4 py-3 text-center">
          <Clock size={16} className="mx-auto text-[#6B7280]" />

          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Estimated Wait
          </p>

          <p className="mt-1 text-2xl font-bold text-[#1F2937]">
            ~{ticket.estimatedWaitMinutes}
            <span className="ml-0.5 text-xs font-medium text-[#6B7280]">min</span>
          </p>
        </div>
      </div>

      {/* PROGRESS */}

      <div className="mt-4 rounded-xl border border-[#E5E7EB] px-4 py-4">
        <p className="text-sm font-bold text-[#1F2937]">Your Queue Progress</p>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#DBEAFE]">
          <div
            className="h-full rounded-full bg-[#1E3A8A] transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-2 flex items-start justify-between gap-3 text-xs">
          <p className="text-[#6B7280]">
            Now Serving
            <br />
            <span className="font-semibold text-[#1F2937]">
              {ticket.nowServing}
            </span>
          </p>

          <p className="text-right text-[#6B7280]">
            Your Number
            <br />
            <span className={`font-semibold ${numberColor}`}>
              {ticket.queueNumber}
            </span>
          </p>
        </div>
      </div>
    </TrackerShell>
  )
}