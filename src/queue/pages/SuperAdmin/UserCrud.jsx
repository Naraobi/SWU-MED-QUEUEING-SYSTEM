import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase';
import {
  Search,
  User,
  Users,
  Contact,
  UserCheck,
  Monitor,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  Circle,
} from 'lucide-react';

const TABLE_NAME = 'user';

/* =========================================================
   HELPERS
========================================================= */

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function getRoleName(role) {
  if (typeof role === 'string') {
    return role;
  }

  const roleRow = Array.isArray(role) ? role[0] : role;

  return roleRow?.role ?? roleRow?.name ?? '';
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
  role: 'Staff',
  position: null,
  kiosk: 'Select Kiosk',
  department: 'Select Department',
  status: 'Active',
  password: '',
  confirmPassword: '',
};

/* =========================================================
   OPTIONS
========================================================= */

const ROLE_OPTIONS = [
  'Admin',
  'Staff',
  'Superadmin',
];

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

const STATUS_OPTIONS = [
  'Active',
  'Inactive',
];

const PAGE_SIZE = 5;

const KIOSK_OPTIONS = [
  'Main Lobby',
  'Out patients',
  'Laboratory and Radiology',
  'Medical Arts Building',
];

/* =========================================================
   DEPARTMENTS BY KIOSK
========================================================= */

const DEPARTMENTS_BY_KIOSK = {
  'Main Lobby': [
    'Information',
    'Admission',
    'CHAMP',
    'Cashier',
    'Billing',
    'Credit and Collection',
    'Medical Social worker',
    'Phil Health',
  ],

  'Out patients': [
    'Pedia',
    'Surgery',
    'Internal Medicine',
    'FAMED',
  ],

  'Laboratory and Radiology': [
    'Lab-Specimen Collection',
    'LAB- Results',
    'Rad-Results',
    'CT-Scan',
    'X-Ray',
  ],

  'Medical Arts Building': [
    'Pharmacy',
    "Women's Health (Consultation)",
    "Women's Health (Ultrasound)",
    'PT- Rehab (Consultation)',
    'PT-Rehab(Session)',
    'Cardiac',
  ],
};

