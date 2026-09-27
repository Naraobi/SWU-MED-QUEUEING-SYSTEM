import React, {
  useEffect,
  useRef,
  useState,
} from 'react'

import { BellRing } from 'lucide-react'

import * as api from '../../services/api'

import WaitingScreen from '../../components/WaitingScreen.jsx'

import YourTurnScreen from '../../components/YourTurnScreen.jsx'

import CompletedScreen from '../../components/CompletedScreen.jsx'

import logo from '../../../assets/logo.png'

const POLL_INTERVAL_MS = 5000

/*
 * PREVIEW MODE — for checking the screens without a live ticket.
 *
 *   /tracker?preview=waiting
 *   /tracker?preview=turn
 *   /tracker?preview=completed
 *
 * Add &type=regular to see a regular (non-priority) ticket.
 *
 * Sample data only; never touches the API.
 */
const PREVIEW_STATUS = {
  waiting: 'waiting',
  turn: 'serving',
  completed: 'completed',
}

function buildPreviewTicket(mode, regular) {
  return {
    status: PREVIEW_STATUS[mode],

    queueNumber:
      regular
        ? 'BP-022'
        : 'P-BP-021',

    isPriority:
      !regular,

    department:
      'Billing / Payment',

    terminal:
      'Terminal 2',

    nowServing:
      'BP-016',

    peopleAhead:
      5,

    estimatedWaitMinutes:
      36,

    totalAheadAtIssue:
      10,
  }
}

/*
 * Notification sound
 *
 * Uses the browser Web Audio API, so no separate
 * sound file is required in the project.
 */
function playTurnNotificationSound() {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext

    if (!AudioContext) {
      return
    }

    const audioContext =
      new AudioContext()

    const playTone = (
      frequency,
      startTime,
      duration
    ) => {
      const oscillator =
        audioContext.createOscillator()

      const gainNode =
        audioContext.createGain()

      oscillator.type =
        'sine'

      oscillator.frequency.setValueAtTime(
        frequency,
        startTime
      )

      gainNode.gain.setValueAtTime(
        0.0001,
        startTime
      )

      gainNode.gain.exponentialRampToValueAtTime(
        0.25,
        startTime + 0.02
      )

      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + duration
      )

      oscillator.connect(
        gainNode
      )

      gainNode.connect(
        audioContext.destination
      )

      oscillator.start(
        startTime
      )

      oscillator.stop(
        startTime + duration
      )
    }

    const startTime =
      audioContext.currentTime

    /*
     * First notification tone.
     */
    playTone(
      880,
      startTime,
      0.18
    )

    /*
     * Second notification tone.
     */
    playTone(
      1175,
      startTime + 0.22,
      0.22
    )

    /*
     * Close the audio context after
     * the notification has finished.
     */
    setTimeout(() => {
      audioContext
        .close()
        .catch(() => {})
    }, 1000)

  } catch (error) {
    console.warn(
      'Unable to play turn notification sound:',
      error
    )
  }
}

