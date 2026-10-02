import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  PencilLine,
  Trash2,
  Users,
  BriefcaseBusiness,
  Check,
  X,
  Info,
  AlertTriangle,
} from 'lucide-react';

import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
  getUsers,
} from '../../services/backendApi';
import AddPositionModal from '../../components/modals/AddPositionModal';
const blankDraft = () => ({ name: '', status: 'Active' });

/* ---------------------------------------------------------------
   Normalises whatever shape the backend returns into what the UI
   reads, without inventing values. Missing fields stay missing.
--------------------------------------------------------------- */
function normalizePosition(row) {
  return {
    id: row.position_id ?? row.id ?? row.firestore_id ?? '',
    name: row.name ?? row.position_name ?? '',
    status:
      String(row.status ?? '').toLowerCase() === 'inactive'
        ? 'Inactive'
        : 'Active',
    description: row.description ?? row.position_description ?? '',
    // Kept so an edit does not wipe a column this screen no longer shows.
    tabs: Array.isArray(row.tabs)
      ? row.tabs
      : typeof row.tabs === 'string' && row.tabs
        ? row.tabs.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    users: Number.isFinite(Number(row.users)) ? Number(row.users) : null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normalizeUser(row) {
  const first = row.first_name ?? '';
  const last = row.last_name ?? '';
  const full = row.full_name ?? `${first} ${last}`.trim();

  const roleName =
    typeof row.role === 'object' ? row.role?.role ?? '' : row.role ?? '';

  const departmentName =
    typeof row.department === 'object'
      ? row.department?.name ?? ''
      : row.department ?? '';

  const positionName =
    typeof row.position === 'object'
      ? row.position?.name ?? ''
      : row.position ?? '';

  return {
    id: row.user_id ?? row.id ?? row.email ?? full,
    name: full,
    email: row.email ?? '',
    role: roleName,
    department: departmentName,
    position: positionName,
    status:
      String(row.status ?? 'active').toLowerCase() === 'inactive'
        ? 'Inactive'
        : 'Active',
  };
}

function initials(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]);

  return parts.join('').toUpperCase() || '?';
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

/*
 * Matching is by position NAME, because the user rows carry a name rather
 * than a position_id. It is case-insensitive and trimmed so "Head Nurse"
 * and "head nurse " land in the same bucket.
 *
 * FOR THE BACKEND TEAM: a users.position_id column, or a
 * GET /api/positions/:id/users endpoint, would make this exact instead of
 * best-effort. Until then, renaming a position orphans its users here.
 */
function buildAssignments(users, positionName) {
  const target = String(positionName || '').trim().toLowerCase();
  if (!target) return [];

  return users.filter(
    (user) => String(user.position || '').trim().toLowerCase() === target
  );
}

/* =========================================================
   ADD / EDIT MODAL
========================================================= */
function PositionModal({
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
  lastUpdated,
  error,
}) {

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="position-modal-title"
              className="text-base font-bold text-[#1F2937]"
            >
           Edit Position
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
            Update the position name and status.
            </p>

            <p className="mt-0.5 text-xs text-[#9CA3AF]">
           {`Last updated ${formatDate(lastUpdated)}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-[minmax(0,1fr)_200px] gap-4">
            <div>
              <label
                htmlFor="position-name"
                className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
              >
                Position Name <span className="text-[#9D0A0E]">*</span>
              </label>

              <input
                id="position-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Head Nurse"
                className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-[#1F2937]">
                Status
              </span>

              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F1F3F5] p-1">
                {['Active', 'Inactive'].map((value) => {
                  const on = draft.status === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({ ...current, status: value }))
                      }
                      aria-pressed={on}
                      className={`flex h-8 items-center justify-center gap-1 rounded-md text-xs font-medium transition ${
                        on
                          ? value === 'Active'
                            ? 'border border-[#86EFAC] bg-[#E8F8F0] text-[#0D8A4E] shadow-sm'
                            : 'border border-[#E5E7EB] bg-white text-[#1F2937] shadow-sm'
                          : 'text-[#4B5563] hover:text-[#1F2937]'
                      }`}
                    >
                      {on && value === 'Active' && <Check size={12} />}
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#FBF1F1] px-3 py-2 text-xs leading-5 text-[#4B5563]">
            <Info size={12} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
            Position identifies the employee&apos;s job title. System access is
            controlled by Role.
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DELETE CONFIRM
========================================================= */

function DeletePositionModal({
  position,
  assignedCount,
  onCancel,
  onConfirm,
  deleting,
}) {
  // Reassigning first is the backend's rule, so the button follows it here.
  const blocked = assignedCount > 0;

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-position-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="relative px-7 pb-5 pt-7 text-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937] disabled:opacity-50"
          >
            <X size={16} />
          </button>

          <h2
            id="delete-position-title"
            className="text-lg font-bold text-[#1F2937]"
          >
            Delete Position?
          </h2>

          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#4B5563]">
            Are you sure you want to delete the{' '}
            <span className="font-semibold text-[#1F2937]">
              {position.name}
            </span>{' '}
            position? This action cannot be undone.
          </p>

          {blocked && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-left text-xs leading-5 text-[#4B5563]">
              <AlertTriangle
                size={13}
                className="mt-0.5 shrink-0 text-[#9D0A0E]"
              />
              <span>
                <span className="font-semibold text-[#1F2937]">
                  {assignedCount} user{assignedCount === 1 ? ' is' : 's are'}
                </span>{' '}
                currently assigned to this position. Please reassign
                {assignedCount === 1 ? ' this user' : ' these users'} before
                deleting the position.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-7 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting || blocked}
            title={
              blocked ? 'Reassign the users on this position first.' : undefined
            }
            className="swu-press rounded-lg bg-[#9D0A0E] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            {deleting ? 'Deleting...' : 'Delete Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ASSIGNED USERS TABLE
========================================================= */

function RoleBadge({ role }) {
  const label = role || '--';
  const elevated = /admin/i.test(label);

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        elevated
          ? 'bg-[#FBF1F1] text-[#9D0A0E]'
          : 'bg-[#F1F3F5] text-[#4B5563]'
      }`}
    >
      {label}
    </span>
  );
}

