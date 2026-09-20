import { useEffect, useState } from 'react';

// Kiosk PINs are this many digits. The same rule is enforced on the kiosk
// activation screen in PatientView.jsx - change both together.
export const KIOSK_PIN_LENGTH = 6;

import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  MapPin,
  Monitor,
  MoreVertical,
  Plus,
  X,
} from 'lucide-react';

import {
  getKiosks,
  createKiosk,
  updateKiosk,
  getDepartments,
  getTerminals,
  getStaffByDepartment,
  createTerminal,
  updateTerminal,
} from '../../services/backendApi';

export default function KioskManagement() {
  // =============================================
  // DATA
  // =============================================

  const [kiosks, setKiosks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);

  const [resetDepartmentIds, setResetDepartmentIds] = useState(() => {
  try {
    const stored = localStorage.getItem(
      'swu_reset_departments'
    );

    return stored
      ? JSON.parse(stored)
      : [];
  } catch {
    return [];
  }
});

  // =============================================
  // PAGE STATE
  // =============================================

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedKiosk, setExpandedKiosk] = useState(null);
  const [expandedDepartment, setExpandedDepartment] = useState(null);

  // =============================================
  // KIOSK MODAL
  // =============================================

  const [kioskModal, setKioskModal] = useState(null);
  const [kioskName, setKioskName] = useState('');
  const [kioskLocation, setKioskLocation] = useState('');
  const [kioskPin, setKioskPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [kioskStatus, setKioskStatus] = useState('active');

  const [savingKiosk, setSavingKiosk] = useState(false);
  const [kioskError, setKioskError] = useState(null);

  // =============================================
  // KIOSK STATUS CONFIRMATION
  // =============================================

  const [kioskStatusModal, setKioskStatusModal] = useState(null);
  const [changingKioskStatus, setChangingKioskStatus] = useState(false);

  // =============================================
  // TERMINAL MODAL
  // =============================================

  const [terminalModal, setTerminalModal] = useState(null);

  const [terminalForm, setTerminalForm] = useState({
    terminalName: '',
    counterNumber: '',
    prefix: '',
    terminalCode: '',
    status: 'active',
    assignedStaffId: '',
  });

  const [savingTerminal, setSavingTerminal] = useState(false);
  const [terminalError, setTerminalError] = useState(null);

  // =============================================
  // LOAD PAGE DATA
  // =============================================

  useEffect(() => {
    let mounted = true;

    async function loadKioskData() {
      try {
        setLoading(true);
        setError(null);

        // -----------------------------------------
        // LOAD KIOSKS
        // -----------------------------------------

        const kioskData = await getKiosks();

        // -----------------------------------------
        // LOAD DEPARTMENTS
        // -----------------------------------------

        const departmentData = await getDepartments();

        // -----------------------------------------
        // LOAD TERMINALS
        // -----------------------------------------

        const terminalData = await getTerminals();

        if (!mounted) return;

        // -----------------------------------------
        // FORMAT KIOSKS
        // -----------------------------------------

        const formattedKiosks = (kioskData || []).map((kiosk) => ({
          kiosk_id: kiosk.kiosk_id,
          name: kiosk.name || '',
          location: kiosk.location || '',
          status: kiosk.status || 'inactive',
          created_at: kiosk.created_at || null,
          updated_at: kiosk.updated_at || null,
        }));

        // -----------------------------------------
        // FORMAT DEPARTMENTS
        // -----------------------------------------

        const formattedDepartments = (departmentData || []).map(
          (department) => ({
            department_id: department.department_id,
            name: department.name || '',
            status: department.status || 'inactive',
            kiosk_id: department.kiosk_id || '',
            prefix: department.prefix || '',
          })
        );

        // -----------------------------------------
        // FORMAT TERMINALS
        // -----------------------------------------

        const formattedTerminals = (terminalData || []).map((terminal) => ({
          counter_id: terminal.counter_id,
          department_id: terminal.department_id || '',
          counter_number: terminal.counter_number ?? '',
          prefix: terminal.prefix || '',
          status: terminal.status || 'inactive',
          assigned_staff_id: terminal.assigned_staff_id || '',
          created_at: terminal.created_at || null,
          updated_at: terminal.updated_at || null,
        }));

        setKiosks(formattedKiosks);
        setDepartments(formattedDepartments);
        setTerminals(formattedTerminals);

        setLoading(false);
      } catch (err) {
        console.error('FETCH KIOSK DATA ERROR:', err);

        if (mounted) {
          setError(err.message || 'Failed to load kiosk data.');
          setLoading(false);
        }
      }
    }

    loadKioskData();

    return () => {
      mounted = false;
    };
  }, []);

  // =============================================
  // TOGGLE KIOSK STATUS
  // =============================================

  function openKioskStatusConfirmation(kiosk) {
    if (!kiosk) return;

    const nextStatus = kiosk.status === 'active' ? 'inactive' : 'active';

    setKioskStatusModal({
      ...kiosk,
      nextStatus,
    });

    setError(null);
  }

  // =============================================
  // CONFIRM KIOSK STATUS CHANGE
  // =============================================

  async function handleConfirmKioskStatus() {
    if (!kioskStatusModal) return;

    const { kiosk_id, name, nextStatus } = kioskStatusModal;

    try {
      setChangingKioskStatus(true);
      setError(null);

      const updatedKiosk = await updateKiosk(kiosk_id, {
        name,
        status: nextStatus,
      });

      setKiosks((current) =>
        current.map((kiosk) =>
          kiosk.kiosk_id === kiosk_id
            ? {
                ...kiosk,
                ...updatedKiosk,
                status: nextStatus,
              }
            : kiosk
        )
      );

      setKioskStatusModal(null);
    } catch (err) {
      console.error('UPDATE KIOSK STATUS ERROR:', err);

      setError(err.message || 'Failed to update kiosk status.');
    } finally {
      setChangingKioskStatus(false);
    }
  }

  // =============================================
  // OPEN ADD KIOSK MODAL
  // =============================================

  function openAddKioskModal() {
    setKioskModal({
      mode: 'add',
    });

    setKioskName('');
    setKioskLocation('');
    setKioskPin('');
    setShowPin(false);
    setKioskStatus('active');
    setKioskError(null);
  }

  // =============================================
  // OPEN EDIT KIOSK MODAL
  // =============================================

  function openEditKioskModal(kiosk) {
    setKioskModal({
      mode: 'edit',
      ...kiosk,
    });

    setKioskName(kiosk.name || '');
    setKioskLocation(kiosk.location || '');
    setKioskPin('');
    setShowPin(false);
    setKioskStatus(kiosk.status || 'inactive');
    setKioskError(null);
  }

  // =============================================
  // SAVE KIOSK
  // =============================================

  async function handleSaveKiosk() {
    if (!kioskModal) return;

    const trimmedName = kioskName.trim();
    const trimmedLocation = kioskLocation.trim();
    const trimmedPin = kioskPin.trim();

    if (!trimmedName) {
      setKioskError('Kiosk name is required.');
      return;
    }

if (kioskModal.mode === 'add' && !/^\d{6}$/.test(trimmedPin)) {
  setKioskError('Kiosk PIN must be exactly 6 digits.');
  return;
}

    try {
      setSavingKiosk(true);
      setKioskError(null);

      // =========================================
      // ADD KIOSK
      // =========================================

      if (kioskModal.mode === 'add') {
        const newKiosk = await createKiosk({
          name: trimmedName,
          location: trimmedLocation,
          kiosk_pin: trimmedPin,
          status: kioskStatus,
        });

        setKiosks((current) => [
          ...current,
          {
            ...newKiosk,
            name: trimmedName,
            location: trimmedLocation,
            status: kioskStatus,
          },
        ]);
      }

      // =========================================
      // EDIT KIOSK
      // =========================================

      else {
        const updatedKiosk = await updateKiosk(kioskModal.kiosk_id, {
          name: trimmedName,
          location: trimmedLocation,
          status: kioskStatus,
        });

        setKiosks((current) =>
          current.map((kiosk) =>
            kiosk.kiosk_id === kioskModal.kiosk_id
              ? {
                  ...kiosk,
                  ...updatedKiosk,
                  kiosk_id: kioskModal.kiosk_id,
                  name: trimmedName,
                  location: trimmedLocation,
                  status: kioskStatus,
                }
              : kiosk
          )
        );
      }

      setKioskModal(null);
      setKioskName('');
      setKioskLocation('');
      setKioskPin('');
      setKioskStatus('active');
    } catch (err) {
      console.error('SAVE KIOSK ERROR:', err);

      setKioskError(
        err.message ||
          `Failed to ${
            kioskModal.mode === 'add' ? 'add kiosk' : 'update kiosk'
          }.`
      );
    } finally {
      setSavingKiosk(false);
    }
  }

  // =============================================
  // TOGGLE KIOSK EXPANSION
  // =============================================

  function toggleKiosk(kioskId) {
    setExpandedKiosk((current) => (current === kioskId ? null : kioskId));
    setExpandedDepartment(null);
  }

  // =============================================
  // TOGGLE DEPARTMENT
  // =============================================

  function toggleDepartment(departmentId) {
    setExpandedDepartment((current) =>
      current === departmentId ? null : departmentId
    );
  }

  // =============================================
  // LOAD STAFF FOR DEPARTMENT
  // =============================================

  async function loadStaffForDepartment(departmentId) {
    try {
      const staff = await getStaffByDepartment(departmentId);

      const formattedStaff = (staff || []).map((person) => ({
        user_id: person.user_id,
        first_name: person.first_name || '',
        last_name: person.last_name || '',
        role_id: person.role_id || '',
        department_id: person.department_id || '',
      }));

      setStaffOptions(formattedStaff);
    } catch (err) {
      console.error('LOAD STAFF ERROR:', err);
      setStaffOptions([]);
      throw err;
    }
  }

  // =============================================
  // OPEN ADD TERMINAL MODAL
  // =============================================

  async function openTerminalModal(department) {
    const parentKiosk = kiosks.find((k) => k.kiosk_id === department.kiosk_id);

    setTerminalModal({
      mode: 'add',
      ...department,
      kioskName: parentKiosk?.name || 'Main Lobby',
    });

    setTerminalForm({
      terminalName: '',
      counterNumber: '',
      prefix: '',
      terminalCode: '',
      status: 'active',
      assignedStaffId: '',
    });

    setStaffOptions([]);
    setTerminalError(null);

    try {
      // -----------------------------------------
      // DEPARTMENT PREFIX
      // -----------------------------------------

      const departmentPrefix = department.prefix?.trim().toUpperCase() || '';

      // -----------------------------------------
      // EXISTING TERMINALS
      // -----------------------------------------

      const departmentTerminals = terminals.filter(
        (terminal) => terminal.department_id === department.department_id
      );

      const usedNumbers = departmentTerminals
        .map((terminal) => Number(terminal.counter_number))
        .filter((number) => Number.isInteger(number) && number > 0);

      // -----------------------------------------
      // NEXT TERMINAL NUMBER
      // -----------------------------------------

      let nextCounterNumber = 1;

      while (usedNumbers.includes(nextCounterNumber)) {
        nextCounterNumber++;
      }

      const generatedCode = departmentPrefix
        ? `${departmentPrefix}-${nextCounterNumber}`
        : `${nextCounterNumber}`;

      setTerminalForm({
        terminalName: String(nextCounterNumber),
        counterNumber: String(nextCounterNumber),
        prefix: departmentPrefix,
        terminalCode: generatedCode,
        status: 'active',
        assignedStaffId: '',
      });

      // -----------------------------------------
      // LOAD STAFF
      // -----------------------------------------

      await loadStaffForDepartment(department.department_id);
    } catch (err) {
      console.error('OPEN ADD TERMINAL ERROR:', err);

      setTerminalError(err.message || 'Unable to prepare terminal.');
    }
  }

  // =============================================
  // OPEN EDIT TERMINAL MODAL
  // =============================================

  async function openEditTerminalModal(terminal) {
    const department = departments.find(
      (item) => item.department_id === terminal.department_id
    );

    const parentKiosk = kiosks.find((k) => k.kiosk_id === department?.kiosk_id);

    const generatedCode = terminal.prefix
      ? `${terminal.prefix}-${terminal.counter_number}`
      : `${terminal.counter_number}`;

    setTerminalModal({
      mode: 'edit',
      ...terminal,
      kioskName: parentKiosk?.name || 'Main Lobby',
      departmentName: department?.name || '',
    });

    setTerminalForm({
      terminalName: String(terminal.counter_number ?? ''),
      counterNumber: String(terminal.counter_number ?? ''),
      prefix: terminal.prefix || '',
      terminalCode: generatedCode,
      status: terminal.status || 'inactive',
      assignedStaffId: terminal.assigned_staff_id || '',
    });

    setTerminalError(null);
    setStaffOptions([]);

    try {
      await loadStaffForDepartment(terminal.department_id);
    } catch (err) {
      console.error('LOAD TERMINAL STAFF ERROR:', err);

      setTerminalError(err.message || 'Failed to load staff.');
    }
  }

  // =============================================
  // SAVE TERMINAL
  // =============================================

  async function handleSaveTerminal() {
    if (!terminalModal) return;

    try {
      setSavingTerminal(true);
      setTerminalError(null);

      const assignedStaffId = terminalForm.assignedStaffId
        ? terminalForm.assignedStaffId
        : null;

      const terminalData = {
        department_id: terminalModal.department_id,
        counter_number: Number(
          terminalForm.terminalName || terminalForm.counterNumber
        ),
        prefix: terminalForm.prefix.trim().toUpperCase(),
        status: terminalForm.status,
        assigned_staff_id: assignedStaffId,
      };

      // =========================================
      // EDIT TERMINAL
      // =========================================

      if (terminalModal.mode === 'edit') {
        const updatedTerminal = await updateTerminal(
          terminalModal.counter_id,
          terminalData
        );

        setTerminals((current) =>
          current.map((terminal) => {
            if (
              assignedStaffId &&
              terminal.assigned_staff_id === assignedStaffId &&
              terminal.counter_id !== terminalModal.counter_id
            ) {
              return {
                ...terminal,
                assigned_staff_id: '',
              };
            }

            if (terminal.counter_id === terminalModal.counter_id) {
              return {
                ...terminal,
                ...updatedTerminal,
                counter_id: terminalModal.counter_id,
                department_id: terminalModal.department_id,
                counter_number: Number(
                  terminalForm.terminalName || terminalForm.counterNumber
                ),
                prefix: terminalForm.prefix.trim().toUpperCase(),
                status: terminalForm.status,
                assigned_staff_id: assignedStaffId || '',
              };
            }

            return terminal;
          })
        );
      }

      // =========================================
      // ADD TERMINAL
      // =========================================

      else {
        const newTerminal = await createTerminal(terminalData);

        setTerminals((current) => [
          ...current,
          {
            ...newTerminal,
            department_id: terminalModal.department_id,
            counter_number: Number(
              terminalForm.terminalName || terminalForm.counterNumber
            ),
            prefix: terminalForm.prefix.trim().toUpperCase(),
            status: terminalForm.status,
            assigned_staff_id: assignedStaffId || '',
          },
        ]);
      }

      // =========================================
      // CLOSE MODAL
      // =========================================

      setTerminalModal(null);

      setTerminalForm({
        terminalName: '',
        counterNumber: '',
        prefix: '',
        terminalCode: '',
        status: 'active',
        assignedStaffId: '',
      });

      setStaffOptions([]);
    } catch (err) {
      console.error('SAVE TERMINAL ERROR:', err);

      setTerminalError(err.message || 'Failed to save terminal.');
    } finally {
      setSavingTerminal(false);
    }
  }

  // =============================================
  // GET STAFF NAME
  // =============================================

  function getStaffName(staffId) {
    if (!staffId) {
      return 'Unassigned';
    }

    const staff = staffOptions.find((person) => person.user_id === staffId);

    if (!staff) {
      return 'Assigned staff';
    }

    return `${staff.first_name} ${staff.last_name}`.trim();
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-6">
      {/* =========================================
          PAGE HEADER
      ========================================== */}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2937]">
            Kiosk Management
          </h1>

          <p className="mt-1 text-sm text-[#4B5563]">
            Manage kiosks, departments, and terminals.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddKioskModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7D080B]"
        >
          <Plus size={16} />
          Add Kiosk
        </button>
      </div>

      {/* =========================================
          LOADING
      ========================================== */}

      {loading && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-sm text-[#4B5563]">
          Loading kiosks...
        </div>
      )}

      {/* =========================================
          ERROR
      ========================================== */}

      {error && (
        <div className="rounded-xl border border-[#F0DADA] bg-[#FBF1F1] p-4 text-sm text-[#9D0A0E]">
          {error}
        </div>
      )}

      {/* =========================================
          KIOSKS
      ========================================== */}

      {!loading && !error && (
        <div className="space-y-4">
          {kiosks.map((kiosk) => {
            const kioskDepartments = departments.filter(
  (department) =>
    department.kiosk_id === kiosk.kiosk_id &&
    !resetDepartmentIds.includes(department.department_id)
);

            const isKioskExpanded = expandedKiosk === kiosk.kiosk_id;

            return (
              <div
                key={kiosk.kiosk_id}
                className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
              >
                {/* KIOSK HEADER */}

                <div className="flex w-full items-center gap-4 p-5 transition hover:bg-[#F8F9FA]">
                  <button
                    type="button"
                    onClick={() => toggleKiosk(kiosk.kiosk_id)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBF1F1] text-[#9D0A0E]">
                      <Monitor size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold text-[#1F2937]">
                        {kiosk.name}
                      </h2>

                      <div className="mt-1 flex items-center gap-2 text-sm text-[#4B5563]">
                        <MapPin size={15} />
                        <span>{kiosk.location || 'Kiosk'}</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* STATUS */}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openKioskStatusConfirmation(kiosk);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        kiosk.status === 'active'
                          ? 'bg-[#E8F8F0] text-[#0D8A4E] border border-[#86EFAC]'
                          : 'bg-[#F1F3F5] text-[#4B5563] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {kiosk.status === 'active' ? 'Active' : 'Inactive'}
                    </button>

                    {/* ACTIONS */}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditKioskModal(kiosk);
                      }}
                      className="rounded-lg p-2 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937]"
                      title="Edit kiosk"
                    >
                      <MoreVertical size={20} />
                    </button>

                    <div className="shrink-0 text-[#9CA3AF]">
                      {isKioskExpanded ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </div>
                  </div>
                </div>

                {/* DEPARTMENTS */}

                {isKioskExpanded && (
                  <div className="border-t border-[#E5E7EB] p-5">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-[#1F2937]">
                        Departments
                      </h3>

                      <p className="mt-1 text-xs text-[#4B5563]">
                        Departments assigned to this kiosk
                      </p>
                    </div>

                    {kioskDepartments.length > 0 ? (
                      <div className="space-y-2">
                        {kioskDepartments.map((department) => {
                          const isDepartmentExpanded =
                            expandedDepartment === department.department_id;

                          const departmentTerminals = terminals
                            .filter(
                              (terminal) =>
                                terminal.department_id ===
                                department.department_id
                            )
                            .sort(
                              (a, b) =>
                                Number(a.counter_number) -
                                Number(b.counter_number)
                            );

                          return (
                            <div
                              key={department.department_id}
                              className="overflow-hidden rounded-xl border border-[#E5E7EB]"
                            >
                              {/* DEPARTMENT HEADER */}

                              <button
                                type="button"
                                onClick={() =>
                                  toggleDepartment(department.department_id)
                                }
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#F8F9FA]"
                              >
                                <div className="shrink-0 text-[#9CA3AF]">
                                  {isDepartmentExpanded ? (
                                    <ChevronDown size={18} />
                                  ) : (
                                    <ChevronRight size={18} />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-[#1F2937]">
                                    {department.name}
                                  </p>

                                  {department.prefix && (
                                    <p className="mt-0.5 text-xs text-[#9CA3AF]">
                                      Prefix: {department.prefix}
                                    </p>
                                  )}
                                </div>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    department.status === 'active'
                                      ? 'bg-[#E8F8F0] text-[#0D8A4E] border border-[#86EFAC]'
                                      : 'bg-[#F1F3F5] text-[#4B5563]'
                                  }`}
                                >
                                  {department.status === 'active'
                                    ? 'Active'
                                    : 'Inactive'}
                                </span>
                              </button>

                              {/* TERMINALS */}

                              {isDepartmentExpanded && (
                                <div className="border-t border-[#E5E7EB] bg-[#F8F9FA]/50 px-4 py-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
                                        Terminals
                                      </h4>

                                      <p className="mt-1 text-xs text-[#9CA3AF]">
                                        Terminals assigned to this department
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openTerminalModal(department);
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#4B5563] transition hover:border-[#9D0A0E] hover:text-[#9D0A0E]"
                                      title="Add Terminal"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>

                                  {departmentTerminals.length > 0 ? (
                                    <div className="mt-4 space-y-2">
                                      {departmentTerminals.map((terminal) => (
                                        <div
                                          key={terminal.counter_id}
                                          onClick={() =>
                                            openEditTerminalModal(terminal)
                                          }
                                          className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 transition hover:border-[#9D0A0E] hover:bg-[#FBF1F1]"
                                        >
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-[#1F2937]">
                                              Terminal {terminal.counter_number}
                                            </p>

                                            <p className="mt-1 text-xs text-[#4B5563]">
                                              Prefix:{' '}
                                              {terminal.prefix || 'Not set'}
                                            </p>

                                            <p className="mt-1 text-xs text-[#9CA3AF]">
                                              {terminal.assigned_staff_id
                                                ? getStaffName(
                                                    terminal.assigned_staff_id
                                                  )
                                                : 'Unassigned'}
                                            </p>
                                          </div>

                                          <span
                                            className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                              terminal.status === 'active'
                                                ? 'bg-[#E8F8F0] text-[#0D8A4E] border border-[#86EFAC]'
                                                : 'bg-[#F1F3F5] text-[#4B5563]'
                                            }`}
                                          >
                                            {terminal.status === 'active'
                                              ? 'Active'
                                              : 'Inactive'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="mt-4 rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4 text-center text-xs text-[#4B5563]">
                                      No terminals assigned to this department.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#E5E7EB] p-6 text-center text-sm text-[#4B5563]">
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

      {/* =========================================
          NO KIOSKS
      ========================================== */}

      {!loading && !error && kiosks.length === 0 && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 text-center text-sm text-[#4B5563]">
          No kiosks found.
        </div>
      )}

      {/* =========================================
          ADD / EDIT KIOSK MODAL
      ========================================== */}

      {kioskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {kioskModal.mode === 'edit' ? 'Edit Kiosk' : 'Add Kiosk'}
                </h3>

                <p className="mt-0.5 text-sm text-[#6B7280]">
                  {kioskModal.mode === 'edit'
                    ? 'Update kiosk information'
                    : 'Create a new kiosk.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setKioskModal(null)}
                className="rounded-lg p-2 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#4B5563]"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {kioskError && (
                <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-sm text-[#9D0A0E]">
                  {kioskError}
                </div>
              )}

              {/* Kiosk Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  Kiosk Name <span className="text-[#9D0A0E]">*</span>
                </label>

                <input
                  type="text"
                  value={kioskName}
                  onChange={(event) => setKioskName(event.target.value)}
                  placeholder="e.g. Main Lobby"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
                />
              </div>

              {/* Location */}
              {kioskModal.mode === 'add' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                    Location <span className="text-[#9D0A0E]">*</span>
                  </label>

                  <div className="relative flex items-center">
                    <MapPin
                      size={18}
                      className="absolute left-3 text-[#9CA3AF]"
                    />
                    <input
                      type="text"
                      value={kioskLocation}
                      onChange={(event) => setKioskLocation(event.target.value)}
                      placeholder="e.g. Ground Floor"
                      className="w-full rounded-lg border border-[#E5E7EB] pl-9 pr-3 py-2.5 text-sm outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
                    />
                  </div>
                </div>
              )}

              {/* Kiosk PIN */}
              {kioskModal.mode === 'add' && (
                <div>
                  <label
                    htmlFor="kiosk-pin"
                    className="mb-1.5 block text-sm font-medium text-[#374151]"
                  >
                    Kiosk PIN <span className="text-[#9D0A0E]">*</span>
                  </label>

                  <div className="relative flex items-center">
                    <input
                      id="kiosk-pin"
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                inputMode="numeric"
                maxLength={6}
                value={kioskPin}
                onChange={(event) => {
                  const value = event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 6);

                  setKioskPin(value);
                }}
                placeholder="Enter 6-digit PIN"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
                />
                                    <button
                      type="button"
                      onClick={() => setShowPin((prev) => !prev)}
                      className="absolute right-3 text-[#9CA3AF] hover:text-[#4B5563]"
                    >
                      {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <p className="mt-1.5 text-xs text-[#6B7280]">
                    Authorized staff use this PIN to activate the kiosk.
                  </p>
                </div>
              )}

              {/* Status Segmented Control */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  Status
                </label>

                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F3F5] p-1">
                  <button
                    type="button"
                    onClick={() => setKioskStatus('active')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                      kioskStatus === 'active'
                        ? 'bg-[#E8F8F0] text-[#0D8A4E] border border-[#86EFAC] shadow-xs'
                        : 'text-[#4B5563] hover:text-[#1F2937]'
                    }`}
                  >
                    {kioskStatus === 'active' && <Check size={16} />}
                    Active
                  </button>

                  <button
                    type="button"
                    onClick={() => setKioskStatus('inactive')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                      kioskStatus === 'inactive'
                        ? 'bg-white text-[#1F2937] shadow-xs'
                        : 'text-[#4B5563] hover:text-[#1F2937]'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={() => setKioskModal(null)}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition hover:bg-[#F8F9FA]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveKiosk}
                disabled={savingKiosk}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingKiosk ? (
                  'Saving...'
                ) : kioskModal.mode === 'edit' ? (
                  'Save Changes'
                ) : (
                  <>
                    <Plus size={16} />
                    Add Kiosk
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          KIOSK STATUS MODAL
      ========================================== */}

      {kioskStatusModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="px-6 py-5">
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {kioskStatusModal.nextStatus === 'active'
                  ? 'Activate Kiosk?'
                  : 'Deactivate Kiosk?'}
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#4B5563]">
                Are you sure you want to{' '}
                {kioskStatusModal.nextStatus === 'active'
                  ? 'activate'
                  : 'deactivate'}{' '}
                <span className="font-medium text-[#1F2937]">
                  "{kioskStatusModal.name}"
                </span>
                ?
              </p>

              {kioskStatusModal.nextStatus === 'inactive' && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  Patients should not be able to use an inactive kiosk for queue
                  transactions.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={() => setKioskStatusModal(null)}
                disabled={changingKioskStatus}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmKioskStatus}
                disabled={changingKioskStatus}
                className="rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changingKioskStatus
                  ? 'Updating...'
                  : kioskStatusModal.nextStatus === 'active'
                  ? 'Activate Kiosk'
                  : 'Deactivate Kiosk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          ADD / EDIT TERMINAL MODAL
      ========================================== */}

      {terminalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {terminalModal.mode === 'edit'
                    ? 'Edit Terminal'
                    : 'Add Terminal'}
                </h3>

                <p className="mt-0.5 text-sm text-[#6B7280]">
                  Create a new service terminal for this department.
                </p>

                {terminalModal.mode === 'add' && (
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Fields marked <span className="text-[#9D0A0E]">*</span> are
                    required.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setTerminalModal(null)}
                className="rounded-lg p-2 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#4B5563]"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {terminalError && (
                <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-sm text-[#9D0A0E]">
                  {terminalError}
                </div>
              )}

              {/* Department Banner Box */}
              <div className="flex items-center justify-between rounded-xl bg-[#F8F9FA] px-4 py-3">
                <div className="flex items-center gap-2.5 text-sm font-medium text-[#1F2937]">
                  <Building2 size={18} className="text-[#9D0A0E]" />
                  <span>
                    {terminalModal.kioskName || 'Main Lobby'} •{' '}
                    {terminalModal.name || terminalModal.departmentName}
                  </span>
                </div>

                {terminalForm.prefix && (
                  <span className="rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-xs font-semibold text-[#374151]">
                    Prefix: {terminalForm.prefix}
                  </span>
                )}
              </div>

              {/* Terminal Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  Terminal Name <span className="text-[#9D0A0E]">*</span>
                </label>

                <input
                  type="text"
                  value={terminalForm.terminalName}
                  onChange={(event) =>
                    setTerminalForm((prev) => ({
                      ...prev,
                      terminalName: event.target.value,
                      terminalCode: prev.prefix
                        ? `${prev.prefix}-${event.target.value}`
                        : event.target.value,
                    }))
                  }
                  placeholder="3"
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
                />
              </div>

              {/* Terminal Code / ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-[#374151]">
                    Terminal Code / ID <span className="text-[#9D0A0E]">*</span>
                  </label>
                  <span className="text-xs text-[#6B7280]">Auto-generated</span>
                </div>

                <input
                  type="text"
                  value={terminalForm.terminalCode}
                  readOnly
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 text-sm text-[#374151] outline-none"
                />

                <p className="mt-1 text-xs text-[#6B7280]">
                  Identifier displayed on queue slips and call displays.
                </p>
              </div>

              {/* ASSIGNED STAFF (EDIT MODE) */}
              {terminalModal.mode === 'edit' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#374151]">
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
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
                  >
                    <option value="">Unassigned</option>

                    {staffOptions.map((person) => (
                      <option key={person.user_id} value={person.user_id}>
                        {person.first_name} {person.last_name}
                      </option>
                    ))}
                  </select>

                  {staffOptions.length === 0 && (
                    <p className="mt-1.5 text-xs text-[#9CA3AF]">
                      No Staff users are assigned to this department.
                    </p>
                  )}
                </div>
              )}

              {/* STATUS SEGMENTED CONTROL */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                  Status
                </label>

                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F3F5] p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setTerminalForm((prev) => ({ ...prev, status: 'active' }))
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                      terminalForm.status === 'active'
                        ? 'bg-[#E8F8F0] text-[#0D8A4E] border border-[#86EFAC] shadow-xs'
                        : 'text-[#4B5563] hover:text-[#1F2937]'
                    }`}
                  >
                    {terminalForm.status === 'active' && <Check size={16} />}
                    Active
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTerminalForm((prev) => ({
                        ...prev,
                        status: 'inactive',
                      }))
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                      terminalForm.status === 'inactive'
                        ? 'bg-white text-[#1F2937] shadow-xs'
                        : 'text-[#4B5563] hover:text-[#1F2937]'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={() => setTerminalModal(null)}
                disabled={savingTerminal}
                className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveTerminal}
                disabled={savingTerminal}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTerminal ? (
                  'Saving...'
                ) : terminalModal.mode === 'edit' ? (
                  'Save Changes'
                ) : (
                  <>
                    <Plus size={16} />
                    Add Terminal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}