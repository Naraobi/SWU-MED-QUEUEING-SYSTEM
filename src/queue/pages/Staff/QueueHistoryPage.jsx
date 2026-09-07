import React, { useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import QueueDetailsModal from '../../components/modals/QueueDetailsModal.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import {
  isSupabaseConfigured,
  supabase,
} from '../../../supabase'
import * as api from '../../services/api'

const PAGE_SIZE = 6

export default function QueueHistoryPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth()

  const [staffPrefix, setStaffPrefix] =
    useState('')

  const [rows, setRows] = useState([])

  const [search, setSearch] =
    useState('')

  const [status, setStatus] =
    useState('All Status')

  const [range, setRange] =
    useState('Today')

  const [page, setPage] =
    useState(1)

  const [selectedRow, setSelectedRow] =
    useState(null)

  // --------------------------------------------------
  // GET DEPARTMENT PREFIX
  // --------------------------------------------------

  useEffect(() => {
    async function getDepartmentPrefix() {
      if (!user?.department) return

      if (!isSupabaseConfigured) {
        setStaffPrefix(
          user.department_prefix || 'BP'
        )

        return
      }

      const { data, error } =
        await supabase
          .from('departments')
          .select('prefix')
          .eq('name', user.department)
          .maybeSingle()

      if (data?.prefix) {
        setStaffPrefix(data.prefix)
      } else {
        console.error(
          'Could not find prefix for department:',
          user.department,
          error
        )
      }
    }

    getDepartmentPrefix()
  }, [user])

  // --------------------------------------------------
  // FETCH HISTORY
  // --------------------------------------------------

  useEffect(() => {
    if (!staffPrefix) return

    api
      .fetchQueueHistory(
        {
          search,
          status,
          range,
        },
        staffPrefix
      )
      .then((data) => {
        setRows(data || [])
        setPage(1)
      })
      .catch((error) => {
        console.error(
          'Failed to fetch queue history:',
          error
        )

        setRows([])
      })
  }, [
    search,
    status,
    range,
    staffPrefix,
  ])

  // --------------------------------------------------
  // STATISTICS
  // --------------------------------------------------

  const completedCount =
    rows.filter(
      (row) =>
        row.status === 'Completed'
    ).length

  const skippedCount =
    rows.filter(
      (row) =>
        row.status === 'Skipped'
    ).length

  const getDurationMinutes = (
    duration
  ) => {
    if (!duration) return null

    if (typeof duration === 'number') {
      return duration
    }

    const value =
      String(duration).trim()

    if (value.includes(':')) {
      const parts =
        value.split(':').map(Number)

      if (parts.length === 2) {
        return (
          parts[0] +
          parts[1] / 60
        )
      }

      if (parts.length === 3) {
        return (
          parts[0] * 60 +
          parts[1] +
          parts[2] / 60
        )
      }
    }

    const match =
      value.match(/[\d.]+/)

    return match
      ? Number(match[0])
      : null
  }

  const durations =
    rows
      .filter(
        (row) =>
          row.status === 'Completed'
      )
      .map((row) =>
        getDurationMinutes(
          row.duration
        )
      )
      .filter(
        (value) =>
          value !== null &&
          !Number.isNaN(value)
      )

  const averageServiceTime =
    durations.length > 0
      ? `${Math.round(
          durations.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
            durations.length
        )} min`
      : '0 min'

  // --------------------------------------------------
  // PAGINATION
  // --------------------------------------------------

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rows.length / PAGE_SIZE
      )
    )

  const paginatedRows =
    rows.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    )

  // --------------------------------------------------
  // STATUS BADGE
  // --------------------------------------------------

  const StatusBadge = ({
    status,
  }) => {
    let badgeClass =
      'bg-[#edf1f4] text-[#72808b]'

    let dotClass =
      'bg-[#72808b]'

    if (status === 'Completed') {
      badgeClass =
        'bg-[#e4f1fa] text-[#1870a8]'

      dotClass =
        'bg-[#1870a8]'
    }

    if (status === 'Skipped') {
      badgeClass =
        'bg-[#fbe8e8] text-[#b43b3b]'

      dotClass =
        'bg-[#b43b3b]'
    }

    if (status === 'Waiting') {
      badgeClass =
        'bg-[#edf1f4] text-[#72808b]'

      dotClass =
        'bg-[#72808b]'
    }

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[8px] font-semibold ${badgeClass}`}
      >

        <span
          className={`h-1.5 w-1.5 rounded-full ${dotClass}`}
        />

        {status}

      </span>
    )
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (
    authLoading ||
    (user?.department &&
      !staffPrefix)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eaf5fc] text-sm text-slate-500">
        Loading department history...
      </div>
    )
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div className="staff-shell flex min-h-screen w-full bg-[#eaf5fc]">

      <Sidebar />

      <main className="min-h-screen min-w-0 flex-1">

        {/* TOPBAR */}
        <Topbar
          title={`Staff · ${
            user?.department ||
            'Department'
          }`}
          subtitle={`Managing queue for department: ${
            user?.department ||
            'General'
          } (${staffPrefix})`}
        />

        {/* SAME CONTENT OFFSET AS DASHBOARD */}
        <div className="px-4 pb-8 pt-5">

          {/* PAGE TITLE */}
          <div className="mb-5">

            <h1 className="text-[25px] font-extrabold leading-none text-[#16283b]">
              Queue History
            </h1>

            <p className="mt-1 text-[10px] text-slate-500">
              Review queue transactions handled
              by your assigned department.
            </p>

          </div>

          {/* ---------------------------------------- */}
          {/* STAT CARDS */}
          {/* ---------------------------------------- */}

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

            {/* SKIPPED */}
            <div className="flex h-[78px] items-center justify-between rounded-[9px] border border-[#73add4] bg-white px-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

              <div>

                <p className="text-[8px] font-bold uppercase tracking-wide text-[#536170]">
                  TODAY'S SKIPPED
                </p>

                <p className="mt-1 text-[20px] font-extrabold leading-none text-[#263445]">
                  {skippedCount}
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

          {/* ---------------------------------------- */}
          {/* HISTORY TABLE */}
          {/* ---------------------------------------- */}

          <div className="mt-6 overflow-hidden rounded-[9px] border border-[#d8e5ed] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.07)]">

            {/* SEARCH / FILTER */}
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

                <select
                  value={range}
                  onChange={(e) =>
                    setRange(
                      e.target.value
                    )
                  }
                  className="h-[23px] min-w-[68px] rounded-[5px] border border-[#d5e1e8] bg-white px-2 text-[8px] text-slate-600 outline-none"
                >
                  <option>
                    Today
                  </option>

                  <option>
                    This Week
                  </option>

                  <option>
                    This Month
                  </option>

                </select>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value
                    )
                  }
                  className="h-[23px] min-w-[72px] rounded-[5px] border border-[#d5e1e8] bg-white px-2 text-[8px] text-slate-600 outline-none"
                >

                  <option>
                    All Status
                  </option>

                  <option>
                    Completed
                  </option>

                  <option>
                    Skipped
                  </option>

                  <option>
                    Waiting
                  </option>

                </select>

              </div>

            </div>

            {/* -------------------------------------- */}
            {/* TABLE */}
            {/* -------------------------------------- */}

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

                  {paginatedRows.map(
                    (row, index) => {

                      const clickable =
                        row.status ===
                        'Skipped'

                      return (
                        <tr
                          key={
                            row.queueNumber ||
                            row.id ||
                            index
                          }
                          onClick={() =>
                            clickable &&
                            setSelectedRow(
                              row
                            )
                          }
                          className={`border-b border-[#edf1f4] transition ${
                            clickable
                              ? 'cursor-pointer hover:bg-[#f5faff]'
                              : 'hover:bg-[#fafcfd]'
                          }`}
                        >

                          <td className="px-3 py-2.5 text-[9px] font-bold text-[#263445]">
                            {row.queueNumber ||
                              '—'}
                          </td>

                          <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                            {row.service ||
                              'Billing / Payment'}
                          </td>

                          <td className="px-3 py-2.5">
                            <StatusBadge
                              status={
                                row.status
                              }
                            />
                          </td>

                          <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                            {row.calledAt ||
                              '—'}
                          </td>

                          <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                            {row.startedAt ||
                              '—'}
                          </td>

                          <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                            {row.completedAt ||
                              '—'}
                          </td>

                          <td className="px-3 py-2.5 text-[8px] text-[#687583]">
                            {row.duration ||
                              '—'}
                          </td>

                        </tr>
                      )
                    }
                  )}

                  {paginatedRows.length ===
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

            {/* -------------------------------------- */}
            {/* PAGINATION */}
            {/* -------------------------------------- */}

            <div className="flex h-[31px] items-center justify-between border-t border-[#e7edf1] px-3">

              <p className="text-[7px] text-[#8794a0]">

                Showing{' '}

                {paginatedRows.length ===
                0
                  ? 0
                  : (page - 1) *
                      PAGE_SIZE +
                    1}

                {' '}to{' '}

                {Math.min(
                  page * PAGE_SIZE,
                  rows.length
                )}

                {' '}of{' '}

                {rows.length}{' '}
                entries

              </p>

              <div className="flex items-center gap-1">

                <button
                  onClick={() =>
                    setPage((p) =>
                      Math.max(
                        1,
                        p - 1
                      )
                    )
                  }
                  disabled={page === 1}
                  className="flex h-[20px] w-[20px] items-center justify-center rounded-[3px] border border-[#d5e1e8] text-[10px] text-slate-500 disabled:opacity-30"
                >
                  ‹
                </button>

                {Array.from(
                  {
                    length:
                      totalPages,
                  },
                  (_, i) =>
                    i + 1
                ).map(
                  (number) => (
                    <button
                      key={number}
                      onClick={() =>
                        setPage(
                          number
                        )
                      }
                      className={`flex h-[20px] w-[20px] items-center justify-center rounded-[3px] border text-[8px] font-semibold ${
                        number === page
                          ? 'border-[#005b9f] bg-[#005b9f] text-white'
                          : 'border-[#d5e1e8] bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {number}
                    </button>
                  )
                )}

                <button
                  onClick={() =>
                    setPage((p) =>
                      Math.min(
                        totalPages,
                        p + 1
                      )
                    )
                  }
                  disabled={
                    page ===
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

      {/* DETAILS MODAL */}
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