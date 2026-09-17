import React from 'react'

// ============================================================
// HELPERS
// ============================================================

const normalizeStatus = (v) => String(v || '').trim().toLowerCase()

const formatTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ============================================================
// COMPONENT
// ============================================================

export default function QueueDetailsModal({ row, onClose }) {
  if (!row) return null

  const status      = normalizeStatus(row.status)
  const isSkipped   = status === 'skipped' || status === 'cancelled'
  const isCompleted = status === 'completed'

  const displayStatus = isSkipped ? 'SKIPPED' : isCompleted ? 'COMPLETED' : String(row.status || '').toUpperCase()

  // Badge styling using project palette
  const badgeStyle = isSkipped
    ? { bg: '#fce8e8', text: '#9D0A0E', border: '#f5c6c6' }
    : isCompleted
    ? { bg: '#e4f7ee', text: '#18864b', border: '#b8e8ce' }
    : { bg: '#F1F3F5', text: '#4B5563', border: '#E5E7EB' }

  const queueNumber    = row.queueNumber     || row.queue_number   || '—'
  const service        = row.service         || row.department      || '—'
  const department     = row.department      || '—'
  const terminal       = row.terminal        || '—'
  const calledAt       = formatTime(row.calledAt  || row.called_at)
  const timeToRespond  = row.waitingTime     || row.time_to_respond || '—'
  const skipReason     = row.skipReason      || row.skip_reason     || 'No reason provided'
  const transactionDate = formatDate(row.transactionDate || row.completedAt || row.completed_at || row.calledAt || row.called_at)
  const staff          = row.staff           || row.staff_id        || '—'
  const skippedAt      = formatTime(row.skippedAt || row.completedAt || row.completed_at || row.calledAt || row.called_at)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2937]/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ==================================================
            HEADER
        ================================================== */}
        <div className="flex items-start justify-between p-5 pb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F3F5]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-bold leading-tight text-[#1F2937]">Queue Details</h2>
              <p className="mt-0.5 text-[9px] text-[#4B5563]">
                Review the details of this {isSkipped ? 'skipped' : isCompleted ? 'completed' : ''} queue transaction.
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className="rounded-md px-2.5 py-1 text-[8px] font-bold tracking-wide"
            style={{
              backgroundColor: badgeStyle.bg,
              color:           badgeStyle.text,
              border:          `1px solid ${badgeStyle.border}`,
            }}
          >
            {displayStatus}
          </span>
        </div>

        {/* ==================================================
            INFO GRID
        ================================================== */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-4">
          {[
            { label: 'Queue Number',    value: queueNumber   },
            { label: 'Service',         value: service       },
            { label: 'Department',      value: department    },
            { label: 'Terminal',        value: terminal      },
            { label: 'Called At',       value: calledAt      },
            { label: 'Time to Respond', value: timeToRespond },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[8px] text-[#4B5563]">{label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#1F2937]">{value}</p>
            </div>
          ))}
        </div>

        {/* ==================================================
            SKIP REASON
        ================================================== */}
        {isSkipped && (
          <div className="px-5 pb-4">
            <p className="mb-1.5 text-[10px] font-semibold text-[#1F2937]">Skip Reason</p>
            <div className="flex items-center gap-2 rounded-[6px] border border-[#f5c6c6] bg-[#fce8e8] px-3 py-2.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9D0A0E" strokeWidth="2" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
              <p className="text-[9px] font-medium text-[#9D0A0E]">{skipReason}</p>
            </div>
          </div>
        )}

        {/* ==================================================
            TRANSACTION INFORMATION
        ================================================== */}
        <div className="border-t border-[#E5E7EB] px-5 pt-3 pb-4">
          <p className="mb-2 text-[10px] font-semibold text-[#1F2937]">Transaction Information</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[8px] text-[#4B5563]">Transaction Date</p>
              <p className="mt-0.5 text-[9px] font-medium text-[#1F2937]">{transactionDate}</p>
            </div>
            <div>
              <p className="text-[8px] text-[#4B5563]">Staff</p>
              <p className="mt-0.5 text-[9px] font-medium text-[#1F2937]">{staff}</p>
            </div>
            <div>
              <p className="text-[8px] text-[#4B5563]">{isSkipped ? 'Skipped at' : 'Completed at'}</p>
              <p className="mt-0.5 text-[9px] font-medium text-[#1F2937]">{skippedAt}</p>
            </div>
          </div>
        </div>

        {/* ==================================================
            FOOTER
        ================================================== */}
        <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
            </svg>
            <p className="text-[8px] text-[#4B5563]">
              This {isSkipped ? 'skipped' : isCompleted ? 'completed' : ''} transaction has been recorded in Queue History.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-[6px] border border-[#E5E7EB] px-4 py-1.5 text-[9px] font-semibold text-[#1F2937] hover:bg-[#F1F3F5] transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
