import React, { useEffect, useState } from 'react'
import {
  Megaphone,
  Users,
  Clock,
  BellRing,
  RefreshCw,
} from 'lucide-react'
import TrackerShell from './TrackerShell.jsx'

export default function WaitingScreen({ ticket }) {
  /*
   * ============================================================
   * REFRESH-SAFE ESTIMATED WAIT
   * ============================================================
   *
   * Instead of storing only "remaining seconds", we store the
   * actual target time when the estimated wait should reach 0.
   *
   * Example:
   *
   * Estimated wait = 10 minutes
   *
   * targetTime = current time + 10 minutes
   *
   * If the patient refreshes after 2 minutes:
   *
   * targetTime - current time = 8 minutes remaining
   *
   * Therefore the countdown does NOT restart from 10 minutes.
   */

  const ticketId =
    ticket.queueId ||
    ticket.queue_id ||
    ticket.id ||
    null

  const storageKey = ticketId
    ? `swumed_tracker_eta_${ticketId}`
    : null

  const [remainingSeconds, setRemainingSeconds] = useState(0)

  /*
   * Initialize the ETA only when we don't already have one
   * stored for this ticket.
   *
   * This prevents backend polling from resetting the countdown.
   */
useEffect(() => {
  if (!storageKey) {
    const minutes =
      Number(ticket.estimatedWaitMinutes) || 0

    const seconds = Math.max(
      0,
      Math.round(minutes * 60)
    )

    setRemainingSeconds(seconds)
    return
  }

  const activeStatus = String(
    ticket.status || ''
  ).toLowerCase()

  /*
   * Once the patient is called/serving/completed/skipped,
   * remove the waiting ETA.
   */
  if (
    activeStatus === 'called' ||
    activeStatus === 'serving' ||
    activeStatus === 'completed' ||
    activeStatus === 'skipped'
  ) {
    localStorage.removeItem(storageKey)
    setRemainingSeconds(0)
    return
  }

  try {
    const backendMinutes =
      Number(ticket.estimatedWaitMinutes) || 0

    const backendSeconds = Math.max(
      0,
      Math.round(backendMinutes * 60)
    )

    const storedTarget =
      localStorage.getItem(storageKey)

    /*
     * ========================================================
     * FIRST LOAD / REFRESH
     * ========================================================
     *
     * If an ETA already exists, preserve it so refreshing the
     * page does NOT restart the countdown.
     */
    if (storedTarget) {
      const targetTime = Number(storedTarget)

      if (
        Number.isFinite(targetTime) &&
        targetTime > 0
      ) {
        const secondsLeft = Math.max(
          0,
          Math.ceil(
            (targetTime - Date.now()) / 1000
          )
        )

        /*
         * ====================================================
         * IMPORTANT:
         *
         * If the backend's current estimate has changed
         * because people ahead changed, update the target.
         * ====================================================
         */
        const currentRemainingMinutes =
          secondsLeft / 60

        const difference =
          Math.abs(
            currentRemainingMinutes -
              backendMinutes
          )

        /*
         * Only adjust when the backend estimate has
         * materially changed.
         *
         * Small differences caused by the countdown itself
         * are ignored.
         */
        if (difference >= 0.25) {
          const newTargetTime =
            Date.now() +
            backendSeconds * 1000

          localStorage.setItem(
            storageKey,
            String(newTargetTime)
          )

          setRemainingSeconds(
            backendSeconds
          )

          return
        }

        /*
         * Backend estimate has not materially changed.
         * Keep the existing countdown.
         */
        setRemainingSeconds(secondsLeft)
        return
      }
    }

    /*
     * ========================================================
     * NO EXISTING ETA
     * ========================================================
     */

    const targetTime =
      Date.now() +
      backendSeconds * 1000

    localStorage.setItem(
      storageKey,
      String(targetTime)
    )

    setRemainingSeconds(
      backendSeconds
    )
  } catch (error) {
    console.warn(
      'Unable to save tracker ETA:',
      error
    )

    const minutes =
      Number(ticket.estimatedWaitMinutes) || 0

    const seconds = Math.max(
      0,
      Math.round(minutes * 60)
    )

    setRemainingSeconds(seconds)
  }
}, [
  storageKey,
  ticket.estimatedWaitMinutes,
  ticket.peopleAhead,
  ticket.status,
])
  /*
   * ============================================================
   * COUNTDOWN
   * ============================================================
   *
   * Every second we calculate the remaining time from the
   * stored absolute target time.
   *
   * This is more reliable than simply subtracting 1 every
   * second because browser tabs can pause/throttle timers.
   */
  useEffect(() => {
    const updateCountdown = () => {
      if (!storageKey) {
        setRemainingSeconds((previous) => {
          if (previous <= 0) {
            return 0
          }

          return previous - 1
        })

        return
      }

      try {
        const storedTarget =
          localStorage.getItem(storageKey)

        if (!storedTarget) {
          setRemainingSeconds(0)
          return
        }

        const targetTime = Number(storedTarget)

        if (!Number.isFinite(targetTime)) {
          setRemainingSeconds(0)
          return
        }

        const secondsLeft = Math.max(
          0,
          Math.ceil(
            (targetTime - Date.now()) / 1000
          )
        )

        setRemainingSeconds(secondsLeft)

        /*
         * Once the countdown reaches zero, remove the stored
         * target so it does not remain indefinitely.
         */
        if (secondsLeft <= 0) {
          localStorage.removeItem(storageKey)
        }
      } catch (error) {
        console.warn(
          'Unable to read tracker ETA:',
          error
        )
      }
    }

    /*
     * Run immediately instead of waiting one second.
     */
    updateCountdown()

    const timer = setInterval(
      updateCountdown,
      1000
    )

    return () => clearInterval(timer)
  }, [storageKey])

  /*
   * ============================================================
   * QUEUE PROGRESS
   * ============================================================
   */

  const total = Math.max(
    Number(ticket.totalAheadAtIssue) || 0,
    Number(ticket.peopleAhead) || 0
  )

  const peopleAhead =
    Number(ticket.peopleAhead) || 0

  let progressPct = 0

  if (
    ticket.status === 'called' ||
    ticket.status === 'serving'
  ) {
    progressPct = 100
  } else if (ticket.status === 'completed') {
    progressPct = 100
  } else if (total > 0) {
    const servedSoFar = Math.max(
      total - peopleAhead,
      0
    )

    progressPct = Math.min(
      100,
      Math.round(
        (servedSoFar / total) * 100
      )
    )
  }

  /*
   * ============================================================
   * PRIORITY TICKET STYLING
   * ============================================================
   */

  const isPriority = String(
    ticket.queueNumber || ''
  )
    .toUpperCase()
    .startsWith('P-')

  const numberColor = isPriority
    ? 'text-[#9D0A0E]'
    : 'text-[#1F2937]'

  /*
   * ============================================================
   * DEBUG LOGS
   * ============================================================
   */

  console.log(
    'WAITING SCREEN TICKET:',
    ticket
  )

  console.log(
    'WAITING SCREEN ESTIMATED WAIT:',
    ticket.estimatedWaitMinutes
  )

  console.log(
    'WAITING SCREEN CURRENT REMAINING:',
    remainingSeconds
  )

  console.log(
    'WAITING SCREEN AI PREDICTION:',
    ticket.aiPrediction?.predictedWaitingTime
  )

  /*
   * ============================================================
   * FORMAT WAIT TIME
   * ============================================================
   */

  const estimatedWaitText =
    formatWaitTime(remainingSeconds)

  function formatWaitTime(totalSeconds) {
    totalSeconds = Math.max(
      0,
      Math.round(
        Number(totalSeconds) || 0
      )
    )

    const hours = Math.floor(
      totalSeconds / 3600
    )

    const mins = Math.floor(
      (totalSeconds % 3600) / 60
    )

    const seconds =
      totalSeconds % 60

    if (hours > 0) {
      return mins > 0
        ? `${hours}h ${mins}m`
        : `${hours}h`
    }

    if (mins > 0) {
      return seconds > 0
        ? `${mins}m ${seconds}s`
        : `${mins}m`
    }

    return `${seconds}s`
  }

  return (
    <TrackerShell
      title={`${ticket.department} Waiting Area`}
      subtitle="Please wait for your number to be called on the screen."
      footer={
        <>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={12} />
            Data auto-updates every 5 seconds
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

          <p
            className={`mt-1 text-4xl font-extrabold sm:text-5xl ${numberColor}`}
          >
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
          <Megaphone
            size={16}
            className="text-[#1D4ED8]"
          />

          Now Serving
        </p>

        <span className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-1.5 text-sm font-bold text-[#1F2937]">
          {ticket.nowServing}
        </span>
      </div>

      {/* PEOPLE AHEAD + ESTIMATED WAIT */}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#E5E7EB] px-4 py-3 text-center">
          <Users
            size={16}
            className="mx-auto text-[#6B7280]"
          />

          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            People Ahead
          </p>

          <p className="mt-1 text-2xl font-bold text-[#1F2937]">
            {ticket.peopleAhead}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] px-4 py-3 text-center">
          <Clock
            size={16}
            className="mx-auto text-[#6B7280]"
          />

          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
            Estimated Wait
          </p>

          <p className="mt-1 text-xl font-bold whitespace-nowrap text-[#1F2937]">
            ~{estimatedWaitText}
          </p>
        </div>
      </div>

      {/* PROGRESS */}

      <div className="mt-4 rounded-xl border border-[#E5E7EB] px-4 py-4">
        <p className="text-sm font-bold text-[#1F2937]">
          Your Queue Progress
        </p>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#DBEAFE]">
          <div
            className="h-full rounded-full bg-[#1E3A8A] transition-all duration-700"
            style={{
              width: `${progressPct}%`,
            }}
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

            <span
              className={`font-semibold ${numberColor}`}
            >
              {ticket.queueNumber}
            </span>
          </p>
        </div>
      </div>
    </TrackerShell>
  )
}