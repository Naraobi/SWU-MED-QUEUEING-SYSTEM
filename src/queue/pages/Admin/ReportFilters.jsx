import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  Monitor,
  Search,
} from 'lucide-react';

import { addMonths, buildMonthGrid, startOfDay, startOfMonth, toDateKey } from './adminHelpers';
import { WEEKDAYS_SHORT_MON_FIRST, MONTHS_LONG, MONTHS_SHORT, formatMonthYear } from './i18n';
import { useLanguage } from './LanguageContext';
import { REPORT_TYPES, buildTodayValue, daysInclusive, formatDateValue, formatDateWithYear, monthRange } from './reportData';

// =====================================================
// ADMIN REPORT FILTERS
// =====================================================
//
// Report-type, date, and terminal dropdowns for the Admin Reports
// page. Admin-only: every colour that is "the accent" reads the
// --admin-accent variable set on the Admin shell, so the Settings
// colour picker restyles them. Neutral greys use the same Tailwind
// classes the rest of Admin uses, which the dark theme already remaps.

export const ACCENT = 'var(--admin-accent)';
export const ON_ACCENT = 'var(--rep-on-accent, #ffffff)';
// eslint-disable-next-line react-refresh/only-export-components
export const tint = (percent) => `color-mix(in srgb, var(--admin-accent) ${percent}%, transparent)`;

// Closes a popover on an outside click or Escape.
// eslint-disable-next-line react-refresh/only-export-components
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;

    function handleDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    }

    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, open, onClose]);
}

