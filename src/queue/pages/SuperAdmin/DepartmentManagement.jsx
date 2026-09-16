import { useEffect, useState } from 'react';

import {
  getKiosks,
  getTerminals,
  getDepartments,
  createDepartment,
  updateDepartment,
} from '../../services/backendApi';

import {
  Search,
  Building2,
  Users,
  Clock,
  Monitor,
  Plus,
  X,
} from 'lucide-react';

// ===========================================================
// DATABASE ARCHITECTURE
// ===========================================================
//
// ALL DATA IS NOW FETCHED THROUGH NODE.JS.
//
// React
//   ↓
// Node.js API
//   ↓
// databaseMode.js
//   ↓
// Firebase when available
//   ↓
// MySQL when Firebase is unavailable
//
// Departments:
// React → Node.js → Firebase / MySQL
//
// Kiosks:
// React → Node.js → Firebase / MySQL
//
// Terminals / Counters:
// React → Node.js → Firebase / MySQL
//
// React no longer communicates directly with Firebase.
//

// ===========================================================
// DEFAULT FORM
// ===========================================================

const EMPTY_FORM = {
  department_name: '',
  kiosk_id: '',
  prefix: '',
  status: 'active',
};

const STATUS_OPTIONS = [
  'active',
  'deactivated',
];

const PAGE_SIZE = 5;

const RESET_PIN = '2402';

// ===========================================================
// PAGINATION
// ===========================================================

function getPageNumbers(currentPage, totalPages) {
  const MAX_BUTTONS = 5;

  if (totalPages <= MAX_BUTTONS) {
    return Array.from(
      { length: totalPages },
      (_, i) => i + 1
    );
  }

  let start = Math.max(
    1,
    currentPage - Math.floor(MAX_BUTTONS / 2)
  );

  start = Math.min(
    start,
    totalPages - MAX_BUTTONS + 1
  );

  return Array.from(
    { length: MAX_BUTTONS },
    (_, i) => start + i
  );
}

// ===========================================================
// DEPARTMENT MODAL
// ===========================================================

function DepartmentModal({
  open,
  onClose,
  onSave,
  form,
  setForm,
  saving,
  kiosks,
  isEditing,
}) {
  if (!open) {
    return null;
  }

  const activeKiosks = kiosks.filter(
    (kiosk) =>
      String(kiosk.status || '').toLowerCase() ===
      'active'
  );

  const selectedKiosk = kiosks.find(
    (kiosk) =>
      String(kiosk.kiosk_id) ===
        String(form.kiosk_id) ||
      String(kiosk.firestore_id || '') ===
        String(form.kiosk_id)
  );

  const selectableKiosks = [
    ...activeKiosks,
    ...(selectedKiosk &&
    String(selectedKiosk.status || '').toLowerCase() !==
      'active' &&
    !activeKiosks.some(
      (kiosk) =>
        String(kiosk.kiosk_id) ===
        String(selectedKiosk.kiosk_id)
    )
      ? [selectedKiosk]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">

          <div>
            <h2 className="text-lg font-bold text-slate-700">
              {isEditing
                ? 'Edit Department'
                : 'Add New Department'}
            </h2>

            <p className="mt-0.5 text-xs text-slate-400">
              {isEditing
                ? 'Update the department configuration below.'
                : 'Select a kiosk before configuring the department.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 transition hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>

        </div>

        {/* BODY */}

        <div className="space-y-5 px-6 py-5">

          {/* KIOSK */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Kiosk
            </label>

            <div className="relative">

              <Monitor
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                value={form.kiosk_id}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    kiosk_id: e.target.value,
                  }))
                }
                disabled={saving}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-10 text-sm text-slate-700 transition focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:opacity-60"
              >

                <option value="">
                  Select a kiosk
                </option>

                {selectableKiosks.length > 0 ? (
                  selectableKiosks.map(
                    (kiosk) => (
                      <option
                        key={kiosk.kiosk_id}
                        value={kiosk.kiosk_id}
                      >
                        {kiosk.name}
                        {String(
                          kiosk.status || ''
                        ).toLowerCase() !== 'active'
                          ? ' (Inactive)'
                          : ''}
                      </option>
                    )
                  )
                ) : (
                  <option
                    value=""
                    disabled
                  >
                    No active kiosks found
                  </option>
                )}

              </select>

              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-.02-1.06.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 1.04l-4.25-4.51a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>

            </div>

            {activeKiosks.length === 0 && (
              <p className="mt-1.5 text-[11px] text-red-500">
                No active kiosks are available. Please add or activate a kiosk first.
              </p>
            )}

            {!form.kiosk_id &&
              activeKiosks.length > 0 && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Select the kiosk where this department will be assigned.
                </p>
              )}

          </div>

          {/* DEPARTMENT NAME */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Department Name
            </label>

            <input
              type="text"
              value={form.department_name}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  department_name:
                    e.target.value,
                }))
              }
              disabled={
                !form.kiosk_id ||
                saving
              }
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder={
                form.kiosk_id
                  ? 'e.g. Laboratory'
                  : 'Select a kiosk first'
              }
            />

            {!form.kiosk_id && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Department name becomes available after selecting a kiosk.
              </p>
            )}

          </div>

          {/* PREFIX + STATUS */}

          <div className="grid grid-cols-2 gap-4">

            {/* PREFIX */}

            <div>

              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Queue Prefix Code
              </label>

              <input
                type="text"
                value={form.prefix}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    prefix:
                      e.target.value.toUpperCase(),
                  }))
                }
                disabled={
                  !form.kiosk_id ||
                  saving
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="e.g. L or P"
              />

            </div>

            {/* STATUS */}

            <div>

              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Status
              </label>

              <select
                value={form.status}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    status:
                      e.target.value,
                  }))
                }
                disabled={
                  !form.kiosk_id ||
                  saving
                }
                className="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:opacity-60"
              >

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status
                        .charAt(0)
                        .toUpperCase() +
                        status.slice(1)}
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

        </div>

        {/* FOOTER */}

        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={
              saving ||
              !form.kiosk_id ||
              !form.department_name.trim()
            }
            className="flex items-center gap-2 rounded-lg bg-[#00529B] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? 'Saving...'
              : isEditing
                ? 'Save Changes'
                : '+ Add Department'}
          </button>

        </div>

      </div>
    </div>
  );
}

