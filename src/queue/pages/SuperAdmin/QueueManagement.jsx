import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Search,
  RotateCw,
  Users,
  CheckCheck,
  ChevronsRight,
  Monitor,
  History,
  Hash,
  X,
  Trash2,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react';

import { getDepartments, getTerminals } from '../../services/backendApi';

// The api.js versions match the real /staff-queue endpoints (no {success,data}
// envelope). The backendApi.js fetchQueueState throws on that response.
import { fetchQueueState, fetchQueueHistory } from '../../services/api';

const HISTORY_PAGE_SIZE = 6;

const EMPTY_STATE = {
  waitingQueue: [],
  currentlyServing: null,
  stats: { waiting: 0, currentlyServing: 0, completed: 0, skipped: 0, averageServiceMinutes: 0 },
};

function isPriority(ticket) {
  if (!ticket) return false;
  const number = String(ticket.id || ticket.queue_number || ticket.queueNumber || '');
  return Boolean(ticket.isPriority || ticket.is_priority) || number.toUpperCase().startsWith('P-');
}

function minutesSince(value, now) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.floor((now - time) / 60000));
}

function formatTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function relativeUpdated(date, now) {
  if (!date) return '';
  const seconds = Math.floor((now - date.getTime()) / 1000);
  if (seconds < 30) return 'Updated just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return 'Updated moments ago';
  return `Updated ${minutes}m ago`;
}

function TicketPill({ ticket, number }) {
  const priority = isPriority(ticket);
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${
        priority
          ? 'border-[#F0DADA] bg-[#FBF1F1] text-[#9D0A0E]'
          : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#1F2937]'
      }`}
    >
      {number}
    </span>
  );
}

function StatusChip({ status }) {
  const value = String(status || '').toLowerCase();
  const done = value === 'completed' || value === 'done';
  const skipped = value === 'skipped' || value === 'cancelled' || value === 'canceled';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
        done
          ? 'bg-emerald-100 text-emerald-800'
          : skipped
            ? 'bg-[#FBF1F1] text-[#9D0A0E]'
            : 'bg-[#F1F3F5] text-[#4B5563]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-emerald-500' : skipped ? 'bg-[#9D0A0E]' : 'bg-[#9CA3AF]'}`}
      />
      {value || 'unknown'}
    </span>
  );
}

