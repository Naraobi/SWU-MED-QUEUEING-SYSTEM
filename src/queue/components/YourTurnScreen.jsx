import React from 'react'
import { BellRing } from 'lucide-react'
import logo from '../../assets/logo.png'

export default function YourTurnScreen({ ticket }) {
  // Priority tickets carry a "P-" prefix; they render in brand red.
  const isPriority = String(ticket.queueNumber || '')
    .toUpperCase()
    .startsWith('P-')

  const numberColor = isPriority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EAF3FB] px-4 py-8">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">

      <img
  src={logo}
  alt="SWU Med"
  className="mx-auto mb-5 h-14 w-auto object-contain"
/>

        <div className="overflow-hidden rounded-2xl border-2 border-[#9D0A0E] bg-white shadow-lg">

          {/* CALL BANNER */}

          <div className="flex items-center justify-center gap-2 bg-[#9D0A0E] px-5 py-3 text-center">
            <BellRing size={16} className="shrink-0 text-white" />

            <p className="text-sm font-bold uppercase tracking-wide text-white sm:text-base">
              It&rsquo;s your turn!
            </p>
          </div>

          <div className="px-5 py-6 text-center sm:px-8">

            {/* TICKET NUMBER */}

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                Ticket Number
              </p>

              <p className={`mt-1 text-4xl font-extrabold sm:text-5xl ${numberColor}`}>
                {ticket.queueNumber}
              </p>
            </div>

            <span className="mt-3 inline-block rounded-full bg-[#EBF3FE] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
              {ticket.department}
            </span>

            {/* DIRECTION */}

            <p className="mt-4 text-sm leading-6 text-[#4B5563]">
              Please proceed to{' '}
              <span className="font-semibold text-[#1F2937]">
                {ticket.terminal}
              </span>
              .
            </p>

            {/* NOW SERVING */}

            <p className="mt-5 text-sm font-bold text-[#1F2937]">
              Now Serving {ticket.nowServing || ticket.queueNumber}
            </p>

            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[#9D0A0E]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#9D0A0E]"
              />
              Your queue is being served
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}