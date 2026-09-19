import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Info, Monitor, RefreshCw, ShieldAlert } from 'lucide-react'

import { useAuth } from '../../services/Authcontext.jsx'
import {
  getTerminals,
  getStaffTerminal,
  assignTerminal,
} from '../../services/backendApi.js'

const STORAGE_KEY = 'swumed_staff_terminal'

// =====================================================
// LOCAL STORAGE (unchanged behavior from the old page)
// =====================================================

function readSavedTerminal() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

// =====================================================
// STATUS HELPERS
// =====================================================

function getTerminalStatusMeta(terminal, staffId) {
  const status = String(terminal.status ?? 'active').toLowerCase()

  const assignedStaffId =
    terminal.assigned_staff_id ?? terminal.assignedStaffId ?? null

  const assignedStaffName =
    terminal.assigned_staff_name ?? terminal.assignedStaffName ?? null

  const isOffline =
    status === 'offline' || status === 'disabled' || status === 'inactive'

  const isOccupiedByOther =
    !isOffline &&
    assignedStaffId &&
    String(assignedStaffId) !== String(staffId)

  if (isOffline) {
    return {
      label: 'Offline',
      pillClass: 'bg-slate-200 text-slate-600',
      detail:
        terminal.offline_reason || 'Hardware maintenance / connection lost',
      selectable: false,
    }
  }

  if (isOccupiedByOther) {
    return {
      label: 'Occupied',
      pillClass: 'bg-red-100 text-[#c62828]',
      detail: assignedStaffName
        ? `Occupied by ${assignedStaffName}`
        : 'Currently occupied by another staff member',
      selectable: false,
    }
  }

  return {
    label: 'Available',
    pillClass: 'bg-emerald-100 text-emerald-700',
    detail: terminal.idle_since
      ? `Idle since ${terminal.idle_since}`
      : 'Ready for immediate patient assignment',
    selectable: true,
  }
}

// =====================================================
// TERMINAL SELECT MODAL
// =====================================================

