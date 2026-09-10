import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  Eye,
  EyeOff,
  Monitor,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { supabase } from '../../../supabase';

const TABLE_NAME = 'user';

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
  department: '',
  status: 'Active',
  password: '',
  confirmPassword: '',
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

function getRoleName(user) {
  if (user?.role?.role) {
    return user.role.role;
  }

  if (user?.role_name) {
    return user.role_name;
  }

  if (user?.roles?.name) {
    return user.roles.name;
  }

  return '';
}

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

function passwordRequirements(password) {
  return {
    length: password.length >= 8,
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export default function StaffManagementPage() {
  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [kiosks, setKiosks] = useState([]);

  const [adminDepartment, setAdminDepartment] =
    useState('');

  const [adminDepartmentRecord, setAdminDepartmentRecord] =
    useState(null);

  const [staffRoleId, setStaffRoleId] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  /*
  |--------------------------------------------------------------------------
  | LOAD ADMIN + STAFF
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadStaffManagement() {
      setLoading(true);
      setError(null);

      try {
        /*
        |--------------------------------------------------------------------------
        | 1. CURRENT AUTH USER
        |--------------------------------------------------------------------------
        */

        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!authUser?.id) {
          throw new Error(
            'You must be logged in.'
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 2. CURRENT ADMIN PROFILE
        |--------------------------------------------------------------------------
        */

        const {
          data: adminProfile,
          error: adminProfileError,
        } = await supabase
          .from(TABLE_NAME)
          .select(`
            user_id,
            first_name,
            last_name,
            email,
            department,
            role_id,
            role:role_id (
              role_id,
              role
            )
          `)
          .eq('user_id', authUser.id)
          .single();

        if (adminProfileError) {
          throw adminProfileError;
        }

        if (!adminProfile) {
          throw new Error(
            'Your user profile could not be found.'
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 3. VERIFY DEPARTMENT ADMIN
        |--------------------------------------------------------------------------
        */

        const adminRole = normalizeRole(
          getRoleName(adminProfile)
        );

        const isDepartmentAdmin =
          adminRole === 'admin' ||
          adminRole === 'deptadmin' ||
          adminRole === 'departmentadmin';

        if (!isDepartmentAdmin) {
          throw new Error(
            'You do not have permission to manage staff.'
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 4. GET ADMIN DEPARTMENT
        |--------------------------------------------------------------------------
        */

        if (!adminProfile.department) {
          throw new Error(
            'Your account is not assigned to a department.'
          );
        }

        const departmentName =
          String(
            adminProfile.department
          ).trim();

        /*
        |--------------------------------------------------------------------------
        | 5. GET DEPARTMENT RECORD
        |--------------------------------------------------------------------------
        */

        const {
          data: departmentRecord,
          error: departmentError,
        } = await supabase
          .from('departments')
          .select(`
            department_id,
            kiosk_id,
            name,
            classification,
            location,
            prefix,
            status,
            est_time
          `)
          .ilike(
            'name',
            departmentName
          )
          .maybeSingle();

        if (departmentError) {
          throw departmentError;
        }

        if (!departmentRecord) {
          throw new Error(
            `The department "${departmentName}" could not be found.`
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 6. GET STAFF ROLE
        |--------------------------------------------------------------------------
        */

        const {
          data: staffRoleData,
          error: staffRoleError,
        } = await supabase
          .from('role')
          .select(
            'role_id, role'
          )
          .ilike(
            'role',
            'Staff'
          )
          .single();

        if (staffRoleError) {
          throw staffRoleError;
        }

        if (!staffRoleData) {
          throw new Error(
            'Staff role was not found.'
          );
        }

        /*
        |--------------------------------------------------------------------------
        | 7. GET ONLY STAFF IN ADMIN DEPARTMENT
        |
        | Super Admin-assigned staff will also appear here automatically
        | as long as:
        |
        | role_id = Staff
        | AND
        | department = Admin's department
        |--------------------------------------------------------------------------
        */

        const {
          data: staffUsers,
          error: staffError,
        } = await supabase
          .from(TABLE_NAME)
          .select(`
            user_id,
            first_name,
            last_name,
            email,
            contact_info,
            kiosk,
            department,
            position,
            status,
            created_at,
            updated_at,
            role_id,
            role:role_id (
              role_id,
              role
            )
          `)
          .eq(
            'role_id',
            staffRoleData.role_id
          )
          .eq(
            'department',
            departmentName
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (staffError) {
          throw staffError;
        }

        /*
        |--------------------------------------------------------------------------
        | 8. GET DEPARTMENT KIOSK
        |--------------------------------------------------------------------------
        */

        let kioskData = [];

        if (departmentRecord.kiosk_id) {
          const {
            data: departmentKiosk,
            error: kioskError,
          } = await supabase
            .from('kiosk')
            .select(
              'kiosk_id, name, status'
            )
            .eq(
              'kiosk_id',
              departmentRecord.kiosk_id
            )
            .maybeSingle();

          if (kioskError) {
            throw kioskError;
          }

          if (departmentKiosk) {
            kioskData = [
              departmentKiosk,
            ];
          }
        }

        /*
        |--------------------------------------------------------------------------
        | 9. SAVE STATE
        |--------------------------------------------------------------------------
        */

        if (cancelled) {
          return;
        }

        setAdminDepartment(
          departmentName
        );

        setAdminDepartmentRecord(
          departmentRecord
        );

        setUsers(
          staffUsers || []
        );

        setRoles([
          staffRoleData,
        ]);

        setStaffRoleId(
          staffRoleData.role_id
        );

        setKiosks(
          kioskData
        );
      } catch (err) {
        if (!cancelled) {
          console.error(
            'Failed to load department staff:',
            err
          );

          setError(
            err?.message ||
              'Failed to load department staff.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStaffManagement();

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
  | FILTER STAFF
  |--------------------------------------------------------------------------
  */

  const filteredUsers = useMemo(() => {
    const searchValue =
      query.trim().toLowerCase();

    if (!searchValue) {
      return users;
    }

    return users.filter(
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
            user.contact_info || ''
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
          fullName.includes(searchValue) ||
          email.includes(searchValue) ||
          contact.includes(searchValue) ||
          position.includes(searchValue) ||
          department.includes(searchValue) ||
          kiosk.includes(searchValue)
        );
      }
    );
  }, [query, users]);

  /*
  |--------------------------------------------------------------------------
  | STATISTICS
  |--------------------------------------------------------------------------
  */

  const stats = useMemo(() => {
    const normalizedRoles =
      users.map((user) =>
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
      users.filter(
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
        `${activeCount}/${users.length}`,

      terminal:
        kiosks.length > 0
          ? kiosks.filter(
              (kiosk) =>
                String(
                  kiosk.status || ''
                ).toLowerCase() ===
                'active'
            ).length
          : 0,
    };
  }, [users, kiosks]);

  /*
  |--------------------------------------------------------------------------
  | OPEN STAFF
  |--------------------------------------------------------------------------
  */

  function openUser(user) {
    /*
    |--------------------------------------------------------------------------
    | KIOSK IS STORED DIRECTLY IN user.kiosk
    |--------------------------------------------------------------------------
    */

    const matchingKiosk =
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

    /*
    |--------------------------------------------------------------------------
    | POSITION NULL MUST DISPLAY AS "Null"
    |--------------------------------------------------------------------------
    */

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

      mi: '',

      contact_number:
        user.contact_info || '',

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
        matchingKiosk?.kiosk_id || '',

      kiosk_name:
        user.kiosk || 'Null',

      department:
        user.department ||
        adminDepartment,

      status:
        user.status || 'Inactive',

      password: '',
      confirmPassword: '',
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
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
    const departmentKiosk =
      adminDepartmentRecord?.kiosk_id
        ? kiosks.find(
            (kiosk) =>
              String(
                kiosk.kiosk_id
              ) ===
              String(
                adminDepartmentRecord.kiosk_id
              )
          )
        : kiosks[0];

    setForm({
      ...EMPTY_FORM,

      role:
        'Staff',

      role_id:
        staffRoleId,

      position:
        'Null',

      kiosk:
        departmentKiosk?.kiosk_id || '',

      kiosk_name:
        departmentKiosk?.name || 'Null',

      department:
        adminDepartment,

      status:
        'Active',
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
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

    setShowPassword(false);
    setShowConfirmPassword(false);
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
  | VALIDATE ADD FORM
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

    const email =
      form.email.trim();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
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

    if (!form.password) {
      return 'Password is required for a new staff account.';
    }

    const requirements =
      passwordRequirements(
        form.password
      );

    if (!requirements.length) {
      return 'Password must be at least 8 characters.';
    }

    if (!requirements.number) {
      return 'Password must contain at least one number.';
    }

    if (!requirements.symbol) {
      return 'Password must contain at least one symbol.';
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      return 'Passwords do not match.';
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | DUPLICATE EMAIL
  |--------------------------------------------------------------------------
  */

  async function checkDuplicateEmail() {
    const normalizedEmail =
      form.email
        .trim()
        .toLowerCase();

    const {
      data,
      error,
    } = await supabase
      .from(TABLE_NAME)
      .select(
        'user_id'
      )
      .ilike(
        'email',
        normalizedEmail
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /*
  |--------------------------------------------------------------------------
  | ADD STAFF
  |
  | IMPORTANT:
  | Auth account creation is handled by:
  |
  | Supabase Edge Function:
  | create-staff-user
  |
  | This prevents the Admin's browser session from being replaced
  | by the newly-created Staff account.
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
      | CHECK EMAIL IN PUBLIC USER TABLE
      |--------------------------------------------------------------------------
      */

      const duplicate =
        await checkDuplicateEmail();

      if (duplicate) {
        throw new Error(
          'This email is already registered. Please use a different email address.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | GET DEPARTMENT KIOSK FROM SUPABASE
      |--------------------------------------------------------------------------
      */

      const {
        data: departmentData,
        error: departmentError,
      } = await supabase
        .from('departments')
        .select(`
          department_id,
          kiosk_id,
          name
        `)
        .eq(
          'department_id',
          adminDepartmentRecord.department_id
        )
        .single();

      if (departmentError) {
        throw departmentError;
      }

      if (
        !departmentData?.kiosk_id
      ) {
        throw new Error(
          'Your department does not have a kiosk assigned.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | GET KIOSK FROM SUPABASE
      |--------------------------------------------------------------------------
      */

      const {
        data: selectedKiosk,
        error: kioskError,
      } = await supabase
        .from('kiosk')
        .select(
          'kiosk_id, name, status'
        )
        .eq(
          'kiosk_id',
          departmentData.kiosk_id
        )
        .single();

      if (kioskError) {
        throw kioskError;
      }

      if (!selectedKiosk) {
        throw new Error(
          'The department kiosk could not be found.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE SUPABASE AUTH ACCOUNT
      |
      | Email + password are sent to Supabase Auth through the
      | Edge Function.
      |--------------------------------------------------------------------------
      */

      const {
        data: authResult,
        error: authFunctionError,
      } = await supabase.functions.invoke(
        'create-staff-user',
        {
          body: {
            email:
              form.email
                .trim()
                .toLowerCase(),

            password:
              form.password,

            first_name:
              form.first_name.trim(),

            last_name:
              form.last_name.trim(),

            contact_info:
              form.contact_number.trim(),

            role_id:
              staffRoleId,

            role:
              'Staff',

            department:
              departmentData.name,

            kiosk:
              selectedKiosk.name,

            position:
              null,

            status:
              form.status,
          },
        }
      );

      if (authFunctionError) {
        throw authFunctionError;
      }

      if (
        !authResult?.user_id
      ) {
        throw new Error(
          'Supabase Auth account could not be created.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | INSERT PUBLIC USER PROFILE
      |
      | Role / kiosk / department / position are NOT taken from
      | editable dropdowns.
      |
      | They come directly from Supabase / Admin assignment.
      |--------------------------------------------------------------------------
      */

      const {
        data: createdUser,
        error: dbError,
      } = await supabase
        .from(TABLE_NAME)
        .insert([
          {
            user_id:
              authResult.user_id,

            first_name:
              form.first_name.trim(),

            last_name:
              form.last_name.trim(),

            email:
              form.email
                .trim()
                .toLowerCase(),

            contact_info:
              form.contact_number.trim(),

            kiosk:
              selectedKiosk.name,

            department:
              departmentData.name,

            position:
              null,

            role_id:
              staffRoleId,

            status:
              form.status,
          },
        ])
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          contact_info,
          kiosk,
          department,
          position,
          status,
          created_at,
          updated_at,
          role_id,
          role:role_id (
            role_id,
            role
          )
        `)
        .single();

      if (dbError) {
        throw dbError;
      }

      /*
      |--------------------------------------------------------------------------
      | ADD TO LOCAL TABLE
      |--------------------------------------------------------------------------
      */

      setUsers((rows) => [
        createdUser,
        ...rows,
      ]);

      closeModal();
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

    if (
      !form.first_name.trim()
    ) {
      setError(
        'First name is required.'
      );
      return;
    }

    if (
      !form.last_name.trim()
    ) {
      setError(
        'Last name is required.'
      );
      return;
    }

    if (
      !form.email.trim()
    ) {
      setError(
        'Email address is required.'
      );
      return;
    }

    if (
      !form.contact_number.trim()
    ) {
      setError(
        'Contact number is required.'
      );
      return;
    }

    if (!adminDepartment) {
      setError(
        'Your department could not be determined.'
      );
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | VERIFY STAFF BELONGS TO ADMIN DEPARTMENT
    |--------------------------------------------------------------------------
    */

    const existingDepartment =
      String(
        modal.user.department || ''
      )
        .trim()
        .toLowerCase();

    const currentAdminDepartment =
      String(
        adminDepartment || ''
      )
        .trim()
        .toLowerCase();

    if (
      existingDepartment !==
      currentAdminDepartment
    ) {
      setError(
        'You can only edit staff belonging to your own department.'
      );
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | POSITION
    |
    | NULL remains NULL.
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
      | FETCH DEPARTMENT AGAIN FROM SUPABASE
      |--------------------------------------------------------------------------
      */

      const {
        data: departmentData,
        error: departmentError,
      } = await supabase
        .from('departments')
        .select(`
          department_id,
          kiosk_id,
          name
        `)
        .eq(
          'department_id',
          adminDepartmentRecord.department_id
        )
        .single();

      if (departmentError) {
        throw departmentError;
      }

      /*
      |--------------------------------------------------------------------------
      | FETCH KIOSK AGAIN FROM SUPABASE
      |--------------------------------------------------------------------------
      */

      let kioskName =
        modal.user.kiosk || null;

      if (
        departmentData?.kiosk_id
      ) {
        const {
          data: kioskData,
          error: kioskError,
        } = await supabase
          .from('kiosk')
          .select(
            'kiosk_id, name'
          )
          .eq(
            'kiosk_id',
            departmentData.kiosk_id
          )
          .single();

        if (kioskError) {
          throw kioskError;
        }

        kioskName =
          kioskData?.name ||
          kioskName;
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE STAFF
      |
      | Department, role and kiosk are fetched from Supabase.
      | They are NOT trusted from the form.
      |--------------------------------------------------------------------------
      */

      const updateData = {
        first_name:
          form.first_name.trim(),

        last_name:
          form.last_name.trim(),

        email:
          form.email
            .trim()
            .toLowerCase(),

        contact_info:
          form.contact_number.trim(),

        kiosk:
          kioskName,

        department:
          departmentData?.name ||
          adminDepartment,

        position:
          positionToSave,

        status:
          form.status,

        updated_at:
          new Date().toISOString(),
      };

      /*
      |--------------------------------------------------------------------------
      | UPDATE ONLY STAFF IN ADMIN DEPARTMENT
      |--------------------------------------------------------------------------
      */

      const {
        data: updatedUser,
        error: updateError,
      } = await supabase
        .from(TABLE_NAME)
        .update(updateData)
        .eq(
          'user_id',
          modal.user.user_id
        )
        .eq(
          'department',
          adminDepartment
        )
        .eq(
          'role_id',
          staffRoleId
        )
        .select(`
          user_id,
          first_name,
          last_name,
          email,
          contact_info,
          kiosk,
          department,
          position,
          status,
          created_at,
          updated_at,
          role_id,
          role:role_id (
            role_id,
            role
          )
        `)
        .single();

      if (updateError) {
        throw updateError;
      }

      if (!updatedUser) {
        throw new Error(
          'Staff member could not be updated.'
        );
      }

      /*
      |--------------------------------------------------------------------------
      | UPDATE LOCAL STATE
      |--------------------------------------------------------------------------
      */

      setUsers((rows) =>
        rows.map((row) =>
          row.user_id ===
          updatedUser.user_id
            ? updatedUser
            : row
        )
      );

      closeModal();
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

    const existingDepartment =
      String(
        modal.user.department || ''
      )
        .trim()
        .toLowerCase();

    const currentAdminDepartment =
      String(
        adminDepartment || ''
      )
        .trim()
        .toLowerCase();

    if (
      existingDepartment !==
      currentAdminDepartment
    ) {
      setError(
        'You can only delete staff belonging to your own department.'
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${form.first_name} ${form.last_name}?`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        error: deleteError,
      } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq(
          'user_id',
          modal.user.user_id
        )
        .eq(
          'department',
          adminDepartment
        )
        .eq(
          'role_id',
          staffRoleId
        );

      if (deleteError) {
        throw deleteError;
      }

      setUsers((rows) =>
        rows.filter(
          (row) =>
            row.user_id !==
            modal.user.user_id
        )
      );

      closeModal();
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
  | PASSWORD CHECKS
  |--------------------------------------------------------------------------
  */

  const passwordChecks =
    passwordRequirements(
      form.password
    );

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
          disabled={!adminDepartment}
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

        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              {adminDepartment
                ? `${adminDepartment} Staff`
                : 'Staff'}
            </h2>

            <p className="mt-1 text-[10px] text-slate-400">
              Staff assigned to this department are fetched from Supabase.
            </p>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
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
                          user.contact_info
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

                {/* ROLE / POSITION */}

                <div className="grid grid-cols-2 gap-3">

                  <label className={labelClass}>
                    Role

                    <input
                      className={
                        fieldClass
                      }
                      value={
                        displayValue(
                          form.role
                        )
                      }
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
                        form.position || 'Null'
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
                    Kiosk is fetched from Supabase.
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
                    Department is fetched from Supabase.
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
                    className="rounded-md border px-4 py-2 text-xs font-semibold"
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
                  This email will be used for Supabase authentication.
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
                  Role is automatically fetched from Supabase.
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
                    form.position || 'Null'
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
                  Kiosk is automatically fetched from your department.
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
                  Department is automatically fetched from your Admin account.
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

              {/* PASSWORD */}

              <label className={labelClass}>
                Password

                <div className="relative mt-1">

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 pr-9 text-xs text-slate-700 outline-none focus:border-[#075b9f]"
                    value={
                      form.password
                    }
                    onChange={(e) =>
                      updateField(
                        'password',
                        e.target.value
                      )
                    }
                    placeholder="Enter password"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) =>
                          !value
                      )
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff
                        size={15}
                      />
                    ) : (
                      <Eye
                        size={15}
                      />
                    )}
                  </button>

                </div>

                <div className="mt-2 space-y-1 text-[10px]">

                  <p
                    className={
                      passwordChecks.length
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }
                  >
                    {passwordChecks.length
                      ? '✓'
                      : '○'}{' '}
                    8 characters minimum
                  </p>

                  <p
                    className={
                      passwordChecks.number
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }
                  >
                    {passwordChecks.number
                      ? '✓'
                      : '○'}{' '}
                    At least one number
                  </p>

                  <p
                    className={
                      passwordChecks.symbol
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }
                  >
                    {passwordChecks.symbol
                      ? '✓'
                      : '○'}{' '}
                    At least one symbol
                  </p>

                </div>

              </label>

              {/* CONFIRM PASSWORD */}

              <label className={labelClass}>
                Confirm Password

                <div className="relative mt-1">

                  <input
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 pr-9 text-xs text-slate-700 outline-none focus:border-[#075b9f]"
                    value={
                      form.confirmPassword
                    }
                    onChange={(e) =>
                      updateField(
                        'confirmPassword',
                        e.target.value
                      )
                    }
                    placeholder="Confirm password"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (value) =>
                          !value
                      )
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff
                        size={15}
                      />
                    ) : (
                      <Eye
                        size={15}
                      />
                    )}
                  </button>

                </div>

                {form.confirmPassword &&
                  form.password !==
                    form.confirmPassword && (
                    <p className="mt-1 text-[10px] text-red-500">
                      Passwords do not match.
                    </p>
                  )}

                {form.confirmPassword &&
                  form.password ===
                    form.confirmPassword && (
                    <p className="mt-1 text-[10px] text-emerald-600">
                      ✓ Passwords match.
                    </p>
                  )}

              </label>

            </div>

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
                  !adminDepartment
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