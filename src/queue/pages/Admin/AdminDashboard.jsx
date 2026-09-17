import React, { useEffect, useMemo, useState } from "react";
import { auth } from "../../../firebase";

import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Info,
  Monitor,
  Phone,
  RefreshCw,
  Users,
} from 'lucide-react';

import {
  fetchNotifications,
  fetchQueueState,
} from '../../services/api';

import {
  getUsers,
  getDashboardAnalytics,
} from "../../services/backendApi";

import { useAuth } from '../../services/Authcontext';

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
          stroke="#e2e8f0"
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
// STAT CARD
// =====================================================

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </p>

        <Icon
          size={16}
          className="text-slate-500"
        />
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-800">
        {value}
      </p>

      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {caption}
      </p>
    </div>
  );
}

// =====================================================
// ADMIN DASHBOARD
// =====================================================

export default function AdminDashboard() {
  const { user } = useAuth();

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

  const [range, setRange] =
    useState('Today');

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

    const today = new Date().toISOString().slice(0, 10);

    let startDate = today;
    let endDate = today;

    if (range === "This Week") {
      const date = new Date();
      const day = date.getDay();
      const diff = day === 0 ? 6 : day - 1;

      const monday = new Date(date);
      monday.setDate(date.getDate() - diff);

      startDate = monday.toISOString().slice(0, 10);
      endDate = today;
    }

    if (range === "This Month") {
      const date = new Date();

      startDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      )
        .toISOString()
        .slice(0, 10);

      endDate = today;
    }

    const firebaseUser = auth.currentUser;

