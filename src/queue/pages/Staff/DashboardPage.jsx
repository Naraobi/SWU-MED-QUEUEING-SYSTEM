import React, { useState, useEffect, useMemo, useRef } from 'react'

import { getOfflineData } from '../../services/offlineStorage'

import {
  Users,
  UserCheck,
  CheckCircle2,
  SkipForward,
  Play,
  Monitor,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  Info,
  LogOut,
  Clock,
  X,
  Search,
} from 'lucide-react'

import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import TerminalSelectionPage from './TerminalSelectionPage.jsx'
import { useQueue } from '../../context/QueueContext.jsx'
import { useAuth } from '../../services/Authcontext.jsx'
import {
  getDepartments,
  getDepartmentById,
  getTerminals,
  getStaffTerminal,
  assignTerminal,
} from '../../services/backendApi.js'

const STAFF_TERMINAL_KEY = 'swumed_staff_terminal'

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function readSavedTerminal() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STAFF_TERMINAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function saveSelectedTerminal(terminal) {
  if (typeof window === 'undefined' || !terminal) return

  const payload = {
    terminal_id:
      terminal.counter_id ?? terminal.terminal_id ?? terminal.id ?? null,
    name:
      terminal.name ??
      terminal.counter_name ??
      terminal.terminal_name ??
      `Terminal ${
        terminal.counter_number ??
        terminal.terminal_number ??
        terminal.counter_id ??
        ''
      }`,
    counter_number:
      terminal.counter_number ?? terminal.terminal_number ?? null,
    department_id: terminal.department_id ?? null,
    status: terminal.status ?? 'active',
  }

  window.localStorage.setItem(STAFF_TERMINAL_KEY, JSON.stringify(payload))
}

