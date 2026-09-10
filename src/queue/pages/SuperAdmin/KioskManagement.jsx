import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Monitor,
  MoreVertical,
  Plus,
  X,
} from 'lucide-react';
import { supabase } from '../../../supabase';
import {
  createCounterForDepartment,
  fetchStaffForDepartment,
} from '../../services/api';

export default function KioskManagement() {
  const [kiosks, setKiosks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedKiosk, setExpandedKiosk] = useState(null);
const [expandedDepartment, setExpandedDepartment] = useState(null);

const [terminalModal, setTerminalModal] = useState(null);
const [kioskModal, setKioskModal] = useState(null);
const [kioskName, setKioskName] = useState('');
const [kioskStatus, setKioskStatus] = useState('inactive');
const [savingKiosk, setSavingKiosk] = useState(false);
const [kioskError, setKioskError] = useState(null);
const [terminalForm, setTerminalForm] = useState({
  counterNumber: '',
  prefix: '',
  status: 'inactive',
  assignedStaffId: '',
});
const [savingTerminal, setSavingTerminal] = useState(false);
const [terminalError, setTerminalError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadKioskData() {
      try {
        const [kioskResult, departmentResult, terminalResult] =
          await Promise.all([
            supabase
              .from('kiosk')
              .select('kiosk_id, name, status')
              .order('name'),

            supabase
              .from('departments')
              .select('department_id, name, status, kiosk_id')
              .order('name'),

            supabase
              .from('counter')
              .select(
                'counter_id, counter_number, prefix, status, department_id, assigned_staff_id'
              )
              .order('counter_number'),
          ]);

        if (kioskResult.error) {
          throw kioskResult.error;
        }

        if (departmentResult.error) {
          throw departmentResult.error;
        }

        if (terminalResult.error) {
          throw terminalResult.error;
        }

        if (mounted) {
          setKiosks(kioskResult.data ?? []);
          setDepartments(departmentResult.data ?? []);
          setTerminals(terminalResult.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        console.error('FETCH KIOSK DATA ERROR:', err);

        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadKioskData();

    return () => {
      mounted = false;
    };
  }, []);

async function handleToggleKioskStatus(kiosk) {
  const nextStatus =
    kiosk.status === 'active' ? 'inactive' : 'active';

  const actionText =
    nextStatus === 'active' ? 'activate' : 'deactivate';

  const confirmed = window.confirm(
    `Are you sure you want to ${actionText} "${kiosk.name}"?`
  );

  if (!confirmed) return;

  try {
    const { data, error } = await supabase
      .from('kiosk')
      .update({
        status: nextStatus,
      })
      .eq('kiosk_id', kiosk.kiosk_id)
    .select('kiosk_id, name, status')
    .maybeSingle();

    if (error) {
  throw error;
}

if (data) {
  setKiosks((current) =>
    current.map((item) =>
      item.kiosk_id === data.kiosk_id
        ? data
        : item
    )
  );
}
  } catch (err) {
    console.error('UPDATE KIOSK STATUS ERROR:', err);

    window.alert(
      err.message || 'Failed to update kiosk status.'
    );
  }
}

function openEditKioskModal(kiosk) {
  setKioskModal(kiosk);
  setKioskName(kiosk.name || '');
  setKioskStatus(kiosk.status || 'inactive');
  setKioskError(null);
}

async function handleSaveKiosk() {
  if (!kioskModal) return;

  const trimmedName = kioskName.trim();

  if (!trimmedName) {
    setKioskError('Kiosk name is required.');
    return;
  }

  try {
    setSavingKiosk(true);
    setKioskError(null);

    const { data, error } = await supabase
      .from('kiosk')
      .update({
  name: trimmedName,
  status: kioskStatus,
  updated_at: new Date().toISOString(),
})
      .eq('kiosk_id', kioskModal.kiosk_id)
      .select('kiosk_id, name, status')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Kiosk could not be updated.');
    }

    setKiosks((current) =>
      current.map((kiosk) =>
        kiosk.kiosk_id === data.kiosk_id
          ? data
          : kiosk
      )
    );

    setKioskModal(null);
setKioskName('');
setKioskStatus('inactive');
  } catch (err) {
    console.error('UPDATE KIOSK ERROR:', err);
    setKioskError(
      err.message || 'Failed to update kiosk.'
    );
  } finally {
    setSavingKiosk(false);
  }
}

  function toggleKiosk(kioskId) {
    setExpandedKiosk((current) =>
      current === kioskId ? null : kioskId
    );

    setExpandedDepartment(null);
  }

  function toggleDepartment(departmentId) {
    setExpandedDepartment((current) =>
      current === departmentId ? null : departmentId
    );
  }


async function openTerminalModal(department) {
  setTerminalModal(department);

  setTerminalForm({
    counterNumber: '',
    prefix: '',
    status: 'inactive',
    assignedStaffId: '',
  });

  setTerminalError(null);

  try {
    const { data: departmentData, error } = await supabase
      .from('departments')
      .select('prefix')
      .eq('department_id', department.department_id)
      .single();

    if (error) {
      throw error;
    }

    const departmentPrefix =
      departmentData?.prefix?.trim().toUpperCase() || '';

    const departmentTerminals = terminals.filter(
      (terminal) =>
        terminal.department_id === department.department_id
    );

    const usedNumbers = departmentTerminals
      .map((terminal) => Number(terminal.counter_number))
      .filter(
        (number) =>
          Number.isInteger(number) && number > 0
      );

    let nextCounterNumber = 1;

    while (usedNumbers.includes(nextCounterNumber)) {
      nextCounterNumber++;
    }

    setTerminalForm({
      counterNumber: String(nextCounterNumber),
      prefix: `${departmentPrefix}${nextCounterNumber}`,
      status: 'inactive',
      assignedStaffId: '',
    });
  } catch (err) {
    console.error(
      'GENERATE TERMINAL PREFIX ERROR:',
      err
    );

    setTerminalError(
      err.message ||
        'Unable to generate terminal number and prefix.'
    );
  }
}

async function openEditTerminalModal(terminal) {
  setTerminalModal({
    mode: 'edit',
    ...terminal,
  });

  setTerminalForm({
    counterNumber: String(terminal.counter_number ?? ''),
    prefix: terminal.prefix || '',
    status: terminal.status || 'inactive',
    assignedStaffId: terminal.assigned_staff_id || '',
  });

  setTerminalError(null);

  try {
    const department = departments.find(
      (item) => item.department_id === terminal.department_id
    );

    const staff = await fetchStaffForDepartment(department?.name);

    setStaffOptions(staff);
  } catch (err) {
    console.error('LOAD TERMINAL STAFF ERROR:', err);
    setStaffOptions([]);
    setTerminalError(
      err.message || 'Failed to load staff.'
    );
  }
}

async function handleSaveTerminal() {
  if (!terminalModal) return;

  try {
    setSavingTerminal(true);
    setTerminalError(null);

if (terminalModal.mode === 'edit') {
  const assignedStaffId =
    terminalForm.assignedStaffId || null;

  // If a staff member is being assigned to this terminal,
  // remove them from any other terminal in the same department first.
  if (assignedStaffId) {
    const { error: clearAssignmentError } = await supabase
      .from('counter')
      .update({
        assigned_staff_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('department_id', terminalModal.department_id)
      .eq('assigned_staff_id', assignedStaffId)
      .neq('counter_id', terminalModal.counter_id);

    if (clearAssignmentError) {
      throw clearAssignmentError;
    }
  }

  const { data, error } = await supabase
    .from('counter')
    .update({
      counter_number: Number(terminalForm.counterNumber),
      prefix: terminalForm.prefix.trim().toUpperCase(),
      status: terminalForm.status,
      assigned_staff_id: assignedStaffId,
      updated_at: new Date().toISOString(),
    })
    .eq('counter_id', terminalModal.counter_id)
    .select(`
      counter_id,
      department_id,
      counter_number,
      prefix,
      assigned_staff_id,
      status,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    throw error;
  }

  setTerminals((current) =>
    current.map((terminal) =>
      terminal.counter_id === data.counter_id
        ? data
        : terminal
    )
  );

      if (error) {
        throw error;
      }

      const { data: refreshedTerminals, error: refreshError } =
  await supabase
    .from('counter')
    .select(`
      counter_id,
      department_id,
      counter_number,
      prefix,
      assigned_staff_id,
      status,
      created_at,
      updated_at
    `)
    .eq('department_id', terminalModal.department_id)
    .order('counter_number');

if (refreshError) {
  throw refreshError;
}

setTerminals((current) => [
  ...current.filter(
    (terminal) =>
      terminal.department_id !== terminalModal.department_id
  ),
  ...(refreshedTerminals || []),
]);
    } else {
  const createdTerminal =
    await createCounterForDepartment({
      departmentId: terminalModal.department_id,
      status: terminalForm.status,
    });

  setTerminals((current) => [
    ...current,
    createdTerminal,
  ]);
}

    setTerminalModal(null);
    setTerminalForm({
  counterNumber: '',
  prefix: '',
  status: 'inactive',
  assignedStaffId: '',
});
  } catch (err) {
    console.error('SAVE TERMINAL ERROR:', err);
    setTerminalError(
      err.message || 'Failed to save terminal.'
    );
  } finally {
    setSavingTerminal(false);
  }
}

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          Kiosk Management
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage kiosks, departments, and terminals.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading kiosks...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Kiosks */}
      {!loading && !error && (
        <div className="space-y-4">
          {kiosks.map((kiosk) => {
            const kioskDepartments = departments.filter(
              (department) => department.kiosk_id === kiosk.kiosk_id
            );

            const isKioskExpanded =
              expandedKiosk === kiosk.kiosk_id;

            return (
              <div
                key={kiosk.kiosk_id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Kiosk Header */}
<div className="flex w-full items-center gap-4 p-5 transition hover:bg-slate-50">
  <button
    type="button"
    onClick={() => toggleKiosk(kiosk.kiosk_id)}
    className="flex min-w-0 flex-1 items-center gap-4 text-left"
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#00529B]">
      <Monitor size={22} />
    </div>

    <div className="min-w-0 flex-1">
      <h2 className="text-base font-semibold text-slate-800">
        {kiosk.name}
      </h2>

      <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
        <MapPin size={15} />
        <span>Kiosk location</span>
      </div>
    </div>
  </button>

  <div className="flex items-center gap-2">

    {/* Kiosk Actions */}
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openEditKioskModal(kiosk);
      }}
      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      title="Kiosk actions"
    >
      <MoreVertical size={20} />
    </button>

    <div className="shrink-0 text-slate-400">
      {isKioskExpanded ? (
        <ChevronDown size={20} />
      ) : (
        <ChevronRight size={20} />
      )}
    </div>
  </div>
</div>

                {/* Departments */}
                {isKioskExpanded && (
                  <div className="border-t border-slate-100 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">
                          Departments
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Departments assigned to this kiosk
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#00529B] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#003f78]"
                      >
                        <Plus size={16} />
                        <span className="hidden sm:inline">
                          Add Department
                        </span>
                      </button>
                    </div>

                    {kioskDepartments.length > 0 ? (
                      <div className="space-y-2">
                        {kioskDepartments.map((department) => {
                          const isDepartmentExpanded =
                            expandedDepartment ===
                            department.department_id;

                          const departmentTerminals =
                            terminals.filter(
                              (terminal) =>
                                terminal.department_id ===
                                department.department_id
                            );

                          return (
                            <div
                              key={department.department_id}
                              className="overflow-hidden rounded-xl border border-slate-200"
                            >
                              {/* Department Header */}
                              <button
                                type="button"
                                onClick={() =>
                                  toggleDepartment(
                                    department.department_id
                                  )
                                }
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                              >
                                <div className="shrink-0 text-slate-400">
                                  {isDepartmentExpanded ? (
                                    <ChevronDown size={18} />
                                  ) : (
                                    <ChevronRight size={18} />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-800">
                                    {department.name}
                                  </p>
                                </div>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                    department.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {department.status}
                                </span>

                              </button>

                              {/* Terminals */}
                              {isDepartmentExpanded && (
                                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        Terminals
                                      </h4>

                                      <p className="mt-1 text-xs text-slate-400">
                                        Terminals assigned to this department
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openTerminalModal(department);
                                        }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#00529B] hover:text-[#00529B]"
                                      title="Add Terminal"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>

                                  {departmentTerminals.length > 0 ? (
                                    <div className="mt-4 space-y-2">
                                      {departmentTerminals.map(
                                        (terminal) => (
                                          <div
  key={terminal.counter_id}
  onClick={() => openEditTerminalModal(terminal)}
  className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-[#00529B] hover:bg-blue-50/30"
>
                                            <div>
                                              <p className="text-sm font-medium text-slate-800">
                                                Terminal{' '}
                                                {
                                                  terminal.counter_number
                                                }
                                              </p>

                                              <p className="mt-1 text-xs text-slate-500">
                                                Prefix:{' '}
                                                {terminal.prefix ||
                                                  'Not set'}
                                              </p>
                                            </div>
                                            
                                            <span
                                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                                terminal.status ===
                                                'active'
                                                  ? 'bg-emerald-50 text-emerald-700'
                                                  : 'bg-slate-100 text-slate-600'
                                              }`}
                                            >
                                              {terminal.status}
                                            </span>
                                        
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
                                      No terminals assigned to this
                                      department.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        No departments assigned to this kiosk.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

{kioskModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Edit Kiosk
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Update kiosk information
          </p>
        </div>

        <button
          type="button"
          onClick={() => setKioskModal(null)}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

{/* Modal Body */}
<div className="space-y-4 px-6 py-5">
  {kioskError && (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      {kioskError}
    </div>
  )}

  {/* Kiosk Name */}
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      Kiosk Name
    </label>

    <input
      type="text"
      value={kioskName}
      onChange={(event) =>
        setKioskName(event.target.value)
      }
      placeholder="e.g. Main Lobby"
      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#00529B] focus:ring-2 focus:ring-[#00529B]/10"
    />
  </div>

  {/* Status */}
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      Status
    </label>

    <select
      value={kioskStatus}
      onChange={(event) =>
        setKioskStatus(event.target.value)
      }
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#00529B] focus:ring-2 focus:ring-[#00529B]/10"
    >
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  </div>
</div>

      {/* Modal Footer */}
      <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button
          type="button"
          onClick={() => setKioskModal(null)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSaveKiosk}
          disabled={savingKiosk}
          className="rounded-lg bg-[#00529B] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#003f75] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingKiosk ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>
)}

            {terminalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                    {terminalModal?.mode === 'edit'
                        ? 'Edit Terminal'
                        : 'Add Terminal'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {terminalModal.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTerminalModal(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 px-6 py-5">
                {terminalError && (
  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
    {terminalError}
  </div>
)}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Terminal Number
                </label>

                <input
  type="number"
  value={terminalForm.counterNumber}
  readOnly
  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none"
/>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Prefix
                </label>

                <input
  type="text"
  value={terminalForm.prefix}
  readOnly
  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-600 outline-none"
/>
              </div>

{terminalModal?.mode === 'edit' && (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      Assigned Staff
    </label>

    <select
      value={terminalForm.assignedStaffId}
      onChange={(event) =>
        setTerminalForm((current) => ({
          ...current,
          assignedStaffId: event.target.value,
        }))
      }
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#00529B] focus:ring-2 focus:ring-[#00529B]/10"
    >
      <option value="">Unassigned</option>

      {staffOptions.map((person) => (
        <option
          key={person.user_id}
          value={person.user_id}
        >
          {person.first_name} {person.last_name}
        </option>
      ))}
    </select>
  </div>
)}

            <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                </label>

                <select
                    value={terminalForm.status}
                    onChange={(event) =>
                    setTerminalForm((current) => ({
                        ...current,
                        status: event.target.value,
                    }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#00529B] focus:ring-2 focus:ring-[#00529B]/10"
                >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setTerminalModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveTerminal}
                disabled={savingTerminal}
                className="rounded-lg bg-[#00529B] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#003f75] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTerminal
                    ? 'Saving...'
                    : terminalModal?.mode === 'edit'
                        ? 'Save Changes'
                        : 'Add Terminal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && kiosks.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No kiosks found.
        </div>
      )}
    </div>
  );
}