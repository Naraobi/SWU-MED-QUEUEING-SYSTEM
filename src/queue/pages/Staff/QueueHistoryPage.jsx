import React, { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import QueueDetailsModal from '../../components/modals/QueueDetailsModal.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import * as api from '../../services/backendApi'

const PAGE_SIZE = 8

// ============================================================
// CUSTOM DATE RANGE CALENDAR POPOVER
// ============================================================

function CalendarPopover({ onClose, onApply }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [hoverDate, setHoverDate] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()
  const getFirstDay   = (y, m) => new Date(y, m, 1).getDay()
  const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString()

  function inRange(d) {
    const anchor = endDate || hoverDate
    if (!startDate || !anchor) return false
    const lo = startDate <= anchor ? startDate : anchor
    const hi = startDate <= anchor ? anchor : startDate
    return d > lo && d < hi
  }

  function formatDisplay(d) {
    if (!d) return '—'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function handleDayClick(d) {
    if (!startDate || (startDate && endDate)) {
      setStartDate(d); setEndDate(null)
    } else {
      if (d < startDate) { setEndDate(startDate); setStartDate(d) }
      else setEndDate(d)
    }
  }

  function handleApply() {
    if (startDate && endDate) {
      const diffDays = Math.round(Math.abs(endDate - startDate) / 86400000) + 1
      onApply({ startDate, endDate, label: `${diffDays} days` })
    }
    onClose()
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDay(viewYear, viewMonth)
  const prevDays    = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1)
  const diffDays    = startDate && endDate
    ? Math.round(Math.abs(endDate - startDate) / 86400000) + 1
    : null

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-1 w-[360px] rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
        <p className="text-sm font-bold text-[#1F2937]">Custom Date Range</p>
        {diffDays && (
          <span className="rounded-full bg-[#9D0A0E] px-3 py-1 text-xs font-semibold text-white">
            {diffDays} days
          </span>
        )}
      </div>

      {/* FROM / TO */}
      <div className="flex gap-3 px-5 pt-4 pb-2">
        {[{ label: 'FROM', val: startDate }, { label: 'TO', val: endDate }].map(({ label, val }) => (
          <div key={label} className="flex flex-1 flex-col">
            <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#4B5563]">{label}</span>
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9D0A0E" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
              </svg>
              <span className="text-xs font-medium text-[#1F2937]">{val ? formatDisplay(val) : `Select date`}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1F3F5] text-[#4B5563]">‹</button>
        <p className="text-sm font-semibold text-[#1F2937]">{MONTHS[viewMonth]} {viewYear}</p>
        <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1F3F5] text-[#4B5563]">›</button>
      </div>

      {/* Calendar Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-7 text-center">
          {DAY_LABELS.map(d => (
            <span key={d} className="py-2 text-xs font-semibold text-[#4B5563]">{d}</span>
          ))}
          {Array.from({ length: firstDay }, (_, i) => (
            <span key={`prev-${i}`} className="py-2 text-xs text-[#E5E7EB]">
              {prevDays - firstDay + i + 1}
            </span>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(viewYear, viewMonth, i + 1)
            const isStart = sameDay(d, startDate)
            const isEnd   = sameDay(d, endDate)
            const isIn    = inRange(d)
            const isHov   = !endDate && sameDay(d, hoverDate)
            let cls = 'py-1 text-xs cursor-pointer rounded-full w-9 h-9 flex items-center justify-center mx-auto transition-all '
            if (isStart || isEnd)      cls += 'bg-[#9D0A0E] text-white font-bold'
            else if (isIn || isHov)    cls += 'bg-[#f3d0d0] text-[#9D0A0E] font-medium'
            else                       cls += 'text-[#1F2937] hover:bg-[#F1F3F5]'
            return (
              <div key={i} className="flex items-center justify-center py-1">
                <span
                  className={cls}
                  onClick={() => handleDayClick(d)}
                  onMouseEnter={() => setHoverDate(d)}
                  onMouseLeave={() => setHoverDate(null)}
                >
                  {i + 1}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4">
        <button
          onClick={onClose}
          className="rounded-lg px-5 py-2.5 text-xs font-semibold text-[#4B5563] hover:bg-[#F1F3F5] transition"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!startDate || !endDate}
          className="rounded-lg bg-[#9D0A0E] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#b01010] disabled:opacity-40 transition"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function QueueHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const departmentId = user?.department_id

  const [rows, setRows]               = useState([])
  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState('All Status')
  const [range, setRange]             = useState('Today')
  const [customRange, setCustomRange] = useState(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [page, setPage]               = useState(1)
  const [selectedRow, setSelectedRow] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // ============================================================
  // FETCH QUEUE HISTORY
  // ============================================================

  useEffect(() => {
    if (authLoading) return
    if (!departmentId) { setRows([]); setPage(1); setHistoryLoading(false); return }

    let cancelled = false

    async function loadHistory() {
      setHistoryLoading(true)
      try {
        let apiRange = range
        if (range === 'Custom Date Range' && customRange) {
          apiRange = `custom:${customRange.startDate.toISOString()}:${customRange.endDate.toISOString()}`
        }

        console.log("Fetching history for department:", departmentId, "with range:", apiRange, "and status:", status)

        const data = await api.fetchQueueHistory(departmentId, { search: search.trim(), status, range: apiRange })
        
        console.log("RAW API Queue History Response:", data)

        if (cancelled) return
        
        const fetchedRows = Array.isArray(data) ? data : []
        setRows(fetchedRows)
        setPage(1)
      } catch (err) {
        console.error('Failed to fetch queue history:', err)
        if (!cancelled) { setRows([]); setPage(1) }
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    loadHistory()
    return () => { cancelled = true }
  }, [authLoading, departmentId, search, status, range, customRange])

  // ============================================================
  // STATUS HELPERS
  // ============================================================

  const normalizeStatus = (v) => String(v || '').trim().toLowerCase()
  const isCompleted     = (r) => normalizeStatus(r?.status) === 'completed'
  const isCancelled     = (r) => { const s = normalizeStatus(r?.status); return s === 'cancelled' || s === 'skipped' }

  // ============================================================
  // STATISTICS
  // ============================================================

  const completedCount = useMemo(() => rows.filter(isCompleted).length, [rows])
  const skippedCount   = useMemo(() => rows.filter(isCancelled).length, [rows])

  const getDurationMinutes = (duration) => {
    if (duration === null || duration === undefined || duration === '') return null
    if (typeof duration === 'number') return Number.isFinite(duration) ? duration : null
    const value = String(duration).trim()
    if (!value) return null
    if (value.includes(':')) {
      const parts = value.split(':').map(p => Number(p.trim()))
      if (parts.every(p => !Number.isNaN(p))) {
        if (parts.length === 2) return parts[0] + parts[1] / 60
        if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
      }
    }
    const match = value.match(/[\d.]+/)
    if (!match) return null
    const n = Number(match[0])
    return Number.isFinite(n) ? n : null
  }

  const averageServiceTime = useMemo(() => {
    const durations = rows.filter(isCompleted).map(r => getDurationMinutes(r?.duration)).filter(v => v !== null && Number.isFinite(v))
    if (!durations.length) return '0m'
    const avg = durations.reduce((s, v) => s + v, 0) / durations.length
    return `${Math.round(avg)}m`
  }, [rows])

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages   = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage     = Math.min(page, totalPages)
  const paginatedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ============================================================
  // FORMAT TIME
  // ============================================================

  const formatTime = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  // ============================================================
  // STATUS BADGE
  // ============================================================

  const StatusBadge = ({ status }) => {
    const s = normalizeStatus(status)
    let label = status || 'Unknown'
    let bg = '#F1F3F5'; let text = '#4B5563'; let dot = '#4B5563'

    if (s === 'completed') {
      label = 'Completed'; bg = '#e4f7ee'; text = '#18864b'; dot = '#18864b'
    } else if (s === 'cancelled' || s === 'skipped') {
      label = 'Skipped'; bg = '#fce8e8'; text = '#9D0A0E'; dot = '#9D0A0E'
    } else if (s === 'waiting') {
      label = 'Waiting'; bg = '#F1F3F5'; text = '#4B5563'; dot = '#4B5563'
    } else if (s === 'called') {
      label = 'Called'; bg = '#fff4df'; text = '#a66a00'; dot = '#a66a00'
    } else if (s === 'serving') {
      label = 'Serving'; bg = '#e4f7ee'; text = '#18864b'; dot = '#18864b'
    }

    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
        style={{ backgroundColor: bg, color: text }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
        {label}
      </span>
    )
  }

  // ============================================================
  // RANGE CHANGE
  // ============================================================

  function handleRangeChange(val) {
    if (val === 'Custom Date Range') {
      setRange('Custom Date Range')
      setShowCalendar(true)
    } else {
      setRange(val)
      setCustomRange(null)
      setShowCalendar(false)
    }
  }

  // ============================================================
  // AUTH GUARDS
  // ============================================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-base text-[#4B5563]">
        Loading department history...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6">
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-base font-semibold text-[#1F2937]">Authentication required</p>
          <p className="mt-2 text-sm text-[#4B5563]">Please log in to view queue history.</p>
        </div>
      </div>
    )
  }

  if (!departmentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6">
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-base font-semibold text-[#1F2937]">Department not found</p>
          <p className="mt-2 text-sm text-[#4B5563]">Your account does not have a valid department assignment.</p>
          <p className="mt-3 text-xs text-[#4B5563]">Please contact an administrator if this is incorrect.</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="staff-shell flex min-h-screen w-full bg-[#F8F9FA]">

      <Sidebar />

      <main className="min-h-screen min-w-0 flex-1 flex flex-col">

        {/* TOPBAR */}
        <Topbar
          title={`Staff · ${user?.department || 'Department'}`}
          subtitle={`Managing queue for department: ${user?.department || 'General'}`}
        />

        <div className="px-8 pb-10 pt-8 flex-1 w-full max-w-[1600px] mx-auto">

          {/* PAGE TITLE */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold leading-none text-[#1F2937]">Queue History</h1>
            <p className="mt-2 text-sm text-[#4B5563]">
              Review queue transactions handled by your assigned department.
            </p>
          </div>

          {/* STAT CARDS */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

            {/* TODAY'S COMPLETED */}
            <div className="flex h-[100px] items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-6 shadow-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">TODAY'S COMPLETED</p>
                <p className="mt-2 text-4xl font-extrabold leading-none text-[#1F2937]">{completedCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F3F5]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* TODAY'S SKIPPED */}
            <div className="flex h-[100px] items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-6 shadow-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">TODAY'S SKIPPED</p>
                <p className="mt-2 text-4xl font-extrabold leading-none text-[#1F2937]">{skippedCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F3F5]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* AVERAGE SERVICE TIME */}
            <div className="flex h-[100px] items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-6 shadow-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">AVERAGE SERVICE TIME</p>
                <p className="mt-2 text-4xl font-extrabold leading-none text-[#1F2937]">{averageServiceTime}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F3F5]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.8">
                  <circle cx="12" cy="13" r="8"/>
                  <path d="M12 9v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.5 2.5h5M12 2.5v2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

          </div>

          {/* HISTORY TABLE */}
          <div className="mt-8 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">

            {/* SEARCH / FILTER */}
            <div className="flex items-center justify-between gap-6 border-b border-[#E5E7EB] px-5 py-4">

              {/* SEARCH */}
              <div className="flex h-10 w-[260px] items-center gap-3 rounded-lg border border-[#E5E7EB] px-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2">
                  <circle cx="11" cy="11" r="7"/>
                  <path d="m20 20-4-4" strokeLinecap="round"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search queue number..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#4B5563]/50 text-[#1F2937]"
                />
              </div>

              {/* FILTERS */}
              <div className="flex items-center gap-3">

                {/* DATE RANGE */}
                <div className="relative">
                  <select
                    value={range}
                    onChange={e => handleRangeChange(e.target.value)}
                    className="h-10 min-w-[140px] cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none"
                  >
                    <option value="Today">Today</option>
                    <option value="Yesterday">Yesterday</option>
                    <option value="Last 7 Days">Last 7 Days</option>
                    <option value="Last 30 Days">Last 30 Days</option>
                    <option value="Custom Date Range">Custom Date Range</option>
                  </select>
                  {range === 'Custom Date Range' && customRange && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-[#9D0A0E] px-2 py-1 text-[10px] font-bold text-white leading-none shadow-sm">
                      {customRange.label}
                    </span>
                  )}
                  {showCalendar && (
                    <CalendarPopover
                      onClose={() => setShowCalendar(false)}
                      onApply={({ startDate, endDate, label }) => {
                        setCustomRange({ startDate, endDate, label })
                        setShowCalendar(false)
                      }}
                    />
                  )}
                </div>

                {/* STATUS */}
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="h-10 min-w-[120px] cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none"
                >
                  <option value="All Status">All Status</option>
                  <option value="Waiting">Waiting</option>
                  <option value="Serving">Serving</option>
                  <option value="Completed">Completed</option>
                  <option value="Skipped">Skipped</option>
                </select>

              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="w-[16%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Queue Number</th>
                    <th className="w-[15%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Service</th>
                    <th className="w-[14%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Status</th>
                    <th className="w-[13%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Called At</th>
                    <th className="w-[13%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Started At</th>
                    <th className="w-[14%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Completed At</th>
                    <th className="w-[10%] px-4 py-4 text-left text-xs font-bold uppercase text-[#4B5563]">Duration</th>
                  </tr>
                </thead>
                <tbody>

                  {historyLoading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center">
                        <p className="text-sm font-medium text-[#4B5563]">Loading queue history...</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => {
                      const s = normalizeStatus(row?.status)
                      const clickable = s === 'cancelled' || s === 'skipped'
                      return (
                        <tr
                          key={row?.queue_id || row?.queueNumber || row?.queue_number || row?.id || index}
                          onClick={() => { if (clickable) setSelectedRow(row) }}
                          className={`border-b border-[#E5E7EB] transition ${clickable ? 'cursor-pointer hover:bg-[#F8F9FA]' : 'hover:bg-[#F8F9FA]/60'}`}
                        >
                          <td className="px-4 py-4 text-sm font-bold text-[#1F2937]">
                            {row?.queueNumber || row?.queue_number || '—'}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#4B5563]">
                            {row?.service || row?.department || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={row?.status} />
                          </td>
                          <td className="px-4 py-4 text-sm text-[#4B5563]">
                            {formatTime(row?.calledAt || row?.called_at)}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#4B5563]">
                            {formatTime(row?.startedAt || row?.service_began_at)}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#4B5563]">
                            {formatTime(row?.completedAt || row?.completed_at)}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#4B5563]">
                            {row?.duration || '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}

                  {!historyLoading && paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <p className="text-sm font-medium text-[#4B5563]">No matching transactions found.</p>
                        <p className="mt-2 text-xs text-[#4B5563]/70">Check your browser console (F12) to verify what your backend API returned.</p>
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="flex h-14 items-center justify-between border-t border-[#E5E7EB] px-5">
              <p className="text-xs text-[#4B5563]">
                Showing{' '}
                {paginatedRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
                {' '}to{' '}
                {Math.min(safePage * PAGE_SIZE, rows.length)}
                {' '}of{' '}{rows.length} entries
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-sm text-[#4B5563] disabled:opacity-30 hover:bg-[#F1F3F5]"
                >‹</button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition"
                    style={{
                      backgroundColor: n === safePage ? '#9D0A0E' : '#FFFFFF',
                      borderColor:     n === safePage ? '#9D0A0E' : '#E5E7EB',
                      color:           n === safePage ? '#FFFFFF'  : '#4B5563',
                    }}
                  >
                    {n}
                  </button>
                ))}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-sm text-[#4B5563] disabled:opacity-30 hover:bg-[#F1F3F5]"
                >›</button>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* QUEUE DETAILS MODAL */}
      {selectedRow && (
        <QueueDetailsModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}

    </div>
  )
}