export function TriggerButton({ icon: Icon, label, open, onClick, ariaLabel, haspopup = 'dialog', minWidth }) {
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={haspopup}
      aria-expanded={open}
      aria-label={ariaLabel}
      style={{ minWidth, borderColor: open ? ACCENT : undefined }}
      className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[#C3C6D7] bg-white px-3 text-xs font-semibold text-[#1F2937] outline-none transition hover:border-[#9D0A0E]"
    >
      <span className="flex min-w-0 items-center gap-2">
        {Icon && <Icon size={14} className="shrink-0 text-[#4B5563]" />}
        <span className="truncate">{label}</span>
      </span>
      <Chevron size={14} className="shrink-0 text-slate-400" />
    </button>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const primaryButtonProps = {
  style: { backgroundColor: ACCENT, color: ON_ACCENT },
  className: 'rounded-md px-4 py-1.5 text-xs font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
};

// =====================================================
// REPORT TYPE DROPDOWN
// =====================================================

// `types` / `labelOf` are optional: Super Admin passes its own three reports.
// Left out, this is the Admin dropdown exactly as before.
export function ReportTypeDropdown({ value, onChange, types = REPORT_TYPES, labelOf }) {
  const { t } = useLanguage();
  const labelFor = (type) => (labelOf ? labelOf(type, t) : t(`reports.type.${type}`));
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef(null);
  const optionRefs = useRef([]);

  useDismiss(rootRef, open, () => setOpen(false));

  useEffect(() => {
    if (open) optionRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  function openPanel() {
    setFocusIndex(Math.max(0, types.indexOf(value)));
    setOpen(true);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex((index) => (index + 1) % types.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex((index) => (index - 1 + types.length) % types.length);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <TriggerButton
        label={labelFor(value)}
        open={open}
        haspopup="listbox"
        ariaLabel={t('reports.type.label')}
        onClick={() => (open ? setOpen(false) : openPanel())}
        minWidth={190}
      />

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">
              {t('reports.type.select')}
            </span>
            <span className="rounded bg-[#F1F3F5] px-2 py-0.5 text-[10px] font-semibold text-[#4B5563]">
              {t('reports.type.count', { n: types.length })}
            </span>
          </div>

          <div role="listbox" aria-label={t('reports.type.select')} onKeyDown={handleKeyDown} className="space-y-1 p-2">
            {types.map((type, index) => {
              const selected = type === value;

              return (
                <button
                  key={type}
                  ref={(node) => { optionRefs.current[index] = node; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(type);
                    setOpen(false);
                  }}
                  style={selected ? { backgroundColor: tint(10), boxShadow: `inset 3px 0 0 ${ACCENT}` } : undefined}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-[#1F2937] outline-none transition hover:bg-[#F1F3F5] focus-visible:ring-2"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#F1F3F5] text-[#4B5563]"
                    style={selected ? { backgroundColor: tint(15), color: ACCENT } : undefined}
                  >
                    <FileText size={15} />
                  </span>

                  <span className="flex-1" style={selected ? { color: ACCENT } : undefined}>
                    {labelFor(type)}
                  </span>

                  {selected && (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: tint(15), color: ACCENT }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// DATE DROPDOWN
// =====================================================
//
// value = { mode: 'today' | 'specific' | 'month' | 'custom', start: Date, end: Date }

const DATE_TABS = ['today', 'specific', 'month', 'custom'];

function CalendarGrid({ viewMonth, onViewMonth, today, selectedStart, selectedEnd, onPick }) {
  const { t, langCode } = useLanguage();

  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const startKey = selectedStart ? toDateKey(selectedStart) : null;
  const endKey = selectedEnd ? toDateKey(selectedEnd) : startKey;
  const todayKey = toDateKey(today);
  const canGoNext = addMonths(startOfMonth(viewMonth), 1) <= today;
  const weekdays = WEEKDAYS_SHORT_MON_FIRST[langCode] || WEEKDAYS_SHORT_MON_FIRST.en;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[#1F2937]">{formatMonthYear(viewMonth, langCode)}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('reports.date.prevMonth')}
            onClick={() => onViewMonth(addMonths(viewMonth, -1))}
            className="rounded p-1 text-slate-500 hover:bg-[#F1F3F5]"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            aria-label={t('reports.date.nextMonth')}
            disabled={!canGoNext}
            onClick={() => onViewMonth(addMonths(viewMonth, 1))}
            className="rounded p-1 text-slate-500 hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400">
        {weekdays.map((label, index) => (
          <span key={`${label}-${index}`} className="py-1">{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }) => {
          const key = toDateKey(date);
          const isFuture = key > todayKey;
          const isEdge = key === startKey || key === endKey;
          const inRange = startKey && endKey && key >= startKey && key <= endKey && startKey !== endKey;

          return (
            <button
              key={key}
              type="button"
              disabled={isFuture || !inMonth}
              onClick={() => onPick(date)}
              style={inRange && !isEdge ? { backgroundColor: tint(12) } : undefined}
              className={`flex h-8 items-center justify-center text-[11px] font-semibold ${
                !inMonth ? 'invisible' : isFuture ? 'cursor-not-allowed text-slate-300' : 'text-[#1F2937]'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-md ${
                  isEdge || isFuture || !inMonth ? '' : 'hover:bg-[#F1F3F5]'
                }`}
                style={isEdge ? { backgroundColor: ACCENT, color: ON_ACCENT } : undefined}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateFilterDropdown({ value, onApply }) {
  const { t, langCode } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const today = useMemo(() => startOfDay(new Date()), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState(value.mode);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value.start));
  const [specific, setSpecific] = useState(value.start);
  const [monthPick, setMonthPick] = useState({ year: value.start.getFullYear(), month: value.start.getMonth() });
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);
  const [activeField, setActiveField] = useState('start');

  useDismiss(rootRef, open, () => setOpen(false));

  function openPanel() {
    setTab(value.mode);
    setViewMonth(startOfMonth(value.start));
    setSpecific(value.start);
    setMonthPick({ year: value.start.getFullYear(), month: value.start.getMonth() });
    setCustomStart(value.start);
    setCustomEnd(value.end);
    setActiveField('start');
    setOpen(true);
  }

  function commit(next) {
    onApply(next);
    setOpen(false);
  }

  const monthSpan = monthRange(monthPick.year, monthPick.month);
  const monthEnd = monthSpan.end > today ? today : monthSpan.end;
  const customInvalid = Boolean(customStart && customEnd && customEnd < customStart);

  function pickCustom(date) {
    if (activeField === 'start') {
      setCustomStart(date);
      // A start later than the current end would be invalid; clear the end
      // so the user picks it next instead of seeing an error straight away.
      if (customEnd && customEnd < date) setCustomEnd(null);
      setActiveField('end');
    } else {
      setCustomEnd(date);
    }
  }

  function apply() {
    if (tab === 'today') commit(buildTodayValue());
    else if (tab === 'specific') commit({ mode: 'specific', start: specific, end: specific });
    else if (tab === 'month') commit({ mode: 'month', start: monthSpan.start, end: monthEnd });
    else if (!customInvalid && customStart && customEnd) commit({ mode: 'custom', start: customStart, end: customEnd });
  }

  const canApply = tab !== 'custom' || (customStart && customEnd && !customInvalid);
  const months = MONTHS_SHORT[langCode] || MONTHS_SHORT.en;
  const monthsLong = MONTHS_LONG[langCode] || MONTHS_LONG.en;

  const fieldClass = (invalid) =>
    `flex h-9 w-full items-center gap-2 rounded-md border bg-white px-3 text-left text-xs ${
      invalid ? 'border-red-500' : 'border-[#E5E7EB]'
    }`;

  return (
    <div className="relative" ref={rootRef}>
      <TriggerButton
        icon={CalendarDays}
        label={formatDateValue(value, t, langCode)}
        open={open}
        ariaLabel={t('reports.date.label')}
        onClick={() => (open ? setOpen(false) : openPanel())}
        minWidth={210}
      />

      {open && (
        <div
          role="dialog"
          aria-label={t('reports.date.range')}
          className="absolute left-0 z-30 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-xs font-bold text-[#1F2937]">{t('reports.date.range')}</span>
            {tab === 'today' ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                {t('reports.date.live')}
              </span>
            ) : (
              <span className="text-[10px] font-semibold" style={{ color: ACCENT }}>
                {t(`reports.date.${tab}`)}
              </span>
            )}
          </div>

          <div className="mx-4 mt-3 grid grid-cols-4 gap-1 rounded-lg bg-[#F1F3F5] p-1" role="tablist">
            {DATE_TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                style={tab === key ? { color: ACCENT } : undefined}
                className={`rounded-md py-1.5 text-[11px] font-semibold ${
                  tab === key ? 'bg-white shadow-sm' : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                {t(`reports.date.tab.${key}`)}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {tab === 'today' && (
              <button
                type="button"
                onClick={() => commit(buildTodayValue())}
                style={{ backgroundColor: tint(8), borderColor: tint(40) }}
                className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left"
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full border-2"
                  style={{ borderColor: ACCENT }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                </span>

                <span className="flex-1">
                  <span className="block text-xs font-bold" style={{ color: ACCENT }}>{t('reports.date.tab.today')}</span>
                  <span className="block text-[11px] text-[#4B5563]">
                    {t('reports.date.todayLive', { date: formatDateWithYear(today, langCode) })}
                  </span>
                </span>

                <Check size={14} style={{ color: ACCENT }} />
              </button>
            )}

            {tab === 'specific' && (
              <CalendarGrid
                viewMonth={viewMonth}
                onViewMonth={setViewMonth}
                today={today}
                selectedStart={specific}
                selectedEnd={specific}
                onPick={setSpecific}
              />
            )}

            {tab === 'month' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1F2937]">{monthPick.year}</span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t('reports.date.prevYear')}
                      onClick={() => setMonthPick((p) => ({ ...p, year: p.year - 1 }))}
                      className="rounded p-1 text-slate-500 hover:bg-[#F1F3F5]"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    <button
                      type="button"
                      aria-label={t('reports.date.nextYear')}
                      disabled={monthPick.year >= today.getFullYear()}
                      onClick={() => setMonthPick((p) => ({ ...p, year: p.year + 1 }))}
                      className="rounded p-1 text-slate-500 hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {months.map((label, index) => {
                    const future =
                      monthPick.year > today.getFullYear() ||
                      (monthPick.year === today.getFullYear() && index > today.getMonth());
                    const selected = monthPick.month === index;

                    return (
                      <button
                        key={label}
                        type="button"
                        disabled={future}
                        aria-label={`${monthsLong[index]} ${monthPick.year}`}
                        onClick={() => setMonthPick((p) => ({ ...p, month: index }))}
                        style={selected && !future ? { backgroundColor: ACCENT, color: ON_ACCENT } : undefined}
                        className={`rounded-lg py-2.5 text-xs font-semibold ${
                          future
                            ? 'cursor-not-allowed text-slate-300'
                            : selected
                              ? ''
                              : 'text-[#1F2937] hover:bg-[#F1F3F5]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 flex items-center justify-between text-[11px] text-[#4B5563]">
                  <span>{t('reports.date.rangeCovered')}</span>
                  <span className="font-semibold text-[#1F2937]">
                    {formatDateWithYear(monthSpan.start, langCode)} – {formatDateWithYear(monthEnd, langCode)}
                  </span>
                </p>
              </div>
            )}

            {tab === 'custom' && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#4B5563]">{t('reports.date.startDate')}</p>
                  <button
                    type="button"
                    onClick={() => setActiveField('start')}
                    style={activeField === 'start' ? { borderColor: ACCENT } : undefined}
                    className={fieldClass(false)}
                  >
                    <CalendarDays size={13} className="text-slate-400" />
                    {customStart ? formatDateWithYear(customStart, langCode) : '—'}
                  </button>
                </div>

                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#4B5563]">{t('reports.date.endDate')}</p>
                  <button
                    type="button"
                    onClick={() => setActiveField('end')}
                    style={activeField === 'end' && !customInvalid ? { borderColor: ACCENT } : undefined}
                    className={fieldClass(customInvalid)}
                  >
                    <CalendarDays size={13} className="text-slate-400" />
                    {customEnd ? formatDateWithYear(customEnd, langCode) : '—'}
                  </button>
                  {customInvalid && (
                    <p role="alert" className="mt-1 text-[11px] font-semibold text-red-600">
                      {t('reports.date.invalidRange')}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-2">
                  {customStart && customEnd && !customInvalid && (
                    <p className="mb-1 text-right text-[10px] font-semibold" style={{ color: ACCENT }}>
                      {t('reports.date.daysSelected', { n: daysInclusive(customStart, customEnd) })}
                    </p>
                  )}
                  <CalendarGrid
                    viewMonth={viewMonth}
                    onViewMonth={setViewMonth}
                    today={today}
                    selectedStart={customStart}
                    selectedEnd={customEnd}
                    onPick={pickCustom}
                  />
                </div>
              </div>
            )}

            {tab === 'specific' && (
              <p className="mt-2 flex items-center justify-between text-[11px] text-[#4B5563]">
                <span>{t('reports.date.selected')}</span>
                <span className="rounded bg-[#F1F3F5] px-2 py-0.5 font-semibold text-[#1F2937]">
                  {formatDateWithYear(specific, langCode)}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3">
            {tab === 'today' ? (
              <span className="text-[11px] text-[#4B5563]">{t('reports.date.appliedImmediately')}</span>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#4B5563] hover:bg-[#F1F3F5]"
              >
                {t('common.cancel')}
              </button>
            )}

            <button type="button" onClick={apply} disabled={!canApply} {...primaryButtonProps}>
              {t('reports.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// TERMINAL DROPDOWN
// =====================================================
//
// terminals: [{ id, label, subtitle }]  (already limited to the Admin's department)
// value: null (all terminals) or an array of selected ids.

// `icon` / `labelKeys` are optional: Super Admin reuses this list as its Kiosk
// filter. Left out, it is the Admin terminal dropdown exactly as before.
export function TerminalFilterDropdown({ terminals, value, onApply, icon: TriggerIcon = Monitor, labelKeys }) {
  const { t } = useLanguage();
  const k = {
    filter: 'reports.terminal.filter',
    all: 'reports.terminal.all',
    count: 'reports.terminal.count',
    search: 'reports.terminal.search',
    none: 'reports.terminal.none',
    clearAll: 'reports.terminal.clearAll',
    ...labelKeys,
  };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState([]);
  const rootRef = useRef(null);

  useDismiss(rootRef, open, () => setOpen(false));

  const allIds = useMemo(() => terminals.map((terminal) => String(terminal.id)), [terminals]);

  function openPanel() {
    setPending(value ? value.map(String) : allIds);
    setQuery('');
    setOpen(true);
  }

  const visible = terminals.filter((terminal) =>
    `${terminal.label} ${terminal.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const allSelected = pending.length === allIds.length;

  function toggle(id) {
    setPending((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function apply() {
    // Nothing ticked or everything ticked both mean "no terminal filter".
    const next = pending.length === 0 || allSelected ? null : pending;
    onApply(next);
    setOpen(false);
  }

  let triggerLabel = t(k.all);

  if (value && value.length === 1) {
    triggerLabel = terminals.find((terminal) => String(terminal.id) === String(value[0]))?.label || triggerLabel;
  } else if (value && value.length > 1) {
    triggerLabel = t(k.count, { n: value.length });
  }

  return (
    <div className="relative" ref={rootRef}>
      <TriggerButton
        icon={TriggerIcon}
        label={triggerLabel}
        open={open}
        ariaLabel={t(k.filter)}
        onClick={() => (open ? setOpen(false) : openPanel())}
        minWidth={170}
      />

      {open && (
        <div
          role="dialog"
          aria-label={t(k.filter)}
          className="absolute left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        >
          <div className="p-3">
            <label className="flex items-center gap-2 rounded-md border border-[#E5E7EB] px-2.5 py-2">
              <Search size={13} className="text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(k.search)}
                aria-label={t(k.search)}
                className="w-full bg-transparent text-xs text-[#1F2937] outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <label
            className="mx-3 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2"
            style={allSelected ? { backgroundColor: tint(8) } : undefined}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setPending(allSelected ? [] : allIds)}
              style={{ accentColor: ACCENT }}
              className="h-4 w-4"
            />
            <span className="flex-1 text-xs font-bold text-[#1F2937]">{t(k.all)}</span>
            <span className="text-[10px] font-semibold text-slate-400">
              {pending.length}/{allIds.length}
            </span>
          </label>

          <div className="max-h-56 overflow-y-auto px-3 py-1">
            {visible.length === 0 && (
              <p className="py-4 text-center text-[11px] text-slate-400">{t(k.none)}</p>
            )}

            {visible.map((terminal) => {
              const id = String(terminal.id);

              return (
                <label key={id} className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 hover:bg-[#F1F3F5]">
                  <input
                    type="checkbox"
                    checked={pending.includes(id)}
                    onChange={() => toggle(id)}
                    style={{ accentColor: ACCENT }}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-[#1F2937]">{terminal.label}</span>
                    <span className="block truncate text-[10px] text-slate-400">{terminal.subtitle}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3">
            <button
              type="button"
              onClick={() => setPending([])}
              className="text-xs font-semibold hover:underline"
              style={{ color: ACCENT }}
            >
              {t(k.clearAll)}
            </button>

            <button type="button" onClick={apply} {...primaryButtonProps}>
              {t('reports.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