/* =========================================================
   PAGE NUMBERS
========================================================= */

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
  onDelete,
  deleting,
}) {
  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const isSuperadmin =
    form.role?.toLowerCase() === 'superadmin';

  /*
    Reset password visibility when switching
    between Add and Edit.
  */
  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [isEditing]);

  /* =======================================================
     PASSWORD REQUIREMENTS
  ======================================================= */

  const passwordChecks = [
    {
      label: '8 characters minimum',
      passed: form.password.length >= 8,
    },
    {
      label: 'a number',
      passed: /\d/.test(form.password),
    },
    {
      label: 'a symbol',
      passed: /[^A-Za-z0-9]/.test(form.password),
    },
  ];

  const passedPasswordChecks =
    passwordChecks.filter(
      (check) => check.passed
    ).length;

  const passwordValid =
    passedPasswordChecks ===
    passwordChecks.length;

  const confirmPasswordValid =
    form.password.length > 0 &&
    form.confirmPassword.length > 0 &&
    form.password === form.confirmPassword;

  const passwordBarColor =
    passedPasswordChecks <= 1
      ? 'bg-red-500'
      : passedPasswordChecks === 2
        ? 'bg-amber-400'
        : 'bg-green-500';

  const passwordBarWidth =
    form.password.length === 0
      ? '0%'
      : `${
          (passedPasswordChecks /
            passwordChecks.length) *
          100
        }%`;

  /* =======================================================
     DEPARTMENTS
  ======================================================= */

  const availableDepartments =
    DEPARTMENTS_BY_KIOSK[form.kiosk] || [];

  /* =======================================================
     ROLE CHANGE
  ======================================================= */

  function handleRoleChange(e) {
    const selectedRole = e.target.value;

    if (selectedRole === 'Superadmin') {
      setForm({
        ...form,
        role: selectedRole,
        kiosk: 'Whole',
        department: 'Whole',
      });
    } else {
      setForm({
        ...form,
        role: selectedRole,
        kiosk:
          form.kiosk === 'Whole'
            ? 'Select Kiosk'
            : form.kiosk,
        department:
          form.department === 'Whole'
            ? 'Select Department'
            : form.department,
      });
    }
  }

  /* =======================================================
     KIOSK CHANGE
  ======================================================= */

  function handleKioskChange(e) {
    const selectedKiosk = e.target.value;

    setForm({
      ...form,
      kiosk: selectedKiosk,
      department: 'Select Department',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">

          <h2 className="text-lg font-bold text-slate-700">
            {isEditing
              ? 'Edit User'
              : 'Add New User'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="font-bold text-slate-400 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            ✕
          </button>

        </div>

        {/* =================================================
            FORM BODY
        ================================================= */}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* FIRST NAME / LAST NAME */}

          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                First Name
              </label>

              <input
                type="text"
                value={form.first_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    first_name:
                      e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Last Name
              </label>

              <input
                type="text"
                value={form.last_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    last_name:
                      e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter last name"
              />
            </div>

          </div>

          {/* MI / CONTACT */}

          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                M.I.
              </label>

              <input
                type="text"
                maxLength="2"
                value={form.mi}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mi: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter M.I."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Contact Number
              </label>

              <input
                type="text"
                value={form.contact_number}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contact_number:
                      e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter number"
              />
            </div>

          </div>

          {/* EMAIL */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Email Address
            </label>

            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              placeholder="Enter email"
            />
          </div>

          {/* =================================================
              ROLE / POSITION
          ================================================= */}

          <div className="grid grid-cols-2 gap-4">

            {/* ROLE */}

            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">

                <span>Select Role</span>

                <Plus size={12} />

              </label>

              <select
                value={form.role}
                onChange={handleRoleChange}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option
                    key={role}
                    value={role}
                  >
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {/* POSITION */}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Select Position
              </label>

              <select
                value={form.position ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    position:
                      e.target.value === ''
                        ? null
                        : e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
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

          </div>

          {/* =================================================
              KIOSK
          ================================================= */}

          <div>

            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">

              <span>
                Select Kiosk
              </span>

              <button
                type="button"
                disabled={isSuperadmin}
                className="flex items-center justify-center text-slate-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300"
                title="Add kiosk"
              >
                <Plus size={12} />
              </button>

            </label>

            <select
              value={form.kiosk}
              disabled={isSuperadmin}
              onChange={handleKioskChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                isSuperadmin
                  ? 'cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500'
                  : 'border-slate-300 bg-slate-50 text-slate-700 focus:border-blue-500 focus:bg-white'
              }`}
            >

              {isSuperadmin ? (
                <option value="Whole">
                  Whole
                </option>
              ) : (
                <>
                  <option value="Select Kiosk">
                    Select Kiosk
                  </option>

                  {KIOSK_OPTIONS.map(
                    (kiosk) => (
                      <option
                        key={kiosk}
                        value={kiosk}
                      >
                        {kiosk}
                      </option>
                    )
                  )}
                </>
              )}

            </select>

            {isSuperadmin && (
              <p className="mt-1 text-[10px] text-slate-400">
                Superadmin oversees all
                kiosks.
              </p>
            )}

          </div>

          {/* =================================================
              DEPARTMENT
          ================================================= */}

          <div>

            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">

              <span>
                Select Department
              </span>

              <button
                type="button"
                onClick={onAddDepartment}
                disabled={isSuperadmin}
                className="flex items-center justify-center text-slate-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-slate-300"
                title="Add department"
              >
                <Plus size={12} />
              </button>

            </label>

            <select
              value={form.department}
              disabled={
                isSuperadmin ||
                form.kiosk ===
                  'Select Kiosk'
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  department:
                    e.target.value,
                })
              }
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                isSuperadmin ||
                form.kiosk ===
                  'Select Kiosk'
                  ? 'cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500'
                  : 'border-slate-300 bg-slate-50 text-slate-700 focus:border-blue-500 focus:bg-white'
              }`}
            >

              {isSuperadmin ? (
                <option value="Whole">
                  Whole
                </option>
              ) : (
                <>
                  <option value="Select Department">
                    Select Department
                  </option>

                  {availableDepartments.map(
                    (department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    )
                  )}
                </>
              )}

            </select>

            {!isSuperadmin &&
              form.kiosk ===
                'Select Kiosk' && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Select a kiosk first to
                  view its departments.
                </p>
              )}

            {isSuperadmin && (
              <p className="mt-1 text-[10px] text-slate-400">
                Superadmin oversees all
                departments.
              </p>
            )}

          </div>

          {/* =================================================
              STATUS
          ================================================= */}

          <div>

            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Status
            </label>

            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status:
                    e.target.value,
                })
              }
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            >

              {STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}

            </select>

          </div>

          {/* =================================================
              PASSWORD
          ================================================= */}

          {!isEditing && (
            <div>

              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Password
              </label>

              <div className="relative">

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password:
                        e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                  placeholder="Enter password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (v) => !v
                    )
                  }
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>

              </div>

              {/* PASSWORD STRENGTH BAR */}

              <div className="mt-2">

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">

                  <div
                    className={`h-full rounded-full transition-all duration-300 ${passwordBarColor}`}
                    style={{
                      width:
                        passwordBarWidth,
                    }}
                  />

                </div>

                {/* PASSWORD REQUIREMENTS */}

                <ul className="mt-2 space-y-1">

                  {passwordChecks.map(
                    (check) => (
                      <li
                        key={check.label}
                        className="flex items-center gap-1.5 text-xs"
                      >

                        {check.passed ? (
                          <CheckCircle2
                            size={14}
                            className="shrink-0 text-green-500"
                          />
                        ) : (
                          <Circle
                            size={14}
                            className="shrink-0 text-slate-300"
                          />
                        )}

                        <span
                          className={
                            check.passed
                              ? 'text-slate-600'
                              : 'text-slate-400'
                          }
                        >
                          {check.label}
                        </span>

                      </li>
                    )
                  )}

                </ul>

              </div>

              {/* PASSWORD ERROR */}

              {form.password.length > 0 &&
                !passwordValid && (
                  <p className="mt-2 text-[11px] text-red-500">
                    Please meet all password
                    requirements before adding
                    the user.
                  </p>
                )}

              {/* =================================================
                  CONFIRM PASSWORD
              ================================================= */}

              {form.password.length > 0 && (
                <div className="mt-4">

                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Confirm Password
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showConfirmPassword
                          ? 'text'
                          : 'password'
                      }
                      value={
                        form.confirmPassword
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          confirmPassword:
                            e.target.value,
                        })
                      }
                      className={`w-full rounded-lg border bg-slate-50 px-3 py-2 pr-10 text-sm focus:bg-white focus:outline-none ${
                        form.confirmPassword
                          .length === 0
                          ? 'border-slate-300 focus:border-blue-500'
                          : confirmPasswordValid
                            ? 'border-green-400 focus:border-green-500'
                            : 'border-red-400 focus:border-red-500'
                      }`}
                      placeholder="Confirm password"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (v) => !v
                        )
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirm password'
                          : 'Show confirm password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>

                  </div>

                  {form.confirmPassword
                    .length > 0 && (
                    <p
                      className={`mt-1.5 text-[11px] ${
                        confirmPasswordValid
                          ? 'text-green-600'
                          : 'text-red-500'
                      }`}
                    >
                      {confirmPasswordValid
                        ? 'Passwords match.'
                        : 'Passwords do not match.'}
                    </p>
                  )}

                </div>
              )}

            </div>
          )}

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4">

          {/* DELETE */}

          {isEditing ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving || deleting}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={15} />

              {deleting
                ? 'Deleting...'
                : 'Delete User'}
            </button>
          ) : (
            <div />
          )}

          {/* SAVE / CANCEL */}

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={
                saving ||
                deleting ||
                !form.first_name.trim() ||
                !form.last_name.trim() ||
                !form.email.trim() ||
                (!isEditing &&
                  (!passwordValid ||
                    !confirmPasswordValid))
              }
              className="flex items-center gap-2 rounded-lg bg-[#00529B] px-5 py-2 text-sm font-medium text-white hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : '+ Add User'}
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}