// ===========================================================
// RESET PIN MODAL
// ===========================================================

function ResetPinModal({
  open,
  onClose,
  onConfirm,
  pinInput,
  setPinInput,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">

          <h2 className="text-lg font-bold text-slate-700">
            Reset Department
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>

        </div>

        <div className="space-y-4 px-6 py-5">

          <div>

            <p className="text-sm text-slate-600">
              Enter the administrator PIN to reset this department.
            </p>

            <p className="mt-1 text-xs text-slate-400">
              This action only resets the current frontend queue display.
            </p>

          </div>

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Admin PIN
            </label>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                const value =
                  e.target.value.replace(
                    /\D/g,
                    ''
                  );

                setPinInput(value);
              }}
              placeholder="Enter 4-digit PIN"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              autoFocus
            />

          </div>

        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={
              pinInput.length !== 4
            }
            className="rounded-lg bg-[#00529B] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Verify PIN
          </button>

        </div>

      </div>

    </div>
  );
}

// ===========================================================
// MAIN COMPONENT
// ===========================================================

export default function DepartmentCrud() {

  // =========================================================
  // STATE
  // =========================================================

  const [departments, setDepartments] =
    useState([]);

  const [kiosks, setKiosks] =
    useState([]);

  const [counters, setCounters] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [loadingKiosks, setLoadingKiosks] =
    useState(false);

  const [loadingCounters, setLoadingCounters] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [success, setSuccess] =
    useState('');

  const [searchQuery, setSearchQuery] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [editingId, setEditingId] =
    useState(null);

  const [form, setForm] =
    useState({
      ...EMPTY_FORM,
    });

  const [resettingId, setResettingId] =
    useState(null);

  const [pinInput, setPinInput] =
    useState('');

  const [showResetPin, setShowResetPin] =
    useState(false);

  // =========================================================
  // FETCH KIOSKS THROUGH NODE.JS
  // =========================================================
  //
  // React no longer talks directly to Firebase.
  //
  // React → backendApi.js
  //       → GET /api/kiosks
  //       → kioskRoutes.js
  //       → kioskService.js
  //       → Firebase / MySQL
  //

  async function fetchKiosks() {

    setLoadingKiosks(true);

    try {

      console.log(
        '================================='
      );

      console.log(
        'FETCHING KIOSKS THROUGH NODE.JS'
      );

      const response =
        await getKiosks();

      console.log(
        'RAW KIOSK API RESPONSE:',
        response
      );

      const kioskRows =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

      const kioskData =
        kioskRows
          .map(
            (kiosk) => {

              const kioskId =
                kiosk.kiosk_id ||
                kiosk.id ||
                kiosk.firestore_id ||
                '';

              return {
                kiosk_id:
                  kioskId,

                firestore_id:
                  kiosk.firestore_id ||
                  '',

                name:
                  kiosk.name ||
                  kiosk.kiosk_name ||
                  'Unnamed Kiosk',

                status:
                  String(
                    kiosk.status ||
                      'active'
                  ).toLowerCase(),

                created_at:
                  kiosk.created_at ||
                  null,

                updated_at:
                  kiosk.updated_at ||
                  null,
              };
            }
          )
          .filter(
            (kiosk) =>
              kiosk.kiosk_id
          )
          .sort(
            (a, b) =>
              String(a.name || '').localeCompare(
                String(b.name || '')
              )
          );

      setKiosks(
        kioskData
      );

      console.log(
        'KIOSKS RECEIVED FROM NODE:',
        kioskData
      );

      console.log(
        'KIOSK COUNT:',
        kioskData.length
      );

      console.log(
        '================================='
      );

      return kioskData;

    } catch (err) {

      console.error(
        'FETCH KIOSKS THROUGH NODE ERROR:',
        err
      );

      setKiosks([]);

      setError(
        err.message ||
          'Failed to fetch kiosks from the backend.'
      );

      return [];

    } finally {

      setLoadingKiosks(false);

    }
  }

  // =========================================================
  // FETCH TERMINALS THROUGH NODE.JS
  // =========================================================
  //
  // React → Node.js → Firebase / MySQL
  //
  // backendApi.js:
  // GET /api/counters
  //

  async function fetchCounters() {

    setLoadingCounters(true);

    try {

      console.log(
        '================================='
      );

      console.log(
        'FETCHING TERMINALS THROUGH NODE.JS'
      );

      const response =
        await getTerminals();

      console.log(
        'RAW TERMINAL API RESPONSE:',
        response
      );

      const terminalRows =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

      const counterData =
        terminalRows.map(
          (counter) => {

            return {
              counter_id:
                counter.counter_id ||
                counter.id ||
                counter.firestore_id ||
                '',

              department_id:
                counter.department_id ||
                '',

              counter_number:
                counter.counter_number ??
                '',

              prefix:
                counter.prefix ||
                '',

              status:
                String(
                  counter.status ||
                    'inactive'
                ).toLowerCase(),

              assigned_staff_id:
                counter.assigned_staff_id ||
                '',

              kiosk_id:
                counter.kiosk_id ||
                '',

              created_at:
                counter.created_at ||
                null,

              updated_at:
                counter.updated_at ||
                null,
            };
          }
        );

      setCounters(
        counterData
      );

      console.log(
        'TERMINALS RECEIVED FROM NODE:',
        counterData
      );

      console.log(
        'TERMINAL COUNT:',
        counterData.length
      );

      console.log(
        '================================='
      );

      return counterData;

    } catch (err) {

      console.error(
        'FETCH TERMINALS THROUGH NODE ERROR:',
        err
      );

      setCounters([]);

      setError(
        err.message ||
          'Failed to fetch terminals from the backend.'
      );

      return [];

    } finally {

      setLoadingCounters(false);

    }
  }

  // =========================================================
  // FETCH DEPARTMENTS THROUGH NODE.JS
  // =========================================================
  //
  // React → Node.js → Firebase / MySQL
  //

  async function fetchDepartments(
    kioskData = [],
    counterData = []
  ) {

    setLoading(true);
    setError(null);

    try {

      console.log(
        '================================='
      );

      console.log(
        'FETCHING DEPARTMENTS THROUGH NODE.JS'
      );

      const response =
        await getDepartments();

      console.log(
        'RAW DEPARTMENT API RESPONSE:',
        response
      );

      // -------------------------------------------------------
      // EXTRACT DATA
      // -------------------------------------------------------

      const departmentRows =
        Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];

      console.log(
        'DEPARTMENTS RECEIVED FROM NODE:',
        departmentRows
      );

      console.log(
        'DEPARTMENT COUNT FROM NODE:',
        departmentRows.length
      );

      // -------------------------------------------------------
      // FORMAT DEPARTMENTS
      // -------------------------------------------------------

      const formatted =
        departmentRows
          .map(
            (department) => {

              const departmentId =
                department.department_id ||
                department.id ||
                '';

              const kioskId =
                department.kiosk_id ||
                '';

              const kiosk =
                kioskData.find(
                  (item) =>
                    String(
                      item.kiosk_id
                    ) ===
                      String(
                        kioskId
                      ) ||
                    (
                      item.firestore_id &&
                      String(
                        item.firestore_id
                      ) ===
                        String(
                          kioskId
                        )
                    )
                );

              const departmentPrefix =
                String(
                  department.prefix ||
                    ''
                ).toUpperCase();

              const departmentName =
                String(
                  department.name ||
                    department.department_name ||
                    ''
                );

              // -------------------------------------------------
              // TERMINALS FOR THIS DEPARTMENT
              // -------------------------------------------------

              const departmentCounters =
                counterData.filter(
                  (counter) =>
                    String(
                      counter.department_id
                    ) ===
                    String(
                      departmentId
                    )
                );

              const activeCounterCount =
                departmentCounters.filter(
                  (counter) =>
                    String(
                      counter.status ||
                        ''
                    ).toLowerCase() ===
                    'active'
                ).length;

              const totalCounterCount =
                departmentCounters.length;

              const activeTerminals =
                `${activeCounterCount}/${totalCounterCount}`;

              const normalizedStatus =
                String(
                  department.status ||
                    'active'
                ).toLowerCase();

              const formattedDepartment = {

                id:
                  departmentId,

                department_id:
                  departmentId,

                department_name:
                  departmentName,

                kiosk_id:
                  kioskId,

                kiosk_name:
                  kiosk?.name ||
                  'Unassigned',

                location:
                  department.location ||
                  '',

                classification:
                  department.classification ||
                  '',

                prefix:
                  departmentPrefix,

                waiting:
                  Number(
                    department.waiting
                  ) || 0,

                current_queue:
                  department.current_queue ||
                  (
                    departmentPrefix
                      ? `${departmentPrefix}-0010`
                      : `${(
                          departmentName ||
                          'D'
                        )
                          .charAt(0)
                          .toUpperCase()}-0010`
                  ),

                active_terminals:
                  activeTerminals,

                terminal_count:
                  totalCounterCount,

                active_terminal_count:
                  activeCounterCount,

                waiting_terminal_count:
                  departmentCounters.filter(
                    (counter) =>
                      String(
                        counter.status ||
                          ''
                      ).toLowerCase() !==
                      'active'
                  ).length,

                avg_wait:
                  department.est_time !==
                    undefined &&
                  department.est_time !==
                    null
                    ? `${department.est_time}m`
                    : '15m',

                est_time:
                  Number(
                    department.est_time
                  ) || 15,

                status:
                  normalizedStatus,

                created_at:
                  department.created_at ||
                  null,

                updated_at:
                  department.updated_at ||
                  null,
              };

              console.log(
                'FORMATTED DEPARTMENT:',
                formattedDepartment
              );

              return formattedDepartment;
            }
          )
          .filter(
            (department) =>
              department.id &&
              department.department_name
          )
          .sort(
            (a, b) =>
              a.department_name.localeCompare(
                b.department_name
              )
          );

      console.log(
        '================================='
      );

      console.log(
        'FINAL DEPARTMENTS FOR REACT:',
        formatted
      );

      console.log(
        'FINAL DEPARTMENT COUNT:',
        formatted.length
      );

      console.log(
        '================================='
      );

      setDepartments(
        formatted
      );

    } catch (err) {

      console.error(
        'FETCH DEPARTMENTS THROUGH NODE ERROR:',
        err
      );

      setError(
        err.message ||
          'Failed to fetch departments from the backend.'
      );

      setDepartments([]);

    } finally {

      setLoading(false);

    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {

    async function loadData() {

      setLoading(true);
      setError(null);

      try {

        /*
         * All three resources are now loaded through Node.js.
         *
         * React
         *   ↓
         * Node.js
         *   ↓
         * Firebase / MySQL
         */

        const [
          kioskData,
          counterData,
        ] = await Promise.all([
          fetchKiosks(),
          fetchCounters(),
        ]);

        await fetchDepartments(
          kioskData,
          counterData
        );

      } catch (err) {

        console.error(
          'DEPARTMENT MANAGEMENT INITIAL LOAD ERROR:',
          err
        );

        setError(
          err.message ||
            'Failed to load department management data.'
        );

        setLoading(false);

      }
    }

    loadData();

  }, []);

  // =========================================================
  // OPEN ADD DEPARTMENT
  // =========================================================

  async function openAdd() {

    setError(null);
    setSuccess('');

    const kioskData =
      await fetchKiosks();

    const activeKioskCount =
      kioskData.filter(
        (kiosk) =>
          String(
            kiosk.status || ''
          ).toLowerCase() ===
          'active'
      ).length;

    if (
      activeKioskCount ===
      0
    ) {

      setError(
        'No active kiosks were found. Please add or activate a kiosk first.'
      );
    }

    setForm({
      ...EMPTY_FORM,
    });

    setEditingId(
      'new'
    );
  }

  // =========================================================
  // OPEN EDIT
  // =========================================================

  function openEdit(
    department
  ) {

    setForm({

      department_name:
        department.department_name ||
        '',

      kiosk_id:
        department.kiosk_id ||
        '',

      prefix:
        department.prefix ||
        '',

      status:
        department.status ||
        'active',

    });

    setEditingId(
      department.id
    );

    setError(null);
    setSuccess('');
  }

  // =========================================================
  // CLOSE MODAL
  // =========================================================

  function closeModal() {

    if (saving) {
      return;
    }

    setEditingId(
      null
    );

    setForm({
      ...EMPTY_FORM,
    });

    setError(null);
  }

  // =========================================================
  // SAVE DEPARTMENT
  // =========================================================

  async function handleSave() {

    const departmentName =
      form.department_name.trim();

    const prefix =
      form.prefix
        .trim()
        .toUpperCase();

    if (!departmentName) {

      setError(
        'Department name is required.'
      );

      return;
    }

    if (!form.kiosk_id) {

      setError(
        'Please select a kiosk.'
      );

      return;
    }

    const selectedKiosk =
      kiosks.find(
        (kiosk) =>
          String(
            kiosk.kiosk_id
          ) ===
            String(
              form.kiosk_id
            ) ||
          (
            kiosk.firestore_id &&
            String(
              kiosk.firestore_id
            ) ===
              String(
                form.kiosk_id
              )
          )
      );

    if (!selectedKiosk) {

      setError(
        'The selected kiosk could not be found. Please select a kiosk again.'
      );

      return;
    }

    // Only active kiosks can receive a new department.

    if (
      String(
        selectedKiosk.status || ''
      ).toLowerCase() !==
      'active'
    ) {

      setError(
        'The selected kiosk is inactive. Please select an active kiosk.'
      );

      return;
    }

    setSaving(true);
    setError(null);
    setSuccess('');

    try {

      // =====================================================
      // DUPLICATE CHECK
      // =====================================================

      const duplicate =
        departments.find(
          (department) => {

            if (
              editingId !== 'new' &&
              String(
                department.id
              ) ===
                String(
                  editingId
                )
            ) {
              return false;
            }

            const existingName =
              String(
                department.department_name ||
                  ''
              )
                .trim()
                .toLowerCase();

            return (
              existingName ===
              departmentName.toLowerCase()
            );
          }
        );

      if (duplicate) {

        setError(
          `A department named "${departmentName}" already exists.`
        );

        return;
      }

      // =====================================================
      // PAYLOAD
      // =====================================================

      const departmentData = {

        name:
          departmentName,

        kiosk_id:
          form.kiosk_id,

        prefix:
          prefix || '',

        status:
          String(
            form.status ||
              'active'
          ).toLowerCase(),

        classification:
          '',

        location:
          '',

        est_time:
          15,
      };

      console.log(
        'DEPARTMENT PAYLOAD:',
        departmentData
      );

      // =====================================================
      // CREATE
      // =====================================================

      if (
        editingId ===
        'new'
      ) {

        const response =
          await createDepartment(
            departmentData
          );

        console.log(
          'CREATE DEPARTMENT RESPONSE:',
          response
        );

        setSuccess(
          `"${departmentName}" was added successfully.`
        );

      }

      // =====================================================
      // UPDATE
      // =====================================================

      else {

        const response =
          await updateDepartment(
            editingId,
            departmentData
          );

        console.log(
          'UPDATE DEPARTMENT RESPONSE:',
          response
        );

        setSuccess(
          `"${departmentName}" was updated successfully.`
        );
      }

      // =====================================================
      // CLOSE MODAL
      // =====================================================

      setEditingId(
        null
      );

      setForm({
        ...EMPTY_FORM,
      });

      // =====================================================
      // REFRESH ALL DATA THROUGH NODE.JS
      // =====================================================

      const [
        refreshedKiosks,
        refreshedCounters,
      ] = await Promise.all([
        fetchKiosks(),
        fetchCounters(),
      ]);

      await fetchDepartments(
        refreshedKiosks,
        refreshedCounters
      );

    } catch (err) {

      console.error(
        'SAVE DEPARTMENT THROUGH NODE ERROR:',
        err
      );

      setError(
        err.message ||
          'Failed to save department through the backend.'
      );

    } finally {

      setSaving(false);

    }
  }

  // =========================================================
  // RESET DEPARTMENT
  // =========================================================

  function handleReset() {

    if (!resettingId) {
      return;
    }

    const department =
      departments.find(
        (dept) =>
          String(
            dept.id
          ) ===
          String(
            resettingId
          )
      );

    if (!department) {

      setError(
        'Department not found.'
      );

      return;
    }

    setDepartments(
      (currentDepartments) =>
        currentDepartments.map(
          (dept) => {

            if (
              String(
                dept.id
              ) !==
              String(
                resettingId
              )
            ) {
              return dept;
            }

            return {

              ...dept,

              waiting:
                0,

              current_queue:
                dept.prefix
                  ? `${dept.prefix}-0010`
                  : `${(
                      dept.department_name ||
                      'D'
                    )
                      .charAt(0)
                      .toUpperCase()}-0010`,

              active_terminals:
                dept.active_terminals,

              avg_wait:
                '15m',

              est_time:
                15,

            };
          }
        )
    );

    setShowResetPin(
      false
    );

    setResettingId(
      null
    );

    setPinInput('');

    setError(null);

    setSuccess(
      'Department queue display has been reset.'
    );
  }

  // =========================================================
  // SEARCH
  // =========================================================

  useEffect(() => {

    setPage(1);

  }, [searchQuery]);

  const filteredDepartments =
    departments.filter(
      (department) => {

        const search =
          searchQuery
            .toLowerCase()
            .trim();

        const departmentName =
          String(
            department.department_name ||
              ''
          ).toLowerCase();

        const kioskName =
          String(
            department.kiosk_name ||
              ''
          ).toLowerCase();

        const status =
          String(
            department.status ||
              ''
          ).toLowerCase();

        return (
          departmentName.includes(
            search
          ) ||
          kioskName.includes(
            search
          ) ||
          status.includes(
            search
          )
        );
      }
    );

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredDepartments.length /
          PAGE_SIZE
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const firstIndex =
    (currentPage - 1) *
    PAGE_SIZE;

  const paginatedDepartments =
    filteredDepartments.slice(
      firstIndex,
      firstIndex +
        PAGE_SIZE
    );

  // =========================================================
  // SUMMARY METRICS
  // =========================================================

  const totalWaiting =
    departments.reduce(
      (total, department) =>
        total +
        (
          Number(
            department.waiting
          ) || 0
        ),
      0
    );

  const activeDepts =
    departments.filter(
      (department) =>
        String(
          department.status ||
            ''
        ).toLowerCase() ===
        'active'
    ).length;

  const totalDepts =
    departments.length;

  const averageWait =
    departments.length > 0
      ? Math.round(
          departments.reduce(
            (
              total,
              department
            ) =>
              total +
              (
                Number(
                  department.est_time
                ) || 0
              ),
            0
          ) /
            departments.length
        )
      : 0;

  const totalActiveTerminals =
    counters.filter(
      (counter) =>
        counter.department_id &&
        String(
          counter.status ||
            ''
        ).toLowerCase() ===
        'active'
    ).length;

  // =========================================================
  // MODAL STATE
  // =========================================================

  const isModalOpen =
    editingId !== null;

  const isEditing =
    isModalOpen &&
    editingId !== 'new';

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold text-slate-800">
            Department Management
          </h1>

          <p className="mt-0.5 text-xs text-slate-500">
            Configure departments and associate them with hospital kiosks.
          </p>

        </div>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={openAdd}
            disabled={
              loadingKiosks
            }
            className="flex items-center gap-1.5 rounded-md bg-[#00529B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-50"
          >

            <Plus size={15} />

            {loadingKiosks
              ? 'Loading Kiosks...'
              : 'Add Department'}

          </button>

        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* DEPARTMENT */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              DEPARTMENT
            </span>

            <Building2
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {activeDepts}/
              {totalDepts}
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ACTIVE DEPARTMENTS
            </p>

          </div>

        </div>

        {/* TOTAL WAITING */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TOTAL WAITING
            </span>

            <Users
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {totalWaiting}
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ACROSS ALL DEPARTMENTS
            </p>

          </div>

        </div>

        {/* AVERAGE WAIT */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              AVERAGE WAIT
            </span>

            <Clock
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {averageWait}m
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              AVERAGE WAIT TIME
            </p>

          </div>

        </div>

        {/* TERMINAL */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TERMINAL
            </span>

            <Monitor
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {loadingCounters
                ? '...'
                : totalActiveTerminals}
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ACTIVE TERMINALS
            </p>

          </div>

        </div>

      </div>

      {/* =====================================================
          DEPARTMENT OVERVIEW
      ===================================================== */}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">

          <h2 className="text-base font-bold text-slate-800">
            Department Overview
          </h2>

          <div className="relative w-80">

            <input
              type="text"
              placeholder="Search department"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 py-2 pl-4 pr-10 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />

            <Search
              size={15}
              className="absolute right-3.5 top-2.5 text-slate-400"
            />

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs">

            <thead>

              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-slate-500">

                <th className="px-6 py-3.5">
                  DEPARTMENT
                </th>

                <th className="px-6 py-3.5">
                  KIOSK
                </th>

                <th className="px-6 py-3.5 text-center">
                  WAITING
                </th>

                <th className="px-6 py-3.5 text-center">
                  CURRENT QUEUE
                </th>

                <th className="px-6 py-3.5 text-center">
                  ACTIVE TERMINALS
                </th>

                <th className="px-6 py-3.5 text-center">
                  AVG WAIT
                </th>

                <th className="px-6 py-3.5 text-right">
                  STATUS
                </th>

                <th className="px-6 py-3.5 text-right">
                  ACTION
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-600">

              {/* LOADING */}

              {loading && (
                <tr>

                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    Loading departments from backend...
                  </td>

                </tr>
              )}

              {/* EMPTY */}

              {!loading &&
                filteredDepartments.length ===
                  0 && (
                  <tr>

                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      No departments found matching your search.
                    </td>

                  </tr>
                )}

              {/* DEPARTMENTS */}

              {!loading &&
                paginatedDepartments.map(
                  (department) => (
                    <tr
                      key={
                        department.id
                      }
                      onClick={() =>
                        openEdit(
                          department
                        )
                      }
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >

                      {/* DEPARTMENT */}

                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {
                          department.department_name
                        }
                      </td>

                      {/* KIOSK */}

                      <td className="px-6 py-4">

                        <div className="flex items-center gap-2">

                          <Monitor
                            size={14}
                            className="text-slate-400"
                          />

                          <span
                            className={
                              department.kiosk_name ===
                              'Unassigned'
                                ? 'text-slate-400'
                                : 'font-medium text-slate-600'
                            }
                          >
                            {
                              department.kiosk_name
                            }
                          </span>

                        </div>

                      </td>

                      {/* WAITING */}

                      <td className="px-6 py-4 text-center text-slate-700">
                        {
                          department.waiting
                        }
                      </td>

                      {/* CURRENT QUEUE */}

                      <td className="px-6 py-4 text-center font-medium text-slate-700">
                        {
                          department.current_queue
                        }
                      </td>

                      {/* ACTIVE TERMINALS */}

                      <td className="px-6 py-4 text-center text-slate-600">
                        {
                          department.active_terminals
                        }
                      </td>

                      {/* AVG WAIT */}

                      <td className="px-6 py-4 text-center text-slate-600">
                        {
                          department.avg_wait
                        }
                      </td>

                      {/* STATUS */}

                      <td className="px-6 py-4 text-right">

                        <span
                          className={
                            department.status ===
                            'active'
                              ? 'font-medium text-slate-800'
                              : 'font-medium text-slate-500'
                          }
                        >
                          {String(
                            department.status ||
                              'active'
                          )
                            .charAt(0)
                            .toUpperCase() +
                            String(
                              department.status ||
                                'active'
                            ).slice(
                              1
                            )}
                        </span>

                      </td>

                      {/* ACTION */}

                      <td className="px-6 py-4 text-right">

                        <button
                          type="button"
                          onClick={(e) => {

                            e.stopPropagation();

                            setResettingId(
                              department.id
                            );

                            setPinInput(
                              ''
                            );

                            setShowResetPin(
                              true
                            );

                            setError(
                              null
                            );

                            setSuccess(
                              ''
                            );

                          }}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Reset
                        </button>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

        {/* PAGINATION */}

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">

          <span>

            {filteredDepartments.length ===
            0
              ? 'No departments to show'
              : `Showing ${
                  firstIndex + 1
                } to ${
                  firstIndex +
                  paginatedDepartments.length
                } of ${
                  filteredDepartments.length
                } departments`}

          </span>

          <div className="flex items-center gap-1.5">

            <button
              type="button"
              onClick={() =>
                setPage((p) =>
                  Math.max(
                    1,
                    p - 1
                  )
                )
              }
              disabled={
                currentPage ===
                1
              }
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50"
            >
              Prev
            </button>

            {getPageNumbers(
              currentPage,
              totalPages
            ).map(
              (number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() =>
                    setPage(
                      number
                    )
                  }
                  aria-current={
                    number ===
                    currentPage
                      ? 'page'
                      : undefined
                  }
                  className={`rounded-md border border-slate-200 px-3 py-1 transition ${
                    number ===
                    currentPage
                      ? 'bg-white font-semibold text-slate-700 shadow-sm'
                      : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {number}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() =>
                setPage((p) =>
                  Math.min(
                    totalPages,
                    p + 1
                  )
                )
              }
              disabled={
                currentPage ===
                totalPages
              }
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50"
            >
              Next
            </button>

          </div>

        </div>

      </div>

      {/* =====================================================
          DEPARTMENT VOLUME
      ===================================================== */}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

        <h2 className="text-base font-bold text-slate-800">
          Department Volume
        </h2>

        <div className="mt-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">

          <p className="text-xs text-slate-400">
            Department volume charts and activity logs will render here.
          </p>

        </div>

      </div>

      {/* =====================================================
          ADD / EDIT DEPARTMENT MODAL
      ===================================================== */}

      {isModalOpen && (
        <DepartmentModal
          open={
            isModalOpen
          }

          form={
            form
          }

          setForm={
            setForm
          }

          onSave={
            handleSave
          }

          onClose={
            closeModal
          }

          isEditing={
            isEditing
          }

          saving={
            saving
          }

          kiosks={
            kiosks
          }
        />
      )}

      {/* =====================================================
          RESET PIN MODAL
      ===================================================== */}

      <ResetPinModal
        open={
          showResetPin
        }

        onClose={() => {

          setShowResetPin(
            false
          );

          setResettingId(
            null
          );

          setPinInput(
            ''
          );

        }}

        onConfirm={() => {

          if (
            pinInput ===
            RESET_PIN
          ) {

            handleReset();

          } else {

            setError(
              'Incorrect PIN.'
            );

          }

        }}

        pinInput={
          pinInput
        }

        setPinInput={
          setPinInput
        }
      />

    </div>
  );
}