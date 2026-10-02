import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  PencilLine,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  History,
ListOrdered,
MonitorSmartphone,
UserCog,
  X,
  AlertTriangle,
} from 'lucide-react';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '../../../firebase';
import { getUsers } from '../../services/backendApi';
import AddRoleModal, {
  scopePermissions,
} from '../../components/modals/AddRoleModal';

// =========================================================
// NODE.JS API
// =========================================================

const API_BASE_URL = `${
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
}/api`;

// =========================================================
// DEFAULT ROLE DESCRIPTIONS
// =========================================================

const DEFAULT_ROLE_DESCRIPTIONS = {
  superadmin: 'Full system access and configuration privileges.',
  admin: 'Manage assigned system features and operations.',
  staff: 'Access assigned queue management features.',
};

// =========================================================
// SYSTEM FEATURES
// =========================================================
const FEATURES = [
  // SUPERADMIN
  {
    key: 'dashboard',
    label: 'Dashboard',
    caption: 'Overview and system summary',
    icon: LayoutDashboard,
    availableFor: ['superadmin', 'admin'],
  },
  {
    key: 'user_management',
    label: 'User Management',
    caption: 'Manage user accounts',
    icon: Users,
    availableFor: ['superadmin'],
  },
  {
    key: 'department_management',
    label: 'Department Management',
    caption: 'Manage departments',
    icon: Building2,
    availableFor: ['superadmin'],
  },
  {
    key: 'kiosk_management',
    label: 'Kiosk Management',
    caption: 'Manage kiosk devices',
    icon: MonitorSmartphone,
    availableFor: ['superadmin'],
  },
  {
    key: 'role_management',
    label: 'Role Management',
    caption: 'Manage roles and access',
    icon: ShieldCheck,
    locked: true,
    availableFor: ['superadmin'],
  },
  {
    key: 'positions',
    label: 'Position Management',
    caption: 'Manage staff positions',
    icon: UserCog,
    availableFor: ['superadmin'],
  },
  {
    key: 'queue_management',
    label: 'Queue Management',
    caption: 'Manage queues',
    icon: ListOrdered,
    availableFor: ['superadmin', 'admin'],
  },
  {
    key: 'reports_analytics',
    label: 'Reports and Analytics',
    caption: 'View reports and insights',
    icon: BarChart3,
    availableFor: ['superadmin', 'admin'],
  },
  {
    key: 'settings',
    label: 'Settings',
    caption: 'System preferences',
    icon: Settings,
    availableFor: ['superadmin', 'admin', 'staff'],
  },

  // ADMIN
  {
    key: 'staff_management',
    label: 'Staff Management',
    caption: 'Manage staff members',
    icon: UserCog,
    availableFor: ['admin'],
  },
  {
    key: 'terminal_management',
    label: 'Terminal Management',
    caption: 'Manage service terminals',
    icon: Monitor,
    availableFor: ['admin'],
  },

  // STAFF
  {
    key: 'todays_queue',
    label: "Today's Queue",
    caption: "View and serve today's queue",
    icon: ClipboardList,
    availableFor: ['staff'],
  },
  {
    key: 'queue_history',
    label: 'Queue History',
    caption: 'Review past queue records',
    icon: History,
    availableFor: ['staff'],
  },
];

const FEATURE_KEYS = FEATURES.map((feature) => feature.key);

const LOCKED_KEYS = FEATURES
  .filter((feature) => feature.locked)
  .map((feature) => feature.key);

const AVAILABLE_PERMISSIONS = FEATURE_KEYS.filter(
  (key) => !LOCKED_KEYS.includes(key)
);

// =========================================================
// ROLE HELPERS
// =========================================================

const createEmptyDraft = () => ({
  role: 'staff',
  role_name: '',
  description: '',
  status: 'Active',
  permissions: [],
});

const normalizeStatus = (status) =>
  String(status || 'active').trim().toLowerCase() === 'inactive'
    ? 'Inactive'
    : 'Active';

const toNamespacedPermissions = (permissions, role) => {
  const classification = String(role || 'staff')
    .trim()
    .toLowerCase();

  return (Array.isArray(permissions) ? permissions : []).map(
    (permission) => {
      const feature = String(permission || '').trim().toLowerCase();

      return feature.includes(':')
        ? feature
        : `${classification}:${feature}`;
    }
  );
};

