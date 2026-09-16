import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import * as api from '../services/api'

const QueueContext = createContext(null)

let toastIdCounter = 0

export function QueueProvider({ children }) {
  /* ==========================================================================
     QUEUE STATE
     ========================================================================== */

  const [waitingQueue, setWaitingQueue] = useState([])
  const [currentlyServing, setCurrentlyServing] = useState(null)

  const [stats, setStats] = useState({
    waiting: 0,
    currentlyServing: 0,
    completed: 0,
    skipped: 0,
  })

  const [loading, setLoading] = useState(true)

  /* ==========================================================================
     NOTIFICATIONS
     ========================================================================== */

  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])

  /* ==========================================================================
     TIMER
     ========================================================================== */

  const tickRef = useRef(null)

  /* ==========================================================================
     REFRESH QUEUE STATE
     ========================================================================== */

  /*
   * The Dashboard supplies the logged-in staff member's department prefix.
   *
   * Example:
   *   Billing       -> BP
   *   Information   -> INF
   *   Admission     -> ADM
   *
   * Flow:
   *
   * React Dashboard
   *       ↓
   * QueueContext.refresh(prefix)
   *       ↓
   * api.fetchQueueState(prefix)
   *       ↓
   * Node.js backend
   *       ↓
   * Firebase / MySQL
   */

  const refresh = useCallback(async (departmentPrefix) => {
    if (!departmentPrefix) {
      setWaitingQueue([])
      setCurrentlyServing(null)

      setStats({
        waiting: 0,
        currentlyServing: 0,
        completed: 0,
        skipped: 0,
      })

      setLoading(false)

      return
    }

    setLoading(true)

    try {
      const state = await api.fetchQueueState(
        departmentPrefix
      )

      /*
       * Protect the frontend if the backend
       * returns incomplete data.
       */
      setWaitingQueue(
        Array.isArray(state?.waitingQueue)
          ? state.waitingQueue
          : []
      )

      setCurrentlyServing(
        state?.currentlyServing || null
      )

      setStats({
        waiting:
          Number(state?.stats?.waiting) || 0,

        currentlyServing:
          Number(state?.stats?.currentlyServing) || 0,

        completed:
          Number(state?.stats?.completed) || 0,

        skipped:
          Number(state?.stats?.skipped) || 0,
      })

      /*
       * Notifications currently come through
       * the same department-specific API.
       */
      const notifs =
        await api.fetchNotifications(
          departmentPrefix
        )

      setNotifications(
        Array.isArray(notifs)
          ? notifs
          : []
      )
    } catch (error) {
      console.error(
        'Failed to load queue data:',
        error
      )

      /*
       * Do not leave stale queue information
       * visible when a refresh fails.
       */
      setWaitingQueue([])
      setCurrentlyServing(null)

      setStats({
        waiting: 0,
        currentlyServing: 0,
        completed: 0,
        skipped: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  /* ==========================================================================
     CURRENTLY SERVING TIMER
     ========================================================================== */

  /*
   * IMPORTANT:
   *
   * `called_at` is NOT the same as `service_began_at`.
   *
   * Calling a patient puts the patient into the
   * "serving" state, but the service timer should
   * only represent actual service time.
   *
   * The backend should provide the appropriate
   * secondsElapsed value.
   *
   * This interval only keeps the displayed timer
   * moving once service has actually started.
   */

  useEffect(() => {
    clearInterval(tickRef.current)

    if (
      currentlyServing &&
      (
        currentlyServing.serviceBeganAt ||
        currentlyServing.service_began_at
      )
    ) {
      tickRef.current = setInterval(() => {
        setCurrentlyServing((previous) => {
          if (!previous) {
            return previous
          }

          return {
            ...previous,
            secondsElapsed:
              (Number(
                previous.secondsElapsed
              ) || 0) + 1,
          }
        })
      }, 1000)
    }

    return () => {
      clearInterval(tickRef.current)
    }
  }, [
    currentlyServing?.id,
    currentlyServing?.serviceBeganAt,
    currentlyServing?.service_began_at,
  ])

  /* ==========================================================================
     CALL NEXT PATIENT
     ========================================================================== */

  const callNextPatient = async (
    departmentPrefix
  ) => {
    if (!departmentPrefix) {
      throw new Error(
        'Department prefix is required.'
      )
    }

    const state =
      await api.callNextPatient(
        departmentPrefix
      )

    setWaitingQueue(
      Array.isArray(state?.waitingQueue)
        ? state.waitingQueue
        : []
    )

    setCurrentlyServing(
      state?.currentlyServing || null
    )

    setStats({
      waiting:
        Number(state?.stats?.waiting) || 0,

      currentlyServing:
        Number(
          state?.stats?.currentlyServing
        ) || 0,

      completed:
        Number(state?.stats?.completed) || 0,

      skipped:
        Number(state?.stats?.skipped) || 0,
    })

    return state
  }

  /* ==========================================================================
     START SERVICE
     ========================================================================== */

  /*
   * Calling a patient and starting service are
   * intentionally separate actions.
   *
   * Call Patient:
   *   called_at = current time
   *
   * Start Service:
   *   service_began_at = current time
   *
   * The Node.js backend is responsible for
   * updating service_began_at.
   */

  const startService = async (
    departmentPrefix
  ) => {
    if (!departmentPrefix) {
      throw new Error(
        'Department prefix is required.'
      )
    }

    const state =
      await api.startService(
        departmentPrefix
      )

    setCurrentlyServing(
      state?.currentlyServing || null
    )

    return state
  }

  /* ==========================================================================
     MARK PATIENT ARRIVED
     ========================================================================== */

  const markPatientArrived = async (
    departmentPrefix
  ) => {
    if (!departmentPrefix) {
      throw new Error(
        'Department prefix is required.'
      )
    }

    const state =
      await api.markPatientArrived(
        departmentPrefix
      )

    setCurrentlyServing(
      state?.currentlyServing || null
    )

    return state
  }

  /* ==========================================================================
     RECALL CURRENT PATIENT
     ========================================================================== */

  const recallCurrentPatient = async (
    departmentPrefix
  ) => {
    if (!departmentPrefix) {
      throw new Error(
        'Department prefix is required.'
      )
    }

    const state =
      await api.recallCurrentPatient(
        departmentPrefix
      )

    setCurrentlyServing(
      state?.currentlyServing || null
    )

    return state
  }

  /* ==========================================================================
     COMPLETE CURRENT PATIENT
     ========================================================================== */

  const completeCurrentPatient = async (
    departmentPrefix
  ) => {
    if (!departmentPrefix) {
      throw new Error(
        'Department prefix is required.'
      )
    }

    const state =
      await api.completeCurrentPatient(
        departmentPrefix
      )

    setCurrentlyServing(
      state?.currentlyServing || null
    )

    setStats({
      waiting:
        Number(state?.stats?.waiting) || 0,

      currentlyServing:
        Number(
          state?.stats?.currentlyServing
        ) || 0,

      completed:
        Number(state?.stats?.completed) || 0,

      skipped:
        Number(state?.stats?.skipped) || 0,
    })

    /*
     * Local performance notification.
     */
    pushNotification({
      type: 'performance',

      title:
        'Performance Recognition',

      message:
        `Great job! You completed ${
          Number(
            state?.stats?.completed
          ) || 0
        } transactions today.`,
    })

    return state
  }

  /* ==========================================================================
     SKIP CURRENT PATIENT
     ========================================================================== */

  const skipCurrentPatient = async (
    reason,
    departmentPrefix
  ) => {
    if (!departmentPrefix) {
      throw new Error(
        'Department prefix is required.'
      )
    }

    const state =
      await api.skipCurrentPatient(
        reason,
        departmentPrefix
      )

    setCurrentlyServing(
      state?.currentlyServing || null
    )

    setStats({
      waiting:
        Number(state?.stats?.waiting) || 0,

      currentlyServing:
        Number(
          state?.stats?.currentlyServing
        ) || 0,

      completed:
        Number(state?.stats?.completed) || 0,

      skipped:
        Number(state?.stats?.skipped) || 0,
    })

    return state
  }

  /* ==========================================================================
     NOTIFICATION HELPERS
     ========================================================================== */

  const pushNotification = useCallback(
    (notif) => {
      const withDefaults = {
        id:
          `local-${Date.now()}-${toastIdCounter}`,

        time:
          'Just now',

        unread:
          true,

        ...notif,
      }

      setNotifications(
        (previous) => [
          withDefaults,
          ...previous,
        ]
      )

      const toastId =
        ++toastIdCounter

      setToasts(
        (previous) => [
          ...previous,
          {
            ...withDefaults,
            toastId,
          },
        ]
      )

      setTimeout(() => {
        setToasts(
          (previous) =>
            previous.filter(
              (toast) =>
                toast.toastId !==
                toastId
            )
        )
      }, 5000)
    },
    []
  )

  /* ==========================================================================
     DISMISS TOAST
     ========================================================================== */

  const dismissToast = useCallback(
    (toastId) => {
      setToasts(
        (previous) =>
          previous.filter(
            (toast) =>
              toast.toastId !==
              toastId
          )
      )
    },
    []
  )

  /* ==========================================================================
     MARK ALL NOTIFICATIONS READ
     ========================================================================== */

  const markAllNotificationsRead =
    async () => {
      const updated =
        await api.markAllNotificationsRead()

      setNotifications(
        Array.isArray(updated)
          ? updated
          : []
      )
    }

  /* ==========================================================================
     UNREAD NOTIFICATION COUNT
     ========================================================================== */

  const unreadCount =
    notifications.filter(
      (notification) =>
        notification.unread
    ).length

  /* ==========================================================================
     CONTEXT VALUE
     ========================================================================== */

  const value = {
    /* Queue */
    waitingQueue,
    currentlyServing,
    stats,
    loading,

    /* Queue loading */
    refresh,

    /* Queue actions */
    callNextPatient,
    startService,
    markPatientArrived,
    recallCurrentPatient,
    completeCurrentPatient,
    skipCurrentPatient,

    /* Notifications */
    notifications,
    unreadCount,
    markAllNotificationsRead,

    /* Toasts */
    toasts,
    dismissToast,
    pushNotification,
  }

  /* ==========================================================================
     PROVIDER
     ========================================================================== */

  return (
    <QueueContext.Provider
      value={value}
    >
      {children}
    </QueueContext.Provider>
  )
}

/* ============================================================================
   USE QUEUE HOOK
   ============================================================================ */

export function useQueue() {
  const ctx =
    useContext(QueueContext)

  if (!ctx) {
    throw new Error(
      'useQueue must be used inside a QueueProvider'
    )
  }

  return ctx
}
