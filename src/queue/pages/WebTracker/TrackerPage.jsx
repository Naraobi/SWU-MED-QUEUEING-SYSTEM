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

  /*
   * Controls the notification/vibration setup
   * modal.
   *
   * This is only an overlay.
   * It does not replace the tracker page.
   */
  const [
    showNotificationSetup,
    setShowNotificationSetup,
  ] = useState(false)

  /*
   * Stores the current browser notification
   * permission.
   *
   * Possible values:
   *
   * default
   * granted
   * denied
   */
  const [
    notificationPermission,
    setNotificationPermission,
  ] = useState('default')

  /*
   * Stores whether the current browser supports
   * the Vibration API.
   */
  const [
    vibrationSupported,
    setVibrationSupported,
  ] = useState(false)

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
     * Check browser vibration support.
     *
     * The browser/device ultimately decides
     * whether vibration is actually allowed.
     */
    setVibrationSupported(
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'
    )

    /*
     * Check whether the patient has already
     * completed the notification setup on
     * this browser/device.
     */
    const setupCompleted =
      localStorage.getItem(
        'trackerNotificationSetup'
      ) === 'true'

    /*
     * Read the current browser notification
     * permission if the API exists.
     */
    if (
      'Notification' in window
    ) {

      setNotificationPermission(
        Notification.permission
      )

    }

    /*
     * If setup has already been completed,
     * do not show the setup modal again.
     */
    if (setupCompleted) {
      return
    }

    /*
     * Show the setup modal.
     */
    setShowNotificationSetup(
      true
    )

  }, [
    previewMode,
  ])

  /* ==========================================================================
     ENABLE NOTIFICATIONS + VIBRATION
  ========================================================================== */

  const enableNotifications =
    async () => {

      try {

        let permission =
          notificationPermission

        /*
         * Request browser notification permission
         * when supported.
         *
         * This is triggered directly by the
         * patient's button click.
         */
        if (
          'Notification' in window
        ) {

          permission =
            await Notification.requestPermission()

          setNotificationPermission(
            permission
          )

        }

        /*
         * Test vibration immediately after the
         * user presses the button.
         */
        if (
          'vibrate' in navigator &&
          typeof navigator.vibrate === 'function'
        ) {

          try {

            navigator.vibrate([
              150,
              100,
              150,
            ])

          } catch (vibrationError) {

            console.warn(
              'Unable to test device vibration:',
              vibrationError
            )

          }

        }

        /*
         * Show a normal browser notification
         * when permission has been granted.
         *
         * No Service Worker or Web Push is used.
         */
        if (
          permission === 'granted'
        ) {

          try {

            new Notification(
              'SWU Med Notifications Enabled',
              {
                body:
                  'You will be notified when it is your turn.',

                icon:
                  logo,
              }
            )

          } catch (notificationError) {

            console.warn(
              'Unable to show confirmation notification:',
              notificationError
            )

          }

        }

        /*
         * Remember that the setup modal has
         * already been completed.
         */
        localStorage.setItem(
          'trackerNotificationSetup',
          'true'
        )

        /*
         * Close only the modal.
         *
         * The tracker remains visible underneath.
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
         * Even if browser notification permission
         * cannot be requested, allow the patient
         * to continue using the tracker.
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

      /*
       * Close only the setup modal.
       */
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
       * Sound
       */
      playTurnNotificationSound()

      /*
       * Vibration
       *
       * The website can request vibration,
       * but the device/browser ultimately
       * controls whether vibration occurs.
       */
      if (
        'vibrate' in navigator &&
        typeof navigator.vibrate === 'function'
      ) {

        try {

          navigator.vibrate([
            300,
            150,
            300,
            150,
            500,
          ])

        } catch (error) {

          console.warn(
            'Unable to trigger turn vibration:',
            error
          )

        }

      }

      /*
       * Browser notification
       *
       * This uses the browser's normal
       * Notification API only.
       *
       * No Service Worker or Web Push is used.
       */
      if (
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {

        const notificationBody =
          `Please proceed to ${
            currentTicket?.terminal ||
            'your assigned terminal'
          }.`

        try {

          new Notification(
            "It's your turn!",
            {
              body:
                notificationBody,

              icon:
                logo,
            }
          )

        } catch (error) {

          console.warn(
            'Unable to create browser notification:',
            error
          )

        }

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
          previousStatusRef.current === 'waiting'

        /* ====================================================================
           CALL / RECALL MARKER
        ==================================================================== */

        /*
         * The backend can return one of these
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
         * This allows Recall to trigger
         * another notification.
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
         NOTIFICATION / VIBRATION SETUP MODAL
      ========================================================================== */}

      {showNotificationSetup && (

        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]"
          role="presentation"
        >

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-setup-title"
            aria-describedby="notification-setup-description"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >

            {/* ================================================================
               MODAL HEADER
            ================================================================= */}

            <div className="px-6 pt-7">

              <div className="mx-auto flex h-20 w-20 items-center justify-center">

                <img
                  src={logo}
                  alt="SWU Med"
                  className="h-20 w-20 object-contain"
                />

              </div>

              <h2
                id="notification-setup-title"
                className="mt-5 text-center text-xl font-bold text-[#1F2937]"
              >
                Stay Updated
              </h2>

              <p
                id="notification-setup-description"
                className="mt-2 text-center text-sm leading-6 text-[#6B7280]"
              >
                Allow SWU Med to notify you when
                your queue number is called.
              </p>

            </div>

            {/* ================================================================
               ALERT FEATURES
            ================================================================= */}

            <div className="space-y-3 px-6 pt-6">

              {/* Browser Notifications */}

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">

                    <BellRing
                      size={18}
                      className="text-[#9D0A0E]"
                    />

                  </div>

                  <div className="min-w-0">

                    <p className="text-sm font-semibold text-[#1F2937]">
                      Browser Notifications
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">
                      Receive an alert when it is
                      your turn, even while viewing
                      another browser tab.
                    </p>

                  </div>

                </div>

              </div>

              {/* Vibration */}

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">

                    <span
                      className="text-lg"
                      aria-hidden="true"
                    >
                      📳
                    </span>

                  </div>

                  <div className="min-w-0">

                    <p className="text-sm font-semibold text-[#1F2937]">
                      Vibration Alerts
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">

                      {vibrationSupported
                        ? 'Your browser supports vibration. We will request vibration when your queue number is called.'
                        : 'Vibration is not available in this browser. You can still receive sound and notification alerts.'}

                    </p>

                  </div>

                </div>

              </div>

            </div>

            {/* ================================================================
               DEVICE NOTE
            ================================================================= */}

            <div className="px-6 pt-4">

              <p className="text-center text-[11px] leading-5 text-[#9CA3AF]">

                Vibration is controlled by your
                browser and device settings. If
                vibration does not work, make sure
                your device is not in a mode that
                disables vibration.

              </p>

            </div>

            {/* ================================================================
               ACTION BUTTONS
            ================================================================= */}

            <div className="px-6 pb-6 pt-5">

              <button
                type="button"
                onClick={enableNotifications}
                className="w-full rounded-xl bg-[#9D0A0E] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#82080B] active:scale-[0.99]"
              >
                Enable Alerts
              </button>

              <button
                type="button"
                onClick={continueWithoutNotifications}
                className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#1F2937]"
              >
                Continue without alerts
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================================
         TURN NOTIFICATION TOAST
      ========================================================================== */}

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
