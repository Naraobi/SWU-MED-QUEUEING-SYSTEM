import React, { useState } from 'react'
import { skipReasons } from '../../data/mockData'

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SkipQueueModal({ patient, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [otherText, setOtherText] = useState('')

  const finalReason = reason === 'Other' ? otherText.trim() : reason
  const canConfirm = finalReason.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-800">Skip Queue?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Are you sure you want to skip this queue? The transaction will be recorded as skipped.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">Queue Number</p>
            <p className="font-semibold text-slate-800">{patient.id}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Service</p>
            <p className="font-semibold text-slate-800">{patient.service}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Department</p>
            <p className="font-semibold text-slate-800">Laboratory</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Terminal</p>
            <p className="font-semibold text-slate-800">{patient.terminal}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Waiting Time</p>
            <p className="font-semibold text-brand-blue">{formatSeconds(patient.secondsElapsed)}</p>
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-800">Reason for skipping</p>
        <div className="mt-2 space-y-2">
          {skipReasons.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="radio"
                name="skip-reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4 accent-brand-blue"
              />
              {r}
            </label>
          ))}
          {reason === 'Other' && (
            <input
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Enter skip reason..."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(finalReason)}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm Skip
          </button>
        </div>
      </div>
    </div>
  )
}
