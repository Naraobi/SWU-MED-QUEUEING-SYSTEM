import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  ShieldCheck,
  Plus,
  Search,
  PencilLine,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '../../../supabase';

const ROLE_DESCRIPTIONS = {
  Superadmin: 'Full platform access and administrative control',
  Admin: 'Department and queue oversight with limited global settings',
  Staff: 'Handles queue operations and daily service tasks',
};

const permissions = {
  Superadmin: [
    'Manage users',
    'Manage departments',
    'Manage queues',
    'View reports',
    'Modify settings',
  ],
  Admin: [
    'Manage queues',
    'View reports',
    'Assign staff',
    'Manage departments',
  ],
  Staff: [
    'View assigned queue',
    'Update ticket status',
    'Clock in/out',
  ],
};

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    status: 'Active',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---------------------------------------------------------
  // LOAD ROLES + USER COUNTS
  // ---------------------------------------------------------
  async function fetchRoles() {
    try {
      setLoading(true);
      setError('');

      // Get all roles
      const { data: roleData, error: roleError } = await supabase
        .from('role')
        .select('role_id, role')
        .order('role');

      if (roleError) {
        throw roleError;
      }

      // Get all users' role IDs
      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('user_id, role_id');

      if (userError) {
        throw userError;
      }

      // Count users for each role
      const userCounts = {};

      (userData ?? []).forEach((user) => {
        const roleId = user.role_id;

        if (!roleId) return;

        userCounts[roleId] = (userCounts[roleId] || 0) + 1;
      });

      // Convert Supabase data into the format used by the UI
      const formattedRoles = (roleData ?? []).map((role) => ({
        id: role.role_id,
        name: role.role,
        description:
          ROLE_DESCRIPTIONS[role.role] ??
          'Custom role with assigned permissions',
        users: userCounts[role.role_id] || 0,
        status: 'Active',
      }));

      setRoles(formattedRoles);

      // Keep selected role after refresh
      setSelectedRole((currentSelected) => {
        if (!currentSelected) {
          return formattedRoles[0] ?? null;
        }

        return (
          formattedRoles.find(
            (role) => role.id === currentSelected.id
          ) ?? formattedRoles[0] ?? null
        );
      });
    } catch (err) {
      console.error('Error loading roles:', err);
      setError(
        err?.message || 'Failed to load roles from Supabase.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRoles();
  }, []);

  // ---------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------
  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return roles;

    return roles.filter((role) =>
      [role.name, role.description, role.status].some((value) =>
        String(value).toLowerCase().includes(q)
      )
    );
  }, [query, roles]);

  // ---------------------------------------------------------
  // SELECT ROLE
  // ---------------------------------------------------------
  const openRole = (role) => {
    setSelectedRole(role);
  };

  // ---------------------------------------------------------
  // CREATE ROLE
  // ---------------------------------------------------------
  const handleCreate = async () => {
    const roleName = draft.name.trim();

    if (!roleName) {
      setError('Role name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Check if role already exists
      const { data: existingRole, error: existingError } =
        await supabase
          .from('role')
          .select('role_id, role')
          .ilike('role', roleName)
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRole) {
        setError('A role with this name already exists.');
        return;
      }

      const { data: newRole, error: insertError } = await supabase
        .from('role')
        .insert({
          role: roleName,
        })
        .select('role_id, role')
        .single();

      if (insertError) {
        throw insertError;
      }

      const createdRole = {
        id: newRole.role_id,
        name: newRole.role,
        description:
          draft.description.trim() ||
          ROLE_DESCRIPTIONS[newRole.role] ||
          'Custom role with assigned permissions',
        users: 0,
        status: 'Active',
      };

      setRoles((current) => [createdRole, ...current]);
      setSelectedRole(createdRole);

      setDraft({
        name: '',
        description: '',
        status: 'Active',
      });

      setShowForm(false);
      setSuccess('Role created successfully.');
    } catch (err) {
      console.error('Error creating role:', err);
      setError(
        err?.message || 'Failed to create role.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------
  // DELETE ROLE
  // ---------------------------------------------------------
  const handleDelete = async (roleId) => {
    const role = roles.find((item) => item.id === roleId);

    if (!role) return;

    // Prevent deleting a role that still has users
    if (role.users > 0) {
      setError(
        `Cannot delete ${role.name} because ${role.users} user${
          role.users === 1 ? '' : 's'
        } are assigned to this role.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete the "${role.name}" role?`
    );

    if (!confirmed) return;

    try {
      setError('');
      setSuccess('');

      const { error: deleteError } = await supabase
        .from('role')
        .delete()
        .eq('role_id', roleId);

      if (deleteError) {
        throw deleteError;
      }

      const remainingRoles = roles.filter(
        (item) => item.id !== roleId
      );

      setRoles(remainingRoles);

      if (selectedRole?.id === roleId) {
        setSelectedRole(remainingRoles[0] ?? null);
      }

      setSuccess('Role deleted successfully.');
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(
        err?.message || 'Failed to delete role.'
      );
    }
  };

  // ---------------------------------------------------------
  // PERMISSIONS
  // ---------------------------------------------------------
  const currentPermissions =
    permissions[selectedRole?.name] ?? [
      'View dashboard',
      'Limited access based on assigned scope',
    ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Role Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configure access levels and user permissions across
            the queueing system.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((value) => !value);
            setError('');
            setSuccess('');
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00529B] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00467f]"
        >
          <Plus size={16} />
          Add Role
        </button>
      </div>

      {/* MESSAGES */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* ADD ROLE FORM */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-600">
              Role name

              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
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
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B]"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm text-slate-600">
            Description

            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder="Describe the purpose of this role"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-[#00529B]"
            />
          </label>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
              {saving ? 'Saving...' : 'Save Role'}
            </button>
          </div>
        </div>
      )}

      {/* ROLE CONTENT */}
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* ROLE LIST */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search
              size={16}
              className="text-slate-400"
            />

            <input
              type="text"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search roles"
              className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

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
                  selectedRole?.id === role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => openRole(role)}
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

                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
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

                      <span className="inline-flex items-center gap-1.5 text-[#00529B]">
                        <PencilLine size={12} />
                        Edit
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ROLE DETAILS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {selectedRole ? (
            <>
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-100 p-3 text-[#00529B]">
                    <ShieldCheck size={22} />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {selectedRole.name}
                    </h2>

                    <p className="text-sm text-slate-500">
                      {selectedRole.status} role
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <PencilLine size={15} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(selectedRole.id)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Description
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedRole.description}
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      Permissions
                    </p>

                    <div className="space-y-2">
                      {currentPermissions.map(
                        (permission) => (
                          <div
                            key={permission}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                          >
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#00529B]" />

                            {permission}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* SUMMARY */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Summary
                  </p>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span className="text-sm text-slate-500">
                        Assigned users
                      </span>

                      <span className="text-lg font-bold text-slate-800">
                        {selectedRole.users}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span className="text-sm text-slate-500">
                        Access level
                      </span>

                      <span className="text-sm font-semibold text-slate-700">
                        {selectedRole.name}
                      </span>
                    </div>

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

