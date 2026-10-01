import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getDashboardAnalytics,
  getKiosks,
  getTerminals,
  getSecurityPinStatus,
} from '../../services/backendApi';
import SecurityPinModal, { readPinIsSet } from '../../components/SecurityPinModal';
import { auth } from '../../../firebase';

import {
  Building2,
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
  Download,
  SkipForward,
  CheckCircle2,
  Filter,
  X,
} from 'lucide-react';

/*
 * =============================================================================
 * SWUMed Dashboard / Analytics
 * =============================================================================
 *
 * WHERE THE DATA COMES FROM
 *
 * Every panel below - the queue monitor, the department and terminal table,
 * both line graphs, the staff list and the Excel export - is computed from ONE
 * list of queue rows for the selected period. That is deliberate. Rather than
 * asking the backend for six different aggregates that each have to agree with
 * the others, this screen asks for the raw rows once and does the arithmetic
 * here, so every number on the page is guaranteed to come from the same data.
 *
 * FOR THE BACKEND TEAM: the dashboard analytics response needs one more field,
 * an array of the queue rows inside the requested range:
 *
 *   GET /api/analytics/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD
 *   {
 *     queue:     { waiting, completed, skipped, averageWaitMinutes },  // already sent
 *     terminals: { active, total },                                   // already sent
 *     insights:  [ ... ],                                             // already sent
 *     queues:    [                                                    // NEEDED
 *       {
 *         queue_number:  'L-014',
 *         department:    'Laboratory',
 *         department_id: '...',
 *         counter_id:    '...',
 *         counter_number: 2,
 *         status:        'completed' | 'skipped' | 'waiting' | 'serving',
 *         issued_at:     ISO timestamp,
 *         called_at:     ISO timestamp | null,
 *         completed_at:  ISO timestamp | null,
 *         staff_id:      '...',
 *         staff_name:    'Juan Dela Cruz'
 *       }
 *     ]
 *   }
 *
 * Field aliases are tolerated (queueNumber/queue_number, counter_number/
 * terminal, service_ended_at/completed_at and so on) so this screen keeps
 * working whichever naming the endpoint settles on. Serving time is derived
 * from called_at -> completed_at when `serving_seconds` is not sent.
 *
 * Until that array arrives, the statistic cards still read from the aggregates
 * that the endpoint already returns, and each panel that needs the rows shows
 * an empty state naming what it is waiting for rather than inventing numbers.
 * =============================================================================
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/*
 * Eight hues that stay apart from each other for anyone who reads colour
 * normally AND for the common forms of colour blindness: they differ in
 * lightness as well as hue, so the lines are still tellable apart in
 * greyscale or on a projector.
 */
const SERIES_COLORS = [
  '#9D0A0E',
  '#1E5FA8',
  '#0D8A4E',
  '#C2410C',
  '#6D28D9',
  '#0E7490',
  '#A16207',
  '#BE185D',
];

const STATUS_SERIES = [
  { key: 'served', label: 'Served', color: '#0D8A4E' },
  { key: 'skipped', label: 'Skipped', color: '#9D0A0E' },
  { key: 'waiting', label: 'Waiting', color: '#1E5FA8' },
];

/* =========================================================
   DATES
========================================================= */

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Built by hand rather than with toISOString(), which shifts the date back
  // a day for anyone east of UTC - and Manila is UTC+8.
  return `${year}-${month}-${day}`;
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

