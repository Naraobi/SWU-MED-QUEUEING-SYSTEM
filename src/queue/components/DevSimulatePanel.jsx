import React from 'react'
import * as api from '../services/api'

// This entire component only renders when running `npm run dev`.
// `npm run build` strips it out completely, so it will never appear
// on the real kiosk/tablet screens in production.
export default function DevSimulatePanel({ onUpdate }) {
  const setStatus = async (status) => {
    const ticket = await api._devSetStatus(status)
    onUpdate(ticket)
  }
  const advance = async () => {
    const ticket = await api._devAdvanceQueue()
    onUpdate(ticket)
  }
  const reset = async () => {
    const ticket = await api._devReset()
    onUpdate(ticket)
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-amber-700">DEV ONLY — simulate ticket status</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatus('waiting')} className="rounded-md border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100">
          waiting
        </button>
        <button onClick={advance} className="rounded-md border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100">
          advance queue (-1 ahead)
        </button>
        <button onClick={() => setStatus('serving')} className="rounded-md border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100">
          serving
        </button>
        <button onClick={() => setStatus('completed')} className="rounded-md border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100">
          completed
        </button>
        <button onClick={reset} className="rounded-md border border-amber-300 bg-white px-2 py-1 hover:bg-amber-100">
          reset
        </button>
      </div>
    </div>
  )
}
