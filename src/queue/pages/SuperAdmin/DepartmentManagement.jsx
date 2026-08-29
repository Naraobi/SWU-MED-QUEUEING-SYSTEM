import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../../../supabase';

const TABLE_NAME = 'departments';

const LOCATION_OPTIONS = [
  'Main Lobby',
  'Laboratory and Radiology',
  'Out patients',
  'Medical Arts Building',
];

const EMPTY_FORM = {
  name: '',
  location: '',
  prefix: '',
  status: 'active',
};

function DepartmentModal({ form, setForm, onSave, onClose, isEditing, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0B2447]">
            {isEditing ? 'Edit Department' : 'Add New Department'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            &#10005;
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Department Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Radiology"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Department Location</label>
            <select
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none bg-white"
            >
              <option value="" disabled>Select Location</option>
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Queue Prefix</label>
            <input
              type="text"
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
              placeholder="e.g., RD"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none"
            />
          </div>

          {/* Status field visible only when editing */}
          {isEditing && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0B2447] focus:outline-none bg-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !form.name.trim() || !form.location}
              className="rounded-lg bg-[#0B2447] px-4 py-2 text-xs font-medium text-white hover:bg-[#0B2447]/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Department'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null); 
  const [form, setForm] = useState(EMPTY_FORM);

  async function fetchDepartments() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setDepartments(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDepartments();
  }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId('new');
  }

  function openEdit(dept) {
    // Safely capture ID checking common alternatives if column name differs
    const rowId = dept.id ?? dept.department_id ?? dept.dept_id;
    
    setForm({
      name: dept.name ?? '',
      location: dept.location ?? '',
      prefix: dept.prefix ?? '',
      status: dept.status ?? 'active',
    });
    setEditingId(rowId);
  }

  function closeModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.location) return;
    setSaving(true);
    setError(null);

    // Dynamically detect which primary key column name your table uses
    const sampleDept = departments[0];
    const idColumnName = sampleDept?.id !== undefined ? 'id' : sampleDept?.department_id !== undefined ? 'department_id' : 'dept_id';

    if (editingId === 'new') {
      const payload = {
        name: form.name.trim(),
        location: form.location,
        prefix: form.prefix.trim(),
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(TABLE_NAME).insert([payload]);
      if (error) setError(error.message);
    } else {
      const payload = {
        name: form.name.trim(),
        location: form.location,
        prefix: form.prefix.trim(),
        status: form.status,
      };

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq(idColumnName, editingId); // Uses the verified primary key column name

      if (error) setError(error.message);
    }

    setSaving(false);
    if (!error) {
      closeModal();
      fetchDepartments();
    }
  }

  async function handleQuickDelete(dept) {
    const rowId = dept.id ?? dept.department_id ?? dept.dept_id;
    const sampleDept = departments[0];
    const idColumnName = sampleDept?.id !== undefined ? 'id' : sampleDept?.department_id !== undefined ? 'department_id' : 'dept_id';

    const confirmed = window.confirm(`Remove ${dept.name} from the system?`);
    if (!confirmed) return;

    const { error } = await supabase.from(TABLE_NAME).delete().eq(idColumnName, rowId);
    if (error) {
      setError(error.message);
    } else {
      fetchDepartments();
    }
  }

  const isModalOpen = editingId !== null;
  const isEditing = isModalOpen && editingId !== 'new';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Department Management</h1>
          <p className="text-sm text-slate-500">Configure structural nodes and associate operational counters.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-lg bg-[#0B2447] px-4 py-2 text-xs font-medium text-white hover:bg-[#0B2447]/90"
        >
          <Plus size={14} /> Add Department
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
            <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3 font-medium">Dept Name</th>
              <th className="px-5 py-3 font-medium">Location</th>
              <th className="px-5 py-3 font-medium">Prefix</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                  Loading departments...
                </td>
              </tr>
            )}

            {!loading && departments.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                  No departments yet. Click "Add Department" to create one.
                </td>
              </tr>
            )}

            {!loading &&
              departments.map((dept) => {
                const rowId = (dept.id ?? dept.department_id ?? dept.dept_id) || Math.random();
                return (
                  <tr key={rowId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-700">{dept.name}</td>
                    <td className="px-5 py-3 text-slate-600">{dept.location}</td>
                    <td className="px-5 py-3 text-slate-600">{dept.prefix}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          dept.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${dept.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {dept.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(dept)}
                          className="text-slate-400 hover:text-[#0B2447]"
                          aria-label="Edit department"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickDelete(dept)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete department"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <DepartmentModal
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