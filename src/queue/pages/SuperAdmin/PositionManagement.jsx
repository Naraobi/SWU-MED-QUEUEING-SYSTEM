import { useMemo, useState } from 'react';
import {
  Search, Plus, PencilLine, Trash2, Grid2X2, Users, LayoutDashboard,
  Building2, Monitor, ShieldCheck, BriefcaseBusiness, List, Settings,
  BarChart3, Eye, EyeOff, Check, X, Info,
} from 'lucide-react';

/*
 * SWUMed Position Management
 * UI-only implementation based on the supplied Figma reference.
 * No backend/API code is changed or introduced.
 */

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'users', label: 'User Management', icon: Users },
  { key: 'departments', label: 'Department Management', icon: Building2 },
  { key: 'kiosks', label: 'Kiosk Management', icon: Monitor },
  { key: 'roles', label: 'Role Management', icon: ShieldCheck },
  { key: 'positions', label: 'Position Management', icon: BriefcaseBusiness },
  { key: 'queue', label: 'Queue Management', icon: List },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const INITIAL_POSITIONS = [
  { id: 1, name: 'Head Nurse', status: 'Active', tabs: ['dashboard','departments','queue','reports'], users: 8 },
  { id: 2, name: 'Receptionist', status: 'Active', tabs: ['dashboard','queue'], users: 8 },
  { id: 3, name: 'Department Head', status: 'Active', tabs: ['dashboard','departments','queue','reports','users','kiosks'], users: 5 },
  { id: 4, name: 'IT Administrator', status: 'Active', tabs: TABS.map(t => t.key), users: 2 },
  { id: 5, name: 'Staff Nurse', status: 'Active', tabs: ['dashboard','queue','reports'], users: 14 },
  { id: 6, name: 'Cashier', status: 'Active', tabs: ['dashboard','queue'], users: 6 },
  { id: 7, name: 'Pharmacist', status: 'Active', tabs: ['dashboard','queue','reports'], users: 4 },
  { id: 8, name: 'Lab Technician', status: 'Active', tabs: ['dashboard','queue','reports'], users: 7 },
  { id: 9, name: 'Radiology Staff', status: 'Active', tabs: ['dashboard','queue'], users: 5 },
  { id: 10, name: 'Billing Staff', status: 'Active', tabs: ['dashboard','queue'], users: 4 },
  { id: 11, name: 'Queue Officer', status: 'Active', tabs: ['dashboard','queue','reports'], users: 3 },
  { id: 12, name: 'System Auditor', status: 'Inactive', tabs: ['dashboard','reports'], users: 1 },
];

const blankDraft = () => ({ name: '', status: 'Active', tabs: [] });

