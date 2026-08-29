import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../services/api'

const QueueContext = createContext(null)

let toastIdCounter = 0

export function QueueProvider({ children }) {
  // Removed local staff state and localStorage logic

  const [waitingQueue, setWaitingQueue] = useState([])
  const [currentlyServing, setCurrentlyServing] = useState(null)
  const [stats, setStats] = useState({ waiting: 0, currentlyServing: 0, completed: 0, skipped: 0 })
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])
  const tickRef = useRef(null)

  // 1. refresh now accepts the departmentPrefix from your Dashboard
  const refresh = useCallback(async (departmentPrefix) => {
    if (!departmentPrefix) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      const state = await api.fetchQueueState(departmentPrefix)
      setWaitingQueue(state.waitingQueue)
      setCurrentlyServing(state.currentlyServing)
      setStats(state.stats)
      
      const notifs = await api.fetchNotifications(departmentPrefix)
      setNotifications(notifs)
    } catch (error) {
      console.error("Failed to load queue data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Timer for the "currently serving" clock
  useEffect(() => {
    clearInterval(tickRef.current)
    if (currentlyServing) {
      tickRef.current = setInterval(() => {
        setCurrentlyServing((prev) =>
          prev ? { ...prev, secondsElapsed: prev.secondsElapsed + 1 } : prev
        )
      }, 1000)
    }
    return () => clearInterval(tickRef.current)
  }, [currentlyServing?.id])

  // 2. All queue actions now require the departmentPrefix to talk to the backend safely
  const callNextPatient = async (departmentPrefix) => {
    const state = await api.callNextPatient(departmentPrefix)
    setWaitingQueue(state.waitingQueue)
    setCurrentlyServing(state.currentlyServing)
    setStats(state.stats)
  }

  const markPatientArrived = async (departmentPrefix) => {
    const state = await api.markPatientArrived(departmentPrefix)
    setCurrentlyServing(state.currentlyServing)
  }

  const recallCurrentPatient = async (departmentPrefix) => {
    const state = await api.recallCurrentPatient(departmentPrefix)
    setCurrentlyServing(state.currentlyServing)
  }

  const completeCurrentPatient = async (departmentPrefix) => {
    const state = await api.completeCurrentPatient(departmentPrefix)
    setCurrentlyServing(state.currentlyServing)
    setStats(state.stats)
    pushNotification({
      type: 'performance',
      title: 'Performance Recognition',
      message: `Great job! You completed ${state.stats.completed} transactions today.`,
    })
  }

  const skipCurrentPatient = async (reason, departmentPrefix) => {
    const state = await api.skipCurrentPatient(reason, departmentPrefix)
    setCurrentlyServing(state.currentlyServing)
    setStats(state.stats)
  }

  // --- Notifications Logic remains exactly the same ---
  const pushNotification = useCallback((notif) => {
    const withDefaults = {
      id: `local-${Date.now()}-${toastIdCounter}`,
      time: 'Just now',
      unread: true,
      ...notif,
    }
    setNotifications((prev) => [withDefaults, ...prev])

    const toastId = ++toastIdCounter
    setToasts((prev) => [...prev, { ...withDefaults, toastId }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.toastId !== toastId))
    }, 5000)
  }, [])

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId))
  }, [])

  const markAllNotificationsRead = async () => {
    const updated = await api.markAllNotificationsRead()
    setNotifications(updated)
  }

  const unreadCount = notifications.filter((n) => n.unread).length

  const value = {
    waitingQueue,
    currentlyServing,
    stats,
    loading,
    refresh, // Make sure to export refresh so Dashboard can call it on load!
    callNextPatient,
    markPatientArrived,
    recallCurrentPatient,
    completeCurrentPatient,
    skipCurrentPatient,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    toasts,
    dismissToast,
    pushNotification
  }

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function useQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue must be used inside a QueueProvider')
  return ctx
}