function AssignedUsersTable({ users, loading, error }) {
  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-xs text-[#9CA3AF]">
        Loading assigned users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-4 my-4 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs text-[#9D0A0E]">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {error}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-xs text-[#9CA3AF]">
        No users are assigned to this position yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#E5E7EB]">
            <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              User
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Department
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
              System Role
            </th>
          </tr>
        </thead>

        <tbody className="swu-stagger">
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-b border-[#F1F3F5] transition-colors last:border-b-0 hover:bg-[#F8F9FA]"
            >
              <td className="px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E4EAF4] text-[11px] font-semibold text-[#3E4A61]"
                  >
                    {initials(user.name)}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[#1F2937]">
                      {user.name || '--'}
                    </span>
                    <span className="block truncate text-xs text-[#9CA3AF]">
                      {user.email || '--'}
                    </span>
                  </span>
                </div>
              </td>

              <td className="px-4 py-2.5 text-xs text-[#4B5563]">
                {user.department || '--'}
              </td>

              <td className="px-4 py-2.5">
                <RoleBadge role={user.role} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [modalMode, setModalMode] = useState(null);
  const [draft, setDraft] = useState(blankDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const rows = await getPositions();
      const list = (Array.isArray(rows) ? rows : []).map(normalizePosition);

      setPositions(list);
      setSelectedId((current) =>
        list.some((p) => p.id === current) ? current : list[0]?.id ?? null
      );
    } catch (error) {
      setPositions([]);
      setSelectedId(null);
      setLoadError(error?.message || 'Failed to load positions.');
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Users are loaded once for the whole screen rather than per position.
   * The list is small and switching positions then costs nothing.
   */
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const rows = await getUsers();
      setUsers((Array.isArray(rows) ? rows : []).map(normalizeUser));
    } catch (error) {
      setUsers([]);
      setUsersError(error?.message || 'Failed to load assigned users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
    loadUsers();
  }, [loadPositions, loadUsers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return positions.filter((position) => {
      const textMatch = !q || position.name.toLowerCase().includes(q);
      const statusMatch =
        statusFilter === 'All' || position.status === statusFilter;

      return textMatch && statusMatch;
    });
  }, [positions, searchQuery, statusFilter]);

  const selected =
    positions.find((p) => p.id === selectedId) ||
    filtered[0] ||
    positions[0] ||
    null;

  const assigned = useMemo(
    () => buildAssignments(users, selected?.name),
    [users, selected]
  );

  const activeAssigned = assigned.filter(
    (user) => user.status === 'Active'
  ).length;

  // Counts on the list rows: prefer what the backend reported, fall back to
  // what we can see, so a row is never blank just because users are loading.
  const countFor = useCallback(
    (position) => {
      if (Number.isFinite(position.users)) return position.users;
      if (usersLoading || usersError) return null;
      return buildAssignments(users, position.name).length;
    },
    [users, usersLoading, usersError]
  );

const openAdd = () => {
  setDraft(blankDraft());
  setSaveError(null);
  setShowAddPositionModal(true);
};

  const openEdit = () => {
    if (!selected) return;

    setDraft({ name: selected.name, status: selected.status });
    setSaveError(null);
    setModalMode('edit');
  };

  async function savePosition() {
    if (!draft.name.trim()) return;

    setSaving(true);
    setSaveError(null);

  const payload = {
  name: draft.name.trim(),
  status: draft.status,
  tabs: selected?.tabs ?? [],
};

  try {
  if (showAddPositionModal) {
    const created = await createPosition(payload);

    setShowAddPositionModal(false);

    await Promise.all([loadPositions(), loadUsers()]);

    if (created?.position_id) {
      setSelectedId(created.position_id);
    }
  } else if (selected) {
    await updatePosition(selected.id, payload);

    setModalMode(null);

    await Promise.all([loadPositions(), loadUsers()]);
  }
}catch (error) {
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
      await Promise.all([loadPositions(), loadUsers()]);
    } catch (error) {
      setLoadError(error?.message || 'Failed to delete the position.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const pendingDeleteCount = pendingDelete
    ? buildAssignments(users, pendingDelete.name).length
    : 0;

  return (
    <div className="space-y-5">
      {/* ---------- PAGE HEADER ---------- */}

      <div className="flex items-end justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">
            Position Management
          </h1>
          <p className="mt-0.5 text-xs text-[#4B5563]">
            Control which tabs each position can view in the system.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="swu-press flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
        >
          <Plus size={14} /> Add Position
        </button>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {loadError}
            <button
              type="button"
              onClick={loadPositions}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-[620px] grid-cols-[minmax(280px,24%)_minmax(0,1fr)] gap-5">
        {/* ---------- LIST ---------- */}

        <section className="swu-enter flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="border-b border-[#E5E7EB] p-4">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search positions"
                aria-label="Search positions"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] pl-9 pr-3 text-xs text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-[#4B5563]">
                {positions.length} position{positions.length === 1 ? '' : 's'}
              </span>

              <div className="flex rounded-lg bg-[#F1F3F5] p-0.5">
                {['All', 'Active', 'Inactive'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    aria-pressed={statusFilter === filter}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      statusFilter === filter
                        ? 'bg-white text-[#9D0A0E] shadow-sm'
                        : 'text-[#4B5563]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[520px] flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading && (
              <div className="px-3 py-10 text-center text-xs text-[#9CA3AF]">
                Loading positions...
              </div>
            )}

            {!loading &&
              filtered.map((position) => {
                const active = selected?.id === position.id;
                const count = countFor(position);

                return (
                  <button
                    key={position.id}
                    type="button"
                    onClick={() => setSelectedId(position.id)}
                    className={`relative flex w-full items-center gap-3 border-b border-[#F1F3F5] px-4 py-3 text-left transition-all duration-200 ${
                      active
                        ? 'bg-[#FBF1F1]'
                        : 'hover:translate-x-1 hover:bg-[#FBF1F1]'
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-0 left-0 w-1 bg-[#9D0A0E]" />
                    )}

                    <span
                      className={`min-w-0 flex-1 truncate text-xs font-semibold ${
                        active ? 'text-[#9D0A0E]' : 'text-[#1F2937]'
                      }`}
                    >
                      {position.name}
                    </span>

                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[#9CA3AF]">
                      <Users size={11} />
                      {count ?? '--'} user{count === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}

            {!loading && filtered.length === 0 && (
              <div className="px-3 py-10 text-center text-xs text-[#9CA3AF]">
                {positions.length === 0
                  ? 'No positions yet.'
                  : 'No positions found.'}
              </div>
            )}
          </div>

          <div className="border-t border-[#E5E7EB] px-4 py-3 text-center text-xs text-[#9CA3AF]">
            Showing {filtered.length} of {positions.length} positions
          </div>
        </section>

        {/* ---------- DETAIL ---------- */}

        <section className="swu-enter flex flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-[#1F2937]">
                      {selected.name}
                    </h2>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                        selected.status === 'Active'
                          ? 'bg-[#E8F8F0] text-[#0D8A4E]'
                          : 'bg-[#F1F3F5] text-[#6B7280]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          selected.status === 'Active'
                            ? 'bg-[#0D8A4E]'
                            : 'bg-[#9CA3AF]'
                        }`}
                      />
                      {selected.status} position
                    </span>
                  </div>

                  {selected.description && (
                    <p className="mt-1 text-xs text-[#9CA3AF]">
                      {selected.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openEdit}
                    className="swu-press inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-xs font-medium text-[#4B5563] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
                  >
                    <PencilLine size={12} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingDelete(selected)}
                    aria-label="Delete position"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#9D0A0E] transition hover:border-[#F0DADA] hover:bg-[#FBF1F1]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* assigned users */}
              <div className="flex items-center gap-2 px-5 pb-1 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#1F2937]">
                  Assigned Users
                </h3>

                <span className="rounded-md bg-[#F1F3F5] px-1.5 py-0.5 text-xs font-medium text-[#4B5563]">
                  {usersLoading ? '--' : assigned.length} user
                  {assigned.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
                <AssignedUsersTable
                  users={assigned}
                  loading={usersLoading}
                  error={usersError}
                />
              </div>

              {/* footer strip */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3 text-xs text-[#4B5563]">
                <span>
                  Assigned Users:{' '}
                  <span className="font-semibold text-[#1F2937]">
                    {usersLoading ? '--' : assigned.length}
                  </span>
                </span>

                <span>
                  Active in Department:{' '}
                  <span className="font-semibold text-[#1F2937]">
                    {usersLoading ? '--' : activeAssigned}
                  </span>
                </span>

                <span>
                  Last Updated:{' '}
                  <span className="font-semibold text-[#1F2937]">
                    {formatDate(selected.updatedAt)}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[620px] flex-col items-center justify-center gap-2 px-6 text-center">
              <BriefcaseBusiness size={22} className="text-[#D1D5DB]" />
              <p className="text-xs text-[#9CA3AF]">
                {loading
                  ? 'Loading positions...'
                  : positions.length === 0
                    ? 'No positions yet. Use Add Position to create one.'
                    : 'Select a position to view the staff assigned to it.'}
              </p>
            </div>
          )}
        </section>
      </div>

{showAddPositionModal && (
  <AddPositionModal
    draft={draft}
    setDraft={setDraft}
    onClose={() => {
      if (saving) return;

      setShowAddPositionModal(false);
      setSaveError(null);
    }}
    onSave={savePosition}
    saving={saving}
    error={saveError}
  />
)}

{modalMode === 'edit' && (
  <PositionModal
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
          assignedCount={pendingDeleteCount}
          onCancel={() => !deleting && setPendingDelete(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}