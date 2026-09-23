import React, { useState } from 'react'
import { skipReasons } from '../../data/mockData'

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SkipQueueModal({
  patient,
  department = 'Main Lobby',
  terminal = 'Terminal 2',
  onCancel,
  onConfirm,
}) {
  const [reason, setReason] = useState('Patient did not arrive')
  const [otherText, setOtherText] = useState('')

  const finalReason = reason === 'Other' ? otherText.trim() : reason
  const canConfirm = finalReason.length > 0

  const reasons = [
    'Patient did not arrive',
    'Patient requested cancellation',
    'Patient was called but unavailable',
    'Other',
  ]

  const displayTime = patient?.secondsElapsed
    ? formatSeconds(patient.secondsElapsed)
    : '01:00'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Skip Queue?</h2>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          Are you sure you want to skip this queue? The transaction will be
          recorded as skipped.
        </p>

        {/* SUMMARY CARD */}
        <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
          <div className="grid grid-cols-2 gap-y-3">
            <div>
              <p className="text-[10px] font-medium text-slate-400">
                Queue Number
              </p>
              <p className="mt-0.5 text-base font-extrabold text-slate-900">
                {patient?.id || 'BP-020'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400">Service</p>
              <p className="mt-0.5 text-xs font-bold text-slate-800">
                {patient?.service || 'Billing / Payment'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400">
                Department
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-800">
                {department}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400">Terminal</p>
              <p className="mt-0.5 text-xs font-bold text-slate-800">
                {terminal}
              </p>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs">
            <span className="text-slate-500 font-medium">Waiting Time</span>
            <span className="font-bold text-[#9D0A0E] text-sm">
              {displayTime}
            </span>
          </div>
        </div>

        {/* REASON SECTION */}
        <p className="mt-4 text-xs font-bold text-slate-800">
          Reason for skipping
        </p>

        <div className="mt-2.5 space-y-2">
          {reasons.map((r) => (
            <label
              key={r}
              className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <input
                type="radio"
                name="skip-reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4 accent-[#9D0A0E] cursor-pointer"
              />
              <span>{r}</span>
            </label>
          ))}

          {reason === 'Other' && (
            <input
              type="text"
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Enter skip reason..."
              className="mt-1.5 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#9D0A0E] focus:ring-1 focus:ring-[#9D0A0E]"
            />
          )}
        </div>

        {/* FOOTER */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-600 px-6 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(finalReason)}
            className="rounded-lg bg-[#9D0A0E] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#7d0809] transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            CONFIRM SKIP
          </button>
        </div>
      </div>
    </div>
  )
}
