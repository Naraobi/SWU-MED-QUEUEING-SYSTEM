import React, { useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import StatCard from '../../components/ui/StatCard.jsx'
import Badge from '../../components/ui/Badge.jsx'
import QueueDetailsModal from '../../components/modals/QueueDetailsModal.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import { supabase } from '../../../supabase'
import * as api from '../../services/api'

const PAGE_SIZE = 5

export default function QueueHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  
  const [staffPrefix, setStaffPrefix] = useState('')
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All Status')
  const [range, setRange] = useState('Today')
  const [page, setPage] = useState(1)
  const [selectedRow, setSelectedRow] = useState(null)

  // 1. Fetch the official prefix from the departments table based on logged-in user's department name
  useEffect(() => {
    async function getDepartmentPrefix() {
      if (user?.department) {
        const { data, error } = await supabase
          .from('departments')
          .select('prefix')
          .eq('name', user.department)
          .maybeSingle();

        if (data?.prefix) {
          setStaffPrefix(data.prefix);
        } else {
          console.error("Could not find prefix for department:", user.department, error);
        }
      }
    }
    getDepartmentPrefix();
  }, [user]);

  // 2. Fetch queue history filtered by the staff's department prefix
  useEffect(() => {
    if (!staffPrefix) return;

    api.fetchQueueHistory({ search, status, range }, staffPrefix).then((data) => {
      setRows(data)
      setPage(1)
    })
  }, [search, status, range, staffPrefix])

  const completedCount = rows.filter((r) => r.status === 'Completed').length
  const skippedCount = rows.filter((r) => r.status === 'Skipped').length

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (authLoading || (user?.department && !staffPrefix)) {
    return <div className="flex min-h-screen items-center justify-center">Loading department history...</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 px-8 py-6">
        <Topbar 
          title="Queue History" 
          subtitle={`Review queue transactions handled by department: ${user?.department || 'General'} (${staffPrefix})`} 
        />

        <div className="mt-6 flex gap-4">
          <StatCard label="Today's Completed" value={completedCount} />
          <StatCard label="Today's Skipped" value={skippedCount} />
          <StatCard label="Today's Transaction Time" value="6 min" />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <span className="text-slate-400">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queue number..."
                className="w-full text-sm outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              >
                <option>Today</option>
                <option>This Week</option>
                <option>This Month</option>
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 outline-none"
              >
                <option>All Status</option>
                <option>Completed</option>
                <option>Skipped</option>
              </select>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Queue Number</th>
                <th className="px-5 py-3 font-semibold">Service</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Called At</th>
                <th className="px-5 py-3 font-semibold">Completed At</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((row) => {
                const clickable = row.status === 'Skipped'
                return (
                  <tr
                    key={row.queueNumber}
                    onClick={() => clickable && setSelectedRow(row)}
                    className={clickable ? 'cursor-pointer hover:bg-slate-50' : ''}
                  >
                    <td className="px-5 py-3 font-semibold text-slate-800">{row.queueNumber}</td>
                    <td className="px-5 py-3 text-slate-500">{row.service}</td>
                    <td className="px-5 py-3">
                      <Badge>{row.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{row.calledAt}</td>
                    <td className="px-5 py-3 text-slate-500">{row.completedAt || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{row.duration || '—'}</td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                    No matching transactions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-400">
            <p>
              Showing {paginated.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{' '}
              {Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 w-7 rounded-md border border-slate-200 disabled:opacity-30"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-7 w-7 rounded-md border text-xs font-medium ${
                    n === page ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 w-7 rounded-md border border-slate-200 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </main>

      {selectedRow && <QueueDetailsModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  )
}