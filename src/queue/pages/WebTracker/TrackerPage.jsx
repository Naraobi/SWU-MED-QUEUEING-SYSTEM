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
     URL PARAMETERS
     ========================================================================== */

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
     NOTIFICATION SETUP STATE
     ========================================================================== */

  const [
    showNotificationSetup,
    setShowNotificationSetup,
  ] = useState(false)

  const [
    notificationPermission,
    setNotificationPermission,
  ] = useState('default')

  /* ==========================================================================
     TICKET STATE
     ========================================================================== */

  const [
    ticket,
    setTicket,
  ] = useState(null)

  const [
    error,
    setError,
  ] = useState(null)

  /* ==========================================================================
     TURN NOTIFICATION STATE
     ========================================================================== */

  /*
   * Controls the temporary on-screen
   * notification.
   */
  const [
    turnNotification,
    setTurnNotification,
  ] = useState(false)

  /*
   * Stores the previous queue status.
   *
   * Used to detect:
   *
   * waiting → called
   * waiting → serving
   */
  const previousStatusRef =
    useRef(null)

  /*
   * Stores the previous call/recall marker.
   *
   * Used to detect:
   *
   * notificationVersion 1 → 2
   * notificationVersion 2 → 3
   */
  const previousCallMarkerRef =
    useRef(null)

  /*
   * Prevents the first API response from
   * immediately triggering a notification.
   */
  const initializedRef =
    useRef(false)

  /*
   * Stores the temporary notification timeout.
   */
  const notificationTimeoutRef =
    useRef(null)

  /* ==========================================================================
     NOTIFICATION SETUP
     ========================================================================== */

  useEffect(() => {

    /*
     * Preview mode should work immediately
     * without requiring notification setup.
     */
    if (previewMode) {
      return
    }

    /*
     * Check whether the patient has already
     * completed the notification setup on
     * this browser/device.
     */
    const setupCompleted =
      localStorage.getItem(
        'trackerNotificationSetup'
      ) === 'true'

    if (setupCompleted) {
      /*
       * Still keep the current browser
       * permission state available.
       */
      if ('Notification' in window) {
        setNotificationPermission(
          Notification.permission
        )
      }

      return
    }

    /*
     * Read the current browser notification
     * permission before showing the setup screen.
     */
    if ('Notification' in window) {
      setNotificationPermission(
        Notification.permission
      )
    }

    /*
     * Show the setup screen.
     */
    setShowNotificationSetup(true)

  }, [
    previewMode,
  ])

  /* ==========================================================================
     ENABLE NOTIFICATIONS
     ========================================================================== */

  const enableNotifications =
    async () => {

      try {

        /*
         * Request browser notification
         * permission if the browser supports it.
         */
        if (
          'Notification' in window
        ) {

          const permission =
            await Notification.requestPermission()

          setNotificationPermission(
            permission
          )

          /*
           * Show a small confirmation notification
           * when permission is granted.
           */
          if (
            permission === 'granted'
          ) {

            new Notification(
              'SWU Med Notifications Enabled',
              {
                body:
                  'You will be notified when it is your turn.',
                icon: logo,
              }
            )

          }

        }

        /*
         * Remember that the setup screen
         * has already been completed.
         */
        localStorage.setItem(
          'trackerNotificationSetup',
          'true'
        )

        /*
         * Continue to the tracker.
         */
        setShowNotificationSetup(
          false
        )

      } catch (error) {

        console.warn(
          'Unable to enable notifications:',
          error
        )

        /*
         * Even if notification permission
         * cannot be requested, allow the
         * patient to continue using the tracker.
         */
        localStorage.setItem(
          'trackerNotificationSetup',
          'true'
        )

        setShowNotificationSetup(
          false
        )

      }

    }

  /* ==========================================================================
     CONTINUE WITHOUT NOTIFICATIONS
     ========================================================================== */

  const continueWithoutNotifications =
    () => {

      localStorage.setItem(
        'trackerNotificationSetup',
        'true'
      )

      setShowNotificationSetup(
        false
      )

    }

  /* ==========================================================================
     TURN NOTIFICATION HELPER
     ========================================================================== */

  /*
   * Shows the notification and performs:
   *
   * 1. On-screen notification
   * 2. Notification sound
   * 3. Vibration request
   * 4. Browser notification
   *
   * This helper is used for BOTH:
   *
   * 1. waiting → called/serving
   * 2. Recall
   */
  const triggerTurnNotification =
    (currentTicket) => {

      /*
       * Show the on-screen notification.
       */
      setTurnNotification(
        true
      )

      /*
       * 🔊 Sound
       */
      playTurnNotificationSound()

      /*
       * 📳 Vibration
       *
       * The website can request vibration,
       * but the device/browser ultimately
       * controls whether vibration occurs.
       */
      if (
        'vibrate' in navigator &&
        typeof navigator.vibrate ===
          'function'
      ) {

        navigator.vibrate([
          300,
          150,
          300,
          150,
          500,
        ])

      }

      /*
       * 🔔 Browser notification
       *
       * Only create a browser notification
       * when permission was granted.
       */
      if (
        'Notification' in window &&
        Notification.permission ===
          'granted'
      ) {

        new Notification(
          "It's your turn!",
          {
            body:
              `Please proceed to ${
                currentTicket?.terminal ||
                'your assigned terminal'
              }.`,
            icon: logo,
          }
        )

      }

      /*
       * Clear an existing notification timeout.
       */
      if (
        notificationTimeoutRef.current
      ) {

        clearTimeout(
          notificationTimeoutRef.current
        )

      }

      /*
       * Keep the on-screen notification
       * visible for 6 seconds.
       */
      notificationTimeoutRef.current =
        setTimeout(() => {

          setTurnNotification(
            false
          )

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
         * The backend can return ONE of these
         * supported values.
         *
         * Preferred:
         *
         *   notificationVersion
         *
         * Other supported names:
         *
         *   notification_version
         *   callSequence
         *   call_sequence
         *   recallCount
         *   recall_count
         *
         * Example:
         *
         *   1 = first call
         *   2 = first recall
         *   3 = second recall
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
         * This is what allows Recall to
         * trigger another notification.
         */
        const callMarkerChanged =
          initializedRef.current &&
          currentCallMarker !== null &&
          previousCallMarkerRef.current !==
            null &&
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
         * waiting → called
         * waiting → serving
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
         * while the notification marker changes:
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

          triggerTurnNotification(
            result
          )

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
         * it will NOT immediately make a sound
         * or notification.
         */
        initializedRef.current =
          true

        setError(null)

        setTicket(
          result
        )

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

      clearInterval(
        interval
      )

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
     NOTIFICATION SETUP SCREEN
     ========================================================================== */

  if (
    showNotificationSetup
  ) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-[#EAF3FB] px-4 py-8">

        <div className="w-full max-w-md">

          <img
            src={logo}
            alt="SWU Med"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg sm:p-8">

            {/* ICON */}

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F0DADA]">

              <BellRing
                size={26}
                className="text-[#9D0A0E]"
              />

            </div>

            {/* TITLE */}

            <h1 className="mt-5 text-center text-xl font-bold text-[#1F2937]">
              Stay Updated
            </h1>

            <p className="mt-2 text-center text-sm leading-6 text-[#6B7280]">
              Enable notifications so SWU Med can
              alert you when it is your turn.
            </p>

            {/* NOTIFICATION INFORMATION */}

            <div className="mt-6 space-y-3">

              <div className="rounded-xl bg-[#F8FAFC] p-4">

                <div className="flex gap-3">

                  <BellRing
                    size={20}
                    className="mt-0.5 shrink-0 text-[#9D0A0E]"
                  />

                  <div>

                    <p className="text-sm font-semibold text-[#1F2937]">
                      Notifications
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">
                      Receive an alert when your queue
                      is being served.
                    </p>

                  </div>

                </div>

              </div>

              {/* VIBRATION INFORMATION */}

              <div className="rounded-xl bg-[#F8FAFC] p-4">

                <div className="flex gap-3">

                  <span
                    className="mt-0.5 text-lg"
                    aria-hidden="true"
                  >
                    📳
                  </span>

                  <div>

                    <p className="text-sm font-semibold text-[#1F2937]">
                      Vibration
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">
                      For vibration alerts, make sure
                      vibration is enabled in your
                      phone's settings.
                    </p>

                  </div>

                </div>

              </div>

            </div>

            {/* ENABLE BUTTON */}

            <button
              type="button"
              onClick={
                enableNotifications
              }
              className="mt-6 w-full rounded-xl bg-[#9D0A0E] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#82080B]"
            >
              Enable Notifications
            </button>

            {/* SKIP BUTTON */}

            <button
              type="button"
              onClick={
                continueWithoutNotifications
              }
              className="mt-3 w-full px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937]"
            >
              Continue without notifications
            </button>

            <p className="mt-4 text-center text-[11px] leading-4 text-[#9CA3AF]">
              You can continue using the tracker even
              if notifications are not enabled.
            </p>

          </div>

        </div>

      </div>

    )

  }

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
      ========================================================================== */}

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