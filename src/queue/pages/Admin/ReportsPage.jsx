import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { auth } from '../../../firebase';
import { useAuth } from '../../services/Authcontext';
import {
  getAdminReportRows,
  getDepartments,
  getTerminals,
  getUsers,
} from '../../services/backendApi';

import { toDateKey } from './adminHelpers';
import { findDepartmentForUser, getRoleName, normalizeRole } from './AdminScreens';
import { useAppearance } from './AppearanceContext';
import { useLanguage } from './LanguageContext';
import {
  DateFilterDropdown,
  ReportTypeDropdown,
  TerminalFilterDropdown,
} from './ReportFilters';
import { buildXlsxBlob, downloadBlob } from './reportExport';
import {
  buildReportRecords,
  buildTodayValue,
  formatClock,
  formatMinutes,
  rangeFileLabel,
  searchMatches,
  terminalLabel,
} from './reportData';

// =====================================================
// ADMIN → REPORTS
// =====================================================
//
// Four reports (Department, Staff, Terminal, Queue) built from the
// signed-in admin's own department. The page-level filters are a draft
// until "Apply Filter" is pressed, matching the design.

const ACCENT = 'var(--admin-accent)';
const ON_ACCENT = 'var(--rep-on-accent, #ffffff)';
const tint = (percent) => `color-mix(in srgb, var(--admin-accent) ${percent}%, transparent)`;

// English names for the export file name, so it stays stable whatever
// language the admin is using.
const FILE_TYPE_NAMES = {
  department: 'Department',
  staff: 'Staff',
  terminal: 'Terminal',
  queue: 'Queue',
};

const TOAST_MS = 5000;

// Picks black or white text for a given accent so a light accent stays readable.
function readableOn(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return '#ffffff';

  const value = parseInt(match[1], 16);
  const channel = (shift) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.5 ? '#111827' : '#ffffff';
}

function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap');
    result.push(page);
  });

  return result;
}

