import * as XLSX from 'xlsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  Download,
  RotateCcw,
  Search,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { auth } from '../../../firebase';
import {
  getReportData,
  getReportDepartments,
  getReportKiosks,
} from '../../services/backendApi';

const REPORT_TYPES = [
  {
    value: 'department',
    label: 'Department Performance',
  },
  {
    value: 'staff',
    label: 'Staff Performance',
  },
  {
    value: 'served',
    label: 'Served Queues',
  },
];

const PERIOD_OPTIONS = [
  {
    value: 'today',
    label: 'Today',
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
  },
  {
    value: 'week',
    label: 'This Week',
  },
  {
    value: 'month',
    label: 'This Month',
  },
];

function formatReportDate(dateValue) {
  if (!dateValue) {
    return '—';
  }

  const [year, month, day] = String(
    dateValue
  ).split('-');

  if (!year || !month || !day) {
    return String(dateValue);
  }

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}


function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateRange(period, customRange) {
  const today = new Date();

  if (period === 'today') {
    const value = formatDateInput(today);

    return {
      startDate: value,
      endDate: value,
    };
  }

  if (period === 'yesterday') {
    const yesterday = new Date(today);

    yesterday.setDate(
      today.getDate() - 1
    );

    const value = formatDateInput(
      yesterday
    );

    return {
      startDate: value,
      endDate: value,
    };
  }

  if (period === 'week') {
    const start = new Date(today);

    start.setDate(
      today.getDate() - 6
    );

    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(today),
    };
  }

  if (period === 'month') {
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    return {
      startDate: formatDateInput(start),
      endDate: formatDateInput(today),
    };
  }

  if (
    period === 'custom' &&
    customRange?.from &&
    customRange?.to
  ) {
    return {
      startDate: formatDateInput(
        customRange.from
      ),
      endDate: formatDateInput(
        customRange.to
      ),
    };
  }

  return {
    startDate: '',
    endDate: '',
  };
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDisplayDate(value) {
  if (!value) {
    return '—';
  }

  const stringValue = String(value);

  // MySQL date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    const [year, month, day] =
      stringValue.split('-').map(Number);

    const date = new Date(
      year,
      month - 1,
      day
    );

    return date.toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // ISO timestamp: 2026-09-29T16:00:00.000Z
  const date = new Date(stringValue);

  if (Number.isNaN(date.getTime())) {
    return stringValue;
  }

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDisplayMonth(value) {
  if (!value) {
    return '—';
  }

  const [year, month] = value.split('-');

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
}

function formatPercentage(value) {
  const number = Number(value || 0);

  return `${number.toFixed(1)}%`;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="h-10 w-full appearance-none rounded-lg border border-[#D9DEE7] bg-white px-3 pr-9 text-sm text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FA] disabled:text-[#9CA3AF]"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
        />
      </div>
    </div>
  );
}

function EmptyState({ loading }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="text-center">
        <FileText
          size={28}
          className="mx-auto mb-3 text-[#9CA3AF]"
        />

        <p className="text-sm font-medium text-[#4B5563]">
          {loading
            ? 'Loading report...'
            : 'No report data found'}
        </p>

        {!loading && (
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Try changing your filters.
          </p>
        )}
      </div>
    </div>
  );
}