const LEGACY_PERMISSION_MAP = {
  'manage users': 'user_management',
  users: 'user_management',
  user_management: 'user_management',

  'assign staff': 'staff_management',
  'manage staff': 'staff_management',
  staff: 'staff_management',
  staff_management: 'staff_management',

  'manage departments': 'department_management',
  departments: 'department_management',
  department_management: 'department_management',

  'manage kiosks': 'kiosk_management',
  kiosks: 'kiosk_management',
  kiosk_management: 'kiosk_management',

  'manage terminals': 'terminal_management',
  'assign terminals': 'terminal_management',
  terminals: 'terminal_management',
  terminal_management: 'terminal_management',

  'manage queues': 'queue_management',
  'call next patient': 'queue_management',
  'update queue status': 'queue_management',
  queues: 'queue_management',
  queue: 'queue_management',
  queue_management: 'queue_management',

  'view reports': 'reports_analytics',
  reports: 'reports_analytics',
  analytics: 'reports_analytics',
  reports_analytics: 'reports_analytics',

  'modify settings': 'settings',

  positions: 'positions',
  'position management': 'positions',

  roles: 'role_management',
  'role management': 'role_management',
  role_management: 'role_management',

  todays_queue: 'todays_queue',
  "today's queue": 'todays_queue',
  'todays queue': 'todays_queue',

  history: 'queue_history',
  'queue history': 'queue_history',
  queue_history: 'queue_history',
};
function toFeatureKeys(value) {
  const list = Array.isArray(value) ? value : [];
  const keys = new Set();

  list.forEach((entry) => {
    const raw = String(entry || '').trim();
    if (!raw) return;

    const lower = raw.toLowerCase().split(':').pop();

    if (FEATURE_KEYS.includes(lower)) {
      keys.add(lower);
      return;
    }

    const mapped = LEGACY_PERMISSION_MAP[lower];
    if (mapped) keys.add(mapped);
  });

  return FEATURE_KEYS.filter((key) => keys.has(key));
}

function normalizeRolePermissions(value) {
  let permissions = value;

  if (typeof permissions === 'string') {
    try {
      permissions = JSON.parse(permissions);
    } catch {
      permissions = permissions
        .split(',')
        .map((permission) => permission.trim());
    }
  }

  if (!Array.isArray(permissions)) return [];

  return [
    ...new Set(
      permissions
        .map((permission) =>
          String(permission ?? '').trim().toLowerCase()
        )
        .filter(Boolean)
    ),
  ];
}

function isSuperadminRole(classification) {
  return (
    String(classification || '').trim().toLowerCase() === 'superadmin'
  );
}

function effectivePermissions(classification, permissions) {
  const granted = new Set(toFeatureKeys(permissions));

  LOCKED_KEYS.forEach((key) => {
    if (isSuperadminRole(classification)) {
      granted.add(key);
    } else {
      granted.delete(key);
    }
  });

  return FEATURE_KEYS.filter((key) => granted.has(key));
}

function initialsOf(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]);

  return parts.join('').toUpperCase() || '?';
}

function formatRoleDate(value) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeRoleUser(row) {
  const first = row.first_name ?? '';
  const last = row.last_name ?? '';
  const full = row.full_name ?? `${first} ${last}`.trim();

  const roleValue =
    typeof row.role === 'object'
      ? row.role?.role_name ?? row.role?.role ?? ''
      : row.role ?? '';

  const departmentName =
    typeof row.department === 'object'
      ? row.department?.name ?? ''
      : row.department ?? '';

  const positionName =
    typeof row.position === 'object'
      ? row.position?.name ?? ''
      : row.position ?? '';

  return {
    id: row.user_id ?? row.id ?? row.email ?? full,
    name: full,
    email: row.email ?? '',
    roleId: row.role_id ?? null,
    role: roleValue,
    position: positionName,
    department: departmentName,
    status: normalizeStatus(row.status),
  };
}

function usersForRole(users, role) {
  if (!role) return [];

  const roleName = String(role.role_name || role.name || '')
    .trim()
    .toLowerCase();

  return users.filter((user) => {
    if (user.roleId && role.id) {
      return String(user.roleId) === String(role.id);
    }

    return (
      String(user.role || '').trim().toLowerCase() === roleName
    );
  });
}

function getApiErrorMessage(result, fallback) {
  return (
    result?.message ||
    result?.error ||
    fallback
  );
}

// =========================================================
// ROLE MANAGEMENT
// =========================================================

