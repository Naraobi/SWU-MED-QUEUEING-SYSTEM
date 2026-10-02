import { MONTHS_SHORT, formatMonthYear } from './i18n';
import { startOfDay, toDateKey } from './adminHelpers';

// =====================================================
// REPORT DATA HELPERS (Admin → Reports)
// =====================================================
//
// Pure functions: they turn the raw per-ticket rows plus the
// department's terminals and staff into the rows each report shows.
// Nothing here fetches or invents data.

export const REPORT_TYPES = ['department', 'staff', 'terminal', 'queue'];

export const DEFAULT_PAGE_SIZE = 4;

export function terminalLabel(terminal) {
  if (!terminal) return '';
  return terminal.prefix || `T-${terminal.counter_number}`;
}

export function personName(person) {
  return [person?.first_name, person?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Minutes between service start and completion, or null if unknown.
export function serviceMinutes(row) {
  const start = toMs(row.service_began_at);
  const end = toMs(row.completed_at);

  if (start === null || end === null) return null;
  return Math.max(0, (end - start) / 60000);
}

function averageMinutes(rows) {
  const values = rows
    .filter((row) => row.status === 'completed')
    .map(serviceMinutes)
    .filter((value) => value !== null);

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countStatus(rows, status) {
  return rows.filter((row) => row.status === status).length;
}

// 'cancelled' is how the backend stores a skipped ticket.
function tally(rows) {
  return {
    total: rows.length,
    served: countStatus(rows, 'completed'),
    skipped: countStatus(rows, 'cancelled'),
  };
}

// `selectedIds` is null when every terminal is selected (no filtering).
export function filterRowsByTerminals(rows, selectedIds) {
  if (!selectedIds) return rows;
  const set = new Set(selectedIds.map(String));
  return rows.filter((row) => set.has(String(row.counter_id)));
}

export function buildReportRecords(
  type,
  { rows, terminals, staff, departmentName, selectedIds }
) {
  const filtered = filterRowsByTerminals(rows, selectedIds);
  const idSet = selectedIds ? new Set(selectedIds.map(String)) : null;

  const visibleTerminals = terminals.filter(
    (terminal) => !idSet || idSet.has(String(terminal.counter_id))
  );

  const staffById = new Map(staff.map((person) => [String(person.user_id), person]));

  const rowsByTerminal = (terminal) =>
    rows.filter((row) => String(row.counter_id) === String(terminal.counter_id));

  if (type === 'department') {
    return [
      {
        key: 'department',
        department: departmentName,
        ...tally(filtered),
        terminals: visibleTerminals.map((terminal) => {
          const person = staffById.get(String(terminal.assigned_staff_id));

          return {
            key: terminal.counter_id,
            label: terminalLabel(terminal),
            staffName: person ? personName(person) : '',
          };
        }),
      },
    ];
  }

  if (type === 'terminal') {
    return visibleTerminals.map((terminal) => {
      const own = rowsByTerminal(terminal);

      return {
        key: terminal.counter_id,
        terminal: terminalLabel(terminal),
        ...tally(own),
        avgMin: averageMinutes(own),
      };
    });
  }

  if (type === 'staff') {
    return staff
      .map((person) => {
        const terminal = terminals.find(
          (item) => String(item.assigned_staff_id) === String(person.user_id)
        );

        return { person, terminal };
      })
      .filter(({ terminal }) => !idSet || (terminal && idSet.has(String(terminal.counter_id))))
      .map(({ person, terminal }) => {
        const own = terminal ? rowsByTerminal(terminal) : [];
        const name = personName(person);

        return {
          key: person.user_id,
          name,
          initials: initialsOf(name),
          position: person.position_name || person.position || '',
          terminal: terminal ? terminalLabel(terminal) : '',
          served: countStatus(own, 'completed'),
          avgMin: averageMinutes(own),
          // The database does not record login/logout times, so there is
          // nothing real to show for these two columns.
          loginAt: null,
          logoutAt: null,
        };
      });
  }

  // queue
  const terminalById = new Map(
    terminals.map((terminal) => [String(terminal.counter_id), terminal])
  );

  return filtered.map((row) => {
    const terminal = terminalById.get(String(row.counter_id));

    return {
      key: row.queue_id,
      queueNumber: row.queue_number,
      service: row.department,
      terminal: terminal ? terminalLabel(terminal) : row.counter_prefix || '',
      status: row.status,
      calledAt: row.called_at,
      startedAt: row.service_began_at,
      completedAt: row.completed_at,
      durationMin: row.status === 'completed' ? serviceMinutes(row) : null,
    };
  });
}

export function buildTodayValue() {
  const today = startOfDay(new Date());
  return { mode: 'today', start: today, end: today };
}

export function formatDateValue(value, t, langCode) {
  if (value.mode === 'today') {
    return t('reports.date.todayLabel', { date: formatDateWithYear(value.start, langCode) });
  }

  if (value.mode === 'specific') {
    return formatDateWithYear(value.start, langCode);
  }

  if (value.mode === 'month') {
    return formatMonthYear(value.start, langCode);
  }

  return `${formatDateWithYear(value.start, langCode)} – ${formatDateWithYear(value.end, langCode)}`;
}

// =====================================================
// FORMATTING
// =====================================================

export function formatMinutes(value, t) {
  if (value === null || value === undefined) return '—';
  if (value > 0 && value < 1) return t('reports.lessThanMinute');
  return t('reports.minutes', { n: Math.round(value) });
}

export function formatClock(value, clockFormat = '12h') {
  const ms = toMs(value);
  if (ms === null) return '—';

  const date = new Date(ms);
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (clockFormat === '24h') {
    return `${String(date.getHours()).padStart(2, '0')}:${minutes}`;
  }

  const hours12 = date.getHours() % 12 || 12;
  const suffix = date.getHours() < 12 ? 'AM' : 'PM';

  return `${String(hours12).padStart(2, '0')}:${minutes} ${suffix}`;
}

export function formatDateWithYear(date, langCode = 'en') {
  const months = MONTHS_SHORT[langCode] || MONTHS_SHORT.en;
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function monthRange(year, month) {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  };
}

export function daysInclusive(start, end) {
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / 86400000) + 1;
}

// Used in the export file name: 2026-10-01 or 2026-09-01_to_2026-09-30.
export function rangeFileLabel(range) {
  const start = toDateKey(range.start);
  const end = toDateKey(range.end);
  return start === end ? start : `${start}_to_${end}`;
}

export function searchMatches(record, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return Object.entries(record).some(([field, value]) => {
    if (field === 'key') return false;

    if (Array.isArray(value)) {
      return value.some((item) =>
        `${item.label} ${item.staffName}`.toLowerCase().includes(needle)
      );
    }

    return String(value ?? '').toLowerCase().includes(needle);
  });
}
