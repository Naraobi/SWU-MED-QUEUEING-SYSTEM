import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  CircleAlert,
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
} from '../../services/backendApi';

import { useAuth } from '../../services/Authcontext';

import { DateRangePicker, StatCard } from './shared';

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

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, langCode } = useLanguage();

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

  // ===================================================
  // LOAD QUEUE + NOTIFICATIONS
  // ===================================================

  async function loadDashboard() {
    setError(null);

    try {
      const {
        start,
        end,
      } = dateRangeRef.current;

      const [
        state,
        notifs,
      ] = await Promise.all([
        fetchQueueState(
          departmentPrefix,
          {
            start: toDateKey(start),
            end: toDateKey(end),
          }
        ),

        fetchNotifications(
          departmentPrefix
        ),
      ]);

      setQueueState(
        state || {
          waitingQueue: [],
          currentlyServing: null,
          stats: {
            waiting: 0,
            completed: 0,
            skipped: 0,
          },
        }
      );

      setNotifications(
        notifs || []
      );
    } catch (err) {
      console.error(
        'Dashboard data fetch failed:',
        err
      );

      setError(
        err.message ||
          'Failed to load dashboard data.'
      );
    } finally {
      setLoading(false);
    }
  }

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
  //

  async function loadStaffCount() {
    setStaffLoading(true);

    try {
      const [users, departments] =
        await Promise.all([
          getUsers(),
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
    } catch (err) {
      console.error(
        'Staff count fetch failed:',
        err
      );

      setStaffLabel('--');
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
    } catch (err) {
      console.error(
        'Terminal count fetch failed:',
        err
      );

      setTerminalLabel('--');
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
      ]);

      if (cancelled) {
        return;
      }
    }

    load();

    // Refresh live queue data every 15 seconds.
    const poll =
      setInterval(
        loadDashboard,
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
          <h1 className="text-2xl font-bold text-[#1F2937]">
            {t('dashboard.title')}
          </h1>

          <p className="mt-0.5 text-xs text-[#4B5563]">
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
            className="flex h-9 items-center gap-2 rounded-md bg-[#9D0A0E] px-4 text-xs font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-70"
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
            className="flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-4 text-xs font-semibold text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-70"
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">

        <StatCard
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

        <StatCard
          label={t('common.stat.averageWait')}
          value="18m"
          caption={t('dashboard.stat.averageWaitTime')}
          icon={Timer}
        />

        <StatCard
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

        <StatCard
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

        <StatCard
          label={t('common.stat.staff')}
          value={
            staffLoading
              ? '…'
              : staffLabel
          }
          caption={t('dashboard.stat.staffOnDuty')}
          icon={IdCard}
        />

        <StatCard
          label={t('common.stat.terminal')}
          value={
            terminalLoading
              ? '…'
              : terminalLabel
          }
          caption={t('common.stat.activeTerminals')}
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

        <section className="rounded-lg border border-[#E5E7EB] bg-[#B34C4C]/10 p-4 shadow-sm">

          <div className="mb-3 flex items-center gap-2">

            <Sparkles
              size={15}
              className="text-[#9D0A0E]"
            />

            <h2 className="text-sm font-bold text-[#1F2937]">
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
                    className="flex items-start gap-2 text-[11px] text-[#4B5563]"
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

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">

          <div className="mb-3 flex items-center justify-between">

            <h2 className="text-sm font-bold text-[#1F2937]">
              {t('dashboard.recentAlerts')}
            </h2>

            <MoreHorizontal
              size={15}
              className="text-slate-400"
            />
          </div>

          <div className="space-y-2">

            {loading && (
              <p className="py-4 text-center text-xs text-slate-400">
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
                        <p className="text-[10px] font-bold">
                          {alert.title ||
                            t('dashboard.alertFallback')}
                        </p>

                        <p className="mt-0.5 text-[9px] text-[#4B5563]">
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
                <p className="py-4 text-center text-xs text-slate-400">
                  {t('dashboard.noRecentAlerts')}
                </p>
              )}
          </div>
        </section>

        {/* =================================================
            QUEUE STATUS DISTRIBUTION
        ================================================= */}

        <section className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">

          <h2 className="mb-4 text-sm font-bold text-[#1F2937]">
            {t('dashboard.queueDistribution')}
          </h2>

          <div className="flex items-center justify-center gap-5 py-3">

            <DonutChart
              slices={
                distribution
              }
            />

            <div className="space-y-3 text-[11px] font-semibold text-[#4B5563]">

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
          FOOTER STATUS
      ================================================= */}

      <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400">

        <Bell size={12} />

        <span>
          {t('dashboard.footer', { prefix: departmentPrefix })}
        </span>
      </div>
    </div>
  );
}