if (!firebaseUser) {
  throw new Error("Firebase authentication session is not available.");
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
        averageWait: analytics?.queue?.averageWaitMinutes ?? 0,
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
    console.error("Admin dashboard load error:", err);
    setError(
      err?.message || "Failed to load dashboard data."
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
  //

  async function loadStaffCount() {
  setStaffLoading(true);
  try {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      throw new Error(
        "Firebase authentication session is not available."
      );
    }

    const users =
      await getUsers(firebaseUser);

      const userList =
        Array.isArray(users)
          ? users
          : [];

      // -----------------------------------------------
      // Superadmin
      // -----------------------------------------------
      //
      // Superadmin can see the whole system.
      //
      // -----------------------------------------------

      let visibleUsers =
        userList;

      // -----------------------------------------------
      // Department Admin
      // -----------------------------------------------
      //
      // Admin should only count users belonging to
      // their assigned department.
      //
      // -----------------------------------------------

      if (
        !isSuperadmin &&
        currentDepartmentId
      ) {
        visibleUsers =
          userList.filter(
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
  // INITIAL LOAD + POLLING
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      await Promise.all([
        loadDashboard(),
        loadStaffCount(),
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
  range,
  user,
]);

  // ===================================================
  // MANUAL REFRESH
  // ===================================================

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await Promise.all([
        loadDashboard(),
        loadStaffCount(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // QUEUE DATA
  // ===================================================

  const waitingQueue =
    queueState?.waitingQueue || [];

  const currentlyServing =
    queueState?.currentlyServing ||
    null;

  const stats =
    queueState?.stats || {
      waiting: 0,
      completed: 0,
      skipped: 0,
    };

  // ===================================================
  // QUEUE DISTRIBUTION
  // ===================================================

  const distribution = [
    {
      label: 'Waiting',
      value: Number(
        stats.waiting || 0
      ),
      color: '#68717a',
    },

    {
      label: 'Completed',
      value: Number(
        stats.completed || 0
      ),
      color: '#0765a8',
    },

    {
      label: 'Skipped',
      value: Number(
        stats.skipped || 0
      ),
      color: '#172333',
    },
  ];

  const hasDistributionData =
    distribution.some(
      (slice) =>
        slice.value > 0
    );

  // ===================================================
  // CURRENT DATE
  // ===================================================

  const currentDate =
    new Date().toLocaleDateString(
      undefined,
      {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }
    );

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
          <h1 className="text-2xl font-bold text-slate-800">
            System Overview
          </h1>

          <p className="mt-0.5 text-xs text-slate-500">
            Today &middot; {currentDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {/* RANGE */}

          <label className="relative">
            <CalendarDays
              size={14}
              className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500"
            />

            <select
              value={range}
              onChange={(event) =>
                setRange(
                  event.target.value
                )
              }
              className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs text-slate-600 outline-none focus:border-blue-500"
            >
              <option>
                Today
              </option>

              <option>
                This Week
              </option>

              <option>
                This Month
              </option>
            </select>

            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2.5 top-3 text-slate-400"
            />
          </label>

          {/* DATE */}

          <input
            type="date"
            className="h-9 rounded-md border border-slate-200 px-2 text-xs text-slate-600 outline-none focus:border-blue-500"
            aria-label="Date range"
          />

          {/* REFRESH */}

          <button
            type="button"
            onClick={
              handleRefresh
            }
            disabled={refreshing}
            className="flex h-9 items-center gap-2 rounded-md bg-[#075b9f] px-4 text-xs font-semibold text-white hover:bg-[#064b83] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw
              size={13}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button>
        </div>
      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* =================================================
          STAT CARDS
      ================================================= */}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">

        <StatCard
          label="Total Waiting"
          value={
            loading
              ? '…'
              : String(
                  stats.waiting || 0
                )
          }
          caption="Across all departments"
          icon={Users}
        />

              <StatCard
          label="Average Wait"
          value={`${stats.averageWait || 0}m`}
          caption="Average patient wait"
          icon={Clock3}
        />

        <StatCard
          label="Completed"
          value={
            loading
              ? '…'
              : String(
                  stats.completed || 0
                )
          }
          caption="Completed queuing"
          icon={CheckCircle2}
        />

        <StatCard
          label="Skipped"
          value={
            loading
              ? '…'
              : String(
                  stats.skipped || 0
                )
          }
          caption="Skipped queuing"
          icon={RefreshCw}
        />

        <StatCard
          label="Staff"
          value={
            staffLoading
              ? '…'
              : staffLabel
          }
          caption="Active staff / total"
          icon={Users}
        />

      <StatCard
        label="Terminal"
        value={`${stats.terminalStats?.active || 0}/${stats.terminalStats?.total || 0}`}
        caption="Active terminals / total"
        icon={Monitor}
      />
      </div>

      {/* =================================================
          MAIN DASHBOARD GRID
      ================================================= */}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">

        {/* =================================================
            LIVE QUEUE SNAPSHOT
        ================================================= */}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

          <div className="mb-3 flex items-center justify-between">

            <h2 className="text-sm font-bold text-slate-700">
              Live Queue Snapshot
            </h2>

            <span className="rounded bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
              {loading
                ? '…'
                : `${waitingQueue.length} waiting`}
            </span>
          </div>

          {/* CURRENTLY SERVING */}

          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-3">

            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Currently Serving
            </p>

            <p className="mt-1 text-xl font-extrabold text-[#075b9f]">
              {loading
                ? '…'
                : currentlyServing?.id ??
                  '--'}
            </p>

            <p className="mt-0.5 text-[10px] text-slate-500">

              {currentlyServing
                ? `${currentlyServing.service || 'Service'} · Terminal ${
                    currentlyServing.terminal ??
                    '--'
                  }`
                : 'No patient currently being served'}

            </p>
          </div>

          {/* WAITING QUEUE */}

          <div className="mt-3 space-y-1.5">

            {loading && (
              <p className="py-3 text-center text-xs text-slate-400">
                Loading queue…
              </p>
            )}

            {!loading &&
              waitingQueue
                .slice(0, 4)
                .map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={
                        row.uniqueKey ||
                        row.id ||
                        index
                      }
                      className="flex items-center justify-between rounded-md border border-slate-100 px-2.5 py-2"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">

                        <Phone
                          size={11}
                          className="text-slate-400"
                        />

                        {row.id ||
                          '--'}
                      </span>

                      <span className="text-[10px] text-slate-500">
                        ~
                        {row.etaMinutes ??
                          '--'}{' '}
                        min (
                        {index + 1}{' '}
                        ahead)
                      </span>
                    </div>
                  )
                )}

            {!loading &&
              waitingQueue.length ===
                0 && (
                <p className="py-3 text-center text-xs text-slate-400">
                  Queue is empty.
                </p>
              )}
          </div>

          {/* TERMINALS */}

          <p className="mt-3 text-[9px] text-slate-400">
            Per-terminal assignment view
            needs a terminals table.
          </p>
        </section>

        {/* =================================================
            QUEUE STATUS DISTRIBUTION
        ================================================= */}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

          <h2 className="mb-4 text-sm font-bold text-slate-700">
            Queue Status Distribution
          </h2>

          <div className="flex items-center justify-center gap-5 py-3">

            <DonutChart
              slices={
                distribution
              }
            />

            <div className="space-y-3 text-[11px] font-semibold text-slate-600">

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

                    {slice.label}{' '}
                    (
                    {loading
                      ? '…'
                      : slice.value}
                    )
                  </div>
                )
              )}
            </div>
          </div>

          {!loading &&
            !hasDistributionData && (
              <p className="text-center text-[10px] text-slate-400">
                No queue activity recorded
                yet today.
              </p>
            )}
        </section>

        {/* =================================================
            RECENT ALERTS
        ================================================= */}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

          <div className="mb-3 flex items-center justify-between">

            <h2 className="text-sm font-bold text-slate-700">
              Recent Alerts
            </h2>
          </div>

          <div className="space-y-2">

            {loading && (
              <p className="py-4 text-center text-xs text-slate-400">
                Loading alerts…
              </p>
            )}

            {!loading &&
              notifications.map(
                (alert) => {
                  const type =
                    alert.type ===
                      'system' ||
                    alert.type ===
                      'performance'
                      ? 'info'
                      : 'warning';

                  const Icon =
                    type ===
                    'warning'
                      ? CircleAlert
                      : Info;

                  const colors =
                    type ===
                    'warning'
                      ? 'border-amber-100 bg-amber-50 text-amber-600'
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
                            'Alert'}
                        </p>

                        <p className="mt-0.5 text-[9px] text-slate-500">
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
                  No recent alerts.
                </p>
              )}
          </div>
        </section>
      </div>

      {/* =================================================
          FOOTER STATUS
      ================================================= */}

      <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400">

        <Bell size={12} />

        <span>
          Live data for the{' '}
          <strong>
            {departmentPrefix}
          </strong>{' '}
          department · refreshes
          automatically every 15s.
        </span>
      </div>
    </div>
  );
}