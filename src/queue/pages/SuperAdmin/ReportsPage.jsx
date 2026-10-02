import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Info,
  Monitor,
  RefreshCw,
  Search,
} from 'lucide-react';

import { auth } from '../../../firebase';
import {
  getDashboardAnalytics,
  getDepartments,
  getKiosks,
  getTerminals,
  getUsers,
} from '../../services/backendApi';
import { getLanguageCode, useLanguage } from '../../services/language';

import { toDateKey } from '../Admin/adminHelpers';
import { LanguageContext } from '../Admin/LanguageContext';
import {
  ACCENT,
  DateFilterDropdown,
  ON_ACCENT,
  ReportTypeDropdown,
  TerminalFilterDropdown,
  tint,
} from '../Admin/ReportFilters';
import { ReportToast, pageWindow, readableOn } from '../Admin/ReportsPage';
import { buildXlsxBlob, downloadBlob } from '../Admin/reportExport';
import { buildTodayValue, formatClock, rangeFileLabel } from '../Admin/reportData';
import DepartmentFilterDropdown from './ReportDepartmentFilter';
import { useSuperAdminAppearance } from './SuperAdminAppearanceContext';
import {
  SA_PAGE_SIZE,
  SA_REPORT_TYPES,
  buildSuperAdminReport,
  searchRecord,
} from './reportsData';

// =====================================================
// SUPER ADMIN -> REPORTS
// =====================================================
//
// Three reports across every department: Department Summary, Staff
// Performance and Served Queues. They are all worked out in the browser
// from ONE fetch of the queue rows for the chosen dates (the dashboard
// endpoint's `queues` array), plus the department, terminal, staff and
// kiosk lists. Changing the department or kiosk filter, the report type or
// the search never refetches; only a new date does.
//
// The shared report dropdowns come from the Admin Reports page. They read
// --admin-accent, which is set on this page's wrapper to the Super Admin
// accent, and the language context below, which carries the Super Admin
// language (its t() falls back to the Admin 'reports.*' keys).
//
// The old Reports & Analytics screen is kept, unused, in Reports.jsx.

const TOAST_MS = 5000;

// English names for the export file name, so it stays stable whatever
// language the Super Admin is using.
const FILE_TYPE_NAMES = {
  department: 'DepartmentSummary',
  staff: 'StaffPerformance',
  served: 'ServedQueues',
};

const NONE = '—';

