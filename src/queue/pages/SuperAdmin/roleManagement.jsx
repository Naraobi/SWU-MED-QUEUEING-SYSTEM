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

// =========================================================
// NODE.JS API
// =========================================================

const API_BASE_URL =
  `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

// =========================================================
// AVAILABLE PERMISSIONS
// =========================================================

// =========================================================
// SYSTEM FEATURES
//
// A role is a set of system features it may open. The keys below are what
// gets stored in the role's `permissions` column, so the list doubles as the
// vocabulary for that column - no schema change, only different values in it.
// =========================================================

const FEATURES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    caption: 'Overview & metrics',
    icon: LayoutDashboard,
  },
  {
    key: 'staff',
    label: 'Staff Management',
    caption: 'See and manage Staff',
    icon: Users,
  },
  {
    key: 'settings',
    label: 'Settings',
    caption: 'Global Configuration',
    icon: Settings,
  },
  {
    key: 'terminals',
    label: 'Terminal Management',
    caption: 'Touch terminals & printers',
    icon: Monitor,
  },
  {
    key: 'roles',
    label: 'Role Management',
    caption: 'Restricted to Superadmin',
    icon: ShieldCheck,
    locked: true,
  },
  {
    key: 'positions',
    label: 'Position Management',
    caption: 'Designation assignment',
    icon: BriefcaseBusiness,
    locked: true,
  },
  {
    key: 'queues',
    label: 'Queue Management',
    caption: 'Live ticket & window monitor',
    icon: ClipboardList,
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    caption: 'Queue trends & wait times',
    icon: BarChart3,
  },
  {
    key: 'departments',
    label: 'Department Management',
    caption: 'Manage departments & services',
    icon: Building2,
  },
];

const FEATURE_KEYS = FEATURES.map((feature) => feature.key);

// Locked features belong to Superadmin only, so they are never toggled from
// this screen - they read as enabled for Superadmin and disabled elsewhere.
const LOCKED_KEYS = FEATURES.filter((f) => f.locked).map((f) => f.key);

// What Select All can actually reach.
const AVAILABLE_PERMISSIONS = FEATURE_KEYS.filter(
  (key) => !LOCKED_KEYS.includes(key)
);

/*
 * Rows saved before this screen used feature keys hold sentences like
 * "Manage queues". Mapping them forward means an existing role still lights
 * up correctly instead of reading as "0 of 9 features enabled" until someone
 * opens and re-saves it.
 */
const LEGACY_PERMISSION_MAP = {
  'manage users': 'staff',
  'assign staff': 'staff',
  'manage departments': 'departments',
  'manage kiosks': 'terminals',
  'assign terminals': 'terminals',
  'manage queues': 'queues',
  'call next patient': 'queues',
  'update queue status': 'queues',
  'view reports': 'reports',
  'modify settings': 'settings',
};

/*
 * Accepts whatever is in the permissions column - feature keys, legacy
 * sentences, or a mix - and returns clean feature keys with no duplicates.
 */
function toFeatureKeys(value) {
  const list = Array.isArray(value) ? value : [];
  const keys = new Set();

  list.forEach((entry) => {
    const raw = String(entry || '').trim();
    if (!raw) return;

    const lower = raw.toLowerCase();

    if (FEATURE_KEYS.includes(lower)) {
      keys.add(lower);
      return;
    }

    const mapped = LEGACY_PERMISSION_MAP[lower];
    if (mapped) keys.add(mapped);
  });

  return FEATURE_KEYS.filter((key) => keys.has(key));
}

/*
 * The two locked features follow the role name rather than the stored
 * permissions, so "Restricted to Superadmin" is true rather than decorative.
 */
function isSuperadminRole(name) {
  return String(name || '').trim().toLowerCase() === 'superadmin';
}

function effectivePermissions(roleName, permissions) {
  const granted = new Set(toFeatureKeys(permissions));

  LOCKED_KEYS.forEach((key) => {
    if (isSuperadminRole(roleName)) {
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

/*
 * Users come from GET /api/users. There is no roles/:id/users endpoint, so
 * membership is matched on role_id where the row has one and on the role name
 * otherwise. FOR THE BACKEND TEAM: a users-by-role endpoint would make this
 * exact rather than best-effort.
 */
function normalizeRoleUser(row) {
  const first = row.first_name ?? '';
  const last = row.last_name ?? '';
  const full = row.full_name ?? `${first} ${last}`.trim();

  const roleName =
    typeof row.role === 'object' ? row.role?.role ?? '' : row.role ?? '';

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
    role: roleName,
    position: positionName,
    department: departmentName,
    status:
      String(row.status ?? 'active').toLowerCase() === 'inactive'
        ? 'Inactive'
        : 'Active',
  };
}

function usersForRole(users, role) {
  if (!role) return [];

  const name = String(role.name || '').trim().toLowerCase();

  return users.filter((user) => {
    if (user.roleId && role.id) return String(user.roleId) === String(role.id);
    return String(user.role || '').trim().toLowerCase() === name;
  });
}


// =========================================================
// DEFAULT ROLE DESCRIPTIONS
// =========================================================

const DEFAULT_ROLE_DESCRIPTIONS = {
  Superadmin:
    'Full platform access and administrative control',

  Admin:
    'Department and queue oversight with limited global settings',

  Staff:
    'Handles queue operations and daily service tasks',
};

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

  // Add Role
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Edit Role
  const [showEditPermissionDropdown, setShowEditPermissionDropdown] =
  useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRole, setDeletingRole] = useState(null);

  // Add Role form
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    status: 'Active',
    permissions: [],
  });

  // Edit Role form
  const [editDraft, setEditDraft] = useState({
    name: '',
    description: '',
    status: 'Active',
    permissions: [],
  });

  // Loading / saving
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /*
   * Users for this screen. The role rows carry their own count, but the
   * Summary panel and the assigned-users list need the people themselves,
   * so they are loaded once here and filtered per role.
   */
  const [apiUsers, setApiUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [userQuery, setUserQuery] = useState('');

  // =========================================================
  // NODE.JS API HELPERS
  // =========================================================

  // ---------------------------------------------------------
  // GET ROLES FROM MYSQL THROUGH NODE.JS
  // ---------------------------------------------------------

  const fetchRolesFromNode = async () => {
    const response = await fetch(`${API_BASE_URL}/roles`);

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to load roles from MySQL.'
      );
    }

    return result.data || [];
  };

  // ---------------------------------------------------------
  // CREATE ROLE IN MYSQL THROUGH NODE.JS
  // ---------------------------------------------------------

  const createRoleInNode = async (roleData) => {
    const response = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roleData),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to create role in MySQL.'
      );
    }

    return result.data;
  };

  // ---------------------------------------------------------
  // UPDATE ROLE IN MYSQL THROUGH NODE.JS
  // ---------------------------------------------------------

  const updateRoleInNode = async (roleId, roleData) => {
    const response = await fetch(
      `${API_BASE_URL}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to update role in MySQL.'
      );
    }

    return result.data;
  };

  // ---------------------------------------------------------
  // DELETE ROLE FROM MYSQL THROUGH NODE.JS
  // ---------------------------------------------------------

  const deleteRoleFromNode = async (roleId) => {
    const response = await fetch(
      `${API_BASE_URL}/roles/${roleId}`,
      {
        method: 'DELETE',
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Failed to delete role from MySQL.'
      );
    }

    return result;
  };

  // =========================================================
  // LOAD ROLES
  // =========================================================

  async function fetchRoles() {
    try {
      setLoading(true);
      setError('');

      // -----------------------------------------------------
      // GET ROLES FROM NODE / MYSQL
      // -----------------------------------------------------

      const mysqlRoles = await fetchRolesFromNode();

      // -----------------------------------------------------
      // GET USERS FROM FIREBASE
      //
      // We are temporarily keeping user counts in Firebase.
      // This can later be moved to MySQL when users are migrated.
      // -----------------------------------------------------

      let userCounts = {};

      try {
        const usersSnapshot = await getDocs(
          collection(db, 'users')
        );

        usersSnapshot.docs.forEach((userDoc) => {
          const userData = userDoc.data();

          if (!userData.role_id) {
            return;
          }

          userCounts[userData.role_id] =
            (userCounts[userData.role_id] || 0) + 1;
        });
      } catch (userError) {
        console.warn(
          'Could not load Firebase user counts:',
          userError
        );
      }

      // -----------------------------------------------------
      // FORMAT MYSQL ROLES FOR THE UI
      // -----------------------------------------------------

      const formattedRoles = mysqlRoles.map((roleData) => {
        let permissions = roleData.permissions;

        if (typeof permissions === 'string') {
          try {
            permissions = JSON.parse(permissions);
          } catch (parseError) {
            permissions = [];
          }
        }

        if (!Array.isArray(permissions)) {
          permissions = [];
        }

        // Legacy rows hold sentences like "Manage queues"; map them onto
        // feature keys so an existing role is not shown as having none.
        permissions = toFeatureKeys(permissions);

        return {
          id: roleData.role_id,

          name: roleData.role || '',

          description:
            roleData.description ||
            DEFAULT_ROLE_DESCRIPTIONS[roleData.role] ||
            'Custom role with assigned permissions',

          status: roleData.status || 'Active',

          permissions,

          users: userCounts[roleData.role_id] || 0,

          updatedAt:
            roleData.updated_at ?? roleData.updatedAt ?? null,
        };
      });

      setRoles(formattedRoles);

      // -----------------------------------------------------
      // KEEP SELECTED ROLE
      // -----------------------------------------------------

      setSelectedRole((currentSelected) => {
        if (!currentSelected) {
          return formattedRoles[0] || null;
        }

        return (
          formattedRoles.find(
            (role) => role.id === currentSelected.id
          ) ||
          formattedRoles[0] ||
          null
        );
      });
    } catch (err) {
      console.error(
        'Error loading roles:',
        err
      );

      setError(
        err?.message ||
          'Failed to load roles.'
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  async function fetchRoleUsers() {
    try {
      setUsersLoading(true);

      const rows = await getUsers();
      setApiUsers((Array.isArray(rows) ? rows : []).map(normalizeRoleUser));
    } catch (userError) {
      // Not fatal: the page still works, the counts just fall back to the
      // number the role row reported.
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
    const searchValue = queryText
      .trim()
      .toLowerCase();

    if (!searchValue) {
      return roles;
    }

    return roles.filter((role) =>
      [
        role.name,
        role.description,
        role.status,
      ].some((value) =>
        String(value)
          .toLowerCase()
          .includes(searchValue)
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
  // RESET ADD FORM
  // =========================================================

  const resetDraft = () => {
    setDraft({
      name: '',
      description: '',
      status: 'Active',
      permissions: [],
    });

    setShowPermissionDropdown(false);
  };

  // =========================================================
  // RESET EDIT FORM
  // =========================================================

  const resetEditDraft = () => {
    setEditDraft({
      name: '',
      description: '',
      status: 'Active',
      permissions: [],
    });

    setShowEditPermissionDropdown(false);
  };

  // =========================================================
  // ADD ROLE - TOGGLE PERMISSION
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
          : [
              ...current.permissions,
              permission,
            ],
      };
    });
  };

  // =========================================================
  // EDIT ROLE - TOGGLE PERMISSION
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
          : [
              ...current.permissions,
              permission,
            ],
      };
    });
  };

  // =========================================================
  // ADD ROLE - SELECT ALL
  // =========================================================

  const selectAllPermissions = () => {
    setDraft((current) => ({
      ...current,
      permissions: [
        ...AVAILABLE_PERMISSIONS,
      ],
    }));
  };

  // =========================================================
  // ADD ROLE - CLEAR ALL
  // =========================================================

  const clearAllPermissions = () => {
    setDraft((current) => ({
      ...current,
      permissions: [],
    }));
  };

  // =========================================================
  // EDIT ROLE - SELECT ALL
  // =========================================================

  const selectAllEditPermissions = () => {
    setEditDraft((current) => ({
      ...current,
      permissions: [
        ...AVAILABLE_PERMISSIONS,
      ],
    }));
  };

  // =========================================================
  // EDIT ROLE - CLEAR ALL
  // =========================================================

  const clearAllEditPermissions = () => {
    setEditDraft((current) => ({
      ...current,
      permissions: [],
    }));
  };

  // =========================================================
  // OPEN EDIT ROLE
  // =========================================================

  const openEditRole = (role) => {
    setEditingRoleId(role.id);

    setEditDraft({
      name: role.name,
      description: role.description,
      status: role.status,
      permissions: [
        ...(role.permissions || []),
      ],
    });

    setShowEditPermissionDropdown(false);
    setShowEditModal(true);

    setError('');
    setSuccess('');
  };

  // =========================================================
  // CLOSE EDIT ROLE
  // =========================================================

  const closeEditRole = () => {
    if (saving) {
      return;
    }

    setShowEditModal(false);
    setEditingRoleId(null);
    resetEditDraft();
  };

  // =========================================================
  // CREATE ROLE
  // =========================================================

  const handleCreate = async () => {
    const roleName = draft.name.trim();

    const description =
      draft.description.trim();

    if (!roleName) {
      setError('Role name is required.');
      return;
    }

    if (draft.permissions.length === 0) {
      setError(
        'Please select at least one permission.'
      );

      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // -----------------------------------------------------
      // CHECK DUPLICATE ROLE IN MYSQL
      // -----------------------------------------------------

      const mysqlRoles =
        await fetchRolesFromNode();

      const duplicateRole =
        mysqlRoles.find((roleData) => {
          return (
            String(roleData.role || '')
              .trim()
              .toLowerCase() ===
            roleName.toLowerCase()
          );
        });

      if (duplicateRole) {
        setError(
          'A role with this name already exists.'
        );

        return;
      }

      // -----------------------------------------------------
      // GENERATE FIREBASE DOCUMENT ID
      //
      // This ID becomes the shared ID between Firebase
      // and MySQL.
      // -----------------------------------------------------

      const roleRef = doc(
        collection(db, 'roles')
      );

      const roleId = roleRef.id;

      // -----------------------------------------------------
      // DESCRIPTION
      // -----------------------------------------------------

      const roleDescription =
        description ||
        DEFAULT_ROLE_DESCRIPTIONS[
          roleName
        ] ||
        'Custom role with assigned permissions';

      // -----------------------------------------------------
      // ROLE DATA
      // -----------------------------------------------------

      const roleData = {
        role_id: roleId,
        role: roleName,
        description: roleDescription,
        status: draft.status,
        permissions: [
          ...draft.permissions,
        ],
      };

      // -----------------------------------------------------
      // SAVE TO FIREBASE
      // -----------------------------------------------------

      await setDoc(roleRef, {
        ...roleData,
        created_at: serverTimestamp(),
      });

      // -----------------------------------------------------
      // SAVE SAME ROLE TO MYSQL THROUGH NODE.JS
      // -----------------------------------------------------

      try {
        await createRoleInNode(roleData);
      } catch (mysqlError) {
        // ---------------------------------------------------
        // ROLLBACK FIREBASE IF MYSQL CREATION FAILS
        // ---------------------------------------------------

        try {
          await deleteDoc(roleRef);
        } catch (rollbackError) {
          console.error(
            'Firebase rollback failed:',
            rollbackError
          );
        }

        throw mysqlError;
      }

      // -----------------------------------------------------
      // UPDATE UI
      // -----------------------------------------------------

      const createdRole = {
        id: roleId,
        name: roleName,
        description: roleDescription,
        status: draft.status,
        permissions: [
          ...draft.permissions,
        ],
        users: 0,
      };

      setRoles((currentRoles) => [
        createdRole,
        ...currentRoles,
      ]);

      setSelectedRole(createdRole);

      resetDraft();
      setShowForm(false);

      setSuccess(
        'Role created successfully in Firebase and MySQL.'
      );
    } catch (err) {
      console.error(
        'Error creating role:',
        err
      );

      setError(
        err?.message ||
          'Failed to create role.'
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // UPDATE ROLE
  // =========================================================

  const handleUpdateRole = async () => {
    const roleName = editDraft.name.trim();

    const description =
      editDraft.description.trim();

    if (!editingRoleId) {
      setError(
        'No role was selected for editing.'
      );

      return;
    }

    if (!roleName) {
      setError('Role name is required.');
      return;
    }

    if (editDraft.permissions.length === 0) {
      setError(
        'Please select at least one permission.'
      );

      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // -----------------------------------------------------
      // CHECK DUPLICATE ROLE NAME IN MYSQL
      // -----------------------------------------------------

      const mysqlRoles =
        await fetchRolesFromNode();

      const duplicateRole =
        mysqlRoles.find((roleData) => {
          return (
            roleData.role_id !==
              editingRoleId &&
            String(roleData.role || '')
              .trim()
              .toLowerCase() ===
            roleName.toLowerCase()
          );
        });

      if (duplicateRole) {
        setError(
          'A role with this name already exists.'
        );

        return;
      }

      // -----------------------------------------------------
      // DESCRIPTION
      // -----------------------------------------------------

      const roleDescription =
        description ||
        DEFAULT_ROLE_DESCRIPTIONS[
          roleName
        ] ||
        'Custom role with assigned permissions';

      // -----------------------------------------------------
      // ROLE DATA
      // -----------------------------------------------------

      const roleData = {
        role_id: editingRoleId,
        role: roleName,
        description: roleDescription,
        status: editDraft.status,
        permissions: [
          ...editDraft.permissions,
        ],
      };

      // -----------------------------------------------------
      // FIRESTORE ROLE DOCUMENT
      // -----------------------------------------------------

      const roleRef = doc(
        db,
        'roles',
        editingRoleId
      );

      // -----------------------------------------------------
      // SAVE OLD FIREBASE DATA
      //
      // This gives us data to restore if MySQL fails.
      // -----------------------------------------------------

      const oldRole =
        roles.find(
          (role) =>
            role.id === editingRoleId
        );

      // -----------------------------------------------------
      // UPDATE FIREBASE
      // -----------------------------------------------------

      await setDoc(
        roleRef,
        {
          ...roleData,
          updated_at: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      // -----------------------------------------------------
      // UPDATE MYSQL THROUGH NODE.JS
      // -----------------------------------------------------

      try {
        await updateRoleInNode(
          editingRoleId,
          roleData
        );
      } catch (mysqlError) {
        // ---------------------------------------------------
        // ROLLBACK FIREBASE UPDATE IF MYSQL FAILS
        // ---------------------------------------------------

        if (oldRole) {
          try {
            await setDoc(
              roleRef,
              {
                role_id: oldRole.id,
                role: oldRole.name,
                description:
                  oldRole.description,
                status: oldRole.status,
                permissions: [
                  ...(oldRole.permissions || []),
                ],
                updated_at:
                  serverTimestamp(),
              },
              {
                merge: true,
              }
            );
          } catch (rollbackError) {
            console.error(
              'Firebase update rollback failed:',
              rollbackError
            );
          }
        }

        throw mysqlError;
      }

      // -----------------------------------------------------
      // UPDATE LOCAL ROLE
      // -----------------------------------------------------

      const updatedRole = {
        id: editingRoleId,
        name: roleName,
        description: roleDescription,
        status: editDraft.status,
        permissions: [
          ...editDraft.permissions,
        ],
        users:
          selectedRole?.users || 0,
      };

      setRoles((currentRoles) =>
        currentRoles.map((role) =>
          role.id === editingRoleId
            ? updatedRole
            : role
        )
      );

      setSelectedRole(updatedRole);

      closeEditRole();

      setSuccess(
        'Role updated successfully in Firebase and MySQL.'
      );
    } catch (err) {
      console.error(
        'Error updating role:',
        err
      );

      setError(
        err?.message ||
          'Failed to update role.'
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // OPEN DELETE CONFIRMATION
  // =========================================================

  const openDeleteConfirmation = (role) => {
    if (!role) {
      return;
    }

    // -----------------------------------------------------
    // DO NOT ALLOW DELETE IF USERS ARE ASSIGNED
    // -----------------------------------------------------

    if (role.users > 0) {
      setError(
        `Cannot delete ${role.name} because ${
          role.users
        } user${
          role.users === 1 ? '' : 's'
        } are assigned to this role.`
      );

      return;
    }

    setDeletingRole(role);
    setShowDeleteModal(true);

    setError('');
    setSuccess('');
  };

  // =========================================================
  // CLOSE DELETE CONFIRMATION
  // =========================================================

  const closeDeleteConfirmation = () => {
    if (deleting) {
      return;
    }

    setShowDeleteModal(false);
    setDeletingRole(null);
  };

  // =========================================================
  // DELETE ROLE
  // =========================================================

  const handleDelete = async () => {
    if (!deletingRole) {
      return;
    }

    const roleId = deletingRole.id;

    try {
      setDeleting(true);
      setError('');
      setSuccess('');

      // -----------------------------------------------------
      // DELETE FROM MYSQL FIRST
      //
      // Node checks whether the role is assigned to users.
      // -----------------------------------------------------

      await deleteRoleFromNode(roleId);

      // -----------------------------------------------------
      // DELETE FROM FIREBASE
      // -----------------------------------------------------

      try {
        await deleteDoc(
          doc(
            db,
            'roles',
            roleId
          )
        );
      } catch (firebaseError) {
        // ---------------------------------------------------
        // MySQL has already deleted the role.
        // Inform the user instead of pretending both succeeded.
        // ---------------------------------------------------

        console.error(
          'Firebase delete failed after MySQL delete:',
          firebaseError
        );

        throw new Error(
          'Role was deleted from MySQL, but Firebase deletion failed. Please check Firebase.'
        );
      }

      // -----------------------------------------------------
      // UPDATE LOCAL UI
      // -----------------------------------------------------

      const remainingRoles =
        roles.filter(
          (role) =>
            role.id !== roleId
        );

      setRoles(remainingRoles);

      if (
        selectedRole?.id ===
        roleId
      ) {
        setSelectedRole(
          remainingRoles[0] || null
        );
      }

      // -----------------------------------------------------
      // CLOSE MODAL
      // -----------------------------------------------------

      setShowDeleteModal(false);
      setDeletingRole(null);

      setSuccess(
        'Role deleted successfully from Firebase and MySQL.'
      );
    } catch (err) {
      console.error(
        'Error deleting role:',
        err
      );

      setError(
        err?.message ||
          'Failed to delete role.'
      );
    } finally {
      setDeleting(false);
    }
  };

  // =========================================================
  // DERIVED VALUES FOR THE DETAIL PANE
  // =========================================================

  const grantedFeatures = effectivePermissions(
    selectedRole?.name,
    selectedRole?.permissions
  );

  const assignedUsers = usersForRole(apiUsers, selectedRole);

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-5">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex items-end justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Role Management</h1>
          <p className="mt-0.5 text-xs text-[#4B5563]">
            Configure access levels and user permissions across the queuing
            system.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetDraft();
            setShowForm(true);
          }}
          className="swu-press flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
        >
          <Plus size={14} /> Add Role
        </button>
      </div>

      {/* =================================================
          MESSAGES
      ================================================= */}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
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
          <Check size={14} className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {/* =================================================
          LIST + DETAIL
      ================================================= */}

      <div className="grid min-h-[620px] grid-cols-[minmax(300px,26%)_minmax(0,1fr)] gap-5">
        {/* ---------------- LIST ---------------- */}

        <section className="swu-enter flex flex-col gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
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
              {roles.length === 0 ? 'No roles yet.' : 'No roles found.'}
            </div>
          )}

          <div className="swu-stagger space-y-2.5">
            {!loading &&
              filteredRoles.map((role) => {
                const active = selectedRole?.id === role.id;
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
                          active ? 'text-[#9D0A0E]' : 'text-[#1F2937]'
                        }`}
                      >
                        {role.name}
                      </span>

                      <span className="mt-0.5 block truncate text-xs text-[#4B5563]">
                        {role.description}
                      </span>

                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
                        <Users size={11} />
                        {count ?? '--'} user{count === 1 ? '' : 's'}
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

        {/* ---------------- DETAIL ---------------- */}

        <section className="swu-enter overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {selectedRole ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-[#1F2937]">
                    {selectedRole.name}
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
                    onClick={() => openDeleteConfirmation(selectedRole)}
                    aria-label="Delete role"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#9D0A0E] transition hover:border-[#F0DADA] hover:bg-[#FBF1F1]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                {/* description */}
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
                        {grantedFeatures.length} of {FEATURES.length} features
                        enabled
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      {FEATURES.map((feature) => (
                        <FeatureCard
                          key={feature.key}
                          feature={feature}
                          enabled={grantedFeatures.includes(feature.key)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* summary */}
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
                            {usersLoading ? '--' : assignedUsers.length}
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
                        <span className="text-xs text-[#4B5563]">Module</span>
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
              <ShieldCheck size={22} className="text-[#D1D5DB]" />
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

      {/* =================================================
          ADD ROLE
      ================================================= */}

      {showForm && (
        <RoleModal
          mode="add"
          draft={draft}
          setDraft={setDraft}
          onToggle={togglePermission}
          onSelectAll={selectAllPermissions}
          onClearAll={clearAllPermissions}
          onClose={() => {
            if (saving) return;
            setShowForm(false);
            resetDraft();
          }}
          onSave={handleCreate}
          saving={saving}
        />
      )}

      {/* =================================================
          EDIT ROLE
      ================================================= */}

      {showEditModal && (
        <RoleModal
          mode="edit"
          draft={editDraft}
          setDraft={setEditDraft}
          onToggle={toggleEditPermission}
          onSelectAll={selectAllEditPermissions}
          onClearAll={clearAllEditPermissions}
          onClose={closeEditRole}
          onSave={handleUpdateRole}
          saving={saving}
        />
      )}

      {/* =================================================
          DELETE ROLE
      ================================================= */}

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

      {/* =================================================
          ASSIGNED USERS
      ================================================= */}

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

/* =========================================================
   FEATURE CARD - read-only, used on the detail pane
========================================================= */

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
          enabled ? 'bg-[#FBF1F1] text-[#9D0A0E]' : 'bg-[#F1F3F5] text-[#9CA3AF]'
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
          enabled ? 'bg-[#9D0A0E] text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]'
        }`}
      >
        {enabled ? (
          <Check size={9} strokeWidth={3} />
        ) : (
          <X size={9} strokeWidth={3} />
        )}
      </span>

      <span className="sr-only">{enabled ? 'Enabled' : 'Disabled'}</span>
    </div>
  );
}

/* =========================================================
   AVATAR STACK
========================================================= */

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

/* =========================================================
   ADD / EDIT ROLE MODAL
========================================================= */

function RoleModal({
  mode,
  draft,
  setDraft,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose,
  onSave,
  saving,
}) {
  const edit = mode === 'edit';

  // Locked features follow the role name, so they are shown but not editable.
  const granted = effectivePermissions(draft.name, draft.permissions);
  const allSelected = AVAILABLE_PERMISSIONS.every((key) =>
    draft.permissions.includes(key)
  );

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2 id="role-modal-title" className="text-base font-bold text-[#1F2937]">
              {edit ? 'Edit Role' : 'Add Role'}
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              {edit
                ? 'Update role details and system feature access.'
                : 'Create a role and choose what it can access.'}
            </p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Fields marked * are required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-4">
            <div>
              <label
                htmlFor="role-name"
                className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
              >
                Role Name <span className="text-[#9D0A0E]">*</span>
              </label>

              <input
                id="role-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Billing Officer"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-[#1F2937]">
                Status
              </span>

              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F1F3F5] p-1">
                {['Active', 'Inactive'].map((value) => {
                  const on = draft.status === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({ ...current, status: value }))
                      }
                      aria-pressed={on}
                      className={`flex h-8 items-center justify-center gap-1 rounded-md text-xs font-medium transition ${
                        on
                          ? value === 'Active'
                            ? 'border border-[#86EFAC] bg-[#E8F8F0] text-[#0D8A4E] shadow-sm'
                            : 'border border-[#E5E7EB] bg-white text-[#1F2937] shadow-sm'
                          : 'text-[#4B5563] hover:text-[#1F2937]'
                      }`}
                    >
                      {on && value === 'Active' && <Check size={12} />}
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="role-description"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              Description
            </label>

            <textarea
              id="role-description"
              rows={3}
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Describe the purpose of this role"
              className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          <div className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[#1F2937]">
                  Feature Access <span className="text-[#9D0A0E]">*</span>
                </span>
                <span className="mt-0.5 block text-xs text-[#9CA3AF]">
                  Choose which system features this role can access.
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-[#9CA3AF]">
                  {granted.length} of {FEATURES.length} features enabled
                </span>

                <button
                  type="button"
                  onClick={allSelected ? onClearAll : onSelectAll}
                  className="text-xs font-semibold text-[#9D0A0E] transition hover:text-[#7D080B]"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                const locked = Boolean(feature.locked);
                const checked = granted.includes(feature.key);

                return (
                  <button
                    key={feature.key}
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && onToggle(feature.key)}
                    aria-pressed={checked}
                    title={
                      locked
                        ? 'This feature is reserved for the Superadmin role.'
                        : undefined
                    }
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                      locked
                        ? 'cursor-not-allowed border-transparent bg-[#F8F9FA]'
                        : checked
                          ? 'border-[#9D0A0E] bg-white'
                          : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        checked
                          ? 'bg-[#FBF1F1] text-[#9D0A0E]'
                          : 'bg-[#F1F3F5] text-[#9CA3AF]'
                      }`}
                    >
                      <Icon size={13} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-xs font-semibold ${
                          locked ? 'text-[#9CA3AF]' : 'text-[#1F2937]'
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
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                          : 'border-[#D1D5DB] bg-white text-transparent'
                      }`}
                    >
                      <Check size={9} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name.trim() || draft.permissions.length === 0}
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {saving ? 'Saving...' : edit ? 'Update Role' : 'Save Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DELETE ROLE
========================================================= */

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

          <h2 id="delete-role-title" className="text-lg font-bold text-[#1F2937]">
            Delete Role?
          </h2>

          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#4B5563]">
            Are you sure you want to delete the{' '}
            <span className="font-semibold text-[#1F2937]">{role.name}</span>{' '}
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
                  {assignedCount} user{assignedCount === 1 ? ' is' : 's are'}
                </span>{' '}
                currently assigned to this role. Please reassign
                {assignedCount === 1 ? ' this user' : ' these users'} before
                deleting the role.
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
            title={blocked ? 'Reassign the users on this role first.' : undefined}
            className="swu-press rounded-lg bg-[#9D0A0E] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {deleting ? 'Deleting...' : 'Delete Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ASSIGNED USERS
========================================================= */

function AssignedUsersModal({ role, users, loading, query, setQuery, onClose }) {
  const search = query.trim().toLowerCase();

  const shown = search
    ? users.filter((user) =>
        [user.name, user.email, user.position, user.department].some((value) =>
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
                  : `${users.length} user${users.length === 1 ? '' : 's'} ${
                      users.length === 1 ? 'has' : 'have'
                    } the ${role.name} role.`}
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