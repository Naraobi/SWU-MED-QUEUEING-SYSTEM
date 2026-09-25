import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, PencilLine, Trash2, Grid2X2, Users, LayoutDashboard,
  Building2, Monitor, ShieldCheck, BriefcaseBusiness, List, Settings,
  BarChart3, Eye, EyeOff, Check, X, Info, AlertTriangle,
} from 'lucide-react';

import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from '../../services/backendApi';

/*
 * SWUMed Position Management
 *
 * All position data comes from the backend. There is no seeded or
 * placeholder data in this file - an empty database renders an empty state.
 *
 * Expected position row from GET /api/positions:
 *   { position_id, name, status, tabs: [...], users, updated_at }
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

const blankDraft = () => ({ name: '', status: 'Active', tabs: [] });

/* ---------------------------------------------------------------
   Normalises whatever shape the backend returns into what the UI
   reads, without inventing values. Missing fields stay missing.
--------------------------------------------------------------- */
function normalizePosition(row) {
  return {
    id:
      row.position_id ??
      row.id ??
      row.firestore_id ??
      '',
    name: row.name ?? row.position_name ?? '',
    status:
      String(row.status ?? '').toLowerCase() === 'inactive'
        ? 'Inactive'
        : 'Active',
    tabs: Array.isArray(row.tabs)
      ? row.tabs
      : typeof row.tabs === 'string' && row.tabs
        ? row.tabs.split(',').map(t => t.trim()).filter(Boolean)
        : [],
    users: Number.isFinite(Number(row.users)) ? Number(row.users) : null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* =========================================================
   MODAL
========================================================= */

function PositionModal({ mode, draft, setDraft, onClose, onSave, saving, lastUpdated, error }) {
  const edit = mode === 'edit';
  const selectedCount = draft.tabs.length;
  const allSelected = selectedCount === TABS.length;

  const toggleTab = (key) => {
    setDraft(current => ({
      ...current,
      tabs: current.tabs.includes(key)
        ? current.tabs.filter(item => item !== key)
        : [...current.tabs, key],
    }));
  };

  const selectAll = () => {
    setDraft(current => ({
      ...current,
      tabs: allSelected ? [] : TABS.map(tab => tab.key),
    }));
  };

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="swu-pop w-full max-w-[580px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl">
        <div className="border-b border-[#E5E7EB] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#1F2937]">
                {edit ? 'Edit Position' : 'Add Position'}
              </h2>
              <p className="mt-1 text-xs text-[#4B5563]">
                {edit
                  ? 'Update the position name, status, and tab access.'
                  : 'Create a position and choose which tabs it can view.'}
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {edit
                  ? `Last updated ${formatDate(lastUpdated)}`
                  : <>Fields marked <span className="text-[#9D0A0E]">*</span> are required.</>}
              </p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} className="rounded-md p-1 text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50" aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
            <div>
              <label htmlFor="position-name" className="mb-1.5 block text-xs font-medium text-[#1F2937]">
                Position Name <span className="text-[#9D0A0E]">*</span>
              </label>
              <input
                id="position-name"
                value={draft.name}
                onChange={e => setDraft(c => ({ ...c, name: e.target.value }))}
                placeholder="e.g. Head Nurse"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-[#1F2937]">Status</span>
              <div className="flex h-9 rounded-lg bg-[#F1F3F5] p-0.5">
                {['Active','Inactive'].map(status => {
                  const active = draft.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setDraft(c => ({ ...c, status }))}
                      aria-pressed={active}
                      className={`flex-1 rounded-md px-2 text-xs font-medium transition ${
                        active
                          ? status === 'Active'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'bg-white text-[#1F2937] shadow-sm'
                          : 'text-[#4B5563]'
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
                <span className="block text-xs font-medium text-[#1F2937]">
                  Feature Access <span className="text-[#9D0A0E]">*</span>
                </span>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">Choose which sidebar tabs this position can see.</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-[#4B5563]">{selectedCount} of {TABS.length} tabs</span>
                <button type="button" onClick={selectAll} className="font-semibold text-[#9D0A0E] hover:underline">
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isSelected = draft.tabs.includes(tab.key);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => toggleTab(tab.key)}
                    aria-pressed={isSelected}
                    className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-left transition ${
                      isSelected ? 'border-[#9D0A0E] bg-white' : 'border-[#E5E7EB] bg-white hover:border-[#9CA3AF]'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white' : 'border-[#9CA3AF] bg-white text-transparent'
                    }`}>
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded ${
                      isSelected ? 'bg-[#FBF1F1] text-[#9D0A0E]' : 'bg-[#F8F9FA] text-[#4B5563]'
                    }`}>
                      <Icon size={11} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#1F2937]">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {edit && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#FBF1F1] px-3 py-2 text-xs text-[#4B5563]">
              <Info size={12} className="shrink-0 text-[#9D0A0E]" />
              Changes apply to all users with this position the next time they log in.
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name.trim() || draft.tabs.length === 0}
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {saving ? 'Saving...' : edit ? 'Save Changes' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DELETE CONFIRM
========================================================= */

function DeletePositionModal({ position, onCancel, onConfirm, deleting }) {
  return (
    <div className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="swu-pop w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="px-7 pb-5 pt-7 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <Trash2 size={18} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">Delete Position</h2>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#4B5563]">
            Users assigned to <span className="font-semibold text-[#1F2937]">{position.name}</span> will lose the tab access it grants. This cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-7 py-4">
          <button type="button" onClick={onCancel} disabled={deleting} className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="swu-press rounded-lg bg-[#9D0A0E] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function PositionManagement() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(blankDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const rows = await getPositions();
      const list = (Array.isArray(rows) ? rows : []).map(normalizePosition);
      setPositions(list);
      setSelectedId(current =>
        list.some(p => p.id === current) ? current : list[0]?.id ?? null
      );
    } catch (error) {
      setPositions([]);
      setSelectedId(null);
      setLoadError(error?.message || 'Failed to load positions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return positions.filter(position => {
      const textMatch = !q || position.name.toLowerCase().includes(q);
      const statusMatch = statusFilter === 'All' || position.status === statusFilter;
      return textMatch && statusMatch;
    });
  }, [positions, searchQuery, statusFilter]);

  const selected =
    positions.find(p => p.id === selectedId) || filtered[0] || positions[0] || null;

  const openAdd = () => {
    setDraft(blankDraft());
    setSaveError(null);
    setModalMode('add');
  };

  const openEdit = () => {
    if (!selected) return;
    setDraft({ name: selected.name, status: selected.status, tabs: [...selected.tabs] });
    setSaveError(null);
    setModalMode('edit');
  };

  async function savePosition() {
    if (!draft.name.trim() || draft.tabs.length === 0) return;

    setSaving(true);
    setSaveError(null);

    const payload = {
      name: draft.name.trim(),
      status: draft.status,
      tabs: draft.tabs,
    };

    try {
      if (modalMode === 'add') {
        const created = await createPosition(payload);
        setModalMode(null);
        await loadPositions();
        if (created?.position_id) setSelectedId(created.position_id);
      } else if (selected) {
        await updatePosition(selected.id, payload);
        setModalMode(null);
        await loadPositions();
      }
    } catch (error) {
      setSaveError(error?.message || 'Failed to save the position.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);

    try {
      await deletePosition(pendingDelete.id);
      setPendingDelete(null);
      await loadPositions();
    } catch (error) {
      setLoadError(error?.message || 'Failed to delete the position.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">

      <div className="flex items-end justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Position Management</h1>
          <p className="mt-0.5 text-xs text-[#4B5563]">Control which tabs each position can view in the system.</p>
        </div>
        <button type="button" onClick={openAdd} className="swu-press flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25">
          <Plus size={14} /> Add Position
        </button>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {loadError}
            <button type="button" onClick={loadPositions} className="ml-2 font-semibold underline">Retry</button>
          </div>
        </div>
      )}

      <div className="grid min-h-[620px] grid-cols-[minmax(280px,24%)_minmax(0,1fr)] gap-5">

        {/* ---------- LIST ---------- */}

        <section className="swu-enter flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="border-b border-[#E5E7EB] p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search positions"
                aria-label="Search positions"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] pl-9 pr-3 text-xs text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-[#4B5563]">{positions.length} positions</span>
              <div className="flex rounded-lg bg-[#F1F3F5] p-0.5">
                {['All','Active','Inactive'].map(filter => (
                  <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${statusFilter === filter ? 'bg-white text-[#9D0A0E] shadow-sm' : 'text-[#4B5563]'}`}>
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[520px] flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading && (
              <div className="px-3 py-10 text-center text-xs text-[#9CA3AF]">Loading positions...</div>
            )}

            {!loading && filtered.map(position => {
              const active = selected?.id === position.id;
              return (
                <button key={position.id} type="button" onClick={() => setSelectedId(position.id)} className={`relative flex w-full items-center gap-3 border-b border-[#F1F3F5] px-4 py-3 text-left transition-all duration-200 ${active ? 'bg-[#FBF1F1]' : 'hover:translate-x-1 hover:bg-[#FBF1F1]'}`}>
                  {active && <span className="absolute inset-y-0 left-0 w-1 bg-[#9D0A0E]" />}
                  <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${active ? 'text-[#9D0A0E]' : 'text-[#1F2937]'}`}>{position.name}</span>
                  <span className="flex shrink-0 items-center gap-2.5 text-xs text-[#9CA3AF]">
                    <span className="inline-flex items-center gap-0.5"><Grid2X2 size={11} />{position.tabs.length} tabs</span>
                    <span className="inline-flex items-center gap-0.5"><Users size={11} />{position.users ?? '--'} users</span>
                  </span>
                </button>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div className="px-3 py-10 text-center text-xs text-[#9CA3AF]">
                {positions.length === 0 ? 'No positions yet.' : 'No positions found.'}
              </div>
            )}
          </div>

          <div className="border-t border-[#E5E7EB] px-4 py-3 text-center text-xs text-[#9CA3AF]">
            Showing {filtered.length} of {positions.length} positions
          </div>
        </section>

        {/* ---------- DETAIL ---------- */}

        <section className="swu-enter overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F3F5] text-[#4B5563]"><BriefcaseBusiness size={16} /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[#1F2937]">{selected.name}</h2>
                    <p className="mt-0.5 text-xs text-[#9CA3AF]">{selected.status} position</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={openEdit} className="swu-press inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-xs font-medium text-[#4B5563] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"><PencilLine size={12} />Edit</button>
                  <button type="button" onClick={() => setPendingDelete(selected)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#9D0A0E] transition hover:border-[#F0DADA] hover:bg-[#FBF1F1]" aria-label="Delete position"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_190px] gap-5">
                  <div>
                    <div className="mb-4">
                      <div className="flex items-baseline gap-3">
                        <h3 className="text-sm font-semibold text-[#1F2937]">Feature Access</h3>
                        <span className="text-xs text-[#9CA3AF]">{selected.tabs.length} of {TABS.length} tabs visible</span>
                      </div>
                      <p className="mt-1 text-xs text-[#9CA3AF]">Tabs this position can see in the sidebar.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {TABS.map(tab => {
                        const Icon = tab.icon;
                        const visible = selected.tabs.includes(tab.key);
                        return (
                          <div key={tab.key} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${visible ? 'border-[#E5E7EB] bg-white' : 'border-transparent bg-[#F1F3F5]'}`}>
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${visible ? 'bg-[#FBF1F1] text-[#9D0A0E]' : 'bg-[#E5E7EB] text-[#9CA3AF]'}`}><Icon size={13} /></div>
                            <span className={`min-w-0 flex-1 truncate text-xs ${visible ? 'font-medium text-[#1F2937]' : 'text-[#4B5563]'}`}>{tab.label}</span>
                            <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${visible ? 'text-[#9D0A0E]' : 'text-[#9CA3AF]'}`}>
                              {visible ? <><Eye size={10} />Visible</> : <><EyeOff size={10} />Hidden</>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="h-fit rounded-lg bg-[#F8F9FA] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">Summary</p>
                    <div className="mt-3 space-y-3">
                      <div className="flex justify-between gap-3"><span className="text-xs text-[#4B5563]">Visible tabs</span><span className="text-xs font-semibold text-[#1F2937]">{selected.tabs.length} of {TABS.length}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-xs text-[#4B5563]">Last updated</span><span className="text-xs font-semibold text-[#1F2937]">{formatDate(selected.updatedAt)}</span></div>
                    </div>
                  </aside>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[620px] items-center justify-center px-6 text-center text-xs text-[#9CA3AF]">
              {loading
                ? 'Loading positions...'
                : positions.length === 0
                  ? 'No positions yet. Use Add Position to create one.'
                  : 'Select a position to view its access.'}
            </div>
          )}
        </section>
      </div>

      {modalMode && (
        <PositionModal
          mode={modalMode}
          draft={draft}
          setDraft={setDraft}
          onClose={() => !saving && setModalMode(null)}
          onSave={savePosition}
          saving={saving}
          lastUpdated={selected?.updatedAt}
          error={saveError}
        />
      )}

      {pendingDelete && (
        <DeletePositionModal
          position={pendingDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}