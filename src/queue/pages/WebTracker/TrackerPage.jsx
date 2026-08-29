import React, { useEffect, useState } from 'react'
import * as api from '../../services/api'
import WaitingScreen from '../../components/WaitingScreen.jsx'
import YourTurnScreen from '../../components/YourTurnScreen.jsx'
import CompletedScreen from '../../components/CompletedScreen.jsx'

// In production this will come from the URL, e.g. /tracker?ticket=LB-021
const POLL_INTERVAL_MS = 30000

export default function TrackerPage() {
  const [ticket, setTicket] = useState(null)
  const queueNumber = new URLSearchParams(window.location.search).get('ticket') || 'LB-021'

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const data = await api.fetchTicketStatus(queueNumber)
      if (!cancelled) setTicket(data)
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [queueNumber])

  if (!ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading your ticket…</p>
      </div>
    )
  }

  return (
    <div className="transition-opacity duration-200 ease-out">
      {ticket.status === 'completed' ? (
        <CompletedScreen ticket={ticket} />
      ) : ticket.status === 'called' || ticket.status === 'serving' ? (
        <YourTurnScreen ticket={ticket} />
      ) : (
        <WaitingScreen ticket={ticket} />
      )}
    </div>
  )
}
