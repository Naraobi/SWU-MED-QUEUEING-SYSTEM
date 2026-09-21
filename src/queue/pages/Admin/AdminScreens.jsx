import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  EyeOff,
  IdCard,
  Info,
  Lightbulb,
  LockKeyhole,
  Mail,
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
  Upload,
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
  getSecurityPinStatus,
  requestSecurityPinVerification,
  verifySecurityPinCode,
  validateSecurityPin,
  requestPasswordChangeCode,
  verifyPasswordChangeCode,
  finalizePasswordChange,
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
  loadStoredClockFormat,
  saveStoredClockFormat,
} from './adminHelpers';

import { useLanguage } from './LanguageContext';

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

export function QueueManagementPage() {
  const {
    waitingQueue,
    currentlyServing,
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
  const [departmentStaffById, setDepartmentStaffById] = useState({});
  const [staffLabel, setStaffLabel] = useState('--');

  async function loadTerminalStats() {
    setTerminalLoading(true);

    try {
      const [terminalData, departmentData, staffData] = await Promise.all([
        getTerminals(),
        getDepartments(),
        getUsers(),
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

      // A terminal's assigned_staff_id can point at someone who has since
      // transferred to another department - scoping the lookup to this
      // department's staff keeps stale assignments from resolving to the
      // wrong person.
      const departmentStaff = department
        ? (staffData || []).filter(
            (person) =>
              normalizeRole(getRoleName(person)) === 'staff' &&
              String(person.department_id) === String(department.department_id)
          )
        : [];

      const staffMap = {};
      departmentStaff.forEach((person) => {
        staffMap[String(person.user_id)] = person;
      });
      setDepartmentStaffById(staffMap);

      const activeStaff = departmentStaff.filter(
        (person) => normalizeRole(person.status) === 'active'
      ).length;

      setStaffLabel(`${activeStaff}/${departmentStaff.length}`);
    } catch (err) {
      console.error('Failed to load terminal stats:', err);
      setTerminalLabel('--');
      setDepartmentTerminals([]);
      setDepartmentStaffById({});
      setStaffLabel('--');
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

  const current = currentlyServing || null;

  // Only one ticket can be actively served per department at a time
  // today, so "switching terminals" means: show that one ticket only
  // when it was actually called from the selected terminal, and show
  // an idle state for every other terminal.
  const displayedCurrent =
    selectedTerminalId === 'all' || !current
      ? current
      : String(current.counterId) === String(selectedTerminalId)
        ? current
        : null;

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">{t('queue.title')}</h1>
          <p className="mt-1 text-xs text-[#4B5563]">{t('queue.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onApply={applyDateRange} />

          <button
            type="button"
            onClick={handleApplyFilter}
            disabled={refreshing}
            className="flex h-9 items-center gap-2 rounded-md bg-[#9D0A0E] px-4 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing && <RefreshCw size={12} className="animate-spin" />}
            {refreshing ? t('common.applying') : t('common.applyFilter')}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={refreshing}
            className="flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-4 text-xs font-semibold text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard label={t('common.stat.totalWaiting')} value={loading ? '…' : String(totalWaiting)} caption={t('common.stat.forThisDepartment')} icon={Users} />
        <StatCard label={t('common.stat.averageWait')} value="18m" caption={t('common.stat.noColumnYet')} icon={Timer} />
        <StatCard label={t('common.stat.skipped')} value={loading ? '…' : String(stats?.skipped || 0)} caption={t('common.stat.totalSkipped')} icon={Undo2} />
        <StatCard label={t('common.stat.completed')} value={loading ? '…' : String(stats?.completed || 0)} caption={t('common.stat.completedQueuing')} icon={CheckCircle2} />
        <StatCard label={t('common.stat.staff')} value={terminalLoading ? '…' : staffLabel} caption={t('common.stat.activeStaffTotal')} icon={IdCard} />
        <StatCard label={t('common.stat.terminal')} value={terminalLoading ? '…' : terminalLabel} caption={t('common.stat.activeTerminals')} icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937]">
              {selectedTerminalId === 'all' ? t('queue.currentStatus') : t('queue.nowServing')}
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedTerminalId}
                onChange={(event) => setSelectedTerminalId(event.target.value)}
                className="h-7 rounded-md border border-[#E5E7EB] bg-white px-2 text-[10px] font-semibold text-[#4B5563] outline-none focus:border-[#9D0A0E]"
              >
                <option value="all">All Terminals</option>
                {departmentTerminals.map((terminal) => (
                  <option key={terminal.counter_id} value={terminal.counter_id}>
                    {terminal.prefix || `Terminal ${terminal.counter_number}`}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-semibold text-slate-400">{t('common.today')}</span>
            </div>
          </div>

          {selectedTerminalId === 'all' && departmentTerminals.length > 0 ? (
            <div className="grid flex-1 grid-cols-1 gap-3 content-start sm:grid-cols-2">
              {departmentTerminals.map((terminal) => {
                const isServingHere =
                  current && String(current.counterId) === String(terminal.counter_id);

                const isActive = normalizeRole(terminal.status) === 'active';

                const assignedStaff =
                  departmentStaffById[String(terminal.assigned_staff_id)];

                const staffName = assignedStaff
                  ? `${assignedStaff.first_name || ''} ${assignedStaff.last_name || ''}`.trim()
                  : null;

                return (
                  <div
                    key={terminal.counter_id}
                    className="rounded-lg border border-[#E5E7EB] bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1F2937]">
                        {terminal.prefix || `Terminal ${terminal.counter_number}`}
                      </span>

                      {isServingHere && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            current.isPriority
                              ? 'bg-[#FEE2E2] text-[#9D0A0E]'
                              : 'bg-[#F1F3F5] text-[#4B5563]'
                          }`}
                        >
                          {current.isPriority ? 'Priority' : 'Regular'}
                        </span>
                      )}
                    </div>

                    {isServingHere ? (
                      <>
                        <p className="mt-2 text-xl font-extrabold text-[#9D0A0E]">{current.id}</p>
                        <p className="mt-1 truncate text-[10px] text-[#6B7280]">
                          {staffName || t('common.unassigned')}
                          {current.secondsElapsed
                            ? t('queue.servingFor', { minutes: Math.floor(current.secondsElapsed / 60) })
                            : ''}
                        </p>
                        <span className="mt-1 inline-block text-[9px] font-semibold text-emerald-600">
                          Serving
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-xl font-extrabold text-slate-300">--</p>
                        <span className="mt-1 inline-block text-[9px] font-semibold text-slate-400">
                          {isActive ? 'Not serving' : 'Counter Closed'}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg bg-[#F1F3F5] px-8 py-10 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('queue.nowServing')}</p>
              <p className="mt-3 text-5xl font-extrabold text-[#9D0A0E]">{loading ? '…' : displayedCurrent?.id || '--'}</p>
              <p className="mt-2 text-xs text-[#4B5563]">
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

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1F2937]">{t('queue.waitingQueue')}</h2>
            <span className="rounded-full bg-[#9D0A0E]/10 px-2.5 py-1 text-[10px] font-bold text-[#9D0A0E]">{t('queue.inLine', { count: waitingQueue.length })}</span>
          </div>

          <div className="space-y-2">
            {loading && <p className="py-4 text-center text-xs text-slate-400">{t('dashboard.loadingQueue')}</p>}

            {!loading &&
              waitingQueue.slice(0, 5).map((row, index) => (
                <div key={row.uniqueKey || `${row.id}-${index}`} className="flex items-center justify-between rounded-md border border-[#E5E7EB] px-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs font-bold text-[#1F2937]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1F3F5] text-[10px] text-slate-500">{index + 1}</span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${
                        row.isPriority ? 'bg-[#FEE2E2] text-[#9D0A0E]' : 'bg-[#F1F3F5] text-[#1F2937]'
                      }`}
                    >
                      {row.id}
                    </span>
                  </span>
                  <span className="text-[10px] text-[#4B5563]">{t('queue.waitingMinutes', { minutes: row.etaMinutes ?? '~0' })}</span>
                </div>
              ))}

            {!loading && waitingQueue.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">{t('dashboard.queueEmpty')}</p>
            )}
          </div>

          {waitingQueue.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQueuePage(1);
                setShowFullQueue(true);
              }}
              className="mt-3 w-full text-center text-xs font-semibold text-[#9D0A0E] hover:underline"
            >
              {t('queue.viewFullQueue')}
            </button>
          )}
        </section>
      </div>

      {showFullQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <h2 className="text-lg font-bold text-[#1F2937]">{t('queue.waitingQueue')}</h2>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#9D0A0E]/10 px-2.5 py-1 text-[10px] font-bold text-[#9D0A0E]">{t('queue.inLine', { count: waitingQueue.length })}</span>
                <button type="button" onClick={() => setShowFullQueue(false)} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {pagedQueue.map((row, index) => (
                <div key={row.uniqueKey || `${row.id}-${index}`} className="flex items-center justify-between px-5 py-3">
                  <span className="flex items-center gap-3 text-sm font-bold text-[#1F2937]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F3F5] text-[11px] text-slate-500">{(queuePage - 1) * QUEUE_PAGE_SIZE + index + 1}</span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${
                        row.isPriority ? 'bg-[#FEE2E2] text-[#9D0A0E]' : 'bg-[#F1F3F5] text-[#1F2937]'
                      }`}
                    >
                      {row.id}
                    </span>
                  </span>
                  <span className="text-xs text-[#4B5563]">{t('queue.waitingMinutes', { minutes: row.etaMinutes ?? '~0' })}</span>
                </div>
              ))}

              {waitingQueue.length === 0 && (
                <p className="px-5 py-8 text-center text-xs text-slate-400">{t('dashboard.queueEmpty')}</p>
              )}
            </div>

            {waitingQueue.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3 text-xs text-slate-500">
                <span>{t('queue.showingQueue', { from: (queuePage - 1) * QUEUE_PAGE_SIZE + 1, to: Math.min(queuePage * QUEUE_PAGE_SIZE, waitingQueue.length), total: waitingQueue.length })}</span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                    disabled={queuePage === 1}
                    className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {t('common.prev')}
                  </button>

                  {Array.from({ length: queueTotalPages }, (_, i) => i + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setQueuePage(number)}
                      className={`rounded-md border px-3 py-1.5 font-semibold ${
                        number === queuePage ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white' : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
                    disabled={queuePage === queueTotalPages}
                    className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
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
          <h1 className="text-2xl font-bold text-[#1F2937]">{t('terminal.title')}</h1>
          <p className="mt-0.5 text-xs text-[#4B5563]">{t('terminal.subtitle')}</p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          disabled={!adminDepartment || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('common.stat.total')} value={loading ? '…' : String(stats.total)} caption={t('common.stat.totalTerminals')} icon={Monitor} />
        <StatCard label={t('common.stat.active')} value={loading ? '…' : String(stats.active)} caption={t('common.stat.activeTerminals')} icon={CheckCircle2} />
        <StatCard label={t('common.stat.inactive')} value={loading ? '…' : String(stats.inactive)} caption={t('common.stat.inactiveTerminal')} icon={XCircle} />
        <StatCard label={t('common.stat.completed')} value={loading ? '…' : String(stats.completed)} caption={t('common.stat.completedQueuing')} icon={ClipboardCheck} />
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1F2937]">{t('terminal.tableTitle')}</h2>

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
              <tr className="bg-[#9D0A0E]/5 text-xs font-bold uppercase tracking-wide text-slate-600">
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
                      className="cursor-pointer border-t border-[#E5E7EB] hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 font-semibold text-slate-700">{terminal.prefix || `T-${terminal.counter_number}`}</td>
                      <td className="px-5 py-3 text-slate-700">{assigned ? `${assigned.first_name} ${assigned.last_name}` : t('common.unassigned')}</td>
                      <td className="px-5 py-3 text-slate-600">{adminKiosk?.name || '--'}</td>
                      <td className="px-5 py-3 text-slate-600">{assigned ? t('common.stat.staff') : '--'}</td>
                      <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
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

        <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3 text-xs text-slate-500">
          <span>{t('terminal.showing', { count: filteredTerminals.length, total: departmentTerminals.length })}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
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
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
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
              <label className="block text-xs font-semibold text-slate-600">
                {t('terminal.terminalName')} <span className="text-[#9D0A0E]">*</span>

                <input
                  type="number"
                  min={1}
                  value={form.counter_number}
                  onChange={(e) => setForm((f) => ({ ...f, counter_number: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-[#9D0A0E]"
                />
              </label>

              {/* TERMINAL CODE / ID */}
              <label className="block text-xs font-semibold text-slate-600">
                <span className="flex items-center justify-between">
                  <span>{t('terminal.terminalCode')} <span className="text-[#9D0A0E]">*</span></span>
                  <span className="text-[10px] font-medium text-slate-400">{t('terminal.autoGenerated')}</span>
                </span>

                <input
                  value={`${adminDepartment?.prefix || 'T'}-${form.counter_number || ''}`}
                  disabled
                  className="mt-1 w-full rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-2 text-xs text-slate-500 outline-none"
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
              <button type="button" onClick={closeModal} disabled={saving} className="rounded-md border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={saveTerminal} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:opacity-50">
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
            <header className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
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
          <h1 className="text-2xl font-bold text-[#1F2937]">{t('reports.title')}</h1>
          <p className="mt-1 text-xs text-[#4B5563]">{t('reports.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onApply={applyDateRange} />

          <button
            type="button"
            onClick={() => applyDateRange(dateRange)}
            disabled={refreshing}
            className="flex h-9 items-center gap-2 rounded-md bg-[#9D0A0E] px-4 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing && <RefreshCw size={12} className="animate-spin" />}
            {refreshing ? t('common.applying') : t('common.applyFilter')}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={refreshing}
            className="flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-4 text-xs font-semibold text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('common.stat.totalWaiting')} value={loading ? '…' : String(queueStats.waiting || 0)} caption={t('common.stat.acrossAllDepartments')} icon={Users} />
        <StatCard label={t('common.stat.averageWait')} value="18m" caption={t('common.stat.noColumnYet')} icon={Clock3} />
        <StatCard label={t('common.stat.completed')} value={loading ? '…' : String(queueStats.completed || 0)} caption={t('common.stat.completedQueuing')} icon={CheckCircle2} />
        <StatCard label={t('common.stat.staff')} value={loading ? '…' : staffLabel} caption={t('common.stat.activeStaffTotal')} icon={IdCard} />
        <StatCard label={t('common.stat.terminal')} value={loading ? '…' : terminalLabel} caption={t('common.stat.activeTerminal')} icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-7">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-[#9D0A0E]" />
            <h2 className="text-sm font-bold text-[#1F2937]">{t('reports.aiInsights')}</h2>
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

        <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-5">
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
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.message || item.time || ''}</p>
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
          <div className="w-full max-w-lg rounded-lg border border-[#E5E7EB] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
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
                    <p className="text-sm font-semibold text-[#1F2937]">{item.title || t('reports.activityFallback')}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{item.message || item.time || ''}</p>
                  </div>
                </div>
              ))}

              {pagedLog.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">{t('reports.noActivity')}</p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#E5E7EB] px-5 py-3 text-xs text-slate-500">
              <span>{t('reports.showingLog', { from: notifications.length === 0 ? 0 : (logPage - 1) * LOG_PAGE_SIZE + 1, to: Math.min(logPage * LOG_PAGE_SIZE, notifications.length), total: notifications.length })}</span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage === 1}
                  className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
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
                  className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
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

/* ---------------- Shared: 6-digit box input ---------------- */

function DigitBoxInput({ length, value, onChange, autoFocus, hasError, masked, idPrefix }) {
  const refs = useRef([]);

  function setDigit(index, char) {
    const chars = value.padEnd(length, ' ').split('');
    chars[index] = char;
    onChange(chars.join('').replace(/ /g, '').slice(0, length));
  }

  function handleChange(index, rawValue) {
    const digit = rawValue.replace(/\D/g, '').slice(-1) || '';
    setDigit(index, digit);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      if (value[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setDigit(index - 1, '');
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          id={idPrefix ? `${idPrefix}-${index}` : undefined}
          ref={(el) => (refs.current[index] = el)}
          type={masked ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          value={value[index] || ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={`h-11 w-10 rounded-md border text-center text-lg font-bold text-[#1F2937] outline-none focus:border-[#9D0A0E] ${
            hasError ? 'border-red-400' : 'border-[#D1D5DB]'
          }`}
        />
      ))}
    </div>
  );
}

function formatDateTime(date) {
  if (!date) return '';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/* ---------------- Shared: verification code modal ---------------- */

function VerificationCodeModal({ icon: Icon, title, subtitle, verifyLabel, onClose, onBack, onVerify, onResend }) {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleVerify() {
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(code)) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setVerifying(true);

    try {
      await onVerify(code);
    } catch (err) {
      setError(err?.message || 'Failed to verify the code. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');
    setResending(true);

    try {
      await onResend();
      setCode('');
      setSecondsLeft(30);
      setMessage('A new verification code has been sent to your registered email.');
    } catch (err) {
      setError(err?.message || 'Failed to resend the verification code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="flex items-center justify-end px-4 pt-4">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#9D0A0E]">
            <Icon size={22} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{title}</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs text-[#6B7280]">{subtitle}</p>

          <div className="mt-5">
            <DigitBoxInput length={6} value={code} onChange={setCode} autoFocus hasError={Boolean(error)} idPrefix="verify-code" />
          </div>

          {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
          {message && !error && <p className="mt-3 text-xs font-semibold text-emerald-600">{message}</p>}

          <div className="mt-4">
            {secondsLeft > 0 ? (
              <p className="text-xs text-[#9CA3AF]">{t('passwordWizard.resendIn', { time: `00:${String(secondsLeft).padStart(2, '0')}` })}</p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resending} className="text-xs font-semibold text-[#9D0A0E] hover:underline disabled:opacity-50">
                {resending ? t('wizard.sending') : t('passwordWizard.resendCode')}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-4">
          <button type="button" onClick={onBack} className="flex-1 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-xs font-semibold text-[#4B5563] hover:bg-slate-50">
            {t('wizard.back')}
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
            className="flex-1 rounded-lg bg-[#9D0A0E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? t('wizard.verifying') : verifyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Security PIN wizard ---------------- */

function CreatePinModal({ title, submitLabel, onClose, onContinue }) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError(t('pinWizard.digitsOnlyError'));
      return;
    }

    if (pin !== confirmPin) {
      setError(t('pinWizard.mismatchError'));
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
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="flex items-center justify-end px-5 pt-5">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 pb-2 text-center">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">{t('pinWizard.adminCredentials')}</span>

          <div className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#9D0A0E]">
            <ShieldCheck size={26} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{title}</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#6B7280]">{t('pinWizard.subtitle')}</p>
        </div>

        <div className="space-y-4 px-8 pb-2 pt-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#374151]">{t('pinWizard.newPin')} *</label>
              <button type="button" onClick={() => setShowPin((v) => !v)} className="flex items-center gap-1 text-[10px] font-medium text-[#6B7280] hover:text-[#374151]">
                {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                {t('pinWizard.digitsHint')}
              </button>
            </div>
            <DigitBoxInput length={6} value={pin} onChange={setPin} autoFocus masked={!showPin} hasError={Boolean(error)} idPrefix="new-pin" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#374151]">{t('pinWizard.confirmPin')} *</label>
              <span className="text-[10px] font-medium text-[#9CA3AF]">{t('pinWizard.matchHint')}</span>
            </div>
            <DigitBoxInput length={6} value={confirmPin} onChange={setConfirmPin} masked={!showPin} hasError={Boolean(error)} idPrefix="confirm-pin" />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <Info size={12} />
              {error}
            </p>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-[10px] text-[#6B7280]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
            {t('pinWizard.privacyNote')}
          </div>
        </div>

        <div className="space-y-2 px-8 pb-6 pt-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={submitting}
            className="w-full rounded-lg bg-[#9D0A0E] py-3 text-sm font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('wizard.sending') : `${submitLabel} →`}
          </button>
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-[#D1D5DB] bg-white py-2.5 text-sm font-semibold text-[#4B5563] hover:bg-slate-50">
            {t('wizard.cancel')}
          </button>
        </div>

        <p className="border-t border-[#E5E7EB] bg-[#F9FAFB] py-2.5 text-center text-[9px] font-medium uppercase tracking-wide text-[#9CA3AF]">
          {t('pinWizard.protocolNote')}
        </p>
      </div>
    </div>
  );
}

function PinSuccessModal({ onClose }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="px-6 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check size={28} strokeWidth={3} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{t('pinWizard.successTitle')}</h2>
          <p className="mt-1 text-xs text-[#6B7280]">{t('pinWizard.successBody')}</p>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-left text-[11px] text-emerald-800">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">{t('pinWizard.successProtected')}</p>
              <p className="mt-0.5 text-emerald-700">{t('pinWizard.successConfiguredAt', { date: formatDateTime(new Date()) })}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-[#9D0A0E] py-3 text-sm font-semibold uppercase text-white hover:bg-[#7d0809]">
            {t('wizard.done')}
          </button>
          <p className="mt-3 text-center text-[10px] text-[#9CA3AF]">{t('pinWizard.successFooter')}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Security PIN gate (shown right after login) ---------------- */
//
// Sits in front of the rest of the Admin app for any admin who has a
// Security PIN configured, so it's the first thing they see after
// signing in - not just something buried in Settings. Admins who
// haven't set up a PIN yet aren't blocked by it; nothing exists yet
// to check them against.
//
// "Forgot your PIN?" reuses the same email-verification-code flow as
// the Settings wizard (CreatePinModal + VerificationCodeModal +
// PinSuccessModal) so an admin who's locked themselves out isn't
// stuck - Settings, where that flow normally lives, is itself behind
// this gate.

export function SecurityPinGate({ onUnlock }) {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(null);
  const [pendingPin, setPendingPin] = useState('');

  async function handleUnlock() {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError(t('pinWizard.digitsOnlyError'));
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
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="px-8 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#9D0A0E]">
            <ShieldCheck size={26} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{t('pinGate.title')}</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#6B7280]">{t('pinGate.subtitle')}</p>

          {user?.email && (
            <p className="mt-2 text-[11px] font-semibold text-[#9CA3AF]">
              {t('pinGate.signedInAs', { email: user.email })}
            </p>
          )}
        </div>

        <div className="space-y-4 px-8 pb-2 pt-4">
          <DigitBoxInput
            length={6}
            value={pin}
            onChange={(value) => {
              setPin(value);
              if (error) setError('');
            }}
            autoFocus
            masked
            hasError={Boolean(error)}
            idPrefix="pin-gate"
          />

          {error && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-red-600">
              <Info size={12} />
              {error}
            </p>
          )}
        </div>

        <div className="space-y-3 px-8 pb-8 pt-3">
          <button
            type="button"
            onClick={handleUnlock}
            disabled={verifying || pin.length !== 6}
            className="w-full rounded-lg bg-[#9D0A0E] py-3 text-sm font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? t('wizard.verifying') : t('pinGate.unlock')}
          </button>

          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setRecoveryStep('create')}
              className="font-semibold text-[#9D0A0E] hover:underline"
            >
              {t('pinGate.forgotPin')}
            </button>

            <span className="text-[#9CA3AF]">
              {t('pinGate.notYou')}{' '}
              <button type="button" onClick={signOut} className="font-semibold text-[#374151] hover:underline">
                {t('pinGate.signOut')}
              </button>
            </span>
          </div>
        </div>
      </div>

      {recoveryStep === 'create' && (
        <CreatePinModal
          title={t('pinWizard.changeTitle')}
          submitLabel={t('pinWizard.submitChange')}
          onClose={closeRecovery}
          onContinue={handleRecoveryContinue}
        />
      )}

      {recoveryStep === 'verify' && (
        <VerificationCodeModal
          icon={ShieldCheck}
          title={t('pinWizard.verifyTitle')}
          subtitle={t('pinWizard.verifySubtitle')}
          verifyLabel={t('wizard.continue')}
          onClose={closeRecovery}
          onBack={() => setRecoveryStep('create')}
          onVerify={handleRecoveryVerify}
          onResend={handleRecoveryResend}
        />
      )}

      {recoveryStep === 'success' && (
        <PinSuccessModal
          onClose={() => {
            closeRecovery();
            onUnlock();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Change Password wizard ---------------- */

function ChangePasswordEmailModal({ email, onClose, onContinue }) {
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    setError('');
    setSending(true);

    try {
      await onContinue();
    } catch (err) {
      setError(err?.message || 'Failed to send verification code.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#6B7280]">
            {t('wizard.stepOf', { current: 1, total: 3 })}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-2 pt-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#9D0A0E]">
            <LockKeyhole size={22} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{t('passwordWizard.title')}</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs text-[#6B7280]">{t('passwordWizard.emailSubtitle')}</p>
        </div>

        <div className="space-y-3 px-6 pb-2 pt-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#374151]">{t('passwordWizard.emailLabel')}</label>
            <div className="flex items-center gap-2 rounded-md border border-[#D1D5DB] px-3 py-2.5">
              <Mail size={14} className="text-[#9CA3AF]" />
              <span className="truncate text-sm text-[#1F2937]">{email || '—'}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5 text-[10px] text-[#3B82F6]">
            <Info size={13} className="mt-0.5 shrink-0" />
            {t('passwordWizard.emailNote')}
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        </div>

        <div className="space-y-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !email}
            className="w-full rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? t('wizard.sending') : `${t('passwordWizard.sendCode')} →`}
          </button>
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-[#D1D5DB] bg-white py-2.5 text-sm font-semibold text-[#4B5563] hover:bg-slate-50">
            {t('wizard.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPasswordModal({ onClose, onSubmit }) {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requirements = [
    { key: 'reqLength', met: newPassword.length >= 8 },
    { key: 'reqUppercase', met: /[A-Z]/.test(newPassword) },
    { key: 'reqNumber', met: /\d/.test(newPassword) },
    { key: 'reqSpecial', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  async function handleSubmit() {
    setError('');

    if (!requirements.every((req) => req.met)) {
      setError('Please meet all password requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit(newPassword);
    } catch (err) {
      setError(err?.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#6B7280]">
            {t('wizard.stepOf', { current: 3, total: 3 })}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-2 pt-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#9D0A0E]">
            <LockKeyhole size={22} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{t('passwordWizard.newTitle')}</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs text-[#6B7280]">{t('passwordWizard.newSubtitle')}</p>
        </div>

        <div className="space-y-3 px-6 pb-2 pt-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#374151]">{t('passwordWizard.newPassword')} *</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] px-3 py-2.5 pr-9 text-sm text-[#1F2937] outline-none focus:border-[#9D0A0E]"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#374151]">{t('passwordWizard.confirmPassword')} *</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] px-3 py-2.5 pr-9 text-sm text-[#1F2937] outline-none focus:border-[#9D0A0E]"
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="rounded-md bg-[#F9FAFB] px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold text-[#374151]">{t('passwordWizard.requirements')}</p>
            <ul className="space-y-1">
              {requirements.map((req) => (
                <li key={req.key} className={`flex items-center gap-1.5 text-[10px] ${req.met ? 'text-emerald-600' : 'text-[#9CA3AF]'}`}>
                  {req.met ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {t(`passwordWizard.${req.key}`)}
                </li>
              ))}
            </ul>
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        </div>

        <div className="space-y-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t('passwordWizard.changing') : `${t('passwordWizard.submit')} →`}
          </button>
          <button type="button" onClick={onClose} className="w-full rounded-lg border border-[#D1D5DB] bg-white py-2.5 text-sm font-semibold text-[#4B5563] hover:bg-slate-50">
            {t('wizard.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordChangedSuccessModal({ onClose }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl">
        <div className="px-6 pb-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check size={28} strokeWidth={3} />
          </div>

          <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{t('passwordWizard.successTitle')}</h2>
          <p className="mt-1 text-xs text-[#6B7280]">{t('passwordWizard.successBody')}</p>

          <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[11px] text-[#4B5563]">
            {t('passwordWizard.successUpdatedAt', { date: formatDateTime(new Date()) })}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-[#9D0A0E] py-3 text-sm font-semibold text-white hover:bg-[#7d0809]">
            {t('passwordWizard.continueButton')} →
          </button>
          <p className="mt-3 text-center text-[10px] text-[#9CA3AF]">{t('passwordWizard.successNote')}</p>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [theme, setTheme] = useState(loadStoredTheme());
  const [avatar, setAvatar] = useState(loadStoredAvatar());
  const [departments, setDepartments] = useState([]);
  const [departmentNameDraft, setDepartmentNameDraft] = useState(null);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [departmentError, setDepartmentError] = useState(null);
  const [departmentSaved, setDepartmentSaved] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const [accent, setAccent] = useState(loadStoredAccent());
  const colorInputRef = useRef(null);

  const [clockFormat, setClockFormat] = useState(loadStoredClockFormat());

  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinStatusLoading, setPinStatusLoading] = useState(true);
  const [activePinModal, setActivePinModal] = useState(null);
  const [pendingPin, setPendingPin] = useState('');

  const [activePasswordModal, setActivePasswordModal] = useState(null);
  const [pendingPasswordCode, setPendingPasswordCode] = useState('');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getDepartments();
        setDepartments(data || []);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    }

    load();
  }, []);

  const adminDepartment = useMemo(
    () => findDepartmentForUser(departments, user),
    [departments, user]
  );

  const departmentName = departmentNameDraft ?? (adminDepartment?.name || '');

  useEffect(() => {
    let mounted = true;

    async function loadPinStatus() {
      try {
        const configured = await getSecurityPinStatus(auth.currentUser);
        if (mounted) setPinConfigured(configured);
      } catch (err) {
        console.error('Failed to load Security PIN status:', err);
      } finally {
        if (mounted) setPinStatusLoading(false);
      }
    }

    loadPinStatus();

    return () => {
      mounted = false;
    };
  }, []);

  function handleAvatarChange(dataUrl) {
    setAvatar(dataUrl);
    saveStoredAvatar(dataUrl);
  }

  async function handleSaveDepartmentName() {
    if (!adminDepartment?.department_id || departmentName === adminDepartment.name) {
      return;
    }

    setSavingDepartment(true);
    setDepartmentError(null);
    setDepartmentSaved(false);

    try {
      await updateDepartment(adminDepartment.department_id, { name: departmentName });

      setDepartments((current) =>
        current.map((department) =>
          department.department_id === adminDepartment.department_id
            ? { ...department, name: departmentName }
            : department
        )
      );

      setDepartmentNameDraft(null);
      setDepartmentSaved(true);
      setTimeout(() => setDepartmentSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update department:', err);
      setDepartmentError(err?.message || 'Failed to update department name.');
    } finally {
      setSavingDepartment(false);
    }
  }

  function handleAccentChange(hex) {
    setAccent(hex);
    applyAccent(hex);
  }

  function handleClockFormatChange(format) {
    setClockFormat(format);
    saveStoredClockFormat(format);
  }

  function closePinFlow() {
    setPendingPin('');
    setActivePinModal(null);
  }

  async function handlePinContinue(pin) {
    setPendingPin(pin);
    await requestSecurityPinVerification(auth.currentUser);
    setActivePinModal('verify');
  }

  async function handlePinResend() {
    await requestSecurityPinVerification(auth.currentUser);
  }

  async function handlePinVerify(code) {
    await verifySecurityPinCode(auth.currentUser, code, pendingPin);
    setPendingPin('');
    setPinConfigured(true);
    setActivePinModal('success');
  }

  function closePasswordFlow() {
    setActivePasswordModal(null);
    setPendingPasswordCode('');
  }

  async function handlePasswordRequestCode() {
    await requestPasswordChangeCode(auth.currentUser);
    setActivePasswordModal('verify');
  }

  async function handlePasswordResend() {
    await requestPasswordChangeCode(auth.currentUser);
  }

  async function handlePasswordVerify(code) {
    await verifyPasswordChangeCode(auth.currentUser, code);
    setPendingPasswordCode(code);
    setActivePasswordModal('new');
  }

  async function handlePasswordSubmit(newPassword) {
    // Finalizes server-side through the Firebase Admin SDK rather than
    // the client-side updatePassword(), which requires a "recent" sign-in
    // and would fail with auth/requires-recent-login for anyone using
    // this wizard later in their session instead of right after logging
    // in - the normal case for a voluntary password change from Settings.
    await finalizePasswordChange(auth.currentUser, pendingPasswordCode, newPassword);
    setPendingPasswordCode('');
    setActivePasswordModal('success');
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#1F2937]">{t('settings.title')}</h1>
        <p className="mt-1 text-xs text-[#4B5563]">{t('settings.subtitle')}</p>
      </div>

      <div className="space-y-4">
        {/* Branding & Identity */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#1F2937]">{t('settings.brandingIdentity')}</h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">{t('settings.brandingIdentityNote')}</p>

          <div className="mt-4 space-y-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">{t('settings.departmentName')}</label>
              <div className="flex max-w-md items-center gap-2">
                <input
                  value={departmentName}
                  onChange={(e) => setDepartmentNameDraft(e.target.value)}
                  onBlur={handleSaveDepartmentName}
                  className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#9D0A0E]"
                />
                {savingDepartment && <RefreshCw size={14} className="shrink-0 animate-spin text-slate-400" />}
                {departmentSaved && <Check size={16} className="shrink-0 text-emerald-500" />}
              </div>
              {departmentError && <p className="mt-1 text-xs font-semibold text-red-600">{departmentError}</p>}
              <p className="mt-1 text-[10px] text-slate-400">{t('settings.departmentNameNote')}</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">{t('settings.logo')}</label>
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt="Logo" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#FBF1F1] text-sm font-semibold text-[#9D0A0E]">
                    {getInitials(user)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="flex items-center gap-1.5 rounded-md bg-[#F1F3F5] px-3 py-2 text-xs font-semibold text-[#1F2937] hover:bg-slate-200"
                >
                  <Upload size={13} />
                  {t('settings.uploadNewLogo')}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#374151]">{t('settings.primaryAccentColor')}</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border border-[#D1D5DB] px-2.5 py-1.5">
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: accent }} />
                  <span className="text-xs font-semibold uppercase text-[#374151]">{accent}</span>
                </div>

                {ACCENT_SWATCHES.slice(0, 5).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleAccentChange(color)}
                    aria-label={color}
                    className={`relative h-7 w-7 rounded-full border ${accent === color ? 'border-[#1F2937]' : 'border-black/10'}`}
                    style={{ backgroundColor: color }}
                  >
                    {accent === color && <Check size={12} strokeWidth={3} className="absolute inset-0 m-auto text-white" />}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-[#9CA3AF] hover:text-[#4B5563]"
                  title="Custom color"
                >
                  <Pipette size={12} />
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={accent}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">{t('settings.accentColorNote')}</p>
            </div>
          </div>
        </section>

        {/* Password & Security */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#1F2937]">{t('settings.passwordSecurity')}</h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">{t('settings.passwordSecurityNote')}</p>

          <div className="mt-4 divide-y divide-[#E5E7EB]">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-xs font-semibold text-[#1F2937]">{t('settings.password')}</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">{t('settings.passwordNote')}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {user?.password_changed_at
                    ? t('settings.passwordLastChanged', { date: formatDateTime(user.password_changed_at) })
                    : t('settings.passwordNeverChanged')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePasswordModal('email')}
                className="flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-slate-50"
              >
                <LockKeyhole size={13} />
                {t('settings.changePassword')}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-xs font-semibold text-[#1F2937]">{t('settings.securityPin')}</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">{t('settings.securityPinNote')}</p>
                <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${pinConfigured ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${pinConfigured ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {pinStatusLoading ? t('common.loading') : pinConfigured ? t('settings.pinSet') : t('settings.pinNotSet')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActivePinModal('create')}
                disabled={pinStatusLoading}
                className="flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-slate-50 disabled:opacity-50"
              >
                <ShieldCheck size={13} />
                {pinConfigured ? t('settings.changePin') : t('settings.setUpPin')}
              </button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#1F2937]">{t('settings.appearance')}</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { key: 'light', icon: Sun, labelKey: 'settings.lightMode', captionKey: 'settings.lightModeCaption' },
              { key: 'dark', icon: Moon, labelKey: 'settings.darkMode', captionKey: 'settings.darkModeCaption' },
              { key: 'device', icon: Monitor, labelKey: 'settings.systemDefault', captionKey: 'settings.systemDefaultCaption' },
            ].map(({ key, icon: Icon, labelKey, captionKey }) => {
              const isActive = theme === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    isActive ? 'border-[#9D0A0E] ring-1 ring-[#9D0A0E]' : 'border-[#E5E7EB] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#1F2937]">
                      <Icon size={13} />
                      {t(labelKey)}
                    </span>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${isActive ? 'border-[#9D0A0E] bg-[#9D0A0E]' : 'border-[#D1D5DB]'}`}>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{t(captionKey)}</p>

                  <div
                    className={`mt-3 h-10 rounded-md p-1.5 ${
                      key === 'dark' ? 'bg-slate-800' : key === 'device' ? 'bg-gradient-to-r from-white to-slate-800' : 'border border-[#E5E7EB] bg-white'
                    }`}
                  >
                    <div className={`h-1.5 w-2/3 rounded-full ${key === 'light' ? 'bg-slate-300' : 'bg-slate-500'}`} />
                    <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-[#9D0A0E]" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Language & Regional Settings */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-[#1F2937]">{t('settings.languageRegional')}</h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">{t('settings.languageRegionalNote')}</p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-[#374151]">{t('settings.primaryLanguage')}</p>
            <div className="flex flex-wrap items-center gap-2">
              {['English', 'Filipino', 'Cebuano'].map((option) => {
                const isActive = language === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLanguage(option)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                      isActive ? 'border-[#9D0A0E] bg-[#9D0A0E] text-white' : 'border-[#E5E7EB] bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && <Check size={12} />}
                    {option}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">{t('settings.primaryLanguageNote')}</p>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-[#374151]">{t('settings.clockFormat')}</p>
            <select
              value={clockFormat}
              onChange={(e) => handleClockFormatChange(e.target.value)}
              className="w-full max-w-xs rounded-md border border-[#D1D5DB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#9D0A0E]"
            >
              <option value="12h">{t('settings.clockFormat12')}</option>
              <option value="24h">{t('settings.clockFormat24')}</option>
            </select>
            <p className="mt-1.5 text-[10px] text-slate-400">{t('settings.clockFormatNote')}</p>
          </div>
        </section>
      </div>

      {showPhotoModal && (
        <ChangeProfileModal
          onClose={() => setShowPhotoModal(false)}
          onSave={handleAvatarChange}
        />
      )}

      {/* Change Password wizard */}
      {activePasswordModal === 'email' && (
        <ChangePasswordEmailModal
          email={user?.email}
          onClose={closePasswordFlow}
          onContinue={handlePasswordRequestCode}
        />
      )}

      {activePasswordModal === 'verify' && (
        <VerificationCodeModal
          icon={LockKeyhole}
          title={t('passwordWizard.verifyTitle')}
          subtitle={t('passwordWizard.verifySubtitle')}
          verifyLabel={t('passwordWizard.verifyCode')}
          onClose={closePasswordFlow}
          onBack={() => setActivePasswordModal('email')}
          onVerify={handlePasswordVerify}
          onResend={handlePasswordResend}
        />
      )}

      {activePasswordModal === 'new' && (
        <NewPasswordModal onClose={closePasswordFlow} onSubmit={handlePasswordSubmit} />
      )}

      {activePasswordModal === 'success' && <PasswordChangedSuccessModal onClose={closePasswordFlow} />}

      {/* Security PIN wizard */}
      {activePinModal === 'create' && (
        <CreatePinModal
          title={pinConfigured ? t('pinWizard.changeTitle') : t('pinWizard.setupTitle')}
          submitLabel={pinConfigured ? t('pinWizard.submitChange') : t('pinWizard.submitSetup')}
          onClose={closePinFlow}
          onContinue={handlePinContinue}
        />
      )}

      {activePinModal === 'verify' && (
        <VerificationCodeModal
          icon={ShieldCheck}
          title={t('pinWizard.verifyTitle')}
          subtitle={t('pinWizard.verifySubtitle')}
          verifyLabel={t('wizard.continue')}
          onClose={closePinFlow}
          onBack={() => setActivePinModal('create')}
          onVerify={handlePinVerify}
          onResend={handlePinResend}
        />
      )}

      {activePinModal === 'success' && <PinSuccessModal onClose={closePinFlow} />}
    </div>
  );
}