function formatSeconds(totalSeconds) {
  const seconds = Number(totalSeconds) || 0
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function matchesStaffDepartment(patientId, staffPrefix) {
  if (!patientId || !staffPrefix) return false
  const cleanId = String(patientId).startsWith('P-')
    ? String(patientId).slice(2)
    : String(patientId)
  return cleanId.startsWith(`${staffPrefix}-`)
}

// =====================================================
// FULL QUEUE MODAL
// =====================================================

function FullQueueModal({ waitingQueue, departmentName, onClose }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('All')

  const priorityCount = waitingQueue.filter(p => String(p.id).startsWith('P-') || p.service === 'Priority').length
  const regularCount = waitingQueue.length - priorityCount

  const filteredList = useMemo(() => {
    return waitingQueue.filter((patient) => {
      const isPriority = String(patient.id).startsWith('P-') || patient.service === 'Priority'
      
      if (activeTab === 'Priority' && !isPriority) return false
      if (activeTab === 'Regular' && isPriority) return false

      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase()
        const qId = String(patient.id || '').toLowerCase()
        if (!qId.includes(query)) return false
      }

      return true
    })
  }, [waitingQueue, searchTerm, activeTab])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 bg-white">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold text-slate-900">Waiting Queue</h2>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-[#9D0A0E] border border-red-100">
                {waitingQueue.length} Patients
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Real-time list of all patients currently waiting for {departmentName}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-slate-50/50">
          <div className="relative w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search queue number..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-800 outline-none focus:border-slate-400 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('All')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'All'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              All ({waitingQueue.length})
            </button>
            <button
              onClick={() => setActiveTab('Priority')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'Priority'
                  ? 'bg-[#9D0A0E] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Priority {priorityCount > 0 && <span className="ml-1 opacity-80">({priorityCount})</span>}
            </button>
            <button
              onClick={() => setActiveTab('Regular')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === 'Regular'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Regular {regularCount > 0 && <span className="ml-1 opacity-80">({regularCount})</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-6">Position</th>
                <th className="py-3 px-6">Queue Number</th>
                <th className="py-3 px-6">Type</th>
                <th className="py-3 px-6">Est. Wait</th>
                <th className="py-3 px-6 text-right">Issued At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredList.length > 0 ? (
                filteredList.map((patient, index) => {
                  const isPriority = String(patient.id).startsWith('P-') || patient.service === 'Priority'
                  const originalIndex = waitingQueue.findIndex(p => p.id === patient.id)
                  
                  const issuedTime = patient.issuedAt || patient.created_at 
                    ? new Date(patient.issuedAt || patient.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    : '8:05 AM'

                  return (
                    <tr key={patient.uniqueKey || patient.id || index} className="hover:bg-slate-50/80 transition">
                      <td className={`py-3.5 px-6 font-bold ${originalIndex === 0 ? 'text-[#9D0A0E]' : 'text-slate-700'}`}>
                        #{originalIndex + 1}
                      </td>
                      <td className={`py-3.5 px-6 font-extrabold ${isPriority ? 'text-[#9D0A0E]' : 'text-slate-900'}`}>
                        {patient.id}
                      </td>
                      <td className="py-3.5 px-6">
                        {isPriority ? (
                          <span className="rounded bg-[#9D0A0E] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-xs">
                            PRIORITY
                          </span>
                        ) : (
                          <span className="rounded bg-slate-200/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700">
                            Regular
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-600">
                        ~{patient.etaMinutes || (originalIndex + 1) * 4} min {originalIndex === 0 ? '(Next in line)' : `(${originalIndex} ahead)`}
                      </td>
                      <td className="py-3.5 px-6 text-right font-medium text-slate-500">
                        {issuedTime}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    No matching patients found in the waiting queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
          <p className="text-[11px] text-slate-500">
            Showing {filteredList.length} waiting patients in automated FIFO sequence.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}

// =====================================================
// SKIP QUEUE MODAL
// =====================================================

function SkipQueueModal({ patient, department, terminal, currentSeconds, onCancel, onConfirm }) {
  const [reason, setReason] = useState('Patient did not arrive')
  const [customReason, setCustomReason] = useState('')

  const formattedWaitTime = useMemo(() => {
    const totalSecs = currentSeconds || 0
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [currentSeconds])

  const handleConfirm = () => {
    const finalReason = reason === 'Other' ? (customReason.trim() || 'Other') : reason
    onConfirm(finalReason)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-950">Skip Queue?</h3>
        <p className="mt-1 text-xs text-slate-500">
          Are you sure you want to skip this queue? The transaction will be recorded as skipped.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Queue Number</span>
              <p className="mt-0.5 font-extrabold text-slate-900 text-sm">{patient?.id || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service</span>
              <p className="mt-0.5 font-semibold text-slate-800">{patient?.service || department}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</span>
              <p className="mt-0.5 font-semibold text-slate-800">{department}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terminal</span>
              <p className="mt-0.5 font-semibold text-slate-800">{terminal}</p>
            </div>
          </div>
          <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">Waiting Time</span>
            <span className="font-extrabold text-[#9D0A0E]">{formattedWaitTime}</span>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Reason for skipping</p>
          <div className="space-y-2 text-xs">
            {[
              'Patient did not arrive',
              'Patient requested cancellation',
              'Patient was called but unavailable',
              'Other',
            ].map((item) => (
              <div key={item} className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="skipReason"
                    value={item}
                    checked={reason === item}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-[#9D0A0E] focus:ring-[#9D0A0E]"
                  />
                  <span className="font-medium text-slate-700">{item}</span>
                </label>
                {item === 'Other' && reason === 'Other' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please specify reason..."
                    className="ml-6 w-[calc(100%-1.5rem)] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-500 transition"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-[#9D0A0E] px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#80080b] transition cursor-pointer"
          >
            Confirm Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// MAIN DASHBOARD PAGE
// =====================================================

export default function DashboardPage() {
  const {
    waitingQueue,
    currentlyServing,
    stats,
    loading: queueLoading,
    refresh,
    callNextPatient,
    markPatientArrived,
    startService,
    recallCurrentPatient,
    completeCurrentPatient,
    skipCurrentPatient,
  } = useQueue()

  const { user, loading: authLoading, logout } = useAuth()

  const [staffPrefix, setStaffPrefix] = useState('')
  const [showSkip, setShowSkip] = useState(false)
  const [startingService, setStartingService] = useState(false)
  const [departmentLoading, setDepartmentLoading] = useState(true)

  const [selectedTerminal, setSelectedTerminal] = useState(() =>
    readSavedTerminal()
  )
  const [showTerminalModal, setShowTerminalModal] = useState(() => {
    const saved = readSavedTerminal()
    return !saved
  })

  const [showFullQueueModal, setShowFullQueueModal] = useState(false)
  const [localSeconds, setLocalSeconds] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function getDepartmentPrefix() {
      if (!user) {
        if (!cancelled) {
          setStaffPrefix('')
          setDepartmentLoading(false)
        }
        return
      }

setDepartmentLoading(true)

try {
  const directPrefix =
    user.department_prefix ||
    user.departmentPrefix ||
    user.prefix

  if (directPrefix) {
    if (!cancelled) {
      setStaffPrefix(String(directPrefix).trim())
      setDepartmentLoading(false)
    }
    return
  }

  // ============================================================
  // OFFLINE: USE CACHED DEPARTMENT DATA
  // ============================================================

  if (!navigator.onLine && user.department_id) {
    try {
      const cachedDepartments =
        await getOfflineData(
          `departments_${user.kiosk_id}`
        )

      if (cancelled) return

      const matched = Array.isArray(cachedDepartments)
        ? cachedDepartments.find(
            (d) =>
              String(d.department_id) ===
              String(user.department_id)
          )
        : null

      if (matched?.prefix) {
        setStaffPrefix(
          String(matched.prefix).trim()
        )
        setDepartmentLoading(false)
        return
      }
    } catch (offlineError) {
      console.error(
        'Failed to retrieve cached department:',
        offlineError
      )
    }
  }

  // ============================================================
  // ONLINE: GET DEPARTMENT BY ID
  // ============================================================

  if (user.department_id) {
    try {
      const dept =
        await getDepartmentById(
          user.department_id
        )

      if (cancelled) return

      if (dept?.prefix) {
        setStaffPrefix(
          String(dept.prefix).trim()
        )
        setDepartmentLoading(false)
        return
      }
    } catch (err) {
      console.error(
        'Failed to retrieve department by ID:',
        err
      )
    }
  }

  // ============================================================
  // ONLINE: FALLBACK TO DEPARTMENT LIST
  // ============================================================

  if (user.department) {
    try {
      const departments =
        await getDepartments()

      if (cancelled) return

      const matched =
        Array.isArray(departments)
          ? departments.find(
              (d) =>
                (d.name &&
                  d.name
                    .trim()
                    .toLowerCase() ===
                    user.department
                      .trim()
                      .toLowerCase()) ||
                (user.department_id &&
                  String(d.department_id) ===
                    String(
                      user.department_id
                    ))
            )
          : null

      if (matched?.prefix) {
        setStaffPrefix(
          String(matched.prefix).trim()
        )
        setDepartmentLoading(false)
        return
      }
    } catch (err) {
      console.error(
        'Failed to retrieve departments list:',
        err
      )
    }
  }

  if (!cancelled) {
    setStaffPrefix('')
  }
} catch (error) {
  console.error(
    'Failed to resolve staff department prefix:',
    error
  )

  if (!cancelled) {
    setStaffPrefix('')
  }
} finally {
  if (!cancelled) {
    setDepartmentLoading(false)
  }
}
    }

    getDepartmentPrefix()

    return () => {
      cancelled = true
    }
  }, [
    user?.department_id,
    user?.department,
    user?.department_prefix,
    user?.departmentPrefix,
    user?.prefix,
  ])

  useEffect(() => {
    if (!staffPrefix) return
    refresh(staffPrefix)
  }, [staffPrefix, refresh])

  useEffect(() => {
    if (!staffPrefix) return
    const interval = setInterval(() => {
      refresh(staffPrefix)
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [staffPrefix, refresh])

  const filteredWaitingQueue = useMemo(() => {
    return waitingQueue.filter((patient) =>
      matchesStaffDepartment(patient.id, staffPrefix)
    )
  }, [waitingQueue, staffPrefix])

  const isCurrentForStaff = currentlyServing
    ? matchesStaffDepartment(currentlyServing.id, staffPrefix)
    : false

  const activeServing = isCurrentForStaff ? currentlyServing : null

  const nextPatient = filteredWaitingQueue[0] || null

  const upcomingQueue = useMemo(() => {
    if (filteredWaitingQueue.length === 0) return []
    if (activeServing && filteredWaitingQueue.length > 1) {
      return filteredWaitingQueue.slice(1)
    }
    return filteredWaitingQueue
  }, [filteredWaitingQueue, activeServing])

  const serviceHasStarted = Boolean(
    activeServing?.serviceBeganAt || activeServing?.service_began_at
  )

  useEffect(() => {
    let interval
    if (serviceHasStarted && activeServing) {
      setLocalSeconds(0) 
      interval = setInterval(() => {
        setLocalSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      setLocalSeconds(0)
    }
    return () => clearInterval(interval)
  }, [serviceHasStarted, activeServing?.id])

  const handleStartService = async () => {
    if (!activeServing || startingService) return
    try {
      setStartingService(true)
      await startService(staffPrefix)
      await refresh(staffPrefix)
    } catch (error) {
      console.error('Failed to start service:', error)
    } finally {
      setStartingService(false)
    }
  }

  const handleConfirmSkip = async (reason) => {
    if (!staffPrefix) return
    try {
      await skipCurrentPatient(reason, staffPrefix)
      await refresh(staffPrefix)
      setShowSkip(false)
    } catch (error) {
      console.error('Failed to skip patient:', error)
    }
  }

  if (authLoading || departmentLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] text-sm font-medium text-slate-500">
        <RefreshCw size={24} className="mr-3 animate-spin text-[#851010]" />
        Loading staff profile & department...
      </div>
    )
  }

  if (user?.department && !staffPrefix) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f6f8] p-4 text-center">
        <p className="text-xl font-bold text-slate-800">
          Department Prefix Not Found
        </p>
        <p className="mt-2 text-base text-slate-500">
          No queue prefix was found for &quot;{user.department}&quot;. Please
          contact an administrator.
        </p>
      </div>
    )
  }

  const departmentLabel = user?.department || 'Billing Department'
  const terminalDisplayName = selectedTerminal?.name || 'Terminal 2'
  const serviceDisplayName = activeServing?.service || 'Billing / Payment'

  return (
    <div className="staff-shell flex min-h-screen w-full bg-[#f4f6f8] font-sans antialiased text-slate-800">
      <Sidebar />

      <main className="min-h-screen min-w-0 flex-1 flex flex-col">
        <Topbar
          title={`Staff · ${departmentLabel}`}
          subtitle={`Managing queue for department: ${departmentLabel} (${staffPrefix})`}
          currentTerminal={selectedTerminal}
          onOpenTerminalModal={() => setShowTerminalModal(true)}
        />

        <div className="p-8 flex-1 flex flex-col max-w-[1600px] w-full mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Today's Queue
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage and monitor the queue assigned to your department.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex items-start justify-between h-32">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  WAITING
                </p>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  {filteredWaitingQueue.length}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  TOTAL WAITING
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#851010] border border-red-100/60">
                <Users size={24} />
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex items-start justify-between h-32">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  CURRENTLY SERVING
                </p>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  {serviceHasStarted && activeServing ? 1 : 0}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  TOTAL SERVING
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#851010] border border-red-100/60">
                <UserCheck size={24} />
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex items-start justify-between h-32">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  COMPLETED
                </p>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  {stats.completed || 0}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  TOTAL COMPLETED
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#851010] border border-red-100/60">
                <CheckCircle2 size={24} />
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm flex items-start justify-between h-32">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  SKIPPED
                </p>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  {stats.skipped || 0}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  TOTAL SKIPPED
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#851010] border border-red-100/60">
                <SkipForward size={24} />
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(350px,1fr)] flex-1 items-start">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-10 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  CURRENTLY SERVING
                </p>

                {queueLoading ? (
                  <div className="py-12 text-sm text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-3 animate-spin text-[#851010]" />
                    Loading queue status...
                  </div>
                ) : activeServing ? (
                  serviceHasStarted ? (
                    <div className="mt-4">
                      <p className="text-[90px] leading-none font-black text-[#851010] tracking-tight">
                        {activeServing.id}
                      </p>

                      <p className="mt-4 text-base font-medium text-slate-500">
                        Service: {serviceDisplayName} &nbsp;|&nbsp; Terminal:{' '}
                        {activeServing.terminal || terminalDisplayName}
                      </p>

                      <div className="mt-6">
                        <p className="text-sm font-bold uppercase tracking-wider text-slate-800">
                          SERVING PATIENT
                        </p>
                        <div className="mx-auto mt-3 flex w-fit items-center justify-center gap-2 rounded-full bg-slate-100 px-6 py-2.5 text-base font-bold text-slate-800">
                          <Clock size={18} className="text-slate-700" />
                          <span>
                            {formatSeconds(localSeconds)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-8 flex justify-center">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await completeCurrentPatient(staffPrefix)
                              await refresh(staffPrefix)
                            } catch (err) {
                              console.error('Complete error:', err)
                            }
                          }}
                          className="rounded-xl bg-[#851010] px-14 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#6b0d0d] transition cursor-pointer"
                        >
                          COMPLETE
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <p className="text-[90px] leading-none font-black text-[#851010] tracking-tight">
                        {activeServing.id}
                      </p>

                      <p className="mt-4 text-base font-medium text-slate-500">
                        Service: {serviceDisplayName} &nbsp;|&nbsp; Terminal:{' '}
                        {activeServing.terminal || terminalDisplayName}
                      </p>

                      <div className="mt-6">
                        <p className="text-sm font-bold uppercase tracking-wider text-slate-800">
                          PATIENT READY
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Waiting to start service
                        </p>
                      </div>

                      <div className="mt-8 flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await recallCurrentPatient(staffPrefix)
                              await refresh(staffPrefix)
                            } catch (err) {
                              console.error('Recall error:', err)
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-10 py-3.5 text-sm font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
                        >
                          RECALL
                        </button>

                        <button
                          type="button"
                          onClick={handleStartService}
                          disabled={startingService}
                          className="rounded-xl bg-[#851010] px-12 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-sm hover:bg-[#6b0d0d] transition cursor-pointer disabled:opacity-50"
                        >
                          {startingService ? 'STARTING...' : 'START SERVING'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowSkip(true)}
                          className="rounded-xl border border-red-200 bg-red-50/50 px-10 py-3.5 text-sm font-bold uppercase tracking-wider text-red-600 hover:bg-red-100/50 transition shadow-sm cursor-pointer"
                        >
                          SKIP
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-slate-500">
                      Service: — &nbsp;|&nbsp; Terminal: {terminalDisplayName}
                    </p>

                    <p className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-700">
                      {stats.completed > 0
                        ? 'READY FOR NEXT PATIENT'
                        : 'WAITING TO CALL PATIENT'}
                    </p>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!staffPrefix) return
                        try {
                          await callNextPatient(staffPrefix)
                          await refresh(staffPrefix)
                        } catch (err) {
                          console.error('Call next error:', err)
                        }
                      }}
                      disabled={!nextPatient || !staffPrefix}
                      className="mt-6 inline-flex items-center justify-center gap-3 rounded-xl bg-[#851010] px-12 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-[#6b0d0d] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={18} className="fill-current" />
                      <span>
                        {stats.completed > 0
                          ? 'CALL NEXT PATIENT'
                          : 'CALL PATIENT'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  NEXT PATIENT
                </p>
                <p className="mt-2 text-4xl font-extrabold text-slate-900">
                  {nextPatient ? nextPatient.id : '—'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <p className="text-lg font-bold text-slate-800">
                  Waiting Queue
                </p>
                <span className="rounded-full bg-red-50 px-3.5 py-1 text-xs font-bold text-[#851010] border border-red-100">
                  {filteredWaitingQueue.length} Patients
                </span>
              </div>

              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                {upcomingQueue.length > 0 ? (
                  upcomingQueue.map((patient, index) => {
                    const isPriority =
                      String(patient.id).startsWith('P-') ||
                      patient.service === 'Priority'

                    return (
                      <div
                        key={patient.uniqueKey || patient.id || index}
                        className="flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition"
                      >
                        <p
                          className={`text-base font-bold ${
                            isPriority ? 'text-[#851010]' : 'text-slate-800'
                          }`}
                        >
                          {patient.id}
                        </p>
                        <p className="text-sm font-medium text-slate-400">
                          ~{patient.etaMinutes || (index + 2) * 4} min ({index + 2}{' '}
                          ahead)
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-16 text-center text-sm text-slate-400">
                    No patients currently waiting.
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 p-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowFullQueueModal(true)}
                  className="text-sm font-semibold text-[#851010] hover:underline cursor-pointer"
                >
                  View Full Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showTerminalModal && (
        <TerminalSelectionPage
          currentTerminal={selectedTerminal}
          canClose={Boolean(selectedTerminal)}
          onClose={() => setShowTerminalModal(false)}
          onConfirm={(terminal) => {
            setSelectedTerminal(terminal)
            setShowTerminalModal(false)
            if (staffPrefix) refresh(staffPrefix)
          }}
        />
      )}

      {showSkip && activeServing && (
        <SkipQueueModal
          patient={activeServing}
          department={departmentLabel}
          terminal={terminalDisplayName}
          currentSeconds={localSeconds}
          onCancel={() => setShowSkip(false)}
          onConfirm={handleConfirmSkip}
        />
      )}

      {showFullQueueModal && (
        <FullQueueModal
          waitingQueue={filteredWaitingQueue}
          departmentName={departmentLabel}
          onClose={() => setShowFullQueueModal(false)}
        />
      )}
    </div>
  )
}