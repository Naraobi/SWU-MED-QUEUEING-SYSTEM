import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase'; 

const TABLE_NAME = 'user'; 

const EMPTY_FORM = { 
  first_name: '', 
  last_name: '', 
  mi: '', 
  contact_number: '', 
  email: '', 
  role: 'Staff', 
  location: 'Select Location',
  department: 'Select Department',
  password: ''
};

const ROLE_OPTIONS = ['Admin', 'Staff', 'Superadmin'];
const LOCATION_OPTIONS = [
  'Main Lobby',
  'Laboratory and Radiology',
  'Out patients',
  'Medical Arts Building',
];
const DEPARTMENT_OPTIONS = ['Information', 'Admission', 'CHAMP', 'Cashier', 'Billing', 'Credit and Collection', 
  'Medical Social worker', 'Phil Health', 'Lab-Specimen Collection', 'Lab- Results', 'Rad Results', 'X-ray',
   'CT-Scan', 'Pharmacy', 'Womens Health'];

const roleStyles = {
  Superadmin: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  Admin: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  Staff: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

function UserModal({ form, setForm, onSave, onClose, isEditing, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-700">
            {isEditing ? 'Edit User' : 'Add New User'}
          </h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 font-bold" 
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">First Name</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Last Name</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">M.i</label>
              <input
                type="text"
                maxLength="2"
                value={form.mi}
                onChange={(e) => setForm({ ...form, mi: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter M.i"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Contact Number</label>
              <input
                type="text"
                value={form.contact_number}
                onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter number"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              placeholder="Enter email"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Select Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Select Location</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">Select Department</label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          {!isEditing && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-600">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter password"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.first_name.trim() || !form.last_name.trim() || !form.email.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#0B5394] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#084072] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving...' : (
              <>
                <span className="text-lg leading-none">+</span>
                {isEditing ? 'Save Changes' : 'Add This User'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserCrud() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null); 
  const [form, setForm] = useState(EMPTY_FORM);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    
    // Explicitly pull status along with other fields
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        user_id,
        first_name,
        last_name,
        email,
        contact_info,
        location,
        department,
        status,
        updated_at,
        role:role_id (role) 
      `)
      .order('last_name', { ascending: true }); 

    if (error) {
      setError(error.message);
    } else {
      const formattedUsers = data.map(u => ({
        id: u.user_id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        contact_number: u.contact_info,
        location: u.location,
        department: u.department,
        status: u.status ?? 'Inactive', // Fallback to Inactive if null
        role: u.role ? u.role.role : 'Staff',
        updated_at: u.updated_at,
      }));
      setUsers(formattedUsers);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId('new');
  }

  function openEdit(user) {
    setForm({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      mi: '', 
      contact_number: user.contact_number ?? '',
      email: user.email ?? '',
      role: user.role ?? 'Staff',
      location: user.location ?? 'Select Location',
      department: user.department ?? 'Select Department',
      password: '' 
    });
    setEditingId(user.id);
  }

  function closeModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) return;
    setSaving(true);
    setError(null);

    try {
      let currentRoleId;
      const { data: roleData, error: roleError } = await supabase
        .from('role')
        .select('role_id')
        .eq('role', form.role)
        .maybeSingle();

      if (roleError) throw roleError;

      if (roleData) {
        currentRoleId = roleData.role_id;
      } else {
        const { data: newRole, error: newRoleError } = await supabase
          .from('role')
          .insert([{ role: form.role }])
          .select('role_id')
          .single();
          
        if (newRoleError) throw newRoleError;
        currentRoleId = newRole.role_id;
      }

      if (editingId === 'new') {
        if (!form.password) throw new Error("Password is required for new users.");

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });
        
        if (authError) throw authError;

        // Insert into User table with status set to 'Inactive'
        const { error: dbError } = await supabase.from(TABLE_NAME).insert([{
          user_id: authData.user.id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          contact_info: form.contact_number, 
          location: form.location,
          department: form.department,
          role_id: currentRoleId,
          status: 'Inactive' // Set initial status to Inactive as requested
        }]);
        if (dbError) throw dbError;

      } else {
        const updateData = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          contact_info: form.contact_number,
          location: form.location,
          department: form.department,
          role_id: currentRoleId,
          updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from(TABLE_NAME)
          .update(updateData)
          .eq('user_id', editingId);
        if (updateError) throw updateError;
      }

      closeModal();
      fetchUsers();
    } catch (err) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  const isModalOpen = editingId !== null;
  const isEditing = isModalOpen && editingId !== 'new';

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0B2447]">Manage Users</h1>
            <p className="text-sm text-slate-500 mt-1">SWU MED Queuing System &mdash; staff &amp; accounts</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-[#0B5394] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#084072]"
          >
            <span className="text-lg leading-none">+</span> Add user
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 font-semibold">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                    Loading users...
                  </td>
                </tr>
              )}

              {!loading && users.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                    No users yet. Click "Add user" to create one.
                  </td>
                </tr>
              )}

              {!loading &&
                users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-700">
                      {user.first_name} {user.mi && `${user.mi}.`} {user.last_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{user.contact_number || '-'}</td>
                    <td className="px-5 py-4 text-slate-600">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${roleStyles[user.role] ?? roleStyles.Staff}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{user.location || '-'}</td>
                    <td className="px-5 py-4 text-slate-600">{user.department || '-'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#0B5394] hover:text-[#0B5394] hover:bg-blue-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <UserModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={closeModal}
          isEditing={isEditing}
          saving={saving}
        />
      )}
    </div>
  );
}