/* =========================================================
   MAIN USER CRUD
========================================================= */

export default function UserCrud({
  onAddDepartment,
}) {
  const [users, setUsers] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [success, setSuccess] =
    useState(null);

  const [duplicatePopup, setDuplicatePopup] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [editingId, setEditingId] =
    useState(null);

  /*
    Controls the SECONDARY delete confirmation modal.
  */
  const [
    deleteConfirmOpen,
    setDeleteConfirmOpen,
  ] = useState(false);

  /*
    Required reason for deletion.
    This belongs to UserCrud, NOT UserModal.
  */
  const [deleteReason, setDeleteReason] =
    useState('');

  const [form, setForm] =
    useState(EMPTY_FORM);

  /* =======================================================
     FETCH USERS
  ======================================================= */

  async function fetchUsers() {
    setLoading(true);
    setError(null);

    const [
      {
        data,
        error,
      },
      {
        data: roles,
        error: rolesError,
      },
    ] = await Promise.all([
      supabase
        .from(TABLE_NAME)
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          contact_info,
          kiosk,
          position,
          department,
          status,
          updated_at,
          role_id,
          role:role_id (
            role_id,
            role
          )
        `)
        .order('last_name', {
          ascending: true,
        }),

      supabase
        .from('role')
        .select('role_id, role'),
    ]);

    if (error || rolesError) {
      setError(
        error?.message ||
          rolesError?.message ||
          'Unable to fetch users.'
      );
    } else {
      const roleById =
        new Map(
          (roles || []).map(
            (role) => [
              String(role.role_id),
              role.role,
            ]
          )
        );

      const formattedUsers =
        (data || []).map((u) => ({
          id: u.user_id,

          first_name:
            u.first_name,

          last_name:
            u.last_name,

          email:
            u.email,

          contact_number:
            u.contact_info,

          kiosk:
            u.kiosk,

          position:
            u.position,

          department:
            u.department,

          status:
            u.status
              ?.toUpperCase() ===
            'ONLINE'
              ? 'Active'
              : u.status
                  ?.toUpperCase() ===
                'OFFLINE'
                ? 'Inactive'
                : u.status ??
                  'Active',

          role:
            getRoleName(u.role) ||
            roleById.get(
              String(u.role_id)
            ) ||
            'Staff',

          updated_at:
            u.updated_at,
        }));

      setUsers(formattedUsers);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  /* =======================================================
     ADD USER
  ======================================================= */

  function openAdd() {
    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);
    setDeleteConfirmOpen(false);
    setDeleteReason('');

    setForm({
      ...EMPTY_FORM,
    });

    setEditingId('new');
  }

  /* =======================================================
     EDIT USER
  ======================================================= */

  function openEdit(user) {
    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);
    setDeleteConfirmOpen(false);
    setDeleteReason('');

    const isSuperadmin =
      user.role?.toLowerCase() ===
      'superadmin';

    setForm({
      first_name:
        user.first_name ?? '',

      last_name:
        user.last_name ?? '',

      mi: '',

      contact_number:
        user.contact_number ?? '',

      email:
        user.email ?? '',

      role:
        user.role ?? 'Staff',

      position:
        user.position ?? null,

      kiosk:
        isSuperadmin
          ? 'Whole'
          : user.kiosk ??
            'Select Kiosk',

      department:
        isSuperadmin
          ? 'Whole'
          : user.department ??
            'Select Department',

      status:
        user.status === 'Inactive'
          ? 'Inactive'
          : 'Active',

      password: '',
      confirmPassword: '',
    });

    setEditingId(user.id);
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
    });

    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);
    setDeleteConfirmOpen(false);
    setDeleteReason('');
  }

  /* =======================================================
     REQUEST DELETE
     
     IMPORTANT:
     Clicking Delete User does NOT delete immediately.
     It opens the confirmation modal and requires a reason.
  ======================================================= */

  function requestDelete() {
    if (!editingId || editingId === 'new') {
      return;
    }

    setError(null);
    setSuccess(null);

    /*
      Always start with a blank reason.
    */
    setDeleteReason('');

    /*
      Open the confirmation modal.
    */
    setDeleteConfirmOpen(true);
  }

  /* =======================================================
     CANCEL DELETE
  ======================================================= */

  function cancelDelete() {
    if (deleting) {
      return;
    }

    setDeleteConfirmOpen(false);
    setDeleteReason('');
  }

  /* =======================================================
     ACTUAL DELETE
     
     Flow:
     1. Validate reason
     2. Get target user
     3. Get current logged-in user
     4. Save audit log
     5. Delete public.user
     6. Refresh
  ======================================================= */

  async function handleDelete() {
    if (!editingId || editingId === 'new') {
      return;
    }

    const reason =
      deleteReason.trim();

    /*
      Reason is mandatory.
    */
    if (!reason) {
      setError(
        'Please provide a reason for deleting this user.'
      );
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      /* -----------------------------------------------
         GET TARGET USER BEFORE DELETING
      ----------------------------------------------- */

      const {
        data: targetUser,
        error: targetError,
      } = await supabase
        .from(TABLE_NAME)
        .select(`
          user_id,
          first_name,
          last_name,
          email
        `)
        .eq('user_id', editingId)
        .single();

      if (targetError) {
        throw targetError;
      }

      if (!targetUser) {
        throw new Error(
          'The user could not be found.'
        );
      }

      /* -----------------------------------------------
         GET CURRENT LOGGED-IN USER
      ----------------------------------------------- */

      const {
        data: {
          user: currentUser,
        },
        error: currentUserError,
      } = await supabase.auth.getUser();

      if (currentUserError) {
        throw currentUserError;
      }

      if (!currentUser) {
        throw new Error(
          'You must be signed in to delete a user.'
        );
      }

      /* -----------------------------------------------
         STEP 1
         SAVE AUDIT LOG FIRST
      ----------------------------------------------- */

      const {
        data: logData,
        error: logError,
      } = await supabase
        .from('user_deletion_logs')
        .insert({
          user_id:
            targetUser.user_id,

          first_name:
            targetUser.first_name,

          last_name:
            targetUser.last_name,

          email:
            targetUser.email,

          reason,

          deleted_by:
            currentUser.id,
        })
        .select('deletion_id')
        .single();

      if (logError) {
        console.error(
          'DELETION LOG INSERT ERROR:',
          logError
        );

        throw new Error(
          `The deletion log could not be saved. The user was NOT deleted. ${logError.message}`
        );
      }

      if (!logData?.deletion_id) {
        throw new Error(
          'The deletion log was not confirmed. The user was NOT deleted.'
        );
      }

      /* -----------------------------------------------
         STEP 2
         DELETE PUBLIC USER
      ----------------------------------------------- */

      const {
        error: deleteError,
        count,
      } = await supabase
        .from(TABLE_NAME)
        .delete({
          count: 'exact',
        })
        .eq(
          'user_id',
          editingId
        );

      if (deleteError) {
        console.error(
          'USER DELETE ERROR:',
          deleteError
        );

        throw new Error(
          `The user could not be deleted. The audit record was saved. ${deleteError.message}`
        );
      }

      if (count !== 1) {
        throw new Error(
          'The user was not deleted. Check the DELETE policy on the user table.'
        );
      }

      /* -----------------------------------------------
         STEP 3
         EVERYTHING SUCCEEDED
      ----------------------------------------------- */

      setDeleteConfirmOpen(false);
      setDeleteReason('');
      setEditingId(null);
      setForm({
        ...EMPTY_FORM,
      });

      setSuccess(
        'User deleted successfully and the deletion was recorded in the audit log.'
      );

      await fetchUsers();

    } catch (err) {
      console.error(
        'DELETE USER ERROR:',
        err
      );

      setError(
        err?.message ||
          'An error occurred while deleting the user.'
      );
    } finally {
      setDeleting(false);
    }
  }

  /* =======================================================
     SAVE USER
  ======================================================= */

  async function handleSave() {
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.email.trim()
    ) {
      return;
    }

    /* -----------------------------------------------
       PASSWORD VALIDATION FOR NEW USER
    ----------------------------------------------- */

    if (editingId === 'new') {
      const passwordValid =
        form.password.length >= 8 &&
        /\d/.test(form.password) &&
        /[^A-Za-z0-9]/.test(
          form.password
        );

      if (!passwordValid) {
        setError(
          'Password must be at least 8 characters and contain a number and a symbol.'
        );

        return;
      }

      if (
        form.password !==
        form.confirmPassword
      ) {
        setError(
          'Password and confirm password do not match.'
        );

        return;
      }
    }

    /* -----------------------------------------------
       VALIDATE DEPARTMENT
    ----------------------------------------------- */

    if (
      editingId === 'new' &&
      form.kiosk !== 'Select Kiosk' &&
      form.kiosk !== 'Whole'
    ) {
      const allowedDepartments =
        DEPARTMENTS_BY_KIOSK[
          form.kiosk
        ] || [];

      if (
        form.department !==
          'Select Department' &&
        !allowedDepartments.includes(
          form.department
        )
      ) {
        setError(
          'Please select a department that belongs to the selected kiosk.'
        );

        return;
      }
    }

    const normalizedEmail =
      normalizeEmail(form.email);

    /* -----------------------------------------------
       DUPLICATE EMAIL CHECK
    ----------------------------------------------- */

    try {
      const {
        data: existingUser,
        error: duplicateCheckError,
      } = await supabase
        .from(TABLE_NAME)
        .select(
          'user_id, email'
        )
        .ilike(
          'email',
          normalizedEmail
        )
        .neq(
          'user_id',
          editingId === 'new'
            ? '00000000-0000-0000-0000-000000000000'
            : editingId
        )
        .limit(1)
        .maybeSingle();

      if (duplicateCheckError) {
        throw duplicateCheckError;
      }

      if (existingUser) {
        setError(
          'This email is already registered. Please use a different email address.'
        );

        setDuplicatePopup(true);

        return;
      }

    } catch (duplicateError) {
      setError(
        duplicateError?.message ||
          'Unable to check whether this email is already registered.'
      );

      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setDuplicatePopup(false);

    try {
      /* -----------------------------------------------
         GET ROLE ID
      ----------------------------------------------- */

      let currentRoleId;

      const {
        data: roleData,
        error: roleError,
      } = await supabase
        .from('role')
        .select('role_id')
        .eq(
          'role',
          form.role
        )
        .maybeSingle();

      if (roleError) {
        throw roleError;
      }

      if (roleData) {
        currentRoleId =
          roleData.role_id;
      } else {
        const {
          data: newRole,
          error: newRoleError,
        } = await supabase
          .from('role')
          .insert([
            {
              role: form.role,
            },
          ])
          .select(
            'role_id'
          )
          .single();

        if (newRoleError) {
          throw newRoleError;
        }

        currentRoleId =
          newRole.role_id;
      }

      /* -----------------------------------------------
         SUPERADMIN OVERRIDE
      ----------------------------------------------- */

      const isSuperadmin =
        form.role?.toLowerCase() ===
        'superadmin';

      const finalKiosk =
        isSuperadmin
          ? 'Whole'
          : form.kiosk;

      const finalDepartment =
        isSuperadmin
          ? 'Whole'
          : form.department;

      /* -----------------------------------------------
         ADD NEW USER
      ----------------------------------------------- */

      if (editingId === 'new') {

        const {
          data: authData,
          error: authError,
        } =
          await supabase.auth.signUp({
            email:
              normalizedEmail,

            password:
              form.password,
          });

        if (authError) {
          throw authError;
        }

        if (
          !authData?.user?.id
        ) {
          throw new Error(
            'User account was not created.'
          );
        }

        /*
          Supabase can return a user with no
          identities when the email already exists.
        */

        if (
          Array.isArray(
            authData.user.identities
          ) &&
          authData.user.identities
            .length === 0
        ) {
          setDuplicatePopup(true);

          throw new Error(
            'This email is already registered in the authentication system. Please use a different email address.'
          );
        }

        /* ---------------------------------------------
           INSERT PUBLIC USER
        --------------------------------------------- */

        const {
          error: dbError,
        } = await supabase
          .from(TABLE_NAME)
          .insert([
            {
              user_id:
                authData.user.id,

              first_name:
                form.first_name,

              last_name:
                form.last_name,

              email:
                normalizedEmail,

              contact_info:
                form.contact_number,

              kiosk:
                finalKiosk,

              position:
                form.position,

              department:
                finalDepartment,

              role_id:
                currentRoleId,

              status:
                form.status,
            },
          ]);

        if (dbError) {

          if (
            dbError.code ===
            '23505'
          ) {
            setDuplicatePopup(true);

            throw new Error(
              'This email is already registered. Please use a different email address.'
            );
          }

          throw dbError;
        }

        setSuccess(
          'User added successfully. A verification email will be sent to the registered email address when Supabase email confirmation is enabled.'
        );

      } else {

        /* ---------------------------------------------
           UPDATE EXISTING USER
        --------------------------------------------- */

        const updateData = {
          first_name:
            form.first_name,

          last_name:
            form.last_name,

          email:
            normalizedEmail,

          contact_info:
            form.contact_number,

          kiosk:
            finalKiosk,

          position:
            form.position,

          department:
            finalDepartment,

          status:
            form.status,

          role_id:
            currentRoleId,

          updated_at:
            new Date().toISOString(),
        };

        const {
          error: updateError,
        } = await supabase
          .from(TABLE_NAME)
          .update(updateData)
          .eq(
            'user_id',
            editingId
          );

        if (updateError) {

          if (
            updateError.code ===
            '23505'
          ) {
            throw new Error(
              'This email is already registered. Please use a different email address.'
            );
          }

          throw updateError;
        }

        setSuccess(
          'User updated successfully.'
        );
      }

      /* ---------------------------------------------
         REFRESH
      --------------------------------------------- */

      setEditingId(null);

      setForm({
        ...EMPTY_FORM,
      });

      await fetchUsers();

    } catch (err) {
      console.error(
        'SAVE USER ERROR:',
        err
      );

      setError(
        err?.message ||
          'An error occurred while saving.'
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     SUMMARY METRICS
  ======================================================= */

  const normalizedRoles =
    users.map(
      (user) =>
        user.role
          ?.toLowerCase()
          .replace(
            /[\s\-_]+/g,
            ''
          ) ?? ''
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
        role ===
          'departmentadmin'
    ).length;

  const staffCount =
    normalizedRoles.filter(
      (role) =>
        role === 'staff'
    ).length;

  const activeCount =
    users.filter(
      (u) =>
        u.status === 'Active'
    ).length;

  /* =======================================================
     SEARCH
  ======================================================= */

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredUsers =
    users.filter((u) => {
      const fullName =
        `${u.first_name} ${u.last_name}`
          .toLowerCase();

      const query =
        searchQuery.toLowerCase();

      return (
        fullName.includes(query) ||
        u.email
          ?.toLowerCase()
          .includes(query) ||
        u.contact_number
          ?.toLowerCase()
          .includes(query) ||
        u.department
          ?.toLowerCase()
          .includes(query) ||
        u.kiosk
          ?.toLowerCase()
          .includes(query) ||
        u.role
          ?.toLowerCase()
          .includes(query) ||
        u.position
          ?.toLowerCase()
          .includes(query)
      );
    });

  /* =======================================================
     PAGINATION
  ======================================================= */

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
      firstIndex + PAGE_SIZE
    );

  const isModalOpen =
    editingId !== null;

  const isEditing =
    isModalOpen &&
    editingId !== 'new';

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            User Management
          </h1>

          <p className="mt-0.5 text-xs text-slate-500">
            Manage system users,
            roles, and department
            assignments.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-md bg-[#00529B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#003F75]"
        >
          <span className="text-sm leading-none">
            +
          </span>

          Add User
        </button>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =================================================
          SUCCESS
      ================================================= */}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

        {/* SUPER ADMIN */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              SUPER ADMIN
            </span>

            <User
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {superAdminCount}
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              TOTAL SUPER ADMIN
            </p>

          </div>

        </div>

        {/* DEPT ADMIN */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              DEPT ADMIN
            </span>

            <Users
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {deptAdminCount}
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              TOTAL DEPT ADMIN
            </p>

          </div>

        </div>

        {/* STAFF */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              STAFF
            </span>

            <Contact
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {staffCount}
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              TOTAL STAFF
            </p>

          </div>

        </div>

        {/* ACTIVE */}

        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ACTIVE
            </span>

            <UserCheck
              size={18}
              className="text-slate-600"
            />

          </div>

          <div className="mt-3">

            <p className="text-2xl font-bold text-slate-800">
              {activeCount}/128
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ADMIN/STAFF ON DUTY
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
              42
            </p>

            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              ACTIVE TERMINAL
            </p>

          </div>

        </div>

      </div>

      {/* =================================================
          USERS TABLE
      ================================================= */}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">

          <h2 className="text-base font-bold text-slate-800">
            Users
          </h2>

          <div className="relative w-80">

            <input
              type="text"
              placeholder="Search user"
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

            <tbody className="divide-y divide-slate-100 text-slate-600">

              {/* LOADING */}

              {loading && (
                <tr key="loading-row">

                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    Loading users...
                  </td>

                </tr>
              )}

              {/* NO USERS */}

              {!loading &&
                filteredUsers.length ===
                  0 && (
                  <tr key="empty-row">

                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      No users found
                      matching your
                      criteria.
                    </td>

                  </tr>
                )}

              {/* USERS */}

              {!loading &&
                paginatedUsers.map(
                  (user) => (
                    <tr
                      key={user.id}
                      onClick={() =>
                        openEdit(user)
                      }
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >

                      <td className="px-6 py-4 font-medium text-slate-800">

                        {user.first_name}{' '}

                        {user.last_name}

                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {user.email}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {user.department ||
                          'OPD'}
                      </td>

                      <td className="px-6 py-4 capitalize text-slate-600">
                        {user.role}
                      </td>

                      <td className="px-6 py-4">

                        <span
                          className={`text-[11px] font-semibold ${
                            user.status ===
                            'Active'
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {user.status}
                        </span>

                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

        {/* =================================================
            PAGINATION
        ================================================= */}

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">

          <span>

            {filteredUsers.length ===
            0
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

            {/* PREVIOUS */}

            <button
              type="button"
              onClick={() =>
                setPage(
                  (p) =>
                    Math.max(
                      1,
                      p - 1
                    )
                )
              }
              disabled={
                currentPage === 1
              }
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50"
            >
              Prev
            </button>

            {/* PAGE NUMBERS */}

            {getPageNumbers(
              currentPage,
              totalPages
            ).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() =>
                  setPage(n)
                }
                aria-current={
                  n === currentPage
                    ? 'page'
                    : undefined
                }
                className={`rounded-md border border-slate-200 px-3 py-1 transition ${
                  n === currentPage
                    ? 'bg-white font-semibold text-slate-700 shadow-sm'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}

            {/* NEXT */}

            <button
              type="button"
              onClick={() =>
                setPage(
                  (p) =>
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

      {/* =================================================
          DUPLICATE USER POPUP
      ================================================= */}

      {duplicatePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4">

          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">

              <span className="text-xl font-bold">
                !
              </span>

            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-800">
              Duplicate User
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This email address is
              already registered.
              Please use a different
              email address.
            </p>

            <button
              type="button"
              onClick={() =>
                setDuplicatePopup(
                  false
                )
              }
              className="mt-5 w-full rounded-lg bg-[#00529B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003F75]"
            >
              OK
            </button>

          </div>

        </div>
      )}

      {/* =================================================
          DELETE CONFIRMATION MODAL

          IMPORTANT:
          This is the ONLY place where the deletion
          reason is requested.
      ================================================= */}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4">

          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">

            {/* HEADER */}

            <div className="mb-4 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 size={18} />
              </div>

              <div>

                <h3 className="text-base font-bold text-slate-800">
                  Delete User?
                </h3>

                <p className="text-xs text-slate-500">
                  A reason is required
                  before the user can be
                  deleted.
                </p>

              </div>

            </div>

            {/* WARNING */}

            <p className="text-sm leading-6 text-slate-600">

              Are you sure you want to
              delete{' '}

              <span className="font-semibold text-slate-800">
                {form.first_name}{' '}
                {form.last_name}
              </span>

              ? This cannot be
              undone.

            </p>

            {/* =================================================
                DELETE REASON
            ================================================= */}

            <div className="mt-4">

              <label className="mb-1.5 block text-xs font-semibold text-slate-700">

                Reason for deletion

                <span className="text-red-500">
                  {' '}*
                </span>

              </label>

              <textarea
                value={deleteReason}
                onChange={(e) =>
                  setDeleteReason(
                    e.target.value
                  )
                }
                disabled={deleting}
                required
                rows={4}
                maxLength={500}
                placeholder="Enter the reason for deleting this user..."
                className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-red-400 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">

                <span>
                  A deletion record will
                  be saved in the audit
                  log.
                </span>

                <span>
                  {deleteReason.length}/500
                </span>

              </div>

            </div>

            {/* =================================================
                DELETE BUTTONS
            ================================================= */}

            <div className="mt-6 flex justify-end gap-3">

              {/* CANCEL */}

              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>

              {/* DELETE */}

              <button
                type="button"
                onClick={handleDelete}
                disabled={
                  deleting ||
                  !deleteReason.trim()
                }
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >

                <Trash2 size={15} />

                {deleting
                  ? 'Deleting...'
                  : 'Delete User'}

              </button>

            </div>

          </div>

        </div>
      )}

      {/* =================================================
          USER MODAL
      ================================================= */}

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
          onDelete={requestDelete}
          deleting={deleting}
        />
      )}

    </div>
  );
}