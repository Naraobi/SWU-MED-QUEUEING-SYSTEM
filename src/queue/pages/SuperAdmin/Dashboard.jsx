import { useEffect, useState } from 'react';
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
} from 'lucide-react';
const INSIGHTS = [
  { icon: Info, text: 'Laboratory has a high number of waiting patients (24).' },
  { icon: TrendingUp, text: 'Cashier 4 (Pharmacy) is 15% faster than average.' },
  { icon: AlertTriangle, text: 'High skip rate detected in Payment & Billing between 10 AM - 11 AM.' },
];

// Placeholder analytics data — needs a real queue/transactions table before this can be live,
// same as the 6 stat cards were in the old Dashboard.
const DEPARTMENT_VOLUME = [
  { name: 'Billing', value: 42, max: 50 },
  { name: 'Laboratory', value: 18, max: 50 },
  { name: 'Pharmacy', value: 25, max: 50 },
  { name: 'Radiology', value: 0, max: 50 },
];

const QUEUE_DISTRIBUTION = [
  { label: 'Serving', pct: 25, color: '#1F2937' },
  { label: 'Waiting', pct: 45, color: '#4B5563' },
  { label: 'Completed', pct: 30, color: '#B34C4C' },
];

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
      className="absolute right-0 top-full z-50 mt-2 w-[610px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-[390px]">
        <div className="flex w-[185px] shrink-0 flex-col border-r border-slate-100 px-6 py-7">
          <div className="space-y-1">
            {['Today', 'Yesterday', 'Last week', 'Last month', 'Last quarter'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPreset(preset)}
                className="block w-full rounded-md px-1 py-2 text-left text-[15px] font-medium text-slate-700 transition hover:bg-[#F1F3F5] hover:text-[#9D0A0E]"
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-auto px-1 text-left text-[15px] font-semibold text-[#9D0A0E] hover:underline"
          >
            Reset
          </button>
        </div>

        <div className="flex-1 px-7 py-7">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-[25px] font-bold text-slate-800">{monthLabel}</h3>

            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => moveMonth(-1)}
                className="rounded-full p-1 text-slate-700 hover:bg-slate-100"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => moveMonth(1)}
                className="rounded-full p-1 text-slate-700 hover:bg-slate-100"
              >
                <ChevronRight size={22} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="pb-3 text-[14px] font-medium text-slate-400"
              >
                {day}
              </div>
            ))}

            {days.map((date) => {
              const currentMonth = date.getMonth() === visibleMonth.getMonth();
              const selectedStart = isSameDay(date, rangeStart);
              const selectedEnd = isSameDay(date, rangeEnd);
              const inRange = isBetweenDates(date, rangeStart, rangeEnd);

              return (
                <button
                  key={formatDate(date)}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={`relative flex h-12 items-center justify-center text-[15px] ${
                    inRange ? 'bg-[#F6E7E7]' : ''
                  } ${
                    !currentMonth
                      ? 'text-slate-300'
                      : 'text-slate-700'
                  }`}
                >
                  {(selectedStart || selectedEnd) && (
                    <span className="absolute h-10 w-10 rounded-full bg-[#9D0A0E]" />
                  )}

                  <span
                    className={`relative z-10 ${
                      selectedStart || selectedEnd
                        ? 'font-semibold text-white'
                        : ''
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#7D080B]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Calendar UI state only. Existing dashboard data/functions remain unchanged.
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  async function fetchDepartments() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('departments').select('*').order('name', { ascending: true });
    if (error) setError(error.message);
    else setDepartments(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => setCalendarOpen(false);

    if (calendarOpen) {
      document.addEventListener('click', handleOutsideClick);
    }

    return () => document.removeEventListener('click', handleOutsideClick);
  }, [calendarOpen]);

  const activeCount = departments.filter((d) => d.status === 'active').length;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const STATS = [
    { label: 'Departments', value: `${activeCount}/${departments.length || 0}`, caption: 'Active departments', icon: Building2 },
    { label: 'Total Waiting', value: '145', caption: 'Across all departments', icon: Users },
    { label: 'Average Wait', value: '18m', caption: 'Average wait time', icon: Clock },
    { label: 'Skipped', value: '16', caption: 'Skipped queuing', icon: RotateCw },
    { label: 'Completed', value: '255', caption: 'Completed queuing', icon: TrendingUp },
    { label: 'Terminals', value: '42/64', caption: 'Active terminals', icon: Monitor },
  ];

  const calendarLabel = isSameDay(selectedDate, new Date())
    ? 'Today'
    : selectedDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2937]">System Overview</h1>
          <p className="text-sm text-[#4B5563]">Today &middot; {today}</p>
        </div>

        <div className="flex items-center gap-2.5">
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
                <CalendarDays size={14} className="text-slate-500" />
                {calendarLabel}
              </span>
              <ChevronDown size={13} className="text-slate-500" />
            </button>

            {calendarOpen && (
              <CalendarPopup
                value={selectedDate}
                onChange={setSelectedDate}
                onClose={() => setCalendarOpen(false)}
              />
            )}
          </div>

          <button
            type="button"
            className="rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#7D080B]"
          >
            Apply Filter
          </button>

          <button
            type="button"
            onClick={fetchDepartments}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#4B5563] shadow-sm transition-colors hover:bg-[#F8F9FA]"
          >
            <RotateCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Note: Departments card is live (from Supabase). Total Waiting / Average Wait /
          Counters are still placeholders until a real queue/transactions table exists. */}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="min-w-0 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">{stat.label}</p>
                <Icon size={16} className="text-[#9D0A0E]" />
              </div>
              <p className="text-2xl font-bold text-[#1F2937]">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-[#4B5563]">{stat.caption}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-[#F0DADA] bg-[#FBF1F1] p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#9D0A0E]" />
            <h2 className="text-sm font-bold text-[#1F2937]">AI-Assisted Insights</h2>
          </div>

          <div className="my-4 border-t border-[#EBD5D5]" />

          <div className="space-y-4">
            {INSIGHTS.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <div key={i} className="flex gap-2.5 text-sm text-[#4B5563]">
                  <Icon size={16} className="mt-0.5 shrink-0 text-[#B34C4C]" />
                  <p>{insight.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#1F2937]">Department Volume</h2>
          <div className="space-y-4">
            {DEPARTMENT_VOLUME.map((dept) => (
              <div key={dept.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1F2937]">{dept.name}</span>
                  <span className="text-[#4B5563]">{dept.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#F1F3F5]">
                  <div
                    className="h-2 rounded-full bg-[#9D0A0E]"
                    style={{ width: `${(dept.value / dept.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#1F2937]">Queue Status Distribution</h2>
          <div className="flex items-center gap-6">
            <DonutChart data={QUEUE_DISTRIBUTION} />
            <div className="space-y-2 text-xs">
              {QUEUE_DISTRIBUTION.map((slice) => (
                <div key={slice.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-[#4B5563]">{slice.label} ({slice.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}