export default function RoleManagement() {
  // =======================================================
  // STATE
  // =======================================================

  const [roles, setRoles] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);

  // Add role
  const [showPermissionDropdown, setShowPermissionDropdown] =
    useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(createEmptyDraft);

  // Edit role
  const [showEditPermissionDropdown, setShowEditPermissionDropdown] =
    useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editDraft, setEditDraft] = useState(createEmptyDraft);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRole, setDeletingRole] = useState(null);

  // Loading and saving
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Assigned users
  const [apiUsers, setApiUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [userQuery, setUserQuery] = useState('');

  // =========================================================
  // API HELPERS
  // =========================================================

  const parseApiResponse = async (response, fallback) => {
    let result = {};

    try {
      result = await response.json();
    } catch {
      throw new Error(
        `The server returned an invalid response. ${fallback}`
      );
    }

    if (!response.ok || result.success === false) {
      throw new Error(getApiErrorMessage(result, fallback));
    }

    return result;
  };

const fetchRolesFromNode = async () => {
  const response = await fetch(`${API_BASE_URL}/roles`);

  const result = await parseApiResponse(
    response,
    'Failed to load roles from MySQL.'
  );

  console.log('RAW ROLES API RESPONSE:', result);

  const data = result.data ?? result.roles ?? result;

  const roleRows = Array.isArray(data)
    ? data
    : Array.isArray(data?.roles)
      ? data.roles
      : Array.isArray(data?.data)
        ? data.data
        : [];

  console.log('NORMALIZED ROLE ROWS:', roleRows);

  return roleRows;
};

const createRoleInNode = async (roleData) => {
  console.log('ROLE BEING SENT TO MYSQL:', {
    role_id: roleData.role_id,
    role: roleData.role,
    role_name: roleData.role_name,
  });
    const response = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role_id: roleData.role_id,
        role: roleData.role,
        role_name: roleData.role_name,
        description: roleData.description,
        status: roleData.status,
        permissions: roleData.permissions,
      }),
    });

    const result = await parseApiResponse(
      response,
      'Failed to create role in MySQL.'
    );

    return result.data;
  };

  const updateRoleInNode = async (roleId, roleData) => {
    const response = await fetch(
      `${API_BASE_URL}/roles/${encodeURIComponent(roleId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_id: roleId,
          role: roleData.role,
          role_name: roleData.role_name,
          description: roleData.description,
          status: roleData.status,
          permissions: roleData.permissions,
        }),
      }
    );

    const result = await parseApiResponse(
      response,
      'Failed to update role in MySQL.'
    );

    return result.data;
  };

  const deleteRoleFromNode = async (roleId) => {
    const response = await fetch(
      `${API_BASE_URL}/roles/${encodeURIComponent(roleId)}`,
      {
        method: 'DELETE',
      }
    );

    return parseApiResponse(
      response,
      'Failed to delete role from MySQL.'
    );
  };

  // =========================================================
  // LOAD ROLES
  // =========================================================

  async function fetchRoles() {
    try {
      setLoading(true);
      setError('');

      const mysqlRoles = await fetchRolesFromNode();

      // Firebase user counts are retained for now.
      const userCounts = {};

      try {
        const usersSnapshot = await getDocs(
          collection(db, 'users')
        );

        usersSnapshot.docs.forEach((userDoc) => {
          const userData = userDoc.data();
          if (!userData.role_id) return;

          const roleId = String(userData.role_id);
          userCounts[roleId] = (userCounts[roleId] || 0) + 1;
        });
      } catch (userError) {
        console.warn(
          'Could not load Firebase user counts:',
          userError
        );
      }

const formattedRoles = mysqlRoles.map((roleData) => {
  const classification = String(
    roleData.role ??
    roleData.role_classification ??
    'staff'
  )
    .trim()
    .toLowerCase();

  const customName = String(
    roleData.role_name ??
    roleData.roleName ??
    roleData.custom_role_name ??
    roleData.name ??
    ''
  ).trim();

  return {
    id: roleData.role_id ?? roleData.id,
    role: classification,
    role_name: customName,
    name: customName,
    description:
      roleData.description ||
      DEFAULT_ROLE_DESCRIPTIONS[classification] ||
      'Custom role with assigned permissions',
    status: normalizeStatus(roleData.status),
    permissions: normalizeRolePermissions(
      roleData.permissions
    ),
    users:
      userCounts[
        String(roleData.role_id ?? roleData.id)
      ] || 0,
    updatedAt:
      roleData.updated_at ??
      roleData.updatedAt ??
      null,
  };
});

console.log('FORMATTED ROLES FOR UI:', formattedRoles);

      setRoles(formattedRoles);

      setSelectedRole((currentSelected) => {
        if (!currentSelected) {
          return formattedRoles[0] || null;
        }

        return (
          formattedRoles.find(
            (role) =>
              String(role.id) === String(currentSelected.id)
          ) ||
          formattedRoles[0] ||
          null
        );
      });
    } catch (err) {
      console.error('Error loading roles:', err);
      setError(err?.message || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchRoleUsers() {
    try {
      setUsersLoading(true);

      const rows = await getUsers();

      setApiUsers(
        (Array.isArray(rows) ? rows : []).map(normalizeRoleUser)
      );
    } catch (userError) {
      console.warn('Could not load users for roles:', userError);
      setApiUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    fetchRoles();
    fetchRoleUsers();
  }, []);

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredRoles = useMemo(() => {
    const searchValue = queryText.trim().toLowerCase();

    if (!searchValue) return roles;

    return roles.filter((role) =>
      [
        role.role_name,
        role.description,
        role.status,
      ].some((value) =>
        String(value || '').toLowerCase().includes(searchValue)
      )
    );
  }, [queryText, roles]);

  // =========================================================
  // SELECT ROLE
  // =========================================================

  const openRole = (role) => {
    setSelectedRole(role);
    setError('');
    setSuccess('');
  };

  // =========================================================
  // RESET FORMS
  // =========================================================

  const resetDraft = () => {
    setDraft(createEmptyDraft());
    setShowPermissionDropdown(false);
  };

  const resetEditDraft = () => {
    setEditDraft(createEmptyDraft());
    setShowEditPermissionDropdown(false);
  };

  const openAddRole = () => {
    resetDraft();
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const closeAddRole = () => {
    if (saving) return;

    setShowForm(false);
    resetDraft();
  };

  // =========================================================
  // ADD ROLE - PERMISSIONS
  // =========================================================

  const togglePermission = (permission) => {
    setDraft((current) => {
      const alreadySelected =
        current.permissions.includes(permission);

      return {
        ...current,
        permissions: alreadySelected
          ? current.permissions.filter(
              (item) => item !== permission
            )
          : [...current.permissions, permission],
      };
    });
  };

  const selectAllPermissions = () => {
    setDraft((current) => ({
      ...current,
      permissions: [...AVAILABLE_PERMISSIONS],
    }));
  };

  const clearAllPermissions = () => {
    setDraft((current) => ({
      ...current,
      permissions: [],
    }));
  };

  // =========================================================
  // EDIT ROLE - PERMISSIONS
  // =========================================================

  const toggleEditPermission = (permission) => {
    setEditDraft((current) => {
      const alreadySelected =
        current.permissions.includes(permission);

      return {
        ...current,
        permissions: alreadySelected
          ? current.permissions.filter(
              (item) => item !== permission
            )
          : [...current.permissions, permission],
      };
    });
  };

  const selectAllEditPermissions = () => {
    setEditDraft((current) => ({
      ...current,
      permissions: [...AVAILABLE_PERMISSIONS],
    }));
  };

  const clearAllEditPermissions = () => {
    setEditDraft((current) => ({
      ...current,
      permissions: [],
    }));
  };

  // =========================================================
  // OPEN / CLOSE EDIT ROLE
  // =========================================================

  const openEditRole = (role) => {
    setEditingRoleId(role.id);

    setEditDraft({
      role: role.role || 'staff',
      role_name: role.role_name || '',
      description: role.description || '',
      status: role.status || 'Active',
      permissions: scopePermissions(
        role.role || 'staff',
        role.permissions || [],
        FEATURES
      ),
    });

    setShowEditPermissionDropdown(false);
    setShowEditModal(true);
    setError('');
    setSuccess('');
  };

  const closeEditRole = () => {
    if (saving) return;

    setShowEditModal(false);
    setEditingRoleId(null);
    resetEditDraft();
  };

  // =========================================================
  // CREATE ROLE
  // =========================================================

  const handleCreate = async () => {
    const roleClassification = String(draft.role || '')
      .trim()
      .toLowerCase();

    const roleName = String(draft.role_name || '').trim();
    const description = String(draft.description || '').trim();

    if (
      !['superadmin', 'admin', 'staff'].includes(
        roleClassification
      )
    ) {
      setError('Please select a valid role classification.');
      return;
    }

    if (!roleName) {
      setError('Custom role name is required.');
      return;
    }

    if (!Array.isArray(draft.permissions) ||
        draft.permissions.length === 0) {
      setError('Please select at least one permission.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const roleRef = doc(collection(db, 'roles'));
      const roleId = roleRef.id;

      const roleDescription =
        description ||
        DEFAULT_ROLE_DESCRIPTIONS[roleClassification] ||
        'Custom role with assigned permissions';

      const permissions = toNamespacedPermissions(
        draft.permissions,
        roleClassification
      );

      const roleData = {
        role_id: roleId,
        role: roleClassification,
        role_name: roleName,
        description: roleDescription,
        status: normalizeStatus(draft.status),
        permissions,
      };

      // Create in MySQL first, then Firebase.
      // This avoids a Firebase record remaining when MySQL rejects it.
      await createRoleInNode(roleData);

      try {
        await setDoc(roleRef, {
          ...roleData,
          created_at: serverTimestamp(),
        });
      } catch (firebaseError) {
        console.error(
          'Firebase creation failed after MySQL creation:',
          firebaseError
        );

        throw new Error(
          'The role was created in MySQL, but Firebase creation failed. Please check both databases before retrying.'
        );
      }

      const createdRole = {
        id: roleId,
        role: roleClassification,
        role_name: roleName,
        name: roleName,
        description: roleDescription,
        status: normalizeStatus(draft.status),
        permissions,
        users: 0,
        updatedAt: null,
      };

      setRoles((currentRoles) => [
        createdRole,
        ...currentRoles,
      ]);

      setSelectedRole(createdRole);
      closeAddRole();

      setSuccess(
        'Role created successfully in Firebase and MySQL.'
      );
    } catch (err) {
      console.error('Error creating role:', err);
      setError(err?.message || 'Failed to create role.');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // UPDATE ROLE
  // =========================================================

  const handleUpdateRole = async () => {
    const roleClassification = String(editDraft.role || '')
      .trim()
      .toLowerCase();

    const roleName = String(editDraft.role_name || '').trim();
    const description = String(
      editDraft.description || ''
    ).trim();

    if (!editingRoleId) {
      setError('No role was selected for editing.');
      return;
    }

    if (
      !['superadmin', 'admin', 'staff'].includes(
        roleClassification
      )
    ) {
      setError('Please select a valid role classification.');
      return;
    }

    if (!roleName) {
      setError('Custom role name is required.');
      return;
    }

    if (!Array.isArray(editDraft.permissions) ||
        editDraft.permissions.length === 0) {
      setError('Please select at least one permission.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const roleDescription =
        description ||
        DEFAULT_ROLE_DESCRIPTIONS[roleClassification] ||
        'Custom role with assigned permissions';

      const permissions = toNamespacedPermissions(
        editDraft.permissions,
        roleClassification
      );

      const roleData = {
        role_id: editingRoleId,
        role: roleClassification,
        role_name: roleName,
        description: roleDescription,
        status: normalizeStatus(editDraft.status),
        permissions,
      };

      const roleRef = doc(
        db,
        'roles',
        editingRoleId
      );

      const oldRole = roles.find(
        (role) =>
          String(role.id) === String(editingRoleId)
      );

      // Update MySQL first. The backend must check duplicate
      // role_name values while excluding this role_id.
      await updateRoleInNode(editingRoleId, roleData);

      try {
        await setDoc(
          roleRef,
          {
            ...roleData,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (firebaseError) {
        console.error(
          'Firebase update failed after MySQL update:',
          firebaseError
        );

        throw new Error(
          'The role was updated in MySQL, but Firebase update failed. Please check both databases.'
        );
      }

      const updatedRole = {
        id: editingRoleId,
        role: roleClassification,
        role_name: roleName,
        name: roleName,
        description: roleDescription,
        status: normalizeStatus(editDraft.status),
        permissions,
        users: oldRole?.users ?? 0,
        updatedAt: new Date().toISOString(),
      };

      setRoles((currentRoles) =>
        currentRoles.map((role) =>
          String(role.id) === String(editingRoleId)
            ? updatedRole
            : role
        )
      );

      setSelectedRole(updatedRole);

      setShowEditModal(false);
      setEditingRoleId(null);
      resetEditDraft();

      setSuccess(
        'Role updated successfully in Firebase and MySQL.'
      );
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err?.message || 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE ROLE
  // =========================================================

  const openDeleteConfirmation = (role) => {
    if (!role) return;

    const assignedCount = usersLoading
      ? role.users || 0
      : usersForRole(apiUsers, role).length;

    if (assignedCount > 0) {
      setError(
        `Cannot delete ${role.name} because ${assignedCount} user${
          assignedCount === 1 ? '' : 's'
        } are assigned to this role.`
      );
      return;
    }

    setDeletingRole(role);
    setShowDeleteModal(true);
    setError('');
    setSuccess('');
  };

  const closeDeleteConfirmation = () => {
    if (deleting) return;

    setShowDeleteModal(false);
    setDeletingRole(null);
  };

  const handleDelete = async () => {
    if (!deletingRole) return;

    const roleId = deletingRole.id;

    try {
      setDeleting(true);
      setError('');
      setSuccess('');

      await deleteRoleFromNode(roleId);

      try {
        await deleteDoc(doc(db, 'roles', roleId));
      } catch (firebaseError) {
        console.error(
          'Firebase delete failed after MySQL delete:',
          firebaseError
        );

        throw new Error(
          'Role was deleted from MySQL, but Firebase deletion failed. Please check Firebase.'
        );
      }

      const remainingRoles = roles.filter(
        (role) => String(role.id) !== String(roleId)
      );

      setRoles(remainingRoles);

      if (
        String(selectedRole?.id) === String(roleId)
      ) {
        setSelectedRole(remainingRoles[0] || null);
      }

      setShowDeleteModal(false);
      setDeletingRole(null);

      setSuccess(
        'Role deleted successfully from Firebase and MySQL.'
      );
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err?.message || 'Failed to delete role.');
    } finally {
      setDeleting(false);
    }
  };

  // =========================================================
  // DETAIL PANE VALUES
  // =========================================================

  const grantedFeatures = effectivePermissions(
    selectedRole?.role,
    selectedRole?.permissions
  );
const availableFeatures = FEATURES.filter((feature) =>
  feature.availableFor.includes(
    selectedRole?.role || ''
  )
);

const enabledFeatureCount = availableFeatures.filter(
  (feature) => grantedFeatures.includes(feature.key)
).length;
  const assignedUsers = usersForRole(
    apiUsers,
    selectedRole
  );

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-5">
      {/* HEADER */}

      <div className="flex items-end justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">
            Role Management
          </h1>
          <p className="mt-0.5 text-xs text-[#4B5563]">
            Configure access levels and user permissions across the queuing
            system.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddRole}
          className="swu-press flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
        >
          <Plus size={14} />
          Add Role
        </button>
      </div>

      {/* MESSAGES */}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">
          <AlertTriangle
            size={14}
            className="mt-0.5 shrink-0"
          />
          <div>
            {error}
            <button
              type="button"
              onClick={fetchRoles}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-[#86EFAC] bg-[#E8F8F0] px-4 py-3 text-xs text-[#0D8A4E]">
          <Check
            size={14}
            className="mt-0.5 shrink-0"
          />
          {success}
        </div>
      )}

      {/* ROLE LIST + DETAIL */}

      <div className="grid min-h-[620px] grid-cols-[minmax(300px,26%)_minmax(0,1fr)] gap-5">
        {/* ROLE LIST */}

        <section className="swu-enter flex flex-col gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={queryText}
              onChange={(event) =>
                setQueryText(event.target.value)
              }
              placeholder="Search roles"
              aria-label="Search roles"
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-xs text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {loading && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-10 text-center text-xs text-[#9CA3AF]">
              Loading roles...
            </div>
          )}

          {!loading && filteredRoles.length === 0 && (
            <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-10 text-center text-xs text-[#9CA3AF]">
              {roles.length === 0
                ? 'No roles yet.'
                : 'No roles found.'}
            </div>
          )}

          <div className="swu-stagger space-y-2.5">
            {!loading &&
              filteredRoles.map((role) => {
                const active =
                  String(selectedRole?.id) === String(role.id);

                const count = usersLoading
                  ? role.users
                  : usersForRole(apiUsers, role).length;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => openRole(role)}
                    className={`swu-card flex w-full items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                      active
                        ? 'border-[#9D0A0E] bg-[#FBF1F1] shadow-sm'
                        : 'border-[#E5E7EB] bg-white hover:border-[#F0DADA] hover:shadow-sm'
                    }`}
                  >
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-xs font-bold ${
                          active
                            ? 'text-[#9D0A0E]'
                            : 'text-[#1F2937]'
                        }`}
                      >
                        {role.role_name}
                      </span>

                      <span className="mt-0.5 block truncate text-xs text-[#4B5563]">
                        {role.description}
                      </span>

                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
                        <Users size={11} />
                        {count ?? '--'} user
                        {count === 1 ? '' : 's'}
                      </span>
                    </span>

                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        role.status === 'Active'
                          ? 'bg-[#E8F8F0] text-[#0D8A4E]'
                          : 'bg-[#F1F3F5] text-[#6B7280]'
                      }`}
                    >
                      {role.status}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>

        {/* ROLE DETAIL */}

        <section className="swu-enter overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {selectedRole ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-[#1F2937]">
                    {selectedRole.role_name}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">
                    {selectedRole.status} role
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditRole(selectedRole)}
                    className="swu-press inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-xs font-medium text-[#4B5563] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
                  >
                    <PencilLine size={12} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openDeleteConfirmation(selectedRole)
                    }
                    aria-label="Delete role"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#9D0A0E] transition hover:border-[#F0DADA] hover:bg-[#FBF1F1]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-lg bg-[#F8F9FA] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    Description
                  </p>
                  <p className="mt-1 text-xs text-[#1F2937]">
                    {selectedRole.description || '--'}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] gap-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#1F2937]">
                          Feature Access
                        </h3>
                        <p className="mt-0.5 text-xs text-[#9CA3AF]">
                          Select which system features this role can access.
                        </p>
                      </div>

                      <span className="shrink-0 rounded-md bg-[#FBF1F1] px-2 py-0.5 text-xs font-medium text-[#9D0A0E]">
                        {grantedFeatures.length} of {FEATURES.length}{' '}
                        features enabled
                      </span>
                    </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
  {availableFeatures.map((feature) => (
    <FeatureCard
      key={feature.key}
      feature={feature}
      enabled={grantedFeatures.includes(feature.key)}
    />
  ))}
</div>
                  </div>

                  {/* SUMMARY */}

                  <aside className="h-fit rounded-lg border border-[#E5E7EB] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                      Summary
                    </p>

                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#4B5563]">
                          Assigned users
                        </span>

                        <span className="flex items-center gap-1.5">
                          <AvatarStack users={assignedUsers} />
                          <span className="text-xs font-semibold text-[#1F2937]">
                            {usersLoading
                              ? '--'
                              : assignedUsers.length}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#4B5563]">
                          Features enabled
                        </span>
                        <span className="text-xs font-semibold text-[#1F2937]">
                          {grantedFeatures.length} of {FEATURES.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#4B5563]">
                          Module
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#FBF1F1] px-2 py-0.5 text-xs font-medium text-[#9D0A0E]">
                          <ClipboardList size={10} />
                          Queue System
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#4B5563]">
                          Last updated
                        </span>
                        <span className="text-xs font-semibold text-[#1F2937]">
                          {formatRoleDate(selectedRole.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUserQuery('');
                        setShowUsersModal(true);
                      }}
                      className="mt-4 flex w-full items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3 text-xs font-medium text-[#9D0A0E] transition hover:text-[#7D080B]"
                    >
                      View assigned users
                      <ChevronRight size={12} />
                    </button>
                  </aside>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[620px] flex-col items-center justify-center gap-2 px-6 text-center">
              <ShieldCheck
                size={22}
                className="text-[#D1D5DB]"
              />
              <p className="text-xs text-[#9CA3AF]">
                {loading
                  ? 'Loading roles...'
                  : roles.length === 0
                    ? 'No roles yet. Use Add Role to create one.'
                    : 'Select a role to view its access.'}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ADD ROLE MODAL */}

      {showForm && (
        <AddRoleModal
          open={showForm}
          draft={draft}
          setDraft={setDraft}
          onToggle={togglePermission}
          onSelectAll={selectAllPermissions}
          onClearAll={clearAllPermissions}
          onClose={closeAddRole}
          onSave={handleCreate}
          saving={saving}
          features={FEATURES}
          availablePermissions={AVAILABLE_PERMISSIONS}
          effectivePermissions={effectivePermissions}
        />
      )}

      {/* EDIT ROLE MODAL */}

      {showEditModal && (
        <AddRoleModal
          mode="edit"
          open={showEditModal}
          draft={editDraft}
          setDraft={setEditDraft}
          onToggle={toggleEditPermission}
          onSelectAll={selectAllEditPermissions}
          onClearAll={clearAllEditPermissions}
          onClose={closeEditRole}
          onSave={handleUpdateRole}
          saving={saving}
          features={FEATURES}
          availablePermissions={AVAILABLE_PERMISSIONS}
          effectivePermissions={effectivePermissions}
        />
      )}

      {/* DELETE ROLE MODAL */}

      {showDeleteModal && deletingRole && (
        <DeleteRoleModal
          role={deletingRole}
          assignedCount={
            usersLoading
              ? deletingRole.users || 0
              : usersForRole(apiUsers, deletingRole).length
          }
          onCancel={closeDeleteConfirmation}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      {/* ASSIGNED USERS MODAL */}

      {showUsersModal && selectedRole && (
        <AssignedUsersModal
          role={selectedRole}
          users={assignedUsers}
          loading={usersLoading}
          query={userQuery}
          setQuery={setUserQuery}
          onClose={() => setShowUsersModal(false)}
        />
      )}
    </div>
  );
}

// =========================================================
// FEATURE CARD
// =========================================================

function FeatureCard({ feature, enabled }) {
  const Icon = feature.icon;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all duration-200 ${
        enabled
          ? 'border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:shadow-sm'
          : 'border-transparent bg-[#F8F9FA]'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          enabled
            ? 'bg-[#FBF1F1] text-[#9D0A0E]'
            : 'bg-[#F1F3F5] text-[#9CA3AF]'
        }`}
      >
        <Icon size={13} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-xs font-semibold ${
            enabled ? 'text-[#1F2937]' : 'text-[#9CA3AF]'
          }`}
        >
          {feature.label}
        </span>
        <span className="block truncate text-xs text-[#9CA3AF]">
          {feature.caption}
        </span>
      </span>

      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          enabled
            ? 'bg-[#9D0A0E] text-white'
            : 'bg-[#E5E7EB] text-[#9CA3AF]'
        }`}
      >
        {enabled ? (
          <Check size={9} strokeWidth={3} />
        ) : (
          <X size={9} strokeWidth={3} />
        )}
      </span>

      <span className="sr-only">
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