export default function TerminalSelectModal({ departmentName, onConfirm }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [terminals, setTerminals] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const departmentId = user?.department_id ?? user?.departmentId ?? null

  const staffId = user?.id ?? user?.user_id ?? user?.staff_id ?? null

  const filteredTerminals = Array.isArray(terminals)
    ? terminals.filter((terminal) => {
        if (!departmentId) return true

        const currentDepartmentId =
          terminal.department_id ?? terminal.departmentId ?? null

        return (
          !currentDepartmentId ||
          String(currentDepartmentId) === String(departmentId)
        )
      })
    : []

  // ===================================================
  // LOAD TERMINALS (same logic as the old standalone page)
  // ===================================================

  useEffect(() => {
    let mounted = true

    async function loadTerminals() {
      try {
        setLoading(true)
        setError('')

        const result = await getTerminals()
        if (!mounted) return

        const terminalList = Array.isArray(result) ? result : []
        setTerminals(terminalList)

        if (staffId) {
          try {
            const assignedTerminal = await getStaffTerminal(staffId)

            if (assignedTerminal && mounted) {
              const assignedId =
                assignedTerminal.counter_id ??
                assignedTerminal.terminal_id ??
                assignedTerminal.id

              if (assignedId) {
                setSelectedId(String(assignedId))
                saveSelectedTerminal(assignedTerminal)
              }
            }
          } catch (assignmentError) {
            console.warn(
              'Could not check existing terminal assignment:',
              assignmentError
            )
          }
        }

        if (mounted) {
          const saved = readSavedTerminal()

          if (saved?.terminal_id) {
            setSelectedId((current) => {
              if (current) return current

              const matchingSaved = terminalList.find(
                (terminal) =>
                  String(
                    terminal.counter_id ??
                      terminal.terminal_id ??
                      terminal.id
                  ) === String(saved.terminal_id)
              )

              return matchingSaved
                ? String(
                    matchingSaved.counter_id ??
                      matchingSaved.terminal_id ??
                      matchingSaved.id
                  )
                : current
            })
          }
        }
      } catch (loadError) {
        console.error('Failed to load terminals:', loadError)

        if (mounted) {
          setError(
            loadError?.message || 'Unable to load available terminals.'
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadTerminals()

    return () => {
      mounted = false
    }
  }, [staffId])

  const selectedTerminal = filteredTerminals.find(
    (terminal) =>
      String(terminal.counter_id ?? terminal.terminal_id ?? terminal.id) ===
      String(selectedId)
  )

  // ===================================================
  // SELECT
  // ===================================================

  const chooseTerminal = (terminal) => {
    const meta = getTerminalStatusMeta(terminal, staffId)

    if (!meta.selectable) {
      setError('This terminal is already assigned or unavailable.')
      return
    }

    const id = String(
      terminal.counter_id ?? terminal.terminal_id ?? terminal.id
    )

    setSelectedId(id)
    setError('')
  }

  // ===================================================
  // LOGOUT
  // ===================================================

  const handleLogout = async () => {
    await signOut()
    navigate('/superadmin/login', { replace: true })
  }

  // ===================================================
  // CONFIRM / ASSIGN
  // ===================================================

  const handleConfirm = async () => {
    if (!selectedTerminal) {
      setError('Please select a terminal before continuing.')
      return
    }

    if (!staffId) {
      setError('Your staff account could not be identified. Please log in again.')
      return
    }

    const terminalId =
      selectedTerminal.counter_id ??
      selectedTerminal.terminal_id ??
      selectedTerminal.id

    if (!terminalId) {
      setError('The selected terminal has no valid terminal ID.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const assignedTerminal = await assignTerminal(terminalId, staffId)

      saveSelectedTerminal(assignedTerminal || selectedTerminal)

      onConfirm?.(assignedTerminal || selectedTerminal)
    } catch (assignmentError) {
      console.error('Failed to assign terminal:', assignmentError)

      setError(
        assignmentError?.message ||
          'Unable to assign this terminal. Please select another terminal.'
      )
    } finally {
      setSaving(false)
    }
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">

        {/* HEADER */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Select Active Terminal
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Choose the physical counter or window you are operating today
              for {departmentName || 'your department'}.
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            Start Station
          </span>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-[#c62828]">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ASSIGNED TERMINAL / WINDOW LABEL */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Assigned Terminal / Window
          </p>

          <p className="text-[10px] font-medium text-slate-400">
            Station: {departmentName || 'General'} Queue Center
          </p>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-xs text-slate-500">
            <RefreshCw size={14} className="mr-2 animate-spin" />
            Loading available terminals...
          </div>
        ) : filteredTerminals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No terminals are available
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Please contact your administrator.
            </p>
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredTerminals.map((terminal) => {
              const terminalId = String(
                terminal.counter_id ?? terminal.terminal_id ?? terminal.id
              )

              const terminalName =
                terminal.name ??
                terminal.counter_name ??
                terminal.terminal_name ??
                `Terminal ${
                  terminal.counter_number ??
                  terminal.terminal_number ??
                  terminalId
                }`

              const meta = getTerminalStatusMeta(terminal, staffId)
              const isSelected = selectedId === terminalId

              return (
                <button
                  key={terminalId}
                  type="button"
                  onClick={() => chooseTerminal(terminal)}
                  disabled={!meta.selectable || saving}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-[#c62828] bg-red-50/40'
                      : meta.selectable
                      ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                      <Monitor size={16} />
                    </span>

                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {terminalName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {meta.detail}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${meta.pillClass}`}
                  >
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* INFO NOTE */}
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Logging into this terminal routes new patient tickets directly to
            your physical window and display board.
          </span>
        </div>

        {/* FOOTER */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
      <button
  type="button"
  onClick={handleLogout}
  className="rounded-md border px-3 py-2 text-xs font-semibold text-[#334155] transition hover:bg-slate-50"
>
  [→ Logout
</button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !selectedTerminal || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#c62828] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#a92121] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Assigning terminal...' : 'Confirm & Open Terminal'}

            {saving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}