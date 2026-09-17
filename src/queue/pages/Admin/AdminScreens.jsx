import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Monitor,
  Phone,
  RefreshCw,
  Settings2,
  SkipForward,
  Users,
} from 'lucide-react';

import { auth } from '../../../firebase';
import { getDashboardAnalytics } from '../../services/backendApi';

import { useAuth } from '../../services/Authcontext';
import { useQueue } from '../../context/QueueContext';

const THEME_STORAGE_KEY = 'swumed_admin_theme';

export function loadStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(themeName = 'light') {
  const root = document.documentElement;
  const isDark = themeName === 'dark';

  root.classList.toggle('admin-dark', isDark);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  } catch {
    // Ignore storage issues in private mode or restricted browsers.
  }
}

function StatCard({ label, value, caption, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <Icon size={16} className="text-slate-500" />
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-800">{value}</p>

      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {caption}
      </p>
    </div>
  );
}

export function TerminalManagementPage() {
  const {
    waitingQueue,
    currentlyServing,
    stats,
    loading,
    refresh,
    callNextPatient,
    recallCurrentPatient,
    completeCurrentPatient,
    skipCurrentPatient,
  } = useQueue();

  const { user } = useAuth();
  const [departmentPrefix, setDepartmentPrefix] = useState('BP');
  const [actionLoading, setActionLoading] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [skipModalOpen, setSkipModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.department) {
      return;
    }

    setDepartmentPrefix(user.department_prefix || user.departmentPrefix || 'BP');
  }, [user]);

  useEffect(() => {
    if (departmentPrefix) {
      refresh(departmentPrefix);
    }
  }, [departmentPrefix, refresh]);

  const nextPatient = waitingQueue[0] || null;
  const current = currentlyServing || null;

  async function runAction(action) {
    if (!departmentPrefix) {
      return;
    }

    try {
      setActionLoading(true);
      await action();
      await refresh(departmentPrefix);
    } catch (error) {
      console.error('Queue action failed:', error);
    } finally {
      setActionLoading(false);
    }
  }

  const handleCallNext = () => {
    runAction(() => callNextPatient(departmentPrefix));
  };

  const handleRecall = () => {
    runAction(() => recallCurrentPatient(departmentPrefix));
  };

  const handleComplete = () => {
    runAction(() => completeCurrentPatient(departmentPrefix));
  };

  const handleSkip = async () => {
    setSkipModalOpen(false);
    await runAction(() => skipCurrentPatient(skipReason || 'No reason provided', departmentPrefix));
    setSkipReason('');
  };

  const totalWaiting = stats?.waiting || waitingQueue.length || 0;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Terminal Management</h1>
          <p className="mt-1 text-xs text-slate-500">Manage staff queue flow for the active department.</p>
        </div>

        <button
          type="button"
          onClick={() => refresh(departmentPrefix)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Total Waiting" value={loading ? '…' : String(totalWaiting)} caption="Across all queue" icon={Users} />
        <StatCard label="Average Wait" value="18m" caption="Average queued time" icon={Clock3} />
        <StatCard label="Skipped" value={loading ? '…' : String(stats?.skipped || 0)} caption="Total skipped" icon={SkipForward} />
        <StatCard label="Completed" value={loading ? '…' : String(stats?.completed || 0)} caption="Completed today" icon={CheckCircle2} />
        <StatCard label="Terminal" value={user?.department || 'Active'} caption="Current department" icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Currently Serving</p>
          <p className="mt-3 text-5xl font-extrabold text-[#075b9f]">{loading ? '…' : current?.id || '--'}</p>
          <p className="mt-2 text-xs text-slate-500">
            Service: {current?.service || '--'} &nbsp;|&nbsp; Terminal: {current?.terminal || '--'}
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
            <Clock3 size={13} />
            {current ? 'Waiting for patient' : 'No patient currently being served'}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleRecall}
              disabled={!current || actionLoading}
              className="flex items-center gap-1.5 rounded-md border border-blue-300 px-4 py-2 text-xs font-semibold text-[#075b9f] hover:bg-blue-50 disabled:opacity-40"
            >
              Recall
            </button>

            <button
              type="button"
              onClick={handleComplete}
              disabled={!current || actionLoading}
              className="flex items-center gap-1.5 rounded-md bg-[#075b9f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#064b83] disabled:opacity-40"
            >
              Complete
            </button>

            <button
              type="button"
              onClick={() => setSkipModalOpen(true)}
              disabled={!current || actionLoading}
              className="flex items-center gap-1.5 rounded-md border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Skip
            </button>
          </div>

          <div className="mt-6 w-full border-t border-slate-100 pt-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Patient</p>
            <p className="mt-2 text-lg font-bold text-slate-700">{nextPatient?.id || '--'}</p>
            <button
              type="button"
              onClick={handleCallNext}
              disabled={waitingQueue.length === 0 || actionLoading}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
            >
              <Phone size={13} />
              {actionLoading ? 'Working…' : 'Call Next Patient'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Waiting Queue</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{waitingQueue.length} Patients</span>
          </div>

          <div className="space-y-2">
            {loading && <p className="py-4 text-center text-xs text-slate-400">Loading queue…</p>}

            {!loading && waitingQueue.slice(0, 4).map((row, index) => (
              <div key={row.uniqueKey || `${row.id}-${index}`} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2.5">
                <span className="text-xs font-bold text-slate-700">{row.id}</span>
                <span className="text-[10px] text-slate-500">{row.etaMinutes ?? '~0'} min ({index + 1} ahead)</span>
              </div>
            ))}

            {!loading && waitingQueue.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">Queue is empty.</p>
            )}
          </div>
        </section>
      </div>

      {skipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Skip Current Patient</h3>
            <p className="mt-1 text-xs text-slate-500">Please add a reason before continuing.</p>

            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#075b9f]"
              placeholder="Enter reason for skipping this patient"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSkipModalOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function QueueManagementPage() {
  const { waitingQueue, stats, loading } = useQueue();

  const queueRows = useMemo(
    () => waitingQueue.slice(0, 8),
    [waitingQueue]
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Queue Management</h1>
        <p className="mt-1 text-xs text-slate-500">Monitor queue activity and patient flow.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Waiting" value={loading ? '…' : String(stats.waiting || 0)} caption="Currently waiting" icon={Users} />
        <StatCard label="Completed" value={loading ? '…' : String(stats.completed || 0)} caption="Queue completed" icon={CheckCircle2} />
        <StatCard label="Skipped" value={loading ? '…' : String(stats.skipped || 0)} caption="Skipped patients" icon={SkipForward} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Waiting queue</h2>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{queueRows.length} active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Queue ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">ETA</th>
              </tr>
            </thead>
            <tbody>
              {queueRows.map((row, index) => (
                <tr key={row.uniqueKey || `${row.id}-${index}`} className="border-t border-slate-200">
                  <td className="px-5 py-3 font-semibold text-slate-700">{row.id || '--'}</td>
                  <td className="px-5 py-3 text-slate-600">{row.status || 'waiting'}</td>
                  <td className="px-5 py-3 text-slate-600">{row.etaMinutes ?? '~0'} min</td>
                </tr>
              ))}

              {queueRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">No patients in queue.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);

      try {
        const user = auth.currentUser;

        if (!user) {
          throw new Error("You must be signed in to load reports.");
        }

        const today = new Date();
        const todayString = today.toISOString().slice(0, 10);

        const data = await getDashboardAnalytics(
          user,
          todayString,
          todayString
        );

        console.log("ADMIN REPORTS ANALYTICS:", data);

        setAnalytics(data);
      } catch (error) {
        console.error("Failed to load admin reports:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  const patientsServed = Number(
    analytics?.queue?.completed || 0
  );

  const averageWait = Number(
    analytics?.queue?.averageWaitMinutes || 0
  );

  const skipped = Number(
    analytics?.queue?.skipped || 0
  );

  const waiting = Number(
    analytics?.queue?.waiting || 0
  );

  const activeTerminals = Number(
    analytics?.terminals?.active || 0
  );

  const totalTickets = Number(
    analytics?.queue?.totalTickets || 0
  );

  const completionRate =
    totalTickets > 0
      ? Math.round((patientsServed / totalTickets) * 100)
      : 0;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">
          Reports & Analytics
        </h1>

        <p className="mt-1 text-xs text-slate-500">
          Track queue performance and operational insights.
        </p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <StatCard
          label="Patients served"
          value={loading ? "..." : patientsServed}
          caption="Today"
          icon={BarChart3}
        />

        <StatCard
          label="Avg. wait time"
          value={loading ? "..." : `${averageWait}m`}
          caption="Today"
          icon={Clock3}
        />

        <StatCard
          label="Completion rate"
          value={loading ? "..." : `${completionRate}%`}
          caption={`${skipped} skipped`}
          icon={CheckCircle2}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">
          Performance summary
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Currently waiting
            </p>

            <p className="mt-2 text-xl font-bold text-slate-800">
              {loading ? "..." : waiting}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Active terminals
            </p>

            <p className="mt-2 text-xl font-bold text-slate-800">
              {loading ? "..." : activeTerminals}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Total tickets
            </p>

            <p className="mt-2 text-xl font-bold text-slate-800">
              {loading ? "..." : totalTickets}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [theme, setTheme] = useState(loadStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-1 text-xs text-slate-500">Configure the admin panel experience.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Settings2 size={18} className="text-[#075b9f]" />
          <h2 className="text-sm font-semibold text-slate-700">Display preferences</h2>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <span>Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#075b9f]"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Department and queue settings will appear here when configured.
          </div>
        </div>
      </div>
    </div>
  );
}