function DepartmentTable({ rows }) {
  const totals = rows.reduce(
    (result, row) => {
      result.total += Number(row.totalQueues || 0);
      result.served += Number(row.served || 0);
      result.skipped += Number(row.skipped || 0);
      result.terminals += Number(row.terminals || 0);

      return result;
    },
    {
      total: 0,
      served: 0,
      skipped: 0,
      terminals: 0,
    }
  );

  const totalServiceRate =
    totals.total > 0
      ? (totals.served / totals.total) * 100
      : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-left">
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Department
            </th>

            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Total Queues
            </th>

            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Served
            </th>

            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Skipped
            </th>

            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Terminals
            </th>

            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Service Rate
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.departmentId || row.department}
              className="border-b border-[#EEF0F3] last:border-0 hover:bg-[#FCF8F8]"
            >
              <td className="px-5 py-3.5 font-medium text-[#1F2937]">
                {row.department}
              </td>

              <td className="px-4 py-3.5 text-right text-[#4B5563]">
                {Number(row.totalQueues || 0).toLocaleString()}
              </td>

              <td className="px-4 py-3.5 text-right font-medium text-emerald-700">
                {Number(row.served || 0).toLocaleString()}
              </td>

              <td className="px-4 py-3.5 text-right text-[#9D0A0E]">
                {Number(row.skipped || 0).toLocaleString()}
              </td>

              <td className="px-4 py-3.5 text-right text-[#4B5563]">
                {Number(row.terminals || 0).toLocaleString()}
              </td>

              <td className="px-5 py-3.5 text-right font-medium text-[#1F2937]">
                {formatPercentage(row.serviceRate)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-[#E5E7EB] bg-[#F8F9FA]">
            <td className="px-5 py-3.5 font-bold text-[#1F2937]">
              TOTAL
            </td>

            <td className="px-4 py-3.5 text-right font-bold text-[#1F2937]">
              {totals.total.toLocaleString()}
            </td>

            <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
              {totals.served.toLocaleString()}
            </td>

            <td className="px-4 py-3.5 text-right font-bold text-[#9D0A0E]">
              {totals.skipped.toLocaleString()}
            </td>

            <td className="px-4 py-3.5 text-right font-bold text-[#1F2937]">
              {totals.terminals.toLocaleString()}
            </td>

            <td className="px-5 py-3.5 text-right font-bold text-[#1F2937]">
              {formatPercentage(totalServiceRate)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StaffTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-left">
            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Staff
            </th>

            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Department
            </th>

            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Terminal
            </th>

            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Queues Served
            </th>

            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Login Timestamp
            </th>

            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Logout Timestamp
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={
                row.staffId ||
                `${row.staff}-${index}`
              }
              className="border-b border-[#EEF0F3] last:border-0 hover:bg-[#FCF8F8]"
            >
              <td className="px-5 py-3.5 font-medium text-[#1F2937]">
                {row.staff || '—'}
              </td>

              <td className="px-4 py-3.5 text-[#4B5563]">
                {row.department || '—'}
              </td>

              <td className="px-4 py-3.5 text-[#4B5563]">
                {row.terminal || '—'}
              </td>

              <td className="px-4 py-3.5 text-right font-medium text-[#1F2937]">
                {Number(
                  row.queuesServed || 0
                ).toLocaleString()}
              </td>

              <td className="px-4 py-3.5 text-[#4B5563]">
                {formatDateTime(row.loginTimestamp)}
              </td>

              <td className="px-5 py-3.5 text-[#4B5563]">
                {formatDateTime(row.logoutTimestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServedTable({
  rows,
  startDate,
  endDate,
  departmentId,
}) {
  const totalServed = rows.reduce(
    (total, row) =>
      total + Number(row.servedQueues || 0),
    0
  );

  const isMultiDay =
    startDate !== endDate;

  // Share of Total is not useful when the report
  // contains only one day and one selected department,
  // because the only row would always equal 100%.
  const isSingleDaySingleDepartment =
    !isMultiDay && departmentId !== 'all';

  const showShareOfTotal =
    !isSingleDaySingleDepartment;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA] text-left">
            {isMultiDay && (
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Date
              </th>
            )}

            <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Department
            </th>

            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Served Queues
            </th>

            {showShareOfTotal && (
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Share of Total
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const served = Number(
              row.servedQueues || 0
            );

            const share =
              totalServed > 0
                ? (served / totalServed) * 100
                : 0;

            return (
              <tr
                key={`${row.date || 'all'}-${
                  row.department || index
                }`}
                className="border-b border-[#EEF0F3] last:border-0 hover:bg-[#FCF8F8]"
              >
                {isMultiDay && (
                  <td className="px-5 py-3.5 text-[#4B5563]">
                    {formatDisplayDate(row.date)}
                  </td>
                )}

                <td className="px-5 py-3.5 font-medium text-[#1F2937]">
                  {row.department || '—'}
                </td>

                <td className="px-4 py-3.5 text-right font-medium text-[#1F2937]">
                  {served.toLocaleString()}
                </td>

                {showShareOfTotal && (
                  <td className="px-5 py-3.5 text-right text-[#4B5563]">
                    {formatPercentage(share)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-[#E5E7EB] bg-[#F8F9FA]">
            <td
              colSpan={isMultiDay ? 2 : 1}
              className="px-5 py-3.5 font-bold text-[#1F2937]"
            >
              TOTAL SERVED
            </td>

            <td className="px-4 py-3.5 text-right font-bold text-[#1F2937]">
              {totalServed.toLocaleString()}
            </td>

            {showShareOfTotal && (
              <td className="px-5 py-3.5 text-right font-bold text-[#1F2937]">
                100.0%
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function Reports() {
  const [reportType, setReportType] =
  useState('department');

const [period, setPeriod] =
  useState('today');

const [departmentId, setDepartmentId] =
  useState('all');

const [kioskId, setKioskId] =
  useState('all');

const [customRange, setCustomRange] =
  useState({
    from: new Date(),
    to: new Date(),
  });

const [showDatePicker, setShowDatePicker] =
  useState(false);

const datePickerRef = useRef(null);

  const [search, setSearch] =
    useState('');

  const [departments, setDepartments] =
    useState([]);

  const [kiosks, setKiosks] =
    useState([]);

  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [hasApplied, setHasApplied] =
    useState(false);

const dateRange = useMemo(
  () =>
    getDateRange(
      period,
      customRange
    ),
  [
    period,
    customRange,
  ]
);

  useEffect(() => {
    async function loadFilterOptions() {
    try {
      await auth.authStateReady();

      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          "You must be signed in to load report filters."
        );
      }

      const [departmentData, kioskData] =
        await Promise.all([
          getReportDepartments(user),
          getReportKiosks(user),
        ]);

      setDepartments(
        Array.isArray(departmentData)
          ? departmentData
          : []
      );

      setKiosks(
        Array.isArray(kioskData)
          ? kioskData
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load report filters:",
        err
      );
    }
  }

    loadFilterOptions();
  }, []);

  const filteredKiosks = useMemo(() => {
    if (departmentId === 'all') {
      return kiosks;
    }

    return kiosks.filter(
      (kiosk) =>
        String(
          kiosk.departmentId ??
            kiosk.department_id
        ) === String(departmentId)
    );
  }, [kiosks, departmentId]);

  useEffect(() => {
    if (
      kioskId !== 'all' &&
      !filteredKiosks.some(
        (kiosk) =>
          String(
            kiosk.kioskId ??
              kiosk.kiosk_id
          ) === String(kioskId)
      )
    ) {
      setKioskId('all');
    }
  }, [filteredKiosks, kioskId]);

  async function loadReport() {
    if (
      !dateRange.startDate ||
      !dateRange.endDate
    ) {
      setError(
        'Please select a valid date or period.'
      );

      return;
    }

    try {
      setLoading(true);
      setError('');
      setHasApplied(true);

      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          'You must be signed in to load reports.'
        );
      }

      const data = await getReportData(user, {
        reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        departmentId,
        kioskId,
      });

      setRows(
        Array.isArray(data?.rows)
          ? data.rows
          : []
      );
    } catch (err) {
      console.error(
        'Failed to load report:',
        err
      );

      setRows([]);

      setError(
        err?.message ||
          'Failed to load report data.'
      );
    } finally {
      setLoading(false);
    }
  }

function handleReset() {
  const today = new Date();

  setReportType('department');
  setPeriod('today');
  setDepartmentId('all');
  setKioskId('all');

  setCustomRange({
    from: today,
    to: today,
  });

  setShowDatePicker(false);

  setSearch('');
  setError('');
  setHasApplied(false);
  setRows([]);
}

  function getReportTitle() {
    return (
      REPORT_TYPES.find(
        (report) =>
          report.value === reportType
      )?.label || 'Report'
    );
  }

  const visibleRows = useMemo(() => {
    if (!search.trim()) {
      return rows;
    }

    const query =
      search.trim().toLowerCase();

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [rows, search]);

function exportToExcel() {
  if (!visibleRows.length) {
    return;
  }

  let headers = [];
  let dataRows = [];

  if (reportType === 'department') {
  headers = [
    'Department',
    'Total Queues',
    'Served',
    'Skipped',
    'Terminals',
  ];

  dataRows = visibleRows.map((row) => ({
    Department: row.department,
    'Total Queues': Number(
      row.totalQueues || 0
    ),
    Served: Number(
      row.served || 0
    ),
    Skipped: Number(
      row.skipped || 0
    ),
    Terminals: Number(
      row.terminals || 0
    ),
  }));
}

  if (reportType === 'staff') {
    headers = [
      'Staff',
      'Department',
      'Terminal',
      'Queues Served',
      'Login Timestamp',
      'Logout Timestamp',
    ];

    dataRows = visibleRows.map((row) => ({
      Staff: row.staff,
      Department: row.department,
      Terminal: row.terminal,
      'Queues Served': Number(
        row.queuesServed || 0
      ),
      'Login Timestamp':
        row.loginTimestamp || '',
      'Logout Timestamp':
        row.logoutTimestamp || '',
    }));
  }

  if (reportType === 'served') {
    headers = [
      'Date',
      'Department',
      'Served Queues',
    ];

    dataRows = visibleRows.map((row) => ({
      Date: row.date || '',
      Department: row.department,
      'Served Queues': Number(
        row.servedQueues || 0
      ),
    }));
  }

  const worksheet =
    XLSX.utils.json_to_sheet(
      dataRows,
      {
        header: headers,
      }
    );

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Report'
  );

  XLSX.writeFile(
    workbook,
    `${reportType}-report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`
  );
}

  return (
    <div className="space-y-5">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2937]">
            Reports
          </h1>

          <p className="mt-1 text-xs text-[#6B7280]">
            View and export operational queue reports.
          </p>
        </div>

        <button
          type="button"
          onClick={exportToExcel}
          disabled={!visibleRows.length}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={15} />
          Export to Excel
        </button>
      </div>

{/* FILTER PANEL */}
<section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
  <div className="border-b border-[#E5E7EB] px-5 py-4">
    <h2 className="text-sm font-semibold text-[#1F2937]">
      Report Filters
    </h2>

    <p className="mt-0.5 text-xs text-[#6B7280]">
      Choose the report and date range, then narrow the results by department or kiosk.
    </p>
  </div>

  <div className="space-y-5 p-5">
    {/* PRIMARY FILTERS */}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
      <SelectField
        label="System Report"
        value={reportType}
        onChange={(event) =>
          setReportType(event.target.value)
        }
        options={REPORT_TYPES}
      />

<div
  ref={datePickerRef}
  className="relative"
>
  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
    Date Range
  </label>

  <button
    type="button"
    onClick={() =>
      setShowDatePicker(
        (current) => !current
      )
    }
    className="flex h-10 w-full items-center justify-between rounded-lg border border-[#D9DEE7] bg-white px-3 text-sm text-[#1F2937] outline-none transition hover:border-[#9D0A0E] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
  >
    <span>
      {period === 'custom'
        ? 'Custom Range'
        : PERIOD_OPTIONS.find(
            (option) =>
              option.value === period
          )?.label || 'Select Range'}
    </span>

    <ChevronDown
      size={16}
      className={`text-[#6B7280] transition-transform ${
        showDatePicker
          ? 'rotate-180'
          : ''
      }`}
    />
  </button>

  {showDatePicker && (
    <div className="absolute left-0 top-full z-50 mt-2 w-[720px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl">
      <div className="flex flex-col sm:flex-row">

        {/* QUICK DATE OPTIONS */}
        <div className="w-full border-b border-[#E5E7EB] p-3 sm:w-44 sm:border-b-0 sm:border-r">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Quick Select
          </p>

          {PERIOD_OPTIONS.map(
            (option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPeriod(
                    option.value
                  );
                  setShowDatePicker(false);
                }}
                className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  period === option.value
                    ? 'bg-[#FBF1F1] font-medium text-[#9D0A0E]'
                    : 'text-[#374151] hover:bg-[#F8F9FA]'
                }`}
              >
                {option.label}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => {
              setPeriod('custom');
            }}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
              period === 'custom'
                ? 'bg-[#FBF1F1] font-medium text-[#9D0A0E]'
                : 'text-[#374151] hover:bg-[#F8F9FA]'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* CALENDAR */}
        <div className="flex-1 p-4">
          <DayPicker
            mode="range"
            selected={customRange}
            onSelect={(range) => {
              if (!range) {
                return;
              }

              setCustomRange({
                from: range.from,
                to: range.to,
              });

              setPeriod('custom');
            }}
            defaultMonth={
              customRange?.from ||
              new Date()
            }
            showOutsideDays
          />

          <div className="mt-3 border-t border-[#EEF0F3] pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Selected Range
            </p>

            <p className="mt-1 text-sm font-medium text-[#1F2937]">
              {customRange?.from
                ? formatDisplayDate(
                    formatDateInput(
                      customRange.from
                    )
                  )
                : 'Select start date'}

              {' — '}

              {customRange?.to
                ? formatDisplayDate(
                    formatDateInput(
                      customRange.to
                    )
                  )
                : 'Select end date'}
            </p>

            {!customRange?.to && (
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Click another date to complete the range.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )}
</div>

      <SelectField
        label="Department"
        value={departmentId}
        onChange={(event) =>
          setDepartmentId(event.target.value)
        }
        options={[
          {
            value: 'all',
            label: 'All Departments',
          },
          ...departments.map((department) => ({
            value:
              department.departmentId ??
              department.department_id,
            label:
              department.name ??
              department.department,
          })),
        ]}
      />

      <SelectField
        label="Kiosk"
        value={kioskId}
        onChange={(event) =>
          setKioskId(event.target.value)
        }
        options={[
          {
            value: 'all',
            label: 'All Kiosks',
          },
          ...filteredKiosks.map((kiosk) => ({
            value:
              kiosk.kioskId ??
              kiosk.kiosk_id,
            label:
              kiosk.name ??
              kiosk.kiosk_name ??
              kiosk.kiosk,
          })),
        ]}
      />
    </div>

    {/* CUSTOM DATE */}
    {period === 'custom-date' && (
      <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
        <div className="max-w-sm">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            Select Date
          </label>

          <input
            type="date"
            value={customDate}
            onChange={(event) =>
              setCustomDate(event.target.value)
            }
            className="h-10 w-full rounded-lg border border-[#D9DEE7] bg-white px-3 text-sm text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
          />

          <p className="mt-2 text-xs text-[#6B7280]">
            Report for:{' '}
            <span className="font-medium text-[#1F2937]">
              {formatDisplayDate(customDate)}
            </span>
          </p>
        </div>
      </div>
    )}

    {/* CUSTOM MONTH */}
    {period === 'custom-month' && (
      <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
        <div className="max-w-sm">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            Select Month
          </label>

          <input
            type="month"
            value={customMonth}
            onChange={(event) =>
              setCustomMonth(event.target.value)
            }
            className="h-10 w-full rounded-lg border border-[#D9DEE7] bg-white px-3 text-sm text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
          />

          <p className="mt-2 text-xs text-[#6B7280]">
            Report for:{' '}
            <span className="font-medium text-[#1F2937]">
              {formatDisplayMonth(customMonth)}
            </span>
          </p>
        </div>
      </div>
    )}

    {/* FILTER ACTIONS */}
    <div className="flex flex-col gap-3 border-t border-[#EEF0F3] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-[#6B7280]">
        <span className="font-medium text-[#4B5563]">
          Reporting period:
        </span>{' '}

        {dateRange.startDate &&
        dateRange.endDate ? (
          <span className="font-medium text-[#1F2937]">
            {formatDisplayDate(dateRange.startDate)}

            {dateRange.startDate !==
              dateRange.endDate &&
              ` — ${formatDisplayDate(
                dateRange.endDate
              )}`}
          </span>
        ) : (
          <span className="text-[#9D0A0E]">
            Select a valid reporting period.
          </span>
        )}
      </div>

      <div className="flex gap-2 sm:justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D9DEE7] bg-white px-3 text-xs font-medium text-[#4B5563] transition hover:bg-[#F8F9FA]"
        >
          <RotateCcw size={14} />
          Reset
        </button>

        <button
          type="button"
          onClick={loadReport}
          disabled={loading}
          className="h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
      </div>
    </div>
  </div>
</section>

      {/* REPORT TABLE */}
      <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1F2937]">
              {getReportTitle()}
            </h2>

            <p className="mt-0.5 text-xs text-[#6B7280]">
              {hasApplied
                ? `${visibleRows.length} record${
                    visibleRows.length === 1
                      ? ''
                      : 's'
                  }`
                : 'Apply filters to generate the report.'}
            </p>
          </div>

          {hasApplied && rows.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search report..."
                className="h-9 w-full rounded-lg border border-[#D9DEE7] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
              />
            </div>
          )}
        </div>

        {error ? (
          <div className="m-5 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] p-4 text-sm text-[#9D0A0E]">
            {error}
          </div>
        ) : !hasApplied || loading ? (
          <EmptyState loading={loading} />
        ) : visibleRows.length === 0 ? (
          <EmptyState loading={false} />
        ) : reportType === 'department' ? (
          <DepartmentTable rows={visibleRows} />
        ) : reportType === 'staff' ? (
          <StaffTable rows={visibleRows} />
        ) : (
          <ServedTable
            rows={visibleRows}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            departmentId={departmentId}
          />
        )}
      </section>

      {/* FOOTER */}
      {hasApplied && visibleRows.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          <span>
            Showing {visibleRows.length} record
            {visibleRows.length === 1
              ? ''
              : 's'}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E5E7EB] text-[#9CA3AF]"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="flex h-7 min-w-7 items-center justify-center rounded bg-[#9D0A0E] px-2 font-medium text-white">
              1
            </span>

            <button
              type="button"
              disabled
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E5E7EB] text-[#9CA3AF]"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}