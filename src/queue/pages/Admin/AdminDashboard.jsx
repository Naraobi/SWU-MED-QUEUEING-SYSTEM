import { useEffect, useMemo, useRef, useState } from 'react';
import { auth } from "../../../firebase";

import {
  Bell,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  IdCard,
  Info,
  Monitor,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  Timer,
  TriangleAlert,
  Undo2,
  Users,
} from 'lucide-react';

import {
  fetchNotifications,
  fetchQueueState,
} from '../../services/api';

import {
  getUsers,
  getDepartments,
  getTerminals,
  getDashboardAnalytics,
  getSecurityPinStatus,
  setupSecurityPin,
} from "../../services/backendApi";
import { useAuth } from '../../services/Authcontext';
import { useQueue } from '../../context/QueueContext';

import { DateRangePicker, StatCard } from './shared';
import {
  SettingsExactCreatePinModal,
  SettingsExactPinSuccessModal,
} from './AdminScreens';

import {
  THEME,
  getPresetRange,
  formatRangeLabel,
  formatShortDate,
  toDateKey,
} from './adminHelpers';

import { formatLongDate } from './i18n';
import { useLanguage } from './LanguageContext';

// =====================================================
// FALLBACK
// =====================================================
//
// Every queue_number in queue_ticket is prefixed with
// a department code such as:
//
// BP = Billing/Payment
// LB = Laboratory
//
// If the logged-in user's department prefix is not yet
// available, BP is temporarily used.
//
const FALLBACK_DEPARTMENT_PREFIX = 'BP';

// =====================================================
// HELPERS
// =====================================================

function normalizeRole(role) {
  if (!role) return '';

  if (typeof role === 'string') {
    return role.trim().toLowerCase();
  }

  return String(
    role.role ||
      role.name ||
      ''
  )
    .trim()
    .toLowerCase();
}

function normalizeId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function normalizeDepartmentId(user) {
  return normalizeId(
    user?.department_id ??
      user?.departmentId ??
      user?.department?.department_id ??
      user?.department?.id
  );
}

function normalizeStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase();
}

// =====================================================
// AI-ASSISTED INSIGHTS
// =====================================================
//
// Lightweight, rule-based insights derived from the
// data already loaded on this dashboard (no extra
// fetches / no invented numbers).
//
function buildInsights({
  waiting,
  skipped,
  completed,
  staffLabel,
  terminalLabel,
  t,
}) {
  const insights = [];

  const totalHandled =
    Number(completed || 0) +
    Number(skipped || 0);

  const skipRate =
    totalHandled > 0
      ? Math.round(
          (Number(skipped || 0) /
            totalHandled) *
            100
        )
      : 0;

  if (Number(waiting || 0) >= 10) {
    insights.push({
      icon: Info,
      message: t('insights.highWaiting', { waiting }),
    });
  }

  const [activeStr, totalStr] =
    String(staffLabel || '').split('/');

  const activeNum = Number(activeStr);
  const totalNum = Number(totalStr);

  if (
    totalNum > 0 &&
    activeNum / totalNum < 0.5
  ) {
    insights.push({
      icon: Gauge,
      message: t('insights.lowStaffActive', { active: activeStr, total: totalStr }),
    });
  }

  if (skipRate >= 15) {
    insights.push({
      icon: TriangleAlert,
      message: t('insights.highSkipRate', { rate: skipRate }),
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: Info,
      message: t('insights.allNormalDashboard'),
    });
  }

  return insights;
}

// =====================================================
// DONUT CHART
// =====================================================

