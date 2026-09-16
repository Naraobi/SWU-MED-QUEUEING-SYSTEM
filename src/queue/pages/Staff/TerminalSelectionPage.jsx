import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Monitor,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import { useAuth } from '../../services/Authcontext.jsx';

import {
  getTerminals,
  getStaffTerminal,
  assignTerminal,
} from '../../services/backendApi.js';

const STORAGE_KEY = 'swumed_staff_terminal';

// =====================================================
// LOCAL STORAGE
// =====================================================

function readSavedTerminal() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    return parsed &&
      typeof parsed === 'object'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function saveSelectedTerminal(terminal) {
  if (
    typeof window === 'undefined' ||
    !terminal
  ) {
    return;
  }

  const payload = {
    terminal_id:
      terminal.counter_id ??
      terminal.terminal_id ??
      terminal.id ??
      null,

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
      terminal.counter_number ??
      terminal.terminal_number ??
      null,

    department_id:
      terminal.department_id ??
      null,

    status:
      terminal.status ??
      'active',
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(payload)
  );
}

// =====================================================
// TERMINAL SELECTION PAGE
// =====================================================

export default function TerminalSelectionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [terminals, setTerminals] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const departmentId =
    user?.department_id ??
    user?.departmentId ??
    null;

  // ===================================================
  // STAFF ID
  // ===================================================

  const staffId =
    user?.id ??
    user?.user_id ??
    user?.staff_id ??
    null;

  // ===================================================
  // FILTER TERMINALS BY STAFF DEPARTMENT
  // ===================================================

  const filteredTerminals =
    useMemo(() => {
      if (!Array.isArray(terminals)) {
        return [];
      }

      if (!departmentId) {
        return terminals;
      }

      return terminals.filter(
        (terminal) => {
          const currentDepartmentId =
            terminal.department_id ??
            terminal.departmentId ??
            null;

          return (
            !currentDepartmentId ||
            String(currentDepartmentId) ===
              String(departmentId)
          );
        }
      );
    }, [
      terminals,
      departmentId,
    ]);

  // ===================================================
  // LOAD TERMINALS
  // ===================================================

  useEffect(() => {
    let mounted = true;

    async function loadTerminals() {
      try {
        setLoading(true);
        setError('');

        // ---------------------------------------------
        // GET ALL TERMINALS
        // ---------------------------------------------

        const result =
          await getTerminals();

        if (!mounted) {
          return;
        }

        const terminalList =
          Array.isArray(result)
            ? result
            : [];

        setTerminals(
          terminalList
        );

        // ---------------------------------------------
        // CHECK IF STAFF ALREADY HAS A TERMINAL
        // ---------------------------------------------

        if (staffId) {
          try {
            const assignedTerminal =
              await getStaffTerminal(
                staffId
              );

            if (
              assignedTerminal &&
              mounted
            ) {
              const assignedId =
                assignedTerminal.counter_id ??
                assignedTerminal.terminal_id ??
                assignedTerminal.id;

              if (assignedId) {
                setSelectedId(
                  String(assignedId)
                );

                saveSelectedTerminal(
                  assignedTerminal
                );
              }
            }
          } catch (assignmentError) {
            console.warn(
              'Could not check existing terminal assignment:',
              assignmentError
            );
          }
        }

        // ---------------------------------------------
        // FALLBACK TO SAVED TERMINAL
        // ---------------------------------------------

        if (mounted) {
          const saved =
            readSavedTerminal();

          if (
            saved?.terminal_id &&
            !selectedId
          ) {
            const matchingSaved =
              terminalList.find(
                (terminal) =>
                  String(
                    terminal.counter_id ??
                      terminal.terminal_id ??
                      terminal.id
                  ) ===
                  String(
                    saved.terminal_id
                  )
              );

            if (matchingSaved) {
              setSelectedId(
                String(
                  matchingSaved.counter_id ??
                    matchingSaved.terminal_id ??
                    matchingSaved.id
                )
              );
            }
          }
        }
      } catch (loadError) {
        console.error(
          'Failed to load terminals:',
          loadError
        );

        if (mounted) {
          setError(
            loadError?.message ||
              'Unable to load available terminals.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTerminals();

    return () => {
      mounted = false;
    };
  }, [staffId]);

  // ===================================================
  // SELECTED TERMINAL
  // ===================================================

  const selectedTerminal =
    filteredTerminals.find(
      (terminal) =>
        String(
          terminal.counter_id ??
            terminal.terminal_id ??
            terminal.id
        ) === String(selectedId)
    );

  // ===================================================
  // SELECT TERMINAL
  // ===================================================

  const chooseTerminal = (
    terminal
  ) => {
    const id = String(
      terminal.counter_id ??
        terminal.terminal_id ??
        terminal.id
    );

    const status =
      String(
        terminal.status ??
          'active'
      ).toLowerCase();

    const isActive =
      status === 'active' ||
      status === 'online' ||
      status === 'enabled';

    const assignedStaffId =
      terminal.assigned_staff_id ??
      terminal.assignedStaffId ??
      null;

    // -----------------------------------------------
    // DON'T ALLOW BUSY TERMINALS
    // -----------------------------------------------

    if (
      !isActive ||
      (
        assignedStaffId &&
        String(
          assignedStaffId
        ) !== String(staffId)
      )
    ) {
      setError(
        'This terminal is already assigned or unavailable.'
      );

      return;
    }

    setSelectedId(id);
    setError('');
  };

  // ===================================================
  // CONTINUE / ASSIGN TERMINAL
  // ===================================================

  const handleContinue =
    async () => {
      if (!selectedTerminal) {
        setError(
          'Please select a terminal before continuing.'
        );

        return;
      }

      if (!staffId) {
        setError(
          'Your staff account could not be identified. Please log in again.'
        );

        return;
      }

      const terminalId =
        selectedTerminal.counter_id ??
        selectedTerminal.terminal_id ??
        selectedTerminal.id;

      if (!terminalId) {
        setError(
          'The selected terminal has no valid terminal ID.'
        );

        return;
      }

      try {
        setSaving(true);
        setError('');

        // ---------------------------------------------
        // SERVER-SIDE ASSIGNMENT
        // ---------------------------------------------

        const assignedTerminal =
          await assignTerminal(
            terminalId,
            staffId
          );

        // ---------------------------------------------
        // SAVE CONFIRMED ASSIGNMENT
        // ---------------------------------------------

        saveSelectedTerminal(
          assignedTerminal ||
            selectedTerminal
        );

        // ---------------------------------------------
        // ENTER STAFF DASHBOARD
        // ---------------------------------------------

        navigate('/staff', {
          replace: true,
        });
      } catch (assignmentError) {
        console.error(
          'Failed to assign terminal:',
          assignmentError
        );

        setError(
          assignmentError?.message ||
            'Unable to assign this terminal. Please select another terminal.'
        );
      } finally {
        setSaving(false);
      }
    };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-white to-slate-100 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00569c]">
              Staff Access
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-800">
              Choose Your Terminal
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Select the terminal you are currently assigned to before entering the queue dashboard.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-[#00569c]">
            <Monitor size={24} />
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <ShieldAlert
              size={14}
              className="mt-0.5 shrink-0"
            />

            <span>
              {error}
            </span>
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-sm text-slate-500">
            <RefreshCw
              size={16}
              className="mr-2 animate-spin"
            />

            Loading available terminals...
          </div>
        ) : filteredTerminals.length === 0 ? (
          /* =================================================
             NO TERMINALS
          ================================================= */

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <p className="text-base font-semibold text-slate-700">
              No terminals are available
            </p>

            <p className="mt-2 text-sm text-slate-500">
              There are no active terminals assigned to your department yet. Please contact your administrator.
            </p>
          </div>
        ) : (
          /* =================================================
             TERMINAL GRID
          ================================================= */

          <div className="grid gap-4 md:grid-cols-2">
            {filteredTerminals.map(
              (terminal) => {
                const terminalId =
                  String(
                    terminal.counter_id ??
                      terminal.terminal_id ??
                      terminal.id
                  );

                const terminalName =
                  terminal.name ??
                  terminal.counter_name ??
                  terminal.terminal_name ??
                  `Terminal ${
                    terminal.counter_number ??
                    terminal.terminal_number ??
                    terminalId
                  }`;

                const terminalNumber =
                  terminal.counter_number ??
                  terminal.terminal_number ??
                  terminalId;

                const isSelected =
                  selectedId ===
                  terminalId;

                const statusLabel =
                  String(
                    terminal.status ??
                      'active'
                  ).toLowerCase();

                const isActive =
                  statusLabel ===
                    'active' ||
                  statusLabel ===
                    'online' ||
                  statusLabel ===
                    'enabled';

                const assignedStaffId =
                  terminal.assigned_staff_id ??
                  terminal.assignedStaffId ??
                  null;

                const isAssignedToOtherStaff =
                  assignedStaffId &&
                  String(
                    assignedStaffId
                  ) !== String(staffId);

                const isAvailable =
                  isActive &&
                  !isAssignedToOtherStaff;

                return (
                  <button
                    key={terminalId}
                    type="button"
                    onClick={() =>
                      chooseTerminal(
                        terminal
                      )
                    }
                    disabled={
                      !isAvailable ||
                      saving
                    }
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-[#00569c] bg-sky-50 shadow-md shadow-sky-100'
                        : isAvailable
                          ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Terminal
                        </p>

                        <h2 className="mt-2 text-lg font-bold text-slate-800">
                          {terminalName}
                        </h2>
                      </div>

                      {isSelected && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00569c] text-white">
                          <CheckCircle2
                            size={18}
                          />
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">

                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                        No. {terminalNumber}
                      </span>

                      <span
                        className={`rounded-full px-2 py-1 font-semibold ${
                          isAvailable
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isAvailable
                          ? 'Available'
                          : 'Busy'}
                      </span>
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                      {isSelected
                        ? 'This terminal is selected for your session.'
                        : isAvailable
                          ? 'Tap to select this terminal.'
                          : 'This terminal is currently assigned.'}
                    </p>
                  </button>
                );
              }
            )}
          </div>
        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">

          <div className="text-xs text-slate-500">
            {user?.first_name
              ? `${user.first_name} ${
                  user.last_name ||
                  ''
                }`.trim()
              : 'Staff member'}
          </div>

          <button
            type="button"
            onClick={
              handleContinue
            }
            disabled={
              saving ||
              !selectedTerminal ||
              loading ||
              filteredTerminals.length ===
                0
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#00569c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004b87] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Assigning terminal...'
              : 'Continue'}

            {saving ? (
              <RefreshCw
                size={16}
                className="animate-spin"
              />
            ) : (
              <ArrowRight
                size={16}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}