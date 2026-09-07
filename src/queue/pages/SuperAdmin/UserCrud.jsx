import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase'; 
import { Search, User, Users, Contact, UserCheck, Monitor } from 'lucide-react';

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
const PAGE_SIZE = 5;

// Returns up to 5 page numbers, windowed around the current page.
function getPageNumbers(currentPage, totalPages) {
  const MAX_BUTTONS = 5;
  if (totalPages <= MAX_BUTTONS) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  let start = Math.max(1, currentPage - Math.floor(MAX_BUTTONS / 2));
  start = Math.min(start, totalPages - MAX_BUTTONS + 1);
  return Array.from({ length: MAX_BUTTONS }, (_, i) => start + i);
}

const LOCATION_OPTIONS = [
  'Main Lobby',
  'Laboratory and Radiology',
  'Out patients',
  'Medical Arts Building',
];
const DEPARTMENT_OPTIONS = [
  'Information', 'Admission', 'CHAMP', 'Cashier', 'Billing', 'Credit and Collection', 
  'Medical Social worker', 'Phil Health', 'Lab-Specimen Collection', 'Lab- Results', 'Rad Results', 'X-ray',
  'CT-Scan', 'Pharmacy', 'Womens Health'
];

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
            className="font-bold text-slate-400 hover:text-slate-600" 
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">First Name</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Last Name</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">M.I.</label>
              <input
                type="text"
                maxLength="2"
                value={form.mi}
                onChange={(e) => setForm({ ...form, mi: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                placeholder="Enter M.I."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Contact Number</label>
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
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email Address</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Select Role</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Select Location</label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Select Department</label>
            <select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {!isEditing && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Password</label>
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
        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.first_name.trim() || !form.last_name.trim() || !form.email.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#00529B] px-5 py-2 text-sm font-medium text-white hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving...' : (isEditing ? 'Save Changes' : '+ Add User')}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [editingId, setEditingId] = useState(null); 
  const [form, setForm] = useState(EMPTY_FORM);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    
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
      const formattedUsers = data.map((u) => ({
        id: u.user_id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        contact_number: u.contact_info,
        location: u.location,
        department: u.department,
        status: u.status ?? 'ONLINE',
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

        const { error: dbError } = await supabase.from(TABLE_NAME).insert([{
          user_id: authData.user.id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          contact_info: form.contact_number, 
          location: form.location,
          department: form.department,
          role_id: currentRoleId,
          status: 'ONLINE'
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

  // Calculated Summary Metrics based on users state
  const superAdminCount = users.filter((u) => u.role?.toLowerCase().includes('super')).length;
  const deptAdminCount = users.filter((u) => u.role?.toLowerCase().includes('admin') && !u.role?.toLowerCase().includes('super')).length;
  const staffCount = users.filter((u) => u.role?.toLowerCase().includes('staff')).length;
  const onlineCount = users.filter((u) => u.status?.toUpperCase() === 'ONLINE' || u.status?.toUpperCase() === 'ACTIVE').length;

  // Filtered Users List
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.department?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query)
    );
  });

  // Pagination. currentPage is clamped so the view never lands past the last
  // page after a search, a delete, or a refetch shrinks the result set.
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedUsers = filteredUsers.slice(firstIndex, firstIndex + PAGE_SIZE);

  const isModalOpen = editingId !== null;
  const isEditing = isModalOpen && editingId !== 'new';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage system users, roles, and department assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-md bg-[#00529B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#003F75]"
        >
          <span className="text-sm leading-none">+</span> Add User
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Top 5 Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: SUPER ADMIN */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SUPER ADMIN</span>
            <User size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{superAdminCount}</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">TOTAL SUPER ADMIN</p>
          </div>
        </div>

        {/* Card 2: DEPT ADMIN */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">DEPT ADMIN</span>
            <Users size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{deptAdminCount}</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">TOTAL DEPT ADMIN</p>
          </div>
        </div>

        {/* Card 3: STAFF */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">STAFF</span>
            <Contact size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{staffCount}</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">TOTAL STAFF</p>
          </div>
        </div>

        {/* Card 4: ACTIVE */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ACTIVE</span>
            <UserCheck size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{onlineCount}/128</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">ADMIN/STAFF ON DUTY</p>
          </div>
        </div>

        {/* Card 5: TERMINAL */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TERMINAL</span>
            <Monitor size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">42</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">ACTIVE TERMINAL</p>
          </div>
        </div>
      </div>

      {/* Main Users Table Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Table Title & Search Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">Users</h2>
          
          <div className="relative w-80">
            <input
              type="text"
              placeholder="Search user"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 py-2 pl-4 pr-10 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            <Search size={15} className="absolute right-3.5 top-2.5 text-slate-400" />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5">FULL NAME</th>
                <th className="px-6 py-3.5">EMAIL</th>
                <th className="px-6 py-3.5">DEPARTMENT</th>
                <th className="px-6 py-3.5">ROLE</th>
                <th className="px-6 py-3.5">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              )}

              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => openEdit(user)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 text-slate-600">{user.department || 'OPD'}</td>
                    <td className="px-6 py-4 text-slate-600 capitalize">{user.role}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-semibold ${
                        user.status?.toUpperCase() === 'ONLINE' || user.status?.toUpperCase() === 'ACTIVE'
                          ? 'text-slate-700'
                          : 'text-slate-400'
                      }`}>
                        {user.status?.toUpperCase() || 'OFFLINE'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          <span>
            {filteredUsers.length === 0
              ? 'No users to show'
              : `Showing ${firstIndex + 1} to ${firstIndex + paginatedUsers.length} of ${filteredUsers.length} users`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50"
            >
              Prev
            </button>

            {getPageNumbers(currentPage, totalPages).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? 'page' : undefined}
                className={`rounded-md border border-slate-200 px-3 py-1 transition ${
                  n === currentPage
                    ? 'bg-white font-semibold text-slate-700 shadow-sm'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:opacity-50"
            >
              Next
            </button>
          </div>
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