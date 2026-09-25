import { useEffect, useState } from 'react';

import { getDashboardAnalytics, getKiosks, getSecurityPinStatus } from "../../services/backendApi";
import SecurityPinModal, { readPinIsSet } from "../../components/SecurityPinModal";
import { auth } from "../../../firebase";

import {
  Building2,
  Users,
  Clock,
  Monitor,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Info,
  RotateCw,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';


const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function DonutChart({ data }) {
  let cumulative = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
      {data.map((slice) => {
        const dash = (slice.pct / 100) * circumference;
        const offset = circumference - (cumulative / 100) * circumference;
        cumulative += slice.pct;

        return (
          <circle
            key={slice.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
          />
        );
      })}
    </svg>
  );
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function isSameDay(first, second) {
  return (
    first &&
    second &&
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isBetweenDates(date, start, end) {
  if (!start || !end) return false;
  const value = startOfDay(date).getTime();
  const first = Math.min(startOfDay(start).getTime(), startOfDay(end).getTime());
  const last = Math.max(startOfDay(start).getTime(), startOfDay(end).getTime());
  return value >= first && value <= last;
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function CalendarPopup({ value, onChange, onClose }) {
  const today = startOfDay(new Date());

  const [visibleMonth, setVisibleMonth] = useState(
    value ? new Date(value.getFullYear(), value.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [rangeStart, setRangeStart] = useState(value || today);
  const [rangeEnd, setRangeEnd] = useState(null);

  const days = getCalendarDays(visibleMonth);

  const moveMonth = (amount) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
  };

  const selectPreset = (preset) => {
    const now = startOfDay(new Date());

    if (preset === 'Today') {
      setRangeStart(now);
      setRangeEnd(null);
      onChange(now);
      return;
    }

    if (preset === 'Yesterday') {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);
      setRangeStart(date);
      setRangeEnd(null);
      onChange(date);
      return;
    }

    if (preset === 'Last week') {
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      setRangeStart(start);
      setRangeEnd(end);
      onChange(start);
      return;
    }

    if (preset === 'Last month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setRangeStart(start);
      setRangeEnd(end);
      onChange(start);
      return;
    }

    if (preset === 'Last quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), currentQuarter * 3 - 3, 1);
      const end = new Date(now.getFullYear(), currentQuarter * 3, 0);
      setRangeStart(start);
      setRangeEnd(end);
      onChange(start);
    }
  };

  const selectDate = (date) => {
    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd(null);
      onChange(date);
      return;
    }

    if (date.getTime() < rangeStart.getTime()) {
      setRangeStart(date);
      setRangeEnd(rangeStart);
      onChange(date);
      return;
    }

    setRangeEnd(date);
    onChange(rangeStart);
  };

  const reset = () => {
    setRangeStart(today);
    setRangeEnd(null);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onChange(today);
  };

  const monthLabel = visibleMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="swu-pop absolute right-0 top-full z-50 mt-2 w-[32rem] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex">

        {/* PRESETS */}

        <div className="flex w-36 shrink-0 flex-col px-5 py-5">
          <div className="space-y-0.5">
            {['Today', 'Yesterday', 'Last week', 'Last month', 'Last quarter'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className="block w-full rounded-md px-1 py-1.5 text-left text-sm text-[#1F2937] transition hover:text-[#9D0A0E]"
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-auto px-1 pt-4 text-left text-sm font-semibold text-[#9D0A0E] hover:underline"
          >
            Reset
          </button>
        </div>

        {/* MONTH GRID */}

        <div className="flex-1 py-5 pr-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-[#1F2937]">{monthLabel}</h3>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
                className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
                className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="pb-2 text-xs font-medium text-[#9CA3AF]"
              >
                {day}
              </div>
            ))}

            {days.map((date) => {
              const currentMonth = date.getMonth() === visibleMonth.getMonth();
              const selectedStart = isSameDay(date, rangeStart);
              const selectedEnd = isSameDay(date, rangeEnd);
              const selected = selectedStart || selectedEnd;
              const inRange = isBetweenDates(date, rangeStart, rangeEnd);
              const isToday = isSameDay(date, today);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              const textColor = selected
                ? 'font-semibold text-white'
                : !currentMonth
                  ? 'text-[#D1D5DB]'
                  : isToday
                    ? 'font-semibold text-[#9D0A0E]'
                    : isWeekend
                      ? 'text-[#9CA3AF]'
                      : 'text-[#1F2937]';

              return (
                <button
                  key={formatDate(date)}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={`relative flex h-9 items-center justify-center text-sm transition ${
                    inRange || selected ? 'bg-[#F6E7E7]' : 'hover:bg-[#F8F9FA]'
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute h-8 w-8 rounded-full bg-[#9D0A0E] ring-4 ring-[#9D0A0E]/15"
                    />
                  )}

                  <span className={`relative z-10 ${textColor}`}>
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DEPARTMENT VOLUME — line chart
   Plain SVG, no chart library. Draws itself in on load.
========================================================= */

function DepartmentVolumeChart({ data }) {
  const points = data.slice(0, 6);

  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[#9CA3AF]">
        No queue volume recorded for the selected period.
      </p>
    );
  }

  const W = 560;
  const H = 210;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 38;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...points.map((d) => Number(d.value) || 0), 1);

  const x = (i) =>
    points.length === 1
      ? padL + innerW / 2
      : padL + (i * innerW) / (points.length - 1);

  const y = (v) => padT + innerH - ((Number(v) || 0) / max) * innerH;

  const line = points
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ');

  const area = `${line} L${x(points.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`;

  const ticks = [0, 0.5, 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-56 w-full"
      role="img"
      aria-label="Queue volume per department"
    >
      <defs>
        <linearGradient id="swuVolumeFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9D0A0E" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#9D0A0E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid + y labels */}
      {ticks.map((t) => {
        const gy = padT + innerH - t * innerH;
        return (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={gy}
              y2={gy}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray={t === 0 ? '0' : '4 4'}
            />
            <text
              x={padL - 8}
              y={gy + 4}
              textAnchor="end"
              className="fill-[#9CA3AF]"
              style={{ fontSize: 10 }}
            >
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}

      <path d={area} fill="url(#swuVolumeFill)" className="swu-enter-fade" />

      <path
        d={line}
        fill="none"
        stroke="#9D0A0E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="swu-draw"
        style={{ '--swu-dash': 1400 }}
      />

      {points.map((d, i) => (
        <g key={d.department_id || d.name} className="swu-enter-fade">
          <circle
            cx={x(i)}
            cy={y(d.value)}
            r="9"
            fill="transparent"
            className="cursor-pointer"
          >
            <title>{`${d.name}: ${d.value}`}</title>
          </circle>

          <circle
            cx={x(i)}
            cy={y(d.value)}
            r="4"
            fill="#FFFFFF"
            stroke="#9D0A0E"
            strokeWidth="2.5"
            className="transition-all duration-150 hover:r-6"
          />

          <text
            x={x(i)}
            y={y(d.value) - 12}
            textAnchor="middle"
            className="fill-[#1F2937] font-semibold"
            style={{ fontSize: 10 }}
          >
            {d.value}
          </text>

          <text
            x={x(i)}
            y={H - 14}
            textAnchor="middle"
            className="fill-[#4B5563]"
            style={{ fontSize: 10 }}
          >
            {String(d.name).length > 11
              ? `${String(d.name).slice(0, 10)}\u2026`
              : d.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Dashboard() {
  const [departments, setDepartments] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [analytics, setAnalytics] = useState(null);

const [resetDepartmentIds, setResetDepartmentIds] = useState(() => {
  try {
    const stored = localStorage.getItem('swu_reset_departments');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Client-side filter for the Department Overview table.
  const [departmentSearch, setDepartmentSearch] = useState('');

  // First-run prompt: shown only when the server says no PIN exists yet.
  const [showPinSetup, setShowPinSetup] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);

  const todayDate = startOfDay(new Date());

  const [selectedStartDate, setSelectedStartDate] = useState(todayDate);
  const [selectedEndDate, setSelectedEndDate] = useState(null);

  const [appliedStartDate, setAppliedStartDate] = useState(todayDate);
  const [appliedEndDate, setAppliedEndDate] = useState(null);

  const [firebaseUser, setFirebaseUser] = useState(null);

async function fetchDashboardData(
  startDate = appliedStartDate,
  endDate = appliedEndDate
) {
  try {
    setLoading(true);
    setError(null);

    const user = auth.currentUser;

    if (!user) {
      throw new Error("You must be signed in to load the dashboard.");
    }

    setFirebaseUser(user);

    const start = formatDate(startDate);
    const end = formatDate(endDate || startDate);

    const data = await getDashboardAnalytics(
      user,
      start,
      end
    );

    setAnalytics(data);

    /*
     * Department Overview still needs the department records themselves.
     * The dashboard analytics endpoint supplies aggregate information,
     * while the existing department endpoint supplies the table data.
     */
    const token = await user.getIdToken();

    const departmentResponse = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/departments`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const departmentResult = await departmentResponse.json();

    if (!departmentResponse.ok) {
      throw new Error(
        departmentResult.message ||
          "Failed to load departments."
      );
    }

    const departmentData =
      departmentResult.data || departmentResult;

    setDepartments(
      Array.isArray(departmentData)
        ? departmentData
        : []
    );

const kioskData = await getKiosks();

setKiosks(
  Array.isArray(kioskData)
    ? kioskData
    : []
);

  } catch (err) {
    console.error("Dashboard loading error:", err);
    setError(
      err.message || "Failed to load dashboard data."
    );
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  fetchDashboardData();
}, []);

  // Security PIN first-run check. Runs on its own so a missing or failing
  // PIN endpoint never blocks the dashboard. Signed-out: skipped silently.
  useEffect(() => {
    let cancelled = false;

    async function checkSecurityPin() {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const status = await getSecurityPinStatus(user);
        if (!cancelled && !readPinIsSet(status)) {
          setShowPinSetup(true);
        }
      } catch (pinError) {
        console.warn('Security PIN status unavailable:', pinError?.message);
      }
    }

    checkSecurityPin();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => setCalendarOpen(false);

    if (calendarOpen) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => document.removeEventListener('click', handleOutsideClick);
  }, [calendarOpen]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });


  const queueStats = analytics?.queue || {
    waiting: 0,
    averageWaitMinutes: 0,
    skipped: 0,
    completed: 0,
  };

  const terminalStats = analytics?.terminals || {
    active: 0,
    total: 0,
  };

  const resetDepartmentIdSet = new Set(
    resetDepartmentIds.map((id) => String(id))
  );

  const visibleDepartmentCount = departments.filter(
    (department) =>
      !resetDepartmentIdSet.has(
        String(department.department_id)
      )
  ).length;

  const STATS = [
    {
      label: 'Departments',
      value: `${visibleDepartmentCount}/${departments.length}`,
      caption: 'Active departments',
      icon: Building2,
    },
    {
      label: 'Total Waiting',
      value: String(queueStats.waiting),
      caption: 'Across all departments',
      icon: Users,
    },
    {
      label: 'Average Wait',
      value: `${queueStats.averageWaitMinutes}m`,
      caption: 'Average wait time',
      icon: Clock,
    },
    {
      label: 'Skipped',
      value: String(queueStats.skipped),
      caption: 'Skipped queuing',
      icon: RotateCw,
    },
    {
      label: 'Completed',
      value: String(queueStats.completed),
      caption: 'Completed queuing',
      icon: TrendingUp,
    },
    {
      label: 'Terminals',
      value: `${terminalStats.active}/${terminalStats.total}`,
      caption: 'Active terminals',
      icon: Monitor,
    },
  ];

  const departmentVolume = analytics?.departmentVolume || [];

  const queueDistribution = analytics?.queueDistribution || [
    {
      label: 'Serving',
      value: 0,
      pct: 0,
      color: '#1F2937',
    },
    {
      label: 'Waiting',
      value: 0,
      pct: 0,
      color: '#4B5563',
    },
    {
      label: 'Completed',
      value: 0,
      pct: 0,
      color: '#B34C4C',
    },
  ];

  const insights = analytics?.insights || [];

  const calendarLabel = selectedEndDate
    ? `${selectedStartDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} - ${selectedEndDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    : isSameDay(selectedStartDate, new Date())
      ? 'Today'
      : selectedStartDate.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
return (
  <div>
    {/* Header */}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-[#1F2937]">
          System Overview
        </h1>
        <p className="text-sm text-[#4B5563]">
          Today &middot; {today}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Date Filter */}
        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCalendarOpen((open) => !open);
            }}
            className="flex min-w-32 items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] focus:outline-none"
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
          >
            <span className="flex items-center gap-2">
              <CalendarDays
                size={14}
                className="text-[#4B5563]"
              />
              {calendarLabel}
            </span>

            <ChevronDown
              size={13}
              className="text-[#4B5563]"
            />
          </button>

          {calendarOpen && (
            <CalendarPopup
              value={selectedStartDate}
              onChange={(date) => {
                setSelectedStartDate(date);
              }}
              onClose={() => setCalendarOpen(false)}
            />
          )}
        </div>

        {/* Apply Filter */}
        <button
          type="button"
          onClick={() => {
            setAppliedStartDate(selectedStartDate);
            setAppliedEndDate(selectedEndDate);

            fetchDashboardData(
              selectedStartDate,
              selectedEndDate
            );

            setCalendarOpen(false);
          }}
          className="swu-press rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#7D080B] hover:shadow-md"
        >
          Apply Filter
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={() =>
            fetchDashboardData(
              appliedStartDate,
              appliedEndDate
            )
          }
          className="swu-press flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#4B5563] shadow-sm transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
        >
          <RotateCw size={12} />
          Refresh
        </button>
      </div>
    </div>

  {/* Statistics */}
<div className="swu-stagger mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6">
  {STATS.map((stat) => {
    const Icon = stat.icon;

    return (
      <div
        key={stat.label}
        className="swu-card min-w-0 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
            {stat.label}
          </p>

          <Icon
            size={16}
            className="text-[#9D0A0E]"
          />
        </div>

        <p className="text-2xl font-bold text-[#1F2937]">
          {stat.value}
        </p>

        <p className="mt-1 text-xs uppercase tracking-wide text-[#4B5563]">
          {stat.caption}
        </p>
      </div>
    );
  })}
</div>

    {/* Dashboard Charts / Insights */}
    <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">

      {/* AI-Assisted Insights */}
      <div className="swu-card rounded-xl border border-[#F0DADA] bg-[#FBF1F1] p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles
            size={16}
            className="text-[#9D0A0E]"
          />

          <h2 className="text-sm font-bold text-[#1F2937]">
            AI-Assisted Insights
          </h2>
        </div>

        <div className="my-4 border-t border-[#EBD5D5]" />

        <div className="space-y-4">
          {insights.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">
              No insights available for the selected period.
            </p>
          ) : (
            insights.map((insight, i) => {
              const Icon =
                insight.icon === "trending"
                  ? TrendingUp
                  : insight.icon === "alert"
                    ? AlertTriangle
                    : Info;

              return (
                <div
                  key={`${insight.type}-${i}`}
                  className="flex gap-2.5 text-sm text-[#4B5563]"
                >
                  <Icon
                    size={16}
                    className="mt-0.5 shrink-0 text-[#9CA3AF]"
                  />

                  <p>{insight.text}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Department Volume */}
      <div className="swu-card rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-[#1F2937]">
          Department Volume
        </h2>
        <p className="mb-3 text-xs text-[#9CA3AF]">
          Waiting patients per department
        </p>

        <DepartmentVolumeChart data={departmentVolume} />
      </div>

      {/* Queue Status Distribution */}
      <div className="swu-card rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-[#1F2937]">
          Queue Status Distribution
        </h2>

      <div className="flex items-center gap-6">
  <DonutChart data={queueDistribution} />

  <div className="space-y-2 text-xs">
    {queueDistribution.map((slice) => (
      <div
        key={slice.label}
        className="flex items-center gap-2"
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: slice.color,
          }}
        />

        <span className="text-[#4B5563]">
          {slice.label} ({slice.pct}%)
        </span>
      </div>
    ))}
  </div>
</div>
</div>
</div>

    {/* Department Overview */}
    <div className="swu-enter overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
        <h2 className="shrink-0 text-sm font-semibold text-[#1F2937]">
          Department Overview
        </h2>

        <div className="relative w-full max-w-xs">
          <input
            type="text"
            value={departmentSearch}
            onChange={(event) =>
              setDepartmentSearch(event.target.value)
            }
            placeholder="Search department"
            aria-label="Search department"
            className="w-full rounded-full border border-[#E5E7EB] bg-[#F8F9FA] py-2 pl-4 pr-10 text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
          />

          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4B5563]"
          />
        </div>
      </div>

      {error && (
        <div className="mx-5 my-3 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-2 text-xs text-[#9D0A0E]">
          {error}
        </div>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#FBF1F1] text-xs uppercase tracking-wide text-[#4B5563]">
            <th className="px-5 py-2.5 font-medium">
              Department
            </th>

            <th className="px-5 py-2.5 font-medium">
              Kiosk
            </th>

            <th className="px-5 py-2.5 font-medium">
              Prefix
            </th>

            <th className="px-5 py-2.5 font-medium">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={4}
                className="px-5 py-8 text-center text-sm text-[#9CA3AF]"
              >
                Loading departments...
              </td>
            </tr>
          )}

          {!loading &&
            departments.length === 0 &&
            !error && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-sm text-[#9CA3AF]"
                >
                  No departments yet.
                </td>
              </tr>
            )}

          {!loading &&
            departments
              .filter((dept) => {
                const query = departmentSearch.trim().toLowerCase();

                if (!query) return true;

                const kioskName =
                  kiosks.find(
                    (kiosk) =>
                      String(kiosk.kiosk_id) === String(dept.kiosk_id)
                  )?.name || '';

                return [dept.name, dept.prefix, kioskName]
                  .some((value) =>
                    String(value || '').toLowerCase().includes(query)
                  );
              })
              .map((dept) => (
              <tr
                key={dept.department_id}
                className="border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA]"
              >
                <td className="px-5 py-3 font-medium text-[#1F2937]">
                  {dept.name}
                </td>

                <td className="px-5 py-3 text-[#4B5563]">
              {kiosks.find(
                (kiosk) =>
                  String(kiosk.kiosk_id) ===
                  String(dept.kiosk_id)
              )?.name || "--"}
            </td>

                <td className="px-5 py-3 text-[#4B5563]">
                  {dept.prefix}
                </td>

                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      dept.status === "active"
                        ? "text-emerald-600"
                        : "text-[#9CA3AF]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        dept.status === "active"
                          ? "bg-emerald-500"
                          : "bg-[#9CA3AF]"
                      }`}
                    />

                    {dept.status === "active"
                      ? "Active"
                      : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>

    {showPinSetup && (
      <SecurityPinModal
        mode="setup"
        onClose={() => setShowPinSetup(false)}
        onSuccess={() => setShowPinSetup(false)}
      />
    )}
  </div>
);
}