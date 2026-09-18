import { useEffect, useMemo, useState } from 'react';
import {
  CalendarOff,
  IdCard,
  LogOut,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  getUsers,
  getRoles,
  getDepartments,
  getKiosks,
  createUser,
  updateUser,
  deleteUser,
} from '../../services/backendApi';

import { StatCard } from './shared';
import { useLanguage } from './LanguageContext';

const fieldClass =
  'mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#9D0A0E]';

const labelClass =
  'block text-xs font-semibold text-slate-600';

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  mi: '',
  contact_number: '',
  email: '',
  role: 'Staff',
  role_id: '',
  position: 'Null',
  kiosk: '',
  kiosk_name: '',
  kiosk_id: '',
  department: '',
  department_id: '',
  status: 'Active',
};

const STATS_META = [
  {
    key: 'staff',
    labelKey: 'common.stat.staff',
    captionKey: 'staff.stat.totalStaffCaption',
    icon: Users,
  },
  {
    key: 'onDuty',
    labelKey: 'staff.stat.onDuty',
    captionKey: 'staff.stat.onDutyCaption',
    icon: IdCard,
  },
  {
    key: 'offWork',
    labelKey: 'staff.stat.offWork',
    captionKey: 'staff.stat.offWorkCaption',
    icon: CalendarOff,
  },
  {
    key: 'onLeave',
    labelKey: 'staff.stat.onLeave',
    captionKey: 'staff.stat.noLeaveYet',
    icon: LogOut,
  },
];

const PAGE_SIZE = 5;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function displayValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return 'Null';
  }

  return String(value);
}

function getRoleName(user) {
  if (user?.role?.role) {
    return user.role.role;
  }

  if (user?.role_name) {
    return user.role_name;
  }

  if (typeof user?.role === 'string') {
    return user.role;
  }

  if (user?.roles?.name) {
    return user.roles.name;
  }

  if (user?.roles?.role) {
    return user.roles.role;
  }

  return '';
}

/*
|--------------------------------------------------------------------------
| GET LOGGED-IN USER
|--------------------------------------------------------------------------
*/