function PositionModal({ mode, draft, setDraft, onClose, onSave, saving }) {
  const edit = mode === 'edit';
  const selectedCount = draft.tabs.length;

  const toggleTab = (key) => {
    setDraft(current => ({
      ...current,
      tabs: current.tabs.includes(key)
        ? current.tabs.filter(item => item !== key)
        : [...current.tabs, key],
    }));
  };

  const selectAll = () => {
    setDraft(current => ({ ...current, tabs: TABS.map(tab => tab.key) }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4 py-6 backdrop-blur-[1px]"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-[580px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">
                {edit ? 'Edit Position' : 'Add Position'}
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                {edit
                  ? 'Update the position name, status, and tab access.'
                  : 'Create a position and choose which tabs it can view.'}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {edit ? 'Last updated Sep 12, 2026' : <>Fields marked <span className="text-[#9D0A0E]">*</span> are required.</>}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-slate-700">
                Position Name <span className="text-[#9D0A0E]">*</span>
              </label>
              <input
                value={draft.name}
                onChange={e => setDraft(c => ({ ...c, name: e.target.value }))}
                placeholder="e.g. Head Nurse"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-slate-700">Status</label>
              <div className="flex h-9 rounded-lg bg-slate-100 p-0.5">
                {['Active','Inactive'].map(status => {
                  const active = draft.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setDraft(c => ({ ...c, status }))}
                      className={`flex-1 rounded-md px-2 text-[10px] font-medium ${
                        active
                          ? status === 'Active'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'bg-white text-slate-700 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      {status === 'Active' && active && <Check size={11} className="mr-1 inline" />}
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-end justify-between">
              <div>
                <label className="block text-[10px] font-medium text-slate-700">
                  Feature Access <span className="text-[#9D0A0E]">*</span>
                </label>
                <p className="mt-0.5 text-[9px] text-slate-400">Choose which sidebar tabs this position can see.</p>
              </div>
              <div className="flex items-center gap-2 text-[9px]">
                <span className="font-medium text-slate-500">{selectedCount} of {TABS.length} tabs</span>
                <button type="button" onClick={selectAll} className="font-semibold text-[#9D0A0E] hover:underline">Select all</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const selected = draft.tabs.includes(tab.key);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => toggleTab(tab.key)}
                    className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-left ${
                      selected ? 'border-[#9D0A0E]/60 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                      selected ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white' : 'border-slate-300 bg-white text-transparent'
                    }`}>
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded ${
                      selected ? 'bg-[#9D0A0E]/10 text-[#9D0A0E]' : 'bg-slate-50 text-slate-500'
                    }`}>
                      <Icon size={11} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {edit && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[9px] text-slate-500">
              <Info size={12} className="shrink-0 text-[#9D0A0E]" />
              Changes apply to all users with this position the next time they log in.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name.trim() || draft.tabs.length === 0}
            className="h-9 rounded-lg bg-[#9D0A0E] px-4 text-[10px] font-semibold text-white hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : edit ? 'Save Changes' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PositionManagement() {
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [selectedId, setSelectedId] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(blankDraft());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return positions.filter(position => {
      const textMatch = !q || position.name.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'All' || position.status === statusFilter;
      return textMatch && statusMatch;
    });
  }, [positions, searchQuery, statusFilter]);

  const selected = positions.find(p => p.id === selectedId) || filtered[0] || positions[0] || null;

  const openAdd = () => {
    setDraft(blankDraft());
    setModalMode('add');
  };

  const openEdit = () => {
    if (!selected) return;
    setDraft({ name: selected.name, status: selected.status, tabs: [...selected.tabs] });
    setModalMode('edit');
  };

  const savePosition = () => {
    if (!draft.name.trim() || draft.tabs.length === 0) return;
    setSaving(true);

    window.setTimeout(() => {
      if (modalMode === 'add') {
        const id = Math.max(0, ...positions.map(p => p.id)) + 1;
        const created = { id, name: draft.name.trim(), status: draft.status, tabs: draft.tabs, users: 0 };
        setPositions(current => [created, ...current]);
        setSelectedId(id);
      } else if (selected) {
        setPositions(current => current.map(p => p.id === selected.id
          ? { ...p, name: draft.name.trim(), status: draft.status, tabs: draft.tabs }
          : p
        ));
      }
      setSaving(false);
      setModalMode(null);
    }, 250);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (!window.confirm(`Delete the position "${selected.name}"?`)) return;
    const remaining = positions.filter(p => p.id !== selected.id);
    setPositions(remaining);
    setSelectedId(remaining[0]?.id || null);
  };

  return (
    <div className="min-h-full w-full bg-[#F1F3F5] text-slate-800">
      <div className="w-full p-0">
        <div className="mb-4 flex items-end justify-between gap-5">
          <div>
            <h1 className="text-[20px] font-semibold text-slate-800">Position Management</h1>
            <p className="mt-1 text-[11px] text-slate-500">Control which tabs each position can view in the system.</p>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#9D0A0E] px-5 text-[12px] font-semibold text-white shadow-sm hover:bg-[#7D080B]">
            <Plus size={14} /> Add Position
          </button>
        </div>

        <div className="grid min-h-[620px] grid-cols-[minmax(320px,27%)_minmax(0,1fr)] gap-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search positions"
                  className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[11px] outline-none placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{positions.length} positions</span>
                <div className="flex rounded-lg bg-slate-100 p-1">
                  {['All','Active','Inactive'].map(filter => (
                    <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={`rounded-md px-3 py-1.5 text-[10px] font-medium ${statusFilter === filter ? 'bg-white text-[#9D0A0E] shadow-sm' : 'text-slate-500'}`}>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              {filtered.map(position => {
                const active = selected?.id === position.id;
                return (
                  <button key={position.id} type="button" onClick={() => setSelectedId(position.id)} className={`relative flex w-full items-center gap-3 border-b border-slate-50 px-4 py-4 text-left ${active ? 'bg-[#9D0A0E]/5' : 'hover:bg-slate-50'}`}>
                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-[#9D0A0E]" />}
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{position.name}</span>
                    <span className="flex shrink-0 items-center gap-2.5 text-[9px] text-slate-400">
                      <span className="inline-flex items-center gap-0.5"><Grid2X2 size={11} />{position.tabs.length} tabs</span>
                      <span className="inline-flex items-center gap-0.5"><Users size={11} />{position.users} users</span>
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="px-3 py-10 text-center text-[11px] text-slate-400">No positions found.</div>}
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-center text-[10px] text-slate-400">Showing {filtered.length} of {positions.length} positions</div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700"><BriefcaseBusiness size={18} /></div>
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-semibold text-slate-800">{selected.name}</h2>
                      <p className="text-[10px] text-slate-500">{selected.status} position</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={openEdit} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[10px] font-medium text-slate-600 hover:bg-slate-50"><PencilLine size={12} />Edit</button>
                    <button type="button" onClick={deleteSelected} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[#9D0A0E] hover:border-[#9D0A0E]/30 hover:bg-[#9D0A0E]/5" aria-label="Delete position"><Trash2 size={12} /></button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_250px] gap-5">
                    <div>
                      <div className="mb-4 flex items-end justify-between">
                        <div>
                          <h3 className="text-[13px] font-semibold text-slate-800">Feature Access</h3>
                          <p className="mt-1 text-[10px] text-slate-400">This position can see tabs in the sidebar.</p>
                        </div>
                        <span className="text-[10px] text-slate-400">{selected.tabs.length} of {TABS.length} tabs visible</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        {TABS.map(tab => {
                          const Icon = tab.icon;
                          const visible = selected.tabs.includes(tab.key);
                          return (
                            <div key={tab.key} className={`flex min-h-[42px] items-center gap-3 rounded-lg border px-3 ${visible ? 'border-slate-200 bg-white' : 'border-transparent bg-slate-100'}`}>
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${visible ? 'bg-[#9D0A0E]/5 text-[#9D0A0E]' : 'bg-slate-200 text-slate-400'}`}><Icon size={13} /></div>
                              <span className={`min-w-0 flex-1 truncate text-[10px] ${visible ? 'font-medium text-slate-700' : 'text-slate-500'}`}>{tab.label}</span>
                              <span className={`inline-flex shrink-0 items-center gap-1 text-[9px] font-medium ${visible ? 'text-[#9D0A0E]' : 'text-slate-400'}`}>
                                {visible ? <><Eye size={10} />Visible</> : <><EyeOff size={10} />Hidden</>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <aside className="h-fit rounded-lg bg-slate-100/80 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Summary</p>
                      <div className="mt-4 space-y-4">
                        <div className="flex justify-between gap-3"><span className="text-[10px] text-slate-500">Visible tabs</span><span className="text-[10px] font-semibold text-slate-700">{selected.tabs.length} of {TABS.length}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-[10px] text-slate-500">Assigned users</span><span className="text-[10px] font-semibold text-slate-700">{selected.users}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-[10px] text-slate-500">Status</span><span className={`text-[10px] font-semibold ${selected.status === 'Active' ? 'text-emerald-600' : 'text-slate-500'}`}>{selected.status}</span></div>
                        <div className="flex justify-between gap-3"><span className="text-[10px] text-slate-500">Last updated</span><span className="text-[10px] font-semibold text-slate-700">Sep 12, 2026</span></div>
                      </div>
                    </aside>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[620px] items-center justify-center text-[12px] text-slate-400">Select a position to view its access.</div>
            )}
          </section>
        </div>
      </div>

      {modalMode && <PositionModal mode={modalMode} draft={draft} setDraft={setDraft} onClose={() => !saving && setModalMode(null)} onSave={savePosition} saving={saving} />}
    </div>
  );
}