export default function TrackerPage() {

  /* ==========================================================================
     STATE
     ========================================================================== */

  const [ticket, setTicket] =
    useState(null)

  const [error, setError] =
    useState(null)

  /*
   * Controls the temporary on-screen
   * notification.
   */
  const [
    turnNotification,
    setTurnNotification,
  ] = useState(false)

  /* ==========================================================================
     TRACKING REFS
     ========================================================================== */

  /*
   * Stores the previous ticket status.
   *
   * Used to detect:
   *
   * waiting → called
   *
   * waiting → serving
   */
  const previousStatusRef =
    useRef(null)

  /*
   * Stores the previous notification/call marker.
   *
   * This allows the Tracker to detect a Recall
   * even when the ticket status does not change.
   *
   * Example:
   *
   * notificationVersion = 1
   *
   * Staff presses Recall
   *
   * notificationVersion = 2
   *
   * The Tracker sees the change and alerts
   * the patient again.
   */
  const previousCallMarkerRef =
    useRef(null)

  /*
   * Prevents the first API response from
   * triggering a notification.
   *
   * This is important if the patient opens
   * the Tracker after they have already been
   * called.
   */
  const initializedRef =
    useRef(false)

  /*
   * Stores the notification timeout so
   * it can be cleaned up properly.
   */
  const notificationTimeoutRef =
    useRef(null)

  /* ==========================================================================
     URL PARAMETERS
     ========================================================================== */

  /*
   * The QR code contains the unique queue_id UUID.
   */
  const params =
    new URLSearchParams(
      window.location.search
    )

  const ticketId =
    params.get('ticket')

  const previewMode =
    PREVIEW_STATUS[
      params.get('preview')
    ]
      ? params.get('preview')
      : null

  const previewTicket =
    previewMode
      ? buildPreviewTicket(
          previewMode,
          params.get('type') === 'regular'
        )
      : null

  /* ==========================================================================
     TURN NOTIFICATION HELPER
     ========================================================================== */

  /*
   * Shows the notification and plays the
   * notification sound.
   *
   * This helper is used for BOTH:
   *
   * 1. waiting → called/serving
   * 2. Recall
   *
   * Keeping the behavior in one function
   * prevents duplicated notification logic.
   */
  const triggerTurnNotification =
    () => {

      /*
       * Show the notification.
       */
      setTurnNotification(true)

      /*
       * Play the notification sound.
       */
      playTurnNotificationSound()

      /*
       * Clear the previous timeout if
       * another notification happened
       * before the previous one disappeared.
       */
      if (
        notificationTimeoutRef.current
      ) {
        clearTimeout(
          notificationTimeoutRef.current
        )
      }

      /*
       * Keep the notification visible
       * for 6 seconds.
       */
      notificationTimeoutRef.current =
        setTimeout(() => {
          setTurnNotification(false)
        }, 6000)
    }

  /* ==========================================================================
     CLEANUP
     ========================================================================== */

  /*
   * Clean up the notification timeout
   * when the component is unmounted.
   */
  useEffect(() => {

    return () => {

      if (
        notificationTimeoutRef.current
      ) {
        clearTimeout(
          notificationTimeoutRef.current
        )
      }

    }

  }, [])

  /* ==========================================================================
     POLL TICKET STATUS
     ========================================================================== */

  useEffect(() => {

    let cancelled = false

    const load = async () => {

      /*
       * Preview mode does not contact
       * the API.
       */
      if (previewMode) {
        return
      }

      /*
       * No ticket ID in the QR URL.
       */
      if (!ticketId) {

        setError(
          'No ticket number was provided.'
        )

        return
      }

      try {

        const result =
          await api.fetchTicketStatus(
            ticketId
          )

        if (cancelled) {
          return
        }

        /*
         * API returned an error.
         */
        if (result.error) {

          setError(
            result.error
          )

          setTicket(null)

          return
        }

        /* ====================================================================
           CURRENT STATUS
           ==================================================================== */

        const currentStatus =
          result.status

        /*
         * Determine whether the ticket
         * is currently called or being served.
         */
        const isNowCalled =
          currentStatus === 'called' ||
          currentStatus === 'serving'

        /*
         * Determine whether the previous
         * state was waiting.
         */
        const wasWaiting =
          previousStatusRef.current ===
          'waiting'

        /* ====================================================================
           CALL / RECALL MARKER
           ==================================================================== */

        /*
         * The backend should return ONE of these
         * values.
         *
         * Preferred:
         *
         *   notificationVersion
         *
         * Other supported names are included so
         * the Tracker is tolerant of the exact
         * backend naming.
         *
         * Recommended backend value:
         *
         *   1 = first call
         *   2 = first recall
         *   3 = second recall
         *   etc.
         */
        const currentCallMarker =
          result.notificationVersion ??
          result.notification_version ??
          result.callSequence ??
          result.call_sequence ??
          result.recallCount ??
          result.recall_count ??
          null

        /*
         * Detect whether the backend marker
         * changed since the previous poll.
         *
         * This is what makes Recall work.
         */
        const callMarkerChanged =
          initializedRef.current &&
          currentCallMarker !== null &&
          previousCallMarkerRef.current !== null &&
          String(
            currentCallMarker
          ) !==
            String(
              previousCallMarkerRef.current
            )

        /* ====================================================================
           DETERMINE WHETHER TO NOTIFY
           ==================================================================== */

        /*
         * NORMAL CALL
         *
         * waiting → called/serving
         */
        const normalCallDetected =
          initializedRef.current &&
          wasWaiting &&
          isNowCalled

        /*
         * RECALL
         *
         * The status may remain:
         *
         * serving → serving
         *
         * but the notification marker changes:
         *
         * 1 → 2
         */
        const recallDetected =
          initializedRef.current &&
          isNowCalled &&
          callMarkerChanged

        /*
         * Trigger the notification if either
         * a normal call OR a recall happened.
         */
        if (
          normalCallDetected ||
          recallDetected
        ) {

          triggerTurnNotification()

        }

        /* ====================================================================
           SAVE CURRENT VALUES FOR NEXT POLL
           ==================================================================== */

        /*
         * Save the current status.
         */
        previousStatusRef.current =
          currentStatus

        /*
         * Save the current call/recall marker.
         */
        previousCallMarkerRef.current =
          currentCallMarker

        /*
         * The first successful response
         * establishes the initial state.
         *
         * Therefore, if the Tracker is opened
         * while the patient is already serving,
         * it will NOT immediately make a sound.
         */
        initializedRef.current =
          true

        setError(null)

        setTicket(result)

      } catch (err) {

        if (!cancelled) {

          setError(
            err.message ||
              'Failed to retrieve ticket information.'
          )

          setTicket(null)

        }

      }

    }

    /*
     * Load immediately.
     */
    load()

    /*
     * Continue checking every 5 seconds.
     */
    const interval =
      setInterval(
        load,
        POLL_INTERVAL_MS
      )

    return () => {

      cancelled = true

      clearInterval(interval)

    }

  }, [
    ticketId,
    previewMode,
  ])

  /* ==========================================================================
     DISPLAYED TICKET
     ========================================================================== */

  /*
   * Use the preview ticket when preview mode
   * is active.
   *
   * Otherwise use the live API ticket.
   */
  const shown =
    previewTicket || ticket

  /* ==========================================================================
     TICKET NOT FOUND / API ERROR
     ========================================================================== */

  if (
    !previewTicket &&
    error
  ) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-[#EAF3FB] px-4">

        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">

          <img
            src={logo}
            alt="SWU Med"
            className="mx-auto h-14 w-auto object-contain"
          />

          <h1 className="mt-5 text-xl font-bold text-[#1F2937]">
            Ticket Not Found
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#4B5563]">
            {error}
          </p>

          <p className="mt-5 text-xs text-[#9CA3AF]">
            Please scan the QR code on your ticket
            again, or ask the front desk for help.
          </p>

        </div>

      </div>

    )
  }

  /* ==========================================================================
     LOADING SCREEN
     ========================================================================== */

  if (!shown) {

    return (

      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#EAF3FB]">

        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-4 border-[#F0DADA] border-t-[#9D0A0E]"
        />

        <p className="text-sm text-[#4B5563]">
          Loading your ticket...
        </p>

      </div>

    )
  }

  /* ==========================================================================
     MAIN TRACKER
     ========================================================================== */

  return (

    <div className="relative min-h-screen">

      {/* ======================================================================
         ON-SCREEN TURN NOTIFICATION
         ======================================================================

         Appears for 6 seconds when:

         1. waiting → called
         2. waiting → serving
         3. notificationVersion changes during called/serving
            because staff pressed Recall.
      ====================================================================== */}

      {turnNotification && (

        <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">

          <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-lg">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#9D0A0E]">

              <BellRing
                size={17}
                className="text-white"
              />

            </div>

            <div className="min-w-0">

              <p className="text-sm font-bold text-[#1F2937]">
                It&rsquo;s your turn!
              </p>

              <p className="mt-0.5 text-xs text-[#6B7280]">

                Please proceed to{' '}

                <span className="font-semibold text-[#1F2937]">
                  {
                    shown?.terminal ||
                    'your assigned terminal'
                  }
                </span>

                .

              </p>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================================
         EXISTING SCREEN SWITCHING
      ==========================================================================

         completed → CompletedScreen

         called/serving → YourTurnScreen

         everything else → WaitingScreen
      ====================================================================== */}

      <div className="transition-opacity duration-200 ease-out">

        {shown.status === 'completed' ? (

          <CompletedScreen
            ticket={shown}
          />

        ) : shown.status === 'called' ||
          shown.status === 'serving' ? (

          <YourTurnScreen
            ticket={shown}
          />

        ) : (

          <WaitingScreen
            ticket={shown}
          />

        )}

      </div>

    </div>

  )
}