function daysBetween(start, end) {
  return Math.round(
    (startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000
  );
}

/* =========================================================
   QUEUE ROWS
========================================================= */

const SERVED_STATUSES = new Set(['completed', 'served', 'done', 'finished']);
const SKIPPED_STATUSES = new Set(['skipped', 'cancelled', 'canceled', 'missed', 'no-show']);
const WAITING_STATUSES = new Set(['waiting', 'pending', 'queued']);

function normalizeStatus(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (SERVED_STATUSES.has(raw)) return 'served';
  if (SKIPPED_STATUSES.has(raw)) return 'skipped';
  if (WAITING_STATUSES.has(raw)) return 'waiting';
  if (raw === 'serving' || raw === 'in-progress') return 'serving';

  return raw || 'unknown';
}

function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function normalizeQueueRow(row, index) {
  const number =
    row.queue_number ?? row.queueNumber ?? row.ticket ?? row.id ?? '';

  const departmentName =
    typeof row.department === 'object'
      ? row.department?.name ?? ''
      : row.department ?? row.department_name ?? '';

  const terminal =
    row.counter_number ?? row.terminal ?? row.counterNumber ?? '';

  const calledAt = toTime(row.called_at ?? row.calledAt);

  const completedAt = toTime(
    row.completed_at ?? row.completedAt ?? row.service_ended_at
  );

  // Prefer what the backend measured; fall back to the two timestamps.
  const reported = Number(row.serving_seconds ?? row.servingSeconds);

  const servingSeconds = Number.isFinite(reported) && reported > 0
    ? reported
    : calledAt && completedAt && completedAt > calledAt
      ? Math.round((completedAt - calledAt) / 1000)
      : null;

  return {
    key: row.queue_id ?? row.queueId ?? `${number}-${index}`,
    number: String(number),
    departmentId: String(row.department_id ?? row.departmentId ?? ''),
    department: departmentName || 'Unassigned',
    counterId: String(row.counter_id ?? row.counterId ?? ''),
    terminal: terminal === '' || terminal === null ? '' : String(terminal),
    status: normalizeStatus(row.status),
    issuedAt: toTime(row.issued_at ?? row.issuedAt ?? row.created_at),
    calledAt,
    completedAt,
    staffId: String(row.staff_id ?? row.staffId ?? ''),
    staff:
      (typeof row.staff === 'object' ? row.staff?.name : row.staff) ??
      row.staff_name ??
      row.staffName ??
      '',
    servingSeconds,
  };
}

function readQueueRows(analytics) {
  const raw =
    analytics?.queues ??
    analytics?.queueLog ??
    analytics?.queueRows ??
    analytics?.rows ??
    null;

  if (!Array.isArray(raw)) return null;

  return raw.map(normalizeQueueRow);
}

function averageSeconds(rows) {
  const values = rows
    .map((row) => row.servingSeconds)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return null;

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes === 0) return `${rest}s`;
  if (rest === 0) return `${minutes}m`;

  return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

function formatClock(time) {
  if (!time) return '--';

  return new Date(time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* =========================================================
   BUCKETING FOR THE TIME SERIES
========================================================= */

/*
 * One day of data reads best by the hour, a few weeks by the day, and a long
 * stretch by the month. Picking the bucket from the span keeps the x-axis from
 * turning into a hundred unreadable ticks.
 */
function buildBuckets(start, end) {
  const span = Math.abs(daysBetween(start, end));

  if (span === 0) {
    return {
      unit: 'hour',
      keys: Array.from({ length: 24 }, (_, hour) => String(hour)),
      labels: Array.from({ length: 24 }, (_, hour) =>
        hour % 3 === 0 ? `${((hour + 11) % 12) + 1}${hour < 12 ? 'a' : 'p'}` : ''
      ),
      keyOf: (time) => String(new Date(time).getHours()),
    };
  }

  if (span <= 62) {
    const keys = [];
    const labels = [];
    const step = span <= 14 ? 1 : span <= 31 ? 3 : 6;

    for (let index = 0; index <= span; index += 1) {
      const date = new Date(startOfDay(start));
      date.setDate(date.getDate() + index);

      keys.push(formatDate(date));
      labels.push(
        index % step === 0
          ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : ''
      );
    }

    return {
      unit: 'day',
      keys,
      labels,
      keyOf: (time) => formatDate(new Date(time)),
    };
  }

  const keys = [];
  const labels = [];

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    labels.push(
      `${MONTH_NAMES[cursor.getMonth()].slice(0, 3)} ${String(cursor.getFullYear()).slice(2)}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    unit: 'month',
    keys,
    labels,
    keyOf: (time) => {
      const date = new Date(time);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },
  };
}

/* =========================================================
   LINE CHART - plain SVG, several series, shared axes
========================================================= */

function MultiLineChart({
  series,
  labels,
  height = 230,
  valueLabel = 'queues',
  emptyMessage = 'Nothing to chart for this period.',
}) {
  const visible = series.filter((line) => line.values.some((value) => value > 0));

  if (labels.length === 0 || visible.length === 0) {
    return (
      <p className="py-12 text-center text-xs text-[#9CA3AF]">{emptyMessage}</p>
    );
  }

  const W = 620;
  const H = height;
  const padL = 38;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(
    ...visible.flatMap((line) => line.values.map((value) => Number(value) || 0)),
    1
  );

  const x = (index) =>
    labels.length === 1
      ? padL + innerW / 2
      : padL + (index * innerW) / (labels.length - 1);

  const y = (value) => padT + innerH - ((Number(value) || 0) / max) * innerH;

  const ticks = [0, 0.5, 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        role="img"
        aria-label={series.map((line) => line.name).join(', ')}
      >
        {/* grid + y labels */}
        {ticks.map((tick) => {
          const gy = padT + innerH - tick * innerH;

          return (
            <g key={tick}>
              <line
                x1={padL}
                x2={W - padR}
                y1={gy}
                y2={gy}
                stroke="#E5E7EB"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? '0' : '4 4'}
              />
              <text
                x={padL - 8}
                y={gy + 4}
                textAnchor="end"
                className="fill-[#9CA3AF]"
                style={{ fontSize: 10 }}
              >
                {Math.round(max * tick)}
              </text>
            </g>
          );
        })}

        {/* x labels */}
        {labels.map((label, index) =>
          label ? (
            <text
              key={`${label}-${index}`}
              x={x(index)}
              y={H - 12}
              textAnchor="middle"
              className="fill-[#4B5563]"
              style={{ fontSize: 10 }}
            >
              {/* department names can be long; the full name is in the tooltip */}
              {label.length > 11 ? `${label.slice(0, 10)}\u2026` : label}
            </text>
          ) : null
        )}

        {visible.map((line) => {
          const path = line.values
            .map(
              (value, index) =>
                `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`
            )
            .join(' ');

          return (
            <g key={line.name}>
              <path
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="swu-draw"
                style={{ '--swu-dash': 1600 }}
              />

              {line.values.map((value, index) => (
                <circle
                  key={index}
                  cx={x(index)}
                  cy={y(value)}
                  r={labels.length > 20 ? 2.5 : 4}
                  fill="#FFFFFF"
                  stroke={line.color}
                  strokeWidth="2.5"
                >
                  <title>{`${line.name} - ${labels[index] || index + 1}: ${value} ${valueLabel}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      {visible.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#E5E7EB] pt-3">
          {visible.map((line) => (
            <span
              key={line.name}
              className="inline-flex items-center gap-1.5 text-xs text-[#4B5563]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: line.color }}
              />
              {line.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   CALENDAR
========================================================= */

function CalendarPopup({ startValue, endValue, onChange, onClose }) {
  const today = startOfDay(new Date());

  const [visibleMonth, setVisibleMonth] = useState(
    startValue
      ? new Date(startValue.getFullYear(), startValue.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [rangeStart, setRangeStart] = useState(startValue || today);
  const [rangeEnd, setRangeEnd] = useState(endValue || null);

  const days = getCalendarDays(visibleMonth);

  const moveMonth = (amount) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );
  };

  const commit = (start, end) => {
    setRangeStart(start);
    setRangeEnd(end);
    onChange(start, end);
  };

  const selectPreset = (preset) => {
    const now = startOfDay(new Date());

    if (preset === 'Today') {
      commit(now, null);
      return;
    }

    if (preset === 'Yesterday') {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);
      commit(date, null);
      return;
    }

    if (preset === 'Last 7 days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      commit(start, now);
      return;
    }

    if (preset === 'Last 30 days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      commit(start, now);
      return;
    }

    if (preset === 'This month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      commit(start, now);
    }
  };

  const selectDate = (date) => {
    // First click starts a range, second click closes it.
    if (!rangeStart || rangeEnd) {
      commit(date, null);
      return;
    }

    if (date.getTime() < rangeStart.getTime()) {
      commit(date, rangeStart);
      return;
    }

    if (isSameDay(date, rangeStart)) {
      commit(date, null);
      return;
    }

    commit(rangeStart, date);
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
        <div className="flex w-36 shrink-0 flex-col border-r border-[#E5E7EB] px-4 py-5">
          <div className="space-y-0.5">
            {['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'This month'].map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className="block w-full rounded-md px-1 py-1.5 text-left text-xs text-[#1F2937] transition hover:text-[#9D0A0E]"
                >
                  {preset}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              commit(today, null);
            }}
            className="mt-auto px-1 pt-4 text-left text-xs font-semibold text-[#9D0A0E] hover:underline"
          >
            Reset
          </button>
        </div>

        <div className="flex-1 px-5 py-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-[#1F2937]">{monthLabel}</h3>

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
              <div key={day} className="pb-2 text-xs font-medium text-[#9CA3AF]">
                {day}
              </div>
            ))}

            {days.map((date) => {
              const currentMonth = date.getMonth() === visibleMonth.getMonth();
              const selected =
                isSameDay(date, rangeStart) || isSameDay(date, rangeEnd);
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

          <p className="mt-3 border-t border-[#E5E7EB] pt-2.5 text-xs text-[#9CA3AF]">
            Pick one day, or click a second day to cover a range.
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MONTH PICKER
========================================================= */

function MonthPopup({ value, onChange }) {
  const [year, setYear] = useState(value.getFullYear());

  return (
    <div
      className="swu-pop absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          onClick={() => setYear((current) => current - 1)}
          className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>

        <span className="text-sm font-bold text-[#1F2937]">{year}</span>

        <button
          type="button"
          aria-label="Next year"
          onClick={() => setYear((current) => current + 1)}
          className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTH_NAMES.map((name, index) => {
          const selected =
            value.getFullYear() === year && value.getMonth() === index;

          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(new Date(year, index, 1))}
              className={`rounded-md px-2 py-2 text-xs font-medium transition ${
                selected
                  ? 'bg-[#9D0A0E] text-white shadow-sm'
                  : 'text-[#4B5563] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]'
              }`}
            >
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   MULTI SELECT
========================================================= */

function MultiSelect({ icon: Icon, allLabel, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // An empty selection means "all", so the dashboard opens showing everything.
  const everything = selected.length === 0;

  const label = everything
    ? allLabel
    : selected.length === 1
      ? options.find((option) => option.id === selected[0])?.name ?? allLabel
      : `${selected.length} selected`;

  function toggle(id) {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id]
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex min-w-40 items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-xs transition ${
          everything
            ? 'border-[#E5E7EB] text-[#4B5563]'
            : 'border-[#9D0A0E] font-semibold text-[#9D0A0E]'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{label}</span>
        </span>

        <ChevronDown size={13} className="shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="swu-pop absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        >
          <button
            type="button"
            onClick={() => onChange([])}
            className={`flex w-full items-center justify-between border-b border-[#E5E7EB] px-3 py-2.5 text-left text-xs font-semibold transition hover:bg-[#FBF1F1] ${
              everything ? 'text-[#9D0A0E]' : 'text-[#1F2937]'
            }`}
          >
            {allLabel}
            {everything && <CheckCircle2 size={13} />}
          </button>

          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[#9CA3AF]">
                Nothing to choose from yet.
              </p>
            )}

            {options.map((option) => {
              const checked = selected.includes(option.id);

              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-[#1F2937] transition hover:bg-[#F8F9FA]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.id)}
                    className="h-3.5 w-3.5 shrink-0 accent-[#9D0A0E]"
                  />
                  <span className="min-w-0 truncate">{option.name}</span>
                </label>
              );
            })}
          </div>

          {!everything && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center justify-center gap-1.5 border-t border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:text-[#9D0A0E]"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SMALL PIECES
========================================================= */

function StatCard({ label, value, caption, icon: Icon, page, onNavigate, pageLabel }) {
  const clickable = Boolean(page && onNavigate);

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={clickable ? `Open ${pageLabel || page}` : undefined}
      onClick={clickable ? () => onNavigate(page) : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigate(page);
              }
            }
          : undefined
      }
      className={`swu-card min-w-0 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm ${
        clickable
          ? 'swu-press cursor-pointer hover:border-[#F0DADA] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9D0A0E]/30'
          : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
          {label}
        </p>

        <Icon size={16} className="text-[#9D0A0E]" />
      </div>

      <p className="text-2xl font-bold text-[#1F2937]">{value}</p>

      <p className="mt-1 text-xs uppercase tracking-wide text-[#4B5563]">
        {caption}
      </p>
    </div>
  );
}

function PanelCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section
      className={`swu-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#1F2937]">{title}</h2>

          {subtitle && (
            <p className="mt-0.5 text-xs text-[#9CA3AF]">{subtitle}</p>
          )}
        </div>

        {action}
      </div>

      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function AwaitingData({ what }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-6 text-xs leading-5 text-[#4B5563]">
      <Info size={13} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
      <span>
        {what}
        <span className="mt-1 block text-[#9CA3AF]">
          This panel fills in once the dashboard endpoint returns the queue rows
          for the selected period.
        </span>
      </span>
    </div>
  );
}

function StatusChip({ status }) {
  const tone =
    status === 'served'
      ? 'bg-[#E8F8F0] text-[#0D8A4E] ring-[#86EFAC]'
      : status === 'skipped'
        ? 'bg-[#FBF1F1] text-[#9D0A0E] ring-[#F0DADA]'
        : status === 'serving'
          ? 'bg-[#FFFBEB] text-[#A16207] ring-amber-200'
          : 'bg-[#F1F3F5] text-[#4B5563] ring-[#E5E7EB]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ${tone}`}
    >
      {status}
    </span>
  );
}

/* =========================================================
   QUEUE MONITOR - the left-hand panel
========================================================= */

function QueueMonitor({ rows, hasRows }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const served = rows.filter((row) => row.status === 'served').length;
  const skipped = rows.filter((row) => row.status === 'skipped').length;

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => statusFilter === 'all' || row.status === statusFilter)
      .filter(
        (row) =>
          !query ||
          row.number.toLowerCase().includes(query) ||
          row.department.toLowerCase().includes(query)
      )
      .sort((a, b) => (b.issuedAt || 0) - (a.issuedAt || 0));
  }, [rows, search, statusFilter]);

  return (
    <PanelCard
      title="Queue Number Monitoring"
      subtitle="Every number issued in the selected period, newest first"
      className="flex flex-col"
      action={
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0D8A4E]">
            <CheckCircle2 size={13} />
            {served} served
          </span>

          <span className="inline-flex items-center gap-1.5 font-semibold text-[#9D0A0E]">
            <SkipForward size={13} />
            {skipped} skipped
          </span>
        </div>
      }
    >
      {!hasRows ? (
        <AwaitingData what="The per-number list of served and skipped queues lives here." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={13}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search a queue number or department"
                aria-label="Search queue numbers"
                className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-8 pr-3 text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
              />
            </div>

            <div className="flex rounded-lg bg-[#F1F3F5] p-0.5">
              {['all', 'served', 'skipped', 'waiting'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={statusFilter === value}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                    statusFilter === value
                      ? 'bg-white text-[#9D0A0E] shadow-sm'
                      : 'text-[#4B5563] hover:text-[#1F2937]'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 max-h-[420px] overflow-y-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#E5E7EB] text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="py-2 pr-2">Number</th>
                  <th className="py-2 pr-2">Department</th>
                  <th className="py-2 pr-2">Terminal</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 text-right">Served at</th>
                </tr>
              </thead>

              <tbody className="swu-stagger">
                {shown.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-xs text-[#9CA3AF]"
                    >
                      No queue numbers match that.
                    </td>
                  </tr>
                )}

                {shown.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-[#F1F3F5] last:border-0 transition-colors hover:bg-[#F8F9FA]"
                  >
                    <td className="py-2 pr-2">
                      <span className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-2 py-0.5 font-mono font-semibold text-[#1F2937]">
                        {row.number || '--'}
                      </span>
                    </td>

                    <td className="py-2 pr-2 text-[#4B5563]">{row.department}</td>

                    <td className="py-2 pr-2 text-[#4B5563]">
                      {row.terminal || '--'}
                    </td>

                    <td className="py-2 pr-2">
                      <StatusChip status={row.status} />
                    </td>

                    <td className="py-2 text-right text-[#4B5563]">
                      {formatClock(row.completedAt || row.calledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2.5 border-t border-[#E5E7EB] pt-2.5 text-xs text-[#9CA3AF]">
            Showing {shown.length} of {rows.length} queue numbers
          </p>
        </>
      )}
    </PanelCard>
  );
}

/* =========================================================
   DEPARTMENT / TERMINAL ANALYTICS - the right-hand panel
========================================================= */

function ServiceAnalytics({ rows, hasRows, terminalNames }) {
  const [groupBy, setGroupBy] = useState('department');

  const grouped = useMemo(() => {
    const buckets = new Map();

    rows.forEach((row) => {
      const id =
        groupBy === 'department'
          ? row.departmentId || row.department
          : row.counterId || `${row.department}-${row.terminal}`;

      const name =
        groupBy === 'department'
          ? row.department
          : row.terminal
            ? `Terminal ${row.terminal}`
            : terminalNames.get(row.counterId) || 'Unassigned terminal';

      if (!buckets.has(id)) {
        buckets.set(id, { id, name, context: row.department, rows: [] });
      }

      buckets.get(id).rows.push(row);
    });

    return [...buckets.values()]
      .map((bucket) => {
        const served = bucket.rows.filter((row) => row.status === 'served');
        const skipped = bucket.rows.filter((row) => row.status === 'skipped');

        return {
          ...bucket,
          total: bucket.rows.length,
          served: served.length,
          skipped: skipped.length,
          avgServing: averageSeconds(served),
        };
      })
      .sort((a, b) => b.served - a.served);
  }, [rows, groupBy, terminalNames]);

  return (
    <PanelCard
      title="Department & Terminal Analytics"
      subtitle="Served, skipped and how long each transaction took"
      action={
        <div className="flex rounded-lg bg-[#F1F3F5] p-0.5">
          {[
            { key: 'department', label: 'By department' },
            { key: 'terminal', label: 'By terminal' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setGroupBy(option.key)}
              aria-pressed={groupBy === option.key}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                groupBy === option.key
                  ? 'bg-white text-[#9D0A0E] shadow-sm'
                  : 'text-[#4B5563] hover:text-[#1F2937]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {!hasRows ? (
        <AwaitingData what="Serving time per department and per terminal is worked out here." />
      ) : grouped.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#9CA3AF]">
          No queue activity in the selected period.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full min-w-[380px] text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#E5E7EB] text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                <th className="py-2 pr-2">
                  {groupBy === 'department' ? 'Department' : 'Terminal'}
                </th>
                <th className="py-2 pr-2 text-center">Served</th>
                <th className="py-2 pr-2 text-center">Skipped</th>
                <th className="py-2 text-right">Avg serving</th>
              </tr>
            </thead>

            <tbody className="swu-stagger">
              {grouped.map((bucket) => (
                <tr
                  key={bucket.id}
                  className="border-b border-[#F1F3F5] last:border-0 transition-colors hover:bg-[#F8F9FA]"
                >
                  <td className="py-2.5 pr-2">
                    <span className="block font-semibold text-[#1F2937]">
                      {bucket.name}
                    </span>

                    {groupBy === 'terminal' && (
                      <span className="block text-xs text-[#9CA3AF]">
                        {bucket.context}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 pr-2 text-center font-semibold text-[#0D8A4E]">
                    {bucket.served}
                  </td>

                  <td className="py-2.5 pr-2 text-center font-semibold text-[#9D0A0E]">
                    {bucket.skipped}
                  </td>

                  <td className="py-2.5 text-right font-semibold text-[#1F2937]">
                    {formatDuration(bucket.avgServing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

/* =========================================================
   STAFF DISTRIBUTION
========================================================= */

function StaffDistribution({ rows, hasRows }) {
  const staff = useMemo(() => {
    const buckets = new Map();

    rows
      .filter((row) => row.status === 'served')
      .forEach((row) => {
        const id = row.staffId || row.staff;
        if (!id) return;

        if (!buckets.has(id)) {
          buckets.set(id, { id, name: row.staff || 'Unnamed staff', rows: [] });
        }

        buckets.get(id).rows.push(row);
      });

    return [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        served: bucket.rows.length,
        avgServing: averageSeconds(bucket.rows),
      }))
      .sort((a, b) => b.served - a.served);
  }, [rows]);

  const max = Math.max(...staff.map((person) => person.served), 1);

  return (
    <PanelCard
      title="Staff Distribution"
      subtitle="How many queues each staff member served"
    >
      {!hasRows ? (
        <AwaitingData what="Queues served per staff member are counted here." />
      ) : staff.length === 0 ? (
        <p className="py-10 text-center text-xs leading-5 text-[#9CA3AF]">
          No served queue in this period carries a staff member.
          <span className="mt-1 block">
            The queue rows need `staff_id` and `staff_name` for this to fill in.
          </span>
        </p>
      ) : (
        <div className="space-y-3">
          {staff.map((person, index) => (
            <div key={person.id}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-semibold text-[#1F2937]">
                  {person.name}
                </span>

                <span className="shrink-0 text-[#4B5563]">
                  <span className="font-semibold text-[#1F2937]">
                    {person.served}
                  </span>{' '}
                  served
                  <span className="text-[#9CA3AF]">
                    {' '}
                    &middot; avg {formatDuration(person.avgServing)}
                  </span>
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#F1F3F5]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max((person.served / max) * 100, 2)}%`,
                    backgroundColor:
                      SERIES_COLORS[index % SERIES_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

/* =========================================================
   EXCEL EXPORT
========================================================= */

/*
 * Written as CSV with a UTF-8 byte-order mark, which Excel opens directly as a
 * spreadsheet. Doing it this way adds no dependency to the project. If a true
 * .xlsx file is ever required, `npm install xlsx` and swap the body of this
 * function for XLSX.writeFile - nothing else on the page has to change.
 */
function exportQueuesToExcel(rows, meta) {
  const header = [
    'Queue Number',
    'Department',
    'Terminal',
    'Status',
    'Issued At',
    'Called At',
    'Completed At',
    'Serving Time (seconds)',
    'Staff',
  ];

  const cell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const stamp = (time) => (time ? new Date(time).toISOString() : '');

  const lines = [
    // A short provenance block, so a downloaded file still says what it covers.
    [cell(`SWUMed Queue Report - ${meta.rangeLabel}`)].join(','),
    [cell(`Departments: ${meta.departments}`)].join(','),
    [cell(`Terminals: ${meta.terminals}`)].join(','),
    [cell(`Exported: ${new Date().toLocaleString()}`)].join(','),
    '',
    header.map(cell).join(','),
    ...rows.map((row) =>
      [
        row.number,
        row.department,
        row.terminal,
        row.status,
        stamp(row.issuedAt),
        stamp(row.calledAt),
        stamp(row.completedAt),
        row.servingSeconds ?? '',
        row.staff,
      ]
        .map(cell)
        .join(',')
    ),
  ];

  const blob = new Blob([`﻿${lines.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `swumed-queue-report-${meta.fileStamp}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/* =========================================================
   PAGE
========================================================= */

export default function Dashboard({ onNavigate }) {
  const [departments, setDepartments] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [resetDepartmentIds] = useState(() => {
    try {
      const stored = localStorage.getItem('swu_reset_departments');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [departmentSearch, setDepartmentSearch] = useState('');

  const [showPinSetup, setShowPinSetup] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | FILTERS
  |--------------------------------------------------------------------------
  |
  | Pending state is what the controls show; applied state is what the data
  | was fetched with. They are separate so moving a filter does not fire a
  | request on every click - Apply does that.
  |
  | Defaults: today, every department, every terminal.
  |
  */
  const today = startOfDay(new Date());

  const [dateMode, setDateMode] = useState('day');

  const [pending, setPending] = useState({
    start: today,
    end: null,
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    departmentIds: [],
    counterIds: [],
  });

  const [applied, setApplied] = useState({
    mode: 'day',
    start: today,
    end: null,
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    departmentIds: [],
    counterIds: [],
  });

  const [openPicker, setOpenPicker] = useState(null);

  useEffect(() => {
    if (!openPicker) return undefined;

    const close = () => setOpenPicker(null);
    document.addEventListener('click', close);

    return () => document.removeEventListener('click', close);
  }, [openPicker]);

  /* ---------- the resolved date window ---------- */

  const resolveRange = useCallback((mode, state) => {
    if (mode === 'month') {
      const start = new Date(
        state.month.getFullYear(),
        state.month.getMonth(),
        1
      );

      const end = new Date(
        state.month.getFullYear(),
        state.month.getMonth() + 1,
        0
      );

      return { start, end };
    }

    return { start: state.start, end: state.end || state.start };
  }, []);

  const appliedRange = useMemo(
    () => resolveRange(applied.mode, applied),
    [applied, resolveRange]
  );

  /* ---------- loading ---------- */

  const fetchDashboardData = useCallback(async (range) => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;

      if (!user) {
        throw new Error('You must be signed in to load the dashboard.');
      }

      const start = formatDate(range.start);
      const end = formatDate(range.end || range.start);

      const data = await getDashboardAnalytics(user, start, end);

      setAnalytics(data);

      /*
       * Department Overview still needs the department records themselves.
       * The analytics endpoint supplies aggregates; this supplies the rows.
       */
      const token = await user.getIdToken();

      const departmentResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://lightsteelblue-mandrill-330485.hostingersite.com'}/api/departments`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const departmentResult = await departmentResponse.json();

      if (!departmentResponse.ok) {
        throw new Error(
          departmentResult.message || 'Failed to load departments.'
        );
      }

      const departmentData = departmentResult.data || departmentResult;

      setDepartments(Array.isArray(departmentData) ? departmentData : []);

      const kioskData = await getKiosks();
      setKiosks(Array.isArray(kioskData) ? kioskData : []);

      // Terminals only feed the terminal filter, so a failure here is not fatal.
      try {
        const terminalData = await getTerminals();
        const terminalRows = Array.isArray(terminalData)
          ? terminalData
          : terminalData?.data || [];

        setTerminals(Array.isArray(terminalRows) ? terminalRows : []);
      } catch (terminalError) {
        console.warn('Terminal list unavailable:', terminalError?.message);
        setTerminals([]);
      }
    } catch (err) {
      console.error('Dashboard loading error:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(resolveRange('day', { start: today, end: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Security PIN first-run check, kept separate so a missing or failing PIN
  // endpoint never blocks the dashboard.
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

  /* ---------- filter options ---------- */

  const departmentOptions = useMemo(
    () =>
      departments
        .map((department) => ({
          id: String(department.department_id ?? department.id ?? ''),
          name: department.name || department.department_name || 'Department',
        }))
        .filter((option) => option.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [departments]
  );

  const terminalOptions = useMemo(() => {
    const departmentName = new Map(
      departmentOptions.map((option) => [option.id, option.name])
    );

    return terminals
      .map((terminal) => {
        const id = String(terminal.counter_id ?? terminal.id ?? '');
        const number = terminal.counter_number ?? '';
        const parent = departmentName.get(String(terminal.department_id ?? ''));

        return {
          id,
          name: parent
            ? `Terminal ${number} - ${parent}`
            : `Terminal ${number}`,
        };
      })
      .filter((option) => option.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [terminals, departmentOptions]);

  const terminalNames = useMemo(
    () => new Map(terminalOptions.map((option) => [option.id, option.name])),
    [terminalOptions]
  );

  /* ---------- the rows, filtered ---------- */

  const allRows = useMemo(() => readQueueRows(analytics), [analytics]);

  const hasRows = Array.isArray(allRows);

  const rows = useMemo(() => {
    if (!hasRows) return [];

    const departmentSet = new Set(applied.departmentIds);
    const counterSet = new Set(applied.counterIds);

    return allRows.filter((row) => {
      if (departmentSet.size > 0 && !departmentSet.has(row.departmentId)) {
        return false;
      }

      if (counterSet.size > 0 && !counterSet.has(row.counterId)) {
        return false;
      }

      return true;
    });
  }, [allRows, hasRows, applied.departmentIds, applied.counterIds]);

  /* ---------- derived numbers ---------- */

  const queueStats = analytics?.queue || {
    waiting: 0,
    averageWaitMinutes: 0,
    skipped: 0,
    completed: 0,
  };

  const terminalStats = analytics?.terminals || { active: 0, total: 0 };

  // Once the rows are here they are the better source: they respond to the
  // department and terminal filters, which the aggregates cannot.
  const servedCount = hasRows
    ? rows.filter((row) => row.status === 'served').length
    : Number(queueStats.completed) || 0;

  const skippedCount = hasRows
    ? rows.filter((row) => row.status === 'skipped').length
    : Number(queueStats.skipped) || 0;

  const predictedWaitDepartments = departments.filter(
    (department) =>
      department.predicted_waiting_time !== null &&
      department.predicted_waiting_time !== undefined
  );

  const averagePredictedWait =
    predictedWaitDepartments.length > 0
      ? Math.round(
          predictedWaitDepartments.reduce(
            (total, department) =>
              total + Number(department.predicted_waiting_time),
            0
          ) / predictedWaitDepartments.length
        )
      : 0;

  const resetDepartmentIdSet = new Set(
    resetDepartmentIds.map((id) => String(id))
  );

  const visibleDepartmentCount = departments.filter(
    (department) => !resetDepartmentIdSet.has(String(department.department_id))
  ).length;

  const PAGE_LABELS = {
    departments: 'Department Management',
    queues: 'Queue Management',
    kiosks: 'Kiosk Management',
    users: 'User Management',
  };

  /*
   * Total Waiting has been taken out on purpose: the milestone asks for it to
   * go, and a live figure never belonged on a screen that can be pointed at
   * last month.
   */
  const STATS = [
    {
      label: 'Departments',
      value: `${visibleDepartmentCount}/${departments.length}`,
      caption: 'Active departments',
      icon: Building2,
      page: 'departments',
    },
    {
      label: 'Completed',
      value: String(servedCount),
      caption: 'Served in this period',
      icon: CheckCircle2,
      page: 'queues',
    },
    {
      label: 'Skipped',
      value: String(skippedCount),
      caption: 'Skipped in this period',
      icon: SkipForward,
      page: 'queues',
    },
    {
      label: 'Average Wait',
      value: `${averagePredictedWait}m`,
      caption: 'Predicted wait time',
      icon: Clock,
      page: 'queues',
    },
    {
      label: 'Terminals',
      value: `${terminalStats.active}/${terminalStats.total}`,
      caption: 'Active terminals',
      icon: Monitor,
      page: 'kiosks',
    },
  ];

  /* ---------- time series ---------- */

  const buckets = useMemo(
    () => buildBuckets(appliedRange.start, appliedRange.end || appliedRange.start),
    [appliedRange]
  );

  const servedOverTime = useMemo(() => {
    const counts = new Map(buckets.keys.map((key) => [key, 0]));

    rows
      .filter((row) => row.status === 'served')
      .forEach((row) => {
        const time = row.completedAt || row.calledAt || row.issuedAt;
        if (!time) return;

        const key = buckets.keyOf(time);
        if (counts.has(key)) counts.set(key, counts.get(key) + 1);
      });

    return [
      {
        name: 'Served queues',
        color: SERIES_COLORS[0],
        values: buckets.keys.map((key) => counts.get(key) || 0),
      },
    ];
  }, [rows, buckets]);

  /*
   * Queue Status Distribution, as a line graph rather than the old pie: one
   * line per status running across the departments, so a department that
   * skips far more than it serves stands out at a glance.
   */
  const distribution = useMemo(() => {
    const names = [];
    const seen = new Set();

    rows.forEach((row) => {
      const name = row.department;
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    });

    names.sort((a, b) => a.localeCompare(b));

    const series = STATUS_SERIES.map((status) => ({
      name: status.label,
      color: status.color,
      values: names.map(
        (name) =>
          rows.filter(
            (row) => row.department === name && row.status === status.key
          ).length
      ),
    }));

    return { labels: names, series };
  }, [rows]);

  /* ---------- labels ---------- */

  const rangeLabel = useMemo(() => {
    if (applied.mode === 'month') {
      return `${MONTH_NAMES[applied.month.getMonth()]} ${applied.month.getFullYear()}`;
    }

    if (applied.end && !isSameDay(applied.start, applied.end)) {
      return `${applied.start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} - ${applied.end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }

    return isSameDay(applied.start, new Date())
      ? 'Today'
      : applied.start.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
  }, [applied]);

  const pendingDateLabel = useMemo(() => {
    if (dateMode === 'month') {
      return `${MONTH_NAMES[pending.month.getMonth()].slice(0, 3)} ${pending.month.getFullYear()}`;
    }

    if (pending.end && !isSameDay(pending.start, pending.end)) {
      return `${pending.start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} - ${pending.end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`;
    }

    return isSameDay(pending.start, new Date())
      ? 'Today'
      : pending.start.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
  }, [dateMode, pending]);

  const filtersDirty =
    dateMode !== applied.mode ||
    !isSameDay(pending.start, applied.start) ||
    String(pending.end) !== String(applied.end) ||
    pending.month.getTime() !== applied.month.getTime() ||
    pending.departmentIds.join('|') !== applied.departmentIds.join('|') ||
    pending.counterIds.join('|') !== applied.counterIds.join('|');

  function applyFilters() {
    const next = { ...pending, mode: dateMode };

    setApplied(next);
    setOpenPicker(null);
    fetchDashboardData(resolveRange(dateMode, next));
  }

  function resetFilters() {
    const fresh = {
      start: today,
      end: null,
      month: new Date(today.getFullYear(), today.getMonth(), 1),
      departmentIds: [],
      counterIds: [],
    };

    setDateMode('day');
    setPending(fresh);
    setApplied({ ...fresh, mode: 'day' });
    setOpenPicker(null);
    fetchDashboardData(resolveRange('day', fresh));
  }

  function handleExport() {
    const describe = (ids, options, allLabel) =>
      ids.length === 0
        ? allLabel
        : ids
            .map((id) => options.find((option) => option.id === id)?.name || id)
            .join('; ');

    exportQueuesToExcel(rows, {
      rangeLabel,
      departments: describe(
        applied.departmentIds,
        departmentOptions,
        'All departments'
      ),
      terminals: describe(applied.counterIds, terminalOptions, 'All terminals'),
      fileStamp: `${formatDate(appliedRange.start)}_to_${formatDate(
        appliedRange.end || appliedRange.start
      )}`,
    });
  }

  const insights = analytics?.insights || [];

  const filteredDepartments = departments.filter((department) => {
    const query = departmentSearch.trim().toLowerCase();
    if (!query) return true;

    const kioskName =
      kiosks.find(
        (kiosk) => String(kiosk.kiosk_id) === String(department.kiosk_id)
      )?.name || '';

    return [department.name, department.prefix, kioskName].some((value) =>
      String(value || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2937]">
            Dashboard / Analytics
          </h1>

          <p className="mt-0.5 text-sm text-[#4B5563]">
            Showing{' '}
            <span className="font-semibold text-[#1F2937]">{rangeLabel}</span>
            {applied.departmentIds.length > 0 && (
              <>
                {' '}&middot; {applied.departmentIds.length} department
                {applied.departmentIds.length === 1 ? '' : 's'}
              </>
            )}
            {applied.counterIds.length > 0 && (
              <>
                {' '}&middot; {applied.counterIds.length} terminal
                {applied.counterIds.length === 1 ? '' : 's'}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            disabled={!hasRows || rows.length === 0}
            title={
              hasRows
                ? 'Download the raw queue rows behind these filters'
                : 'Available once the endpoint returns the queue rows'
            }
            className="swu-press flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-semibold text-[#1F2937] shadow-sm transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#1F2937]"
          >
            <Download size={13} />
            Export to Excel
          </button>

          <button
            type="button"
            onClick={() => fetchDashboardData(appliedRange)}
            disabled={loading}
            className="swu-press flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#4B5563] shadow-sm transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E] disabled:opacity-60"
          >
            <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          FILTERS - every panel below reads from these
      ===================================================== */}

      <div className="swu-enter rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
            <Filter size={13} />
            Filters
          </span>

          {/* day / month / range */}
          <div className="flex rounded-lg bg-[#F1F3F5] p-0.5">
            {[
              { key: 'day', label: 'Day' },
              { key: 'month', label: 'Month' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setDateMode(option.key);
                  setOpenPicker(null);
                }}
                aria-pressed={dateMode === option.key}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  dateMode === option.key
                    ? 'bg-white text-[#9D0A0E] shadow-sm'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* the date control itself */}
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenPicker((current) => (current ? null : dateMode));
              }}
              aria-expanded={Boolean(openPicker)}
              aria-haspopup="dialog"
              className="flex min-w-40 items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] transition hover:border-[#9CA3AF] focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <CalendarDays size={14} />
                {pendingDateLabel}
              </span>

              <ChevronDown size={13} />
            </button>

            {openPicker === 'day' && (
              <CalendarPopup
                startValue={pending.start}
                endValue={pending.end}
                onChange={(start, end) =>
                  setPending((current) => ({ ...current, start, end }))
                }
                onClose={() => setOpenPicker(null)}
              />
            )}

            {openPicker === 'month' && (
              <MonthPopup
                value={pending.month}
                onChange={(month) =>
                  setPending((current) => ({ ...current, month }))
                }
              />
            )}
          </div>

          <MultiSelect
            icon={Building2}
            allLabel="All departments"
            options={departmentOptions}
            selected={pending.departmentIds}
            onChange={(departmentIds) =>
              setPending((current) => ({ ...current, departmentIds }))
            }
          />

          <MultiSelect
            icon={Monitor}
            allLabel="All terminals"
            options={terminalOptions}
            selected={pending.counterIds}
            onChange={(counterIds) =>
              setPending((current) => ({ ...current, counterIds }))
            }
          />

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:text-[#9D0A0E]"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={applyFilters}
              className={`swu-press rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-all duration-200 ${
                filtersDirty
                  ? 'bg-[#9D0A0E] text-white hover:bg-[#7D080B] hover:shadow-md'
                  : 'bg-[#9D0A0E]/90 text-white hover:bg-[#7D080B]'
              }`}
            >
              Apply Filter
            </button>
          </div>
        </div>

        {filtersDirty && (
          <p className="mt-2.5 text-xs text-[#9D0A0E]">
            Filters changed &mdash; press Apply Filter to update the page.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="swu-stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
        {STATS.map((stat) => (
          <StatCard
            key={stat.label}
            {...stat}
            onNavigate={onNavigate}
            pageLabel={PAGE_LABELS[stat.page]}
          />
        ))}
      </div>

      {/* =====================================================
          QUEUE MONITOR  |  DEPARTMENT & TERMINAL ANALYTICS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <QueueMonitor rows={rows} hasRows={hasRows} />
        </div>

        <div className="xl:col-span-5">
          <ServiceAnalytics
            rows={rows}
            hasRows={hasRows}
            terminalNames={terminalNames}
          />
        </div>
      </div>

      {/* =====================================================
          SERVED QUEUES OVER TIME
      ===================================================== */}

      <PanelCard
        title="Served Queues Over Time"
        subtitle={`Totals by ${buckets.unit} across ${rangeLabel.toLowerCase()}`}
        action={
          <span className="rounded-md bg-[#FBF1F1] px-2.5 py-1 text-xs font-semibold text-[#9D0A0E]">
            {servedCount} served in total
          </span>
        }
      >
        {!hasRows ? (
          <AwaitingData what="The rise and fall in served queues over the selected period is drawn here." />
        ) : (
          <MultiLineChart
            series={servedOverTime}
            labels={buckets.labels}
            emptyMessage="No queue was served in this period."
          />
        )}
      </PanelCard>

      {/* =====================================================
          QUEUE STATUS DISTRIBUTION
      ===================================================== */}

      <PanelCard
        title="Queue Status Distribution"
        subtitle="Served, skipped and waiting side by side, department by department"
      >
        {!hasRows ? (
          <AwaitingData what="Status split per department is drawn here." />
        ) : (
          <MultiLineChart
            series={distribution.series}
            labels={distribution.labels}
            emptyMessage="No queue activity to compare across departments."
          />
        )}
      </PanelCard>

      {/* =====================================================
          STAFF DISTRIBUTION
      ===================================================== */}

      <StaffDistribution rows={rows} hasRows={hasRows} />

      {/* =====================================================
          AI INSIGHTS - moved to the lower part of the page
      ===================================================== */}

      <section className="swu-card rounded-xl border border-[#F0DADA] bg-[#FBF1F1] p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#9D0A0E]" />

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
            insights.map((insight, index) => {
              const Icon =
                insight.icon === 'trending'
                  ? TrendingUp
                  : insight.icon === 'alert'
                    ? AlertTriangle
                    : Info;

              return (
                <div
                  key={`${insight.type}-${index}`}
                  className="flex gap-2.5 text-sm text-[#4B5563]"
                >
                  <Icon size={16} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                  <p>{insight.text}</p>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* =====================================================
          DEPARTMENT OVERVIEW
      ===================================================== */}

      <div className="swu-enter overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <h2 className="shrink-0 text-sm font-semibold text-[#1F2937]">
            Department Overview
          </h2>

          <div className="relative w-full max-w-xs">
            <input
              type="text"
              value={departmentSearch}
              onChange={(event) => setDepartmentSearch(event.target.value)}
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

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#FBF1F1] text-xs uppercase tracking-wide text-[#4B5563]">
              <th className="px-5 py-2.5 font-medium">Department</th>
              <th className="px-5 py-2.5 font-medium">Kiosk</th>
              <th className="px-5 py-2.5 font-medium">Prefix</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
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

            {!loading && departments.length === 0 && !error && (
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
              filteredDepartments.map((department) => (
                <tr
                  key={department.department_id}
                  title={onNavigate ? 'Open Department Management' : undefined}
                  onClick={
                    onNavigate ? () => onNavigate('departments') : undefined
                  }
                  className={`border-b border-[#F1F3F5] last:border-0 hover:bg-[#F8F9FA] ${
                    onNavigate ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-[#1F2937]">
                    {department.name}
                  </td>

                  <td className="px-5 py-3 text-[#4B5563]">
                    {kiosks.find(
                      (kiosk) =>
                        String(kiosk.kiosk_id) === String(department.kiosk_id)
                    )?.name || '--'}
                  </td>

                  <td className="px-5 py-3 text-[#4B5563]">
                    {department.prefix}
                  </td>

                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        department.status === 'active'
                          ? 'text-emerald-600'
                          : 'text-[#9CA3AF]'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          department.status === 'active'
                            ? 'bg-emerald-500'
                            : 'bg-[#9CA3AF]'
                        }`}
                      />

                      {department.status === 'active' ? 'Active' : 'Inactive'}
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