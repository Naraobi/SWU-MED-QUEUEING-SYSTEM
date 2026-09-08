import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  Camera,
  Eye,
  EyeOff,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { createUser, deleteUser, fetchRoles, fetchUsers, updateUser } from '../../services/api';

// These fields are shown in the design but do NOT exist on the `users`
// table in the backend reference (no M.I., contact number, department,
// or password columns). They're kept as local-only UI state so the
// form still looks right, but they are never sent to Supabase.
// Remove this block once the schema is confirmed/extended.
const UNBACKED_FIELDS = { mi: '', contact: '', department: '', password: '' };

const STATS_META = [
  { key: 'superAdmin', label: 'Super Admin', caption: 'Total super admin', icon: ShieldCheck },
  { key: 'deptAdmin', label: 'Dept Admin', caption: 'Total dept admin', icon: Users },
  { key: 'staff', label: 'Staff', caption: 'Total staff', icon: Briefcase },
  { key: 'active', label: 'Active', caption: 'Admin/staff on duty', icon: Activity },
  { key: 'terminal', label: 'Terminal', caption: 'Active terminal', icon: Monitor },
];

const fieldClass = 'mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#075b9f]';
const labelClass = 'block text-xs font-semibold text-slate-600';

function StatCard({ label, value, caption, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon size={16} className="text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{caption}</p>
    </div>
  );
}

function emptyForm() {
  return { first_name: '', last_name: '', email: '', role_id: '', status: 'Active', ...UNBACKED_FIELDS };
}

export default function StaffManagementPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | { type: 'edit', user }
  const [page, setPage] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [addQuery, setAddQuery] = useState('');

  const staffRoles = useMemo(
  () => roles.filter((role) => role.name?.toLowerCase() === 'staff'),
  [roles]
);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [userRows, roleRows] = await Promise.all([fetchUsers(), fetchRoles()]);
        if (!cancelled) {
          setUsers(userRows);
          setRoles(roleRows);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load users.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const value = query.toLowerCase();
    return users.filter((user) =>
      [user.first_name, user.last_name, user.email, user.roles?.name].some((field) =>
        (field || '').toLowerCase().includes(value)
      )
    );
  }, [query, users]);

  const stats = useMemo(() => {
    const superAdminCount = users.filter((u) => u.roles?.name === 'Super admin').length;
    const deptAdminCount = users.filter((u) => u.roles?.name === 'Dept Admin').length;
    const activeCount = users.filter((u) => u.status === 'Active').length;
    return {
      superAdmin: superAdminCount,
      deptAdmin: deptAdminCount,
      staff: users.length,
      active: `${activeCount}/${users.length}`,
      terminal: '--', // no terminals table yet — see chat notes
    };
  }, [users]);

  function openUser(user) {
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role_id: user.role_id || '',
      status: user.status || 'Active',
      ...UNBACKED_FIELDS,
    });
    setShowPassword(false);
    setModal({ type: 'edit', user });
  }

