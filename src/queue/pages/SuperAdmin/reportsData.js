import { initialsOf, personName } from '../Admin/reportData';
import { normalizeRole, getRoleName } from '../Admin/AdminScreens';

// =====================================================
// SUPER ADMIN REPORTS - DATA
// =====================================================
//
// Pure functions: they turn the raw queue rows (all departments) plus the
// departments, terminals, staff and kiosks into the rows each report shows.
// Nothing here fetches or invents data.
//
// What the database does NOT hold: staff login / logout times, and a skip
// reason. The staff report therefore only knows who is holding a terminal
// right now (that is the "Active (Online)" chip) and leaves the two time
// columns empty.

export const SA_REPORT_TYPES = ['department', 'staff', 'served'];

export const SA_PAGE_SIZE = { department: 4, staff: 4, served: 5 };

const isActive = (value) => String(value || '').toLowerCase() === 'active';

// "BP-1", as the Kiosk Management screen writes a terminal code.
export function terminalCode(terminal) {
  if (!terminal) return '';

  return terminal.prefix
    ? `${terminal.prefix}-${terminal.counter_number}`
    : `T${terminal.counter_number}`;
}

const byTerminalNumber = (a, b) => Number(a.counter_number) - Number(b.counter_number);

// `departmentIds` / `kioskIds` are null when nothing is filtered.
export function visibleDepartments(departments, departmentIds, kioskIds) {
  const departmentSet = departmentIds ? new Set(departmentIds.map(String)) : null;
  const kioskSet = kioskIds ? new Set(kioskIds.map(String)) : null;

  return departments.filter(
    (department) =>
      (!departmentSet || departmentSet.has(String(department.department_id))) &&
      (!kioskSet || kioskSet.has(String(department.kiosk_id)))
  );
}

// 'cancelled' is how the backend stores a skipped ticket.
function tally(rows) {
  return {
    total: rows.length,
    served: rows.filter((row) => row.status === 'completed').length,
    skipped: rows.filter((row) => row.status === 'cancelled').length,
  };
}

export function buildSuperAdminReport(
  type,
  { rows, departments, terminals, users, kiosks, departmentIds, kioskIds }
) {
  const shown = visibleDepartments(departments, departmentIds, kioskIds);
  const shownIds = new Set(shown.map((department) => String(department.department_id)));
  const shownRows = rows.filter((row) => shownIds.has(String(row.department_id)));

  const userById = new Map(users.map((person) => [String(person.user_id), person]));
  const kioskById = new Map(kiosks.map((kiosk) => [String(kiosk.kiosk_id), kiosk]));
  const departmentById = new Map(departments.map((department) => [String(department.department_id), department]));

  const terminalsOf = (department) =>
    terminals
      .filter((terminal) => String(terminal.department_id) === String(department.department_id))
      .sort(byTerminalNumber);

  if (type === 'department') {
    return {
      records: shown.map((department) => ({
        key: department.department_id,
        department: department.name,
        ...tally(shownRows.filter((row) => String(row.department_id) === String(department.department_id))),
        terminals: terminalsOf(department).map((terminal) => {
          const person = userById.get(String(terminal.assigned_staff_id));

          return {
            key: terminal.counter_id,
            label: `T${terminal.counter_number}`,
            staffName: person ? personName(person) : '',
          };
        }),
      })),
    };
  }

  if (type === 'served') {
    // Only departments that are switched on appear in this report.
    const active = shown.filter((department) => isActive(department.status));

    const lines = active.map((department) => {
      const own = shownRows.filter(
        (row) => String(row.department_id) === String(department.department_id) && row.status === 'completed'
      );

      return {
        key: department.department_id,
        department: department.name,
        location:
          department.location ||
          kioskById.get(String(department.kiosk_id))?.name ||
          '',
        activeTerminals: terminalsOf(department).filter((terminal) => isActive(terminal.status)).length,
        served: own.length,
      };
    });

    const servedTotal = lines.reduce((sum, line) => sum + line.served, 0);

    const records = lines
      .map((line) => ({
        ...line,
        share: servedTotal > 0 ? (line.served / servedTotal) * 100 : 0,
      }))
      .sort((a, b) => b.served - a.served || a.department.localeCompare(b.department));

    return {
      records,
      summary: {
        departments: records.length,
        activeTerminals: records.reduce((sum, line) => sum + line.activeTerminals, 0),
        served: servedTotal,
      },
    };
  }

  // staff: everyone with the staff role in a visible department, plus anyone
  // currently holding a terminal in one.
  const terminalByStaff = new Map();

  terminals.forEach((terminal) => {
    if (terminal.assigned_staff_id && shownIds.has(String(terminal.department_id))) {
      terminalByStaff.set(String(terminal.assigned_staff_id), terminal);
    }
  });

  const staffIds = new Set(terminalByStaff.keys());

  users.forEach((person) => {
    if (
      normalizeRole(getRoleName(person)) === 'staff' &&
      shownIds.has(String(person.department_id))
    ) {
      staffIds.add(String(person.user_id));
    }
  });

  const records = [...staffIds].map((id) => {
    const person = userById.get(id);
    const terminal = terminalByStaff.get(id);

    // The queue rows carry the name of whoever holds the terminal, which is
    // all there is for a person who is not in the staff list.
    const row = shownRows.find((item) => String(item.staff_id) === id);
    const name = person ? personName(person) : row?.staff_name || '';

    const departmentRecord =
      departmentById.get(String(terminal?.department_id ?? person?.department_id)) || null;

    return {
      key: id,
      name,
      initials: initialsOf(name),
      department: departmentRecord?.name || '',
      served: shownRows.filter((item) => String(item.staff_id) === id && item.status === 'completed').length,
      terminal: terminal ? terminalCode(terminal) : '',
      terminalName: terminal ? String(terminal.counter_number) : '',
      online: Boolean(terminal),
      loginAt: null,
      logoutAt: null,
    };
  });

  records.sort((a, b) => b.served - a.served || a.name.localeCompare(b.name));

  return { records };
}

// Search across the text a row shows.
export function searchRecord(record, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return Object.entries(record).some(([field, value]) => {
    if (field === 'key') return false;

    if (Array.isArray(value)) {
      return value.some((item) => `${item.label} ${item.staffName}`.toLowerCase().includes(needle));
    }

    if (typeof value === 'object' && value !== null) return false;
    if (typeof value === 'boolean') return false;

    return String(value ?? '').toLowerCase().includes(needle);
  });
}