function getLoggedInUser() {
  const possibleKeys = [
    'swumed_user',
    'currentUser',
    'user',
    'loggedInUser',
  ];

  for (const key of possibleKeys) {
    const storedUser = localStorage.getItem(key);

    if (!storedUser) {
      continue;
    }

    try {
      const parsed = JSON.parse(storedUser);

      if (
        parsed &&
        typeof parsed === 'object'
      ) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| FIND DEPARTMENT
|--------------------------------------------------------------------------
*/

function findDepartment(
  departments,
  user
) {
  if (!Array.isArray(departments)) {
    return null;
  }

  if (user?.department_id) {
    const byId = departments.find(
      (department) =>
        String(
          department.department_id
        ) ===
        String(
          user.department_id
        )
    );

    if (byId) {
      return byId;
    }
  }

  const departmentName = String(
    user?.department || ''
  )
    .trim()
    .toLowerCase();

  if (!departmentName) {
    return null;
  }

  return (
    departments.find(
      (department) =>
        String(
          department.name || ''
        )
          .trim()
          .toLowerCase() ===
        departmentName
    ) || null
  );
}

/*
|--------------------------------------------------------------------------
| FIND KIOSK
|--------------------------------------------------------------------------
*/

function findKiosk(
  kiosks,
  department
) {
  if (
    !Array.isArray(kiosks) ||
    !department
  ) {
    return null;
  }

  if (department.kiosk_id) {
    const byId = kiosks.find(
      (kiosk) =>
        String(
          kiosk.kiosk_id
        ) ===
        String(
          department.kiosk_id
        )
    );

    if (byId) {
      return byId;
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| MAIN COMPONENT
|--------------------------------------------------------------------------
*/

export default function StaffManagementPage() {
  const { t } = useLanguage();

  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loggedInUser, setLoggedInUser] =
    useState(null);

  const [adminDepartment, setAdminDepartment] =
    useState('');

  const [
    adminDepartmentRecord,
    setAdminDepartmentRecord,
  ] = useState(null);

  const [staffRoleId, setStaffRoleId] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [query, setQuery] =
    useState('');

  const [modal, setModal] =
    useState(null);

  const [confirmDelete, setConfirmDelete] =
    useState(false);

  const [page, setPage] =
    useState(1);

  const [form, setForm] =
    useState(EMPTY_FORM);

  /*
  |--------------------------------------------------------------------------
  | LOAD STAFF DATA
  |--------------------------------------------------------------------------
  */

  async function loadStaffManagement(
    showLoading = true
  ) {
    if (showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      /*
      |--------------------------------------------------------------------------
      | 1. GET LOGGED-IN USER
      |--------------------------------------------------------------------------
      */

      const currentUser =
        getLoggedInUser();

      if (!currentUser) {
        throw new Error(
          'You must be logged in.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | 2. LOAD DATA THROUGH NODE
      |--------------------------------------------------------------------------
      */

      const [
        allUsers,
        roleData,
        departmentData,
        kioskData,
      ] = await Promise.all([
        getUsers(),
        getRoles(),
        getDepartments(),
        getKiosks(),
      ]);

      /*
      |--------------------------------------------------------------------------
      | 3. FIND COMPLETE ADMIN PROFILE
      |--------------------------------------------------------------------------
      */

      let adminProfile =
        currentUser;

      if (currentUser.user_id) {
        const matchingUser =
          allUsers.find(
            (user) =>
              String(
                user.user_id
              ) ===
              String(
                currentUser.user_id
              )
          );

        if (matchingUser) {
          adminProfile =
            matchingUser;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | 4. RESOLVE ADMIN ROLE
      |--------------------------------------------------------------------------
      */

      let resolvedAdminRole =
        getRoleName(
          adminProfile
        );

      if (
        !resolvedAdminRole &&
        adminProfile.role_id
      ) {
        const matchingRole =
          roleData.find(
            (role) =>
              String(
                role.role_id
              ) ===
              String(
                adminProfile.role_id
              )
          );

        resolvedAdminRole =
          matchingRole?.role ||
          '';
      }

      const normalizedAdminRole =
        normalizeRole(
          resolvedAdminRole
        );

      /*
      |--------------------------------------------------------------------------
      | 5. VERIFY DEPARTMENT ADMIN
      |--------------------------------------------------------------------------
      */

      const isDepartmentAdmin =
        normalizedAdminRole ===
          'admin' ||
        normalizedAdminRole ===
          'deptadmin' ||
        normalizedAdminRole ===
          'departmentadmin';

      if (!isDepartmentAdmin) {
        throw new Error(
          'You do not have permission to manage staff.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | 6. FIND ADMIN DEPARTMENT
      |--------------------------------------------------------------------------
      */

      const departmentRecord =
        findDepartment(
          departmentData,
          adminProfile
        );

      if (!departmentRecord) {
        throw new Error(
          'Your account is not assigned to a valid department.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | 7. FIND STAFF ROLE
      |--------------------------------------------------------------------------
      */

      const staffRoleData =
        roleData.find(
          (role) =>
            normalizeRole(
              role.role
            ) === 'staff'
        );

      if (!staffRoleData) {
        throw new Error(
          'Staff role was not found.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | 8. FIND DEPARTMENT KIOSK
      |--------------------------------------------------------------------------
      */

      const departmentKiosk =
        findKiosk(
          kioskData,
          departmentRecord
        );

      /*
      |--------------------------------------------------------------------------
      | 9. FILTER STAFF BY DEPARTMENT
      |--------------------------------------------------------------------------
      */

      const departmentStaff =
        allUsers.filter(
          (user) => {
            const sameRole =
              String(
                user.role_id || ''
              ) ===
              String(
                staffRoleData.role_id
              );

            const sameDepartmentId =
              departmentRecord.department_id &&
              user.department_id &&
              String(
                user.department_id
              ) ===
              String(
                departmentRecord.department_id
              );

            const sameDepartmentName =
              String(
                user.department || ''
              )
                .trim()
                .toLowerCase() ===
              String(
                departmentRecord.name ||
                  ''
              )
                .trim()
                .toLowerCase();

            const sameDepartment =
              sameDepartmentId ||
              sameDepartmentName;

            return (
              sameRole &&
              sameDepartment
            );
          }
        );

      /*
      |--------------------------------------------------------------------------
      | 10. SAVE STATE
      |--------------------------------------------------------------------------
      */

      setLoggedInUser(
        adminProfile
      );

      setAdminDepartment(
        departmentRecord.name ||
          adminProfile.department ||
          ''
      );

      setAdminDepartmentRecord(
        departmentRecord
      );

      setUsers(
        departmentStaff
      );

      setRoles(
        roleData
      );

      setStaffRoleId(
        staffRoleData.role_id
      );

      setKiosks(
        departmentKiosk
          ? [departmentKiosk]
          : []
      );

      setDepartments(
        departmentData
      );
    } catch (err) {
      console.error(
        'Failed to load department staff:',
        err
      );

      setError(
        err?.message ||
          'Failed to load department staff.'
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | INITIAL LOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      if (cancelled) {
        return;
      }

      await loadStaffManagement(
        true
      );
    }

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | STAFF ROLE
  |--------------------------------------------------------------------------
  */

  const staffRole = useMemo(() => {
    return roles.find(
      (role) =>
        normalizeRole(
          role.role
        ) === 'staff'
    );
  }, [roles]);

  /*
  |--------------------------------------------------------------------------
  | ADD ROLE NAME TO USERS
  |--------------------------------------------------------------------------
  */

  const usersWithRoleNames =
    useMemo(() => {
      return users.map((user) => {
        const role =
          roles.find(
            (item) =>
              String(
                item.role_id
              ) ===
              String(
                user.role_id
              )
          );

        return {
          ...user,

          role: role
            ? {
                role_id:
                  role.role_id,

                role:
                  role.role,
              }
            : user.role,
        };
      });
    }, [users, roles]);

  /*
  |--------------------------------------------------------------------------
  | FILTER STAFF
  |--------------------------------------------------------------------------
  */

  const filteredUsers =
    useMemo(() => {
      const searchValue =
        query.trim().toLowerCase();

      if (!searchValue) {
        return usersWithRoleNames;
      }

      return usersWithRoleNames.filter(
        (user) => {
          const fullName =
            `${user.first_name || ''} ${
              user.last_name || ''
            }`.toLowerCase();

          const email =
            String(
              user.email || ''
            ).toLowerCase();

          const contact =
            String(
              user.contact_number || ''
            ).toLowerCase();

          const position =
            String(
              user.position ?? 'Null'
            ).toLowerCase();

          const department =
            String(
              user.department || ''
            ).toLowerCase();

          const kiosk =
            String(
              user.kiosk || ''
            ).toLowerCase();

          return (
            fullName.includes(
              searchValue
            ) ||
            email.includes(
              searchValue
            ) ||
            contact.includes(
              searchValue
            ) ||
            position.includes(
              searchValue
            ) ||
            department.includes(
              searchValue
            ) ||
            kiosk.includes(
              searchValue
            )
          );
        }
      );
    }, [
      query,
      usersWithRoleNames,
    ]);

  /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredUsers.length /
        PAGE_SIZE
    )
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const pagedUsers = useMemo(
    () =>
      filteredUsers.slice(
        (currentPage - 1) *
          PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [
      filteredUsers,
      currentPage,
    ]
  );

  const pageNumbers = useMemo(() => {
    const start = Math.max(
      1,
      Math.min(
        currentPage - 1,
        totalPages - 2
      )
    );

    return Array.from(
      { length: Math.min(3, totalPages) },
      (_, index) => start + index
    );
  }, [currentPage, totalPages]);

  /*
  |--------------------------------------------------------------------------
  | STATISTICS
  |--------------------------------------------------------------------------
  */

  const stats = useMemo(() => {
    const activeCount =
      usersWithRoleNames.filter(
        (user) =>
          String(
            user.status || ''
          ).toLowerCase() ===
          'active'
      ).length;

    return {
      staff:
        usersWithRoleNames.length,

      onDuty:
        activeCount,

      offWork:
        usersWithRoleNames.length -
        activeCount,

      onLeave: 0,
    };
  }, [
    usersWithRoleNames,
  ]);

  /*
  |--------------------------------------------------------------------------
  | OPEN USER
  |--------------------------------------------------------------------------
  */

  function openUser(user) {
    const matchingKiosk =
      kiosks.find(
        (kiosk) =>
          String(
            kiosk.kiosk_id
          ) ===
          String(
            user.kiosk_id
          )
      ) ||
      kiosks.find(
        (kiosk) =>
          String(
            kiosk.name || ''
          )
            .trim()
            .toLowerCase() ===
          String(
            user.kiosk || ''
          )
            .trim()
            .toLowerCase()
      );

    const storedPosition =
      user.position === null ||
      user.position === undefined ||
      String(
        user.position
      ).trim() === ''
        ? 'Null'
        : String(
            user.position
          );

    setForm({
      first_name:
        user.first_name || '',

      last_name:
        user.last_name || '',

      mi:
        user.mi || '',

      contact_number:
        user.contact_number || '',

      email:
        user.email || '',

      role:
        'Staff',

      role_id:
        user.role_id ||
        staffRole?.role_id ||
        '',

      position:
        storedPosition,

      kiosk:
        matchingKiosk?.kiosk_id ||
        user.kiosk_id ||
        '',

      kiosk_name:
        matchingKiosk?.name ||
        user.kiosk ||
        'Null',

      kiosk_id:
        matchingKiosk?.kiosk_id ||
        user.kiosk_id ||
        '',

      department:
        user.department ||
        adminDepartment,

      department_id:
        user.department_id ||
        adminDepartmentRecord?.department_id ||
        '',

      status:
        user.status ||
        'Inactive',
    });

    setError(null);

    setModal({
      type: 'edit',
      user,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | OPEN ADD
  |--------------------------------------------------------------------------
  */

  function openAdd() {
    if (
      !adminDepartmentRecord
    ) {
      setError(
        'Your department could not be determined.'
      );
      return;
    }

    const departmentKiosk =
      kiosks.find(
        (kiosk) =>
          String(
            kiosk.kiosk_id
          ) ===
          String(
            adminDepartmentRecord.kiosk_id
          )
      );

    if (!departmentKiosk) {
      setError(
        'No kiosk is assigned to your department.'
      );
      return;
    }

    setForm({
      ...EMPTY_FORM,

      role: 'Staff',

      role_id:
        staffRoleId,

      position: 'Null',

      kiosk:
        departmentKiosk.kiosk_id,

      kiosk_name:
        departmentKiosk.name,

      kiosk_id:
        departmentKiosk.kiosk_id,

      department:
        adminDepartment,

      department_id:
        adminDepartmentRecord.department_id,

      status: 'Active',
    });

    setError(null);

    setModal('add');
  }

  /*
  |--------------------------------------------------------------------------
  | CLOSE MODAL
  |--------------------------------------------------------------------------
  */

  function closeModal() {
    setModal(null);
    setConfirmDelete(false);

    setForm({
      ...EMPTY_FORM,
    });

    setError(null);
  }

  /*
  |--------------------------------------------------------------------------
  | FORM UPDATE
  |--------------------------------------------------------------------------
  */

  function updateField(
    field,
    value
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATE STAFF FORM
  |--------------------------------------------------------------------------
  */

  function validateStaffForm() {
    if (
      !form.first_name.trim()
    ) {
      return 'First name is required.';
    }

    if (
      !form.last_name.trim()
    ) {
      return 'Last name is required.';
    }

    if (
      !form.email.trim()
    ) {
      return 'Email address is required.';
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return 'Please enter a valid email address.';
    }

    if (
      !form.contact_number.trim()
    ) {
      return 'Contact number is required.';
    }

    if (!adminDepartment) {
      return 'Your department could not be determined.';
    }

    if (
      !adminDepartmentRecord
    ) {
      return 'Your department record could not be found.';
    }

    if (
      !adminDepartmentRecord.kiosk_id
    ) {
      return 'No kiosk is assigned to your department.';
    }

    if (!staffRoleId) {
      return 'Staff role could not be determined.';
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | ADD STAFF
  |--------------------------------------------------------------------------
  */

  async function addUser() {
    const validationError =
      validateStaffForm();

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const allUsers =
        await getUsers();

      const normalizedEmail =
        form.email
          .trim()
          .toLowerCase();

      const duplicate =
        allUsers.some(
          (user) =>
            String(
              user.email || ''
            )
              .trim()
              .toLowerCase() ===
            normalizedEmail
        );

      if (duplicate) {
        throw new Error(
          'This email is already registered. Please use a different email address.'
        );
      }

      const departmentData =
        departments.find(
          (department) =>
            String(
              department.department_id
            ) ===
            String(
              adminDepartmentRecord.department_id
            )
        );

      if (!departmentData) {
        throw new Error(
          'Your department could not be found.'
        );
      }

      if (
        !departmentData.kiosk_id
      ) {
        throw new Error(
          'Your department does not have a kiosk assigned.'
        );
      }

      const selectedKiosk =
        kiosks.find(
          (kiosk) =>
            String(
              kiosk.kiosk_id
            ) ===
            String(
              departmentData.kiosk_id
            )
        );

      if (!selectedKiosk) {
        throw new Error(
          'The department kiosk could not be found.'
        );
      }

      const createdUser =
        await createUser({
          first_name:
            form.first_name.trim(),

          last_name:
            form.last_name.trim(),

          mi:
            form.mi.trim() ||
            null,

          contact_number:
            form.contact_number.trim(),

          email:
            normalizedEmail,

          role_id:
            staffRoleId,

          role:
            'Staff',

          position:
            form.position === 'Null'
              ? null
              : form.position,

          kiosk_id:
            selectedKiosk.kiosk_id,

          kiosk:
            selectedKiosk.name,

          department_id:
            departmentData.department_id,

          department:
            departmentData.name,

          status:
            form.status,
        });

      if (!createdUser) {
        throw new Error(
          'Staff account could not be created.'
        );
      }

      closeModal();

      await loadStaffManagement(
        false
      );
    } catch (err) {
      console.error(
        'Failed to add staff:',
        err
      );

      setError(
        err?.message ||
          'Failed to add staff.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SAVE STAFF
  |--------------------------------------------------------------------------
  */

  async function saveUser() {
    if (
      !modal?.user?.user_id
    ) {
      return;
    }

    const validationError =
      validateStaffForm();

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    const sameDepartmentId =
      modal.user.department_id &&
      adminDepartmentRecord?.department_id &&
      String(
        modal.user.department_id
      ) ===
      String(
        adminDepartmentRecord.department_id
      );

    const sameDepartmentName =
      String(
        modal.user.department || ''
      )
        .trim()
        .toLowerCase() ===
      String(
        adminDepartment || ''
      )
        .trim()
        .toLowerCase();

    if (
      !sameDepartmentId &&
      !sameDepartmentName
    ) {
      setError(
        'You can only edit staff belonging to your own department.'
      );
      return;
    }

    const departmentData =
      departments.find(
        (department) =>
          String(
            department.department_id
          ) ===
          String(
            adminDepartmentRecord?.department_id
          )
      );

    if (!departmentData) {
      setError(
        'Your department could not be found.'
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
            departmentData.kiosk_id
          )
      );

    if (!selectedKiosk) {
      setError(
        'Your department kiosk could not be found.'
      );
      return;
    }

    const positionToSave =
      form.position === 'Null' ||
      form.position === '' ||
      form.position === null ||
      form.position === undefined
        ? null
        : form.position;

    setSaving(true);
    setError(null);

    try {
      const updatedUser =
        await updateUser(
          modal.user.user_id,
          {
            first_name:
              form.first_name.trim(),

            last_name:
              form.last_name.trim(),

            mi:
              form.mi.trim() ||
              null,

            contact_number:
              form.contact_number.trim(),

            email:
              form.email
                .trim()
                .toLowerCase(),

            role_id:
              staffRoleId,

            role:
              'Staff',

            position:
              positionToSave,

            kiosk_id:
              selectedKiosk.kiosk_id,

            kiosk:
              selectedKiosk.name,

            department_id:
              departmentData.department_id,

            department:
              departmentData.name,

            status:
              form.status,
          }
        );

      if (!updatedUser) {
        throw new Error(
          'Staff member could not be updated.'
        );
      }

      closeModal();

      await loadStaffManagement(
        false
      );
    } catch (err) {
      console.error(
        'Failed to save staff:',
        err
      );

      setError(
        err?.message ||
          'Failed to save staff.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE STAFF
  |--------------------------------------------------------------------------
  */

  async function deleteUserRow() {
    if (
      !modal?.user?.user_id
    ) {
      return;
    }

    const sameDepartmentId =
      modal.user.department_id &&
      adminDepartmentRecord?.department_id &&
      String(
        modal.user.department_id
      ) ===
      String(
        adminDepartmentRecord.department_id
      );

    const sameDepartmentName =
      String(
        modal.user.department || ''
      )
        .trim()
        .toLowerCase() ===
      String(
        adminDepartment || ''
      )
        .trim()
        .toLowerCase();

    if (
      !sameDepartmentId &&
      !sameDepartmentName
    ) {
      setError(
        'You can only delete staff belonging to your own department.'
      );
      return;
    }

    setConfirmDelete(false);
    setSaving(true);
    setError(null);

    try {
      await deleteUser(
        modal.user.user_id,
        `Removed by ${adminDepartment} admin via Staff Management`
      );

      closeModal();

      await loadStaffManagement(
        false
      );
    } catch (err) {
      console.error(
        'Failed to delete staff:',
        err
      );

      setError(
        err?.message ||
          'Failed to delete staff.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

      {/* HEADER */}

      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">
            {t('staff.title')}
          </h1>

          <p className="mt-0.5 text-xs text-[#4B5563]">
            {t('staff.subtitle')}
          </p>

          {adminDepartment && (
            <p className="mt-1 text-xs font-semibold text-[#9D0A0E]">
              {t('staff.department', { name: adminDepartment })}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openAdd}
          disabled={
            !adminDepartment ||
            !adminDepartmentRecord ||
            !staffRoleId ||
            loading
          }
          className="inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          {t('staff.addButton')}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
            className="text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* STATISTICS - Updated to 4 columns to match reference layout */}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS_META.map(
          (stat) => (
            <StatCard
              key={stat.key}
              label={t(stat.labelKey)}
              caption={t(stat.captionKey)}
              icon={stat.icon}
              value={
                loading
                  ? '…'
                  : stats[
                      stat.key
                    ]
              }
            />
          )
        )}
      </div>

      {/* STAFF TABLE */}

      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">

        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {adminDepartment
                ? t('staff.staffSuffix', { department: adminDepartment })
                : t('common.stat.staff')}
            </h2>

            <p className="mt-1 text-[10px] text-slate-400">
              {t('staff.tableSubtitle')}
            </p>
          </div>

          <div className="relative w-64">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(
                  e.target.value
                );
                setPage(1);
              }}
              placeholder={t('common.search')}
              className="w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 pr-9 text-xs outline-none focus:border-[#9D0A0E]"
            />

            <Search
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[950px] text-left text-sm">

            <thead>
              <tr className="bg-[#9D0A0E]/5 text-xs font-bold uppercase tracking-wide text-slate-600">

                <th className="px-5 py-3">
                  {t('common.table.fullName')}
                </th>

                <th className="px-5 py-3">
                  {t('common.table.email')}
                </th>

                <th className="px-5 py-3">
                  {t('staff.table.department')}
                </th>

                <th className="px-5 py-3">
                  {t('common.table.role')}
                </th>

                <th className="px-5 py-3">
                  {t('common.table.status')}
                </th>

              </tr>
            </thead>

            <tbody>

              {loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    {t('staff.loadingStaff')}
                  </td>
                </tr>
              )}

              {!loading &&
                pagedUsers.map(
                  (user) => (
                    <tr
                      key={
                        user.user_id
                      }
                      onClick={() =>
                        openUser(
                          user
                        )
                      }
                      className="cursor-pointer border-t border-[#E5E7EB] hover:bg-slate-50"
                    >

                      <td className="px-5 py-3 capitalize text-slate-700">
                        {user.first_name}{' '}
                        {user.last_name}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          user.email
                        )}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          user.department
                        )}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          getRoleName(
                            user
                          )
                        )}
                      </td>

                      <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {displayValue(
                          user.status
                        )}
                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

          {!loading &&
            filteredUsers.length ===
              0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                {query.trim()
                  ? t('staff.noMatch')
                  : t('staff.noneInDept', {
                      department: adminDepartment || t('staff.yourDepartment'),
                    })}
              </div>
            )}

        </div>

        {/* PAGINATION */}

        <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3 text-xs text-slate-500">

          <span>
            {t('staff.showing', {
              from:
                filteredUsers.length === 0
                  ? 0
                  : (currentPage - 1) * PAGE_SIZE + 1,
              to: Math.min(
                currentPage * PAGE_SIZE,
                filteredUsers.length
              ),
              total: filteredUsers.length,
            })}
          </span>

          <div className="flex items-center gap-2">

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
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('common.prev')}
            </button>

            {pageNumbers.map(
              (number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() =>
                    setPage(number)
                  }
                  className={`rounded-md border px-3 py-1.5 font-semibold ${
                    number === currentPage
                      ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                      : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {number}
                </button>
              )
            )}

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
                currentPage === totalPages
              }
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('common.next')}
            </button>

          </div>
        </div>

      </div>

      {/* ============================================================
          EDIT STAFF MODAL
      ============================================================ */}

      {modal &&
        typeof modal === 'object' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

            <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E5E7EB] bg-white px-5 py-3">

                <h2 className="text-lg font-bold text-slate-800">
                  {t('staff.modal.staffDetails')}
                </h2>

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  aria-label="Close"
                >
                  <X
                    size={19}
                    className="text-slate-500"
                  />
                </button>

              </header>

              <div className="space-y-4 p-5">

                {/* NAME */}

                <div className="grid grid-cols-2 gap-3">

                  <label className={labelClass}>
                    {t('staff.modal.firstName')}

                    <input
                      className={
                        fieldClass
                      }
                      value={
                        form.first_name
                      }
                      onChange={(e) =>
                        updateField(
                          'first_name',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label className={labelClass}>
                    {t('staff.modal.lastName')}

                    <input
                      className={
                        fieldClass
                      }
                      value={
                        form.last_name
                      }
                      onChange={(e) =>
                        updateField(
                          'last_name',
                          e.target.value
                        )
                      }
                    />
                  </label>

                </div>

                {/* MI / CONTACT */}

                <div className="grid grid-cols-2 gap-3">

                  <label className={labelClass}>
                    M.I.

                    <input
                      className={
                        fieldClass
                      }
                      value={
                        form.mi
                      }
                      onChange={(e) =>
                        updateField(
                          'mi',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label className={labelClass}>
                    {t('staff.modal.contactNumber')}

                    <input
                      className={
                        fieldClass
                      }
                      value={
                        form.contact_number
                      }
                      onChange={(e) =>
                        updateField(
                          'contact_number',
                          e.target.value
                        )
                      }
                      placeholder={t('staff.modal.contactNumber')}
                    />
                  </label>

                </div>

                {/* EMAIL */}

                <label className={labelClass}>
                  {t('staff.modal.emailAddress')}

                  <input
                    type="email"
                    className={
                      fieldClass
                    }
                    value={
                      form.email
                    }
                    onChange={(e) =>
                      updateField(
                        'email',
                        e.target.value
                      )
                    }
                  />
                </label>

                {/* ROLE */}

                <label className={labelClass}>
                  {t('staff.modal.role')}

                  <select
                    className={
                      fieldClass
                    }
                    value="Staff"
                    disabled
                  >
                    <option value="Staff">
                      Staff
                    </option>
                  </select>
                </label>

              </div>

              <footer className="sticky bottom-0 flex items-center justify-between border-t border-[#E5E7EB] bg-white px-5 py-3">

                <button
                  type="button"
                  onClick={() =>
                    setConfirmDelete(true)
                  }
                  disabled={
                    saving
                  }
                  className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2
                    size={13}
                  />
                  {t('staff.modal.deleteStaff')}
                </button>

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={
                      closeModal
                    }
                    disabled={
                      saving
                    }
                    className="rounded-md border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>

                  <button
                    type="button"
                    onClick={
                      saveUser
                    }
                    disabled={
                      saving
                    }
                    className="rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50"
                  >
                    {saving
                      ? t('common.saving')
                      : t('common.save')}
                  </button>

                </div>

              </footer>

            </section>

          </div>
        )}

      {/* ============================================================
          ADD STAFF MODAL - Updated to match reference image 8c414a.png
      ============================================================ */}

      {modal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E5E7EB] bg-white px-5 py-4">

              <h2 className="text-lg font-bold text-slate-800">
                Add Staff
              </h2>

              <button
                type="button"
                onClick={
                  closeModal
                }
                aria-label="Close"
              >
                <X
                  size={19}
                  className="text-slate-500"
                />
              </button>

            </header>

            <div className="space-y-4 p-5">

              {/* FIRST NAME & LAST NAME */}

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className={labelClass}>
                    First Name
                  </label>
                  <input
                    className={fieldClass}
                    value={form.first_name}
                    onChange={(e) =>
                      updateField(
                        'first_name',
                        e.target.value
                      )
                    }
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Last Name
                  </label>
                  <input
                    className={fieldClass}
                    value={form.last_name}
                    onChange={(e) =>
                      updateField(
                        'last_name',
                        e.target.value
                      )
                    }
                    placeholder="Enter last name"
                  />
                </div>

              </div>

              {/* M.I & CONTACT NUMBER */}

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className={labelClass}>
                    M.i
                  </label>
                  <input
                    className={fieldClass}
                    value={form.mi}
                    onChange={(e) =>
                      updateField(
                        'mi',
                        e.target.value
                      )
                    }
                    placeholder="Enter M.i"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Contact Number
                  </label>
                  <input
                    className={fieldClass}
                    value={form.contact_number}
                    onChange={(e) =>
                      updateField(
                        'contact_number',
                        e.target.value
                      )
                    }
                    placeholder="Enter number"
                  />
                </div>

              </div>

              {/* EMAIL */}

              <div>
                <label className={labelClass}>
                  Email
                </label>
                <input
                  type="email"
                  className={fieldClass}
                  value={form.email}
                  onChange={(e) =>
                    updateField(
                      'email',
                      e.target.value
                    )
                  }
                  placeholder="Enter email"
                />
              </div>

              {/* SELECT ROLE */}

              <div>
                <label className={labelClass}>
                  Select Role
                </label>
                <select
                  className={`${fieldClass} cursor-not-allowed bg-slate-100 text-slate-500`}
                  value="Staff"
                  disabled
                >
                  <option value="Staff">
                    Staff
                  </option>
                </select>
              </div>

            </div>

            {/* FOOTER */}

            <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-[#E5E7EB] bg-white px-5 py-3">

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
                className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  addUser
                }
                disabled={
                  saving ||
                  !adminDepartment ||
                  !adminDepartmentRecord ||
                  !staffRoleId
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={13} />

                {saving
                  ? 'Adding...'
                  : 'Add This Staff'}
              </button>

            </footer>

          </section>

        </div>
      )}

      {/* ============================================================
          DELETE USER CONFIRMATION
      ============================================================ */}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">

          <div className="w-full max-w-sm rounded-lg border border-[#E5E7EB] bg-white p-6 text-center shadow-xl">

            <h2 className="text-lg font-bold text-[#1F2937]">
              {t('staff.deleteModal.title')}
            </h2>

            <p className="mt-2 text-xs text-[#4B5563]">
              {t('staff.deleteModal.body')}
            </p>

            <div className="mt-5 flex gap-2">

              <button
                type="button"
                onClick={() =>
                  setConfirmDelete(false)
                }
                disabled={saving}
                className="flex-1 rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>

              <button
                type="button"
                onClick={deleteUserRow}
                disabled={saving}
                className="flex-1 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50"
              >
                {saving ? t('common.deleting') : t('common.delete')}
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}