import { useEffect, useState } from 'react';

import { auth } from '../../../firebase';

import {
  getKiosks,
  getTerminals,
  getDepartments,
  createDepartment,
  updateDepartment,
  validateSecurityPin,
  getSecurityPinStatus,
} from '../../services/backendApi';

import SecurityPinModal, {
  readPinIsSet,
} from '../../components/SecurityPinModal';

import {
  Search,
  Building2,
  Users,
  Clock,
  Monitor,
  Plus,
  X,
  Check,
  ChevronDown,
  MapPin,
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

/* =========================================================
   DEPARTMENT VOLUME — bar chart
   Waiting patients per department. Plain SVG, no library.
========================================================= */

function DepartmentVolumeChart({ departments }) {
  const rows = departments
    .map((department) => ({
      name: department.name || 'Department',
      value: Number(department.waiting) || 0,
      wait: parseInt(String(department.avg_wait || ''), 10) || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-[#4B5563]">
        No departments to chart yet.
      </p>
    );
  }

  const max = Math.max(...rows.map((row) => row.value), 1);
  const busiest = rows[0];

  const longestWait = rows.reduce(
    (worst, row) => (row.wait > (worst?.wait || 0) ? row : worst),
    null
  );

  const ticks = [0, 0.5, 1];

  return (
    <div>
      <div className="flex gap-3">
        {/* y axis */}
        <div className="flex w-8 shrink-0 flex-col justify-between py-1 text-right">
          {[...ticks].reverse().map((tick) => (
            <span key={tick} className="text-xs text-[#9CA3AF]">
              {Math.round(max * tick)}
            </span>
          ))}
        </div>

        {/* plot */}
        <div className="relative min-w-0 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden="true"
              className="absolute left-0 right-0 border-t border-dashed border-[#E5E7EB]"
              style={{ bottom: `${tick * 100}%` }}
            />
          ))}

          <div className="relative flex h-48 items-end gap-3">
            {rows.map((row, index) => (
              <div
                key={row.name}
                className="group flex min-w-0 flex-1 flex-col items-center justify-end"
              >
                <span className="mb-1 text-xs font-semibold text-[#1F2937]">
                  {row.value}
                </span>

                <div
                  title={`${row.name}: ${row.value} waiting`}
                  className={`swu-grow-y w-full rounded-t-md transition-colors duration-200 ${
                    index === 0
                      ? 'bg-[#9D0A0E] group-hover:bg-[#7D080B]'
                      : 'bg-[#B34C4C] group-hover:bg-[#9D0A0E]'
                  }`}
                  style={{
                    height: `${Math.max((row.value / max) * 100, 2)}%`,
                    animationDelay: `${index * 60}ms`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* x labels */}
          <div className="mt-2 flex gap-3 border-t border-[#E5E7EB] pt-2">
            {rows.map((row) => (
              <span
                key={row.name}
                className="min-w-0 flex-1 truncate text-center text-xs text-[#4B5563]"
                title={row.name}
              >
                {row.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* legend + summary */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-3 text-xs text-[#4B5563]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#9D0A0E]" />
            Busiest department
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#B34C4C]" />
            Waiting patients
          </span>

          {longestWait && longestWait.wait > 0 && (
            <span>
              Peak wait time:{' '}
              <span className="font-semibold text-[#1F2937]">
                {longestWait.name} (~{longestWait.wait} mins)
              </span>
            </span>
          )}
        </div>

        <span>
          Total currently in queue:{' '}
          <span className="font-semibold text-[#1F2937]">
            {total} patient{total === 1 ? '' : 's'}
          </span>
        </span>
      </div>
    </div>
  );
}

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
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="swu-pop w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">

          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              {isEditing
                ? 'Edit Department'
                : 'Add New Department'}
            </h2>

            <p className="mt-1 text-xs text-[#4B5563]">
              {isEditing
                ? 'Update the department configuration below.'
                : 'Create a department and assign it to a kiosk.'}
            </p>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              Fields marked{' '}
              <span className="text-[#9D0A0E]">*</span>
              {' '}are required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30 disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>

        </div>


        {/* ===================================================
            BODY
        =================================================== */}

        <div className="space-y-4 px-6 py-5">

          {/* ----- KIOSK ----- */}

          <div>

            <label
              htmlFor="department-kiosk"
              className="mb-1 block text-sm font-semibold text-[#1F2937]"
            >
              Kiosk
              <span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>

            <div className="relative">

              <Monitor
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
              />

              <select
                id="department-kiosk"
                value={form.kiosk_id}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    kiosk_id: e.target.value,
                  }))
                }
                disabled={saving}
                className="w-full appearance-none rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-10 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:cursor-not-allowed disabled:opacity-60"
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

              <ChevronDown
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
              />

            </div>

            {/* Assignment confirmation chip */}

            {selectedKiosk && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#F0DADA] bg-[#FBF1F1] px-2.5 py-1 text-xs font-medium text-[#9D0A0E]">
                <MapPin size={12} />
                Assigning to: {selectedKiosk.name}
              </p>
            )}

            {activeKiosks.length === 0 && (
              <p className="mt-1.5 text-xs text-[#9D0A0E]">
                No active kiosks are available. Please add or activate a kiosk first.
              </p>
            )}

            {!form.kiosk_id &&
              activeKiosks.length > 0 && (
                <p className="mt-1.5 text-xs text-[#4B5563]">
                  Select the kiosk where this department will be assigned.
                </p>
              )}

          </div>


          {/* ----- DEPARTMENT NAME ----- */}

          <div>

            <label
              htmlFor="department-name"
              className="mb-1 block text-sm font-semibold text-[#1F2937]"
            >
              Department Name
              <span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>

            <input
              id="department-name"
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
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:cursor-not-allowed disabled:bg-[#F1F3F5] disabled:text-[#9CA3AF]"
              placeholder={
                form.kiosk_id
                  ? 'e.g. Laboratory, Pharmacy, Billing'
                  : 'Select a kiosk first'
              }
            />

            {!form.kiosk_id && (
              <p className="mt-1.5 text-xs text-[#4B5563]">
                Department name becomes available after selecting a kiosk.
              </p>
            )}

          </div>


          {/* ----- PREFIX + STATUS ----- */}

          <div className="grid grid-cols-2 gap-4">

            <div>

              <label
                htmlFor="department-prefix"
                className="mb-1 block text-sm font-semibold text-[#1F2937]"
              >
                Department Prefix
                <span className="ml-0.5 text-[#9D0A0E]">*</span>
              </label>

              <input
                id="department-prefix"
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
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:cursor-not-allowed disabled:bg-[#F1F3F5] disabled:text-[#9CA3AF]"
                placeholder="e.g. L or P"
              />

              <p className="mt-1.5 text-xs text-[#4B5563]">
                Tickets will show as{' '}
                {form.prefix
                  ? `${form.prefix}-001`
                  : 'ML-001'}
              </p>

            </div>


            <div>

              <label className="mb-1 block text-sm font-semibold text-[#1F2937]">
                Status
              </label>

              <div className="inline-flex rounded-lg border border-[#E5E7EB] p-1">
                {STATUS_OPTIONS.map((status) => {
                  const isSelected =
                    form.status === status;

                  const isDisabled =
                    !form.kiosk_id || saving;

                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={isDisabled}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          status: status,
                        }))
                      }
                      aria-pressed={isSelected}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-[#4B5563] hover:bg-[#F1F3F5]'
                      }`}
                    >
                      {isSelected && (
                        <Check size={14} />
                      )}

                      {status}
                    </button>
                  );
                })}
              </div>

            </div>

          </div>

        </div>


        {/* ===================================================
            FOOTER
        =================================================== */}

        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-4">

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-sm font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-40"
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
            className="swu-press flex items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-sm"
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
// RESET DEPARTMENT SELECTION MODAL
// ===========================================================
function ResetDepartmentSelectionModal({
  open,
  onClose,
  departments,
  selectedResetIds,
  setSelectedResetIds,
  onContinue,
}) {
  if (!open) {
    return null;
  }

  function toggleDepartment(departmentId) {
    setSelectedResetIds((currentIds) => {
      if (currentIds.includes(departmentId)) {
        return currentIds.filter(
          (id) => id !== departmentId
        );
      }

      return [
        ...currentIds,
        departmentId,
      ];
    });
  }

  function toggleSelectAll() {
  if (selectedResetIds.length === departments.length) {
    setSelectedResetIds([]);
    return;
  }

  setSelectedResetIds(
    departments.map((department) => department.id)
  );
}

  return (
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="swu-pop w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              Reset Departments
            </h2>

            <p className="mt-1 text-xs text-[#4B5563]">
              Select the department whose queue display you want to reset.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded text-[#9CA3AF] transition hover:text-[#1F2937]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto px-6 py-5">
          {departments.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-left transition hover:bg-[#F1F3F5]"
            >
              <span className="text-sm font-semibold text-[#1F2937]">
                {selectedResetIds.length === departments.length
                  ? 'Unselect All'
                  : 'Select All'}
              </span>

              <div
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  selectedResetIds.length === departments.length
                    ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                    : 'border-[#D1D5DB] bg-white'
                }`}
              >
                {selectedResetIds.length === departments.length && (
                  <Check size={13} />
                )}
              </div>
            </button>
          )}
          {departments.length === 0 ? (
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-6 text-center text-sm text-[#4B5563]">
              No departments are available to reset.
            </div>
          ) : (
            <div className="space-y-2">
              {departments.map((department) => {
                const isSelected =
                  selectedResetIds.includes(
                    department.id
                  );

                return (
                  <button
                    key={department.id}
                    type="button"
                    onClick={() =>
                      toggleDepartment(
                        department.id
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-[#9D0A0E] bg-[#FBF1F1]'
                        : 'border-[#E5E7EB] bg-white hover:bg-[#F8F9FA]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#1F2937]">
                        {department.department_name}
                      </p>

                      <p className="mt-0.5 text-xs text-[#4B5563]">
                        {department.kiosk_name}
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                          : 'border-[#D1D5DB] bg-white'
                      }`}
                    >
                      {isSelected && (
                        <Check size={13} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-4">
          <span className="text-xs text-[#4B5563]">
            {selectedResetIds.length} department
            {selectedResetIds.length === 1
              ? ''
              : 's'} selected
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-sm font-medium text-[#4B5563] transition hover:bg-[#F1F3F5]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onContinue}
              disabled={
                selectedResetIds.length === 0
              }
              className="swu-press rounded-lg bg-[#9D0A0E] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-sm"
            >
              Continue
            </button>
          </div>
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
  verifying,
}) {
  if (!open) {
    return null;
  }

return (
  <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
    <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
        <h2 className="text-lg font-bold text-[#1F2937]">
          Reset Department
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="text-[#4B5563] transition hover:text-[#1F2937]"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-4 px-6 py-5">
        <div>
          <p className="text-sm text-[#4B5563]">
            Enter the administrator PIN to reset the selected departments.
          </p>

          <p className="mt-1 text-xs text-[#4B5563]">
            This action only resets the current frontend queue display.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#4B5563]">
            Security PIN
          </label>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setPinInput(value);
            }}
            placeholder="Enter 6-digit PIN"
            className="w-full rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-sm text-[#1F2937] focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
            autoFocus
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="swu-press rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-sm font-medium text-[#4B5563] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={pinInput.length !== 6}
          className="swu-press rounded-lg bg-[#9D0A0E] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-sm"
        >
          {verifying ? 'Verifying...' : 'Verify PIN'}
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

const [selectedResetIds, setSelectedResetIds] = useState([]);

const [showResetSelection, setShowResetSelection] =
  useState(false);

const [resettingIds, setResettingIds] =
  useState([]);

  const [pinInput, setPinInput] =
    useState('');

  // Shown when a reset is attempted before any Security PIN exists.
  const [showPinSetup, setShowPinSetup] =
    useState(false);

  const [showResetPin, setShowResetPin] =
    useState(false);

  const [verifyingResetPin, setVerifyingResetPin] =
  useState(false);  

  useEffect(() => {
    localStorage.setItem(
      'swu_reset_departments',
      JSON.stringify(resetDepartmentIds)
    );
  }, [resetDepartmentIds]);

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

const duplicate = departments.find(
  (department) => {
    // Ignore the department currently being edited
    if (
      editingId !== 'new' &&
      String(department.id) === String(editingId)
    ) {
      return false;
    }

    // Ignore departments that have already been reset
    if (
      resetDepartmentIds.includes(
        department.id
      )
    ) {
      return false;
    }

    const existingName = String(
      department.department_name || ''
    )
      .trim()
      .toLowerCase();

    return (
      existingName ===
      departmentName.trim().toLowerCase()
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

  async function handleResetSelectionContinue() {
  if (selectedResetIds.length === 0) {
    return;
  }

  setResettingIds(selectedResetIds);
  setPinInput('');
  setShowResetSelection(false);
  setError(null);
  setSuccess('');

  /*
  |--------------------------------------------------------------------------
  | SECURITY PIN GATE
  |--------------------------------------------------------------------------
  |
  | Resetting department records is a protected action. If this user has no
  | Security PIN yet, ask them to create one instead of showing a PIN prompt
  | they cannot possibly satisfy.
  |
  */
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    setError(
      'Your authentication session is unavailable. Please log in again.'
    );
    return;
  }

  try {
    const status = await getSecurityPinStatus(firebaseUser);

    if (readPinIsSet(status)) {
      setShowResetPin(true);
    } else {
      setShowPinSetup(true);
    }
  } catch (statusError) {
    console.error(
      'Security PIN status check failed:',
      statusError
    );

    // Status unavailable - fall back to asking for the PIN.
    setShowResetPin(true);
  }
}

async function handleResetPinConfirm() {
  if (resettingIds.length === 0) {
    return;
  }

  if (pinInput.length !== 6) {
    return;
  }

  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    setError(
      'Your authentication session is unavailable. Please log in again.'
    );
    return;
  }

  setVerifyingResetPin(true);
  setError(null);

  try {
    await validateSecurityPin(
      firebaseUser,
      pinInput
    );

    handleReset();
  } catch (error) {
    console.error(
      'Department reset Security PIN verification error:',
      error
    );

    setError(
      error?.message ||
        'Invalid Security PIN. Please try again.'
    );

    setPinInput('');
  } finally {
    setVerifyingResetPin(false);
  }
}

  // =========================================================
  // RESET DEPARTMENT
  // =========================================================

function handleReset() {
  if (resettingIds.length === 0) {
    return;
  }

  const selectedDepartments = departments.filter(
    (department) =>
      resettingIds.some(
        (id) =>
          String(id) ===
          String(department.id)
      )
  );

  if (selectedDepartments.length === 0) {
    setError('No selected departments were found.');
    return;
  }

  setResetDepartmentIds((currentIds) => {
    const newIds = selectedDepartments.map(
      (department) => department.id
    );

    return Array.from(
      new Set([
        ...currentIds,
        ...newIds,
      ])
    );
  });

  setDepartments((currentDepartments) =>
    currentDepartments.map((department) => {
      const shouldReset = resettingIds.some(
        (id) =>
          String(id) ===
          String(department.id)
      );

      if (!shouldReset) {
        return department;
      }

      return {
        ...department,
        waiting: 0,
        current_queue: department.prefix
          ? `${department.prefix}-0010`
          : `${(
              department.department_name ||
              'D'
            )
              .charAt(0)
              .toUpperCase()}-0010`,
        active_terminals:
          department.active_terminals,
        avg_wait: '15m',
        est_time: 15,
      };
    })
  );

  setShowResetPin(false);
  setResettingIds([]);
  setSelectedResetIds([]);
  setPinInput('');
  setError(null);

  setSuccess(
    selectedDepartments.length === 1
      ? 'Department queue display has been reset.'
      : `${selectedDepartments.length} departments have been reset.`
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
      // Hide departments that have been reset.
      if (
        resetDepartmentIds.includes(
          department.id
        )
      ) {
        return false;
      }

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

const activeDepts = departments.filter(
  (department) =>
    !resetDepartmentIds.some(
      (id) => String(id) === String(department.id)
    )
).length;

  const totalDepts = departments.length;

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
        <h1 className="text-2xl font-bold text-[#1F2937]">
          Department Management
        </h1>

        <p className="mt-0.5 text-xs text-[#4B5563]">
          Configure departments and associate them with hospital kiosks.
        </p>
      </div>

      <div className="flex items-center gap-2">

        <button
          type="button"
          onClick={() => {
            setSelectedResetIds([]);
            setShowResetSelection(true);
            setError(null);
            setSuccess('');
          }}
          className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#4B5563] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
        >
          Reset Departments
        </button>

        <button
          type="button"
          onClick={openAdd}
          disabled={loadingKiosks}
          className="swu-press flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          {loadingKiosks ? 'Loading Kiosks...' : 'Add Department'}
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

    <div className="swu-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* DEPARTMENT */}

      <div className="swu-card flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">

        <div className="flex items-center justify-between">

          <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
            DEPARTMENT
          </span>

          <Building2
            size={18}
            className="text-[#4B5563]"
          />

        </div>

        <div className="mt-3">

          <p className="text-2xl font-bold text-[#1F2937]">
            {activeDepts}/{totalDepts}
          </p>

          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
            ACTIVE DEPARTMENTS
          </p>

        </div>

      </div>
        {/* TOTAL WAITING */}

        <div className="swu-card flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
              TOTAL WAITING
            </span>

            <Users
              size={18}
              className="text-[#4B5563]"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-[#1F2937]">
              {totalWaiting}
            </p>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              ACROSS ALL DEPARTMENTS
            </p>

          </div>

        </div>

        {/* AVERAGE WAIT */}

        <div className="swu-card flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
              AVERAGE WAIT
            </span>

            <Clock
              size={18}
              className="text-[#4B5563]"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-[#1F2937]">
              {averageWait}m
            </p>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              AVERAGE WAIT TIME
            </p>

          </div>

        </div>

        {/* TERMINAL */}

        <div className="swu-card flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
              TERMINAL
            </span>

            <Monitor
              size={18}
              className="text-[#4B5563]"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-[#1F2937]">
              {loadingCounters
                ? '...'
                : totalActiveTerminals}
            </p>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              ACTIVE TERMINALS
            </p>

          </div>

        </div>

      </div>

      {/* =====================================================
          DEPARTMENT OVERVIEW
      ===================================================== */}

      <div className="swu-enter rounded-xl border border-[#E5E7EB] bg-white shadow-sm">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">

          <h2 className="text-base font-bold text-[#1F2937]">
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
              className="w-full rounded-full border border-[#E5E7EB] bg-[#F8F9FA] py-2 pl-4 pr-10 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
            />

            <Search
              size={15}
              className="absolute right-3.5 top-2.5 text-[#4B5563]"
            />

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs">

            <thead>

              <tr className="border-b border-[#E5E7EB] bg-[#FBF1F1] text-xs font-semibold uppercase tracking-wider text-[#4B5563]">

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
              </tr>

            </thead>

            <tbody className="divide-y divide-[#F1F3F5] text-[#4B5563]">

              {/* LOADING */}

              {loading && (
                <tr>

                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-[#4B5563]"
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
                      colSpan={7}
                      className="px-6 py-8 text-center text-[#4B5563]"
                    >
                      No departments found matching your search.
                    </td>

                  </tr>
                )}

              {/* DEPARTMENTS */}
              {/* DEPARTMENTS */}

              {!loading &&
                paginatedDepartments.map((department) => (
                  <tr
                    key={department.id}
                    onClick={() => openEdit(department)}
                    className="cursor-pointer transition-colors hover:bg-[#FBF1F1]"
                  >
                    {/* DEPARTMENT */}

                    <td className="px-6 py-4 font-semibold text-[#1F2937]">
                      {department.department_name}
                    </td>

                    {/* KIOSK */}

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Monitor
                          size={14}
                          className="text-[#4B5563]"
                        />

                        <span
                          className={
                            department.kiosk_name === 'Unassigned'
                              ? 'text-[#4B5563]'
                              : 'font-medium text-[#4B5563]'
                          }
                        >
                          {department.kiosk_name}
                        </span>
                      </div>
                    </td>

                    {/* WAITING */}

                    <td className="px-6 py-4 text-center text-[#1F2937]">
                      {department.waiting}
                    </td>

                    {/* CURRENT QUEUE */}

                    <td className="px-6 py-4 text-center font-medium text-[#1F2937]">
                      {department.current_queue}
                    </td>

                    {/* ACTIVE TERMINALS */}

                    <td className="px-6 py-4 text-center text-[#4B5563]">
                      {department.active_terminals}
                    </td>

                    {/* AVG WAIT */}

                    <td className="px-6 py-4 text-center text-[#4B5563]">
                      {department.avg_wait}
                    </td>

                    {/* STATUS */}

                    <td className="px-6 py-4 text-right">
                      <span
                        className={
                          department.status === 'active'
                            ? 'font-medium text-[#1F2937]'
                            : 'font-medium text-[#4B5563]'
                        }
                      >
                        {String(department.status || 'active')
                          .charAt(0)
                          .toUpperCase() +
                          String(department.status || 'active').slice(1)}
                      </span>
                    </td>

                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 text-xs text-[#4B5563]">
          <span>
            {filteredDepartments.length === 0
              ? 'No departments to show'
              : `Showing ${firstIndex + 1} to ${
                  firstIndex + paginatedDepartments.length
                } of ${filteredDepartments.length} departments`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.max(1, p - 1))
              }
              disabled={currentPage === 1}
              className="swu-press rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[#4B5563] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>

            {getPageNumbers(currentPage, totalPages).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                aria-current={
                  number === currentPage ? 'page' : undefined
                }
                className={`rounded-md border px-3 py-1 transition ${
                  number === currentPage
                    ? 'border-[#9D0A0E] bg-[#9D0A0E] font-semibold text-white'
                    : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F1F3F5]'
                }`}
              >
                {number}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              className="swu-press rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[#4B5563] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          DEPARTMENT VOLUME
      ===================================================== */}

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-[#1F2937]">
          Department Volume
        </h2>

        <p className="mt-0.5 text-xs text-[#4B5563]">
          Waiting patients per department
        </p>

        <div className="mt-4">
          <DepartmentVolumeChart departments={departments} />
        </div>
      </div>
        {/* =====================================================
            ADD / EDIT DEPARTMENT MODAL
        ===================================================== */}

        {isModalOpen && (
          <DepartmentModal
            open={isModalOpen}
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onClose={closeModal}
            isEditing={isEditing}
            saving={saving}
            kiosks={kiosks}
          />
        )}

        {/* =====================================================
            RESET DEPARTMENT SELECTION MODAL
        ===================================================== */}

        <ResetDepartmentSelectionModal
          open={showResetSelection}
          onClose={() => {
            setShowResetSelection(false);
            setSelectedResetIds([]);
          }}
          departments={departments.filter(
            (department) =>
              !resetDepartmentIds.includes(
                department.department_id
              )
          )}
          selectedResetIds={selectedResetIds}
          setSelectedResetIds={setSelectedResetIds}
          onContinue={handleResetSelectionContinue}
        />

        {/* =====================================================
            RESET PIN MODAL
        ===================================================== */}

        {showPinSetup && (
          <SecurityPinModal
            mode="setup"
            onClose={() => {
              setShowPinSetup(false);
              setResettingIds([]);
            }}
            onSuccess={() => {
              // PIN created - continue straight to the reset they asked for.
              setShowPinSetup(false);
              handleReset();
            }}
          />
        )}

        <ResetPinModal
          open={showResetPin}
          onClose={() => {
            if (verifyingResetPin) {
              return;
            }

            setShowResetPin(false);
            setResettingIds([]);
            setPinInput('');
          }}
          onConfirm={handleResetPinConfirm}
          pinInput={pinInput}
          setPinInput={setPinInput}
          verifying={verifyingResetPin}
        />

      </div>
    );
}