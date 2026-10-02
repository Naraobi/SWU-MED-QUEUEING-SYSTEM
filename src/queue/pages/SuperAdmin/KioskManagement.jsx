import { useEffect, useState } from 'react';

import {
  Building2,
  Check,
  ChevronDown,
  MapPin,
  Monitor,
  MoreVertical,
    Power,
  Search,
  Plus,
  User,
  X,
} from 'lucide-react';

import AddKioskModal from '../../components/modals/AddKioskModal';
import {
  getKiosks,
  updateKiosk,
  getDepartments,
  getTerminals,
  getStaffByDepartment,
  createKiosk,
  createTerminal,
    remotelyUnlockKiosk,
  updateTerminal,
} from '../../services/backendApi';
import { getAuth } from 'firebase/auth';

import useFormDraft, { DraftRestoreBar } from '../../hooks/useFormDraft';
import InputPinModal from '../../components/modals/inputPinModal';
export default function KioskManagement() {

  const [kiosks, setKiosks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addKioskModalOpen, setAddKioskModalOpen] = useState(false);
  const [expandedKiosk, setExpandedKiosk] = useState(null);
  const [expandedDepartment, setExpandedDepartment] = useState(null);
  const [kioskModal, setKioskModal] = useState(null);
  const [kioskName, setKioskName] = useState('');
  const [kioskLocation, setKioskLocation] = useState('');
  const [kioskStatus, setKioskStatus] = useState('active');
const [pinModalOpen, setPinModalOpen] = useState(false);
  const [savingKiosk, setSavingKiosk] = useState(false);
  const [kioskError, setKioskError] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | UNSAVED DRAFT
  |--------------------------------------------------------------------------
  |
  | Keeps whatever has been typed into Add Kiosk on this browser, so a
  | refresh, crash or power cut does not lose it. The PIN is never stored.
  |
  */
  const kioskDraft = useFormDraft('kiosk-add', {
    enabled: kioskModal?.mode === 'add',
    exclude: ['kioskPin'],
    values: {
      kioskName,
      kioskLocation,
      kioskStatus,
    },
  });

  // =============================================
  // KIOSK STATUS CONFIRMATION
  // =============================================

  const [kioskStatusModal, setKioskStatusModal] = useState(null);
  const [changingKioskStatus, setChangingKioskStatus] = useState(false);
  
  // =============================================
// ACTIVATE KIOSK MODAL
// =============================================

const [activateModalOpen, setActivateModalOpen] = useState(false);
const [activateSearch, setActivateSearch] = useState('');
const [selectedActivateId, setSelectedActivateId] = useState(null);
const [activatingKiosk, setActivatingKiosk] = useState(false);
const [activateError, setActivateError] = useState(null);
const [activateSuccess, setActivateSuccess] = useState('');
const filteredActivateKiosks = kiosks.filter((kiosk) => {
  const term = activateSearch.trim().toLowerCase();
  if (!term) return true;

  return (
    kiosk.name.toLowerCase().includes(term) ||
    (kiosk.location || '').toLowerCase().includes(term)
  );
});

const activeKioskCount = kiosks.filter(
  (kiosk) => kiosk.status === 'active'
).length;

const selectedActivateKiosk = kiosks.find(
  (kiosk) => kiosk.kiosk_id === selectedActivateId
);

function openActivateModal() {
  setActivateSearch('');
  setSelectedActivateId(null);
  setActivateError(null);
  setActivateSuccess('');
  setPinModalOpen(false);
  setActivateModalOpen(true);
}
function closeActivateModal() {
  if (activatingKiosk) return;
  setActivateModalOpen(false);
}

async function handleVerifyPin(pin) {
  if (!selectedActivateKiosk) {
    throw new Error('Please select a kiosk.');
  }

  const currentUser = getAuth().currentUser;

  if (!currentUser) {
    throw new Error('You must be logged in to unlock a kiosk.');
  }

  try {
    setActivatingKiosk(true);
    setActivateError(null);

    const result = await remotelyUnlockKiosk(
      currentUser,
      selectedActivateKiosk.kiosk_id,
      pin
    );

    setActivateSuccess(
      result.message || 'Kiosk unlocked successfully for today.'
    );

    return result;
  } catch (err) {
    console.error('REMOTE KIOSK UNLOCK ERROR:', err);
    throw err;
  } finally {
    setActivatingKiosk(false);
  }
}
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
  // OPEN EDIT KIOSK MODAL
  // =============================================

  function openEditKioskModal(kiosk) {
    setKioskModal({
      mode: 'edit',
      ...kiosk,
    });

    setKioskName(kiosk.name || '');
    setKioskLocation(kiosk.location || '');
    setKioskStatus(kiosk.status || 'inactive');
    setKioskError(null);
  }
  // =============================================
// OPEN ADD KIOSK MODAL
// =============================================

function openAddKioskModal() {
  setAddKioskModalOpen(true);
}

// =============================================
// SAVE KIOSK
// =============================================

async function handleSaveKiosk() {
  if (!kioskModal) return;

    const trimmedName = kioskName.trim();
    const trimmedLocation = kioskLocation.trim();

    if (!trimmedName) {
      setKioskError('Kiosk name is required.');
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
          status: kioskStatus,
        });

        setKiosks((current) => [
          ...current,
          {
            ...newKiosk,
            name: trimmedName,
            location: '',
            status: kioskStatus,
          },
        ]);

        // Saved for real - the draft is no longer needed.
        kioskDraft.clear();
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
<div className="flex items-center gap-3">
<button
  type="button"
  onClick={openActivateModal}
  className="swu-press rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50"
>
  Unlock Kiosk
</button>
      <button
    type="button"
    onClick={openAddKioskModal}
    className="swu-press inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
  >
    <Plus size={16} />
    Add Kiosk
  </button>
</div>
</div>
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
    (department) => department.kiosk_id === kiosk.kiosk_id
  );
  const isKioskExpanded = expandedKiosk === kiosk.kiosk_id;
            return (
              <div
                key={kiosk.kiosk_id}
                className="swu-card overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
              >
                {/* KIOSK HEADER */}

                <div className="flex w-full items-center gap-4 p-5 transition-colors hover:bg-[#FBF1F1]">
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
                      <ChevronDown
                        size={20}
                        className={`transition-transform duration-300 ${
                          isKioskExpanded ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
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
                              className="swu-enter overflow-hidden rounded-xl border border-[#E5E7EB] transition-colors hover:border-[#F0DADA]"
                            >
                              {/* DEPARTMENT HEADER */}

                              <button
                                type="button"
                                onClick={() =>
                                  toggleDepartment(department.department_id)
                                }
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FBF1F1]"
                              >
                                <div className="shrink-0 text-[#9CA3AF]">
                                  <ChevronDown
                                    size={18}
                                    className={`transition-transform duration-300 ${
                                      isDepartmentExpanded ? 'rotate-0' : '-rotate-90'
                                    }`}
                                  />
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
            <AddKioskModal
            open={addKioskModalOpen}
            onClose={() => setAddKioskModalOpen(false)}
            onSuccess={(newKiosk) => {
              setKiosks((current) => [...current, newKiosk]);
            }}
          />

      {kioskModal && (
        <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="swu-pop w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
              <div>
             <h3 className="text-lg font-semibold text-[#1F2937]">
  Edit Kiosk
</h3>

<p className="mt-0.5 text-sm text-[#6B7280]">
  Update kiosk information
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
              {kioskModal.mode === 'add' && kioskDraft.pending && (
                <DraftRestoreBar
                  savedAt={kioskDraft.savedAt}
                  onRestore={() => {
                    const saved = kioskDraft.restore();
                    setKioskName(saved.kioskName ?? '');
                    setKioskLocation(saved.kioskLocation ?? '');
                    setKioskStatus(saved.kioskStatus ?? 'active');
                  }}
                  onDiscard={kioskDraft.discard}
                />
              )}

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
                        ? 'border border-[#86EFAC] bg-[#E8F8F0] text-[#0D8A4E] shadow-xs'
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

            {/* Kiosk Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
              <button
                type="button"
                onClick={() => setKioskModal(null)}
                className="swu-press rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveKiosk}
                disabled={savingKiosk}
                className="swu-press inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
               {savingKiosk ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {activateModalOpen && (
  <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
    <div className="swu-pop w-full max-w-md rounded-2xl bg-white shadow-2xl">
      {/* HEADER */}
      <div className="flex items-start justify-between px-6 pb-2 pt-5">
        <div>
          <h3 className="text-lg font-semibold text-[#1F2937]">
            Activate Kiosk
          </h3>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Select an inactive kiosk to make it available for use.
          </p>
        </div>

        <button
          type="button"
          onClick={closeActivateModal}
          className="rounded-lg p-2 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#4B5563]"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4 px-6 py-4">
        {activateError && (
          <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-sm text-[#9D0A0E]">
            {activateError}
          </div>
        )}

        {/* SEARCH */}
        <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 focus-within:border-[#9D0A0E] focus-within:ring-2 focus-within:ring-[#9D0A0E]/10">
          <Search size={16} className="shrink-0 text-[#9CA3AF]" />
          <input
            type="text"
            value={activateSearch}
            onChange={(event) => setActivateSearch(event.target.value)}
            placeholder="Search by kiosk name or location..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9CA3AF]"
          />
          <span className="shrink-0 rounded-full bg-[#F1F3F5] px-2 py-0.5 text-[10px] font-medium text-[#4B5563]">
            • All kiosks
          </span>
        </div>

  {/* LIST */}
<div>
  <div className="mb-2 flex items-center justify-between">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
      Available Kiosks
    </p>
    <p className="text-xs text-[#6B7280]">
      {activeKioskCount} of {kiosks.length} active
    </p>
  </div>

  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
    {filteredActivateKiosks.length > 0 ? (
      filteredActivateKiosks.map((kiosk) => {
        const isActive = kiosk.status === 'active';
        const isSelected = selectedActivateId === kiosk.kiosk_id;

        return (
          <button
            key={kiosk.kiosk_id}
            type="button"
            disabled={!isActive}
            onClick={() => isActive && setSelectedActivateId(kiosk.kiosk_id)}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              !isActive
                ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F8F9FA] opacity-60'
                : isSelected
                ? 'border-[#9D0A0E] bg-[#FBF1F1]'
                : 'border-[#E5E7EB] bg-white hover:border-[#9D0A0E]/40 hover:bg-[#FBF1F1]/50'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                isSelected
                  ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                  : 'border-[#D1D5DB] bg-white'
              }`}
            >
              {isSelected && <Check size={12} />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1F2937]">
                {kiosk.name}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6B7280]">
                <MapPin size={12} />
                <span className="truncate">
                  {kiosk.location || 'No location set'}
                </span>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                isActive
                  ? 'border border-[#86EFAC] bg-[#E8F8F0] text-[#0D8A4E]'
                  : 'bg-[#F1F3F5] text-[#4B5563]'
              }`}
            >
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </button>
        );
      })
    ) : (
      <div className="rounded-xl border border-dashed border-[#E5E7EB] p-6 text-center text-sm text-[#4B5563]">
        {kiosks.length === 0
          ? 'No kiosks found.'
          : 'No kiosks match your search.'}
      </div>
    )}
  </div>
</div>
        {/* SELECTED SUMMARY */}
        {selectedActivateKiosk && (
          <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#9D0A0E] text-[#9D0A0E]">
              <Check size={12} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Selected Kiosk
              </p>
              <p className="text-sm font-semibold text-[#1F2937]">
                {selectedActivateKiosk.name}
                {selectedActivateKiosk.location
                  ? ` — ${selectedActivateKiosk.location}`
                  : ''}
              </p>
              <p className="mt-0.5 text-xs text-[#6B7280]">
                This kiosk will be available for patient queueing upon
                activation.
              </p>
            </div>
          </div>
        )}
      </div>
      {/* FOOTER */}
      <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
        <button
          type="button"
          onClick={closeActivateModal}
          disabled={activatingKiosk}
          className="swu-press rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>

<button
  type="button"
  onClick={() => {
    if (!selectedActivateKiosk) {
      setActivateError('Please select a kiosk.');
      return;
    }

    setActivateError(null);
    setPinModalOpen(true);
  }}
  disabled={!selectedActivateKiosk || activatingKiosk}
  className="rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
>
  Unlock Kiosk
</button>
      </div>
    </div>
  </div>
)}
      {kioskStatusModal && (
        <div className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div className="swu-pop w-full max-w-sm rounded-2xl bg-white shadow-2xl">
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
                className="swu-press rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmKioskStatus}
                disabled={changingKioskStatus}
                className="swu-press rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-60"
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
      {terminalModal && (
        <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="swu-pop w-full max-w-md rounded-2xl bg-white shadow-2xl">
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

              {/* ASSIGNED STAFF (EDIT MODE - DISPLAY ONLY) */}
              {terminalModal.mode === 'edit' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#374151]">
                    Assigned Staff
                  </label>

                  {/*
                    Display only. Who works a terminal is set in User
                    Management, so offering a second control here would give
                    two places that write the same field. The value still
                    travels with the form, so saving leaves it untouched.
                  */}
                  <div className="flex items-center gap-2.5 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        terminalForm.assignedStaffId
                          ? 'bg-[#FBF1F1] text-[#9D0A0E]'
                          : 'bg-[#F1F3F5] text-[#9CA3AF]'
                      }`}
                    >
                      <User size={14} />
                    </span>

                    <span
                      className={`truncate text-sm ${
                        terminalForm.assignedStaffId
                          ? 'font-medium text-[#1F2937]'
                          : 'text-[#9CA3AF]'
                      }`}
                    >
                      {getStaffName(terminalForm.assignedStaffId)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[#6B7280]">
                    Staff assignment is managed in User Management.
                  </p>
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
                className="swu-press rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveTerminal}
                disabled={savingTerminal}
                className="swu-press inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-60"
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
<InputPinModal
  open={pinModalOpen}
  onClose={() => setPinModalOpen(false)}
  onVerify={handleVerifyPin}
  onSuccess={() => {
    setPinModalOpen(false);
    setActivateModalOpen(false);
    setActivateError(null);
  }}
  title="Enter Security PIN"
  description={`Enter your Security PIN to unlock ${
    selectedActivateKiosk?.name || 'this kiosk'
  } for today.`}
  confirmLabel="Verify & Unlock"
  successMessage="Kiosk has been successfully unlocked for today."
  successNote="Patients can now use this kiosk."
/>
    </div>
  );
  }