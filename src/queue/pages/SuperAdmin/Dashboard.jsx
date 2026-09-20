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
const DEPARTMENT_VOLUME = [];

const QUEUE_DISTRIBUTION = [
  { label: 'Serving', pct: 0, color: '#1F2937' },
  { label: 'Waiting', pct: 0, color: '#4B5563' },
  { label: 'Completed', pct: 0, color: '#B34C4C' },
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

  // Frontend-only PIN state until the backend provides real PIN storage and verification.
  const PIN_STORAGE_KEY = 'superadmin_security_pin_configured';
  const [pinSetupRequired, setPinSetupRequired] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(PIN_STORAGE_KEY) !== 'true';
  });
  const [securityPin, setSecurityPin] = useState('');
  const [confirmSecurityPin, setConfirmSecurityPin] = useState('');
  const [showSecurityPin, setShowSecurityPin] = useState(false);
  const [showConfirmSecurityPin, setShowConfirmSecurityPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinConfiguredAt, setPinConfiguredAt] = useState(null);

  const updatePinDigit = (setter, currentValue, index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const digits = currentValue.padEnd(6, ' ').split('');
    digits[index] = digit || ' ';
    setter(digits.join('').replace(/ /g, ''));
    setPinError('');
  };

  const handlePinSetup = () => {
    if (!/^\d{6}$/.test(securityPin)) {
      setPinError('Please enter a 6-digit PIN. Only digits (0-9) are accepted.');
      return;
    }
    if (securityPin !== confirmSecurityPin) {
      setPinError('PINs do not match. Please enter the same PIN in both fields.');
      return;
    }
    const configuredAt = new Date();
    localStorage.setItem(PIN_STORAGE_KEY, 'true');
    localStorage.setItem('superadmin_security_pin_configured_at', configuredAt.toISOString());
    setPinConfiguredAt(configuredAt);
    setPinSuccess(true);
    setPinError('');
  };

  const resetPinForm = () => {
    setSecurityPin('');
    setConfirmSecurityPin('');
    setPinError('');
  };

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

  // Only Departments has a real source today. The rest need a queue/transactions
  // table before they can show a number, so they render as "--" instead of a
  // hardcoded figure that looks live but isn't.
  const NO_DATA = '--';

  const STATS = [
    { label: 'Departments', value: `${activeCount}/${departments.length || 0}`, caption: 'Active departments', icon: Building2 },
    { label: 'Total Waiting', value: NO_DATA, caption: 'Across all departments', icon: Users },
    { label: 'Average Wait', value: NO_DATA, caption: 'Average wait time', icon: Clock },
    { label: 'Skipped', value: NO_DATA, caption: 'Skipped queuing', icon: RotateCw },
    { label: 'Completed', value: NO_DATA, caption: 'Completed queuing', icon: TrendingUp },
    { label: 'Terminals', value: NO_DATA, caption: 'Active terminals', icon: Monitor },
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
            {DEPARTMENT_VOLUME.length === 0 && (
              <p className="py-6 text-center text-xs text-[#4B5563]">
                No volume data available yet.
              </p>
            )}

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

      {pinSetupRequired && !pinSuccess && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-pin-title"
        >
          <div className="relative w-[300px] scale-[1.25] rounded-[10px] bg-white px-[18px] py-[16px] shadow-[0_12px_35px_rgba(15,23,42,0.18)]">
            <button
              type="button"
              onClick={resetPinForm}
              className="absolute right-[10px] top-[8px] text-[18px] leading-none text-[#98A2B3] transition hover:text-[#475467]"
              aria-label="Close security PIN setup"
            >
              ×
            </button>

            <div className="mx-auto flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-[#FDE8E8] text-[#A9070B]">
              <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 10V8a5 5 0 0 1 10 0v2" />
                <rect x="5" y="10" width="14" height="10" rx="2.5" />
                <path d="M12 14v2" />
              </svg>
            </div>

            <div className="mt-[8px] text-center">
              <h2 id="security-pin-title" className="text-[16px] font-bold leading-[20px] text-[#202938]">
                Set Up Security PIN
              </h2>
              <p className="mx-auto mt-[4px] max-w-[245px] text-[9px] leading-[13px] text-[#667085]">
                Create an Security PIN to authorize protected system
                <br />
                actions such as resetting records.
              </p>
            </div>

            <div className="mt-[13px]">
              <div className="mb-[5px] flex items-center justify-between">
                <label className="text-[9px] font-semibold text-[#344054]">
                  New Security PIN <span className="text-[#A9070B]">*</span>
                </label>
                <span className="text-[8px] font-medium uppercase tracking-wide text-[#98A2B3]">
                  6 DIGITS
                </span>
              </div>

              <div
                className={`flex h-[34px] items-center gap-[7px] rounded-[5px] border bg-white px-[7px] transition ${
                  pinError ? "border-[#344054]" : "border-[#D0D5DD]"
                }`}
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <input
                    key={`new-pin-${index}`}
                    type={showSecurityPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={1}
                    value={securityPin[index] || ""}
                    onChange={(event) =>
                      updatePinDigit(setSecurityPin, securityPin, index, event.target.value)
                    }
                    className="h-[27px] w-[27px] rounded-[3px] border border-[#D0D5DD] bg-white text-center text-[11px] font-semibold text-[#344054] outline-none transition focus:border-[#A9070B] focus:ring-1 focus:ring-[#A9070B]"
                    aria-label={`New PIN digit ${index + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowSecurityPin((value) => !value)}
                  className="ml-auto shrink-0 text-[#667085] transition hover:text-[#344054]"
                  aria-label="Show or hide new PIN"
                >
                  <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </button>
              </div>

              {pinError && (
                <div className="mt-[5px] flex items-start gap-1 text-[7px] leading-[10px] text-[#7A7F8C]">
                  <span className="mt-[1px] font-bold text-[#D92D20]">ⓘ</span>
                  <span>{pinError}</span>
                </div>
              )}
            </div>

            <div className={`${pinError ? "mt-[9px]" : "mt-[10px]"}`}>
              <div className="mb-[5px] flex items-center justify-between">
                <label className="text-[9px] font-semibold text-[#344054]">
                  Confirm Security PIN <span className="text-[#A9070B]">*</span>
                </label>
                <span className="text-[8px] font-medium uppercase tracking-wide text-[#98A2B3]">
                  MATCH NEW PIN
                </span>
              </div>

              <div className="flex h-[34px] items-center gap-[7px] rounded-[5px] border border-[#E4E7EC] bg-[#F8FAFC] px-[7px]">
                {Array.from({ length: 6 }).map((_, index) => (
                  <input
                    key={`confirm-pin-${index}`}
                    type={showConfirmSecurityPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={1}
                    value={confirmSecurityPin[index] || ""}
                    onChange={(event) =>
                      updatePinDigit(setConfirmSecurityPin, confirmSecurityPin, index, event.target.value)
                    }
                    className="h-[27px] w-[27px] rounded-[3px] border border-[#D0D5DD] bg-white text-center text-[11px] font-semibold text-[#344054] outline-none transition focus:border-[#A9070B] focus:ring-1 focus:ring-[#A9070B]"
                    aria-label={`Confirm PIN digit ${index + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setShowConfirmSecurityPin((value) => !value)}
                  className="ml-auto shrink-0 text-[#667085] transition hover:text-[#344054]"
                  aria-label="Show or hide confirmed PIN"
                >
                  <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-[9px] flex items-center gap-1.5 rounded-[4px] border border-[#E4E7EC] bg-[#F8FAFC] px-[7px] py-[6px] text-[7px] leading-[10px] text-[#667085]">
              <svg viewBox="0 0 24 24" className="h-[11px] w-[11px] shrink-0 text-[#475467]" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3 5 6v5c0 4.5 2.9 7.9 7 10 4.1-2.1 7-5.5 7-10V6l-7-3Z" />
                <path d="m9.5 12 1.7 1.7 3.5-3.5" />
              </svg>
              <span>Keep your Security PIN private. Do not share it with other users.</span>
            </div>

            <button
              type="button"
              onClick={handlePinSetup}
              className="mt-[9px] h-[29px] w-full rounded-[3px] bg-[#A9070B] text-[9px] font-semibold text-white transition hover:bg-[#870509]"
            >
              Set Up PIN →
            </button>

            <button
              type="button"
              onClick={resetPinForm}
              className="mt-[4px] h-[27px] w-full rounded-[3px] border border-[#D0D5DD] bg-white text-[8px] font-medium text-[#475467] transition hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>

            <div className="mt-[7px] border-t border-[#F2F4F7] pt-[6px] text-center text-[6px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <span className="mr-1">♙</span>
              256-BIT ENCRYPTED HOSPITAL ADMINISTRATION PROTOCOL
            </div>
          </div>
        </div>
      )}

      {pinSuccess && (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center bg-black/30 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="security-pin-success-title"
        >
          <div className="w-full max-w-[430px] rounded-2xl bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m6 12 4 4 8-8" />
              </svg>
            </div>

            <h2 id="security-pin-success-title" className="text-[19px] font-bold text-[#202938]">
              Security PIN Set Successfully
            </h2>
            <p className="mx-auto mt-2 max-w-[320px] text-[11px] leading-4.5 text-[#667085]">
              Your Security PIN can now be used to authorize protected system actions.
            </p>

            <div className="mt-5 rounded-md border border-[#E4E7EC] bg-[#F8FAFC] p-3 text-left">
              <p className="text-[10px] font-semibold text-[#344054]">
                🛡 Protected Actions Active
              </p>
              <p className="mt-1 text-[9px] leading-4 text-[#667085]">
                Record resets and high-level system overrides will require PIN authorization.
              </p>
              {pinConfiguredAt && (
                <p className="mt-2 text-[8px] text-[#98A2B3]">
                  Configured on {pinConfiguredAt.toLocaleString()} • Super Admin
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setPinSuccess(false);
                setPinSetupRequired(false);
                resetPinForm();
              }}
              className="mt-5 h-10 w-full rounded-md bg-[#A9070B] text-[10px] font-semibold text-white transition hover:bg-[#870509]"
            >
              DONE
            </button>

            <p className="mt-2 text-[8px] text-[#98A2B3]">
              You can update your PIN anytime in Settings.
            </p>
          </div>
        </div>
      )}


    </div>
  );
}