function StatCard({ label, value, caption, icon: Icon }) {
  return (
    <div className="swu-card rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
          <Icon size={14} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[#1F2937]">{value}</p>
      <p className="mt-0.5 text-xs text-[#4B5563]">{caption}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
      <p className="text-xs text-[#4B5563]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#1F2937]">{value}</p>
    </div>
  );
}

function ExpandedPanel({ department, state, terminalNames, now, onOpenHistory }) {
  const serving = state.currentlyServing;
  const waiting = state.waitingQueue || [];
  const stats = state.stats || EMPTY_STATE.stats;

  const servingTerminal = serving?.counterId ? terminalNames.get(String(serving.counterId)) : null;
  const servingMinutes = serving?.secondsElapsed
    ? Math.floor(Number(serving.secondsElapsed) / 60)
    : minutesSince(serving?.called_at, now);

  const servingDetail = [
    servingTerminal ? `Terminal ${servingTerminal}` : null,
    serving?.staffName || serving?.staff_name || null,
    servingMinutes != null ? `Serving for ${servingMinutes}m` : null,
  ].filter(Boolean).join(' \u00B7 ');

  const actions = [
    { key: 'terminal', title: 'Staff Queue Terminal', description: 'Call, serve, complete, or skip patients.', icon: Monitor, to: '/staff' },
    { key: 'history', title: 'Queue History', description: 'Review completed and skipped transactions.', icon: History, onClick: onOpenHistory },
    {
      key: 'tv',
      title: 'TV Queue Display',
      description: 'Open the public now-serving display.',
      icon: Hash,
      to: department.kiosk_id ? `/display?kiosk=${encodeURIComponent(department.kiosk_id)}` : '/display',
    },
  ];

  return (
    <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] p-5">
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Waiting" value={stats.waiting} />
        <MiniStat label="Completed" value={stats.completed} />
        <MiniStat label="Skipped" value={stats.skipped} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="swu-enter rounded-xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#1F2937]">Current Queue Status</p>
            <span className="text-xs text-[#9CA3AF]">Today</span>
          </div>

          <div className="mt-3 rounded-lg bg-[#F1F3F5] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">Now Serving</p>
            <p className={`mt-1 text-3xl font-extrabold ${serving ? (isPriority(serving) ? 'text-[#9D0A0E]' : 'text-[#1F2937]') : 'text-[#D1D5DB]'}`}>
              {serving?.id || '---'}
            </p>
            <p className="mt-1 text-xs text-[#4B5563]">
              {serving ? servingDetail || 'In progress' : 'No patient is being served'}
            </p>
          </div>

          <p className="mt-5 flex items-baseline gap-2 text-sm font-bold text-[#1F2937]">
            Waiting Queue
            <span className="text-xs font-normal text-[#9CA3AF]">{waiting.length} in line</span>
          </p>

          {waiting.length === 0 ? (
            <p className="mt-3 text-xs text-[#9CA3AF]">No patients waiting.</p>
          ) : (
            <ol className="mt-2 divide-y divide-[#F1F3F5]">
              {waiting.map((ticket, index) => {
                const waited = minutesSince(ticket.issuedAt || ticket.issued_at, now);
                return (
                  <li key={ticket.uniqueKey || ticket.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F1F3F5] text-xs font-semibold text-[#4B5563]">
                      {index + 1}
                    </span>
                    <TicketPill ticket={ticket} number={ticket.id} />
                    <span className="ml-auto text-xs text-[#4B5563]">{waited != null ? `Waiting ${waited}m` : ''}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="swu-enter h-fit rounded-xl border border-[#E5E7EB] bg-white p-4">
          <p className="mb-3 text-sm font-bold text-[#1F2937]">Department Actions</p>
          <div className="space-y-2">
            {actions.map(({ key, title, description, icon: Icon, to, onClick }) => {
              const body = (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-[#1F2937]">{title}</span>
                    <span className="mt-0.5 block text-xs text-[#4B5563]">{description}</span>
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-[#9CA3AF]" />
                </>
              );
              const className = 'swu-press flex w-full items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-left transition-all duration-200 hover:translate-x-1 hover:border-[#9D0A0E]/40 hover:bg-[#FBF1F1]';
              return to ? (
                <Link key={key} to={to} className={className}>{body}</Link>
              ) : (
                <button key={key} type="button" onClick={onClick} className={className}>{body}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({ count, onCancel, onConfirm }) {
  return (
    <div className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="swu-pop w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <Trash2 size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#1F2937]">Remove selected queue history?</h3>
            <p className="mt-1 text-xs leading-5 text-[#4B5563]">
              {count} selected queue record{count === 1 ? '' : 's'} will be removed from the queue history.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-[#E5E7EB] pt-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5]">Cancel</button>
          <button type="button" onClick={onConfirm} className="swu-press rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25">Remove</button>
        </div>
      </div>
    </div>
  );
}

function QueueHistoryModal({ department, onClose, onRemove }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [range, setRange] = useState('Today');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQueueHistory(department.department_id, { search, status, range })
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
        setPage(1);
        setSelected(new Set());
      })
      .catch((e) => !cancelled && setError(e?.message || 'Unable to load queue history.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [department.department_id, search, status, range]);

  useEffect(() => {
    const handleKey = (event) => event.key === 'Escape' && !confirming && onClose();
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, confirming]);

  const normalized = useMemo(
    () => rows.map((row, index) => {
      const number = row.queue_number || row.queueNumber || '';
      const started = row.service_began_at || row.started_at || row.startedAt;
      const completed = row.completed_at || row.service_ended_at || row.completedAt;
      const duration = started && completed
        ? Math.max(0, Math.round((new Date(completed) - new Date(started)) / 60000))
        : null;
      return {
        key: row.queue_id || row.queueId || `${number}-${index}`,
        raw: row,
        number,
        service: row.department || row.department_name || department.name,
        status: row.status,
        calledAt: formatTime(row.called_at || row.calledAt),
        startedAt: formatTime(started),
        completedAt: formatTime(completed),
        duration,
      };
    }),
    [rows, department.name]
  );

  const totalPages = Math.max(1, Math.ceil(normalized.length / HISTORY_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const firstIndex = (current - 1) * HISTORY_PAGE_SIZE;
  const pageRows = normalized.slice(firstIndex, firstIndex + HISTORY_PAGE_SIZE);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.key));

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => (allOnPageSelected ? next.delete(r.key) : next.add(r.key)));
      return next;
    });
  }

  async function confirmRemove() {
    setConfirming(false);
    const chosen = normalized.filter((r) => selected.has(r.key));
    if (!onRemove) {
      setNotice('Removing history is not connected to the server yet.');
      return;
    }
    try {
      await onRemove(chosen.map((r) => r.raw));
      const removed = new Set(chosen.map((r) => r.key));
      setRows((prev) => prev.filter((_, i) => !removed.has(normalized[i]?.key)));
      setSelected(new Set());
    } catch (e) {
      setNotice(e?.message || 'Unable to remove the selected records.');
    }
  }

  return (
    <div className="swu-enter-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="swu-pop flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
              <History size={16} />
            </span>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#1F2937]">
                Queue History
                <span className="rounded-md bg-[#F1F3F5] px-2 py-0.5 text-xs font-medium text-[#4B5563]">{department.name}</span>
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">View queue transactions for this department.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded text-[#9CA3AF] transition hover:text-[#1F2937]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#E5E7EB] px-6 py-3">
          <div className="relative w-56">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search queue number..." aria-label="Search queue number"
              className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-8 pr-3 text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#9D0A0E] focus:outline-none">
            {['All Status', 'Completed', 'Skipped'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="relative">
            <CalendarDays size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range" className="rounded-lg border border-[#E5E7EB] bg-white py-2 pl-7 pr-3 text-xs text-[#1F2937] focus:border-[#9D0A0E] focus:outline-none">
              {['Today', 'Yesterday', 'This Week', 'This Month'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {selected.size > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#1F2937]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9D0A0E]" />
                {selected.size} selected
              </span>
            )}
            <button type="button" disabled={selected.size === 0} onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 size={13} />
              Delete Selected
            </button>
          </div>
        </div>

        {notice && (
          <div className="mx-6 mt-3 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {notice}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="sticky top-0 bg-[#FBF1F1] text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
              <tr>
                <th className="px-6 py-3">Queue Number</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-center">Called At</th>
                <th className="px-3 py-3 text-center">Started At</th>
                <th className="px-3 py-3 text-center">Completed At</th>
                <th className="px-3 py-3 text-center">Duration</th>
                <th className="px-6 py-3 text-right">
                  <label className="inline-flex cursor-pointer items-center gap-2 normal-case">
                    Select All
                    <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} className="h-3.5 w-3.5 accent-[#9D0A0E]" />
                  </label>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F5] text-[#1F2937]">
              {loading && <tr><td colSpan={8} className="px-6 py-10 text-center text-[#9CA3AF]">Loading history...</td></tr>}
              {!loading && error && <tr><td colSpan={8} className="px-6 py-10 text-center text-[#9D0A0E]">{error}</td></tr>}
              {!loading && !error && pageRows.length === 0 && <tr><td colSpan={8} className="px-6 py-10 text-center text-[#9CA3AF]">No transactions found.</td></tr>}
              {!loading && !error && pageRows.map((r) => (
                <tr key={r.key} className={`transition-colors ${selected.has(r.key) ? 'bg-[#FBF1F1]' : 'hover:bg-[#FBF1F1]'}`}>
                  <td className="px-6 py-3"><TicketPill ticket={r.raw} number={r.number} /></td>
                  <td className="px-3 py-3 text-[#4B5563]">{r.service}</td>
                  <td className="px-3 py-3 text-center"><StatusChip status={r.status} /></td>
                  <td className="px-3 py-3 text-center text-[#4B5563]">{r.calledAt || '\u2014'}</td>
                  <td className="px-3 py-3 text-center text-[#4B5563]">{r.startedAt || '\u2014'}</td>
                  <td className="px-3 py-3 text-center text-[#4B5563]">{r.completedAt || '\u2014'}</td>
                  <td className="px-3 py-3 text-center font-semibold">{r.duration != null ? `${r.duration} min` : '\u2014'}</td>
                  <td className="px-6 py-3 text-right">
                    <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} aria-label={`Select ${r.number}`} className="h-3.5 w-3.5 accent-[#9D0A0E]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-[#E5E7EB] px-6 py-3 text-xs text-[#4B5563]">
          <span>
            {normalized.length === 0 ? 'No transactions' : `Showing ${firstIndex + 1} to ${firstIndex + pageRows.length} of ${normalized.length} transactions`}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={current === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-[#E5E7EB] px-2.5 py-1 transition hover:bg-[#F1F3F5] disabled:opacity-40">Previous</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)} className={`rounded-md border px-3 py-1 transition ${n === current ? 'border-[#9D0A0E] bg-[#9D0A0E] font-semibold text-white' : 'border-[#E5E7EB] hover:bg-[#F1F3F5]'}`}>{n}</button>
            ))}
            <button type="button" disabled={current === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-[#E5E7EB] px-2.5 py-1 transition hover:bg-[#F1F3F5] disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {confirming && <RemoveConfirmModal count={selected.size} onCancel={() => setConfirming(false)} onConfirm={confirmRemove} />}
    </div>
  );
}

export default function AdminQueueManagement({ onNavigate, onRemoveHistory }) {
  const [departments, setDepartments] = useState([]);
  const [queueStateMap, setQueueStateMap] = useState({});
  const [terminalNames, setTerminalNames] = useState(() => new Map());
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [historyFor, setHistoryFor] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [departmentData, terminalData] = await Promise.all([
        getDepartments(),
        getTerminals().catch(() => []),
      ]);

      const list = (Array.isArray(departmentData) ? departmentData : []).map((d) => ({
        department_id: d.department_id,
        name: d.name || 'Department',
        prefix: d.prefix || '',
        status: String(d.status || 'active').toLowerCase(),
        kiosk_id: d.kiosk_id || '',
      }));

      const names = new Map();
      (Array.isArray(terminalData) ? terminalData : terminalData?.data || []).forEach((t) => {
        const id = t.counter_id || t.id;
        if (id) names.set(String(id), t.counter_number ?? '');
      });

      const results = await Promise.all(
        list.map(async (d) => {
          if (!d.prefix) return [d.department_id, EMPTY_STATE];
          try {
            return [d.department_id, (await fetchQueueState(d.prefix)) || EMPTY_STATE];
          } catch {
            return [d.department_id, EMPTY_STATE];
          }
        })
      );

      setDepartments(list);
      setTerminalNames(names);
      setQueueStateMap(Object.fromEntries(results));
      setLastUpdated(new Date());
      setNow(Date.now());
    } catch (e) {
      setError(e?.message || 'Unable to load queue data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(
    () => departments.reduce((sum, d) => {
      const s = queueStateMap[d.department_id]?.stats || EMPTY_STATE.stats;
      return {
        waiting: sum.waiting + (Number(s.waiting) || 0),
        serving: sum.serving + (Number(s.currentlyServing) || 0),
        completed: sum.completed + (Number(s.completed) || 0),
        skipped: sum.skipped + (Number(s.skipped) || 0),
      };
    }, { waiting: 0, serving: 0, completed: 0, skipped: 0 }),
    [departments, queueStateMap]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return departments.filter((d) => {
      const matchesText = !q || d.name.toLowerCase().includes(q) || d.prefix.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All Statuses' || (statusFilter === 'Active' ? d.status === 'active' : d.status !== 'active');
      return matchesText && matchesStatus;
    });
  }, [departments, search, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Queue Management</h1>
          <p className="mt-0.5 text-xs text-[#4B5563]">Monitor each department&rsquo;s queue and current service status.</p>
        </div>
        {onNavigate && (
          <button type="button" onClick={() => onNavigate('departments')}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5]">
            Department Overview
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="swu-stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Waiting" value={totals.waiting} caption="Across all departments" icon={Users} />
        <StatCard label="Completed" value={totals.completed} caption="Served today" icon={CheckCheck} />
        <StatCard label="Skipped" value={totals.skipped} caption="Missed or skipped today" icon={ChevronsRight} />
      </div>

      <div className="swu-enter flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search department..." aria-label="Search department"
            className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-8 pr-3 text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status" className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#1F2937] focus:border-[#9D0A0E] focus:outline-none">
          {['All Statuses', 'Active', 'Inactive'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2 text-xs text-[#4B5563]">
          {relativeUpdated(lastUpdated, now)}
          <button type="button" onClick={load} disabled={loading} aria-label="Refresh" className="rounded-md border border-[#E5E7EB] p-1.5 transition hover:bg-[#F1F3F5] disabled:opacity-50">
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">{error}</div>}

      <div className="space-y-3">
        {loading && departments.length === 0 && (
          <p className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-8 text-center text-xs text-[#9CA3AF]">Loading departments...</p>
        )}
        {!loading && visible.length === 0 && (
          <p className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-8 text-center text-xs text-[#9CA3AF]">No departments found.</p>
        )}

        {visible.map((d) => {
          const state = queueStateMap[d.department_id] || EMPTY_STATE;
          const stats = state.stats || EMPTY_STATE.stats;
          const open = expanded === d.department_id;
          const avg = Math.round(Number(stats.averageServiceMinutes) || 0);
          const active = d.status === 'active';

          return (
            <div key={d.department_id} className="swu-card overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
              <button type="button" onClick={() => setExpanded(open ? null : d.department_id)} aria-expanded={open}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FBF1F1]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F3F5] text-[#4B5563]">
                  <Building2 size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1F2937]">{d.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${active ? 'bg-emerald-100 text-emerald-800 ring-emerald-600/30' : 'bg-[#F1F3F5] text-[#4B5563] ring-[#E5E7EB]'}`}>
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-[#4B5563]">
                    Prefix: {d.prefix || '\u2014'} &middot; {stats.waiting} waiting &middot; Avg wait {avg}m
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs text-[#9CA3AF]">Now serving</span>
                  <span className={`block text-sm font-bold ${state.currentlyServing ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}`}>
                    {state.currentlyServing?.id || 'Not serving'}
                  </span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <ExpandedPanel department={d} state={state} terminalNames={terminalNames} now={now} onOpenHistory={() => setHistoryFor(d)} />
              )}
            </div>
          );
        })}
      </div>

      {historyFor && (
        <QueueHistoryModal department={historyFor} onClose={() => setHistoryFor(null)} onRemove={onRemoveHistory} />
      )}
    </div>
  );
}