function openAdd() {
  const staffRole = roles.find(
    (role) => role.name?.toLowerCase() === 'staff'
  );

  setForm({
    ...emptyForm(),
    role_id: staffRole?.id || ''
  });

  setAddQuery('');
  setModal('add');
}


  async function saveUser() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        role_id: form.role_id || null,
        status: form.status,
      };
      const updated = await updateUser(modal.user.id, payload);
      setUsers((rows) => rows.map((row) => (row.id === updated.id ? { ...row, ...updated, roles: roles.find((r) => r.id === updated.role_id) } : row)));
      setModal(null);
    } catch (err) {
      setError(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteUserRow() {
    if (!window.confirm(`Delete ${form.first_name} ${form.last_name}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteUser(modal.user.id);
      setUsers((rows) => rows.filter((row) => row.id !== modal.user.id));
      setModal(null);
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setSaving(false);
    }
  }

  async function addUser() {
    if (!form.first_name.trim() || !form.email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createUser({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        role_id: form.role_id || null,
        status: form.status,
      });
      setUsers((rows) => [{ ...created, roles: roles.find((r) => r.id === created.role_id) }, ...rows]);
      setModal(null);
    } catch (err) {
      setError(err.message || 'Failed to add user.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="mt-0.5 text-xs text-slate-500">Manage system users, roles, and department assignments.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00549A] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#004880]"
        >
          <Plus size={15} />
          Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STATS_META.map((stat) => (
          <StatCard key={stat.key} label={stat.label} caption={stat.caption} icon={stat.icon} value={loading ? '…' : stats[stat.key]} />
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Users</h2>
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#dfeaf6] text-xs font-bold uppercase tracking-wide text-slate-600">
                <th className="px-5 py-3">Full name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">Loading users…</td></tr>
              )}
              {!loading && filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => openUser(user)}
                  className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 capitalize text-slate-700">{user.first_name} {user.last_name}</td>
                  <td className="px-5 py-3 text-slate-600">{user.email}</td>
                  <td className="px-5 py-3 text-slate-600">{user.roles?.name || '--'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        user.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filteredUsers.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No users match your search.</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          <span>Showing {filteredUsers.length} of {users.length} users</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page === 1} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40">Prev</button>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((value) => (
                <button key={value} type="button" onClick={() => setPage(value)} className={`rounded-md border px-2.5 py-1.5 ${page === value ? 'bg-slate-200 text-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{value}</button>
              ))}
            </div>
            <button type="button" onClick={() => setPage((v) => Math.min(3, v + 1))} disabled={page === 3} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {modal && typeof modal === 'object' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <section className="w-full max-w-md overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-[#f5faff] px-5 py-3">
              <h2 className="text-lg font-bold text-slate-800">User Details</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Close"><X size={19} className="text-slate-500" /></button>
            </header>

            <div className="space-y-4 p-5">
              <div>
                <p className={labelClass}>Photo</p>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Camera size={20} />
                  </div>
                  <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Change</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>First Name<input className={fieldClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
                <label className={labelClass}>Last Name<input className={fieldClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
              </div>

              {/* M.I. and Contact Number: not in the users table schema — local only for now */}
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>M.I<input className={fieldClass} value={form.mi} onChange={(e) => setForm({ ...form, mi: e.target.value })} /></label>
                <label className={labelClass}>Contact Number<input className={fieldClass} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></label>
              </div>

              <label className={labelClass}>Email<input className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>

              <div className="grid grid-cols-2 gap-3">
<label className={labelClass}>
  Role
  <input
    className={fieldClass}
    value="Staff"
    disabled
  />
</label>
   {/* Department: not in the users/roles schema shown — local only for now */}
                <label className={labelClass}>Select Department
                  <input className={fieldClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Not in schema yet" />
                </label>
              </div>

              <label className={labelClass}>Status
                <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              {/* Password: not a column on `users` — this belongs to Supabase Auth, not stored here */}
              <label className={labelClass}>Password
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 pr-9 text-xs text-slate-700 outline-none focus:border-[#075b9f]"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Managed via Supabase Auth"
                    disabled
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>
            </div>

            <footer className="flex items-center justify-between border-t border-slate-200 bg-[#f5faff] px-5 py-3">
              <button type="button" onClick={deleteUserRow} disabled={saving} className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 size={13} /> Delete User
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button>
                <button type="button" onClick={saveUser} disabled={saving} className="rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {modal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <section className="w-full max-w-md overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-[#f5faff] px-5 py-3">
              <h2 className="text-lg font-bold text-slate-800">Add New Staff</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Close"><X size={19} className="text-slate-500" /></button>
            </header>
            <div className="space-y-3 p-5">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Search user"
                  className="w-full rounded-full border border-slate-300 bg-white px-10 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
                />
              </div>
              <label className={labelClass}>First Name<input className={fieldClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
              <label className={labelClass}>Last Name<input className={fieldClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
              <label className={labelClass}>Email<input className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className={labelClass}>Role
                <input className={fieldClass} value="Staff" disabled />
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 bg-[#f5faff] px-5 py-3">
              <button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={addUser} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                <Plus size={13} /> {saving ? 'Adding…' : 'Add This Staff'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}