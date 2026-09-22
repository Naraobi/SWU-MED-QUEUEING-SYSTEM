import { useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  LockKeyhole,
  Mail,
  Clock3,
  IdCard,
  Eye,
  EyeOff,
  Info,
  Lightbulb,
  Lock,
  Globe,
  KeyRound,
  Circle,
  Palette,
  Upload,
  Monitor,
  Moon,
  Pipette,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Timer,
  Trash2,
  TrendingDown,
  TriangleAlert,
  Undo2,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import { auth } from '../../../firebase';

import { useAuth } from '../../services/Authcontext';
import { useQueue } from '../../context/QueueContext';

import {
  getUsers,
  getDepartments,
  getTerminals,
  getKiosks,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  updateDepartment,
  getDashboardAnalytics,
  getSecurityPinStatus,
  requestSecurityPinVerification,
  verifySecurityPinCode,
  validateSecurityPin,
  requestPasswordChangeCode,
  verifyPasswordChangeCode,
} from '../../services/backendApi';

import { fetchNotifications, fetchQueueState } from '../../services/api';

import { DateRangePicker, StatCard } from './shared';

import {
  getPresetRange,
  toDateKey,
  loadStoredTheme,
  applyTheme,
  loadStoredAccent,
  applyAccent,
  loadStoredAvatar,
  saveStoredAvatar,
} from './adminHelpers';

import { useLanguage } from './LanguageContext';
import Logo from '../../../assets/logo.png';

// =====================================================
// SHARED HELPERS
// =====================================================

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getRoleName(user) {
  if (user?.role?.role) return user.role.role;
  if (user?.role_name) return user.role_name;
  if (typeof user?.role === 'string') return user.role;
  if (user?.roles?.name) return user.roles.name;
  if (user?.roles?.role) return user.roles.role;
  return '';
}

function findDepartmentForUser(departments, user) {
  if (!Array.isArray(departments)) {
    return null;
  }

  if (user?.department_id) {
    const byId = departments.find(
      (department) =>
        String(department.department_id) === String(user.department_id)
    );

    if (byId) {
      return byId;
    }
  }

  const departmentName = String(user?.department || '').trim().toLowerCase();

  if (!departmentName) {
    return null;
  }

  return (
    departments.find(
      (department) =>
        String(department.name || '').trim().toLowerCase() === departmentName
    ) || null
  );
}

function findKioskForDepartment(kiosks, department) {
  if (!Array.isArray(kiosks) || !department?.kiosk_id) {
    return null;
  }

  return (
    kiosks.find(
      (kiosk) => String(kiosk.kiosk_id) === String(department.kiosk_id)
    ) || null
  );
}

function getInitials(user) {
  if (user?.first_name && user?.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }

  return 'JD';
}

function buildReportInsights({ waiting, skipped, completed, staffLabel, t }) {
  const insights = [];

  const totalHandled = Number(completed || 0) + Number(skipped || 0);

  const skipRate =
    totalHandled > 0 ? Math.round((Number(skipped || 0) / totalHandled) * 100) : 0;

  if (Number(waiting || 0) >= 10) {
    insights.push({
      icon: Info,
      tone: 'info',
      message: t('insights.highWaiting', { waiting }),
    });
  }

  const [activeStr, totalStr] = String(staffLabel || '').split('/');
  const activeNum = Number(activeStr);
  const totalNum = Number(totalStr);

  if (totalNum > 0 && activeNum / totalNum < 0.5) {
    insights.push({
      icon: TrendingDown,
      tone: 'warning',
      message: t('insights.lowStaffActive', { active: activeStr, total: totalStr }),
    });
  }

  if (skipRate >= 15) {
    insights.push({
      icon: TriangleAlert,
      tone: 'warning',
      message: t('insights.highSkipRate', { rate: skipRate }),
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: Lightbulb,
      tone: 'info',
      message: t('insights.allNormalReports'),
    });
  }

  return insights;
}

// =====================================================
// QUEUE MANAGEMENT
// =====================================================

// Figma-matched metric card, local to Queue Management only — the shared
// StatCard in ./shared.jsx stays untouched so Dashboard/Reports don't change.
function QueueStatCard({ label, value, caption, icon: Icon, highlight = false }) {
  return (
    <div className={`flex h-[152px] flex-col justify-between rounded-xl border bg-white p-[25px] transition-all duration-200 hover:-translate-y-1 hover:border-[#9D0A0E]/40 hover:shadow-lg ${highlight ? 'border-[#E6E6E6]' : 'border-[#C3C6D7]'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.6px] text-[#1F2937]">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7EEEE] text-[#9D0A0E]">
          <Icon size={18} />
        </span>
      </div>
      <p className="text-[30px] font-bold leading-[38px] tracking-[-0.6px] text-[#212B3A]">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-[0.6px] text-[#5F6368]">{caption}</p>
    </div>
  );
}

// A queue number prefixed "P-" is a priority ticket — mirrors the
// isPriority convention already used on the Super Admin queue view.
function isPriorityTicket(id) {
  return String(id || '').toUpperCase().startsWith('P-');
}

export function QueueManagementPage() {
  const {
    waitingQueue,
    activeTickets,
    stats,
    loading,
    refresh,
  } = useQueue();

  const { user } = useAuth();
  const { t } = useLanguage();
  const departmentPrefix = user?.department_prefix || user?.departmentPrefix || 'BP';
  const [showFullQueue, setShowFullQueue] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const [dateRange, setDateRange] = useState(() => getPresetRange('Today'));
  const rangeRef = useRef(dateRange);

  const [terminalLabel, setTerminalLabel] = useState('--');
  const [terminalLoading, setTerminalLoading] = useState(true);
  const [departmentTerminals, setDepartmentTerminals] = useState([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState('all');

  async function loadTerminalStats() {
    setTerminalLoading(true);

    try {
      const [terminalData, departmentData] = await Promise.all([
        getTerminals(),
        getDepartments(),
      ]);

      const department = findDepartmentForUser(departmentData, user);

      const departmentTerminals = department
        ? (terminalData || []).filter(
            (terminal) => String(terminal.department_id) === String(department.department_id)
          )
        : [];

      const active = departmentTerminals.filter(
        (terminal) => normalizeRole(terminal.status) === 'active'
      ).length;

      setTerminalLabel(`${active}/${departmentTerminals.length}`);
      setDepartmentTerminals(departmentTerminals);
    } catch (err) {
      console.error('Failed to load terminal stats:', err);
      setTerminalLabel('--');
      setDepartmentTerminals([]);
    } finally {
      setTerminalLoading(false);
    }
  }

  useEffect(() => {
    if (!departmentPrefix) {
      return;
    }

    const { start, end } = rangeRef.current;

    refresh(departmentPrefix, {
      start: toDateKey(start),
      end: toDateKey(end),
    });

    async function load() {
      await loadTerminalStats();
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentPrefix, refresh]);

  async function applyDateRange(newRange) {
    rangeRef.current = newRange;
    setDateRange(newRange);
    await handleApplyFilter();
  }

  async function handleApplyFilter() {
    if (!departmentPrefix) {
      return;
    }

    setRefreshing(true);

    try {
      const { start, end } = rangeRef.current;

      await Promise.all([
        refresh(departmentPrefix, {
          start: toDateKey(start),
          end: toDateKey(end),
        }),
        loadTerminalStats(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleReset() {
    await applyDateRange(getPresetRange('Today'));
  }

  // Multiple terminals in this department can each be actively serving
  // a different patient at the same time, so `activeTickets` (one entry
  // per terminal that currently has a called/serving patient) replaces
  // the old single "currentlyServing" value — that value could only
  // ever reflect whichever terminal happened to call most recently.
  const activeTicketsByTerminal = useMemo(() => {
    const map = {};
    activeTickets.forEach((ticket) => {
      if (ticket?.counterId) {
        map[String(ticket.counterId)] = ticket;
      }
    });
    return map;
  }, [activeTickets]);

  const displayedCurrent =
    selectedTerminalId === 'all'
      ? null
      : activeTicketsByTerminal[String(selectedTerminalId)] || null;

  const selectedTerminalRecord =
    selectedTerminalId === 'all'
      ? null
      : departmentTerminals.find(
          (terminal) => String(terminal.counter_id) === String(selectedTerminalId)
        );

  const selectedTerminalLabel = selectedTerminalRecord
    ? selectedTerminalRecord.prefix || `Terminal ${selectedTerminalRecord.counter_number}`
    : null;

  const totalWaiting = stats?.waiting || waitingQueue.length || 0;

  const QUEUE_PAGE_SIZE = 10;
  const queueTotalPages = Math.max(1, Math.ceil(waitingQueue.length / QUEUE_PAGE_SIZE));
  const pagedQueue = waitingQueue.slice((queuePage - 1) * QUEUE_PAGE_SIZE, queuePage * QUEUE_PAGE_SIZE);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-[38px] tracking-[-0.6px] text-[#212B3A]">{t('queue.title')}</h1>
          <p className="mt-1 text-base text-[#44474C]">{t('queue.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedTerminalId}
            onChange={(event) => setSelectedTerminalId(event.target.value)}
            className="h-[50px] rounded-lg border border-[#C3C6D7] bg-white px-4 text-sm font-semibold text-[#4B5563] outline-none focus:border-[#9D0A0E]"
          >
            <option value="all">All Terminals</option>
            {departmentTerminals.map((terminal) => (
              <option key={terminal.counter_id} value={terminal.counter_id}>
                {terminal.prefix || `Terminal ${terminal.counter_number}`}
              </option>
            ))}
          </select>

          <DateRangePicker value={dateRange} onApply={applyDateRange} />

          <button
            type="button"
            onClick={handleApplyFilter}
            disabled={refreshing}
            className="flex h-[50px] items-center gap-2 rounded-lg bg-[#9D0A0E] px-6 text-sm font-bold tracking-[0.6px] text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing && <RefreshCw size={14} className="animate-spin" />}
            {refreshing ? t('common.applying') : t('common.applyFilter')}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={refreshing}
            className="flex h-[50px] items-center rounded-lg border border-[#C3C6D7] bg-white px-5 text-sm font-semibold text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <QueueStatCard label={t('common.stat.totalWaiting')} value={loading ? '…' : String(totalWaiting)} caption={t('common.stat.forThisDepartment')} icon={Users} />
        <QueueStatCard label={t('common.stat.averageWait')} value="18m" caption={t('common.stat.noColumnYet')} icon={Timer} />
        <QueueStatCard label={t('common.stat.skipped')} value={loading ? '…' : String(stats?.skipped || 0)} caption={t('common.stat.totalSkipped')} icon={Undo2} />
        <QueueStatCard label={t('common.stat.completed')} value={loading ? '…' : String(stats?.completed || 0)} caption={t('common.stat.completedQueuing')} icon={CheckCircle2} highlight />
        <QueueStatCard label={t('common.stat.terminal')} value={terminalLoading ? '…' : terminalLabel} caption={t('common.stat.activeTerminals')} icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-[#C3C6D7] bg-white p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[#1F2937]">{selectedTerminalLabel || departmentPrefix}</h2>
            {selectedTerminalId !== 'all' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-[#065F46]">
                <span className={`h-2 w-2 rounded-full ${displayedCurrent ? 'bg-[#16A34A]' : 'bg-slate-300'}`} />
                {displayedCurrent ? 'Serving' : 'Idle'}
              </span>
            )}
          </div>

          {selectedTerminalId === 'all' ? (
            // Every terminal in the department, each showing its OWN
            // current patient (or idle) at the same time — multiple
            // terminals can be serving different patients simultaneously.
            <div className="grid flex-1 auto-rows-min grid-cols-1 gap-3 sm:grid-cols-2">
              {departmentTerminals.length === 0 && (
                <p className="col-span-full py-10 text-center text-xs text-slate-400">
                  No terminals configured for this department.
                </p>
              )}

              {departmentTerminals.map((terminal) => {
                const ticket = activeTicketsByTerminal[String(terminal.counter_id)] || null;
                const label = terminal.prefix || `Terminal ${terminal.counter_number}`;

                return (
                  <div
                    key={terminal.counter_id}
                    className="flex flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FB] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9D0A0E]/30 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-[#1F2937]">{label}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${ticket ? 'text-[#065F46]' : 'text-slate-400'}`}>
                        <span className={`h-2 w-2 rounded-full ${ticket ? 'bg-[#16A34A]' : 'bg-slate-300'}`} />
                        {ticket ? 'Serving' : 'Idle'}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-[#9D0A0E]">{loading ? '…' : ticket?.id || '--'}</p>
                    <p className="text-xs text-[#4B5563]">
                      {ticket
                        ? (ticket.service || 'Service') +
                          (ticket.secondsElapsed
                            ? ` · serving for ${Math.floor(ticket.secondsElapsed / 60)}m`
                            : '')
                        : 'Not currently serving a patient'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-[#F1F3F5] px-8 py-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.6px] text-[#4B5563]">{t('queue.nowServing')}</p>
              <p className="text-[64px] font-bold leading-[1] text-[#9D0A0E]">{loading ? '…' : displayedCurrent?.id || '--'}</p>
              <p className="text-[13px] text-[#4B5563]">
                {displayedCurrent
                  ? t('queue.terminalService', { terminal: displayedCurrent.terminal ?? '--', service: displayedCurrent.service || 'Service' }) +
                    (displayedCurrent.secondsElapsed
                      ? t('queue.servingFor', { minutes: Math.floor(displayedCurrent.secondsElapsed / 60) })
                      : '')
                  : selectedTerminalLabel
                    ? `${selectedTerminalLabel} is not currently serving a patient`
                    : 'No patient currently being served'}
              </p>
            </div>
          )}
        </section>

        <section className="flex flex-col rounded-xl border border-[#C3C6D7] bg-white">
          <div className="flex items-center justify-between border-b border-[#C3C6D7] px-6 py-5">
            <h2 className="text-lg font-semibold text-[#1F2937]">{t('queue.waitingQueue')}</h2>
            <span className="rounded bg-[#9D0A0E]/[0.08] px-2 py-1 text-sm font-medium tracking-[0.4px] text-[#9D0A0E]">{t('queue.inLine', { count: waitingQueue.length })}</span>
          </div>

          <div className="flex-1 p-2">
            {loading && <p className="py-6 text-center text-xs text-slate-400">{t('dashboard.loadingQueue')}</p>}

            {!loading &&
              waitingQueue.slice(0, 5).map((row, index) => {
                const priority = isPriorityTicket(row.id);
                return (
                  <div
                    key={row.uniqueKey || `${row.id}-${index}`}
                    className="flex items-center justify-between gap-3 border-b border-[#C3C6D7] px-4 py-3 last:border-b-0"
                  >
                    <span className="flex items-center gap-1">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F3F5] text-sm font-medium text-[#1F2937]">{index + 1}</span>
                      <span className={`rounded px-2.5 py-1.5 text-lg font-medium ${priority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'} bg-[#F1F3F5]`}>{row.id}</span>
                    </span>
                    <span className="shrink-0 text-base text-[#4B5563]">{t('queue.waitingMinutes', { minutes: row.etaMinutes ?? '~0' })}</span>
                  </div>
                );
              })}

            {!loading && waitingQueue.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">{t('dashboard.queueEmpty')}</p>
            )}
          </div>

          {waitingQueue.length > 0 && (
            <div className="border-t border-[#C3C6D7] px-4 py-5">
              <button
                type="button"
                onClick={() => {
                  setQueuePage(1);
                  setShowFullQueue(true);
                }}
                className="w-full text-center text-[13px] font-medium tracking-[0.65px] text-[#9D0A0E] hover:underline"
              >
                {t('queue.viewFullQueue')}
              </button>
            </div>
          )}
        </section>
      </div>

      {showFullQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-[#C3C6D7] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#C3C6D7] px-6 py-5">
              <h2 className="text-lg font-semibold text-[#1F2937]">{t('queue.waitingQueue')}</h2>
              <div className="flex items-center gap-3">
                <span className="rounded bg-[#9D0A0E]/[0.08] px-2 py-1 text-sm font-medium tracking-[0.4px] text-[#9D0A0E]">{t('queue.inLine', { count: waitingQueue.length })}</span>
                <button type="button" onClick={() => setShowFullQueue(false)} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#C3C6D7]">
              {pagedQueue.map((row, index) => {
                const priority = isPriorityTicket(row.id);
                return (
                  <div key={row.uniqueKey || `${row.id}-${index}`} className="flex items-center justify-between px-5 py-3">
                    <span className="flex items-center gap-1">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F3F5] text-sm font-medium text-[#1F2937]">{(queuePage - 1) * QUEUE_PAGE_SIZE + index + 1}</span>
                      <span className={`rounded px-2.5 py-1.5 text-lg font-medium ${priority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'} bg-[#F1F3F5]`}>{row.id}</span>
                    </span>
                    <span className="text-base text-[#4B5563]">{t('queue.waitingMinutes', { minutes: row.etaMinutes ?? '~0' })}</span>
                  </div>
                );
              })}

              {waitingQueue.length === 0 && (
                <p className="px-5 py-8 text-center text-xs text-slate-400">{t('dashboard.queueEmpty')}</p>
              )}
            </div>

            {waitingQueue.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#C3C6D7] px-5 py-3 text-xs text-slate-500">
                <span>{t('queue.showingQueue', { from: (queuePage - 1) * QUEUE_PAGE_SIZE + 1, to: Math.min(queuePage * QUEUE_PAGE_SIZE, waitingQueue.length), total: waitingQueue.length })}</span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                    disabled={queuePage === 1}
                    className="rounded-md border border-[#C3C6D7] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {t('common.prev')}
                  </button>

                  {Array.from({ length: queueTotalPages }, (_, i) => i + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setQueuePage(number)}
                      className={`rounded-md border px-3 py-1.5 font-semibold ${
                        number === queuePage ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white' : 'border-[#C3C6D7] bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
                    disabled={queuePage === queueTotalPages}
                    className="rounded-md border border-[#C3C6D7] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// TERMINAL MANAGEMENT
// =====================================================

export function TerminalManagementPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [departments, setDepartments] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [staff, setStaff] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ assigned_staff_id: '', counter_number: '' });
  const [page, setPage] = useState(1);

  const adminDepartment = useMemo(
    () => findDepartmentForUser(departments, user),
    [departments, user]
  );

  const adminKiosk = useMemo(
    () => findKioskForDepartment(kiosks, adminDepartment),
    [kiosks, adminDepartment]
  );

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [departmentData, terminalData, userData, kioskData] = await Promise.all([
        getDepartments(),
        getTerminals(),
        getUsers(),
        getKiosks(),
      ]);

      setDepartments(departmentData || []);
      setTerminals(terminalData || []);
      setStaff(userData || []);
      setKiosks(kioskData || []);

      const departmentRecord = findDepartmentForUser(departmentData, user);

      if (departmentRecord?.prefix) {
        const state = await fetchQueueState(departmentRecord.prefix);
        setCompletedCount(Number(state?.stats?.completed) || 0);
      }
    } catch (err) {
      console.error('Failed to load terminals:', err);
      setError(err?.message || 'Failed to load terminals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      await loadAll();
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.department_id, user?.department]);

  const departmentTerminals = useMemo(() => {
    if (!adminDepartment) {
      return [];
    }

    return terminals.filter(
      (terminal) => String(terminal.department_id) === String(adminDepartment.department_id)
    );
  }, [terminals, adminDepartment]);

  const departmentStaff = useMemo(() => {
    if (!adminDepartment) {
      return [];
    }

    return staff.filter(
      (person) =>
        normalizeRole(getRoleName(person)) === 'staff' &&
        String(person.department_id) === String(adminDepartment.department_id)
    );
  }, [staff, adminDepartment]);

  // A terminal's assigned_staff_id can point at someone who has since
  // transferred to another department. Looking them up only within
  // departmentStaff (rather than the full staff list) makes sure such
  // stale assignments render as "Unassigned" instead of showing a staff
  // member who no longer belongs to this terminal's department.
  const departmentStaffById = useMemo(() => {
    const map = {};
    departmentStaff.forEach((person) => {
      map[String(person.user_id)] = person;
    });
    return map;
  }, [departmentStaff]);

  const filteredTerminals = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return departmentTerminals;
    }

    return departmentTerminals.filter((terminal) => {
      const assigned = departmentStaffById[String(terminal.assigned_staff_id)];
      const name = `${assigned?.first_name || ''} ${assigned?.last_name || ''}`.toLowerCase();
      const email = String(assigned?.email || '').toLowerCase();

      return (
        name.includes(search) ||
        email.includes(search) ||
        String(terminal.prefix || '').toLowerCase().includes(search)
      );
    });
  }, [departmentTerminals, departmentStaffById, query]);

  const TERMINAL_PAGE_SIZE = 5;

  const totalPages = Math.max(1, Math.ceil(filteredTerminals.length / TERMINAL_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedTerminals = useMemo(
    () =>
      filteredTerminals.slice(
        (currentPage - 1) * TERMINAL_PAGE_SIZE,
        currentPage * TERMINAL_PAGE_SIZE
      ),
    [filteredTerminals, currentPage]
  );

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    return Array.from({ length: Math.min(3, totalPages) }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const active = departmentTerminals.filter(
      (terminal) => normalizeRole(terminal.status) === 'active'
    ).length;

    return {
      total: departmentTerminals.length,
      active,
      inactive: departmentTerminals.length - active,
      completed: completedCount,
    };
  }, [departmentTerminals, completedCount]);

  function nextCounterNumber() {
    const used = departmentTerminals
      .map((terminal) => Number(terminal.counter_number))
      .filter((number) => Number.isInteger(number) && number > 0);

    let candidate = 1;
    while (used.includes(candidate)) {
      candidate += 1;
    }

    return candidate;
  }

  function openAdd() {
    setForm({
      assigned_staff_id: '',
      counter_number: String(nextCounterNumber()),
      status: 'active',
    });
    setError(null);
    setModal('add');
  }

  function openEdit(terminal) {
    // A terminal can be left pointing at a staff member who has since
    // moved to another department. That staff member no longer appears
    // in `departmentStaff`, so the dropdown can't actually select them -
    // treat the assignment as unassigned instead of leaving a stale,
    // unselectable value in the form.
    const assignedStillInDepartment = departmentStaff.some(
      (person) => String(person.user_id) === String(terminal.assigned_staff_id)
    );

    setForm({
      assigned_staff_id: assignedStillInDepartment ? terminal.assigned_staff_id : '',
      counter_number: String(terminal.counter_number ?? ''),
    });
    setError(null);
    setModal({ type: 'edit', terminal });
  }

  function closeModal() {
    setModal(null);
    setConfirmDelete(false);
    setError(null);
  }

  async function saveTerminal() {
    if (!adminDepartment) {
      setError('Your department could not be determined.');
      return;
    }

    if (!String(form.counter_number).trim()) {
      setError('Terminal number is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        department_id: adminDepartment.department_id,
        counter_number: Number(form.counter_number),
        prefix: `${adminDepartment.prefix || 'T'}-${form.counter_number}`,
        assigned_staff_id: form.assigned_staff_id || null,
        status:
          modal?.type === 'edit'
            ? form.assigned_staff_id
              ? 'active'
              : 'inactive'
            : form.status || 'active',
      };

      if (modal?.type === 'edit') {
        await updateTerminal(modal.terminal.counter_id, payload);
      } else {
        await createTerminal(payload);
      }

      closeModal();
      await loadAll();
    } catch (err) {
      console.error('Failed to save terminal:', err);
      setError(err?.message || 'Failed to save terminal.');
    } finally {
      setSaving(false);
    }
  }

  async function removeTerminal() {
    if (!modal?.terminal?.counter_id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await deleteTerminal(modal.terminal.counter_id);
      closeModal();
      await loadAll();
    } catch (err) {
      console.error('Failed to delete terminal:', err);
      setError(err?.message || 'Failed to delete terminal.');
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-[38px] tracking-[-0.6px] text-[#212B3A]">{t('terminal.title')}</h1>
          <p className="mt-1 text-base text-[#44474C]">{t('terminal.subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          disabled={!adminDepartment || loading}
          className="flex h-[50px] items-center gap-2 rounded-lg bg-[#9D0A0E] px-6 text-sm font-bold tracking-[0.6px] text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Plus size={15} />
          {t('terminal.addButton')}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QueueStatCard label={t('common.stat.total')} value={loading ? '…' : String(stats.total)} caption={t('common.stat.totalTerminals')} icon={Monitor} />
        <QueueStatCard label={t('common.stat.active')} value={loading ? '…' : String(stats.active)} caption={t('common.stat.activeTerminals')} icon={CheckCircle2} />
        <QueueStatCard label={t('common.stat.inactive')} value={loading ? '…' : String(stats.inactive)} caption={t('common.stat.inactiveTerminal')} icon={XCircle} />
        <QueueStatCard label={t('common.stat.completed')} value={loading ? '…' : String(stats.completed)} caption={t('common.stat.completedQueuing')} icon={ClipboardCheck} />
      </div>

      <div className="rounded-xl border border-[#C3C6D7] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#C3C6D7] px-6 py-5">
          <h2 className="text-lg font-semibold text-[#1F2937]">{t('terminal.tableTitle')}</h2>

          <div className="relative w-64">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('common.search')}
              className="w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 pr-9 text-xs outline-none focus:border-[#9D0A0E]"
            />
            <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#C3C6D7] bg-[#F7EEEE] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">{t('terminal.table.terminalNo')}</th>
                <th className="px-5 py-3">{t('common.table.fullName')}</th>
                <th className="px-5 py-3">{t('staff.table.kiosk')}</th>
                <th className="px-5 py-3">{t('common.table.role')}</th>
                <th className="px-5 py-3">{t('common.table.status')}</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">{t('terminal.loadingTerminals')}</td>
                </tr>
              )}

              {!loading &&
                pagedTerminals.map((terminal) => {
                  const assigned = departmentStaffById[String(terminal.assigned_staff_id)];

                  return (
                    <tr
                      key={terminal.counter_id}
                      onClick={() => openEdit(terminal)}
                      className="cursor-pointer border-t border-[#C3C6D7] hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 text-[11px] font-semibold text-[#1F2937]">{terminal.prefix || `T-${terminal.counter_number}`}</td>
                      <td className="px-5 py-3 text-[11px] text-[#4B5563]">{assigned ? `${assigned.first_name} ${assigned.last_name}` : t('common.unassigned')}</td>
                      <td className="px-5 py-3 text-[11px] text-[#4B5563]">{adminKiosk?.name || '--'}</td>
                      <td className="px-5 py-3 text-[11px] text-[#4B5563]">{assigned ? t('common.stat.staff') : '--'}</td>
                      <td className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#4B5563]">
                        {normalizeRole(terminal.status) === 'active' ? t('common.stat.active') : t('common.stat.inactive')}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {!loading && filteredTerminals.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              {query.trim() ? t('terminal.noMatch') : t('terminal.noneFound')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#C3C6D7] px-5 py-3 text-xs text-slate-500">
          <span>{t('terminal.showing', { count: filteredTerminals.length, total: departmentTerminals.length })}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-[#C3C6D7] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('common.prev')}
            </button>

            {pageNumbers.map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={`rounded-md border px-3 py-1.5 font-semibold ${
                  number === currentPage
                    ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white'
                    : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {number}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-[#C3C6D7] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {/* ADD TERMINAL MODAL */}

      {modal === 'add' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <section className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
            <header className="border-b border-[#E5E7EB] px-5 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#1F2937]">{t('terminal.addModalTitle')}</h2>
                <button type="button" onClick={closeModal} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                  <X size={19} />
                </button>
              </div>

              <p className="mt-1 text-xs text-slate-500">{t('terminal.addModalSubtitle')}</p>
              <p className="text-xs text-slate-500">{t('terminal.requiredNote')}</p>
            </header>

            <div className="space-y-4 p-5">
              {adminDepartment && (
                <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Monitor size={14} className="text-[#9D0A0E]" />
                    {adminKiosk?.name || t('common.unassigned')} · {adminDepartment.name || adminDepartment}
                  </span>
                  <span className="shrink-0 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                    {t('terminal.prefixLabel', { prefix: adminDepartment.prefix || 'T' })}
                  </span>
                </div>
              )}

              {/* TERMINAL NAME */}
              <label className="block text-sm font-semibold text-slate-600">
                {t('terminal.terminalName')} <span className="text-[#9D0A0E]">*</span>

                <input
                  type="number"
                  min={1}
                  value={form.counter_number}
                  onChange={(e) => setForm((f) => ({ ...f, counter_number: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#9D0A0E]"
                />
              </label>

              {/* TERMINAL CODE / ID */}
              <label className="block text-sm font-semibold text-slate-600">
                <span className="flex items-center justify-between">
                  <span>{t('terminal.terminalCode')} <span className="text-[#9D0A0E]">*</span></span>
                  <span className="text-[10px] font-medium text-slate-400">{t('terminal.autoGenerated')}</span>
                </span>

                <input
                  value={`${adminDepartment?.prefix || 'T'}-${form.counter_number || ''}`}
                  disabled
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none"
                />
              </label>

              <p className="text-[10px] text-slate-400">{t('terminal.codeNote')}</p>

              {/* STATUS */}
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">{t('common.table.status')}</p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: 'active' }))}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold ${
                      form.status === 'active'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-[#E5E7EB] bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {form.status === 'active' && <Check size={13} />}
                    {t('common.stat.active')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: 'inactive' }))}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold ${
                      form.status === 'inactive'
                        ? 'border-slate-300 bg-slate-100 text-slate-700'
                        : 'border-[#E5E7EB] bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {t('common.stat.inactive')}
                  </button>
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] px-5 py-3">
              <button type="button" onClick={closeModal} disabled={saving} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={saveTerminal} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50">
                <Plus size={13} />
                {saving ? t('common.saving') : t('terminal.addButton')}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* EDIT ASSIGNED TERMINAL MODAL */}

      {modal?.type === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <section className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-[#C3C6D7] px-6 py-5">
              <h2 className="text-lg font-bold text-[#1F2937]">{t('terminal.editModalTitle')}</h2>
              <button type="button" onClick={closeModal} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={19} />
              </button>
            </header>

            <div className="space-y-4 p-5">
              {/* ASSIGNED TO */}
              <label className="block text-xs font-semibold text-slate-600">
                {t('terminal.assignedTo')}

                <select
                  value={form.assigned_staff_id}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_staff_id: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#9D0A0E]"
                >
                  <option value="">{t('common.unassigned')}</option>
                  {departmentStaff.map((person) => (
                    <option key={person.user_id} value={person.user_id}>
                      {person.first_name} {person.last_name}
                    </option>
                  ))}
                </select>
              </label>

              {/* LOCATION */}
              <label className="block text-xs font-semibold text-slate-600">
                {t('terminal.location')}

                <select
                  value="current"
                  disabled
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none"
                >
                  <option value="current">
                    {adminKiosk?.name || t('common.unassigned')}
                  </option>
                </select>
              </label>

              {/* TERMINAL NUMBER */}
              <label className="block text-xs font-semibold text-slate-600">
                {t('terminal.terminalNumber')}

                <input
                  type="number"
                  min={1}
                  value={form.counter_number}
                  onChange={(e) => setForm((f) => ({ ...f, counter_number: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#9D0A0E]"
                />
              </label>
            </div>

            <footer className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={13} />
                {t('terminal.deleteTerminal')}
              </button>

              <div className="flex gap-2">
                <button type="button" onClick={closeModal} disabled={saving} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">
                  {t('common.cancel')}
                </button>
                <button type="button" onClick={saveTerminal} disabled={saving} className="rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50">
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {/* DELETE CONFIRMATION */}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-[#E5E7EB] bg-white p-6 text-center shadow-xl">
            <h2 className="text-lg font-bold text-[#1F2937]">{t('terminal.deleteModalTitle')}</h2>
            <p className="mt-2 text-xs text-[#4B5563]">{t('terminal.deleteModalBody')}</p>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving} className="flex-1 rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={removeTerminal} disabled={saving} className="flex-1 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50">
                {saving ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// REPORTS & ANALYTICS
// =====================================================

export function ReportsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [queueStats, setQueueStats] = useState({ waiting: 0, completed: 0, skipped: 0 });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullLog, setShowFullLog] = useState(false);
  const [logPage, setLogPage] = useState(1);

  const [dateRange, setDateRange] = useState(() => getPresetRange('Today'));
  const rangeRef = useRef(dateRange);

  const adminDepartment = useMemo(
    () => findDepartmentForUser(departments, user),
    [departments, user]
  );

  async function loadReports() {
    setLoading(true);

    try {
      const [departmentData, userData] = await Promise.all([
        getDepartments(),
        getUsers(),
      ]);

      setDepartments(departmentData || []);
      setStaff(userData || []);

      const record = findDepartmentForUser(departmentData, user);

      if (record?.prefix) {
        const { start, end } = rangeRef.current;

        const [state, notifs, terminalData] = await Promise.all([
          fetchQueueState(record.prefix, { start: toDateKey(start), end: toDateKey(end) }),
          fetchNotifications(record.prefix),
          getTerminals(),
        ]);

        setQueueStats(state?.stats || { waiting: 0, completed: 0, skipped: 0 });
        setNotifications(notifs || []);

        setTerminals(
          (terminalData || []).filter(
            (terminal) => String(terminal.department_id) === String(record.department_id)
          )
        );
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      await loadReports();
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.department_id, user?.department]);

  async function applyDateRange(newRange) {
    rangeRef.current = newRange;
    setDateRange(newRange);
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  }

  async function handleReset() {
    await applyDateRange(getPresetRange('Today'));
  }

  const departmentStaff = useMemo(() => {
    if (!adminDepartment) return [];

    return staff.filter(
      (person) =>
        normalizeRole(getRoleName(person)) === 'staff' &&
        String(person.department_id) === String(adminDepartment.department_id)
    );
  }, [staff, adminDepartment]);

  const staffLabel = useMemo(() => {
    const active = departmentStaff.filter((person) => normalizeRole(person.status) === 'active').length;
    return `${active}/${departmentStaff.length}`;
  }, [departmentStaff]);

  const terminalLabel = useMemo(() => {
    const active = terminals.filter((terminal) => normalizeRole(terminal.status) === 'active').length;
    return `${active}/${terminals.length}`;
  }, [terminals]);

  const insights = useMemo(
    () =>
      buildReportInsights({
        waiting: queueStats.waiting,
        skipped: queueStats.skipped,
        completed: queueStats.completed,
        staffLabel,
        t,
      }),
    [queueStats, staffLabel, t]
  );

  const LOG_PAGE_SIZE = 10;
  const logTotalPages = Math.max(1, Math.ceil(notifications.length / LOG_PAGE_SIZE));
  const pagedLog = notifications.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-[38px] tracking-[-0.6px] text-[#212B3A]">{t('reports.title')}</h1>
          <p className="mt-1 text-base text-[#44474C]">{t('reports.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onApply={applyDateRange} />

          <button
            type="button"
            onClick={() => applyDateRange(dateRange)}
            disabled={refreshing}
            className="flex h-[50px] items-center gap-2 rounded-lg bg-[#9D0A0E] px-6 text-sm font-bold tracking-[0.6px] text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing && <RefreshCw size={12} className="animate-spin" />}
            {refreshing ? t('common.applying') : t('common.applyFilter')}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={refreshing}
            className="flex h-[50px] items-center rounded-lg border border-[#C3C6D7] bg-white px-5 text-sm font-semibold text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <QueueStatCard label={t('common.stat.totalWaiting')} value={loading ? '…' : String(queueStats.waiting || 0)} caption={t('common.stat.acrossAllDepartments')} icon={Users} />
        <QueueStatCard label={t('common.stat.averageWait')} value="18m" caption={t('common.stat.noColumnYet')} icon={Clock3} />
        <QueueStatCard label={t('common.stat.completed')} value={loading ? '…' : String(queueStats.completed || 0)} caption={t('common.stat.completedQueuing')} icon={CheckCircle2} />
        <QueueStatCard label={t('common.stat.staff')} value={loading ? '…' : staffLabel} caption={t('common.stat.activeStaffTotal')} icon={IdCard} />
        <QueueStatCard label={t('common.stat.terminal')} value={loading ? '…' : terminalLabel} caption={t('common.stat.activeTerminal')} icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-[#C3C6D7] bg-white p-5 lg:col-span-7">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-[#9D0A0E]" />
            <h2 className="text-lg font-semibold text-[#1F2937]">{t('reports.aiInsights')}</h2>
          </div>

          <div className="mt-4 space-y-3">
            {insights.map((insight, index) => {
              const Icon = insight.icon;
              const tone =
                insight.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-[#9D0A0E]/15 bg-[#9D0A0E]/5 text-[#1F2937]';

              return (
                <div key={index} className={`rounded-lg border p-4 text-xs ${tone}`}>
                  <div className="flex items-start gap-3">
                    <Icon size={16} className="mt-0.5 shrink-0" />
                    <p className="leading-relaxed">{insight.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[#C3C6D7] bg-white p-5 lg:col-span-5">
          <div>
            <h2 className="mb-4 text-sm font-bold text-[#1F2937]">{t('reports.recentActivity')}</h2>

            <div className="space-y-4">
              {loading && <p className="text-xs text-slate-400">{t('common.loading')}</p>}

              {!loading &&
                notifications.slice(0, 3).map((item, index) => (
                  <div key={item.id || index} className="flex items-start gap-3">
                    <span className="mt-1.5 block h-2.5 w-2.5 shrink-0 rounded-full bg-[#9D0A0E]" />
                    <div>
                      <p className="text-xs font-semibold text-[#1F2937]">{item.title || t('reports.activityFallback')}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{item.message || item.time || ''}</p>
                    </div>
                  </div>
                ))}

              {!loading && notifications.length === 0 && (
                <p className="text-xs text-slate-400">{t('reports.noActivity')}</p>
              )}
            </div>
          </div>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFullLog(true)}
              className="mt-6 text-center text-xs font-semibold text-[#9D0A0E] hover:underline"
            >
              {t('reports.viewFullLog')}
            </button>
          )}
        </div>
      </div>

      {/* FULL ACTIVITY LOG MODAL */}

      {showFullLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-[#C3C6D7] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#C3C6D7] px-6 py-5">
              <h2 className="text-lg font-bold text-[#1F2937]">{t('reports.recentActivity')}</h2>
              <button type="button" onClick={() => setShowFullLog(false)} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="divide-y divide-[#E5E7EB] px-5">
              {pagedLog.map((item, index) => (
                <div key={item.id || index} className="flex items-start gap-3 py-4">
                  <span className="mt-1.5 block h-2.5 w-2.5 shrink-0 rounded-full bg-[#9D0A0E]" />
                  <div>
                    <p className="text-lg font-semibold text-[#1F2937]">{item.title || t('reports.activityFallback')}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{item.message || item.time || ''}</p>
                  </div>
                </div>
              ))}

              {pagedLog.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">{t('reports.noActivity')}</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#C3C6D7] px-5 py-3 text-xs text-slate-500">
              <span>{t('reports.showingLog', { from: notifications.length === 0 ? 0 : (logPage - 1) * LOG_PAGE_SIZE + 1, to: Math.min(logPage * LOG_PAGE_SIZE, notifications.length), total: notifications.length })}</span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage === 1}
                  className="rounded-md border border-[#C3C6D7] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                >
                  {t('common.prev')}
                </button>

                {Array.from({ length: logTotalPages }, (_, i) => i + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setLogPage(number)}
                    className={`rounded-md border px-3 py-1.5 font-semibold ${
                      number === logPage ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white' : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                  disabled={logPage === logTotalPages}
                  className="rounded-md border border-[#C3C6D7] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// SETTINGS
// =====================================================

const ACCENT_SWATCHES = [
  '#1D4E89', '#4B5563', '#2563A8', '#3F5877',
  '#334155', '#0F766E', '#16A34A', '#4D7C57',
  '#A16207', '#C2410C', '#5B4636', '#B0264A',
  '#5C3A3A', '#9333EA', '#4338CA',
];

function ChangeProfileModal({ onClose, onSave }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onSave(String(reader.result || ''));
      onClose();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <h2 className="text-lg font-bold text-[#1F2937]">{t('modal.changeProfile')}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </header>

        <div className="p-5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#7d0809]"
          >
            <Camera size={15} />
            {t('modal.uploadPhoto')}
          </button>

          <p className="mt-3 text-[10px] text-slate-400">
            {t('modal.avatarNote')}
          </p>
        </div>
      </div>
    </div>
  );
}

function DepartmentCustomizationModal({ user, department, onClose, avatar, onAvatarChange }) {
  const { t } = useLanguage();
  const [name, setName] = useState(department?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [changingPhoto, setChangingPhoto] = useState(false);

  async function handleSave() {
    if (!department?.department_id) {
      setError('Your department could not be determined.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateDepartment(department.department_id, { name });
      onClose();
    } catch (err) {
      console.error('Failed to update department:', err);
      setError(err?.message || 'Failed to update department.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <h2 className="text-lg font-bold text-[#1F2937]">{t('modal.deptCustomization')}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt="Profile" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dce8f9] text-sm font-semibold text-slate-700">
                {getInitials(user)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setChangingPhoto(true)}
              className="rounded-md bg-[#F1F3F5] px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              {t('common.change')}
            </button>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            {t('modal.departmentName')}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#9D0A0E]"
            />
             </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#E5E7EB] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </footer>
      </div>

      {changingPhoto && (
        <ChangeProfileModal
          onClose={() => setChangingPhoto(false)}
          onSave={onAvatarChange}
        />
      )}
    </div>
  );
}

function ThemeModal({ theme, onClose, onSaveTheme }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(theme);
  const [accent, setAccent] = useState(loadStoredAccent());
  const colorInputRef = useRef(null);

  function handleSave() {
    applyTheme(mode);
    onSaveTheme(mode);
    applyAccent(accent);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <h2 className="text-lg font-bold text-[#1F2937]">{t('settings.theme')}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </header>

        <div className="p-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'light', labelKey: 'modal.light', icon: Sun },
              { key: 'dark', labelKey: 'modal.dark', icon: Moon },
              { key: 'device', labelKey: 'modal.device', icon: Monitor },
            ].map(({ key, labelKey, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  mode === key ? 'border-[#9D0A0E] bg-[#9D0A0E]/5 text-[#9D0A0E]' : 'border-[#E5E7EB] text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} />
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3">
            {ACCENT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAccent(color)}
                className="relative flex h-14 items-center justify-center rounded-xl bg-[#B34C4C]/10 transition hover:bg-[#B34C4C]/20"
              >
                <span className="h-9 w-9 rounded-full" style={{ backgroundColor: color }} />
                {accent === color && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Check size={12} />
                  </span>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="relative flex h-14 items-center justify-center rounded-xl bg-[#B34C4C]/10 transition hover:bg-[#B34C4C]/20"
              title="Custom color"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                <Pipette size={16} />
              </span>
              <input
                ref={colorInputRef}
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </button>
          </div>

          <p className="mt-4 text-[10px] text-slate-400">
            {t('modal.themeNote')}
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#E5E7EB] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave} className="rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809]">
            {t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CreatePinModal({ onClose, onContinue }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await onContinue(pin);
    } catch (err) {
      setError(err?.message || 'Failed to send verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinChange = (value, setter) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setter(digitsOnly);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">
              Create Security PIN
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Protect sensitive system operations
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FBF1F1] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9D0A0E]">
              <ShieldCheck size={16} />
            </div>

            <p className="text-[11px] leading-4 text-slate-600">
              Create a 6-digit security PIN. This PIN will be required for
              protected kiosk and department operations.
            </p>
          </div>

          <div>
            <label
              htmlFor="admin-security-pin"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              New PIN
            </label>

            <input
              id="admin-security-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value, setPin)}
              placeholder="Enter 6-digit PIN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm tracking-[0.35em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          <div>
            <label
              htmlFor="admin-confirm-security-pin"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Confirm PIN
            </label>

            <input
              id="admin-confirm-security-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={confirmPin}
              onChange={(e) =>
                handlePinChange(e.target.value, setConfirmPin)
              }
              placeholder="Re-enter 6-digit PIN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm tracking-[0.35em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={submitting}
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailCodeModal({
  icon: Icon = LockKeyhole,
  title = 'Verify Your Email',
  subtitle = "We've sent a 6-digit verification code to your registered email address.",
  verifyLabel = 'Verify',
  onClose,
  onBack,
  onVerify,
  onResend,
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleCodeChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    setError('');
    setResent(false);
  };

  const handleVerify = async () => {
    setError('');

    if (!/^\d{6}$/.test(code)) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setVerifying(true);

    try {
      await onVerify(code);
    } catch (err) {
      setError(err?.message || 'Failed to verify the code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);

    try {
      await onResend();
      setCode('');
      setResent(true);
    } catch (err) {
      setError(err?.message || 'Failed to resend the verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {title}
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Confirm your identity to continue
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FBF1F1] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9D0A0E]">
              <Icon size={15} />
            </div>

            <p className="text-[11px] leading-4 text-slate-600">
              {subtitle}
            </p>
          </div>

          <div>
            <label
              htmlFor="admin-email-verification-code"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Verification Code
            </label>

            <input
              id="admin-email-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold tracking-[0.4em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400">
              Code expires in 10 minutes.
            </p>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[10px] font-semibold text-[#9D0A0E] hover:underline disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend Code'}
            </button>
          </div>

          {resent && !error && (
            <p className="text-xs font-medium text-emerald-600">
              A new verification code has been sent.
            </p>
          )}

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            disabled={verifying}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : verifyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({
  title = 'PIN Created',
  subtitle = 'Your security PIN has been successfully created. You can now use it for protected kiosk and department operations.',
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex flex-col items-center px-6 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <Check size={24} strokeWidth={2.5} />
          </div>

          <h2 className="mt-4 text-base font-bold text-slate-800">
            {title}
          </h2>

          <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
            {subtitle}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-md bg-[#9D0A0E] px-6 py-2 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function SecurityPinGate({ onUnlock }) {
  const { user, signOut } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(null);
  const [pendingPin, setPendingPin] = useState('');

  async function handleUnlock() {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    setVerifying(true);

    try {
      await validateSecurityPin(auth.currentUser, pin);
      onUnlock();
    } catch (err) {
      setPin('');
      setError(err?.message || 'Invalid Security PIN.');
    } finally {
      setVerifying(false);
    }
  }

  function closeRecovery() {
    setRecoveryStep(null);
    setPendingPin('');
  }

  async function handleRecoveryContinue(newPin) {
    setPendingPin(newPin);
    await requestSecurityPinVerification(auth.currentUser);
    setRecoveryStep('verify');
  }

  async function handleRecoveryResend() {
    await requestSecurityPinVerification(auth.currentUser);
  }

  async function handleRecoveryVerify(code) {
    await verifySecurityPinCode(auth.currentUser, code, pendingPin);
    setPendingPin('');
    setRecoveryStep('success');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <ShieldCheck size={22} />
          </div>

          <h2 className="mt-4 text-base font-bold text-slate-800">
            Enter Security PIN
          </h2>

          <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
            For your protection, enter your 6-digit Security PIN to continue.
          </p>

          {user?.email && (
            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Signed in as {user.email}
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 pb-2 pt-4">
          <input
            id="admin-pin-gate-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="Enter 6-digit PIN"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm tracking-[0.35em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
          />

          {error && (
            <p className="text-center text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-3 px-6 pb-6 pt-3">
          <button
            type="button"
            onClick={handleUnlock}
            disabled={verifying || pin.length !== 6}
            className="w-full rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Unlock'}
          </button>

          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setRecoveryStep('create')}
              className="font-semibold text-[#9D0A0E] hover:underline"
            >
              Forgot your PIN?
            </button>

            <span className="text-slate-400">
              Not you?{' '}
              <button type="button" onClick={signOut} className="font-semibold text-slate-700 hover:underline">
                Sign out
              </button>
            </span>
          </div>
        </div>
      </div>

      {recoveryStep === 'create' && (
        <CreatePinModal
          onClose={closeRecovery}
          onContinue={handleRecoveryContinue}
        />
      )}

      {recoveryStep === 'verify' && (
        <EmailCodeModal
          icon={ShieldCheck}
          title="Verify Your Email"
          verifyLabel="Continue"
          onClose={closeRecovery}
          onBack={() => setRecoveryStep('create')}
          onVerify={handleRecoveryVerify}
          onResend={handleRecoveryResend}
        />
      )}

      {recoveryStep === 'success' && (
        <SuccessModal
          title="PIN Created"
          subtitle="Your new security PIN is ready to use."
          onClose={() => {
            closeRecovery();
            onUnlock();
          }}
        />
      )}
    </div>
  );
}


// =====================================================
// SETTINGS - EXACT REFERENCE IMPLEMENTATION
// =====================================================

const SETTINGS_ACCENT_PRESETS = [
  '#9D0A0E',
  '#B34C4C',
  '#1F2937',
  '#0F766E',
  '#4B5563',
];

const SETTINGS_LANGUAGES = ['English', 'Filipino', 'Cebuano'];

const SETTINGS_CLOCK_FORMATS = [
  '12-Hour (1:30 PM)',
  '24-Hour (13:30)',
];

const SETTINGS_THEME_MODES = [
  {
    key: 'light',
    label: 'Light Mode',
    caption: 'Default hospital theme',
    icon: Sun,
  },
  {
    key: 'dark',
    label: 'Dark Mode',
    caption: 'Dimmed high-contrast',
    icon: Moon,
  },
  {
    key: 'system',
    label: 'System Default',
    caption: 'Follows OS preference',
    icon: Monitor,
  },
];

const SETTINGS_THEME_SWATCHES = [
  { key: 'blue', colors: ['#9D0A0E', '#D4B0B1', '#7D080B', '#F0DADA'] },
  { key: 'slate', colors: ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB'] },
  { key: 'ocean', colors: ['#1E5FA8', '#5B8FC9', '#123C73', '#A8C4E0'] },
  { key: 'steel', colors: ['#64748B', '#94A3B8', '#334155', '#CBD5E1'] },
  { key: 'graphite', colors: ['#455A64', '#78909C', '#37474F', '#B0BEC5'] },
  { key: 'teal', colors: ['#14B8A6', '#5EEAD4', '#0F766E', '#99F6E4'] },
  { key: 'green', colors: ['#22C55E', '#86EFAC', '#15803D', '#BBF7D0'] },
  { key: 'moss', colors: ['#5F7A5F', '#8FA98F', '#3F5A3F', '#B8CBB8'] },
  { key: 'olive', colors: ['#A3A32B', '#C7C755', '#7A7A1F', '#DEDE8A'] },
  { key: 'orange', colors: ['#F97316', '#FDBA74', '#C2410C', '#FED7AA'] },
  { key: 'brown', colors: ['#6B4F3F', '#A98A76', '#4A362A', '#D6C0B1'] },
  { key: 'rose', colors: ['#E11D6B', '#F9A8C4', '#9F1239', '#FBCFE0'] },
  { key: 'mauve', colors: ['#8B6B6B', '#B08F8F', '#6A4F4F', '#D4BDBD'] },
  { key: 'pink', colors: ['#E879C6', '#F5B4E0', '#C0439C', '#FBDCF1'] },
  { key: 'purple', colors: ['#8B5CF6', '#C4B5FD', '#6D28D9', '#DDD6FE'] },
];

function settingsQuadrantGradient(colors) {
  const [a, b, c, d] = colors;
  return `conic-gradient(from 0deg, ${a} 0deg 90deg, ${b} 90deg 180deg, ${c} 180deg 270deg, ${d} 270deg 360deg)`;
}

function SettingsExactSection({ icon: Icon, title, subtitle, badge, children }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex items-start gap-2.5">
          <Icon size={16} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
          <div>
            <h2 className="text-base font-bold text-[#1F2937]">{title}</h2>
            <p className="mt-0.5 text-xs leading-4.5 text-[#667085]">{subtitle}</p>
          </div>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-[#F1F3F5] px-2.5 py-1 text-[10px] font-semibold text-[#667085]">
            {badge}
          </span>
        )}
      </div>
      <div className="border-t border-[#E5E7EB] px-6 py-5">{children}</div>
    </section>
  );
}

function SettingsExactFieldLabel({ children, required = false, rightLabel = '' }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#4B5563]">
        {children}
        {required && <span className="ml-0.5 text-[#9D0A0E]">*</span>}
      </label>
      {rightLabel && (
        <span className="text-[10px] font-semibold uppercase text-[#98A2B3]">{rightLabel}</span>
      )}
    </div>
  );
}

function SettingsExactHint({ children }) {
  return <p className="mt-1.5 text-[10px] leading-4 text-[#98A2B3]">{children}</p>;
}

function SettingsPinBoxes({ value, onChange, ariaLabel, autoFocus = false, showToggle = true, boxed = true }) {
  const [show, setShow] = useState(false);
  const refs = useRef([]);

  function updateDigits(index, rawValue) {
    const digits = String(rawValue || '').replace(/\D/g, '');

    if (!digits) {
      const next = Array.from({ length: 6 }, (_, i) => value[i] || '');
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    const next = Array.from({ length: 6 }, (_, i) => value[i] || '');

    digits
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });

    onChange(next.join('').slice(0, 6));
    refs.current[Math.min(5, index + digits.length)]?.focus();
  }

  function handlePaste(event, index) {
    event.preventDefault();

    const pasted = event.clipboardData
      ?.getData('text')
      ?.replace(/\D/g, '')
      .slice(0, 6);

    if (!pasted) return;

    const next = Array.from({ length: 6 }, (_, i) => value[i] || '');

    pasted
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });

    onChange(next.join('').slice(0, 6));

    refs.current[Math.min(5, index + pasted.length - 1)]?.focus();
  }

  function handleKeyDown(event, index) {
    const next = Array.from({ length: 6 }, (_, i) => value[i] || '');

    if (event.key === 'Backspace') {
      if (next[index]) {
        event.preventDefault();
        next[index] = '';
        onChange(next.join(''));
        return;
      }

      if (index > 0) {
        event.preventDefault();
        next[index - 1] = '';
        onChange(next.join(''));
        refs.current[index - 1]?.focus();
      }

      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  const inputType = showToggle && show ? 'text' : 'password';

  return (
    <div className={boxed ? 'relative w-full rounded-md border border-[#667085] bg-white p-2.5' : 'w-full'}>
      <div className={`grid w-full grid-cols-6 gap-2 ${boxed ? 'pr-10' : ''}`}>
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            autoFocus={autoFocus && index === 0}
            aria-label={`${ariaLabel} digit ${index + 1}`}
            type={showToggle ? inputType : 'text'}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={ariaLabel.toLowerCase().includes('verification') ? 'one-time-code' : 'off'}
            maxLength={1}
            value={value[index] || ''}
            onFocus={(event) => event.target.select()}
            onChange={(event) => updateDigits(index, event.target.value)}
            onPaste={(event) => handlePaste(event, index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="h-10 w-full min-w-0 rounded-md border border-[#D0D5DD] bg-white text-center text-[15px] font-semibold text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/15"
          />
        ))}
      </div>

      {showToggle && (
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-[#98A2B3] hover:bg-[#F1F3F5] hover:text-[#475467]"
          aria-label={show ? 'Hide PIN' : 'Show PIN'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
    </div>
  );
}

function SettingsExactPinEmailModal({ onClose, onContinue, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleContinue() {
    setError('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setError('Your authentication session is unavailable. Please log in again.');
      return;
    }

    const registeredEmail = String(firebaseUser.email || '').trim().toLowerCase();
    if (!registeredEmail) {
      setError('Your registered email address could not be determined.');
      return;
    }

    if (normalizedEmail !== registeredEmail) {
      setError('The email address does not match your registered account email.');
      return;
    }

    try {
      setSending(true);

      const result = await requestSecurityPinVerification(
        firebaseUser,
        normalizedEmail
      );

      if (result && (result.success === false || result.ok === false)) {
        throw new Error(
          result.message ||
            result.error ||
            'The verification code could not be sent.'
        );
      }

      onContinue(normalizedEmail);
    } catch (err) {
      console.error('Failed to send Security PIN verification email:', err);
      setError(
        err?.message ||
          'Failed to send the verification code. Please check your email configuration and try again.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-6">
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative px-8 pb-7 pt-8 text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 text-[#98A2B3] transition hover:text-[#344054]"
          >
            <X size={20} />
          </button>

          <div className="inline-flex items-center rounded-full bg-[#F1F3F5] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#475467]">
            <span>STEP 1 OF 3</span>
            <span className="mx-2 text-[#98A2B3]">•</span>
            <span>IDENTITY VERIFICATION</span>
          </div>

          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5F5] text-[#9D0A0E]">
            <ShieldCheck size={27} strokeWidth={2.2} />
          </div>

          <h2 className="mt-5 text-[27px] font-bold tracking-[-0.6px] text-[#1F2937]">
            Change Security PIN
          </h2>
          <p className="mx-auto mt-1 max-w-[310px] text-[10px] leading-4 text-[#667085]">
            For your security, we’ll send a verification code to your registered email address.
          </p>
        </div>

        <div className="space-y-5 px-8 pb-8">
          <div>
            <label htmlFor="settings-pin-confirm-email" className="mb-2 block text-[13px] font-semibold text-[#1F2937]">
              Email
            </label>
            <div className="relative">
              <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#344054]" />
              <input
                id="settings-pin-confirm-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !sending) handleContinue();
                }}
                placeholder="Enter email"
                className="h-12 w-full rounded-md border border-[#D0D5DD] bg-white pl-11 pr-3 text-[15px] text-[#1F2937] outline-none transition placeholder:text-[#667085] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-[#CFE2FF] bg-[#F3F8FF] px-4 py-4">
            <Info size={14} className="mt-0.5 shrink-0 text-[#344054]" />
            <p className="text-[9px] leading-4 text-[#475467]">
              Authorized admin verification code remains valid for 10 minutes. Check spam folder if not received.
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-[#9D0A0E]">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={sending}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[#B5090D] text-[15px] font-semibold text-white transition hover:bg-[#92070A] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {sending ? 'Sending...' : 'Send Verification Code'}
            {!sending && <ChevronRight size={18} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-[50px] w-full rounded-md border border-[#D0D5DD] bg-white text-[15px] font-medium text-[#344054] transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsExactCreatePinModal({
  onClose,
  onContinue,
  initialValue = '',
  verificationCode = '',
  requireVerificationCode = true,
  showStepBadge = true,
  ctaLabel = '',
  saving = false,
  serverError = '',
}) {
  const [pin, setPin] = useState(initialValue);
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const canContinue = pin.length === 6 && confirmPin.length === 6 && !saving;

  function handleContinue() {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError('Please enter a 6-digit PIN. Only digits (0–9) are accepted.');
      return;
    }

    if (!/^\d{6}$/.test(confirmPin)) {
      setError('Please confirm your 6-digit PIN.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    if (requireVerificationCode && !/^\d{6}$/.test(verificationCode)) {
      setError('Your verification code is missing. Please verify your email first.');
      return;
    }

    onContinue(pin);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-6">
      <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="relative px-8 pb-5 pt-7">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 text-[#98A2B3] hover:text-[#344054]"><X size={19} /></button>

          {showStepBadge && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-[#FBF1F1] px-2.5 py-1 text-[10px] font-bold text-[#9D0A0E]">STEP 3 OF 3</span>
              <span className="text-[10px] font-medium text-[#667085]">Security Protocol</span>
            </div>
          )}

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#9D0A0E]"><ShieldCheck size={19} /></div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.04em] text-[#667085]">ADMIN CREDENTIALS</div>
              <h2 className="mt-1 text-[21px] font-bold tracking-[-0.4px] text-[#1F2937]">Set Up Security PIN</h2>
              <p className="mt-1 max-w-[390px] text-[10px] leading-4.5 text-[#667085]">Create a Security PIN to authorize protected system actions such as resetting records.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-8 pb-6">
          <div>
            <SettingsExactFieldLabel required rightLabel="6 DIGITS">New Security PIN</SettingsExactFieldLabel>
            <SettingsPinBoxes value={pin} onChange={setPin} ariaLabel="New Security PIN" autoFocus showToggle boxed />
            <div className="mt-2 flex items-center gap-1.5 text-[9px] leading-4 text-[#667085]">
              <XCircle size={10} className="text-[#9D0A0E]" />
              Please enter a 6-digit PIN. Only digits (0–9) are accepted.
            </div>
          </div>

          <div>
            <SettingsExactFieldLabel required rightLabel="MATCH NEW PIN">Confirm Security PIN</SettingsExactFieldLabel>
            <SettingsPinBoxes value={confirmPin} onChange={setConfirmPin} ariaLabel="Confirm Security PIN" showToggle boxed={false} />
          </div>

          {(error || serverError) && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-[#9D0A0E]">
              {error || serverError}
            </p>
          )}

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <LockKeyhole size={12} className="mt-0.5 shrink-0 text-[#667085]" />
              <span className="text-[9px] leading-4 text-[#667085]">Keep your Security PIN private. Do not share it with other users.</span>
            </div>
          </div>
        </div>

        <div className="px-8 pb-3">
          <button type="button" onClick={handleContinue} disabled={!canContinue} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#B5090D] text-[11px] font-bold text-white transition hover:bg-[#92070A] disabled:cursor-not-allowed disabled:opacity-45">
            {saving ? 'Saving PIN...' : ctaLabel || 'Change PIN'} <ChevronRight size={14} />
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="mt-2.5 h-9 w-full rounded-md border border-[#D0D5DD] bg-white text-[10px] font-semibold text-[#344054] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-55">Cancel</button>
        </div>

        <div className="px-8 pb-5 pt-2.5 text-center text-[7px] uppercase tracking-[0.12em] text-[#98A2B3]">
          <LockKeyhole size={8} className="mr-1 inline-block -translate-y-px" />256-BIT ENCRYPTED HOSPITAL ADMINISTRATION PROTOCOL
        </div>
      </div>
    </div>
  );
}

function SettingsExactPinVerificationModal({ firebaseUser, verificationEmail, onClose, onBack, onSuccess }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  function handleVerify() {
    setError('');

    if (!/^\d{6}$/.test(code)) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    if (!firebaseUser) {
      setError('Your authentication session is unavailable. Please log in again.');
      return;
    }

    // Keep the code for Step 3. The existing backend verification endpoint
    // validates the code together with the new PIN, so the code is not
    // consumed or skipped before the PIN is entered.
    onSuccess(code);
  }

  async function handleResend() {
    setError('');
    setResendMessage('');

    if (!firebaseUser) {
      setError('Your authentication session is unavailable. Please log in again.');
      return;
    }

    try {
      setIsResending(true);

      const result = await requestSecurityPinVerification(
        firebaseUser,
        verificationEmail || firebaseUser.email || ''
      );

      if (result && (result.success === false || result.ok === false)) {
        throw new Error(
          result.message ||
            result.error ||
            'The verification code could not be resent.'
        );
      }

      setCode('');
      setResendMessage(
        `A new verification code was sent to ${
          verificationEmail || firebaseUser.email || 'your registered email'
        }.`
      );
    } catch (err) {
      console.error('Failed to resend Security PIN verification email:', err);
      setError(
        err?.message ||
          'Failed to resend the verification code. Please check your email configuration and try again.'
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-6">
      <div className="w-full max-w-[430px] overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="relative px-8 pb-5 pt-7 text-center">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 text-[#98A2B3] hover:text-[#344054]"><X size={18} /></button>

          <span className="inline-flex items-center rounded-full bg-[#F1F3F5] px-3.5 py-1.5 text-[10px] font-semibold text-[#475467]">STEP 2 OF 3 <span className="mx-2 text-[#98A2B3]">•</span> SECURITY VERIFICATION</span>

          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#9D0A0E]"><LockKeyhole size={19} /></div>
          <h2 className="mt-4 text-[21px] font-bold tracking-[-0.4px] text-[#1F2937]">Verify Your Email</h2>
          <p className="mx-auto mt-1 max-w-[310px] text-[10px] leading-4 text-[#667085]">We sent a 6-digit verification code to your registered email address.</p>

          {verificationEmail && (
            <span className="mt-3 inline-flex items-center rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[8px] font-semibold tracking-[0.05em] text-[#667085]">
              <Mail size={9} className="mr-1.5" />{verificationEmail}
            </span>
          )}
        </div>

        <div className="space-y-5 px-8 pb-5">
          <div>
            <SettingsExactFieldLabel rightLabel="6 DIGITS">Verification Code</SettingsExactFieldLabel>
            <SettingsPinBoxes value={code} onChange={setCode} ariaLabel="Verification code" autoFocus showToggle={false} boxed={false} />
          </div>

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-3 text-center">
            <p className="text-[9px] text-[#98A2B3]">Didn't receive the code?</p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[9px] text-[#98A2B3]">
              <span>Code expires in 10 minutes</span>
              <span>•</span>
              <button type="button" onClick={handleResend} disabled={isResending} className="font-semibold text-[#9D0A0E] hover:underline disabled:opacity-50">
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>

          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[10px] font-semibold text-[#9D0A0E]">{error}</p>}

          {resendMessage && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-semibold text-emerald-700">
              {resendMessage}
            </p>
          )}
        </div>

        <div className="px-8 pb-3">
          <button type="button" onClick={handleVerify} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#B5090D] text-[11px] font-bold text-white transition hover:bg-[#92070A]">
            Verify Code <ChevronRight size={13} />
          </button>
          <button type="button" onClick={onBack} className="mt-2.5 h-9 w-full rounded-md border border-[#D0D5DD] bg-white text-[10px] font-semibold text-[#344054] hover:bg-[#F8F9FA]">Back</button>
        </div>

        <div className="px-8 pb-5 pt-3 text-center text-[8px] text-[#98A2B3]">
          <LockKeyhole size={9} className="mr-1 inline-block -translate-y-px" />256-bit encrypted hospital administration protocol
        </div>
      </div>
    </div>
  );
}

function SettingsExactPinSuccessModal({
  onClose,
  title = 'Security PIN Set Successfully',
  message = 'Your Security PIN can now be used to authorize protected system actions.',
  configuredByLabel = 'Admin',
}) {
  const configuredAt = new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-[380px] rounded-xl bg-white shadow-2xl">
        <div className="flex flex-col items-center px-8 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#9FE6CE] bg-[#E8FFF7] text-[#07855F]">
            <CheckCircle2 size={28} strokeWidth={2.4} />
          </div>
          <h2 className="mt-4 text-[17px] font-bold text-[#1F2937]">{title}</h2>
          <p className="mt-2 max-w-[280px] text-[10px] leading-4 text-[#667085]">{message}</p>

          <div className="mt-5 w-full rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#07855F]" />
              <div>
                <p className="text-[9px] font-bold leading-3 text-[#1F2937]">Protected Actions Active: Record Resets & High-Level System Overrides</p>
                <p className="mt-0.5 text-[8px] text-[#667085]">Configured on {configuredAt} • {configuredByLabel}</p>
              </div>
            </div>
          </div>

          <button type="button" onClick={onClose} className="mt-4 h-9 w-full rounded-md bg-[#9D0A0E] text-[10px] font-bold text-white hover:bg-[#7D080B]">DONE</button>
          <p className="mt-3 text-[8px] text-[#98A2B3]">ⓘ You can update your PIN anytime in Settings.</p>
        </div>
      </div>
    </div>
  );
}

const CHANGE_PASSWORD_API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CHANGE_PASSWORD_RULES = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (value) => value.length >= 8,
  },
  {
    key: 'upper',
    label: 'Include at least one uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: 'number',
    label: 'Include at least one number',
    test: (value) => /\d/.test(value),
  },
  {
    key: 'special',
    label: 'Include at least one special character',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

function IconButton({ onClick, label, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-5 w-5 items-center justify-center rounded text-[#98A2B3] transition hover:bg-[#F8F9FA] hover:text-[#344054] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ModalShell({ children, onClose, showClose = true, width = '520' }) {
  const widthClass =
    width === '430'
      ? 'max-w-[430px]'
      : width === '380'
        ? 'max-w-[380px]'
        : 'max-w-[520px]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 py-6">
      <div className={`relative w-full ${widthClass} max-h-[calc(100vh-48px)] overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-2xl`}>
        {showClose && (
          <div className="absolute right-5 top-5 z-10">
            <IconButton onClick={onClose} label="Close">
              <X size={20} strokeWidth={1.7} />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function StepLabel({ current, descriptor, compact = false }) {
  return (
    <div className={`flex items-center gap-2 leading-none tracking-[0.04em] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      <span className={`rounded-md bg-[#FBEAEA] font-bold text-[#9D0A0E] ${compact ? 'px-2.5 py-1' : 'px-3.5 py-1.5'}`}>
        STEP {current} OF 3
      </span>
      <span className="font-medium uppercase text-[#667085]">
        • {descriptor}
      </span>
    </div>
  );
}

function HeaderIcon({ tone = 'red', icon: Icon = ShieldCheck, size = 64 }) {
  const green = tone === 'green';
  const iconSize = Math.round(size * 0.42);
  const radius = size >= 60 ? 'rounded-2xl' : 'rounded-xl';

  return (
    <div
      className={`mx-auto flex shrink-0 items-center justify-center ${radius} ${
        green ? 'bg-[#E9FBF2] text-[#138A5B]' : 'bg-[#FFF5F5] text-[#B5090D]'
      }`}
      style={{ width: size, height: size }}
    >
      <Icon size={iconSize} strokeWidth={2.1} />
    </div>
  );
}

function ProtocolFooter() {
  return (
    <div className="flex items-center justify-center gap-1.5 border-t border-[#F0F0F0] px-8 pb-5 pt-3 text-center text-[8px] uppercase tracking-[0.09em] text-[#A4A9B2]">
      <Lock size={9} />
      256-BIT ENCRYPTED HOSPITAL ADMINISTRATION PROTOCOL
    </div>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-[10px] leading-4 text-[#9D0A0E]">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[#B5090D] px-4 text-[15px] font-semibold text-white transition hover:bg-[#92070A] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 h-[50px] w-full rounded-md border border-[#D0D5DD] bg-white px-4 text-[15px] font-medium text-[#344054] transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function PasswordField({ id, label, value, onChange, disabled, autoFocus }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-semibold text-[#1F2937]"
      >
        {label} <span className="text-[#B5090D]">*</span>
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          autoFocus={autoFocus}
          disabled={disabled}
          className="h-10 w-full rounded-md border border-[#D0D5DD] bg-white px-3 pr-10 text-[12px] text-[#1F2937] outline-none transition placeholder:text-[#98A2B3] focus:border-[#B5090D] focus:ring-2 focus:ring-[#B5090D]/10 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShow((previous) => !previous)}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-[#667085] hover:text-[#344054] disabled:opacity-40"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function PasswordRules({ results }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5">
      <p className="mb-2 text-[10px] font-bold text-[#1F2937]">
        Password requirements:
      </p>
      <ul className="space-y-1.5">
        {results.map((rule) => (
          <li
            key={rule.key}
            className={`flex items-center gap-2 text-[10px] leading-4 ${
              rule.ok ? 'text-[#18824B]' : 'text-[#667085]'
            }`}
          >
            {rule.ok ? (
              <CheckCircle2 size={12} className="shrink-0 text-[#13A565]" />
            ) : (
              <Circle size={12} className="shrink-0 text-[#A4A9B2]" />
            )}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PasswordVerificationBoxes({ code, setCode, disabled }) {
  const refs = useRef([]);

  function handleChange(index, rawValue) {
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) {
      setCode((current) => {
        const next = [...current];
        next[index] = '';
        return next;
      });
      return;
    }

    const current = [...code];
    digits
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        current[index + offset] = digit;
      });

    setCode(current);
    refs.current[Math.min(5, index + digits.length)]?.focus();
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      event.preventDefault();
      setCode((current) => {
        const next = [...current];
        next[index - 1] = '';
        return next;
      });
      refs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((digit, index) => {
      next[index] = digit;
    });
    setCode(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div
      className="flex justify-center gap-1.5"
      onPaste={handlePaste}
    >
      {code.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          autoFocus={index === 0}
          disabled={disabled}
          aria-label={`Verification digit ${index + 1}`}
          className="h-[31px] w-[26px] rounded-[3px] border border-[#D0D5DD] bg-white text-center text-[11px] font-bold text-[#1F2937] outline-none focus:border-[#B5090D] focus:ring-1 focus:ring-[#B5090D]/15 disabled:opacity-60"
        />
      ))}
    </div>
  );
}

function ChangePasswordModal({ onSuccess, onClose }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [completedAt, setCompletedAt] = useState(null);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const results = useMemo(
    () =>
      CHANGE_PASSWORD_RULES.map((rule) => ({
        ...rule,
        ok: rule.test(password),
      })),
    [password]
  );

  const allRulesMet = results.every((rule) => rule.ok);
  const verificationCode = code;
  const countdownLabel = `00:${String(resendCountdown).padStart(2, '0')}`;

  function close() {
    if (sending || verifying || resending || saving) return;
    (onClose || onSuccess)?.();
  }

  function handleCodeChange(next) {
    setCode(typeof next === 'function' ? next(code) : next);
    setError('');
  }

  async function sendVerificationCode() {
    setError('');

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email is required.');
      return;
    }

    setSending(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/send-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to send verification code.');
      }

      setEmail(trimmed);
      setCode('');
      setResendCountdown(60);
      setStep('code');
    } catch (sendError) {
      setError(
        sendError?.message ||
          'Unable to send verification code. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setError('');

    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/verify-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: verificationCode }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Invalid verification code.');
      }

      if (!result.resetToken) {
        throw new Error('Verification succeeded but no reset token was returned.');
      }

      setResetToken(result.resetToken);
      setPassword('');
      setConfirm('');
      setStep('password');
    } catch (verifyError) {
      setError(
        verifyError?.message ||
          'The verification code is invalid or has expired.'
      );
    } finally {
      setVerifying(false);
    }
  }

  async function resendCode() {
    if (resendCountdown > 0 || resending) return;

    setError('');
    setResending(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/send-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to resend verification code.');
      }

      setCode('');
      setResendCountdown(60);
    } catch (resendError) {
      setError(
        resendError?.message ||
          'Unable to resend the verification code.'
      );
    } finally {
      setResending(false);
    }
  }

  async function savePassword() {
    setError('');

    if (!resetToken || !email) {
      setError(
        'Your password reset session is missing or has expired. Please request a new verification code.'
      );
      return;
    }

    if (!allRulesMet) {
      setError('Your password does not meet all the requirements.');
      return;
    }

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resetToken,
            email,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to update your password.');
      }

      setCompletedAt(new Date());
      setStep('success');
    } catch (resetError) {
      setError(
        resetError?.message ||
          'Unable to update your password. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function renderEmailStep() {
    return (
      <ModalShell onClose={close} width="520">
        <div className="relative px-8 pb-7 pt-8 text-center">
          <StepLabel current="1" descriptor="IDENTITY VERIFICATION" />

          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5F5] text-[#9D0A0E]">
            <ShieldCheck size={27} strokeWidth={2.2} />
          </div>

          <h2 className="mt-5 text-[27px] font-bold tracking-[-0.6px] text-[#1F2937]">
            Change Password
          </h2>
          <p className="mx-auto mt-3 max-w-[390px] text-[14px] leading-6 text-[#475467]">
            For your security, we&apos;ll send a verification code to your registered email address.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendVerificationCode();
          }}
          className="space-y-5 px-8 pb-8"
        >
          <div>
            <label
              htmlFor="change-password-email"
              className="mb-2 block text-[13px] font-semibold text-[#1F2937]"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#344054]"
              />
              <input
                id="change-password-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !sending) sendVerificationCode();
                }}
                placeholder="Enter email"
                autoFocus
                disabled={sending}
                className="h-12 w-full rounded-md border border-[#D0D5DD] bg-white pl-11 pr-3 text-[15px] text-[#1F2937] outline-none transition placeholder:text-[#667085] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-[#CFE2FF] bg-[#F3F8FF] px-4 py-4">
            <Info size={14} className="mt-0.5 shrink-0 text-[#344054]" />
            <p className="text-[9px] leading-4 text-[#475467]">
              Authorized admin verification code remains valid for 10 minutes. Check spam folder if not received.
            </p>
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send Verification Code'}
            {!sending && <ChevronRight size={18} />}
          </PrimaryButton>

          <SecondaryButton onClick={close} disabled={sending}>
            Cancel
          </SecondaryButton>
        </form>

        <ProtocolFooter />
      </ModalShell>
    );
  }

  function renderCodeStep() {
    return (
      <ModalShell onClose={close} width="430">
        <div className="relative px-8 pb-5 pt-7 text-center">
          <StepLabel current="2" descriptor="SECURITY VERIFICATION" />

          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#9D0A0E]">
            <LockKeyhole size={19} />
          </div>

          <h2 className="mt-4 text-[21px] font-bold tracking-[-0.4px] text-[#1F2937]">
            Verify Your Email
          </h2>
          <p className="mx-auto mt-1 max-w-[310px] text-[10px] leading-4 text-[#667085]">
            We sent a 6-digit verification code to your registered email address.
          </p>

          {email && (
            <span className="mt-3 inline-flex items-center rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[8px] font-semibold tracking-[0.05em] text-[#667085]">
              <Mail size={9} className="mr-1.5" />
              {email}
            </span>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            verifyCode();
          }}
          className="space-y-5 px-8 pb-6"
        >
          <div>
            <SettingsExactFieldLabel rightLabel="6 DIGITS">
              Verification Code
            </SettingsExactFieldLabel>
            <SettingsPinBoxes
              value={verificationCode}
              onChange={handleCodeChange}
              ariaLabel="Verification code"
              autoFocus
              showToggle={false}
              boxed={false}
            />
          </div>

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-3 text-center">
            <p className="text-[9px] text-[#98A2B3]">Didn&apos;t receive the code?</p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[9px] text-[#98A2B3]">
              <span>Resend code {countdownLabel}</span>
              <span>•</span>
              <button
                type="button"
                onClick={resendCode}
                disabled={resendCountdown > 0 || resending || verifying}
                className="font-semibold text-[#9D0A0E] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton
            type="submit"
            disabled={verifying || verificationCode.length !== 6}
          >
            {verifying ? 'Verifying...' : 'Verify Code'}
            {!verifying && <ChevronRight size={18} />}
          </PrimaryButton>

          <SecondaryButton onClick={close} disabled={verifying}>
            Cancel
          </SecondaryButton>
        </form>

        <ProtocolFooter />
      </ModalShell>
    );
  }

  function renderPasswordStep() {
    return (
      <ModalShell onClose={close} width="520">
        <div className="relative px-8 pb-5 pt-7">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#FBF1F1] px-2.5 py-1 text-[10px] font-bold text-[#9D0A0E]">
              STEP 3 OF 3
            </span>
            <span className="text-[10px] font-medium text-[#667085]">
              Security Protocol
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#9D0A0E]">
              <ShieldCheck size={19} />
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
                ADMIN CREDENTIALS
              </div>
              <h2 className="mt-1 text-[21px] font-bold tracking-[-0.4px] text-[#1F2937]">
                Create New Password
              </h2>
              <p className="mt-1 max-w-[390px] text-[10px] leading-4.5 text-[#667085]">
                Create a new password for your SWU Med account. Ensure it complies with hospital clinical admin access safeguards.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            savePassword();
          }}
          className="space-y-5 px-8 pb-6"
        >
          <PasswordField
            id="change-password-new"
            label="New Password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setError('');
            }}
            disabled={saving}
            autoFocus
          />

          <PasswordField
            id="change-password-confirm"
            label="Confirm New Password"
            value={confirm}
            onChange={(value) => {
              setConfirm(value);
              setError('');
            }}
            disabled={saving}
          />

          <PasswordRules results={results} />

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <LockKeyhole size={12} className="mt-0.5 shrink-0 text-[#667085]" />
              <span className="text-[9px] leading-4 text-[#667085]">
                Keep your password private. Do not share it with other users.
              </span>
            </div>
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton
            type="submit"
            disabled={saving || !allRulesMet || !confirm}
          >
            {saving ? 'Saving...' : 'Change Password'}
            {!saving && <ChevronRight size={18} />}
          </PrimaryButton>

          <SecondaryButton onClick={close} disabled={saving}>
            Cancel
          </SecondaryButton>
        </form>

        <ProtocolFooter />
      </ModalShell>
    );
  }

  function renderSuccessStep() {
    const updated = completedAt
      ? completedAt.toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    return (
      <ModalShell onClose={() => onSuccess?.()} showClose={false} width="380">
        <div className="flex flex-col items-center px-7 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#9FE6CE] bg-[#E8FFF7] text-[#07855F]">
            <CheckCircle2 size={25} strokeWidth={2.4} />
          </div>
          <h2 className="mt-4 text-[17px] font-bold text-[#1F2937]">
            Password Changed Successfully
          </h2>
          <p className="mt-2 max-w-[280px] text-[10px] leading-4 text-[#667085]">
            Your password has been updated successfully.
          </p>

          <div className="mt-5 w-full rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#07855F]" />
              <div>
                <p className="text-[9px] font-bold leading-3 text-[#1F2937]">
                  Updated on {updated}
                </p>
                <p className="mt-0.5 text-[8px] text-[#667085]">
                  All active clinic session tokens refreshed automatically.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSuccess?.()}
            className="mt-4 h-9 w-full rounded-md bg-[#9D0A0E] text-[10px] font-bold text-white hover:bg-[#7D080B]"
          >
            DONE
          </button>
          <p className="mt-3 text-[8px] text-[#98A2B3]">
            Password updated successfully. You can continue using the admin system.
          </p>
        </div>
      </ModalShell>
    );
  }

  if (step === 'code') return renderCodeStep();
  if (step === 'password') return renderPasswordStep();
  if (step === 'success') return renderSuccessStep();

  return renderEmailStep();
}

function SettingsExactPage() {
  const { user } = useAuth();
  const [systemName, setSystemName] = useState('SWUMed Queuing System');
  const [accentColor, setAccentColor] = useState(loadStoredAccent());
  const [themeMode, setThemeMode] = useState(loadStoredTheme());
  const [language, setLanguage] = useState('English');
  const [clockFormat, setClockFormat] = useState(SETTINGS_CLOCK_FORMATS[0]);
  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinStatusLoading, setPinStatusLoading] = useState(true);
  const [pendingPin, setPendingPin] = useState('');
  const [pendingPinEmail, setPendingPinEmail] = useState('');
  const [pendingVerificationCode, setPendingVerificationCode] = useState('');
  const [pinSaveLoading, setPinSaveLoading] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    applyAccent(accentColor);
  }, [accentColor]);

  useEffect(() => {
    let isMounted = true;
    async function loadSecurityPinStatus() {
      try {
        setPinStatusLoading(true);
        setPinError('');
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error('Your authentication session is unavailable.');
        const result = await getSecurityPinStatus(firebaseUser);
        if (isMounted) setPinConfigured(Boolean(result?.configured));
      } catch (error) {
        console.error('Failed to load Security PIN status:', error);
        if (isMounted) setPinError(error?.message || 'Failed to load Security PIN status.');
      } finally {
        if (isMounted) setPinStatusLoading(false);
      }
    }
    loadSecurityPinStatus();
    return () => { isMounted = false; };
  }, []);

  function handleCopyName() {
    navigator.clipboard?.writeText(systemName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => setCopied(false));
  }

  function applyThemeSelection(mode) {
    setThemeMode(mode);
    applyTheme(mode);
  }

  function applyAccentSelection(color) {
    setAccentColor(color);
    applyAccent(color);
  }

  return (
    <div className="space-y-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-[#1F2937]">Settings</h1>
        <p className="mt-0.5 text-xs text-[#4B5563]">Manage system preferences, security, appearance, and localization.</p>
      </div>

      <SettingsExactSection icon={Palette} title="Branding & Identity" subtitle="Customize your brand presence across patient kiosks, queue trackers, and staff monitors." badge="White-label">
        <div>
          <SettingsExactFieldLabel>System Name</SettingsExactFieldLabel>
          <div className="relative max-w-[520px]">
            <input value={systemName} onChange={(event) => setSystemName(event.target.value)} className="h-10 w-full rounded-md border border-[#D0D5DD] bg-white px-3 pr-9 text-[10px] text-[#344054] outline-none focus:border-[#9D0A0E] focus:ring-1 focus:ring-[#9D0A0E]/10" />
            <button type="button" onClick={handleCopyName} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]" aria-label="Copy system name">{copied ? <Check size={12} className="text-emerald-600" /> : <span className="text-[10px]">▣</span>}</button>
          </div>
          <SettingsExactHint>Displayed on browser titles, kiosk welcome screens, and physical thermal ticket headers.</SettingsExactHint>
        </div>

        <div className="mt-4">
          <SettingsExactFieldLabel>System Logo</SettingsExactFieldLabel>
          <div className="flex max-w-[620px] flex-wrap items-center justify-between gap-4 rounded-md border border-[#E5E7EB] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-[100px] items-center justify-center rounded border border-[#E5E7EB] bg-white">
                <img src={Logo} alt="Current brand logo" className="h-8 w-auto object-contain" />
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[9px] font-semibold text-[#1F2937]">Current Brand Logo <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[7px] font-bold text-emerald-800">Active</span></p>
                <p className="mt-0.5 text-[8px] text-[#98A2B3]">PNG or SVG, max 2MB</p>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[8px] font-semibold text-[#344054] hover:bg-[#F8F9FA]">
              <Upload size={11} />Upload New Logo<input type="file" accept="image/png,image/svg+xml" className="hidden" />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <SettingsExactFieldLabel>Primary Accent Color</SettingsExactFieldLabel>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 items-center gap-1.5 rounded-md border border-[#E5E7EB] px-3">
              <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ backgroundColor: accentColor }} />
              <span className="text-[10px] font-semibold uppercase text-[#344054]">Hex {accentColor.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-[#E5E7EB] pl-3">
              <span className="text-[10px] text-[#667085]">Presets:</span>
              {SETTINGS_ACCENT_PRESETS.map((preset) => (
                <button key={preset} type="button" onClick={() => applyAccentSelection(preset)} aria-label={`Accent ${preset}`} className={`flex h-5 w-5 items-center justify-center rounded-full ${accentColor.toUpperCase() === preset.toUpperCase() ? 'ring-2 ring-[#9D0A0E] ring-offset-1' : 'ring-1 ring-black/10'}`} style={{ backgroundColor: preset }}>
                  {accentColor.toUpperCase() === preset.toUpperCase() && <Check size={9} strokeWidth={3} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
          <SettingsExactHint>Applies to primary action buttons, active navigation markers, ticket highlighted badges, and key queue alerts.</SettingsExactHint>
        </div>
      </SettingsExactSection>

      <SettingsExactSection icon={ShieldCheck} title="Password & Security" subtitle="Manage your account password and Admin PIN.">
        <div className="divide-y divide-[#E5E7EB]">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
            <div>
              <p className="text-sm font-bold text-[#1F2937]">Password</p>
              <p className="mt-0.5 text-[10px] text-[#667085]">Keep your account secure by regularly updating your password.</p>
              <p className="mt-0.5 text-[8px] text-[#98A2B3]">Last changed: Not available</p>
            </div>
            <button type="button" onClick={() => setActiveModal('changePassword')} className="flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3.5 py-2 text-[10px] font-semibold text-[#344054] hover:bg-[#F8F9FA]"><KeyRound size={11} />Change Password</button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div>
              <p className="text-sm font-bold text-[#1F2937]">Security PIN</p>
              <p className="mt-0.5 max-w-[600px] text-[9px] text-[#667085]">Used to authorize protected system actions such as resetting records.</p>
              {pinConfigured && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#E9F9EF] px-2 py-0.5 text-[8px] font-semibold text-[#18824B]"><Check size={9} />PIN is set</span>}
              {pinError && <p className="mt-1 text-[10px] font-medium text-[#9D0A0E]">{pinError}</p>}
            </div>
            <button type="button" disabled={pinStatusLoading} onClick={() => setActiveModal('pinEmail')} className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2.5 text-[10px] font-bold text-white hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"><LockKeyhole size={11} />{pinStatusLoading ? 'Loading...' : pinConfigured ? 'Change PIN' : 'Set PIN'}</button>
          </div>
        </div>
      </SettingsExactSection>

      <SettingsExactSection icon={Monitor} title="Appearance" subtitle="Choose default theme settings for admin and kiosk interfaces.">
        <SettingsExactFieldLabel>Theme Mode</SettingsExactFieldLabel>
        <div className="grid max-w-[760px] gap-3 sm:grid-cols-3">
          {SETTINGS_THEME_MODES.map(({ key, label, caption, icon: Icon }) => {
            const selected = themeMode === key;
            return (
              <button key={key} type="button" onClick={() => applyThemeSelection(key)} aria-pressed={selected} className={`rounded-lg border p-4 text-left transition ${selected ? 'border-[#9D0A0E] ring-1 ring-[#9D0A0E]' : 'border-[#E5E7EB] hover:border-[#98A2B3]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Icon size={11} className="mt-0.5 text-[#9D0A0E]" />
                    <div><p className="text-xs font-bold text-[#1F2937]">{label}</p><p className="mt-0.5 text-[9px] text-[#98A2B3]">{caption}</p></div>
                  </div>
                  <span className={`flex h-3 w-3 items-center justify-center rounded-full border ${selected ? 'border-[#9D0A0E]' : 'border-[#D0D5DD]'}`}>{selected && <span className="h-1.5 w-1.5 rounded-full bg-[#9D0A0E]" />}</span>
                </div>
                <div className={`mt-2 rounded-md border border-[#E5E7EB] p-2 ${key === 'dark' ? 'bg-[#1F2937]' : key === 'system' ? 'bg-gradient-to-r from-white to-[#1F2937]' : 'bg-white'}`}>
                  <span className={`block h-1.5 w-10 rounded-sm ${key === 'dark' ? 'bg-white/70' : 'bg-[#4B5563]'}`} />
                  <div className="mt-1.5 flex items-center gap-1"><span className="h-2 w-6 rounded-sm" style={{ backgroundColor: accentColor }} /><span className={`h-2 flex-1 rounded-sm ${key === 'dark' ? 'bg-white/20' : 'bg-[#E5E7EB]'}`} /></div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsExactSection>

      <SettingsExactSection icon={Globe} title="Language & Regional Settings" subtitle="Configure default language and regional time displays across touchpoints.">
        <SettingsExactFieldLabel>Primary Language</SettingsExactFieldLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          {SETTINGS_LANGUAGES.map((lang) => {
            const selected = language === lang;
            return <button key={lang} type="button" onClick={() => setLanguage(lang)} className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold ${selected ? 'bg-[#B34C4C] text-white' : 'border border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F8F9FA]'}`}>{selected && <Check size={9} />}{lang}</button>;
          })}
        </div>
        <SettingsExactHint>Sets the initial default locale for patient kiosk prompts and printed slips.</SettingsExactHint>
        <div className="mt-5 border-t border-[#E5E7EB] pt-5">
          <SettingsExactFieldLabel>Clock Format</SettingsExactFieldLabel>
          <select value={clockFormat} onChange={(event) => setClockFormat(event.target.value)} className="h-10 w-full max-w-[240px] rounded-md border border-[#D0D5DD] bg-white px-3 text-[10px] text-[#344054] outline-none focus:border-[#9D0A0E]"><option>{SETTINGS_CLOCK_FORMATS[0]}</option><option>{SETTINGS_CLOCK_FORMATS[1]}</option></select>
          <SettingsExactHint>Applied to TV Queue displays, timestamp audits, and ticket issuance times.</SettingsExactHint>
        </div>
      </SettingsExactSection>

      {activeModal === 'changePassword' && (
        <ChangePasswordModal
          onSuccess={() => setActiveModal(null)}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'pinEmail' && <SettingsExactPinEmailModal initialEmail={pendingPinEmail} onClose={() => { setPendingPin(''); setPendingPinEmail(''); setPendingVerificationCode(''); setPinError(''); setActiveModal(null); }} onContinue={(email) => { setPinError(''); setPendingPinEmail(email); setPendingVerificationCode(''); setActiveModal('verifyPin'); }} />}
      {activeModal === 'verifyPin' && <SettingsExactPinVerificationModal firebaseUser={auth.currentUser} verificationEmail={pendingPinEmail} onClose={() => { setPendingPin(''); setPendingPinEmail(''); setPendingVerificationCode(''); setPinError(''); setActiveModal(null); }} onBack={() => setActiveModal('pinEmail')} onSuccess={(code) => { setPinError(''); setPendingVerificationCode(code); setActiveModal('createPin'); }} />}
      {activeModal === 'createPin' && <SettingsExactCreatePinModal verificationCode={pendingVerificationCode} serverError={pinError} saving={pinSaveLoading} onClose={() => { setPendingPin(''); setActiveModal('verifyPin'); }} onContinue={async (pin) => {
        try {
          setPinError('');
          setPinSaveLoading(true);
          const firebaseUser = auth.currentUser;

          if (!firebaseUser) {
            throw new Error('Your authentication session is unavailable. Please log in again.');
          }

          await verifySecurityPinCode(firebaseUser, pendingVerificationCode, pin);
          setPendingPin('');
          setPinConfigured(true);
          setActiveModal('pinSuccess');
        } catch (error) {
          console.error('Failed to verify Security PIN:', error);
          setPinError(error?.message || 'Failed to verify the code and set your Security PIN.');
        } finally {
          setPinSaveLoading(false);
        }
      }} initialValue={pendingPin} />}
      {activeModal === 'pinSuccess' && <SettingsExactPinSuccessModal onClose={() => { setPendingPin(''); setPendingPinEmail(''); setPendingVerificationCode(''); setPinError(''); setActiveModal(null); }} />}
    </div>
  );
}

export { SettingsExactPage as SettingsPage };
export { SettingsExactCreatePinModal, SettingsExactPinSuccessModal };
