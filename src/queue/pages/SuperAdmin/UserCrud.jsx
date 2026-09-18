import { useEffect, useMemo, useState } from 'react';

import {
  Search,
  User,
  Users,
  Contact,
  UserCheck,
  Monitor,
  X,
  Lock,
  Check,
} from 'lucide-react';

import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoles,
  getKiosks,
  getDepartments,
} from '../../services/backendApi';


/* =========================================================
   HELPERS
========================================================= */

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}


function normalizeRole(role) {
  if (typeof role === 'object' && role !== null) {
    return String(
      role.role ??
      role.name ??
      ''
    ).trim();
  }

  return String(role ?? '').trim();
}


function normalizeStatus(status) {
  const value = String(status ?? '')
    .trim()
    .toLowerCase();

  if (
    value === 'inactive' ||
    value === 'offline'
  ) {
    return 'Inactive';
  }

  return 'Active';
}


function normalizeId(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  return String(value);
}


/* =========================================================
   DEFAULT FORM
========================================================= */

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  mi: '',
  contact_number: '',
  email: '',

  role: '',
  role_id: null,

  position: null,

  kiosk: 'Select Kiosk',
  kiosk_id: null,

  department: 'Select Department',
  department_id: null,

  status: 'Active',
};


/* =========================================================
   DEFAULT ROLES
========================================================= */

const DEFAULT_ROLE_OPTIONS = [
  'Admin',
  'Staff',
  'Superadmin',
];


/* =========================================================
   POSITION OPTIONS
========================================================= */

const POSITION_OPTIONS = [
  {
    value: 'President',
    label: 'President',
  },
  {
    value: 'Manager',
    label: 'Manager',
  },
  {
    value: 'Vice President',
    label: 'Vice President',
  },
  {
    value: null,
    label: 'Null',
  },
];


/* =========================================================
   STATUS OPTIONS
========================================================= */

const STATUS_OPTIONS = [
  'Active',
  'Inactive',
];


/* =========================================================
   PAGE SIZE
========================================================= */

const PAGE_SIZE = 5;


/* =========================================================
   PAGE NUMBERS
========================================================= */

function getPageNumbers(
  currentPage,
  totalPages
) {
  const MAX_BUTTONS = 5;

  if (totalPages <= MAX_BUTTONS) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  let start = Math.max(
    1,
    currentPage -
      Math.floor(MAX_BUTTONS / 2)
  );

  start = Math.min(
    start,
    totalPages -
      MAX_BUTTONS +
      1
  );

  return Array.from(
    { length: MAX_BUTTONS },
    (_, index) => start + index
  );
}


/* =========================================================
   USER MODAL
========================================================= */