// =========================================================
// AVATAR STACK
// =========================================================

function AvatarStack({ users }) {
  const shown = users.slice(0, 4);

  if (shown.length === 0) return null;

  return (
    <span className="flex -space-x-1.5" aria-hidden="true">
      {shown.map((user) => (
        <span
          key={user.id}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#E4EAF4] text-[9px] font-semibold text-[#3E4A61]"
        >
          {initialsOf(user.name)}
        </span>
      ))}
    </span>
  );
}

// =========================================================
// DELETE ROLE MODAL
// =========================================================

function DeleteRoleModal({
  role,
  assignedCount,
  onCancel,
  onConfirm,
  deleting,
}) {
  const blocked = assignedCount > 0;

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-role-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="relative px-7 pb-5 pt-7 text-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:opacity-50"
          >
            <X size={16} />
          </button>

          <h2
            id="delete-role-title"
            className="text-lg font-bold text-[#1F2937]"
          >
            Delete Role?
          </h2>

          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#4B5563]">
            Are you sure you want to delete the{' '}
            <span className="font-semibold text-[#1F2937]">
              {role.role_name || role.name}
            </span>{' '}
            role? This action cannot be undone.
          </p>

          {blocked && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-left text-xs leading-5 text-[#4B5563]">
              <AlertTriangle
                size={13}
                className="mt-0.5 shrink-0 text-[#9D0A0E]"
              />
              <span>
                <span className="font-semibold text-[#1F2937]">
                  {assignedCount} user
                  {assignedCount === 1 ? ' is' : 's are'}
                </span>{' '}
                currently assigned to this role. Please reassign
                {assignedCount === 1
                  ? ' this user'
                  : ' these users'}{' '}
                before deleting the role.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-7 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || blocked}
            title={
              blocked
                ? 'Reassign the users on this role first.'
                : undefined
            }
            className="swu-press rounded-lg bg-[#9D0A0E] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {deleting ? 'Deleting...' : 'Delete Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// ASSIGNED USERS MODAL
// =========================================================

function AssignedUsersModal({
  role,
  users,
  loading,
  query,
  setQuery,
  onClose,
}) {
  const search = query.trim().toLowerCase();

  const shown = search
    ? users.filter((user) =>
        [
          user.name,
          user.email,
          user.position,
          user.department,
        ].some((value) =>
          String(value || '').toLowerCase().includes(search)
        )
      )
    : users;

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assigned-users-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
              <ShieldCheck size={15} />
            </span>

            <div className="min-w-0">
              <h2
                id="assigned-users-title"
                className="text-base font-bold text-[#1F2937]"
              >
                Assigned Users
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                {loading
                  ? 'Loading users...'
                  : `${users.length} user${
                      users.length === 1 ? '' : 's'
                    } ${
                      users.length === 1 ? 'has' : 'have'
                    } the ${
                      role.role_name || role.name
                    } role.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="shrink-0 px-5 pt-4">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
              className="h-9 w-full rounded-lg border border-[#E5E7EB] pl-9 pr-3 text-xs text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {shown.length === 0 ? (
            <div className="px-3 py-10 text-center text-xs text-[#9CA3AF]">
              {loading
                ? 'Loading users...'
                : users.length === 0
                  ? 'No users have this role yet.'
                  : 'No users match that search.'}
            </div>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    User
                  </th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    Position
                  </th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    Department
                  </th>
                  <th className="px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {shown.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[#F1F3F5] last:border-b-0 hover:bg-[#F8F9FA]"
                  >
                    <td className="px-2 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E4EAF4] text-[11px] font-semibold text-[#3E4A61]"
                        >
                          {initialsOf(user.name)}
                        </span>

                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[#1F2937]">
                            {user.name || '--'}
                          </span>
                          <span className="block truncate text-xs text-[#9CA3AF]">
                            {user.email || '--'}
                          </span>
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-2.5 text-xs text-[#4B5563]">
                      {user.position || '--'}
                    </td>

                    <td className="px-2 py-2.5 text-xs text-[#4B5563]">
                      {user.department || '--'}
                    </td>

                    <td className="px-2 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          user.status === 'Active'
                            ? 'text-[#0D8A4E]'
                            : 'text-[#9CA3AF]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.status === 'Active'
                              ? 'bg-[#0D8A4E]'
                              : 'bg-[#9CA3AF]'
                          }`}
                        />
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <span className="text-xs text-[#9CA3AF]">
            Showing {shown.length} of {users.length} users
          </span>

          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-5 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}