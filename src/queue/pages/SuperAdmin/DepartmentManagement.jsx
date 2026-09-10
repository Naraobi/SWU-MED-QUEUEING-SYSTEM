import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase'; 
import { Search, Building2, Users, Clock, Monitor, Plus, X } from 'lucide-react';

const TABLE_NAME = 'departments';

const EMPTY_FORM = {
  department_name: '',
  kiosk_id: '',
  prefix: '',
  status: 'active',
};

const STATUS_OPTIONS = ['active', 'deactivated'];

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

function DepartmentModal({
  open,
  onClose,
  onSave,
  form,
  setForm,
  editingId,
  saving,
  kiosks,
  isEditing,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-700">
              {isEditing ? 'Edit Department' : 'Add New Department'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isEditing
                ? 'Update the department configuration below.'
                : 'Select a kiosk before configuring the department.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-5 px-6 py-5">

          {/* STEP 1 — KIOSK */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Kiosk
            </label>

            <div className="relative">
              <Monitor
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                value={form.kiosk_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    kiosk_id: e.target.value,
                  })
                }
                className="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-10 text-sm text-slate-700 transition focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B]"
              >
                <option value="">Select a kiosk</option>

                {kiosks.map((kiosk) => (
                  <option
                    key={kiosk.kiosk_id}
                    value={kiosk.kiosk_id}
                  >
                    {kiosk.name}
                  </option>
                ))}
              </select>

              {/* Custom dropdown arrow */}
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {!form.kiosk_id && !isEditing && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Select the kiosk where this department will be assigned.
              </p>
            )}
          </div>

          {/* STEP 2 — DEPARTMENT NAME */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Department Name
            </label>

            <input
              type="text"
              value={form.department_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  department_name: e.target.value,
                })
              }
              disabled={!form.kiosk_id}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder={
                form.kiosk_id
                  ? 'e.g. Laboratory'
                  : 'Select a kiosk first'
              }
            />

            {!form.kiosk_id && !isEditing && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Department name becomes available after selecting a kiosk.
              </p>
            )}
          </div>

          {/* STEP 3 — PREFIX + STATUS */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Queue Prefix Code
              </label>

              <input
                type="text"
                value={form.prefix}
                onChange={(e) =>
                  setForm({
                    ...form,
                    prefix: e.target.value,
                  })
                }
                disabled={!form.kiosk_id}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="e.g. L or P"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Status
              </label>

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
                  })
                }
                disabled={!form.kiosk_id}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-[#00529B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00529B] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={
              saving ||
              !form.kiosk_id ||
              !form.department_name.trim()
            }
            className="flex items-center gap-2 rounded-lg bg-[#00529B] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? 'Saving...'
              : isEditing
                ? 'Save Changes'
                : '+ Add Department'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPinModal({
  open,
  onClose,
  onConfirm,
  pinInput,
  setPinInput,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-700">
            Reset Department
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 px-6 py-5">
          <div>
            <p className="text-sm text-slate-600">
              Enter the administrator PIN to reset this department.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              This action only resets the frontend state.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Admin PIN
            </label>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter 4-digit PIN"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={pinInput.length !== 4}
            className="rounded-lg bg-[#00529B] px-5 py-2 text-sm font-medium text-white hover:bg-[#003F75] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Verify PIN
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentCrud() {
  const [departments, setDepartments] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const RESET_PIN = '2402';
  const [resettingId, setResettingId] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [showResetPin, setShowResetPin] = useState(false);

  // Initial Mock Sample Data to guarantee UI visuals matching screenshot when Supabase is empty
  const defaultDepartments = [
    { id: '1', department_name: 'Laboratory', location: 'Floor 2 Wing A', waiting: 24, current_queue: 'L-0025', active_terminals: '3/4', avg_wait: '24m', status: 'active' },
    { id: '2', department_name: 'Pharmacy', location: 'Ground Floor', waiting: 12, current_queue: 'P-0016', active_terminals: '5/5', avg_wait: '8m', status: 'active' },
    { id: '3', department_name: 'Radiology', location: 'Basement 1', waiting: 24, current_queue: 'L-025', active_terminals: '3/4', avg_wait: '24m', status: 'active' },
    { id: '4', department_name: 'Internal Medical', location: 'Ground Floor', waiting: 12, current_queue: 'P-0016', active_terminals: '5/5', avg_wait: '8m', status: 'active' },
    { id: '5', department_name: 'Billing/Payment', location: 'Basement 1', waiting: 24, current_queue: 'L-025', active_terminals: '3/4', avg_wait: '24m', status: 'active' },
  ];

  async function fetchKiosks() {
  const { data, error } = await supabase
  .from('kiosk')
  .select('kiosk_id, name, status')
  .order('name', { ascending: true });

  if (error) {
    console.error('FETCH KIOSKS ERROR:', error);
    return [];
  }
console.log('KIOSKS FROM SUPABASE:', data);

setKiosks(data || []);
return data || [];
}
async function fetchDepartments(kioskData = []) {
  setLoading(true);
  setError(null);

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        department_id,
        name,
        classification,
        location,
        prefix,
        status,
        est_time,
        kiosk_id
      `)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const formatted = (data || []).map((d) => ({
      id: d.department_id,
      department_name: d.name,
      kiosk_id: d.kiosk_id,
      kiosk_name:
        kioskData.find((k) => k.kiosk_id === d.kiosk_id)?.name ||
        'Unassigned',
      location: d.location || '',
      prefix: d.prefix || '',
      waiting: 0,
      current_queue: d.prefix
        ? `${d.prefix}-0010`
        : `${(d.name || 'D').charAt(0).toUpperCase()}-0010`,
      active_terminals: '3/4',
      avg_wait: d.est_time ? `${d.est_time}m` : '15m',
      status: d.status || 'active',
    }));

    setDepartments(formatted);
  } catch (err) {
    console.error('FETCH DEPARTMENTS ERROR:', err);
    setError(err.message || 'Failed to fetch departments.');
    setDepartments([]);
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  async function loadData() {
    const kioskData = await fetchKiosks();
    await fetchDepartments(kioskData);
  }

  loadData();
}, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId('new');
  }

  function openEdit(dept) {
  setForm({
    department_name: dept.department_name ?? '',
    kiosk_id: dept.kiosk_id ?? '',
    prefix: dept.prefix ?? '',
    status: dept.status ?? 'active',
  });

  setEditingId(dept.id);
}

  function closeModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSave() {
  if (!form.department_name.trim()) {
    setError('Department name is required.');
    return;
  }

  if (!form.kiosk_id) {
    setError('Please select a kiosk.');
    return;
  }

  setSaving(true);
  setError(null);

  try {
    if (editingId === 'new') {
      const { error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert([
          {
            name: form.department_name.trim(),
            kiosk_id: form.kiosk_id,
            prefix: form.prefix.trim() || null,
            status: form.status,
          },
        ]);

      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({
          name: form.department_name.trim(),
          kiosk_id: form.kiosk_id,
          prefix: form.prefix.trim() || null,
          status: form.status,
        })
        .eq('department_id', editingId);

      if (updateError) throw updateError;
    }

    closeModal();
await fetchDepartments(kiosks);
  } catch (err) {
    console.error('SAVE DEPARTMENT ERROR:', err);
    setError(err.message || 'Failed to save department.');
  } finally {
    setSaving(false);
  }
}

async function handleReset() {
  if (!resettingId) return;

  const department = departments.find(
    (dept) => dept.id === resettingId
  );

  if (!department) {
    setError('Department not found.');
    return;
  }

  // Reset frontend-only operational values.
  // No Supabase update/delete is performed here.
  setDepartments((currentDepartments) =>
    currentDepartments.map((dept) => {
      if (dept.id !== resettingId) {
        return dept;
      }

      return {
        ...dept,
        waiting: 0,
        current_queue: dept.prefix
          ? `${dept.prefix}-0010`
          : `${(dept.department_name || 'D')
              .charAt(0)
              .toUpperCase()}-0010`,
        active_terminals: '3/4',
        avg_wait: '15m',
      };
    })
  );

  setShowResetPin(false);
  setResettingId(null);
  setPinInput('');
  setError(null);
}

  // Summary Metrics calculations
  const totalWaiting = departments.reduce((acc, curr) => acc + (Number(curr.waiting) || 0), 0);
  const activeDepts = departments.filter(
  (d) => d.status?.toLowerCase() === 'active'
).length;
  const totalDepts = departments.length;

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const filteredDepartments = departments.filter((d) => {
  const query = searchQuery.toLowerCase();

  return (
    d.department_name.toLowerCase().includes(query) ||
    (d.kiosk_name || '').toLowerCase().includes(query) ||
    d.status.toLowerCase().includes(query)
  );
});

  // Pagination. currentPage is clamped so the view never lands past the last
  // page after a search, a delete, or a refetch shrinks the result set.
  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedDepartments = filteredDepartments.slice(firstIndex, firstIndex + PAGE_SIZE);

  const isModalOpen = editingId !== null;
  const isEditing = isModalOpen && editingId !== 'new';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Department Management</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Configure Structural nodes and associate operational counters.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-md bg-[#00529B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#003F75]"
        >
          <Plus size={15} /> Add Department
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Top 4 Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: DEPARTMENT */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">DEPARTMENT</span>
            <Building2 size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{activeDepts}/{totalDepts}</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">ACTIVE DEPARTMENTS</p>
          </div>
        </div>

        {/* Card 2: TOTAL WAITING */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL WAITING</span>
            <Users size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">{totalWaiting}</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">ACROSS ALL DEPARTMENT</p>
          </div>
        </div>

        {/* Card 3: AVERAGE WAIT */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">AVERAGE WAIT</span>
            <Clock size={18} className="text-slate-600" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-800">18m</p>
            <p className="mt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">AVERAGE WAIT TIME</p>
          </div>
        </div>

        {/* Card 4: TERMINAL */}
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

      {/* Main Department Overview Container */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Card Header & Search */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">Department Overview</h2>
          
          <div className="relative w-80">
            <input
              type="text"
              placeholder="Search department"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50/50 py-2 pl-4 pr-10 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            <Search size={15} className="absolute right-3.5 top-2.5 text-slate-400" />
          </div>
        </div>

        {/* Department Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3.5">DEPARTMENT</th>
                <th className="px-6 py-3.5">KIOSK</th>
                <th className="px-6 py-3.5 text-center">WAITING</th>
                <th className="px-6 py-3.5 text-center">CURRENT QUEUE</th>
                <th className="px-6 py-3.5 text-center">ACTIVE TERMINALS</th>
                <th className="px-6 py-3.5 text-center">AVG WAIT</th>
                <th className="px-6 py-3.5 text-right">STATUS</th>
                <th className="px-6 py-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    Loading departments...
                  </td>
                </tr>
              )}

              {!loading && filteredDepartments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No departments found matching your search.
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedDepartments.map((dept) => (
                  <tr
                    key={dept.id}
                    onClick={() => openEdit(dept)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {dept.department_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{dept.kiosk_name}</td>
                    <td className="px-6 py-4 text-center text-slate-700">{dept.waiting}</td>
                    <td className="px-6 py-4 text-center font-medium text-slate-700">{dept.current_queue}</td>
                    <td className="px-6 py-4 text-center text-slate-600">{dept.active_terminals}</td>
                    <td className="px-6 py-4 text-center text-slate-600">{dept.avg_wait}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={
                          dept.status === 'active'
                            ? 'text-slate-800'
                            : 'text-slate-500'
                        }>
                        {dept.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResettingId(dept.id);
                          setPinInput('');
                          setShowResetPin(true);
                        }}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          <span>
            {filteredDepartments.length === 0
              ? 'No departments to show'
              : `Showing ${firstIndex + 1} to ${firstIndex + paginatedDepartments.length} of ${filteredDepartments.length} departments`}
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

      {/* Department Volume Section Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">Department Volume</h2>
        <div className="mt-4 h-32 flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-400">Department volume charts and activity logs will render here.</p>
        </div>
      </div>

      {/* Add/Edit Department Modal */}
      {isModalOpen && (
        <DepartmentModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={closeModal}
          isEditing={isEditing}
          saving={saving}
          kiosks={kiosks}
        />
      )}
      <ResetPinModal
  open={showResetPin}
  onClose={() => {
    setShowResetPin(false);
    setResettingId(null);
    setPinInput('');
  }}
  onConfirm={() => {
  if (pinInput === RESET_PIN) {
    handleReset();
  } else {
    setError('Incorrect PIN.');
  }
}}
  pinInput={pinInput}
  setPinInput={setPinInput}
/>
    </div>
  );
}