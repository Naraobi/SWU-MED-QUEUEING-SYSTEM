import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  Monitor,
  Plus,
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

const fieldClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#075b9f]';

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
    key: 'superAdmin',
    label: 'Super Admin',
    caption: 'Total super admin',
    icon: Users,
  },
  {
    key: 'deptAdmin',
    label: 'Dept Admin',
    caption: 'Total dept admin',
    icon: Users,
  },
  {
    key: 'staff',
    label: 'Staff',
    caption: 'Total staff',
    icon: Briefcase,
  },
  {
    key: 'active',
    label: 'Active',
    caption: 'Admin/staff on duty',
    icon: Activity,
  },
  {
    key: 'terminal',
    label: 'Terminal',
    caption: 'Active terminal',
    icon: Monitor,
  },
];

/*
|--------------------------------------------------------------------------
| STAT CARD
|--------------------------------------------------------------------------
*/

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>

        <Icon
          size={16}
          className="text-slate-400"
        />
      </div>

      <p className="text-2xl font-bold text-slate-800">
        {value}
      </p>

      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {caption}
      </p>
    </div>
  );
}

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
  | STATISTICS
  |--------------------------------------------------------------------------
  */

  const stats = useMemo(() => {
    const normalizedRoles =
      usersWithRoleNames.map(
        (user) =>
          normalizeRole(
            getRoleName(user)
          )
      );

    const superAdminCount =
      normalizedRoles.filter(
        (role) =>
          role === 'superadmin'
      ).length;

    const adminCount =
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
      usersWithRoleNames.filter(
        (user) =>
          String(
            user.status || ''
          ).toLowerCase() ===
          'active'
      ).length;

    return {
      superAdmin:
        superAdminCount,

      deptAdmin:
        adminCount,

      staff:
        staffCount,

      active:
        `${activeCount}/${usersWithRoleNames.length}`,

      terminal:
        kiosks.filter(
          (kiosk) =>
            String(
              kiosk.status || ''
            ).toLowerCase() ===
            'active'
        ).length,
    };
  }, [
    usersWithRoleNames,
    kiosks,
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

      /*
      |--------------------------------------------------------------------------
      | SECURITY
      |--------------------------------------------------------------------------
      | Never load an existing password into the form.
      |--------------------------------------------------------------------------
      */

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
      /*
      |--------------------------------------------------------------------------
      | 1. GET CURRENT USERS
      |--------------------------------------------------------------------------
      */

      const allUsers =
        await getUsers();

      /*
      |--------------------------------------------------------------------------
      | 2. CHECK DUPLICATE EMAIL
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | 3. GET ADMIN DEPARTMENT
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | 4. VERIFY DEPARTMENT KIOSK
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | 6. CLOSE MODAL
      |--------------------------------------------------------------------------
      */

      closeModal();

      /*
      |--------------------------------------------------------------------------
      | 7. REFRESH
      |--------------------------------------------------------------------------
      */

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

    /*
    |--------------------------------------------------------------------------
    | VERIFY EXISTING STAFF DEPARTMENT
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | GET ADMIN DEPARTMENT
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | GET DEPARTMENT KIOSK
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | POSITION
    |--------------------------------------------------------------------------
    */

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
      /*
      |--------------------------------------------------------------------------
      | UPDATE STAFF THROUGH NODE
      |--------------------------------------------------------------------------
      */

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

      /*
      |--------------------------------------------------------------------------
      | CLOSE MODAL
      |--------------------------------------------------------------------------
      */

      closeModal();

      /*
      |--------------------------------------------------------------------------
      | REFRESH
      |--------------------------------------------------------------------------
      */

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

    /*
    |--------------------------------------------------------------------------
    | VERIFY DEPARTMENT
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | CONFIRM DELETE
    |--------------------------------------------------------------------------
    */

    const confirmed =
      window.confirm(
        `Delete ${form.first_name} ${form.last_name}?`
      );

    if (!confirmed) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | GET DELETION REASON
    |--------------------------------------------------------------------------
    */

    const deletionReason =
      window.prompt(
        'Please enter the reason for deleting this staff account:'
      );

    if (
      deletionReason === null
    ) {
      return;
    }

    if (
      !deletionReason.trim()
    ) {
      setError(
        'A deletion reason is required.'
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteUser(
        modal.user.user_id,
        deletionReason.trim()
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
          <h1 className="text-2xl font-bold text-slate-800">
            Staff Management
          </h1>

          <p className="mt-0.5 text-xs text-slate-500">
            Manage staff accounts for your department.
          </p>

          {adminDepartment && (
            <p className="mt-1 text-xs font-semibold text-[#075b9f]">
              Department: {adminDepartment}
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
          className="inline-flex items-center gap-2 rounded-lg bg-[#00549A] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#004880] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} />
          Add Staff
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

      {/* STATISTICS */}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STATS_META.map(
          (stat) => (
            <StatCard
              key={stat.key}
              label={stat.label}
              caption={stat.caption}
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {adminDepartment
                ? `${adminDepartment} Staff`
                : 'Staff'}
            </h2>

            <p className="mt-1 text-[10px] text-slate-400">
              Staff assigned to this department are retrieved through Node.js.
            </p>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(
                e.target.value
              );
              setPage(1);
            }}
            placeholder="Search staff..."
            className="w-48 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-[#075b9f]"
          />
        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[950px] text-left text-sm">

            <thead>
              <tr className="bg-[#dfeaf6] text-xs font-bold uppercase tracking-wide text-slate-600">

                <th className="px-5 py-3">
                  Full name
                </th>

                <th className="px-5 py-3">
                  Email
                </th>

                <th className="px-5 py-3">
                  Contact Info
                </th>

                <th className="px-5 py-3">
                  Role
                </th>

                <th className="px-5 py-3">
                  Position
                </th>

                <th className="px-5 py-3">
                  Department
                </th>

                <th className="px-5 py-3">
                  Kiosk
                </th>

                <th className="px-5 py-3">
                  Status
                </th>

              </tr>
            </thead>

            <tbody>

              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    Loading staff…
                  </td>
                </tr>
              )}

              {!loading &&
                filteredUsers.map(
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
                      className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
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
                          user.contact_number
                        )}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          getRoleName(
                            user
                          )
                        )}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          user.position
                        )}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          user.department
                        )}
                      </td>

                      <td className="px-5 py-3 text-slate-600">
                        {displayValue(
                          user.kiosk
                        )}
                      </td>

                      <td className="px-5 py-3">

                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            String(
                              user.status ||
                                ''
                            ).toLowerCase() ===
                            'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {displayValue(
                            user.status
                          )}
                        </span>

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
                  ? 'No staff match your search.'
                  : `No staff found in ${
                      adminDepartment ||
                      'your department'
                    }.`}
              </div>
            )}

        </div>

        {/* PAGINATION */}

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">

          <span>
            Showing{' '}
            {filteredUsers.length}{' '}
            of{' '}
            {users.length}{' '}
            staff
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
                page === 1
              }
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Prev
            </button>

            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5">
              Page {page}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage(
                  (value) =>
                    value + 1
                )
              }
              disabled={
                filteredUsers.length ===
                0
              }
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
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

            <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-[#f5faff] px-5 py-3">

                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Staff Details
                  </h2>

                  <p className="text-[10px] font-semibold text-[#075b9f]">
                    {adminDepartment}
                  </p>
                </div>

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
                    First Name

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
                    Last Name

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
                    Contact Number

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
                      placeholder="Contact number"
                    />
                  </label>

                </div>

                {/* EMAIL */}

                <label className={labelClass}>
                  Email Address

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

                {/* PASSWORD NOTE */}

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-medium text-slate-500">
                    Password
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-400">
                    The existing password is hidden for security. Password changes can be handled separately.
                  </p>
                </div>

                {/* ROLE / POSITION */}

                <div className="grid grid-cols-2 gap-3">

                  <label className={labelClass}>
                    Role

                    <input
                      className={
                        fieldClass
                      }
                      value="Staff"
                      disabled
                    />
                  </label>

                  <label className={labelClass}>
                    Position

                    <select
                      className={
                        fieldClass
                      }
                      value={
                        form.position ||
                        'Null'
                      }
                      onChange={(e) =>
                        updateField(
                          'position',
                          e.target.value
                        )
                      }
                    >
                      <option value="Null">
                        Null
                      </option>

                      <option value="President">
                        President
                      </option>

                      <option value="Vice President">
                        Vice President
                      </option>

                      <option value="Manager">
                        Manager
                      </option>
                    </select>
                  </label>

                </div>

                {/* KIOSK */}

                <label className={labelClass}>
                  Kiosk

                  <input
                    className={
                      fieldClass
                    }
                    value={
                      displayValue(
                        form.kiosk_name
                      )
                    }
                    disabled
                  />

                  <p className="mt-1 text-[10px] text-slate-400">
                    Kiosk is automatically assigned from your department.
                  </p>
                </label>

                {/* DEPARTMENT */}

                <label className={labelClass}>
                  Department

                  <input
                    className={
                      fieldClass
                    }
                    value={
                      displayValue(
                        form.department
                      )
                    }
                    disabled
                  />

                  <p className="mt-1 text-[10px] text-slate-400">
                    Department is automatically assigned from your Admin account.
                  </p>
                </label>

                {/* STATUS */}

                <label className={labelClass}>
                  Status

                  <select
                    className={
                      fieldClass
                    }
                    value={
                      form.status
                    }
                    onChange={(e) =>
                      updateField(
                        'status',
                        e.target.value
                      )
                    }
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </label>

              </div>

              <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-[#f5faff] px-5 py-3">

                <button
                  type="button"
                  onClick={
                    deleteUserRow
                  }
                  disabled={
                    saving
                  }
                  className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2
                    size={13}
                  />
                  Delete Staff
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
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      saveUser
                    }
                    disabled={
                      saving
                    }
                    className="rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {saving
                      ? 'Saving…'
                      : 'Save'}
                  </button>

                </div>

              </footer>

            </section>

          </div>
        )}

      {/* ============================================================
          ADD STAFF MODAL
      ============================================================ */}

      {modal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <section className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-[#f5faff] px-5 py-3">

              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Add New Staff
                </h2>

                <p className="text-[10px] font-semibold text-[#075b9f]">
                  Department: {adminDepartment}
                </p>
              </div>

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
                  First Name

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
                    placeholder="Enter first name"
                  />
                </label>

                <label className={labelClass}>
                  Last Name

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
                    placeholder="Enter last name"
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
                    placeholder="Enter M.I."
                  />
                </label>

                <label className={labelClass}>
                  Contact Number

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
                    placeholder="Enter contact number"
                  />
                </label>

              </div>

              {/* EMAIL */}

              <label className={labelClass}>
                Email Address

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
                  placeholder="Enter staff email"
                />

                <p className="mt-1 text-[10px] text-slate-400">
                  This email is stored in the existing user account.
                </p>
              </label>

              {/* ROLE */}

              <label className={labelClass}>
                Role

                <input
                  className={
                    fieldClass
                  }
                  value="Staff"
                  disabled
                />

                <p className="mt-1 text-[10px] text-slate-400">
                  Staff role is automatically assigned.
                </p>
              </label>

              {/* POSITION */}

              <label className={labelClass}>
                Position

                <select
                  className={
                    fieldClass
                  }
                  value={
                    form.position ||
                    'Null'
                  }
                  onChange={(e) =>
                    updateField(
                      'position',
                      e.target.value
                    )
                  }
                >
                  <option value="Null">
                    Null
                  </option>

                  <option value="President">
                    President
                  </option>

                  <option value="Vice President">
                    Vice President
                  </option>

                  <option value="Manager">
                    Manager
                  </option>
                </select>
              </label>

              {/* KIOSK */}

              <label className={labelClass}>
                Kiosk

                <input
                  className={
                    fieldClass
                  }
                  value={
                    displayValue(
                      form.kiosk_name
                    )
                  }
                  disabled
                />

                <p className="mt-1 text-[10px] text-slate-400">
                  Kiosk is automatically assigned from your department.
                </p>
              </label>

              {/* DEPARTMENT */}

              <label className={labelClass}>
                Department

                <input
                  className={
                    fieldClass
                  }
                  value={
                    displayValue(
                      adminDepartment
                    )
                  }
                  disabled
                />

                <p className="mt-1 text-[10px] text-slate-400">
                  Department is automatically assigned from your Admin account.
                </p>
              </label>

              {/* STATUS */}

              <label className={labelClass}>
                Status

                <select
                  className={
                    fieldClass
                  }
                  value={
                    form.status
                  }
                  onChange={(e) =>
                    updateField(
                      'status',
                      e.target.value
                    )
                  }
                >
                  <option value="Active">
                    Active
                  </option>

                  <option value="Inactive">
                    Inactive
                  </option>
                </select>
              </label>

            </div>

            {/* FOOTER */}

            <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-[#f5faff] px-5 py-3">

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={13} />

                {saving
                  ? 'Adding…'
                  : 'Add This Staff'}
              </button>

            </footer>

          </section>

        </div>
      )}

    </div>
  );
}