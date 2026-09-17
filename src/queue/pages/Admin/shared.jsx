import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  RANGE_PRESETS,
  addMonths,
  buildMonthGrid,
  formatRangeLabel,
  getPresetRange,
  startOfMonth,
  toDateKey,
} from './adminHelpers';

import { formatMonthYear, WEEKDAYS_SHORT_MON_FIRST } from './i18n';
import { useLanguage } from './LanguageContext';

// =====================================================
// DATE RANGE PICKER
// =====================================================
//
// Shared "Today ▾ / Apply Filter / Reset" calendar popover
// used by Dashboard, Queue Management, and Reports & Analytics.
//
export function DateRangePicker({
  value,
  onApply,
}) {
  const { t, langCode } = useLanguage();

  const [isOpen, setIsOpen] =
    useState(false);

  const [viewMonth, setViewMonth] =
    useState(() =>
      startOfMonth(
        value?.start || new Date()
      )
    );

  const [pendingStart, setPendingStart] =
    useState(null);

  const [pendingEnd, setPendingEnd] =
    useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleOutsideClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );
  }, [isOpen]);

  function openPicker() {
    setViewMonth(
      startOfMonth(
        value?.start || new Date()
      )
    );

    setPendingStart(null);
    setPendingEnd(null);
    setIsOpen(true);
  }

  function commit(range) {
    onApply(range);
    setIsOpen(false);
    setPendingStart(null);
    setPendingEnd(null);
  }

  function handleDayClick(date) {
    if (!pendingStart || pendingEnd) {
      setPendingStart(date);
      setPendingEnd(null);
      return;
    }

    const start =
      date < pendingStart
        ? date
        : pendingStart;

    const end =
      date < pendingStart
        ? pendingStart
        : date;

    commit({
      start,
      end,
      preset: null,
    });
  }

  const previewStart =
    pendingStart || value?.start || null;

  const previewEnd = pendingStart
    ? pendingEnd || pendingStart
    : value?.end || null;

  const startKey = previewStart
    ? toDateKey(previewStart)
    : null;

  const endKey = previewEnd
    ? toDateKey(previewEnd)
    : null;

  const monthCells = buildMonthGrid(
    viewMonth
  );

  return (
    <div
      className="relative"
      ref={containerRef}
    >
      <button
        type="button"
        onClick={() =>
          isOpen
            ? setIsOpen(false)
            : openPicker()
        }
        className="flex h-9 items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 text-xs text-[#4B5563] outline-none hover:border-[#9D0A0E] focus:border-[#9D0A0E]"
      >
        <CalendarDays
          size={14}
          className="text-[#4B5563]"
        />

        {formatRangeLabel(value, langCode)}

        <ChevronDown
          size={13}
          className="text-slate-400"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 flex overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-lg">

          {/* QUICK OPTIONS */}

          <div className="flex w-32 flex-col gap-0.5 border-r border-[#E5E7EB] p-2">

            {RANGE_PRESETS.map(
              (preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    commit(
                      getPresetRange(
                        preset
                      )
                    )
                  }
                  className="rounded-md px-2 py-1.5 text-left text-xs text-[#4B5563] hover:bg-[#F1F3F5]"
                >
                  {t(`dateRange.preset.${preset}`)}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() =>
                commit(
                  getPresetRange(
                    'Today'
                  )
                )
              }
              className="mt-4 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-[#9D0A0E] hover:bg-[#9D0A0E]/5"
            >
              {t('common.reset')}
            </button>
          </div>

          {/* CALENDAR */}

          <div className="w-64 p-3">

            <div className="mb-2 flex items-center justify-between">

              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (month) =>
                      addMonths(
                        month,
                        -1
                      )
                  )
                }
                className="rounded p-1 text-slate-400 hover:bg-[#F1F3F5]"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="text-xs font-bold text-[#1F2937]">
                {formatMonthYear(viewMonth, langCode)}
              </span>

              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (month) =>
                      addMonths(
                        month,
                        1
                      )
                  )
                }
                className="rounded p-1 text-slate-400 hover:bg-[#F1F3F5]"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400">
              {(WEEKDAYS_SHORT_MON_FIRST[langCode] || WEEKDAYS_SHORT_MON_FIRST.en).map((label, index) => (
                <span
                  key={`${label}-${index}`}
                  className="py-1"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7">

              {monthCells.map(
                ({ date, inMonth }) => {
                  const key =
                    toDateKey(date);

                  const isStart =
                    key === startKey;

                  const isEnd =
                    key === endKey;

                  const inRange =
                    startKey &&
                    endKey &&
                    key >= startKey &&
                    key <= endKey;

                  const showBand =
                    inRange &&
                    startKey !== endKey;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        handleDayClick(
                          date
                        )
                      }
                      className={`relative flex h-8 items-center justify-center text-[11px] ${
                        inMonth
                          ? 'text-[#1F2937]'
                          : 'text-slate-300'
                      }`}
                    >
                      {showBand && (
                        <span
                          className={`absolute inset-y-0 bg-[#B34C4C]/15 ${
                            isStart
                              ? 'left-1/2 right-0'
                              : isEnd
                                ? 'left-0 right-1/2'
                                : 'left-0 right-0'
                          }`}
                        />
                      )}

                      <span
                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                          isStart || isEnd
                            ? 'bg-[#9D0A0E] text-white'
                            : ''
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// STAT CARD
// =====================================================
//
// Shared small metric card: label + icon chip, big value,
// uppercase caption. Used across every Admin page.
//
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
}) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#4B5563]">
          {label}
        </p>

        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#9D0A0E]/10 text-[#9D0A0E]">
          <Icon size={15} />
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-[#1F2937]">
        {value}
      </p>

      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {caption}
      </p>
    </div>
  );
}