export default function ReportsPage() {
  const { language, setLanguage, t } = useLanguage();
  const { accent, clockFormat } = useSuperAdminAppearance();

  const langCode = getLanguageCode(language);

  const languageValue = useMemo(
    () => ({ language, langCode, setLanguage, t }),
    [language, langCode, setLanguage, t]
  );

  const [filters, setFilters] = useState(() => ({
    type: 'department',
    date: buildTodayValue(),
    departments: null,
    kiosks: null,
  }));

  const [data, setData] = useState({
    rows: null,
    departments: [],
    terminals: [],
    users: [],
    kiosks: [],
  });

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);

  const requestRef = useRef(0);
  const inFlightRef = useRef('');
  const staticRef = useRef(null);
  const toastTimer = useRef(null);

  const start = toDateKey(filters.date.start);
  const end = toDateKey(filters.date.end);

  const load = useCallback(
    async ({ force = false } = {}) => {
      const key = `${start}|${end}`;

      // The same request is already on its way: do not start a second one.
      if (!force && inFlightRef.current === key) return;

      inFlightRef.current = key;

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setStatus('loading');

      try {
        const user = auth.currentUser;

        if (!user) throw new Error('not signed in');

        if (force) staticRef.current = null;

        // Departments, terminals, staff and kiosks do not depend on the
        // dates, so they are read once and kept.
        const fetchStatic = staticRef.current
          ? Promise.resolve(staticRef.current)
          : Promise.all([
              getDepartments(),
              getTerminals(),
              getUsers().catch(() => []),
              getKiosks().catch(() => []),
            ]).then(([departments, terminals, users, kiosks]) => {
              const loaded = {
                departments: departments || [],
                terminals: terminals || [],
                users: users || [],
                kiosks: kiosks || [],
              };

              staticRef.current = loaded;
              return loaded;
            });

        const [analytics, loaded] = await Promise.all([
          getDashboardAnalytics(user, start, end),
          fetchStatic,
        ]);

        if (requestId !== requestRef.current) return;

        setData({
          rows: Array.isArray(analytics?.queues) ? analytics.queues : null,
          ...loaded,
        });
        setStatus('ready');
      } catch (error) {
        if (requestId !== requestRef.current) return;

        console.error('Failed to load reports:', error);
        setStatus('error');
      } finally {
        if (requestId === requestRef.current) inFlightRef.current = '';
      }
    },
    [start, end]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(next) {
    clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  function updateFilters(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  /* ---------- the report ---------- */

  const report = useMemo(
    () =>
      buildSuperAdminReport(filters.type, {
        rows: data.rows || [],
        departments: data.departments,
        terminals: data.terminals,
        users: data.users,
        kiosks: data.kiosks,
        departmentIds: filters.departments,
        kioskIds: filters.kiosks,
      }),
    [filters.type, filters.departments, filters.kiosks, data]
  );

  const visible = useMemo(
    () => report.records.filter((record) => searchRecord(record, search)),
    [report.records, search]
  );

  const pageSize = SA_PAGE_SIZE[filters.type];
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const from = visible.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, visible.length);
  const pageRecords = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ---------- filter options ---------- */

  const departmentOptions = useMemo(
    () =>
      data.departments
        .map((department) => ({
          id: department.department_id,
          name: department.name,
          code: department.prefix || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.departments]
  );

  // Kiosks narrowed to the selected departments, where there are any.
  const kioskOptions = useMemo(() => {
    const departmentSet = filters.departments ? new Set(filters.departments.map(String)) : null;

    return data.kiosks
      .map((kiosk) => {
        const count = data.departments.filter(
          (department) =>
            String(department.kiosk_id) === String(kiosk.kiosk_id) &&
            (!departmentSet || departmentSet.has(String(department.department_id)))
        ).length;

        return {
          id: kiosk.kiosk_id,
          label: kiosk.name,
          subtitle: t(count === 1 ? 'sa.rep.kiosk.subOne' : 'sa.rep.kiosk.subMany', { n: count }),
          count,
        };
      })
      .filter((kiosk) => !departmentSet || kiosk.count > 0);
  }, [data.kiosks, data.departments, filters.departments, t]);

  /* ---------- columns (they also drive the Excel export) ---------- */

  const columns = useMemo(() => {
    const clock = (value) => formatClock(value, clockFormat);

    if (filters.type === 'department') {
      return [
        { id: 'department', label: t('reports.col.department'), text: (r) => r.department, bold: true },
        { id: 'total', label: t('reports.col.totalQueues'), align: 'center', text: (r) => r.total, number: true, plain: true },
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
              NONE
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {r.terminals.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#F1F3F5] px-2 py-1 text-[11px] font-semibold text-[#1F2937]"
                  >
                    <span className="rounded px-1 text-[10px] font-bold" style={{ backgroundColor: tint(15), color: ACCENT }}>
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

    if (filters.type === 'staff') {
      return [
        {
          id: 'name',
          label: t('reports.col.staffName'),
          text: (r) => r.name,
          render: (r) => (
            <span className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: tint(12), color: ACCENT }}
              >
                {r.initials}
              </span>
              <span className="font-bold">{r.name || NONE}</span>
            </span>
          ),
        },
        { id: 'department', label: t('reports.col.department'), text: (r) => r.department || NONE },
        { id: 'served', label: t('reports.col.queuesServed'), align: 'center', text: (r) => r.served, number: true, tone: 'served' },
        {
          id: 'terminal',
          label: t('reports.col.terminalAssigned'),
          text: (r) => (r.terminal ? `${r.terminal} ${t('sa.dash.terminal.n', { n: r.terminalName })}` : t('common.unassigned')),
          render: (r) =>
            r.terminal ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F1F3F5] px-2 py-1 text-[11px] font-semibold text-[#1F2937]">
                <span className="rounded px-1 text-[10px] font-bold" style={{ backgroundColor: tint(15), color: ACCENT }}>
                  {r.terminal}
                </span>
                {t('sa.dash.terminal.n', { n: r.terminalName })}
              </span>
            ) : (
              t('common.unassigned')
            ),
        },
        {
          id: 'login',
          label: t('reports.col.loginTimestamp'),
          align: 'center',
          text: (r) => (r.loginAt ? clock(r.loginAt) : NONE),
          title: t('sa.rep.notRecorded'),
        },
        {
          id: 'logout',
          label: t('reports.col.logoutTimestamp'),
          align: 'center',
          text: (r) => (r.logoutAt ? clock(r.logoutAt) : r.online ? t('sa.rep.online') : NONE),
          title: t('sa.rep.notRecorded'),
          render: (r) =>
            r.logoutAt ? (
              clock(r.logoutAt)
            ) : r.online ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('sa.rep.online')}
              </span>
            ) : (
              NONE
            ),
        },
      ];
    }

    return [
      {
        id: 'department',
        label: t('sa.rep.col.departmentName'),
        text: (r) => r.department,
        render: (r) => (
          <span className="block">
            <span className="block font-bold">{r.department}</span>
            {r.location && <span className="block text-[11px] font-normal text-[#98A2B3]">{r.location}</span>}
          </span>
        ),
        align: 'center',
        wide: true,
      },
      {
        id: 'terminals',
        label: t('sa.rep.col.activeTerminals'),
        align: 'center',
        number: true,
        text: (r) => r.activeTerminals,
        render: (r) => (
          <span className="inline-flex rounded-full bg-[#F1F3F5] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">
            {t(r.activeTerminals === 1 ? 'sa.rep.terminalsOne' : 'sa.rep.terminalsCount', { n: r.activeTerminals })}
          </span>
        ),
      },
      {
        id: 'served',
        label: t('sa.rep.col.servedQueues'),
        align: 'center',
        number: true,
        text: (r) => r.served,
        render: (r) => (
          <span className="inline-flex items-center gap-1 font-bold" style={{ color: ACCENT }}>
            {r.served > 0 && <Check size={12} strokeWidth={3} />}
            {t('sa.rep.servedCount', { n: r.served })}
          </span>
        ),
      },
      {
        id: 'share',
        label: t('sa.rep.col.share'),
        align: 'center',
        text: (r) => `${r.share.toFixed(1)}%`,
        render: (r) => <ShareBar percent={r.share} />,
      },
    ];
  }, [filters.type, clockFormat, t]);

  /* ---------- export ---------- */

  function exportToExcel() {
    try {
      const typeName = t(`sa.rep.type.${filters.type}`);
      const fileName = `SWUMed_${FILE_TYPE_NAMES[filters.type]}_Export_${rangeFileLabel(filters.date)}.xlsx`;

      const body = visible.map((record) =>
        columns.map((column) => (column.number ? column.text(record) : String(column.text(record))))
      );

      // The Served Queues report ends on its total line, so the file does too.
      if (filters.type === 'served' && report.summary) {
        body.push([
          t('sa.rep.total', { n: report.summary.departments }),
          report.summary.activeTerminals,
          report.summary.served,
          '100.0%',
        ]);
      }

      const blob = buildXlsxBlob({
        sheetName: typeName,
        headers: columns.map((column) => column.label),
        rows: body,
      });

      downloadBlob(blob, fileName);

      showToast({
        kind: 'success',
        title: t('reports.export.successTitle'),
        message: t('reports.export.successBody', { type: t(`sa.rep.type.short.${filters.type}`) }),
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

  const cellTone = (column) => {
    if (column.tone === 'served') return 'font-bold text-emerald-700';
    if (column.tone === 'skipped') return 'font-bold text-red-600';
    return column.bold ? 'font-bold' : '';
  };

  const showingKey =
    filters.type === 'served'
      ? 'sa.rep.showingActive'
      : filters.type === 'staff'
        ? 'sa.rep.showingStaff'
        : 'sa.rep.showingDepartments';

  const unavailable = status === 'ready' && data.rows === null;

  const departmentCountForTotal = report.summary?.departments ?? 0;

  return (
    <LanguageContext.Provider value={languageValue}>
      <div style={{ '--admin-accent': accent, '--rep-on-accent': readableOn(accent) }}>
        <ReportToast toast={toast} onClose={() => setToast(null)} />

        {/* HEADER */}

        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1F2937]">{t('reports.title')}</h1>
            <p className="mt-1 text-sm text-[#4B5563]">{t('sa.rep.subtitle')}</p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={status !== 'ready' || visible.length === 0}
            style={{ backgroundColor: ACCENT, color: ON_ACCENT }}
            className="flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={14} />
            {t('reports.export.button')}
          </button>
        </div>

        {/* FILTER CARD - each dropdown applies when its own Apply is pressed */}

        <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563]">
              {t('reports.type.label')}
            </span>

            <ReportTypeDropdown
              value={filters.type}
              types={SA_REPORT_TYPES}
              labelOf={(type, translate) => translate(`sa.rep.type.${type}`)}
              onChange={(type) => {
                updateFilters({ type });
                setSearch('');
              }}
            />

            <DateFilterDropdown value={filters.date} onApply={(date) => updateFilters({ date })} />

            <DepartmentFilterDropdown
              departments={departmentOptions}
              value={filters.departments}
              onApply={(departments) => updateFilters({ departments })}
            />

            <TerminalFilterDropdown
              terminals={kioskOptions}
              value={filters.kiosks}
              onApply={(kiosks) => updateFilters({ kiosks })}
              icon={Monitor}
              labelKeys={{
                filter: 'sa.rep.kiosk.filter',
                all: 'sa.rep.kiosk.all',
                count: 'sa.rep.kiosk.count',
                search: 'sa.rep.kiosk.search',
                none: 'sa.rep.kiosk.none',
                clearAll: 'sa.rep.kiosk.clearAll',
              }}
            />
          </div>
        </div>

        {unavailable && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#4B5563]">
            <Info size={13} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
            {t('sa.dash.state.unavailable')}
          </div>
        )}

        {/* DATA CARD */}

        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="text-sm font-bold text-[#1F2937]">{t(`sa.rep.title.${filters.type}`)}</h2>

            <label className="flex w-full max-w-xs items-center gap-2 rounded-md border border-[#E5E7EB] px-3 py-2 sm:w-64">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t(filters.type === 'staff' ? 'sa.rep.search.staff' : 'sa.rep.search.department')}
                aria-label={t(filters.type === 'staff' ? 'sa.rep.search.staff' : 'sa.rep.search.department')}
                className="w-full bg-transparent text-xs text-[#1F2937] outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
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
                          title={column.title && !record.loginAt && !record.logoutAt ? column.title : undefined}
                          className={`px-5 py-3.5 text-xs text-[#1F2937] ${
                            column.align === 'center' ? 'text-center' : ''
                          } ${cellTone(column)}`}
                        >
                          {column.render ? column.render(record) : column.text(record)}
                        </td>
                      ))}
                    </tr>
                  ))}

                {status === 'ready' && filters.type === 'served' && report.summary && visible.length > 0 && (
                  <tr className="border-t border-[#E5E7EB]" style={{ backgroundColor: tint(8) }}>
                    <td className="px-5 py-3.5 text-center text-xs font-bold uppercase text-[#1F2937]">
                      {t('sa.rep.total', { n: departmentCountForTotal })}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-bold text-[#1F2937]">
                      {t('sa.rep.activeTerminalsTotal', { n: report.summary.activeTerminals })}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-bold" style={{ color: ACCENT }}>
                      {t('sa.rep.servedCount', { n: report.summary.served })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <ShareBar percent={100} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {status === 'error' && (
            <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <AlertTriangle size={22} className="text-red-600" />
              <p className="text-xs text-[#4B5563]">{t('reports.error')}</p>
              <button
                type="button"
                onClick={() => load({ force: true })}
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
                ? t(showingKey, { from, to, total: visible.length })
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
                  <span key={`gap-${index}`} className="px-1 text-slate-400">&hellip;</span>
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
    </LanguageContext.Provider>
  );
}

// "30.2%" and a small bar in the accent colour.
function ShareBar({ percent }) {
  return (
    <span className="inline-flex items-center justify-center gap-2.5">
      <span className="w-11 text-right text-[11px] font-semibold text-[#1F2937]">{percent.toFixed(1)}%</span>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#E5E7EB]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(Math.max(percent, percent > 0 ? 2 : 0), 100)}%`, backgroundColor: ACCENT }}
        />
      </span>
    </span>
  );
}