function DonutChart({ slices }) {
  const radius = 39;
  const circumference = 2 * Math.PI * radius;

  const total = slices.reduce(
    (sum, slice) => sum + slice.value,
    0
  );

  let offset = 0;

  if (total === 0) {
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-32 w-32"
        aria-label="Queue status distribution"
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={THEME.border}
          strokeWidth="13"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-32 w-32 -rotate-90"
      aria-label="Queue status distribution"
    >
      {slices.map((slice) => {
        const length =
          (slice.value / total) *
          circumference;

        const circle = (
          <circle
            key={slice.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="13"
            strokeDasharray={`${length} ${
              circumference - length
            }`}
            strokeDashoffset={-offset}
          />
        );

        offset += length;

        return circle;
      })}
    </svg>
  );
}

// =====================================================
// ADMIN DASHBOARD
// =====================================================


// Dashboard metric card — mirrors the exact Queue Management typography,
// spacing, borders, and sizing without changing the shared StatCard.
function DashboardStatCard({ label, value, caption, icon: Icon, highlight = false }) {
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, langCode } = useLanguage();

  // `activeTickets` already carries everything a "currently dispatched"
  // row needs (ticket number, priority flag, counter_id, status,
  // called_at) — this is the same data Admin's Queue Management uses
  // to show every terminal at once, reused here for the log.
  const { activeTickets, refresh: refreshQueue } = useQueue();

  // ===================================================
  // CURRENT USER
  // ===================================================

  const currentRole = normalizeRole(
    user?.role
  );

  const isSuperadmin =
    currentRole === 'superadmin';

  const currentDepartmentId =
    normalizeDepartmentId(user);

  const departmentPrefix =
    user?.department_prefix ||
    user?.departmentPrefix ||
    FALLBACK_DEPARTMENT_PREFIX;

  // ===================================================
  // FIRST-LOGIN SECURITY PIN SETUP
  // ===================================================
  //
  // A brand-new Admin/Superadmin account has no Security PIN yet.
  // This reuses the exact same "is a PIN configured?" check Settings
  // already runs (GET /security/pin/status, backed by the existing
  // security_pin table) — no separate "already asked" flag. That
  // means the prompt reappears on the next login if the admin
  // cancels without setting one, and stops for good once a PIN
  // actually exists.

  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [showPinSetupSuccess, setShowPinSetupSuccess] = useState(false);
  const [pinSetupSaving, setPinSetupSaving] = useState(false);
  const [pinSetupError, setPinSetupError] = useState('');
  const pinSetupCheckedRef = useRef(false);

  useEffect(() => {
    if (pinSetupCheckedRef.current) return;
    if (currentRole !== 'admin' && currentRole !== 'superadmin') return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    pinSetupCheckedRef.current = true;

    getSecurityPinStatus(firebaseUser)
      .then((result) => {
        if (!result?.configured) {
          setShowPinSetupModal(true);
        }
      })
      .catch((error) => {
        console.warn('Unable to check Security PIN status:', error);
      });
  }, [currentRole, user]);

  async function handlePinSetupContinue(pin) {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setPinSetupError('Your authentication session is unavailable. Please log in again.');
      return;
    }

    try {
      setPinSetupError('');
      setPinSetupSaving(true);

      await setupSecurityPin(firebaseUser, pin);

      setShowPinSetupModal(false);
      setShowPinSetupSuccess(true);
    } catch (error) {
      console.error('Failed to set up Security PIN:', error);
      setPinSetupError(error?.message || 'Failed to set up your Security PIN.');
    } finally {
      setPinSetupSaving(false);
    }
  }

  // ===================================================
  // STATE
  // ===================================================

  const [dateRange, setDateRange] =
    useState(() =>
      getPresetRange('Today')
    );

  // Read inside fetch functions so a newly-applied range is
  // used immediately, without restarting the 15s poll effect.
  const dateRangeRef = useRef(
    dateRange
  );

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [queueState, setQueueState] =
    useState({
      waitingQueue: [],
      currentlyServing: null,
      stats: {
        waiting: 0,
        completed: 0,
        skipped: 0,
      },
    });

  const [notifications, setNotifications] =
    useState([]);

  const [staffLoading, setStaffLoading] =
    useState(true);

  const [staffLabel, setStaffLabel] =
    useState('--');

  const [terminalLoading, setTerminalLoading] =
    useState(true);

  const [terminalLabel, setTerminalLabel] =
    useState('--');

  // Raw lists (not just the derived "x/y" labels above) so the
  // dispatch log below can look up each terminal's prefix and its
  // assigned staff member's name.
  const [terminalRecords, setTerminalRecords] =
    useState([]);

  const [staffRecords, setStaffRecords] =
    useState([]);

  // ===================================================
  // LOAD QUEUE + NOTIFICATIONS
  // ===================================================
