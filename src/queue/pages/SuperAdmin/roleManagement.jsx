import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  ShieldCheck,
  Plus,
  Search,
  PencilLine,
  Trash2,
  Users,
  ChevronDown,
  Check,
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

// =========================================================
// NODE.JS API
// =========================================================

const API_BASE_URL = 'http://localhost:5000/api';

// =========================================================
// AVAILABLE PERMISSIONS
// =========================================================

const AVAILABLE_PERMISSIONS = [
  'Manage users',
  'Manage departments',
  'Manage kiosks',
  'Manage queues',
  'Assign staff',
  'Assign terminals',
  'Call next patient',
  'Update queue status',
  'View reports',
  'Modify settings',
];

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
  const [showForm, setShowForm] = useState(false);

  // Edit Role
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRole, setDeletingRole] = useState(null);

  // Permission dropdowns
  const [showPermissionDropdown, setShowPermissionDropdown] =
    useState(false);

  const [showEditPermissionDropdown, setShowEditPermissionDropdown] =
    useState(false);

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

  useEffect(() => {
    fetchRoles();
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
  // CURRENT PERMISSIONS
  // =========================================================

  const currentPermissions =
    selectedRole?.permissions || [];

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Role Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure access levels and user
            permissions across the queueing system.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowForm(
                (value) => !value
              );

              setError('');
              setSuccess('');

              if (!showForm) {
                resetDraft();
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00529B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00467f]"
          >
            <Plus size={16} />
            Add Role
          </button>
        </div>
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* =================================================
          EDIT ROLE MODAL
      ================================================= */}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">

            {/* MODAL HEADER */}

            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  Edit Role
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Update access details and permissions.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditRole}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* ROLE NAME + STATUS */}

            <div className="grid gap-4 md:grid-cols-2">

              <label className="block text-sm text-slate-600">
                Role name

                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(event) =>
                    setEditDraft(
                      (current) => ({
                        ...current,
                        name:
                          event.target.value,
                      })
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B] focus:ring-1 focus:ring-[#00529B]"
                />
              </label>

              <label className="block text-sm text-slate-600">
                Status

                <select
                  value={editDraft.status}
                  onChange={(event) =>
                    setEditDraft(
                      (current) => ({
                        ...current,
                        status:
                          event.target.value,
                      })
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B] focus:ring-1 focus:ring-[#00529B]"
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

            {/* DESCRIPTION */}

            <label className="mt-4 block text-sm text-slate-600">
              Description

              <textarea
                value={editDraft.description}
                onChange={(event) =>
                  setEditDraft(
                    (current) => ({
                      ...current,
                      description:
                        event.target.value,
                    })
                  )
                }
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B] focus:ring-1 focus:ring-[#00529B]"
              />
            </label>

            {/* PERMISSIONS */}

            <div className="relative mt-4">

              <label className="block text-sm text-slate-600">
                Permissions

                <button
                  type="button"
                  onClick={() =>
                    setShowEditPermissionDropdown(
                      (value) => !value
                    )
                  }
                  className="mt-1 flex w-full items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-left text-sm outline-none transition hover:bg-slate-100 focus:border-[#00529B]"
                >
                  <span
                    className={
                      editDraft.permissions
                        .length === 0
                        ? 'text-slate-400'
                        : 'text-slate-700'
                    }
                  >
                    {editDraft.permissions
                      .length === 0
                      ? 'Select permissions'
                      : `${editDraft.permissions.length} permission${
                          editDraft.permissions.length ===
                          1
                            ? ''
                            : 's'
                        } selected`}
                  </span>

                  <ChevronDown
                    size={17}
                    className={`text-slate-400 transition-transform ${
                      showEditPermissionDropdown
                        ? 'rotate-180'
                        : ''
                    }`}
                  />
                </button>
              </label>

              {/* PERMISSION DROPDOWN */}

              {showEditPermissionDropdown && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl">

                  {/* SELECT / CLEAR */}

                  <div className="flex items-center justify-between border-b border-slate-200 px-2 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Available permissions
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={
                          selectAllEditPermissions
                        }
                        className="text-xs font-semibold text-[#00529B] hover:underline"
                      >
                        Select all
                      </button>

                      <button
                        type="button"
                        onClick={
                          clearAllEditPermissions
                        }
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* PERMISSION OPTIONS */}

                  <div className="max-h-64 overflow-y-auto py-1">
                    {AVAILABLE_PERMISSIONS.map(
                      (permission) => {
                        const checked =
                          editDraft.permissions.includes(
                            permission
                          );

                        return (
                          <button
                            key={permission}
                            type="button"
                            onClick={() =>
                              toggleEditPermission(
                                permission
                              )
                            }
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                                checked
                                  ? 'border-[#00529B] bg-[#00529B] text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {checked && (
                                <Check
                                  size={13}
                                  strokeWidth={3}
                                />
                              )}
                            </span>

                            {permission}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SELECTED PERMISSIONS */}

            {editDraft.permissions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {editDraft.permissions.map(
                  (permission) => (
                    <span
                      key={permission}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#00529B]"
                    >
                      {permission}
                    </span>
                  )
                )}
              </div>
            )}

            {/* BUTTONS */}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditRole}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={saving}
                className="rounded-lg bg-[#00529B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00467f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          DELETE CONFIRMATION MODAL
      ================================================= */}

      {showDeleteModal && deletingRole && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">

            {/* ICON */}

            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={28} />
              </div>
            </div>

            {/* TEXT */}

            <div className="mt-4 text-center">
              <h3 className="text-lg font-bold text-slate-800">
                Delete Role?
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Are you sure you want to delete the
                <span className="font-semibold text-slate-700">
                  {' '}
                  "{deletingRole.name}"
                </span>
                {' '}role?
              </p>

              <p className="mt-2 text-xs text-red-500">
                This action cannot be undone.
              </p>
            </div>

            {/* BUTTONS */}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={
                  closeDeleteConfirmation
                }
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting
                  ? 'Deleting...'
                  : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          ADD ROLE FORM
      ================================================= */}

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          {/* ROLE NAME + STATUS */}

          <div className="grid gap-4 md:grid-cols-2">

            <label className="block text-sm text-slate-600">
              Role name

              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="e.g. Billing Officer"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B]"
              />
            </label>

            <label className="block text-sm text-slate-600">
              Status

              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      status:
                        event.target.value,
                    })
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B]"
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

          {/* DESCRIPTION */}

          <label className="mt-4 block text-sm text-slate-600">
            Description

            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft(
                  (current) => ({
                    ...current,
                    description:
                      event.target.value,
                  })
                )
              }
              rows={3}
              placeholder="Describe the purpose of this role"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B]"
            />
          </label>

          {/* PERMISSIONS */}

          <div className="relative mt-4">

            <label className="block text-sm text-slate-600">
              Permissions

              <button
                type="button"
                onClick={() =>
                  setShowPermissionDropdown(
                    (value) => !value
                  )
                }
                className="mt-1 flex w-full items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-left text-sm outline-none transition hover:bg-slate-100 focus:border-[#00529B]"
              >
                <span
                  className={
                    draft.permissions.length ===
                    0
                      ? 'text-slate-400'
                      : 'text-slate-700'
                  }
                >
                  {draft.permissions.length ===
                  0
                    ? 'Select permissions'
                    : `${draft.permissions.length} permission${
                        draft.permissions.length ===
                        1
                          ? ''
                          : 's'
                      } selected`}
                </span>

                <ChevronDown
                  size={17}
                  className={`text-slate-400 transition-transform ${
                    showPermissionDropdown
                      ? 'rotate-180'
                      : ''
                  }`}
                />
              </button>
            </label>

            {/* DROPDOWN */}

            {showPermissionDropdown && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">

                <div className="flex items-center justify-between border-b border-slate-200 px-2 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Available permissions
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={
                        selectAllPermissions
                      }
                      className="text-xs font-semibold text-[#00529B] hover:underline"
                    >
                      Select all
                    </button>

                    <button
                      type="button"
                      onClick={
                        clearAllPermissions
                      }
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {AVAILABLE_PERMISSIONS.map(
                    (permission) => {
                      const checked =
                        draft.permissions.includes(
                          permission
                        );

                      return (
                        <button
                          key={permission}
                          type="button"
                          onClick={() =>
                            togglePermission(
                              permission
                            )
                          }
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                              checked
                                ? 'border-[#00529B] bg-[#00529B] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {checked && (
                              <Check
                                size={13}
                                strokeWidth={3}
                              />
                            )}
                          </span>

                          {permission}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SELECTED PERMISSIONS */}

          {draft.permissions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.permissions.map(
                (permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#00529B]"
                  >
                    {permission}
                  </span>
                )
              )}
            </div>
          )}

          {/* BUTTONS */}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetDraft();
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-lg bg-[#00529B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00467f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : 'Save Role'}
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          ROLE CONTENT
      ================================================= */}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">

        {/* =================================================
            ROLE LIST
        ================================================= */}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          {/* SEARCH */}

          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search
              size={16}
              className="text-slate-400"
            />

            <input
              type="text"
              value={queryText}
              onChange={(event) =>
                setQueryText(
                  event.target.value
                )
              }
              placeholder="Search roles"
              className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading roles...
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No roles found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRoles.map((role) => {
                const active =
                  selectedRole?.id ===
                  role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      openRole(role)
                    }
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-[#00529B] bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">

                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {role.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {role.description}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          role.status ===
                          'Active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {role.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">

                      <span className="inline-flex items-center gap-1.5">
                        <Users size={12} />

                        {role.users}{' '}

                        {role.users === 1
                          ? 'user'
                          : 'users'}
                      </span>

                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditRole(role);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-[#00529B]"
                      >
                        <PencilLine
                          size={12}
                        />

                        Edit
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* =================================================
            ROLE DETAILS
        ================================================= */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          {selectedRole ? (
            <>
              {/* ROLE HEADER */}

              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">

                <div className="flex items-center gap-3">

                  <div className="rounded-xl bg-blue-100 p-3 text-[#00529B]">
                    <ShieldCheck
                      size={22}
                    />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {selectedRole.name}
                    </h2>

                    <p className="text-sm text-slate-500">
                      {selectedRole.status}{' '}
                      role
                    </p>
                  </div>
                </div>

                {/* ACTIONS */}

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      openEditRole(
                        selectedRole
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <PencilLine
                      size={15}
                    />

                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openDeleteConfirmation(
                        selectedRole
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={15} />

                    Delete
                  </button>
                </div>
              </div>

              {/* ROLE INFORMATION */}

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

                {/* LEFT */}

                <div>

                  {/* DESCRIPTION */}

                  <div className="rounded-xl bg-slate-50 p-4">

                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Description
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedRole.description}
                    </p>
                  </div>

                  {/* PERMISSIONS */}

                  <div className="mt-5">

                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      Permissions
                    </p>

                    {currentPermissions.length >
                    0 ? (
                      <div className="space-y-2">

                        {currentPermissions.map(
                          (permission) => (
                            <div
                              key={
                                permission
                              }
                              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                            >
                              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#00529B]" />

                              {permission}
                            </div>
                          )
                        )}

                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                        No permissions assigned.
                      </div>
                    )}
                  </div>
                </div>

                {/* SUMMARY */}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Summary
                  </p>

                  <div className="mt-4 space-y-4">

                    {/* USERS */}

                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">

                      <span className="text-sm text-slate-500">
                        Assigned users
                      </span>

                      <span className="text-lg font-bold text-slate-800">
                        {selectedRole.users}
                      </span>
                    </div>

                    {/* ACCESS */}

                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">

                      <span className="text-sm text-slate-500">
                        Access level
                      </span>

                      <span className="text-sm font-semibold text-slate-700">
                        {selectedRole.name}
                      </span>
                    </div>

                    {/* PERMISSIONS */}

                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">

                      <span className="text-sm text-slate-500">
                        Permissions
                      </span>

                      <span className="text-sm font-semibold text-slate-700">
                        {currentPermissions.length}
                      </span>
                    </div>

                    {/* MODULE */}

                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">

                      <span className="text-sm text-slate-500">
                        Module
                      </span>

                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">

                        <BriefcaseBusiness
                          size={14}
                          className="text-[#00529B]"
                        />

                        Queue System
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500">
              No role selected.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
