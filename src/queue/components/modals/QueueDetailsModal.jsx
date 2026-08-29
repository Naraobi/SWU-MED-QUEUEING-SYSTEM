import React from 'react'
import Badge from '../ui/Badge.jsx'

export default function QueueDetailsModal({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Queue Details</h2>
            <p className="mt-0.5 text-sm text-slate-500">Review the details of this skipped queue transaction.</p>
          </div>
          <Badge>{row.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">Queue Number</p>
            <p className="font-semibold text-slate-800">{row.queueNumber}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Service</p>
            <p className="font-semibold text-slate-800">{row.service}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Department</p>
            <p className="font-semibold text-slate-800">{row.department}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Terminal</p>
            <p className="font-semibold text-slate-800">{row.terminal}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Called At</p>
            <p className="font-semibold text-slate-800">{row.calledAt}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Waiting Time</p>
            <p className="font-semibold text-slate-800">{row.waitingTime}</p>
          </div>
        </div>

        {row.status === 'Skipped' && (
          <>
            <p className="mt-5 text-sm font-semibold text-slate-800">Skip Reason</p>
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <span>⚠️</span>
              {row.skipReason}
            </div>
          </>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-800">Transaction Information</p>
          <div className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-400">Transaction Date</p>
              <p className="font-medium text-slate-700">{row.transactionDate}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Staff</p>
              <p className="font-medium text-slate-700">{row.staff}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>⟲</span> This {row.status.toLowerCase()} transaction has been recorded in Queue History.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
