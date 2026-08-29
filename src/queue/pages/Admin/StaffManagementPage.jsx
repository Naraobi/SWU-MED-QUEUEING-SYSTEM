import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, UserCircle } from 'lucide-react';

const STAFF_ROWS = [
  { name: 'John doe', email: 'jodo.doe.swu@phinmaed.com', department: 'OPD', role: 'Dept Admin', status: 'Online', action: 'edit' },
  { name: 'Maria Piatos', email: 'jodo.doe.swu@phinmaed.com', department: 'IT OPS', role: 'Super admin', status: 'Offline', action: 'edit' },
  { name: 'Radiology', email: 'jodo.doe.swu@phinmaed.com', department: 'Billing/Payment', role: 'Staff', status: 'Online', action: 'edit' },
  { name: 'Internal Medical', email: 'jodo.doe.swu@phinmaed.com', department: 'Laboratory', role: 'Staff', status: 'Online', action: 'edit' },
  { name: 'Billing/Payment', email: 'jodo.doe.swu@phinmaed.com', department: 'Pharmacy', role: 'Staff', status: 'Online', action: 'edit' },
];

const sampleStats = [
  { label: 'Staff', value: '6/8', sub: 'Staff on duty' },
  { label: 'Total Staff', value: '145', sub: 'Total staff' },
  { label: 'Average Wait', value: '18m', sub: 'Average wait time' },
  { label: 'Completed', value: '255', sub: 'Completed queuing' },
  { label: 'Skipped', value: '3/4', sub: 'Active terminals' },
  { label: 'Terminal', value: '3/4', sub: 'Active terminals' },
];

export default function StaffManagementPage() {
  const [query, setQuery] = useState('');

  const filteredStaff = useMemo(() => {
    if (!query.trim()) return STAFF_ROWS;

    const value = query.toLowerCase();
    return STAFF_ROWS.filter((staff) =>
      [staff.name, staff.email, staff.department, staff.role].some((field) =>
        field.toLowerCase().includes(value)
      )
    );
  }, [query]);

  return (
    <div className="rounded-xl bg-slate-100 p-0">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">Staff Management</h1>
          <p className="mt-1 text-sm text-slate-500">Manage Staff</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#00549A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#004880]"
        >
          <Plus size={16} />
          Add Staff
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        {sampleStats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{stat.label}</p>
              <UserCircle size={16} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-2xl font-semibold text-slate-700">Staff</h2>

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
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((person, index) => (
                <tr key={`${person.name}-${index}`} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-700">{person.name}</td>
                  <td className="px-5 py-3 text-slate-600">{person.email}</td>
                  <td className="px-5 py-3 text-slate-600">{person.department}</td>
                  <td className="px-5 py-3 text-slate-600">{person.role}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        person.status === 'Online'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {person.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-3 text-slate-500">
                      <button type="button" aria-label="Edit staff" className="hover:text-blue-600">
                        <Pencil size={16} />
                      </button>
                      <button type="button" aria-label="Delete staff" className="hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStaff.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No staff match your search.</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          <span>Showing 1 to 5 of 25 users</span>

          <div className="flex items-center gap-2">
            <button type="button" className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50">
              Prev
            </button>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded-md bg-slate-200 px-2.5 py-1.5 text-slate-700">1</button>
              <button type="button" className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50">2</button>
              <button type="button" className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50">3</button>
            </div>
            <button type="button" className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