const loadDashboard = async () => {
  try {
    setRefreshing(true);
    setError("");

    if (!user) {
      throw new Error("Authenticated user is required.");
    }

  const selectedRange = dateRangeRef.current;

const startDate = toDateKey(
  selectedRange.start
);

const endDate = toDateKey(
  selectedRange.end
);

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      throw new Error(
        "Firebase authentication session is not available."
      );
    }

    const analytics = await getDashboardAnalytics(
      firebaseUser,
      startDate,
      endDate
    );

    setQueueState((previous) => ({
      ...previous,
      waitingQueue: [],
      currentlyServing: null,
      stats: {
        waiting: analytics?.queue?.waiting ?? 0,
        averageWait:
          analytics?.queue?.averageWaitMinutes ?? 0,
        completed: analytics?.queue?.completed ?? 0,
        skipped: analytics?.queue?.skipped ?? 0,
        terminalStats: {
          active: analytics?.terminals?.active ?? 0,
          total: analytics?.terminals?.total ?? 0,
        },
      },
    }));

    const notificationData =
      await fetchNotifications(departmentPrefix);

    setNotifications(notificationData || []);
  } catch (err) {
    console.error(
      "Admin dashboard load error:",
      err
    );

    setError(
      err?.message ||
        "Failed to load dashboard data."
    );
  } finally {
    setRefreshing(false);
    setLoading(false);
  }
};

  // ===================================================
  // LOAD STAFF COUNT
  // ===================================================
  //
  // IMPORTANT:
  // This now uses backendApi.js.
  //
  // React
  //   ↓
  // backendApi.js
  //   ↓
  // Node.js
  //   ↓
  // MySQL / Firebase
  //
  // It no longer queries Supabase.
  async function loadStaffCount() {
  setStaffLoading(true);

  try {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      throw new Error(
        "Firebase authentication session is not available."
      );
    }

    const [users, departments] =
      await Promise.all([
        getUsers(firebaseUser),
        getDepartments(),
      ]);

    const userList =
      Array.isArray(users)
        ? users
        : [];

    const departmentList =
      Array.isArray(departments)
        ? departments
        : [];
      // -----------------------------------------------
      // Find user's department
      // -----------------------------------------------

      let userDepartment = null;

      if (currentDepartmentId) {
        userDepartment =
          departmentList.find(
            (dept) =>
              String(dept.department_id) ===
              String(currentDepartmentId)
          );
      }

      // -----------------------------------------------
      // Only count Staff-role accounts.
      // -----------------------------------------------
      //
      // The dashboard's "Staff" stat should match the
      // Staff Management page, which only lists accounts
      // with the "Staff" role (not Admin/Superadmin).
      //
      // -----------------------------------------------

      let visibleUsers =
        userList.filter(
          (staff) =>
            normalizeRole(staff.role) === 'staff'
        );

      // -----------------------------------------------
      // Department Admin
      // -----------------------------------------------
      //
      // Admin should only count staff belonging to
      // their assigned department.
      //
      // Superadmin can see staff across all departments.
      //
      // -----------------------------------------------

      if (
        !isSuperadmin &&
        currentDepartmentId
      ) {
        visibleUsers =
          visibleUsers.filter(
            (staff) =>
              normalizeDepartmentId(
                staff
              ) ===
              currentDepartmentId
          );
      }

      const activeCount =
        visibleUsers.filter(
          (staff) =>
            normalizeStatus(
              staff.status
            ) === 'active'
        ).length;

      setStaffLabel(
        `${activeCount}/${visibleUsers.length}`
      );

      setStaffRecords(visibleUsers);
    } catch (err) {
      console.error(
        'Staff count fetch failed:',
        err
      );

      setStaffLabel('--');
      setStaffRecords([]);
    } finally {
      setStaffLoading(false);
    }
  }

  // ===================================================
  // LOAD TERMINAL COUNT
  // ===================================================

  async function loadTerminalCount() {
    setTerminalLoading(true);

    try {
      const [terminals, departments] =
        await Promise.all([
          getTerminals(),
          getDepartments(),
        ]);

      const terminalList =
        Array.isArray(terminals)
          ? terminals
          : [];

      const departmentList =
        Array.isArray(departments)
          ? departments
          : [];

      // -----------------------------------------------
      // Find user's department
      // -----------------------------------------------

      let userDepartment = null;

      if (currentDepartmentId) {
        userDepartment =
          departmentList.find(
            (dept) =>
              String(dept.department_id) ===
              String(currentDepartmentId)
          );
      }

      // -----------------------------------------------
      // Superadmin
      // -----------------------------------------------
      //
      // Superadmin can see the whole system.
      //
      // -----------------------------------------------

      let visibleTerminals =
        terminalList;

      // -----------------------------------------------
      // Department Admin
      // -----------------------------------------------
      //
      // Admin should only count terminals belonging to
      // their assigned department.
      //
      // -----------------------------------------------

      if (
        !isSuperadmin &&
        currentDepartmentId
      ) {
        visibleTerminals =
          terminalList.filter(
            (terminal) =>
              String(terminal.department_id) ===
              String(currentDepartmentId)
          );
      }

      const activeCount =
        visibleTerminals.filter(
          (terminal) =>
            normalizeStatus(
              terminal.status
            ) === 'active'
        ).length;

      setTerminalLabel(
        `${activeCount}/${visibleTerminals.length}`
      );

      setTerminalRecords(visibleTerminals);
    } catch (err) {
      console.error(
        'Terminal count fetch failed:',
        err
      );

      setTerminalLabel('--');
      setTerminalRecords([]);
    } finally {
      setTerminalLoading(false);
    }
  }

  // ===================================================
  // INITIAL LOAD + POLLING
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      await Promise.all([
        loadDashboard(),
        loadStaffCount(),
        loadTerminalCount(),
        refreshQueue(departmentPrefix),
      ]);

      if (cancelled) {
        return;
      }
    }

    load();

    // Refresh live queue data every 15 seconds. The dispatch log's
    // activeTickets is refreshed silently so it doesn't flash a
    // loading state on the rest of the dashboard.
    const poll =
      setInterval(
        () => {
          loadDashboard();
          refreshQueue(departmentPrefix, undefined, { silent: true });
        },
        15000
      );

    return () => {
      cancelled = true;
      clearInterval(poll);
    };

    // These functions intentionally use the current
    // department prefix / user scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
  departmentPrefix,
  currentDepartmentId,
  isSuperadmin,
  user,
]);

  // ===================================================
  // MANUAL REFRESH / FILTER
  // ===================================================

  async function handleApplyFilter() {
    setRefreshing(true);

    try {
      await Promise.all([
        loadDashboard(),
        loadStaffCount(),
        loadTerminalCount(),
        refreshQueue(departmentPrefix),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function applyDateRange(newRange) {
    dateRangeRef.current = newRange;
    setDateRange(newRange);
    await handleApplyFilter();
  }

  async function handleReset() {
    await applyDateRange(
      getPresetRange('Today')
    );
  }

  // ===================================================
  // QUEUE DATA
  // ===================================================

  const stats =
    queueState?.stats || {
      waiting: 0,
      currentlyServing: 0,
      completed: 0,
      skipped: 0,
    };

  // ===================================================
  // QUEUE DISTRIBUTION
  // ===================================================

  const distribution = [
    {
      label: 'Waiting',
      labelKey: 'dashboard.waitingLabel',
      value: Number(
        stats.waiting || 0
      ),
      color: '#94A3B8',
    },

    {
      label: 'Completed',
      labelKey: 'common.stat.completed',
      value: Number(
        stats.completed || 0
      ),
      color: THEME.primary,
    },

    {
      label: 'Serving',
      labelKey: 'dashboard.servingLabel',
      value: Number(
        stats.currentlyServing || 0
      ),
      color: THEME.textMain,
    },
  ];

  const distributionTotal = distribution.reduce(
    (sum, slice) => sum + slice.value,
    0
  );

  const hasDistributionData =
    distribution.some(
      (slice) =>
        slice.value > 0
    );

  // ===================================================
  // TERMINAL DISPATCH LOG
  // ===================================================
  //
  // Every terminal currently serving a patient, most recently
  // called first. `activeTickets` already carries the ticket number,
  // priority flag, counter_id and status — this just adds the
  // terminal's display label and its assigned staff member's name.
  //

  const terminalByCounterId = useMemo(() => {
    const map = {};

    terminalRecords.forEach((terminal) => {
      if (terminal?.counter_id) {
        map[String(terminal.counter_id)] = terminal;
      }
    });

    return map;
  }, [terminalRecords]);

  const staffById = useMemo(() => {
    const map = {};

    staffRecords.forEach((staff) => {
      const staffId = staff?.user_id ?? staff?.id;

      if (staffId) {
        map[String(staffId)] = staff;
      }
    });

    return map;
  }, [staffRecords]);

  const dispatchLog = useMemo(() => {
    return [...activeTickets]
      .filter((ticket) => ticket?.counterId)
      .sort(
        (a, b) =>
          new Date(b.calledAt || 0).getTime() -
          new Date(a.calledAt || 0).getTime()
      )
      .slice(0, 8)
      .map((ticket) => {
        const terminal =
          terminalByCounterId[String(ticket.counterId)] || null;

        const terminalLabelText = terminal
          ? terminal.prefix || `Terminal ${terminal.counter_number}`
          : ticket.terminal || '--';

        const operator = terminal?.assigned_staff_id
          ? staffById[String(terminal.assigned_staff_id)]
          : null;

        const operatorName = operator
          ? `${operator.first_name || ''} ${operator.last_name || ''}`.trim()
          : '';

        const time = ticket.calledAt
          ? new Date(ticket.calledAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })
          : '--';

        const statusText =
          ticket.status === 'serving'
            ? 'Serving'
            : ticket.status === 'called'
              ? 'Called'
              : ticket.status || '--';

        return {
          key: ticket.dbId || ticket.uniqueKey,
          time,
          ticketNumber: ticket.id,
          isPriority: ticket.isPriority,
          terminalLabel: terminalLabelText,
          operatorName,
          statusText,
        };
      });
  }, [activeTickets, terminalByCounterId, staffById]);

  // ===================================================
  // AI INSIGHTS
  // ===================================================

  const insightsReady =
    !loading && !staffLoading && !terminalLoading;

  const insights = insightsReady
    ? buildInsights({
        waiting: stats.waiting,
        skipped: stats.skipped,
        completed: stats.completed,
        staffLabel,
        terminalLabel,
        t,
      })
    : [];

  // ===================================================
  // CURRENT DATE
  // ===================================================

  const currentDate = formatLongDate(
    new Date(),
    langCode
  );

  const isTodayOnly =
    toDateKey(dateRange.start) ===
      toDateKey(new Date()) &&
    toDateKey(dateRange.end) ===
      toDateKey(new Date());

  const rangeSubtitle = isTodayOnly
    ? `${t('common.today')} · ${currentDate}`
    : `${formatRangeLabel(
        dateRange,
        langCode
      )} · ${formatShortDate(
        dateRange.start,
        langCode
      )} – ${formatShortDate(
        dateRange.end,
        langCode
      )}, ${dateRange.end.getFullYear()}`;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="min-w-0">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">

        <div>
          <h1 className="text-[30px] font-bold leading-[38px] tracking-[-0.6px] text-[#212B3A]">
            {t('dashboard.title')}
          </h1>

          <p className="mt-1 text-base text-[#44474C]">
            {rangeSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {/* RANGE */}

          <DateRangePicker
            value={dateRange}
            onApply={applyDateRange}
          />

          {/* APPLY FILTER */}

          <button
            type="button"
            onClick={
              handleApplyFilter
            }
            disabled={refreshing}
            className="flex h-[50px] items-center gap-2 rounded-lg bg-[#9D0A0E] px-6 text-sm font-bold tracking-[0.6px] text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {refreshing && (
              <RefreshCw
                size={12}
                className="animate-spin"
              />
            )}

            {refreshing
              ? t('common.applying')
              : t('common.applyFilter')}
          </button>

          {/* RESET */}

          <button
            type="button"
            onClick={
              handleReset
            }
            disabled={refreshing}
            className="flex h-[50px] items-center rounded-lg border border-[#C3C6D7] bg-white px-5 text-sm font-semibold text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('common.reset')}
          </button>
        </div>
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-[#9D0A0E]">
          {error}
        </div>
      )}

      {/* =================================================
          STAT CARDS
      ================================================= */}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">

        <DashboardStatCard
          label={t('common.stat.totalWaiting')}
          value={
            loading
              ? '…'
              : String(
                  stats.waiting || 0
                )
          }
          caption={t('common.stat.acrossAllDepartments')}
          icon={Users}
        />

              <DashboardStatCard
          label="Average Wait"
          value={`${stats.averageWait || 0}m`}
          caption="Average patient wait"
          icon={Clock3}
        />

        <DashboardStatCard
          label={t('common.stat.skipped')}
          value={
            loading
              ? '…'
              : String(
                  stats.skipped || 0
                )
          }
          caption={t('common.stat.skippedQueuing')}
          icon={Undo2}
        />

        <DashboardStatCard
          label={t('common.stat.completed')}
          value={
            loading
              ? '…'
              : String(
                  stats.completed || 0
                )
          }
          caption={t('common.stat.completedQueuing')}
          icon={CheckCircle2}
        />

        <DashboardStatCard
          label={t('common.stat.staff')}
          value={
            staffLoading
              ? '…'
              : staffLabel
          }
          caption={t('dashboard.stat.staffOnDuty')}
          icon={IdCard}
        />

      <DashboardStatCard
        label="Terminal"
        value={`${stats.terminalStats?.active || 0}/${stats.terminalStats?.total || 0}`}
        caption="Active terminals / total"
        icon={Monitor}
      />
      </div>

      {/* =================================================
          MAIN DASHBOARD GRID
      ================================================= */}

      <div className="grid gap-4 lg:grid-cols-3">

        {/* =================================================
            AI-ASSISTED INSIGHTS
        ================================================= */}

        <section className="rounded-xl border border-[#C3C6D7] bg-white p-5">

          <div className="mb-3 flex items-center gap-2">

            <Sparkles
              size={15}
              className="text-[#9D0A0E]"
            />

            <h2 className="text-lg font-semibold text-[#1F2937]">
              {t('dashboard.aiInsights')}
            </h2>
          </div>

          {!insightsReady && (
            <p className="py-3 text-center text-xs text-slate-400">
              {t('dashboard.analyzing')}
            </p>
          )}

          {insightsReady && (
            <ul className="space-y-2.5">

              {insights.map(
                ({ icon: InsightIcon, message }, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-[#4B5563]"
                  >
                    <InsightIcon
                      size={13}
                      className="mt-0.5 shrink-0 text-[#9D0A0E]/70"
                    />

                    <span>
                      {message}
                    </span>
                  </li>
                )
              )}
            </ul>
          )}
        </section>

        {/* =================================================
            RECENT ALERTS
        ================================================= */}

        <section className="rounded-xl border border-[#C3C6D7] bg-white p-5">

          <div className="mb-3 flex items-center justify-between">

            <h2 className="text-lg font-semibold text-[#1F2937]">
              {t('dashboard.recentAlerts')}
            </h2>

            <MoreHorizontal
              size={15}
              className="text-slate-400"
            />
          </div>

          <div className="space-y-2">

            {loading && (
              <p className="py-6 text-center text-xs text-slate-400">
                {t('dashboard.loadingAlerts')}
              </p>
            )}

            {!loading &&
              notifications.map(
                (alert) => {
                  const tier =
                    alert.type ===
                      'critical' ||
                    alert.type ===
                      'offline' ||
                    alert.type ===
                      'error'
                      ? 'critical'
                      : alert.type ===
                          'system' ||
                        alert.type ===
                          'queue'
                        ? 'info'
                        : 'warning';

                  const Icon =
                    tier === 'critical'
                      ? CircleAlert
                      : tier === 'warning'
                        ? TriangleAlert
                        : Info;

                  const colors =
                    tier === 'critical'
                      ? 'border-[#9D0A0E]/20 bg-[#9D0A0E]/5 text-[#9D0A0E]'
                      : tier === 'warning'
                        ? 'border-amber-200 bg-amber-50 text-amber-600'
                        : 'border-blue-100 bg-blue-50 text-blue-600';

                  return (
                    <div
                      key={
                        alert.id
                      }
                      className={`flex gap-2 rounded-md border px-2.5 py-2 ${colors}`}
                    >
                      <Icon
                        size={13}
                        className="mt-0.5 shrink-0"
                      />

                      <div>
                        <p className="text-xs font-semibold">
                          {alert.title ||
                            t('dashboard.alertFallback')}
                        </p>

                        <p className="mt-0.5 text-xs text-[#4B5563]">
                          {alert.message ||
                            ''}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}

            {!loading &&
              notifications.length ===
                0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  {t('dashboard.noRecentAlerts')}
                </p>
              )}
          </div>
        </section>

        {/* =================================================
            QUEUE STATUS DISTRIBUTION
        ================================================= */}

        <section className="rounded-xl border border-[#C3C6D7] bg-white p-5">

          <h2 className="mb-4 text-sm font-bold text-[#1F2937]">
            {t('dashboard.queueDistribution')}
          </h2>

          <div className="flex items-center justify-center gap-8 py-5">

            <DonutChart
              slices={
                distribution
              }
            />

            <div className="space-y-3 text-sm font-semibold text-[#4B5563]">

              {distribution.map(
                (slice) => (
                  <div
                    key={
                      slice.label
                    }
                    className="flex items-center gap-2"
                  >

                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          slice.color,
                      }}
                    />

                    {t(slice.labelKey)}{' '}
                    (
                    {loading
                      ? '…'
                      : `${
                          distributionTotal > 0
                            ? Math.round((slice.value / distributionTotal) * 100)
                            : 0
                        }%`}
                    )
                  </div>
                )
              )}
            </div>
          </div>

          {!loading &&
            !hasDistributionData && (
              <p className="text-center text-[10px] text-slate-400">
                {t('dashboard.noActivityToday')}
              </p>
            )}
        </section>
      </div>

      {/* =================================================
          TERMINAL DISPATCH LOG
      ================================================= */}

      <section className="mt-4 rounded-xl border border-[#C3C6D7] bg-white p-5">

        <div className="mb-3 flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">
              Terminal Dispatch Log
            </h2>
            <p className="mt-0.5 text-[11px] text-[#4B5563]">
              Recent ticket call actions executed by active terminal counters.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refreshQueue(departmentPrefix)}
            className="flex h-8 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold text-[#4B5563] hover:bg-[#F1F3F5]"
          >
            <RefreshCw size={11} />
            Refresh Log
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-semibold">Time</th>
                <th className="py-2 pr-4 font-semibold">Ticket</th>
                <th className="py-2 pr-4 font-semibold">Category</th>
                <th className="py-2 pr-4 font-semibold">Terminal</th>
                <th className="py-2 pr-4 font-semibold">Staff Operator</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F3F5]">
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[11px] text-slate-400">
                    Loading dispatch log…
                  </td>
                </tr>
              )}

              {!loading && dispatchLog.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[11px] text-slate-400">
                    No terminals are currently dispatching a patient.
                  </td>
                </tr>
              )}

              {!loading &&
                dispatchLog.map((row) => (
                  <tr key={row.key} className="text-[#1F2937]">
                    <td className="py-2.5 pr-4 text-[11px] text-[#4B5563]">
                      {row.time}
                    </td>

                    <td
                      className={`py-2.5 pr-4 text-[11px] font-bold ${
                        row.isPriority ? 'text-[#9D0A0E]' : 'text-[#1F2937]'
                      }`}
                    >
                      {row.ticketNumber}
                    </td>

                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          row.isPriority
                            ? 'bg-[#9D0A0E] text-white'
                            : 'bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        {row.isPriority ? 'Priority' : 'Regular'}
                      </span>
                    </td>

                    <td className="py-2.5 pr-4 text-[11px] text-[#4B5563]">
                      {row.terminalLabel}
                    </td>

                    <td className="py-2.5 pr-4 text-[11px] text-[#4B5563]">
                      {row.operatorName || '—'}
                    </td>

                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#16A34A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                        {row.statusText}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================
          FOOTER STATUS
      ================================================= */}

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">

        <Bell size={12} />

        <span>
          {t('dashboard.footer', { prefix: departmentPrefix })}
        </span>
      </div>

      {/* =================================================
          FIRST-LOGIN SECURITY PIN SETUP
      ================================================= */}

      {showPinSetupModal && (
        <SettingsExactCreatePinModal
          requireVerificationCode={false}
          showStepBadge={false}
          ctaLabel="Set Up PIN"
          saving={pinSetupSaving}
          serverError={pinSetupError}
          onClose={() => setShowPinSetupModal(false)}
          onContinue={handlePinSetupContinue}
        />
      )}

      {showPinSetupSuccess && (
        <SettingsExactPinSuccessModal
          title="Admin PIN Set Successfully"
          message="Your Admin PIN can now be used to authorize protected system actions."
          configuredByLabel={isSuperadmin ? 'Super Admin' : 'Admin'}
          onClose={() => setShowPinSetupSuccess(false)}
        />
      )}
    </div>
  );
}
