import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import QueueDetailsModal from '../../components/modals/QueueDetailsModal.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import * as api from '../../services/backendApi'

const PAGE_SIZE = 6

export default function QueueHistoryPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth()

  // ============================================================
  // DEPARTMENT ID
  //
  // Queue History is now department-ID based.
  // No prefix resolution is needed here.
  // ============================================================

  const departmentId = user?.department_id

  const [rows, setRows] = useState([])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All Status')
  const [range, setRange] = useState('Today')

  const [page, setPage] = useState(1)
  const [selectedRow, setSelectedRow] = useState(null)

  const [historyLoading, setHistoryLoading] =
    useState(false)

  // ============================================================
  // FETCH QUEUE HISTORY
  // ============================================================

  useEffect(() => {
    if (authLoading) {
      return
    }

    // ----------------------------------------------------------
    // No department assigned
    // ----------------------------------------------------------

    if (!departmentId) {
      setRows([])
      setPage(1)
      setHistoryLoading(false)
      return
    }

    let cancelled = false

    async function loadHistory() {
      setHistoryLoading(true)

      try {
        console.log(
          'Fetching queue history for department ID:',
          departmentId
        )

        const data =
          await api.fetchQueueHistory(
            departmentId,
            {
              search:
                search.trim(),
              status,
              range,
            }
          )

        if (cancelled) {
          return
        }

        const history =
          Array.isArray(data)
            ? data
            : []

        console.log(
          'Queue history received:',
          history
        )

        setRows(history)

        // Reset pagination whenever
        // filters/search change.
        setPage(1)
      } catch (error) {
        console.error(
          'Failed to fetch queue history:',
          error
        )

        if (!cancelled) {
          setRows([])
          setPage(1)
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      }
    }

    loadHistory()

    return () => {
      cancelled = true
    }
  }, [
    authLoading,
    departmentId,
    search,
    status,
    range,
  ])

  // ============================================================
  // STATUS HELPERS
  // ============================================================

  const normalizeStatus = (value) => {
    return String(
      value || ''
    )
      .trim()
      .toLowerCase()
  }

  const isCompleted = (row) => {
    return (
      normalizeStatus(
        row?.status
      ) === 'completed'
    )
  }

  const isCancelled = (row) => {
    const currentStatus =
      normalizeStatus(
        row?.status
      )

    return (
      currentStatus ===
        'cancelled' ||
      currentStatus ===
        'skipped'
    )
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  const completedCount =
    useMemo(() => {
      return rows.filter(
        isCompleted
      ).length
    }, [rows])

  const cancelledCount =
    useMemo(() => {
      return rows.filter(
        isCancelled
      ).length
    }, [rows])

  // ============================================================
  // CONVERT DURATION TO MINUTES
  // ============================================================

  const getDurationMinutes = (
    duration
  ) => {
    if (
      duration === null ||
      duration === undefined ||
      duration === ''
    ) {
      return null
    }

    // ----------------------------------------------------------
    // Numeric duration
    // ----------------------------------------------------------

    if (
      typeof duration ===
      'number'
    ) {
      return Number.isFinite(
        duration
      )
        ? duration
        : null
    }

    const value =
      String(duration).trim()

    if (!value) {
      return null
    }

    // ----------------------------------------------------------
    // M:SS
    // ----------------------------------------------------------

    if (
      value.includes(':')
    ) {
      const parts =
        value
          .split(':')
          .map((part) =>
            Number(
              part.trim()
            )
          )

      if (
        parts.every(
          (part) =>
            !Number.isNaN(part)
        )
      ) {
        // M:SS
        if (
          parts.length === 2
        ) {
          return (
            parts[0] +
            parts[1] / 60
          )
        }

        // H:MM:SS
        if (
          parts.length === 3
        ) {
          return (
            parts[0] * 60 +
            parts[1] +
            parts[2] / 60
          )
        }
      }
    }

    // ----------------------------------------------------------
    // Fallback numeric extraction
    // ----------------------------------------------------------

    const match =
      value.match(
        /[\d.]+/
      )

    if (!match) {
      return null
    }

    const number =
      Number(match[0])

    return Number.isFinite(
      number
    )
      ? number
      : null
  }

  // ============================================================
  // AVERAGE SERVICE TIME
  // ============================================================

  const averageServiceTime =
    useMemo(() => {
      const durations =
        rows
          .filter(
            isCompleted
          )
          .map((row) =>
            getDurationMinutes(
              row?.duration
            )
          )
          .filter(
            (value) =>
              value !== null &&
              Number.isFinite(
                value
              )
          )

      if (
        durations.length === 0
      ) {
        return '0 min'
      }

      const average =
        durations.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        ) /
        durations.length

      return `${Math.round(
        average
      )} min`
    }, [rows])

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
          PAGE_SIZE
      )
    )

  const safePage =
    Math.min(
      page,
      totalPages
    )

  const paginatedRows =
    rows.slice(
      (safePage - 1) *
        PAGE_SIZE,
      safePage *
        PAGE_SIZE
    )

  // ============================================================
  // FORMAT DATE/TIME
  // ============================================================

  const formatDateTime = (
    value
  ) => {
    if (!value) {
      return '—'
    }

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value)
    }

    return date.toLocaleString(
      'en-PH',
      {
        dateStyle:
          'short',
        timeStyle:
          'short',
      }
    )
  }

  // ============================================================
  // STATUS BADGE
  // ============================================================

  const StatusBadge = ({
    status,
  }) => {
    const normalizedStatus =
      normalizeStatus(
        status
      )

    let displayStatus =
      status || 'Unknown'

    let badgeClass =
      'bg-[#edf1f4] text-[#72808b]'

    let dotClass =
      'bg-[#72808b]'

    if (
      normalizedStatus ===
      'completed'
    ) {
      displayStatus =
        'Completed'

      badgeClass =
        'bg-[#e4f1fa] text-[#1870a8]'

      dotClass =
        'bg-[#1870a8]'
    }

    if (
      normalizedStatus ===
        'cancelled' ||
      normalizedStatus ===
        'skipped'
    ) {
      displayStatus =
        'Cancelled'

      badgeClass =
        'bg-[#fbe8e8] text-[#b43b3b]'

      dotClass =
        'bg-[#b43b3b]'
    }

    if (
      normalizedStatus ===
      'waiting'
    ) {
      displayStatus =
        'Waiting'

      badgeClass =
        'bg-[#edf1f4] text-[#72808b]'

      dotClass =
        'bg-[#72808b]'
    }

    if (
      normalizedStatus ===
      'called'
    ) {
      displayStatus =
        'Called'

      badgeClass =
        'bg-[#fff4df] text-[#a66a00]'

      dotClass =
        'bg-[#a66a00]'
    }

    if (
      normalizedStatus ===
      'serving'
    ) {
      displayStatus =
        'Serving'

      badgeClass =
        'bg-[#e6f7ee] text-[#18864b]'

      dotClass =
        'bg-[#18864b]'
    }

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[8px] font-semibold ${badgeClass}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotClass}`}
        />

        {displayStatus}
      </span>
    )
  }

  // ============================================================
  // AUTH LOADING
  // ============================================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eaf5fc] text-sm text-slate-500">
        Loading department history...
      </div>
    )
  }

  // ============================================================
  // NO USER
  // ============================================================

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eaf5fc] px-4">
        <div className="rounded-lg border border-[#d8e5ed] bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            Authentication required
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Please log in to view queue history.
          </p>
        </div>
      </div>
    )
  }

  // ============================================================
  // DEPARTMENT NOT FOUND
  // ============================================================

  if (!departmentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eaf5fc] px-4">
        <div className="rounded-lg border border-[#d8e5ed] bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            Department not found
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Your account does not have a
            valid department assignment.
          </p>

          <p className="mt-2 text-[10px] text-slate-400">
            Please contact an administrator
            if your department assignment
            is incorrect.
          </p>
        </div>
      </div>
    )
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="staff-shell flex min-h-screen w-full bg-[#eaf5fc]">

      <Sidebar />

      <main className="min-h-screen min-w-0 flex-1">

        {/* ======================================================
            TOPBAR
        ====================================================== */}

        <Topbar
          title={`Staff · ${
            user?.department ||
            'Department'
          }`}
          subtitle={`Managing queue for department: ${
            user?.department ||
            'General'
          }`}
        />

        <div className="px-4 pb-8 pt-5">

          {/* ====================================================
              PAGE TITLE
          ==================================================== */}

          <div className="mb-5">

            <h1 className="text-[25px] font-extrabold leading-none text-[#16283b]">
              Queue History
            </h1>

            <p className="mt-1 text-[10px] text-slate-500">
              Review queue transactions
              handled by your assigned
              department.
            </p>

          </div>

          {/* ====================================================
              STAT CARDS
          ==================================================== */}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

            {/* COMPLETED */}

            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  TODAY'S COMPLETED
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {completedCount}
                </p>

              </div>

              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-slate-500"
              >
                <path
                  d="M9 12l2 2 4-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />
              </svg>

            </div>

            {/* CANCELLED */}

            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  TODAY'S CANCELLED
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {cancelledCount}
                </p>

              </div>

              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-slate-500"
              >
                <rect
                  x="4"
                  y="5"
                  width="16"
                  height="14"
                  rx="2"
                />

                <path
                  d="M9 9l6 6M15 9l-6 6"
                  strokeLinecap="round"
                />
              </svg>

            </div>

            {/* AVERAGE SERVICE TIME */}

            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  AVERAGE SERVICE TIME
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {averageServiceTime}
                </p>

              </div>

              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-slate-500"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                />

                <path
                  d="M12 8v4l3 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

            </div>

          </div>

          {/* ====================================================
              HISTORY TABLE
          ==================================================== */}

          <div className="mt-6 overflow-hidden rounded-[9px] border border-[#d8e5ed] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)]">

            {/* ==================================================
                SEARCH / FILTER
            ================================================== */}

            <div className="flex items-center justify-between gap-4 border-b border-[#e7edf1] px-3 py-3">

              {/* SEARCH */}

              <div className="flex h-[23px] w-[205px] items-center gap-2 rounded-[5px] border border-[#d5e1e8] px-2">

                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3c86b5"
                  strokeWidth="2"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                  />

                  <path
                    d="m20 20-4-4"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search queue number..."
                  className="w-full bg-transparent text-[8px] outline-none placeholder:text-slate-400"
                />

              </div>

              {/* FILTERS */}

              <div className="flex items-center gap-2">

                {/* DATE RANGE */}

                <select
                  value={range}
                  onChange={(e) =>
                    setRange(
                      e.target.value
                    )
                  }
                  className="h-[23px] min-w-[68px] rounded-[5px] border border-[#d5e1e8] bg-white px-2 text-[8px] text-slate-600 outline-none"
                >
                  <option value="Today">
                    Today
                  </option>

                  <option value="This Week">
                    This Week
                  </option>

                  <option value="This Month">
                    This Month
                  </option>
                </select>

                {/* STATUS */}

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value
                    )
                  }
                  className="h-[23px] min-w-[72px] rounded-[5px] border border-[#d5e1e8] bg-white px-2 text-[8px] text-slate-600 outline-none"
                >
                  <option value="All Status">
                    All Status
                  </option>

                  <option value="Completed">
                    Completed
                  </option>

                  <option value="Cancelled">
                    Cancelled
                  </option>

                  <option value="Waiting">
                    Waiting
                  </option>
                </select>

              </div>

            </div>

            {/* ==================================================
                TABLE
            ================================================== */}

            <div className="overflow-x-auto">

              <table className="w-full min-w-[760px] table-fixed">

                <thead>

                  <tr className="border-b border-[#e7edf1]">

                    <th className="w-[16%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Queue Number
                    </th>

                    <th className="w-[15%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Service
                    </th>

                    <th className="w-[14%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Status
                    </th>

                    <th className="w-[13%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Called At
                    </th>

                    <th className="w-[13%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Started At
                    </th>

                    <th className="w-[14%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Completed At
                    </th>

                    <th className="w-[10%] px-3 py-2.5 text-left text-[8px] font-bold uppercase text-[#536170]">
                      Duration
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {/* LOADING */}

                  {historyLoading ? (
                    <tr>

                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center"
                      >

                        <p className="text-[9px] font-medium text-slate-500">
                          Loading queue history...
                        </p>

                      </td>

                    </tr>
                  ) : (
                    paginatedRows.map(
                      (
                        row,
                        index
                      ) => {

                        const normalizedStatus =
                          normalizeStatus(
                            row?.status
                          )

                        const clickable =
                          normalizedStatus ===
                            'cancelled' ||
                          normalizedStatus ===
                            'skipped'

                        return (
                          <tr
                            key={
                              row?.queue_id ||
                              row?.queueNumber ||
                              row?.queue_number ||
                              row?.id ||
                              index
                            }
                            onClick={() => {
                              if (
                                clickable
                              ) {
                                setSelectedRow(
                                  row
                                )
                              }
                            }}
                            className={`border-b border-[#edf1f4] transition ${
                              clickable
                                ? 'cursor-pointer hover:bg-[#f5faff]'
                                : 'hover:bg-[#fafcfd]'
                            }`}
                          >

                            {/* QUEUE NUMBER */}

                            <td className="px-3 py-2.5 text-[9px] font-bold text-[#263445]">
                              {row?.queueNumber ||
                                row?.queue_number ||
                                '—'}
                            </td>

                            {/* SERVICE */}

                            <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                              {row?.service ||
                                row?.department ||
                                '—'}
                            </td>

                            {/* STATUS */}

                            <td className="px-3 py-2.5">
                              <StatusBadge
                                status={
                                  row?.status
                                }
                              />
                            </td>

                            {/* CALLED AT */}

                            <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                              {formatDateTime(
                                row?.calledAt ||
                                  row?.called_at
                              )}
                            </td>

                            {/* STARTED AT */}

                            <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                              {formatDateTime(
                                row?.startedAt ||
                                  row?.service_began_at
                              )}
                            </td>

                            {/* COMPLETED AT */}

                            <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                              {formatDateTime(
                                row?.completedAt ||
                                  row?.completed_at
                              )}
                            </td>

                            {/* DURATION */}

                            <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                              {row?.duration ||
                                '—'}
                            </td>

                          </tr>
                        )
                      }
                    )
                  )}

                  {/* EMPTY */}

                  {!historyLoading &&
                    paginatedRows.length ===
                      0 && (
                      <tr>

                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center"
                        >

                          <p className="text-[9px] font-medium text-slate-500">
                            No matching
                            transactions.
                          </p>

                          <p className="mt-1 text-[8px] text-slate-400">
                            Try changing
                            your search
                            or filters.
                          </p>

                        </td>

                      </tr>
                    )}

                </tbody>

              </table>

            </div>

            {/* ==================================================
                PAGINATION
            ================================================== */}

            <div className="flex h-[31px] items-center justify-between border-t border-[#e7edf1] px-3">

              <p className="text-[7px] text-[#8794a0]">

                Showing{' '}

                {paginatedRows.length ===
                0
                  ? 0
                  : (safePage - 1) *
                      PAGE_SIZE +
                    1}

                {' '}to{' '}

                {Math.min(
                  safePage *
                    PAGE_SIZE,
                  rows.length
                )}

                {' '}of{' '}

                {rows.length}{' '}
                entries

              </p>

              <div className="flex items-center gap-1">

                {/* PREVIOUS */}

                <button
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                    )
                  }
                  disabled={
                    safePage ===
                    1
                  }
                  className="flex h-[20px] w-[20px] items-center justify-center rounded-[3px] border border-[#d5e1e8] text-[10px] text-slate-500 disabled:opacity-30"
                >
                  ‹
                </button>

                {/* PAGE NUMBERS */}

                {Array.from(
                  {
                    length:
                      totalPages,
                  },
                  (_, index) =>
                    index + 1
                ).map(
                  (number) => (
                    <button
                      key={
                        number
                      }
                      onClick={() =>
                        setPage(
                          number
                        )
                      }
                      className={`flex h-[20px] w-[20px] items-center justify-center rounded-[3px] border text-[8px] font-semibold ${
                        number ===
                        safePage
                          ? 'border-[#005b9f] bg-[#005b9f] text-white'
                          : 'border-[#d5e1e8] bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {number}
                    </button>
                  )
                )}

                {/* NEXT */}

                <button
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1
                        )
                    )
                  }
                  disabled={
                    safePage ===
                    totalPages
                  }
                  className="flex h-[20px] w-[20px] items-center justify-center rounded-[3px] border border-[#d5e1e8] text-[10px] text-slate-500 disabled:opacity-30"
                >
                  ›
                </button>

              </div>

            </div>

          </div>

        </div>

      </main>

      {/* ========================================================
          QUEUE DETAILS MODAL
      ======================================================== */}

      {selectedRow && (
        <QueueDetailsModal
          row={selectedRow}
          onClose={() =>
            setSelectedRow(null)
          }
        />
      )}

    </div>
  )
}