import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getDashboardAnalytics,
  getTerminals,
  getSecurityPinStatus,
} from '../../services/backendApi';
import SecurityPinModal, { readPinIsSet } from '../../components/SecurityPinModal';
import { auth } from '../../../firebase';
import { useLanguage, getLanguageCode } from '../../services/language';
import { buildXlsxBlob, downloadBlob } from '../Admin/reportExport';

import {
  Building2,
  Clock,
  Monitor,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  SkipForward,
  RotateCw,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
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
 * both graphs, the insights, the staff list and the Excel export - is computed
 * from ONE list of queue rows for the selected period. Rather than asking the
 * backend for six different aggregates that each have to agree with the others,
 * this screen asks for the raw rows once and does the arithmetic here, so every
 * number on the page comes from the same data and the filters reach all of it.
 *
 * The rows come from the `queues` array of
 *
 *   GET /api/dashboard/analytics?startDate=&endDate=&departmentIds=&counterIds=
 *
 * Each row: queue_number, department(_id), counter_id / counter_number /
 * counter_prefix, status (completed | cancelled(skipped) | waiting | serving),
 * issued_at / called_at / completed_at, serving_seconds, staff_id, staff_name.
 *
 * If the server has not been updated yet there is no `queues` array: every
 * panel then says so instead of inventing numbers.
 *
 * Every visible string goes through t() ('sa.dash.*' in i18nSuperAdmin.js).
 * Brand colour comes from the accent classes that index.css remaps to
 * --swu-accent, or from var(--swu-accent) directly. Green = served and
 * red = skipped stay fixed, and the department lines use fixed distinct hues.
 * =============================================================================
 */

const LOCALES = { en: 'en-US', fil: 'fil-PH', ceb: 'ceb-PH' };

/*
 * Eight hues that stay apart from each other for anyone who reads colour
 * normally AND for the common forms of colour blindness: they differ in
 * lightness as well as hue, so the lines are still tellable apart in
 * greyscale or on a projector.
 */
const SERIES_COLORS = [
  '#E8722C',
  '#1E5FA8',
  '#0D8A4E',
  '#6D28D9',
  '#C9A100',
  '#0E7490',
  '#BE185D',
  '#4B5563',
];

const REFRESH_MS = 30000;

function useLocale() {
  const { language, t } = useLanguage();
  const locale = LOCALES[getLanguageCode(language)] || LOCALES.en;

  return { t, locale };
}

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

function formatStamp(time) {
  if (!time) return '';

  const date = new Date(time);
  const clock = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');

  return `${formatDate(date)} ${clock}`;
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

function fmtClock(time, locale) {
  if (!time) return '--';

  return new Date(time).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// "8 AM" -> "8AM": compact enough for an axis label.
function fmtHourShort(hour, locale) {
  return new Date(2000, 0, 1, hour)
    .toLocaleTimeString(locale, { hour: 'numeric' })
    .replace(/\s/g, '');
}

function fmtHourFull(hour, locale) {
  return new Date(2000, 0, 1, hour, 0).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtShortDate(date, locale) {
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function fmtMonthYear(date, locale) {
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
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
  if (raw === 'serving' || raw === 'called' || raw === 'in-progress') return 'serving';

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
    department: departmentName || '',
    counterId: String(row.counter_id ?? row.counterId ?? ''),
    terminal: terminal === '' || terminal === null ? '' : String(terminal),
    counterPrefix: String(row.counter_prefix ?? row.counterPrefix ?? ''),
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

// The moment a row's outcome happened, for ordering and bucketing.
function eventTime(row) {
  return row.completedAt || row.calledAt || row.issuedAt;
}

function terminalLabel(row, t) {
  if (!row.terminal) return '--';

  return row.counterPrefix
    ? `${row.counterPrefix}-${row.terminal}`
    : t('sa.dash.terminal.n', { n: row.terminal });
}

function averageSeconds(rows) {
  const values = rows
    .map((row) => row.servingSeconds)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return null;

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

// "8 min", or seconds when under a minute.
function formatMinutes(seconds, t) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';

  if (seconds < 60) return t('sa.dash.time.sec', { n: seconds });

  return t('sa.dash.time.min', { n: Math.round(seconds / 60) });
}

// "10.2 mins", for the overall average.
function formatMinutesDecimal(seconds, t) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';

  return t('sa.dash.time.mins', { n: (seconds / 60).toFixed(1) });
}

/* =========================================================
   BUCKETING FOR THE GRAPHS
========================================================= */

/*
 * One day of data reads best by the hour, a few weeks by the day, and a long
 * stretch by the month. Picking the bucket from the span keeps the x-axis from
 * turning into a hundred unreadable ticks. A single day shows 8AM-5PM as a
 * minimum and widens only if something was served outside those hours.
 */
function buildBuckets(start, end, rows, locale) {
  const span = Math.abs(daysBetween(start, end));

  if (span === 0) {
    const hours = rows.map((row) => new Date(eventTime(row)).getHours());
    const first = Math.min(8, ...hours);
    const last = Math.max(17, ...hours);
    const count = last - first + 1;

    return {
      unit: 'hour',
      keys: Array.from({ length: count }, (_, index) => String(first + index)),
      labels: Array.from({ length: count }, (_, index) =>
        count > 12 && index % 2 === 1 ? '' : fmtHourShort(first + index, locale)
      ),
      titles: Array.from({ length: count }, (_, index) =>
        fmtHourFull(first + index, locale)
      ),
      keyOf: (time) => String(new Date(time).getHours()),
    };
  }

  if (span <= 62) {
    const keys = [];
    const labels = [];
    const titles = [];
    const step = span <= 14 ? 1 : span <= 31 ? 3 : 6;

    for (let index = 0; index <= span; index += 1) {
      const date = new Date(startOfDay(start));
      date.setDate(date.getDate() + index);

      keys.push(formatDate(date));
      labels.push(index % step === 0 ? fmtShortDate(date, locale) : '');
      titles.push(fmtShortDate(date, locale));
    }

    return {
      unit: 'day',
      keys,
      labels,
      titles,
      keyOf: (time) => formatDate(new Date(time)),
    };
  }

  const keys = [];
  const labels = [];

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    labels.push(fmtMonthYear(cursor, locale));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    unit: 'month',
    keys,
    labels,
    titles: labels,
    keyOf: (time) => {
      const date = new Date(time);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },
  };
}

// 2-hour windows for the Queue Status Distribution on a single day.
const WINDOW_NAMES = { 8: 'early', 10: 'mid', 12: 'noon', 14: 'afternoon', 16: 'late' };

function windowRange(startHour, locale) {
  const endHour = startHour + 2;
  const startText = fmtHourShort(startHour, locale);
  const endText = fmtHourShort(endHour % 24, locale);

  // "8-10AM": the AM/PM is only written once, after the end hour.
  return `${startText.replace(/\D*$/, '')}-${endText}`;
}

function buildWindowBuckets(start, end, rows, locale, t) {
  const span = Math.abs(daysBetween(start, end));

  if (span !== 0) {
    return { ...buildBuckets(start, end, rows, locale), windowed: false };
  }

  const hours = rows.map((row) => new Date(eventTime(row)).getHours());
  const first = Math.min(8, Math.floor(Math.min(...hours, 8) / 2) * 2);
  const last = Math.max(18, Math.ceil((Math.max(...hours, 17) + 1) / 2) * 2);
  const starts = [];

  for (let hour = first; hour < last; hour += 2) starts.push(hour);

  const labels = starts.map((hour) => {
    const range = windowRange(hour, locale);
    const name = WINDOW_NAMES[hour];

    return name ? t(`sa.dash.dist.${name}`, { range }) : range;
  });

  return {
    unit: 'window',
    windowed: true,
    keys: starts.map(String),
    labels,
    titles: labels,
    morning: starts.map((hour) => hour < 12),
    keyOf: (time) => {
      const hour = new Date(time).getHours();
      const key = Math.min(Math.max(Math.floor(hour / 2) * 2, first), last - 2);
      return String(key);
    },
  };
}

// Axis ticks that land on round numbers: 0..top in about four steps.
function niceScale(max) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const step = steps.find((candidate) => max / candidate <= 4) || 10000;
  const top = Math.max(Math.ceil(max / step), 1) * step;

  return { step, top, ticks: Math.round(top / step) };
}

/* =========================================================
   GRAPHS - plain SVG, shared axes
========================================================= */

const CHART = { W: 620, padL: 40, padR: 18, padT: 16, padB: 44 };

function chartGeometry(labelsLength, height, max) {
  const innerW = CHART.W - CHART.padL - CHART.padR;
  const innerH = height - CHART.padT - CHART.padB;
  const scale = niceScale(max);

  return {
    innerW,
    innerH,
    scale,
    x: (index) =>
      labelsLength === 1
        ? CHART.padL + innerW / 2
        : CHART.padL + (index * innerW) / (labelsLength - 1),
    y: (value) =>
      CHART.padT + innerH - ((Number(value) || 0) / scale.top) * innerH,
  };
}

function ChartGrid({ geometry, height, labels }) {
  const { scale, innerH, x } = geometry;

  return (
    <>
      {Array.from({ length: scale.ticks + 1 }, (_, tick) => {
        const gy = CHART.padT + innerH - (tick / scale.ticks) * innerH;

        return (
          <g key={tick}>
            <line
              x1={CHART.padL}
              x2={CHART.W - CHART.padR}
              y1={gy}
              y2={gy}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray={tick === 0 ? '0' : '4 4'}
            />
            <text
              x={CHART.padL - 8}
              y={gy + 4}
              textAnchor="end"
              className="fill-[#9CA3AF]"
              style={{ fontSize: 10 }}
            >
              {tick * scale.step}
            </text>
          </g>
        );
      })}

      {labels.map((label, index) => {
        if (!label) return null;

        // "Mid-Morning (10-12PM)" is set on two lines so it never truncates.
        const lines = label.split(/ (?=\()/);

        return (
          <text
            key={`${label}-${index}`}
            x={x(index)}
            y={height - (lines.length > 1 ? 24 : 14)}
            textAnchor="middle"
            className="fill-[#4B5563]"
            style={{ fontSize: 10 }}
          >
            {lines.map((line, lineIndex) => (
              <tspan key={lineIndex} x={x(index)} dy={lineIndex === 0 ? 0 : 12}>
                {line.length > 22 ? `${line.slice(0, 21)}…` : line}
              </tspan>
            ))}
          </text>
        );
      })}
    </>
  );
}

/* One series, soft accent fill under the line. */
function AreaChart({
  values,
  labels,
  titles,
  name,
  height = 230,
  emptyMessage,
}) {
  if (labels.length === 0 || !values.some((value) => value > 0)) {
    return <p className="py-12 text-center text-xs text-[#9CA3AF]">{emptyMessage}</p>;
  }

  const geometry = chartGeometry(labels.length, height, Math.max(...values, 1));
  const { x, y, innerH } = geometry;
  const baseline = CHART.padT + innerH;

  const line = values
    .map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ');

  const area = `${line} L${x(values.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;

  return (
    <svg
      viewBox={`0 0 ${CHART.W} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={name}
    >
      <ChartGrid geometry={geometry} height={height} labels={labels} />

      <path d={area} style={{ fill: 'var(--swu-accent)', fillOpacity: 0.12 }} />

      <path
        d={line}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="swu-draw"
        style={{ stroke: 'var(--swu-accent)', '--swu-dash': 1600 }}
      />

      {values.map((value, index) => (
        <circle
          key={index}
          cx={x(index)}
          cy={y(value)}
          r={labels.length > 20 ? 2.5 : 3.5}
          fill="#FFFFFF"
          strokeWidth="2.5"
          style={{ stroke: 'var(--swu-accent)' }}
        >
          <title>{`${titles[index] || labels[index] || index + 1}: ${value}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* Several series (one per department), legend drawn by the card header. */
function MultiLineChart({ series, labels, height = 230, emptyMessage }) {
  const visible = series.filter((line) => line.values.some((value) => value > 0));

  if (labels.length === 0 || visible.length === 0) {
    return <p className="py-12 text-center text-xs text-[#9CA3AF]">{emptyMessage}</p>;
  }

  const max = Math.max(
    ...visible.flatMap((line) => line.values.map((value) => Number(value) || 0)),
    1
  );

  const geometry = chartGeometry(labels.length, height, max);
  const { x, y } = geometry;

  return (
    <svg
      viewBox={`0 0 ${CHART.W} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={series.map((line) => line.name).join(', ')}
    >
      <ChartGrid geometry={geometry} height={height} labels={labels} />

      {visible.map((line) => {
        const path = line.values
          .map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
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
                <title>{`${line.name} - ${labels[index] || index + 1}: ${value}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* =========================================================
   CALENDAR
========================================================= */

function CalendarPopup({ startValue, endValue, onChange, single = false }) {
  const { t, locale } = useLocale();
  const today = startOfDay(new Date());

  const [visibleMonth, setVisibleMonth] = useState(
    startValue
      ? new Date(startValue.getFullYear(), startValue.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [rangeStart, setRangeStart] = useState(startValue || today);
  const [rangeEnd, setRangeEnd] = useState(endValue || null);

  const days = getCalendarDays(visibleMonth);

  // Monday first, in the reader's language (2024-01-01 was a Monday).
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Date(2024, 0, 1 + index).toLocaleDateString(locale, { weekday: 'short' })
  );

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

  const presets = single
    ? ['today', 'yesterday']
    : ['today', 'yesterday', 'last7', 'last30', 'thisMonth'];

  const presetLabel = (preset) =>
    preset === 'today' ? t('sa.dash.filter.today') : t(`sa.dash.cal.${preset}`);

  const selectPreset = (preset) => {
    const now = startOfDay(new Date());

    if (preset === 'today') {
      commit(now, null);
      return;
    }

    if (preset === 'yesterday') {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);
      commit(date, null);
      return;
    }

    if (preset === 'last7') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      commit(start, now);
      return;
    }

    if (preset === 'last30') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      commit(start, now);
      return;
    }

    if (preset === 'thisMonth') {
      commit(new Date(now.getFullYear(), now.getMonth(), 1), now);
    }
  };

  const selectDate = (date) => {
    // A single date is just that date.
    if (single) {
      commit(date, null);
      return;
    }

    // Otherwise the first click starts a range, the second click closes it.
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

  const monthLabel = visibleMonth.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="swu-pop absolute right-0 top-full z-50 mt-2 w-[32rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex">
        <div className="flex w-28 shrink-0 flex-col border-r border-[#E5E7EB] px-3 py-5 sm:w-36 sm:px-4">
          <div className="space-y-0.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className="block w-full rounded-md px-1 py-1.5 text-left text-xs text-[#1F2937] transition hover:text-[#9D0A0E]"
              >
                {presetLabel(preset)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              commit(today, null);
            }}
            className="mt-auto px-1 pt-4 text-left text-xs font-semibold text-[#9D0A0E] hover:underline"
          >
            {t('sa.dash.cal.reset')}
          </button>
        </div>

        <div className="min-w-0 flex-1 px-3 py-5 sm:px-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-sm font-bold capitalize text-[#1F2937]">{monthLabel}</h3>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('sa.dash.cal.prevMonth')}
                onClick={() => moveMonth(-1)}
                className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                aria-label={t('sa.dash.cal.nextMonth')}
                onClick={() => moveMonth(1)}
                className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center">
            {weekdays.map((day) => (
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
            {single ? t('sa.dash.cal.hintSingle') : t('sa.dash.cal.hintRange')}
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
  const { t, locale } = useLocale();
  const [year, setYear] = useState(value.getFullYear());

  return (
    <div
      className="swu-pop absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label={t('sa.dash.cal.prevYear')}
          onClick={() => setYear((current) => current - 1)}
          className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>

        <span className="text-sm font-bold text-[#1F2937]">{year}</span>

        <button
          type="button"
          aria-label={t('sa.dash.cal.nextYear')}
          onClick={() => setYear((current) => current + 1)}
          className="rounded-full p-1 text-[#1F2937] transition hover:bg-[#F1F3F5]"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, index) => {
          const selected =
            value.getFullYear() === year && value.getMonth() === index;

          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(new Date(year, index, 1))}
              className={`rounded-md px-2 py-2 text-xs font-medium capitalize transition ${
                selected
                  ? 'bg-[#9D0A0E] text-white shadow-sm'
                  : 'text-[#4B5563] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]'
              }`}
            >
              {new Date(year, index, 1).toLocaleDateString(locale, {
                month: 'short',
              })}
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
  const { t } = useLocale();
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
      : t('sa.dash.filter.selected', { n: selected.length });

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
        className={`flex min-w-36 items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-xs transition ${
          everything
            ? 'border-[#E5E7EB] text-[#4B5563] hover:border-[#9CA3AF]'
            : 'border-[#9D0A0E] font-semibold text-[#9D0A0E]'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0" />
          <span className="max-w-40 truncate">{label}</span>
        </span>

        <ChevronDown size={13} className="shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          className="swu-pop absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
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
                {t('sa.dash.filter.nothing')}
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
              {t('sa.dash.filter.clearAll')}
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

function PanelCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section
      className={`swu-card flex min-w-0 flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[#1F2937]">{title}</h2>

          {subtitle && (
            <p className="mt-0.5 text-xs text-[#9CA3AF]">{subtitle}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

const BADGE_TONES = {
  green: 'bg-[#E8F8F0] text-[#0D8A4E]',
  red: 'bg-[#FEECEC] text-[#C81E1E]',
  accent: 'bg-[#FBF1F1] text-[#9D0A0E]',
  grey: 'bg-[#F1F3F5] text-[#4B5563]',
};

function Badge({ tone = 'grey', children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/*
 * What a panel says when it has no rows: still loading, the load failed, or
 * the server has not been updated to send them.
 */
function PanelState({ loading, error }) {
  const { t } = useLocale();

  return (
    <p
      className={`rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-8 text-center text-xs leading-5 text-[#4B5563] ${
        loading ? 'animate-pulse' : ''
      }`}
    >
      {loading
        ? t('sa.dash.state.loading')
        : error
          ? t('sa.dash.state.error')
          : t('sa.dash.state.unavailable')}
    </p>
  );
}

/* =========================================================
   QUEUE MONITORING - the left-hand panel
========================================================= */

function QueueMonitor({ rows, hasRows, isToday, loading, error }) {
  const { t, locale } = useLocale();

  const served = rows.filter((row) => row.status === 'served');
  const skipped = rows.filter((row) => row.status === 'skipped');

  // Served in the last hour against the hour before it - only meaningful today.
  const trend = useMemo(() => {
    if (!isToday) return null;

    // eslint-disable-next-line react-hooks/purity -- "last hour" is relative to now
    const now = Date.now();
    const hour = 3600000;

    const countBetween = (from, to) =>
      served.filter((row) => {
        const time = eventTime(row);
        return time > from && time <= to;
      }).length;

    const current = countBetween(now - hour, now);
    const previous = countBetween(now - 2 * hour, now - hour);

    if (previous === 0) return null;

    return Math.round(((current - previous) / previous) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isToday]);

  const resolved = served.length + skipped.length;

  const skipRate =
    resolved > 0 ? ((skipped.length / resolved) * 100).toFixed(1) : null;

  const recent = useMemo(
    () =>
      rows
        .filter((row) => row.status === 'served' || row.status === 'skipped')
        .sort((a, b) => (eventTime(b) || 0) - (eventTime(a) || 0))
        .slice(0, 100),
    [rows]
  );

  return (
    <PanelCard
      title={isToday ? t('sa.dash.monitor.titleToday') : t('sa.dash.monitor.title')}
      subtitle={t('sa.dash.monitor.subtitle')}
      className="h-full"
      action={isToday ? <Badge tone="green">{t('sa.dash.monitor.live')}</Badge> : null}
    >
      {!hasRows ? (
        <PanelState loading={loading} error={error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#4B5563]">
                  {t('sa.dash.monitor.served')}
                </p>
                <Badge tone="green">{t('sa.dash.monitor.completedBadge')}</Badge>
              </div>

              <p className="mt-2 text-3xl font-bold text-[#1F2937]">{served.length}</p>

              {trend !== null && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    trend >= 0 ? 'text-[#0D8A4E]' : 'text-[#C81E1E]'
                  }`}
                >
                  {trend >= 0 ? '↑' : '↓'}{' '}
                  {t('sa.dash.monitor.vsLastHour', { pct: Math.abs(trend) })}
                </p>
              )}
            </div>

            <div className="min-w-0 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#4B5563]">
                  {t('sa.dash.monitor.skipped')}
                </p>
                <Badge tone="red">{t('sa.dash.monitor.skippedBadge')}</Badge>
              </div>

              <p className="mt-2 text-3xl font-bold text-[#1F2937]">{skipped.length}</p>

              {skipRate !== null && (
                <p className="mt-1 text-xs font-medium text-[#C81E1E]">
                  {t('sa.dash.monitor.skipRate', { pct: skipRate })}
                </p>
              )}
            </div>
          </div>

          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            {t('sa.dash.monitor.recent')}
          </p>

          {recent.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#9CA3AF]">
              {t('sa.dash.monitor.none')}
            </p>
          ) : (
            <ul className="swu-stagger max-h-[340px] space-y-2 overflow-y-auto pr-1">
              {recent.map((row) => {
                const isSkipped = row.status === 'skipped';
                const time = fmtClock(eventTime(row), locale);

                return (
                  <li
                    key={row.key}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                      isSkipped
                        ? 'border-[#FBD5D5] bg-[#FEF2F2]'
                        : 'border-[#E5E7EB] bg-[#F8F9FA]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1F2937]">
                        {row.number || '--'}
                        {row.department && (
                          <span className="ml-1.5 font-medium text-[#4B5563]">
                            {row.department}
                          </span>
                        )}
                      </p>

                      <p
                        className={`mt-0.5 text-xs ${
                          isSkipped ? 'text-[#C81E1E]' : 'text-[#4B5563]'
                        }`}
                      >
                        {isSkipped
                          ? t('sa.dash.monitor.skippedAt', { time })
                          : t('sa.dash.monitor.servedAt', { time })}
                      </p>
                    </div>

                    {isSkipped ? (
                      <Badge tone="red">{t('sa.dash.monitor.skippedBadge')}</Badge>
                    ) : (
                      row.servingSeconds && (
                        <Badge tone="grey">
                          {t('sa.dash.monitor.duration', {
                            time: formatMinutes(row.servingSeconds, t),
                          })}
                        </Badge>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </PanelCard>
  );
}

/* =========================================================
   DEPARTMENT & TERMINAL ANALYTICS - the right-hand panel
========================================================= */

function TerminalAnalytics({ rows, hasRows, activeTerminals, loading, error }) {
  const { t } = useLocale();

  // One line per department + terminal that handled at least one ticket.
  const table = useMemo(() => {
    const buckets = new Map();

    rows
      .filter((row) => row.counterId)
      .forEach((row) => {
        const id = `${row.departmentId}|${row.counterId}`;

        if (!buckets.has(id)) {
          buckets.set(id, {
            id,
            department: row.department || '--',
            terminal: terminalLabel(row, t),
            rows: [],
          });
        }

        buckets.get(id).rows.push(row);
      });

    return [...buckets.values()]
      .map((bucket) => {
        const served = bucket.rows.filter((row) => row.status === 'served');

        return {
          ...bucket,
          served: served.length,
          avgServing: averageSeconds(served),
        };
      })
      .sort(
        (a, b) =>
          a.department.localeCompare(b.department) ||
          a.terminal.localeCompare(b.terminal, undefined, { numeric: true })
      );
  }, [rows, t]);

  const servedRows = rows.filter(
    (row) => row.status === 'served' && row.counterId
  );

  return (
    <PanelCard
      title={t('sa.dash.terminals.title')}
      subtitle={t('sa.dash.terminals.subtitle')}
      className="h-full"
      action={
        <Badge tone="grey">
          {t('sa.dash.terminals.badge', { n: activeTerminals })}
        </Badge>
      }
    >
      {!hasRows ? (
        <PanelState loading={loading} error={error} />
      ) : table.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#9CA3AF]">
          {t('sa.dash.terminals.empty')}
        </p>
      ) : (
        <>
          <div className="max-h-[400px] overflow-auto rounded-lg border border-[#E5E7EB]">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="sticky top-0 bg-[#F8F9FA]">
                <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#4B5563]">
                  <th className="px-3 py-2.5">{t('sa.dash.terminals.colDepartment')}</th>
                  <th className="px-3 py-2.5">{t('sa.dash.terminals.colTerminal')}</th>
                  <th className="px-3 py-2.5 text-center">{t('sa.dash.terminals.colServed')}</th>
                  <th className="px-3 py-2.5 text-center">{t('sa.dash.terminals.colAverage')}</th>
                </tr>
              </thead>

              <tbody>
                {table.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]"
                  >
                    <td className="px-3 py-2.5 font-semibold text-[#1F2937]">
                      {line.department}
                    </td>
                    <td className="px-3 py-2.5 text-[#4B5563]">{line.terminal}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-[#1F2937]">
                      {line.served}
                    </td>
                    <td className="px-3 py-2.5 text-center text-[#4B5563]">
                      {formatMinutes(line.avgServing, t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3 text-xs font-medium text-[#4B5563]">
            <span>
              {t('sa.dash.terminals.totalProcessed', { n: servedRows.length })}
            </span>
            <span>
              {t('sa.dash.terminals.overallAverage', {
                time: formatMinutesDecimal(averageSeconds(servedRows), t),
              })}
            </span>
          </div>
        </>
      )}
    </PanelCard>
  );
}

/* =========================================================
   INSIGHTS - worked out from the filtered rows, so they follow the filters
========================================================= */

function buildInsights({ rows, buckets, servedPerBucket, t }) {
  const served = rows.filter((row) => row.status === 'served');
  const skipped = rows.filter((row) => row.status === 'skipped');
  const insights = [];

  const countBy = (list) => {
    const map = new Map();

    list.forEach((row) => {
      const name = row.department || '--';
      map.set(name, (map.get(name) || 0) + 1);
    });

    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  if (served.length > 0) {
    const peak = Math.max(...servedPerBucket);
    const index = servedPerBucket.indexOf(peak);

    if (peak > 0) {
      insights.push({
        icon: TrendingUp,
        tone: 'bg-[#FBF1F1] text-[#9D0A0E]',
        title: t('sa.dash.ai.peakTitle', { when: buckets.titles[index] }),
        body: t('sa.dash.ai.peakBody', { when: buckets.titles[index], n: peak }),
      });
    }

    const [topName, topCount] = countBy(served)[0];

    insights.push({
      icon: Building2,
      tone: 'bg-[#E8F0FA] text-[#1E5FA8]',
      title: t('sa.dash.ai.volumeTitle', { dept: topName }),
      body: t('sa.dash.ai.volumeBody', {
        dept: topName,
        n: topCount,
        pct: Math.round((topCount / served.length) * 100),
      }),
    });
  }

  if (skipped.length > 0) {
    const [topName, topCount] = countBy(skipped)[0];

    insights.push({
      icon: SkipForward,
      tone: 'bg-[#FEECEC] text-[#C81E1E]',
      title: t('sa.dash.ai.skipsTitle', {
        pct: ((skipped.length / (served.length + skipped.length)) * 100).toFixed(1),
      }),
      body: t('sa.dash.ai.skipsBody', {
        n: skipped.length,
        dept: topName,
        m: topCount,
      }),
    });
  }

  const overall = averageSeconds(served);

  if (overall) {
    const byDepartment = new Map();

    served.forEach((row) => {
      const name = row.department || '--';
      if (!byDepartment.has(name)) byDepartment.set(name, []);
      byDepartment.get(name).push(row);
    });

    const slowest = [...byDepartment.entries()]
      .map(([name, list]) => ({ name, avg: averageSeconds(list) }))
      .filter((entry) => entry.avg)
      .sort((a, b) => b.avg - a.avg)[0];

    if (slowest && byDepartment.size > 1) {
      insights.push({
        icon: Clock,
        tone: 'bg-[#E8F8F0] text-[#0D8A4E]',
        title: t('sa.dash.ai.serviceTitle', { dept: slowest.name }),
        body: t('sa.dash.ai.serviceBody', {
          dept: slowest.name,
          time: formatMinutes(slowest.avg, t),
          overall: formatMinutes(overall, t),
        }),
      });
    }
  }

  return insights.slice(0, 4);
}

/* =========================================================
   EXCEL EXPORT - a real .xlsx of the raw rows behind the filters
========================================================= */

function exportQueuesToExcel(rows, t, fileStamp) {
  const headers = [
    t('sa.dash.export.number'),
    t('sa.dash.export.department'),
    t('sa.dash.export.terminal'),
    t('sa.dash.export.status'),
    t('sa.dash.export.date'),
    t('sa.dash.export.issued'),
    t('sa.dash.export.called'),
    t('sa.dash.export.completed'),
    t('sa.dash.export.seconds'),
    t('sa.dash.export.staff'),
  ];

  const sorted = [...rows].sort((a, b) => (a.issuedAt || 0) - (b.issuedAt || 0));

  const body = sorted.map((row) => [
    row.number,
    row.department,
    row.terminal ? terminalLabel(row, t) : '',
    STATUS_KEYS.has(row.status) ? t(`sa.dash.status.${row.status}`) : row.status,
    row.issuedAt ? formatDate(new Date(row.issuedAt)) : '',
    formatStamp(row.issuedAt),
    formatStamp(row.calledAt),
    formatStamp(row.completedAt),
    row.servingSeconds ?? '',
    row.staff,
  ]);

  const blob = buildXlsxBlob({
    sheetName: t('sa.dash.export.sheet'),
    headers,
    rows: body,
  });

  downloadBlob(blob, `swumed-queue-report-${fileStamp}.xlsx`);
}

const STATUS_KEYS = new Set(['served', 'skipped', 'waiting', 'serving']);

/* =========================================================
   PAGE
========================================================= */

export default function Dashboard() {
  const { t, locale } = useLocale();

  // t may change identity between renders; the fetch callbacks (and the
  // refresh timer built on them) read it through a ref so they stay stable.
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [departments, setDepartments] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // null | 'menu' | 'single' | 'range' | 'month'
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

  const fetchRows = useCallback(async (range, filters) => {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(tRef.current('sa.dash.state.signin'));
    }

    return getDashboardAnalytics(
      user,
      formatDate(range.start),
      formatDate(range.end || range.start),
      filters
    );
  }, []);

  /*
   * One load per applied filter change:
   *  - the same request is never started twice while it is in flight (React
   *    StrictMode mounts effects twice in development);
   *  - an answer that arrives after a newer request was made is dropped;
   *  - the department and terminal lists do not depend on the filters, so they
   *    are read once and kept. Only Refresh / Retry ({ force: true }) read them
   *    again.
   * There is no automatic retry: a failure shows the Retry button.
   */
  const requestRef = useRef(0);
  const inFlightRef = useRef('');
  const staticLoadedRef = useRef(false);

  const fetchDashboardData = useCallback(async (range, filters = {}, { force = false } = {}) => {
    const key = JSON.stringify([
      formatDate(range.start),
      formatDate(range.end || range.start),
      filters.departmentIds || [],
      filters.counterIds || [],
    ]);

    if (!force && inFlightRef.current === key) return;

    inFlightRef.current = key;

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    try {
      setLoading(true);
      setError(null);

      const analyticsData = await fetchRows(range, filters);

      if (requestId !== requestRef.current) return;

      setAnalytics(analyticsData);

      if (staticLoadedRef.current && !force) return;

      /*
       * The department filter needs the department records themselves.
       * The analytics endpoint supplies the rows; this supplies the names.
       */
      const user = auth.currentUser;
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

      if (requestId !== requestRef.current) return;

      setDepartments(Array.isArray(departmentData) ? departmentData : []);
      staticLoadedRef.current = true;

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
      if (requestId !== requestRef.current) return;

      console.error('Dashboard loading error:', err);
      setError(err.message || tRef.current('sa.dash.state.error'));
    } finally {
      if (requestId === requestRef.current) {
        inFlightRef.current = '';
        setLoading(false);
      }
    }
  }, [fetchRows]);

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

  /* ---------- the Live Feed: quietly re-read the rows while viewing today ---------- */

  const rangeIncludesToday =
    appliedRange.end && startOfDay(appliedRange.end) >= startOfDay(new Date());

  useEffect(() => {
    if (!rangeIncludesToday) return undefined;

    let busy = false;

    const timer = setInterval(async () => {
      // One refresh at a time, even if the server is slow.
      if (document.hidden || busy) return;
      busy = true;

      try {
        setAnalytics(
          await fetchRows(appliedRange, {
            departmentIds: applied.departmentIds,
            counterIds: applied.counterIds,
          })
        );
      } catch {
        // A missed refresh is not worth an error banner; the next one retries.
      } finally {
        busy = false;
      }
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [rangeIncludesToday, appliedRange, applied.departmentIds, applied.counterIds, fetchRows]);

  /* ---------- filter options ---------- */

  const departmentOptions = useMemo(
    () =>
      departments
        .map((department) => ({
          id: String(department.department_id ?? department.id ?? ''),
          name: department.name || department.department_name || '--',
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
        const base = t('sa.dash.terminal.n', { n: number });

        return {
          id,
          name: parent ? `${base} - ${parent}` : base,
        };
      })
      .filter((option) => option.id)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [terminals, departmentOptions, t]);

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

  const servedRows = useMemo(
    () => rows.filter((row) => row.status === 'served'),
    [rows]
  );

  const isToday =
    applied.mode === 'day' &&
    isSameDay(applied.start, new Date()) &&
    (!applied.end || isSameDay(applied.start, applied.end));

  // Active terminals under the current filters, from the terminal list.
  const activeTerminals = useMemo(() => {
    if (terminals.length === 0) return analytics?.terminals?.active ?? 0;

    const departmentSet = new Set(applied.departmentIds);
    const counterSet = new Set(applied.counterIds);

    return terminals.filter((terminal) => {
      if (String(terminal.status || '').toLowerCase() !== 'active') return false;

      if (
        departmentSet.size > 0 &&
        !departmentSet.has(String(terminal.department_id ?? ''))
      ) {
        return false;
      }

      if (
        counterSet.size > 0 &&
        !counterSet.has(String(terminal.counter_id ?? terminal.id ?? ''))
      ) {
        return false;
      }

      return true;
    }).length;
  }, [terminals, analytics, applied.departmentIds, applied.counterIds]);

  /* ---------- Served Queues Over Time ---------- */

  const buckets = useMemo(
    () => buildBuckets(appliedRange.start, appliedRange.end || appliedRange.start, servedRows, locale),
    [appliedRange, servedRows, locale]
  );

  const servedPerBucket = useMemo(() => {
    const counts = new Map(buckets.keys.map((key) => [key, 0]));

    servedRows.forEach((row) => {
      const key = buckets.keyOf(eventTime(row));
      if (counts.has(key)) counts.set(key, counts.get(key) + 1);
    });

    return buckets.keys.map((key) => counts.get(key) || 0);
  }, [servedRows, buckets]);

  const peakValue = Math.max(0, ...servedPerBucket);
  const peakIndex = servedPerBucket.indexOf(peakValue);

  const averagePerBucket =
    buckets.keys.length > 0
      ? (servedRows.length / buckets.keys.length).toFixed(1)
      : '0.0';

  /* ---------- Queue Status Distribution ---------- */

  const distribution = useMemo(() => {
    const windows = buildWindowBuckets(
      appliedRange.start,
      appliedRange.end || appliedRange.start,
      servedRows,
      locale,
      t
    );

    const names = [
      ...new Set(servedRows.map((row) => row.department || '--')),
    ].sort((a, b) => a.localeCompare(b));

    const series = names.map((name, index) => {
      const counts = new Map(windows.keys.map((key) => [key, 0]));

      servedRows
        .filter((row) => (row.department || '--') === name)
        .forEach((row) => {
          const key = windows.keyOf(eventTime(row));
          if (counts.has(key)) counts.set(key, counts.get(key) + 1);
        });

      return {
        name,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        values: windows.keys.map((key) => counts.get(key) || 0),
      };
    });

    // Highest single-bucket volume.
    let highest = null;

    series.forEach((line) => {
      const peak = Math.max(0, ...line.values);
      if (peak > 0 && (!highest || peak > highest.peak)) {
        highest = { name: line.name, peak };
      }
    });

    // Steadiest department: lowest spread across the morning windows on a
    // single day, or across every bucket over a longer period.
    const steadiness = (values) => {
      const total = values.reduce((sum, value) => sum + value, 0);
      const mean = total / values.length;
      const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

      return { total, spread: mean > 0 ? Math.sqrt(variance) / mean : Infinity };
    };

    let steadiest = null;

    series.forEach((line) => {
      const values = windows.windowed
        ? line.values.filter((_, index) => windows.morning[index])
        : line.values;

      const needsAll = windows.windowed && values.some((value) => value === 0);
      const { total, spread } = steadiness(values);

      if (needsAll || values.length < 2 || total < (windows.windowed ? 2 : 3)) return;

      if (!steadiest || spread < steadiest.spread) {
        steadiest = { name: line.name, spread };
      }
    });

    return { ...windows, series, highest, steadiest };
  }, [appliedRange, servedRows, locale, t]);

  /* ---------- Staff Distribution ---------- */

  const staffList = useMemo(() => {
    const buckets = new Map();

    servedRows.forEach((row) => {
      const id = row.staffId || row.staff;
      if (!id) return;

      if (!buckets.has(id)) {
        buckets.set(id, { id, name: row.staff || '--', rows: [] });
      }

      buckets.get(id).rows.push(row);
    });

    const mostCommon = (list) => {
      const counts = new Map();
      list.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    };

    return [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        served: bucket.rows.length,
        department: mostCommon(bucket.rows.map((row) => row.department)),
        terminal: mostCommon(bucket.rows.map((row) => terminalLabel(row, t))),
      }))
      .sort((a, b) => b.served - a.served)
      .slice(0, 5);
  }, [servedRows, t]);

  const staffMax = Math.max(...staffList.map((person) => person.served), 1);

  /* ---------- insights ---------- */

  const insights = useMemo(
    () =>
      hasRows
        ? buildInsights({ rows, buckets, servedPerBucket, t })
        : (analytics?.insights || []).slice(0, 4).map((insight) => ({
            icon: insight.icon === 'trending' ? TrendingUp : AlertTriangle,
            tone: 'bg-[#FBF1F1] text-[#9D0A0E]',
            title: t('sa.dash.ai.serverTitle'),
            body: insight.text,
          })),
    [hasRows, rows, buckets, servedPerBucket, analytics, t]
  );

  /* ---------- labels ---------- */

  const rangeLabel = useMemo(() => {
    if (applied.mode === 'month') return fmtMonthYear(applied.month, locale);

    if (applied.end && !isSameDay(applied.start, applied.end)) {
      return `${fmtShortDate(applied.start, locale)} - ${applied.end.toLocaleDateString(
        locale,
        { month: 'short', day: 'numeric', year: 'numeric' }
      )}`;
    }

    return isSameDay(applied.start, new Date())
      ? t('sa.dash.filter.today')
      : applied.start.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
  }, [applied, locale, t]);

  const pendingDateLabel = useMemo(() => {
    if (dateMode === 'month') return fmtMonthYear(pending.month, locale);

    if (pending.end && !isSameDay(pending.start, pending.end)) {
      return `${fmtShortDate(pending.start, locale)} - ${fmtShortDate(pending.end, locale)}`;
    }

    return isSameDay(pending.start, new Date())
      ? t('sa.dash.filter.today')
      : pending.start.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
  }, [dateMode, pending, locale, t]);

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
    fetchDashboardData(resolveRange(dateMode, next), {
      departmentIds: next.departmentIds,
      counterIds: next.counterIds,
    });
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

  function chooseDate(kind) {
    if (kind === 'today') {
      setDateMode('day');
      setPending((current) => ({ ...current, start: today, end: null }));
      setOpenPicker(null);
      return;
    }

    setDateMode(kind === 'month' ? 'month' : 'day');
    setOpenPicker(kind);
  }

  function handleExport() {
    exportQueuesToExcel(
      rows,
      t,
      `${formatDate(appliedRange.start)}_to_${formatDate(
        appliedRange.end || appliedRange.start
      )}`
    );
  }

  const subtitleKey = `sa.dash.over.subtitle${
    buckets.unit === 'hour' ? 'Hour' : buckets.unit === 'day' ? 'Day' : 'Month'
  }`;

  const averageKey = `sa.dash.over.avg${
    buckets.unit === 'hour' ? 'Hour' : buckets.unit === 'day' ? 'Day' : 'Month'
  }`;

  const intervalsKey = `sa.dash.dist.intervals${
    distribution.unit === 'window' ? 'Hour' : distribution.unit === 'day' ? 'Day' : 'Month'
  }`;

  const dateMenu = [
    { key: 'today', label: t('sa.dash.filter.today') },
    { key: 'single', label: t('sa.dash.filter.specificDate') },
    { key: 'month', label: t('sa.dash.filter.month') },
    { key: 'range', label: t('sa.dash.filter.customRange') },
  ];

  return (
    <div className="space-y-5">
      {/* =====================================================
          HEADER + FILTERS
      ===================================================== */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-[#1F2937]">
            {t('sa.dash.title')}
          </h1>

          <p className="mt-0.5 text-sm text-[#4B5563]">{t('sa.dash.subtitle')}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* date: Today / Specific Date / Month / Custom Range */}
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenPicker((current) => (current ? null : 'menu'));
                }}
                aria-expanded={Boolean(openPicker)}
                aria-haspopup="menu"
                className="flex min-w-36 items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#4B5563] transition hover:border-[#9CA3AF] focus:outline-none"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays size={14} />
                  {pendingDateLabel}
                </span>

                <ChevronDown size={13} />
              </button>

              {openPicker === 'menu' && (
                <div
                  role="menu"
                  className="swu-pop absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="py-1">
                    {dateMenu.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        onClick={() => chooseDate(item.key)}
                        className="block w-full px-3 py-2 text-left text-xs text-[#1F2937] transition hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-xs font-semibold text-[#4B5563] transition hover:text-[#9D0A0E]"
                  >
                    <X size={12} />
                    {t('sa.dash.filter.clearAll')}
                  </button>
                </div>
              )}

              {(openPicker === 'single' || openPicker === 'range') && (
                <CalendarPopup
                  key={openPicker}
                  single={openPicker === 'single'}
                  startValue={pending.start}
                  endValue={openPicker === 'single' ? null : pending.end}
                  onChange={(start, end) =>
                    setPending((current) => ({ ...current, start, end }))
                  }
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
              allLabel={t('sa.dash.filter.allDepartments')}
              options={departmentOptions}
              selected={pending.departmentIds}
              onChange={(departmentIds) =>
                setPending((current) => ({ ...current, departmentIds }))
              }
            />

            <MultiSelect
              icon={Monitor}
              allLabel={t('sa.dash.filter.allTerminals')}
              options={terminalOptions}
              selected={pending.counterIds}
              onChange={(counterIds) =>
                setPending((current) => ({ ...current, counterIds }))
              }
            />

            <button
              type="button"
              onClick={applyFilters}
              className="swu-press rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md"
            >
              {t('sa.dash.filter.apply')}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                fetchDashboardData(
                  appliedRange,
                  {
                    departmentIds: applied.departmentIds,
                    counterIds: applied.counterIds,
                  },
                  { force: true }
                )
              }
              disabled={loading}
              className="swu-press flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-medium text-[#4B5563] shadow-sm transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E] disabled:opacity-60"
            >
              <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
              {t('sa.dash.refresh')}
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={!hasRows || rows.length === 0}
              title={t('sa.dash.exportTip')}
              className="swu-press flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] shadow-sm transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#1F2937]"
            >
              <Download size={13} />
              {t('sa.dash.export')}
            </button>
          </div>

          {filtersDirty && (
            <p className="max-w-md text-right text-xs text-[#9D0A0E]">
              {t('sa.dash.filter.changed')}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9D0A0E]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() =>
              fetchDashboardData(
                appliedRange,
                { departmentIds: applied.departmentIds, counterIds: applied.counterIds },
                { force: true }
              )
            }
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#9D0A0E] bg-white px-2.5 py-1 font-semibold text-[#9D0A0E] transition hover:bg-[#FBF1F1] disabled:opacity-60"
          >
            <RotateCw size={11} className={loading ? 'animate-spin' : ''} />
            {t('reports.retry')}
          </button>
        </div>
      )}

      {/* =====================================================
          ROW 1 - QUEUE MONITORING  |  DEPARTMENT & TERMINAL ANALYTICS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <QueueMonitor
            rows={rows}
            hasRows={hasRows}
            isToday={isToday}
            loading={loading}
            error={error}
          />
        </div>

        <div className="xl:col-span-3">
          <TerminalAnalytics
            rows={rows}
            hasRows={hasRows}
            activeTerminals={activeTerminals}
            loading={loading}
            error={error}
          />
        </div>
      </div>

      {/* =====================================================
          ROW 2 - SERVED OVER TIME  |  STATUS DISTRIBUTION
      ===================================================== */}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PanelCard
          title={t('sa.dash.over.title')}
          subtitle={t(subtitleKey)}
          action={
            peakValue > 0 ? (
              <Badge tone="accent">
                {t('sa.dash.over.peak', {
                  when: buckets.titles[peakIndex],
                  n: peakValue,
                })}
              </Badge>
            ) : null
          }
        >
          {!hasRows ? (
            <PanelState loading={loading} error={error} />
          ) : (
            <>
              <AreaChart
                values={servedPerBucket}
                labels={buckets.labels}
                titles={buckets.titles}
                name={t('sa.dash.over.title')}
                emptyMessage={t('sa.dash.over.empty')}
              />

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-[#E5E7EB] pt-3 text-xs font-medium text-[#4B5563]">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[#9D0A0E]"
                  />
                  {t('sa.dash.over.total', { n: servedRows.length })}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-[#9CA3AF]"
                  />
                  {t(averageKey, { n: averagePerBucket })}
                </span>
              </div>
            </>
          )}
        </PanelCard>

        <PanelCard
          title={t('sa.dash.dist.title')}
          subtitle={t('sa.dash.dist.subtitle')}
          action={
            distribution.series.length > 0 ? (
              <div className="flex max-w-[60%] flex-wrap items-center justify-end gap-x-3 gap-y-1">
                {distribution.series.map((line) => (
                  <span
                    key={line.name}
                    className="inline-flex items-center gap-1.5 text-xs text-[#4B5563]"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: line.color }}
                    />
                    {line.name}
                  </span>
                ))}
              </div>
            ) : null
          }
        >
          {!hasRows ? (
            <PanelState loading={loading} error={error} />
          ) : (
            <>
              <MultiLineChart
                series={distribution.series}
                labels={distribution.labels}
                emptyMessage={t('sa.dash.dist.empty')}
              />

              {distribution.series.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E5E7EB] pt-3">
                  {distribution.highest && (
                    <Badge tone="grey">
                      {t('sa.dash.dist.highest', {
                        dept: distribution.highest.name,
                        n: distribution.highest.peak,
                      })}
                    </Badge>
                  )}

                  {distribution.steadiest && (
                    <Badge tone="grey">
                      {t(
                        distribution.windowed
                          ? 'sa.dash.dist.consistentMorning'
                          : 'sa.dash.dist.consistent',
                        { dept: distribution.steadiest.name }
                      )}
                    </Badge>
                  )}

                  <Badge tone="grey">
                    {t(intervalsKey, { range: rangeLabel })}
                  </Badge>
                </div>
              )}
            </>
          )}
        </PanelCard>
      </div>

      {/* =====================================================
          ROW 3 - AI INSIGHTS  |  STAFF DISTRIBUTION
      ===================================================== */}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PanelCard
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles size={15} className="text-[#9D0A0E]" />
              {t('sa.dash.ai.title')}
            </span>
          }
          action={<Badge tone="accent">{t('sa.dash.ai.badge')}</Badge>}
        >
          {!hasRows && insights.length === 0 ? (
            <PanelState loading={loading} error={error} />
          ) : insights.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#9CA3AF]">
              {t('sa.dash.ai.empty')}
            </p>
          ) : (
            <div className="swu-stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((insight, index) => {
                const Icon = insight.icon;

                return (
                  <div
                    key={`${insight.title}-${index}`}
                    className="flex min-w-0 gap-3 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] p-3.5"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${insight.tone}`}
                    >
                      <Icon size={16} />
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1F2937]">{insight.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-[#4B5563]">
                        {insight.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>

        <PanelCard
          title={t('sa.dash.staff.title')}
          subtitle={t('sa.dash.staff.subtitle')}
          action={
            staffList.length > 0 ? (
              <Badge tone="grey">
                {t('sa.dash.staff.badge', { n: staffList.length })}
              </Badge>
            ) : null
          }
        >
          {!hasRows ? (
            <PanelState loading={loading} error={error} />
          ) : staffList.length === 0 ? (
            <p className="py-10 text-center text-xs leading-5 text-[#9CA3AF]">
              {t('sa.dash.staff.empty')}
            </p>
          ) : (
            <div className="space-y-4">
              {staffList.map((person, index) => (
                <div key={person.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1F2937]">
                        {person.name}
                      </p>

                      <p className="truncate text-xs text-[#9CA3AF]">
                        {person.department}
                        {person.terminal && person.terminal !== '--'
                          ? ` (${person.terminal})`
                          : ''}
                      </p>
                    </div>

                    <Badge tone="grey">
                      {t(person.served === 1 ? 'sa.dash.staff.one' : 'sa.dash.staff.other', {
                        n: person.served,
                      })}
                    </Badge>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F3F5]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max((person.served / staffMax) * 100, 3)}%`,
                        // The top operator is the full accent; the rest fade.
                        backgroundColor: `color-mix(in srgb, var(--swu-accent) ${Math.max(100 - index * 14, 45)}%, white)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
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