function UserModal({
  form,
  setForm,
  onSave,
  onClose,
  isEditing,
  saving,
  onAddDepartment,
  kioskOptions,
  departmentOptions,
  roleOptions,
  deleteReason,
  setDeleteReason,
  showDeletePrompt,
  setShowDeletePrompt,
  onDeleteUser,
}) {
  const isSuperadmin =
    normalizeRole(form.role).toLowerCase() ===
    'superadmin';


  /* =======================================================
     ROLE CHANGE
     IMPORTANT:
     ROLE ID IS UPDATED TO MATCH THE SELECTED ROLE.
  ======================================================= */

  function handleRoleChange(event) {
    const selectedRoleName =
      event.target.value;

    const selectedRole =
      roleOptions.find(
        (role) =>
          normalizeRole(role.name).toLowerCase() ===
          selectedRoleName.toLowerCase()
      );

    const selectedRoleId =
      selectedRole?.id ?? null;

    const isSelectedSuperadmin =
      selectedRoleName.toLowerCase() ===
      'superadmin';

    /*
     * IMPORTANT:
     * We replace role_id here.
     *
     * We do NOT keep the previous role_id.
     */

    if (isSelectedSuperadmin) {
      setForm({
        ...form,

        role:
          selectedRoleName,

        role_id:
          selectedRoleId,

        kiosk:
          'Whole',

        kiosk_id:
          null,

        department:
          'Whole',

        department_id:
          null,
      });

      return;
    }

    setForm({
      ...form,

      role:
        selectedRoleName,

      role_id:
        selectedRoleId,

      kiosk:
        form.kiosk === 'Whole'
          ? 'Select Kiosk'
          : form.kiosk,

      kiosk_id:
        form.kiosk === 'Whole'
          ? null
          : form.kiosk_id,

      department:
        form.department === 'Whole'
          ? 'Select Department'
          : form.department,

      department_id:
        form.department === 'Whole'
          ? null
          : form.department_id,
    });
  }


  /* =======================================================
     KIOSK CHANGE
  ======================================================= */

  function handleKioskChange(event) {
    const selectedKioskId =
      event.target.value;

    const selectedKiosk =
      kioskOptions.find(
        (kiosk) =>
          String(kiosk.id) ===
          String(selectedKioskId)
      );

    setForm({
      ...form,

      kiosk:
        selectedKiosk?.name ??
        'Select Kiosk',

      kiosk_id:
        selectedKiosk?.id ??
        null,

      department:
        'Select Department',

      department_id:
        null,
    });
  }


  /* =======================================================
     DEPARTMENT CHANGE
  ======================================================= */

  function handleDepartmentChange(event) {
    const selectedDepartmentId =
      event.target.value;

    const selectedDepartment =
      departmentOptions.find(
        (department) =>
          String(department.id) ===
          String(selectedDepartmentId)
      );

    setForm({
      ...form,

      department:
        selectedDepartment?.name ??
        'Select Department',

      department_id:
        selectedDepartment?.id ??
        null,
    });
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">

          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              {isEditing
                ? 'Edit User'
                : 'Add New User'}
            </h2>

            <p className="mt-1 text-xs text-[#4B5563]">
              {isEditing
                ? 'Update user information and account settings.'
                : 'Fields marked * are required.'}
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
            FORM
        =================================================== */}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">

          {/* ----- PERSONAL INFO ----- */}

          <FormSection title="Personal Info">

            <div className="flex items-end gap-3">

              <div className="flex-1">
                <FieldLabel required>First Name</FieldLabel>

                <input
                  type="text"
                  value={form.first_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      first_name:
                        event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                  placeholder="Enter first name"
                />
              </div>

              <div className="w-20 shrink-0">
                <FieldLabel>M.I.</FieldLabel>

                <input
                  type="text"
                  maxLength="2"
                  value={form.mi}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      mi: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                  placeholder="Enter M.I"
                />
              </div>

              <div className="flex-1">
                <FieldLabel required>Last Name</FieldLabel>

                <input
                  type="text"
                  value={form.last_name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      last_name:
                        event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                  placeholder="Enter last name"
                />
              </div>

            </div>

          </FormSection>


          {/* ----- CONTACT ----- */}

          <FormSection title="Contact">

            <div className="grid grid-cols-2 gap-4">

              <div>
                <FieldLabel required>Contact Number</FieldLabel>

                <input
                  type="text"
                  value={form.contact_number}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      contact_number:
                        event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                  placeholder="09XX XXX XXXX"
                />
              </div>

              <div>
                <FieldLabel required>Email Address</FieldLabel>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email:
                        event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                  placeholder="name@gmail.com"
                />
              </div>

            </div>

          </FormSection>


          {/* ----- ASSIGNMENT ----- */}

          <FormSection title="Assignment">

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">

              {/* ROLE */}

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel required>Role</FieldLabel>

                  <span className="text-xs font-semibold text-[#9D0A0E]">
                    + Add role
                  </span>
                </div>

                <select
                  value={form.role}
                  onChange={handleRoleChange}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                >
                  <option value="" disabled>
                    Select role
                  </option>

                  {roleOptions.map((role) => (
                    <option
                      key={
                        role.id ??
                        role.name
                      }
                      value={role.name}
                    >
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>


              {/* POSITION */}

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel required>Position</FieldLabel>
                </div>

                <select
                  value={form.position ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      position:
                        event.target.value === ''
                          ? null
                          : event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
                >
                  {POSITION_OPTIONS.map(
                    (position) => (
                      <option
                        key={position.label}
                        value={
                          position.value ?? ''
                        }
                      >
                        {position.label}
                      </option>
                    )
                  )}
                </select>
              </div>


              {/* KIOSK */}

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel required>Kiosk</FieldLabel>

                  <span
                    className={`text-xs font-semibold ${
                      isSuperadmin
                        ? 'text-[#9CA3AF]'
                        : 'text-[#9D0A0E]'
                    }`}
                  >
                    + Add kiosk
                  </span>
                </div>

                <select
                  value={
                    isSuperadmin
                      ? 'Whole'
                      : form.kiosk_id ??
                        'Select Kiosk'
                  }
                  disabled={isSuperadmin}
                  onChange={handleKioskChange}
                  className={
                    isSuperadmin
                      ? 'w-full cursor-not-allowed rounded-lg border border-[#E5E7EB] bg-[#F1F3F5] px-3 py-2 text-sm text-[#9CA3AF]'
                      : 'w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20'
                  }
                >

                  {isSuperadmin ? (
                    <option value="Whole">
                      Whole
                    </option>
                  ) : (
                    <>
                      <option value="Select Kiosk">
                        Select kiosk
                      </option>

                      {kioskOptions.map(
                        (kiosk) => (
                          <option
                            key={kiosk.id}
                            value={kiosk.id}
                          >
                            {kiosk.name}
                          </option>
                        )
                      )}
                    </>
                  )}

                </select>

                {isSuperadmin && (
                  <p className="mt-1.5 text-xs text-[#4B5563]">
                    Superadmin oversees all kiosks.
                  </p>
                )}
              </div>


              {/* DEPARTMENT */}

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel required>Department</FieldLabel>

                  <button
                    type="button"
                    onClick={onAddDepartment}
                    disabled={isSuperadmin}
                    className="text-xs font-semibold text-[#9D0A0E] transition hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline"
                  >
                    + Add department
                  </button>
                </div>

                <div className="relative">
                  <select
                    value={
                      isSuperadmin
                        ? 'Whole'
                        : form.department_id ??
                          'Select Department'
                    }
                    disabled={
                      isSuperadmin ||
                      !form.kiosk_id
                    }
                    onChange={handleDepartmentChange}
                    className={
                      isSuperadmin ||
                      !form.kiosk_id
                        ? 'w-full cursor-not-allowed rounded-lg border border-[#E5E7EB] bg-[#F1F3F5] px-3 py-2 text-sm text-[#9CA3AF] pr-9'
                        : 'w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20'
                    }
                  >

                    {isSuperadmin ? (
                      <option value="Whole">
                        Whole
                      </option>
                    ) : (
                      <>
                        <option value="Select Department">
                          {form.kiosk_id
                            ? 'Select Department'
                            : 'Select a kiosk first'}
                        </option>

                        {departmentOptions.map(
                          (department) => (
                            <option
                              key={department.id}
                              value={department.id}
                            >
                              {department.name}
                            </option>
                          )
                        )}
                      </>
                    )}

                  </select>

                  {!isSuperadmin &&
                    !form.kiosk_id && (
                      <Lock
                        size={14}
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                      />
                    )}
                </div>

                {isSuperadmin && (
                  <p className="mt-1.5 text-xs text-[#4B5563]">
                    Superadmin oversees all departments.
                  </p>
                )}
              </div>

            </div>


            {/* STATUS */}

            <div className="mt-3">
              <FieldLabel>Status</FieldLabel>

              <div className="inline-flex rounded-lg border border-[#E5E7EB] p-1">
                {STATUS_OPTIONS.map((status) => {
                  const isSelected =
                    form.status === status;

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          status: status,
                        })
                      }
                      aria-pressed={isSelected}
                      className={`flex items-center gap-1.5 rounded-md px-4 py-1 text-sm font-medium transition ${
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

          </FormSection>


        </div>


        {/* ===================================================
            FOOTER
        =================================================== */}

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-6 py-3">

          <div>
            {isEditing && (
              <button
                type="button"
                onClick={() =>
                  setShowDeletePrompt(true)
                }
                className="rounded-lg border border-[#F0DADA] bg-white px-4 py-2 text-sm font-semibold text-[#9D0A0E] transition hover:bg-[#FBF1F1]"
              >
                Delete User
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">

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
                !form.first_name.trim() ||
                !form.last_name.trim() ||
                !form.email.trim()  }
              className="rounded-lg bg-[#9D0A0E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : 'Add User'}
            </button>

          </div>

        </div>

      </div>


      {/* ===================================================
          DELETE USER DIALOG
      =================================================== */}

      {isEditing && showDeletePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4">

          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="relative px-8 pb-6 pt-8 text-center">

              <button
                type="button"
                onClick={() => {
                  setShowDeletePrompt(false);
                  setDeleteReason('');
                }}
                className="absolute right-5 top-5 rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
                aria-label="Close"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-bold text-[#1F2937]">
                Delete User
              </h2>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#4B5563]">
                This action will remove this user&rsquo;s account from the system.
                Please provide a reason before continuing.
              </p>

            </div>


            <div className="px-8 pb-6 text-left">

              <label
                htmlFor="delete-reason"
                className="mb-2 block text-sm font-semibold text-[#1F2937]"
              >
                Reason for Deletion
                <span className="ml-0.5 text-[#9D0A0E]">*</span>
              </label>

              <textarea
                id="delete-reason"
                value={deleteReason}
                onChange={(event) =>
                  setDeleteReason(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Enter reason for deletion"
                className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
              />

            </div>


            <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-8 py-4">

              <button
                type="button"
                onClick={() => {
                  setShowDeletePrompt(false);
                  setDeleteReason('');
                }}
                disabled={saving}
                className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-sm font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteUser}
                disabled={
                  saving ||
                  !deleteReason.trim()
                }
                className="rounded-lg bg-[#9D0A0E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? 'Deleting...'
                  : 'Delete User'}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


/* =========================================================
   MODAL SUB-COMPONENTS
========================================================= */

function FormSection({ title, children }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
          {title}
        </span>

        <span
          aria-hidden="true"
          className="h-px flex-1 bg-[#E5E7EB]"
        />
      </div>

      {children}
    </div>
  );
}


function FieldLabel({ children, required }) {
  return (
    <label className="mb-1 block text-sm font-semibold text-[#1F2937]">
      {children}

      {required && (
        <span className="ml-0.5 text-[#9D0A0E]">*</span>
      )}
    </label>
  );
}


/* =========================================================
   MAIN USER CRUD
========================================================= */

export default function UserCrud({
  onAddDepartment,
}) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [
    duplicatePopup,
    setDuplicatePopup,
  ] = useState(false);

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);

  const [deleteReason, setDeleteReason] = useState('');
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
  });


  /* =======================================================
     FETCH ROLES
     NODE.JS → MYSQL / FIREBASE
  ======================================================= */

  async function fetchRoles() {
    const response =
      await getRoles();

    const roleRows =
      response?.data ??
      response ??
      [];

    const formattedRoles =
      (Array.isArray(roleRows)
        ? roleRows
        : []
      )
        .map((role) => ({
          id:
            role.role_id ??
            role.id,

          name:
            role.role ??
            role.name ??
            '',
        }))
        .filter(
          (role) =>
            role.name
        );

    formattedRoles.sort(
      (a, b) =>
        a.name.localeCompare(
          b.name
        )
    );

    if (
      formattedRoles.length === 0
    ) {
      return DEFAULT_ROLE_OPTIONS.map(
        (role) => ({
          id: null,
          name: role,
        })
      );
    }

    return formattedRoles;
  }


  /* =======================================================
     FETCH KIOSKS
     NODE.JS → MYSQL / FIREBASE
  ======================================================= */

  async function fetchKiosks() {
    const response =
      await getKiosks();

    const kioskRows =
      response?.data ??
      response ??
      [];

    return (
      Array.isArray(kioskRows)
        ? kioskRows
        : []
    )
      .map((kiosk) => ({
        id:
          kiosk.kiosk_id ??
          kiosk.id,

        name:
          kiosk.name ??
          kiosk.kiosk ??
          '',

        status:
          kiosk.status ??
          'Active',
      }))
      .filter(
        (kiosk) =>
          kiosk.name &&
          String(
            kiosk.status
          ).toLowerCase() !==
            'inactive'
      )
      .sort((a, b) =>
        a.name.localeCompare(
          b.name
        )
      );
  }


  /* =======================================================
     FETCH DEPARTMENTS
     NODE.JS → MYSQL / FIREBASE
  ======================================================= */

  async function fetchDepartments() {
    const response =
      await getDepartments();

    const departmentRows =
      response?.data ??
      response ??
      [];

    return (
      Array.isArray(
        departmentRows
      )
        ? departmentRows
        : []
    )
      .map((department) => ({
        id:
          department.department_id ??
          department.id,

        name:
          department.name ??
          department.department_name ??
          '',

        kiosk_id:
          normalizeId(
            department.kiosk_id
          ),

        kiosk:
          department.kiosk ??
          department.kiosk_name ??
          null,

        status:
          department.status ??
          'Active',
      }))
      .filter(
        (department) =>
          department.name &&
          String(
            department.status
          ).toLowerCase() !==
            'inactive'
      )
      .sort((a, b) =>
        a.name.localeCompare(
          b.name
        )
      );
  }


  /* =======================================================
     FETCH USERS
     NODE.JS → MYSQL / FIREBASE
  ======================================================= */

  async function fetchUsers() {
    setLoading(true);
    setError(null);

    try {
      const userRows =
        await getUsers();

      const rows =
        userRows?.data ??
        userRows ??
        [];

      const formattedUsers =
        (
          Array.isArray(rows)
            ? rows
            : []
        ).map(
          (data) => {
            /*
             * Firebase normally gives us role + role_id.
             *
             * MySQL may give us role_id.
             *
             * Therefore first try the role name,
             * then derive the role name from the loaded
             * roles array.
             */

            const roleFromData =
              normalizeRole(
                data.role
              );

            const matchingRole =
              roles.find(
                (role) =>
                  normalizeId(
                    role.id
                  ) ===
                  normalizeId(
                    data.role_id
                  )
              );

            const roleName =
              roleFromData ||
              normalizeRole(
                matchingRole?.name
              );

            return {
              id:
                data.user_id,

              user_id:
                data.user_id,

              first_name:
                data.first_name ??
                '',

              last_name:
                data.last_name ??
                '',

              mi:
                data.mi ??
                '',

              email:
                data.email ??
                '',

              contact_number:
                data.contact_number ??
                data.contact_info ??
                '',

              kiosk:
                data.kiosk ??
                'Whole',

              kiosk_id:
                normalizeId(
                  data.kiosk_id
                ),

              position:
                data.position ??
                null,

              department:
                data.department ??
                'Whole',

              department_id:
                normalizeId(
                  data.department_id
                ),

              status:
                normalizeStatus(
                  data.status
                ),

              role:
                roleName ||
                'Staff',

              role_id:
                normalizeId(
                  data.role_id
                ),

              created_at:
                data.created_at ??
                null,

              updated_at:
                data.updated_at ??
                null,
            };
          }
        );

      setUsers(
        formattedUsers
      );

    } catch (err) {
      console.error(
        'FETCH USERS ERROR:',
        err
      );

      setError(
        err?.message ||
        'Unable to retrieve users.'
      );

    } finally {
      setLoading(false);
    }
  }


  /* =======================================================
     LOAD ALL DATA
  ======================================================= */

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [
        roleData,
        kioskData,
        departmentData,
      ] = await Promise.all([
        fetchRoles(),
        fetchKiosks(),
        fetchDepartments(),
      ]);

      setRoles(roleData);
      setKiosks(kioskData);
      setDepartments(
        departmentData
      );

      /*
       * Pass roleData directly through the user formatting
       * logic instead of relying on the asynchronous
       * React state update.
       */

      const userRows =
        await getUsers();

      const rows =
        userRows?.data ??
        userRows ??
        [];

      const formattedUsers =
        (
          Array.isArray(rows)
            ? rows
            : []
        ).map(
          (data) => {
            const roleFromData =
              normalizeRole(
                data.role
              );

            const matchingRole =
              roleData.find(
                (role) =>
                  normalizeId(
                    role.id
                  ) ===
                  normalizeId(
                    data.role_id
                  )
              );

            const roleName =
              roleFromData ||
              normalizeRole(
                matchingRole?.name
              );

            return {
              id:
                data.user_id,

              user_id:
                data.user_id,

              first_name:
                data.first_name ??
                '',

              last_name:
                data.last_name ??
                '',

              mi:
                data.mi ??
                '',

              email:
                data.email ??
                '',

              contact_number:
                data.contact_number ??
                data.contact_info ??
                '',

              kiosk:
                data.kiosk ??
                'Whole',

              kiosk_id:
                normalizeId(
                  data.kiosk_id
                ),

              position:
                data.position ??
                null,

              department:
                data.department ??
                'Whole',

              department_id:
                normalizeId(
                  data.department_id
                ),

              status:
                normalizeStatus(
                  data.status
                ),

              role:
                roleName ||
                'Staff',

              role_id:
                normalizeId(
                  data.role_id
                ),

              created_at:
                data.created_at ??
                null,

              updated_at:
                data.updated_at ??
                null,
            };
          }
        );

      setUsers(
        formattedUsers
      );

    } catch (err) {
      console.error(
        'LOAD USER MANAGEMENT DATA ERROR:',
        err
      );

      setError(
        err?.message ||
        'Unable to load user management data.'
      );

    } finally {
      setLoading(false);
    }
  }


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadData();
  }, []);


  /* =======================================================
     DEPARTMENTS FOR SELECTED KIOSK
  ======================================================= */

  const availableDepartments =
    useMemo(() => {
      if (!form.kiosk_id) {
        return [];
      }

      return departments.filter(
        (department) =>
          String(
            department.kiosk_id
          ) ===
          String(
            form.kiosk_id
          )
      );
    }, [
      departments,
      form.kiosk_id,
    ]);


  /* =======================================================
     OPEN ADD
  ======================================================= */

  function openAdd() {
    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);

    setForm({
      ...EMPTY_FORM,
    });

    setDeleteReason('');
    setShowDeletePrompt(false);

    setEditingId('new');
  }


  /* =======================================================
     OPEN EDIT
     IMPORTANT:
     ROLE ID IS RESOLVED FROM THE ACTUAL ROLE.
  ======================================================= */

  function openEdit(user) {
    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);

    /*
     * First try to resolve the role by role_id.
     */

    let selectedRole =
      roles.find(
        (role) =>
          normalizeId(
            role.id
          ) ===
          normalizeId(
            user.role_id
          )
      );

    /*
     * If role_id is missing or stale,
     * fall back to the role name.
     */

    if (!selectedRole) {
      selectedRole =
        roles.find(
          (role) =>
            normalizeRole(
              role.name
            ).toLowerCase() ===
            normalizeRole(
              user.role
            ).toLowerCase()
        );
    }

    const roleName =
      selectedRole?.name ||
      normalizeRole(
        user.role
      ) ||
      'Staff';

    const roleId =
      selectedRole?.id ??
      normalizeId(
        user.role_id
      );

    const isSuperadmin =
      roleName.toLowerCase() ===
      'superadmin';

    setForm({
      first_name:
        user.first_name ?? '',

      last_name:
        user.last_name ?? '',

      mi:
        user.mi ?? '',

      contact_number:
        user.contact_number ?? '',

      email:
        user.email ?? '',

      role:
        roleName,

      /*
       * IMPORTANT:
       * Store the role ID that actually belongs
       * to the selected role.
       */
      role_id:
        roleId,

      position:
        user.position ?? null,

      kiosk:
        isSuperadmin
          ? 'Whole'
          : user.kiosk ??
            'Select Kiosk',

      kiosk_id:
        isSuperadmin
          ? null
          : normalizeId(
              user.kiosk_id
            ),

      department:
        isSuperadmin
          ? 'Whole'
          : user.department ??
            'Select Department',

      department_id:
        isSuperadmin
          ? null
          : normalizeId(
              user.department_id
            ),

      status:
        normalizeStatus(
          user.status
        ),

    });

    setDeleteReason('');
    setShowDeletePrompt(false);

    setEditingId(
      user.user_id ||
      user.id
    );
  }


  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    setEditingId(null);

    setDeleteReason('');
    setShowDeletePrompt(false);

    setForm({
      ...EMPTY_FORM,
    });

    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);
  }


  /* =======================================================
     VALIDATE DEPARTMENT
  ======================================================= */

  function validateDepartment() {
    if (
      normalizeRole(
        form.role
      ).toLowerCase() ===
      'superadmin'
    ) {
      return true;
    }

    if (!form.kiosk_id) {
      setError(
        'Please select a kiosk.'
      );

      return false;
    }

    if (!form.department_id) {
      setError(
        'Please select a department.'
      );

      return false;
    }

    const selectedDepartment =
      departments.find(
        (department) =>
          String(
            department.id
          ) ===
          String(
            form.department_id
          )
      );

    if (!selectedDepartment) {
      setError(
        'The selected department could not be found.'
      );

      return false;
    }

    if (
      String(
        selectedDepartment.kiosk_id
      ) !==
      String(
        form.kiosk_id
      )
    ) {
      setError(
        'Please select a department that belongs to the selected kiosk.'
      );

      return false;
    }

    return true;
  }


  /* =======================================================
     DELETE USER
     NODE.JS → MYSQL / FIREBASE
  ======================================================= */

  async function handleDeleteUser() {
    if (
      !editingId ||
      editingId === 'new'
    ) {
      return;
    }

    const trimmedReason =
      deleteReason.trim();

    if (!trimmedReason) {
      setError(
        'Please enter a reason before deleting this user.'
      );

      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await deleteUser(
        editingId,
        trimmedReason,
        'superadmin'
      );

      setUsers((currentUsers) =>
        currentUsers.filter(
          (user) =>
            String(
              user.user_id ??
              user.id
            ) !==
            String(editingId)
        )
      );

      setDeleteReason('');
      setShowDeletePrompt(false);
      setEditingId(null);

      setForm({
        ...EMPTY_FORM,
      });

      setSuccess(
        'User deleted successfully.'
      );

    } catch (err) {
      console.error(
        'DELETE USER ERROR:',
        err
      );

      setError(
        err?.message ||
        'Unable to delete this user.'
      );

    } finally {
      setSaving(false);
    }
  }


  /* =======================================================
     SAVE USER
========================================================= */

  async function handleSave() {
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.email.trim()
    ) {
      setError(
        'First name, last name, and email are required.'
      );

      return;
    }

    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);


    /* =====================================================
       DEPARTMENT VALIDATION
    ===================================================== */

    if (!validateDepartment()) {
      return;
    }


    const normalizedEmail =
      normalizeEmail(
        form.email
      );

    setSaving(true);


    try {

      /* ===================================================
         ROLE RESOLUTION
         IMPORTANT:
         NEVER use the existing form.role_id as the
         primary source here.
      =================================================== */

      const selectedRole =
        roles.find(
          (role) =>
            normalizeRole(
              role.name
            ).toLowerCase() ===
            normalizeRole(
              form.role
            ).toLowerCase()
        );

      if (!selectedRole) {
        throw new Error(
          'Unable to find the selected role.'
        );
      }

      const selectedRoleId =
        normalizeId(
          selectedRole.id
        );

      if (!selectedRoleId) {
        throw new Error(
          'The selected role does not have a valid role ID.'
        );
      }

      /*
       * THIS IS THE IMPORTANT FIX.
       *
       * The selected role determines the role_id.
       *
       * We intentionally DO NOT do:
       *
       * form.role_id || selectedRole.id
       *
       * because form.role_id may contain the OLD role.
       */

      const roleId =
        selectedRoleId;

      const roleName =
        selectedRole.name;


      /* ===================================================
         SUPERADMIN
      =================================================== */

      const isSuperadmin =
        roleName.toLowerCase() ===
        'superadmin';

      const finalKiosk =
        isSuperadmin
          ? 'Whole'
          : form.kiosk;

      const finalKioskId =
        isSuperadmin
          ? null
          : form.kiosk_id;

      const finalDepartment =
        isSuperadmin
          ? 'Whole'
          : form.department;

      const finalDepartmentId =
        isSuperadmin
          ? null
          : form.department_id;


      /* ===================================================
         USER PROFILE
      =================================================== */

      const profile = {
        first_name:
          form.first_name.trim(),

        last_name:
          form.last_name.trim(),

        mi:
          form.mi.trim() ||
          null,

        contact_number:
          form.contact_number.trim() ||
          null,

        email:
          normalizedEmail,

        /*
         * Role name and role ID now come from
         * the SAME selected role record.
         */
        role:
          roleName,

        role_id:
          roleId,

        position:
          form.position,

        kiosk:
          finalKiosk,

        kiosk_id:
          finalKioskId,

        department:
          finalDepartment,

        department_id:
          finalDepartmentId,

        status:
          form.status,
      };


      /* ===================================================
         DEBUG
         This lets you verify the exact values being sent.
      =================================================== */

      console.log(
        'USER SAVE ROLE:',
        {
          selectedRole: roleName,
          selectedRoleId: roleId,
          previousFormRoleId:
            form.role_id,
        }
      );


      /* ===================================================
         CREATE USER
         REACT → NODE → MYSQL / FIREBASE
      =================================================== */

      if (editingId === 'new') {

        await createUser(
          profile
        );


        setSuccess(
          'User added successfully.'
        );
      }


      /* ===================================================
         UPDATE USER
         REACT → NODE → MYSQL / FIREBASE
      =================================================== */

      else {

        await updateUser(
          editingId,
          profile
        );


        setSuccess(
          'User updated successfully.'
        );
      }


      /* ===================================================
         CLEAN UP
      =================================================== */

      setEditingId(null);

      setForm({
        ...EMPTY_FORM,
      });

      setDeleteReason('');
      setShowDeletePrompt(false);

      /*
       * Refresh users through Node.
       */
      await fetchUsers();

    } catch (err) {

      console.error(
        'SAVE USER ERROR:',
        err
      );

      const errorMessage =
        err?.message ||
        'Unable to save user.';

      const normalizedError =
        String(
          errorMessage
        ).toLowerCase();

      if (
        normalizedError.includes(
          'already exists'
        ) ||
        normalizedError.includes(
          'already registered'
        ) ||
        normalizedError.includes(
          'already-exists'
        ) ||
        normalizedError.includes(
          'email-already-in-use'
        ) ||
        normalizedError.includes(
          'email already'
        ) ||
        normalizedError.includes(
          'duplicate'
        )
      ) {

        setDuplicatePopup(true);

        setError(
          'This email is already registered. Please use a different email address.'
        );

      } else {

        setError(
          errorMessage
        );
      }

    } finally {
      setSaving(false);
    }
  }


  /* =========================================================
     SUMMARY
  ========================================================= */

  const normalizedRoles =
    users.map(
      (user) =>
        normalizeRole(
          user.role
        )
          .toLowerCase()
          .replace(
            /[\s\-_]+/g,
            ''
          )
    );

  const superAdminCount =
    normalizedRoles.filter(
      (role) =>
        role === 'superadmin'
    ).length;

  const deptAdminCount =
    normalizedRoles.filter(
      (role) =>
        role === 'admin' ||
        role === 'deptadmin' ||
        role === 'departmentadmin'
    ).length;

  const staffCount =
    normalizedRoles.filter(
      (role) =>
        role === 'staff'
    ).length;

  const activeCount =
    users.filter(
      (user) =>
        user.status === 'Active'
    ).length;


  /* =========================================================
     SEARCH
  ========================================================= */

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);


  const filteredUsers =
    users.filter((user) => {
      const fullName =
        `${user.first_name} ${user.last_name}`
          .toLowerCase();

      const queryText =
        searchQuery
          .trim()
          .toLowerCase();

      return (
        fullName.includes(
          queryText
        ) ||
        user.email
          ?.toLowerCase()
          .includes(
            queryText
          ) ||
        user.contact_number
          ?.toLowerCase()
          .includes(
            queryText
          ) ||
        user.department
          ?.toLowerCase()
          .includes(
            queryText
          ) ||
        user.kiosk
          ?.toLowerCase()
          .includes(
            queryText
          ) ||
        normalizeRole(
          user.role
        )
          .toLowerCase()
          .includes(
            queryText
          ) ||
        user.position
          ?.toLowerCase()
          .includes(
            queryText
          )
      );
    });


  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredUsers.length /
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

  const paginatedUsers =
    filteredUsers.slice(
      firstIndex,
      firstIndex +
        PAGE_SIZE
    );


  /* =========================================================
     MODAL
  ========================================================= */

  const isModalOpen =
    editingId !== null;

  const isEditing =
    isModalOpen &&
    editingId !== 'new';


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold text-[#1F2937]">
            User Management
          </h1>

          <p className="mt-0.5 text-xs text-[#4B5563]">
            Manage system users, roles, and department assignments.
          </p>

        </div>


        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#7D080B]"
        >
          <span className="text-sm leading-none">
            +
          </span>

          Add User
        </button>

      </div>


      {/* ERROR */}

      {error && (
        <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-sm text-[#9D0A0E]">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

        <SummaryCard
          title="SUPER ADMIN"
          count={superAdminCount}
          subtitle="TOTAL SUPER ADMIN"
          icon={<User size={18} />}
        />

        <SummaryCard
          title="DEPT ADMIN"
          count={deptAdminCount}
          subtitle="TOTAL DEPT ADMIN"
          icon={<Users size={18} />}
        />

        <SummaryCard
          title="STAFF"
          count={staffCount}
          subtitle="TOTAL STAFF"
          icon={<Contact size={18} />}
        />

        <SummaryCard
          title="ACTIVE"
          count={activeCount}
          subtitle="ADMIN/STAFF ON DUTY"
          icon={<UserCheck size={18} />}
        />

        <SummaryCard
          title="TERMINAL"
          count={42}
          subtitle="ACTIVE TERMINAL"
          icon={<Monitor size={18} />}
        />

      </div>


      {/* USERS */}

      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">

          <h2 className="text-base font-bold text-[#1F2937]">
            Users
          </h2>


          <div className="relative w-80">

            <input
              type="text"
              placeholder="Search user"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
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


        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs">

            <thead>

              <tr className="border-b border-[#E5E7EB] bg-[#FBF1F1] text-xs font-semibold uppercase tracking-wider text-[#4B5563]">

                <th className="px-6 py-3.5">
                  FULL NAME
                </th>

                <th className="px-6 py-3.5">
                  EMAIL
                </th>

                <th className="px-6 py-3.5">
                  DEPARTMENT
                </th>

                <th className="px-6 py-3.5">
                  ROLE
                </th>

                <th className="px-6 py-3.5">
                  STATUS
                </th>

              </tr>

            </thead>


            <tbody className="divide-y divide-[#F1F3F5] text-[#4B5563]">

              {loading && (
                <tr>

                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-[#4B5563]"
                  >
                    Loading users...
                  </td>

                </tr>
              )}


              {!loading &&
                filteredUsers.length === 0 && (
                  <tr>

                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-[#4B5563]"
                    >
                      No users found matching your criteria.
                    </td>

                  </tr>
                )}


              {!loading &&
                paginatedUsers.map(
                  (user) => (
                    <tr
                      key={user.user_id}
                      onClick={() =>
                        openEdit(user)
                      }
                      className="cursor-pointer transition-colors hover:bg-[#F8F9FA]"
                    >

                      <td className="px-6 py-4 font-semibold text-[#1F2937]">
                        {user.first_name}{' '}
                        {user.last_name}
                      </td>

                      <td className="px-6 py-4 text-[#4B5563]">
                        {user.email}
                      </td>

                      <td className="px-6 py-4 text-[#4B5563]">
                        {user.department ||
                          'Whole'}
                      </td>

                      <td className="px-6 py-4 capitalize text-[#4B5563]">
                        {normalizeRole(
                          user.role
                        )}
                      </td>

                      <td className="px-6 py-4">

                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                            user.status ===
                            'Active'
                              ? 'text-emerald-600'
                              : 'text-[#4B5563]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.status ===
                              'Active'
                                ? 'bg-emerald-500'
                                : 'bg-[#9CA3AF]'
                            }`}
                          />

                          {user.status}
                        </span>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>


        {/* PAGINATION */}

        <div className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4 text-xs text-[#4B5563]">

          <span>
            {filteredUsers.length === 0
              ? 'No users to show'
              : `Showing ${
                  firstIndex + 1
                } to ${
                  firstIndex +
                  paginatedUsers.length
                } of ${
                  filteredUsers.length
                } users`}
          </span>


          <div className="flex items-center gap-1.5">

            <button
              type="button"
              onClick={() =>
                setPage(
                  (value) =>
                    Math.max(
                      1,
                      value - 1
                    )
                )
              }
              disabled={
                currentPage === 1
              }
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>


            {getPageNumbers(
              currentPage,
              totalPages
            ).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() =>
                  setPage(number)
                }
                aria-current={
                  number ===
                  currentPage
                    ? 'page'
                    : undefined
                }
                className={`rounded-md border px-3 py-1 transition ${
                  number ===
                  currentPage
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
                setPage(
                  (value) =>
                    Math.min(
                      totalPages,
                      value + 1
                    )
                )
              }
              disabled={
                currentPage ===
                totalPages
              }
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>

          </div>

        </div>

      </div>


      {/* DUPLICATE POPUP */}

      {duplicatePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4">

          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">

              <span className="text-xl font-bold">
                !
              </span>

            </div>


            <h3 className="mt-4 text-lg font-bold text-[#1F2937]">
              Duplicate User
            </h3>


            <p className="mt-2 text-sm leading-6 text-[#4B5563]">
              This email address is already registered. Please use a different email address.
            </p>


            <button
              type="button"
              onClick={() =>
                setDuplicatePopup(false)
              }
              className="mt-5 w-full rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7D080B]"
            >
              OK
            </button>

          </div>

        </div>
      )}


      {/* USER MODAL */}

      {isModalOpen && (
        <UserModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={closeModal}
          isEditing={isEditing}
          saving={saving}
          onAddDepartment={
            onAddDepartment
          }
          kioskOptions={kiosks}
          departmentOptions={
            availableDepartments
          }
          roleOptions={roles}
          deleteReason={deleteReason}
          setDeleteReason={setDeleteReason}
          showDeletePrompt={showDeletePrompt}
          setShowDeletePrompt={setShowDeletePrompt}
          onDeleteUser={handleDeleteUser}
        />
      )}

    </div>
  );
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  count,
  subtitle,
  icon,
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">

      <div className="flex items-center justify-between">

        <span className="text-xs font-bold uppercase tracking-wider text-[#4B5563]">
          {title}
        </span>

        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
          {icon}
        </span>

      </div>


      <div className="mt-3">

        <p className="text-2xl font-bold text-[#1F2937]">
          {count}
        </p>

        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
          {subtitle}
        </p>

      </div>

    </div>
  );
}