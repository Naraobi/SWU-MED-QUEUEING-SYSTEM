import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Monitor,
  Phone,
  Plus,
  RotateCcw,
  Search,
  SkipForward,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  callNextPatient,
  completeCurrentPatient,
  fetchDepartmentByName,
  fetchQueueHistory,
  fetchQueueState,
  recallCurrentPatient,
  skipCurrentPatient,
  updateDepartmentName,
} from '../../services/api';
import { useAuth } from '../../services/Authcontext';

const inputClass = 'w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#075b9f]';
const panelClass = 'rounded-lg border border-slate-200 bg-white shadow-sm';
const labelClass = 'block text-xs font-semibold text-slate-600';

// Every queue_number in `queue_ticket` is prefixed with a department code —
// "BP" for Billing/Payment, "LB" for Laboratory, etc. Falls back to "BP" if
// the logged-in admin's department prefix isn't available yet (mirrors the
// same fallback used in AdminDashboard.jsx).
const FALLBACK_DEPARTMENT_PREFIX = 'BP';

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function PageHeading({ title, subtitle, action, onAction }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      {action && (
        <button type="button" onClick={onAction} className="inline-flex items-center gap-2 rounded-md bg-[#075b9f] px-4 py-2.5 text-xs font-semibold text-white">
          <Plus size={15} />
          {action}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, caption, icon: Icon }) {
  return (
    <div className={`${panelClass} px-4 py-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon size={17} className="text-slate-500" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{caption}</p>
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className="w-full rounded-full border border-slate-200 px-9 py-2 text-xs outline-none" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search user" />
    </div>
  );
}

function Modal({ title, badge, onClose, children, actions }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <section className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-[#f5faff] px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            {badge}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={19} className="text-slate-500" /></button>
        </header>
        <div className="p-5">{children}</div>
        {actions && <footer className="flex justify-end gap-2 border-t border-slate-200 bg-[#f5faff] px-5 py-3">{actions}</footer>}
      </section>
    </div>
  );
}

/* ---------------- Terminal Management (live, wired to queue_ticket) ---------------- */

export function TerminalManagementPage() {
  const { user } = useAuth();
  const departmentPrefix = user?.department_prefix || FALLBACK_DEPARTMENT_PREFIX;
  const [state, setState] = useState({ waitingQueue: [], currentlyServing: null, stats: { waiting: 0, completed: 0, skipped: 0 } });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [, forceTick] = useState(0);

  async function refresh() {
    try {
      const next = await fetchQueueState(departmentPrefix);
      setState(next);
      setFetchedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }

  // Poll every 5s so this reflects what other terminals/staff are doing.
  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentPrefix]);

  // Ticks the on-screen timer every second between polls.
  useEffect(() => {
    const clock = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(clock);
  }, []);

  async function runAction(action) {
    setActionLoading(true);
    setError(null);
    try {
      const next = await action();
      setState(next);
      setFetchedAt(Date.now());
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  }

  const handleCallNext = () => runAction(() => callNextPatient(departmentPrefix));
  const handleRecall = () => runAction(() => recallCurrentPatient(departmentPrefix));
  const handleComplete = () => runAction(() => completeCurrentPatient(departmentPrefix));

  function openSkipModal() {
    setSkipReason('');
    setSkipModalOpen(true);
  }

  async function confirmSkip() {
    setSkipModalOpen(false);
    await runAction(() => skipCurrentPatient(skipReason || 'No reason provided', departmentPrefix));
  }

  const current = state.currentlyServing;
  const elapsedSeconds = current ? current.secondsElapsed + Math.floor((Date.now() - fetchedAt) / 1000) : 0;

  return (
    <div>
      <PageHeading title="Terminal Management" subtitle="Manage Staff" />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">{error}</div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Total Waiting" value={loading ? '…' : String(state.stats.waiting)} caption="Across all department" icon={Users} />
        <Stat label="Average Wait" value="18m" caption="Average wait time (no column yet)" icon={Clock3} />
        <Stat label="Skipped" value={loading ? '…' : String(state.stats.skipped)} caption="Total skipped" icon={SkipForward} />
        <Stat label="Completed" value={loading ? '…' : String(state.stats.completed)} caption="Completed queuing" icon={CheckCircle2} />
        <Stat label="Terminal" value="5/6" caption="No terminals table yet" icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${panelClass} flex flex-col items-center justify-center gap-4 p-8 text-center`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Currently Serving</p>
          <p className="text-5xl font-extrabold text-[#075b9f]">{loading ? '…' : (current?.id ?? '--')}</p>
          <p className="text-xs text-slate-500">Service: {current?.service ?? '--'} &nbsp;|&nbsp; Terminal: {current?.terminal ?? '--'}</p>

          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <Clock3 size={13} /> {current ? `Waiting for patient · ${formatDuration(elapsedSeconds)}` : 'No patient currently being served'}
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={handleRecall} disabled={!current || actionLoading} className="flex items-center gap-1.5 rounded-md border border-blue-300 px-4 py-2 text-xs font-semibold text-[#075b9f] hover:bg-blue-50 disabled:opacity-40">
              <RotateCcw size={13} /> Recall
            </button>
            <button type="button" onClick={handleComplete} disabled={!current || actionLoading} className="flex items-center gap-1.5 rounded-md bg-[#075b9f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#064b83] disabled:opacity-40">
              <CheckCircle2 size={13} /> Complete
            </button>
            <button type="button" onClick={openSkipModal} disabled={!current || actionLoading} className="flex items-center gap-1.5 rounded-md border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
              <SkipForward size={13} /> Skip
            </button>
          </div>

          <div className="mt-4 w-full border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Patient</p>
            <p className="mt-1 text-lg font-bold text-slate-700">{state.waitingQueue[0]?.id ?? '--'}</p>
            <button type="button" onClick={handleCallNext} disabled={state.waitingQueue.length === 0 || actionLoading} className="mt-3 flex items-center gap-1.5 rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
              <Phone size={13} /> {actionLoading ? 'Working…' : 'Call Next Patient'}
            </button>
          </div>
        </section>

        <section className={`${panelClass} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Waiting Queue</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{state.waitingQueue.length} Patients</span>
          </div>
          <div className="space-y-2">
            {loading && <p className="py-4 text-center text-xs text-slate-400">Loading queue…</p>}
            {!loading && state.waitingQueue.slice(0, 4).map((row, index) => (
              <div key={row.uniqueKey} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2.5">
                <span className="text-xs font-bold text-slate-700">{row.id}</span>
                <span className="text-[10px] text-slate-500">~{row.etaMinutes} min ({index + 1} ahead)</span>
              </div>
            ))}
            {!loading && state.waitingQueue.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Queue is empty.</p>}
          </div>
          <button type="button" onClick={() => setShowQueueModal(true)} className="mt-3 w-full rounded-md border border-slate-200 py-2 text-xs font-semibold text-[#075b9f] hover:bg-slate-50">
            View Full Queue
          </button>
        </section>
      </div>

      {showQueueModal && (
        <Modal
          title="Waiting Queue"
          badge={<span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{state.waitingQueue.length} Patients</span>}
          onClose={() => setShowQueueModal(false)}
        >
          <div className="space-y-1">
            {state.waitingQueue.map((row, index) => (
              <div key={row.uniqueKey} className={`flex items-center justify-between px-1 py-3 ${index !== state.waitingQueue.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className="text-sm font-bold text-slate-700">{row.id}</span>
                <span className="text-xs text-slate-500">~{row.etaMinutes} min ({index + 1} ahead)</span>
              </div>
            ))}
            {state.waitingQueue.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No patients waiting.</p>}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Showing 1 to {state.waitingQueue.length} of every page</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQueuePage((v) => Math.max(1, v - 1))} disabled={queuePage === 1} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40">Prev</button>
              {[1, 2, 3].map((value) => (
                <button key={value} type="button" onClick={() => setQueuePage(value)} className={`rounded-md border px-2.5 py-1.5 ${queuePage === value ? 'bg-slate-200 text-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{value}</button>
              ))}
              <button type="button" onClick={() => setQueuePage((v) => Math.min(3, v + 1))} disabled={queuePage === 3} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        </Modal>
      )}

      {skipModalOpen && (
        <Modal
          title="Skip Patient"
          onClose={() => setSkipModalOpen(false)}
          actions={<>
            <button type="button" onClick={() => setSkipModalOpen(false)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button>
            <button type="button" onClick={confirmSkip} className="rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700">Confirm Skip</button>
          </>}
        >
          <label className={labelClass}>Reason for skipping {current?.id ? `(${current.id})` : ''}
            <textarea
              className={`${inputClass} mt-1 h-20 resize-none`}
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="e.g. Patient did not arrive"
            />
          </label>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Queue Management (Assigned Terminal) ---------------- */
/* NOTE: still local-only — there's no `terminals` table in the backend
   reference yet. Send that schema (id, label, staff_id, location,
   status) and this can be wired the same way Terminal Management is. */

const ASSIGNED_TERMINALS = [
  { no: 'Terminal 1', name: 'John doe', email: 'jodo.doe.swu@phinmaed.com', location: 'Lobby', role: 'Staff', status: 'Online' },
  { no: 'Terminal 2', name: 'Maria Piatos', email: 'jodo.doe.swu@phinmaed.com', location: 'Lobby', role: 'Staff', status: 'Offline' },
  { no: 'Terminal 3', name: 'Radiology', email: 'jodo.doe.swu@phinmaed.com', location: 'Lobby', role: 'Staff', status: 'Online' },
  { no: 'Terminal 4', name: 'Internal Medical', email: 'jodo.doe.swu@phinmaed.com', location: 'Lobby', role: 'Staff', status: 'Online' },
  { no: 'Terminal 5', name: 'Billing/Payment', email: 'jodo.doe.swu@phinmaed.com', location: 'Lobby', role: 'Staff', status: 'Online' },
  { no: 'Terminal 6', name: 'Billing/Payment', email: 'jodo.doe.swu@phinmaed.com', location: 'Lobby', role: 'Staff', status: 'Online' },
];

function TerminalFormFields({ form, setForm, staffOptions, locationOptions }) {
  return (
    <div className="space-y-3">
      <label className={labelClass}>Assigned To
        <select className={`${inputClass} mt-1`} value={form.assigned} onChange={(e) => setForm({ ...form, assigned: e.target.value })}>
          <option value="">Mga staff nga naa ani nga department</option>
          {staffOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label className={labelClass}>Location
        <select className={`${inputClass} mt-1`} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
          <option value="">Lobby basta mga location ni ari</option>
          {locationOptions.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </label>
      <label className={labelClass}>Terminal Number
        <input type="number" className={`${inputClass} mt-1`} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="0" />
      </label>
    </div>
  );
}

export function QueueManagementPage() {
  const [query, setQuery] = useState('');
  const [terminals, setTerminals] = useState(ASSIGNED_TERMINALS);
  const [modal, setModal] = useState(null); // null | 'add' | { type: 'edit', row }
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ assigned: '', location: '', number: '' });

  const staffOptions = ['John doe', 'Maria Piatos', 'Radiology', 'Internal Medical', 'Billing/Payment'];
  const locationOptions = ['Lobby', '2nd Floor', 'Billing Wing', 'Laboratory Wing'];

  const rows = terminals.filter((row) => `${row.no} ${row.name} ${row.email}`.toLowerCase().includes(query.toLowerCase()));

  function openEdit(row) {
    setForm({ assigned: row.name, location: row.location, number: row.no.replace(/\D/g, '') });
    setModal({ type: 'edit', row });
  }

  function openAdd() {
    setForm({ assigned: '', location: '', number: '' });
    setModal('add');
  }

  function saveEdit() {
    setTerminals((rows) => rows.map((row) => (row === modal.row ? { ...row, name: form.assigned || row.name, location: form.location || row.location } : row)));
    setModal(null);
  }

  function saveAdd() {
    if (!form.number) { setModal(null); return; }
    setTerminals((rows) => [...rows, { no: `Terminal ${form.number}`, name: form.assigned || 'Unassigned', email: '--', location: form.location || 'Lobby', role: 'Staff', status: 'Offline' }]);
    setModal(null);
  }

  return (
    <div>
      <PageHeading title="Queue Management" subtitle="Manage Staff" action="Add Terminal" onAction={openAdd} />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Total" value={String(terminals.length)} caption="Total terminals" icon={Monitor} />
        <Stat label="Active" value={String(terminals.filter((t) => t.status === 'Online').length)} caption="Active terminals" icon={CheckCircle2} />
        <Stat label="Inactive" value={String(terminals.filter((t) => t.status !== 'Online').length)} caption="Inactive terminal" icon={Trash2} />
        <Stat label="Completed" value="255" caption="Completed queuing" icon={CheckCircle2} />
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold text-slate-700">Assigned Terminal</h2>
          <SearchBox value={query} onChange={setQuery} />
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#e5f0f9] uppercase text-slate-600">
              <th className="px-4 py-2">Terminal No.</th>
              <th className="px-4 py-2">Full Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.no} onClick={() => openEdit(row)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{row.no}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3 text-slate-500">{row.email}</td>
                <td className="px-4 py-3 text-slate-500">{row.location}</td>
                <td className="px-4 py-3 text-slate-500">{row.role}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${row.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>Showing 1 to {rows.length} of {terminals.length} terminals</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page === 1} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40">Prev</button>
            {[1, 2, 3].map((value) => (
              <button key={value} type="button" onClick={() => setPage(value)} className={`rounded-md border px-2.5 py-1.5 ${page === value ? 'bg-slate-200 text-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{value}</button>
            ))}
            <button type="button" onClick={() => setPage((v) => Math.min(3, v + 1))} disabled={page === 3} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {modal && typeof modal === 'object' && (
        <Modal title="Edit Assigned Terminal" onClose={() => setModal(null)} actions={<><button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button><button type="button" onClick={saveEdit} className="rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white">Save Changes</button></>}>
          <TerminalFormFields form={form} setForm={setForm} staffOptions={staffOptions} locationOptions={locationOptions} />
        </Modal>
      )}

      {modal === 'add' && (
        <Modal title="Add Terminal" onClose={() => setModal(null)} actions={<><button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button><button type="button" onClick={saveAdd} className="rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white">Save</button></>}>
          <TerminalFormFields form={form} setForm={setForm} staffOptions={staffOptions} locationOptions={locationOptions} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Reports & Analytics (stats + activity now live) ---------------- */

export function ReportsPage() {
  const { user } = useAuth();
  const departmentPrefix = user?.department_prefix || FALLBACK_DEPARTMENT_PREFIX;
  const [state, setState] = useState({ stats: { waiting: 0, completed: 0 } });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [queueState, recentHistory] = await Promise.all([
          fetchQueueState(departmentPrefix),
          fetchQueueHistory({}, departmentPrefix),
        ]);
        if (!cancelled) {
          setState(queueState);
          setHistory(recentHistory.slice(0, 5));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load report data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [departmentPrefix]);

  return (
    <div>
      <PageHeading title="Report & Analytics" subtitle="Manage Staff" />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">{error}</div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Total Waiting" value={loading ? '…' : String(state.stats.waiting)} caption="Across all department" icon={Users} />
        <Stat label="Average Wait" value="18m" caption="No column yet" icon={Clock3} />
        <Stat label="Completed" value={loading ? '…' : String(state.stats.completed)} caption="Completed queuing" icon={CheckCircle2} />
        <Stat label="Staff" value="6/8" caption="No staff-on-duty column yet" icon={Users} />
        <Stat label="Terminal" value="3/4" caption="No terminals table yet" icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${panelClass} p-5`}>
          <h2 className="mb-4 text-sm font-bold text-slate-700">AI Insights</h2>
          <div className="space-y-3">
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-slate-600">Recommend opening an additional terminal during peak hours (10AM - 12PM) in Pediatrics to reduce wait times.</p>
              <button type="button" className="mt-2 text-xs font-semibold text-[#075b9f] hover:underline">Apply Recommendation</button>
            </div>
            <div className="rounded-md border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs text-slate-600">Laboratory Department experiencing 15% higher volume than yesterday. Consider staff reallocation.</p>
            </div>
          </div>
        </section>

        <section className={`${panelClass} p-5`}>
          <h2 className="mb-4 text-sm font-bold text-slate-700">Recent Activity</h2>
          <div className="space-y-4 text-xs text-slate-600">
            {loading && <p className="text-slate-400">Loading…</p>}
            {!loading && history.map((row) => (
              <div key={`${row.queueNumber}-${row.transactionDate}-${row.calledAt}`} className="flex gap-2">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${row.status === 'Completed' ? 'bg-emerald-500' : row.status === 'Skipped' ? 'bg-red-400' : 'bg-slate-300'}`} />
                <p><b>{row.queueNumber} &mdash; {row.status}</b><br />{row.service} &middot; {row.calledAt}</p>
              </div>
            ))}
            {!loading && history.length === 0 && <p className="text-slate-400">No recent activity.</p>}
          </div>
          <button type="button" className="mt-4 text-xs font-semibold text-[#075b9f] hover:underline">View Full Log</button>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
/* Department Customization persists to Supabase `departments.name`.
   Theme has no backing table, so it persists to localStorage and only
   drives the shared brand accent color (--color-brand-blue) plus a
   light/dark flag on <html> — most Admin pages use hardcoded Tailwind
   colors, so a full dark reskin is a separate, larger task. */

const THEME_COLORS = [
  '#2f6fed', '#6b7280', '#2b4c7e', '#5b6b7f',
  '#3c5a68', '#0f9b8e', '#2f9e52', '#4c6b4a',
  '#a9a326', '#d97a2b', '#7a5a3a', '#c23c63',
  '#7a4a52', '#b23fb8', '#6b4fc2', '#c2532c',
];

const THEME_STORAGE_KEY = 'swumed_admin_theme';

export function loadStoredTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { mode: parsed.mode || 'Light', color: parsed.color || THEME_COLORS[0] };
  } catch {
    return null;
  }
}

export function applyTheme({ mode, color }) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'Dark' || (mode === 'Device' && prefersDark);
  document.documentElement.classList.toggle('admin-dark', isDark);
  document.documentElement.style.setProperty('--color-brand-blue', color);
}

export function SettingsPage() {
  const { user } = useAuth();
  const [modal, setModal] = useState(null); // null | 'department' | 'theme'
  const [language, setLanguage] = useState('English');
  const [departmentId, setDepartmentId] = useState(null);
  const [departmentName, setDepartmentName] = useState('');
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptSaving, setDeptSaving] = useState(false);
  const [deptError, setDeptError] = useState(null);
  const storedTheme = loadStoredTheme();
  const [themeMode, setThemeMode] = useState(storedTheme?.mode || 'Light');
  const [themeColor, setThemeColor] = useState(storedTheme?.color || THEME_COLORS[0]);
  const [draftName, setDraftName] = useState('');
  const [draftMode, setDraftMode] = useState(themeMode);
  const [draftColor, setDraftColor] = useState(themeColor);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartment() {
      setDeptLoading(true);
      const dept = await fetchDepartmentByName(user?.department);
      if (!cancelled) {
        setDepartmentId(dept?.id ?? null);
        setDepartmentName(dept?.name || user?.department || '');
        setDeptLoading(false);
      }
    }

    loadDepartment();
    return () => { cancelled = true; };
  }, [user?.department]);

  useEffect(() => {
    applyTheme({ mode: themeMode, color: themeColor });
  }, [themeMode, themeColor]);

  function openDepartment() {
    setDraftName(departmentName);
    setDeptError(null);
    setModal('department');
  }

  function openTheme() {
    setDraftMode(themeMode);
    setDraftColor(themeColor);
    setModal('theme');
  }

  async function saveDepartment() {
    if (!departmentId || !draftName.trim()) {
      setModal(null);
      return;
    }
    setDeptSaving(true);
    setDeptError(null);
    try {
      const updated = await updateDepartmentName(departmentId, draftName.trim());
      setDepartmentName(updated.name);
      setModal(null);
    } catch (err) {
      setDeptError(err.message || 'Failed to save department name.');
    } finally {
      setDeptSaving(false);
    }
  }

  function saveTheme() {
    setThemeMode(draftMode);
    setThemeColor(draftColor);
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: draftMode, color: draftColor }));
    setModal(null);
  }

  return (
    <div>
      <PageHeading title="Settings" subtitle="Manage system preferences, display configurations, and global rules." />

      <section className={`${panelClass} mb-5 p-5`}>
        <h2 className="mb-3 text-sm font-bold text-slate-700">Appearance</h2>
        <div className="flex gap-3">
          <button type="button" onClick={openDepartment} disabled={deptLoading} className="rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">Department Customization</button>
          <button type="button" onClick={openTheme} className="rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">Theme</button>
        </div>
      </section>

      <section className={`${panelClass} p-5`}>
        <h2 className="mb-3 text-sm font-bold text-slate-700">Language</h2>
        <div className="flex gap-2">
          {['English', 'Filipino', 'Cebuano'].map((item) => (
            <button type="button" key={item} onClick={() => setLanguage(item)} className={`rounded-md border px-4 py-2 text-xs font-semibold ${language === item ? 'border-slate-500 bg-white' : 'border-transparent bg-slate-100'}`}>{item}</button>
          ))}
        </div>
      </section>

      {modal === 'department' && (
        <Modal title="Department Customization" onClose={() => setModal(null)} actions={<><button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button><button type="button" onClick={saveDepartment} disabled={deptSaving} className="rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{deptSaving ? 'Saving…' : 'Save'}</button></>}>
          {deptError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{deptError}</div>
          )}
          <label className={`${labelClass} block`}>Department Name
            <input className={`${inputClass} mt-1`} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </label>
        </Modal>
      )}

      {modal === 'theme' && (
        <Modal title="Theme" onClose={() => setModal(null)} actions={<><button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-xs font-semibold">Cancel</button><button type="button" onClick={saveTheme} className="rounded-md bg-[#075b9f] px-4 py-2 text-xs font-semibold text-white">Save</button></>}>
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-md border border-slate-200 p-1">
            {['Light', 'Dark', 'Device'].map((mode) => (
              <button type="button" key={mode} onClick={() => setDraftMode(mode)} className={`rounded-md py-2 text-xs font-semibold ${draftMode === mode ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}>{mode}</button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {THEME_COLORS.map((color) => (
              <button
                type="button"
                key={color}
                onClick={() => setDraftColor(color)}
                className={`relative h-12 rounded-lg border-2 ${draftColor === color ? 'border-[#075b9f]' : 'border-transparent'}`}
                style={{ background: `linear-gradient(135deg, ${color} 50%, ${color}99 50%)` }}
                aria-label={`Choose ${color}`}
              >
                {draftColor === color && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] text-white">&#10003;</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}