function ReportToast({ toast, onClose }) {
  const { t } = useLanguage();
  if (!toast) return null;

  const success = toast.kind === 'success';

  return (
    <div
      role={success ? 'status' : 'alert'}
      className="fixed right-4 top-4 z-[70] w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
    >
      <div className="flex gap-3 p-4" style={{ boxShadow: `inset 4px 0 0 ${success ? '#18824B' : '#DC2626'}` }}>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          }`}
        >
          {success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1F2937]">{toast.title}</p>
          <p className="mt-0.5 text-xs text-[#4B5563]">{toast.message}</p>

          {toast.fileName && (
            <span className="mt-2 inline-block max-w-full truncate rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              {toast.fileName}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="h-6 w-6 shrink-0 rounded p-1 text-slate-400 hover:bg-[#F1F3F5] hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { accent } = useAppearance();

  // The Admin Settings clock format is not persisted anywhere yet, so
  // reports use the 12-hour clock until it is.
  const clockFormat = '12h';

  const [draft, setDraft] = useState(() => ({
    type: 'department',
    date: buildTodayValue(),
    terminals: null,
  }));
  const [applied, setApplied] = useState(draft);

  const [data, setData] = useState({ rows: [], terminals: [], staff: [], departmentName: '' });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

  const requestRef = useRef(0);
  const toastTimer = useRef(null);

  const appliedStart = toDateKey(applied.date.start);
  const appliedEnd = toDateKey(applied.date.end);

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setStatus('loading');

    try {
      const [departments, users, terminalData, rows] = await Promise.all([
        getDepartments(),
        getUsers(),
        getTerminals(),
        getAdminReportRows(auth.currentUser, appliedStart, appliedEnd),
      ]);

      if (requestId !== requestRef.current) return;

      const department = findDepartmentForUser(departments, user);

      setData({
        rows: rows || [],
        departmentName: department?.name || user?.department || '',
        terminals: (terminalData || []).filter(
          (terminal) => department && String(terminal.department_id) === String(department.department_id)
        ),
        staff: (users || []).filter(
          (person) =>
            department &&
            normalizeRole(getRoleName(person)) === 'staff' &&
            String(person.department_id) === String(department.department_id)
        ),
      });
      setStatus('ready');
    } catch (error) {
      if (requestId !== requestRef.current) return;
      console.error('Failed to load reports:', error);
      setStatus('error');
    }
  }, [appliedStart, appliedEnd, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(next) {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  function applyFilters() {
    setApplied(draft);
    setPage(1);
  }

  const records = useMemo(
    () =>
      buildReportRecords(applied.type, {
        rows: data.rows,
        terminals: data.terminals,
        staff: data.staff,
        departmentName: data.departmentName,
        selectedIds: applied.terminals,
      }),
    [applied.type, applied.terminals, data]
  );

  const visible = useMemo(
    () => records.filter((record) => searchMatches(record, search)),
    [records, search]
  );

  const pageSize = applied.type === 'queue' ? 10 : 4;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const from = visible.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, visible.length);
  const pageRecords = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const terminalOptions = useMemo(
    () =>
      data.terminals.map((terminal) => {
        const person = data.staff.find(
          (item) => String(item.user_id) === String(terminal.assigned_staff_id)
        );

        return {
          id: terminal.counter_id,
          label: terminalLabel(terminal),
          subtitle: person
            ? [person.first_name, person.last_name].filter(Boolean).join(' ')
            : t('common.unassigned'),
        };
      }),
    [data.terminals, data.staff, t]
  );

  const none = '—';

  // ---- column definitions (also drive the Excel export) -------------

  const statusLabel = useCallback(
    (value) => t(value === 'cancelled' ? 'reports.status.skipped' : `reports.status.${value}`),
    [t]
  );

  const columns = useMemo(() => {
    const clock = (value) => formatClock(value, clockFormat);

    if (applied.type === 'department') {
      return [
        { id: 'department', label: t('reports.col.department'), text: (r) => r.department },
        { id: 'total', label: t('reports.col.totalQueues'), align: 'center', text: (r) => r.total, number: true },
        { id: 'served', label: t('reports.col.served'), align: 'center', text: (r) => r.served, number: true, tone: 'served' },
        { id: 'skipped', label: t('reports.col.skipped'), align: 'center', text: (r) => r.skipped, number: true, tone: 'skipped' },
        {
          id: 'terminals',
          label: t('reports.col.terminalsStaff'),
          text: (r) =>
            r.terminals
              .map((item) => `${item.label} ${item.staffName || t('common.unassigned')}`)
              .join(', '),
          render: (r) =>
            r.terminals.length === 0 ? (
              none
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {r.terminals.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-[#1F2937]"
                    style={{ backgroundColor: tint(10) }}
                  >
                    <span className="rounded px-1 text-[10px] font-bold" style={{ backgroundColor: tint(18), color: ACCENT }}>
                      {item.label}
                    </span>
                    {item.staffName || t('common.unassigned')}
                  </span>
                ))}
              </div>
            ),
        },
      ];
    }

    if (applied.type === 'terminal') {
      return [
        { id: 'terminal', label: t('reports.col.terminal'), text: (r) => r.terminal },
        { id: 'total', label: t('reports.col.totalQueues'), align: 'center', text: (r) => r.total, number: true },
        { id: 'served', label: t('reports.col.served'), align: 'center', text: (r) => r.served, number: true, tone: 'served' },
        { id: 'skipped', label: t('reports.col.skipped'), align: 'center', text: (r) => r.skipped, number: true, tone: 'skipped' },
        { id: 'avg', label: t('reports.col.avgServiceTime'), align: 'center', text: (r) => formatMinutes(r.avgMin, t) },
      ];
    }

    if (applied.type === 'staff') {
      return [
        {
          id: 'name',
          label: t('reports.col.staffName'),
          text: (r) => r.name,
          render: (r) => (
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F3F5] text-[10px] font-bold text-[#4B5563]">
                {r.initials}
              </span>
              <span className="font-bold">{r.name}</span>
            </span>
          ),
        },
        { id: 'position', label: t('reports.col.position'), text: (r) => r.position || none },
        { id: 'terminal', label: t('reports.col.terminalAssigned'), text: (r) => r.terminal || t('common.unassigned') },
        { id: 'served', label: t('reports.col.queuesServed'), align: 'center', text: (r) => r.served, number: true, tone: 'served' },
        { id: 'avg', label: t('reports.col.avgServiceTime'), align: 'center', text: (r) => formatMinutes(r.avgMin, t) },
        { id: 'login', label: t('reports.col.loginTimestamp'), align: 'center', text: (r) => (r.loginAt ? clock(r.loginAt) : none) },
        { id: 'logout', label: t('reports.col.logoutTimestamp'), align: 'center', text: (r) => (r.logoutAt ? clock(r.logoutAt) : none) },
      ];
    }

    return [
      { id: 'queueNumber', label: t('reports.col.queueNumber'), text: (r) => r.queueNumber, bold: true },
      { id: 'service', label: t('reports.col.service'), text: (r) => r.service },
      { id: 'terminal', label: t('reports.col.terminal'), text: (r) => r.terminal || none },
      {
        id: 'status',
        label: t('reports.col.status'),
        align: 'center',
        text: (r) => statusLabel(r.status),
        tone: (r) => (r.status === 'completed' ? 'served' : r.status === 'cancelled' ? 'skipped' : null),
        bold: true,
      },
      { id: 'calledAt', label: t('reports.col.calledAt'), align: 'center', text: (r) => clock(r.calledAt) },
      { id: 'startedAt', label: t('reports.col.startedAt'), align: 'center', text: (r) => clock(r.startedAt) },
      { id: 'completedAt', label: t('reports.col.completedAt'), align: 'center', text: (r) => clock(r.completedAt) },
      { id: 'duration', label: t('reports.col.duration'), align: 'center', text: (r) => formatMinutes(r.durationMin, t) },
    ];
  }, [applied.type, clockFormat, statusLabel, t]);

  function exportToExcel() {
    try {
      const typeName = t(`reports.type.${applied.type}`);
      const fileName = `SWUMed_${FILE_TYPE_NAMES[applied.type]}_Export_${rangeFileLabel(applied.date)}.xlsx`;

      const blob = buildXlsxBlob({
        sheetName: typeName,
        headers: columns.map((column) => column.label),
        rows: visible.map((record) =>
          columns.map((column) => (column.number ? column.text(record) : String(column.text(record))))
        ),
      });

      downloadBlob(blob, fileName);

      showToast({
        kind: 'success',
        title: t('reports.export.successTitle'),
        message: t('reports.export.successBody', { type: t('reports.type.short.' + applied.type) }),
        fileName,
      });
    } catch (error) {
      console.error('Report export failed:', error);

      showToast({
        kind: 'error',
        title: t('reports.export.failedTitle'),
        message: t('reports.export.failedBody'),
      });
    }
  }

  const cellTone = (column, record) => {
    const tone = typeof column.tone === 'function' ? column.tone(record) : column.tone;
    if (tone === 'served') return 'font-bold text-emerald-700';
    if (tone === 'skipped') return 'font-bold text-red-600';
    return column.bold ? 'font-bold' : '';
  };

  const departmentLabel = data.departmentName || user?.department || '';

  return (
    <div style={{ '--rep-on-accent': readableOn(accent) }}>
      <ReportToast toast={toast} onClose={() => setToast(null)} />

      {/* HEADER */}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold leading-8 tracking-[-0.4px] text-[#212B3A]">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-[#44474C]">{t('reports.pageSubtitle', { department: departmentLabel })}</p>

          <span
            className="mt-2 inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-semibold"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            {t('reports.departmentChip', { department: departmentLabel })}
          </span>
        </div>

        <button
          type="button"
          onClick={exportToExcel}
          disabled={status !== 'ready' || visible.length === 0}
          style={{ backgroundColor: ACCENT, color: ON_ACCENT }}
          className="flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={14} />
          {t('reports.export.button')}
        </button>
      </div>

      {/* FILTER CARD */}

      <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">{t('reports.type.label')}</span>

          <ReportTypeDropdown value={draft.type} onChange={(type) => setDraft((d) => ({ ...d, type }))} />

          <DateFilterDropdown value={draft.date} onApply={(date) => setDraft((d) => ({ ...d, date }))} />

          <TerminalFilterDropdown
            terminals={terminalOptions}
            value={draft.terminals}
            onApply={(terminals) => setDraft((d) => ({ ...d, terminals }))}
          />

          <button
            type="button"
            onClick={applyFilters}
            style={{ borderColor: ACCENT, color: ACCENT }}
            className="flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-xs font-bold transition hover:bg-[#F8F9FA]"
          >
            {t('common.applyFilter')}
          </button>
        </div>
      </div>

      {/* DATA CARD */}

      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <h2 className="text-sm font-bold text-[#1F2937]">
            {t('reports.dataTitle', { type: t(`reports.type.${applied.type}`) })}
          </h2>

          <label className="flex w-full max-w-xs items-center gap-2 rounded-md border border-[#E5E7EB] px-3 py-2 sm:w-64">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('reports.search')}
              aria-label={t('reports.search')}
              className="w-full bg-transparent text-xs text-[#1F2937] outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-[#4B5563] ${
                      column.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {status === 'loading' &&
                Array.from({ length: 4 }, (_, row) => (
                  <tr key={row} className="border-b border-[#E5E7EB]" aria-hidden="true">
                    {columns.map((column) => (
                      <td key={column.id} className="px-5 py-4">
                        <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-[#F1F3F5]" />
                      </td>
                    ))}
                  </tr>
                ))}

              {status === 'ready' &&
                pageRecords.map((record) => (
                  <tr key={record.key} className="border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#F8F9FA]">
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={`px-5 py-3.5 text-xs text-[#1F2937] ${
                          column.align === 'center' ? 'text-center' : ''
                        } ${cellTone(column, record)}`}
                      >
                        {column.render ? column.render(record) : column.text(record)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {status === 'error' && (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <AlertTriangle size={22} className="text-red-600" />
            <p className="text-xs text-[#4B5563]">{t('reports.error')}</p>
            <button
              type="button"
              onClick={load}
              style={{ borderColor: ACCENT, color: ACCENT }}
              className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-xs font-bold hover:bg-[#F8F9FA]"
            >
              <RefreshCw size={12} />
              {t('reports.retry')}
            </button>
          </div>
        )}

        {status === 'ready' && visible.length === 0 && (
          <p className="px-5 py-10 text-center text-xs text-slate-400">{t('reports.empty')}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-5 py-3 text-xs text-[#4B5563]">
          <span>
            {status === 'ready'
              ? t('reports.showing', { from, to, total: visible.length })
              : t('common.loading')}
          </span>

          <nav aria-label={t('reports.pagination')} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('reports.previous')}
            </button>

            {pageWindow(currentPage, totalPages).map((entry, index) =>
              entry === 'gap' ? (
                <span key={`gap-${index}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setPage(entry)}
                  aria-current={entry === currentPage ? 'page' : undefined}
                  style={entry === currentPage ? { backgroundColor: ACCENT, borderColor: ACCENT, color: ON_ACCENT } : undefined}
                  className={`min-w-[28px] rounded-md border px-2 py-1.5 font-semibold ${
                    entry === currentPage ? '' : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F8F9FA]'
                  }`}
                >
                  {entry}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('reports.next')}
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
