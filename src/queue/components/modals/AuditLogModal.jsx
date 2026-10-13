import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  RefreshCw,
  Search,
  ScrollText,
  X,
} from 'lucide-react';

import { auth } from '../../../firebase';
import { getAuditLogs } from '../../services/backendApi';
import { buildXlsxBlob, downloadBlob } from '../../pages/Admin/reportExport';
import { toDateKey } from '../../pages/Admin/adminHelpers';

/*
|--------------------------------------------------------------------------
| AUDIT LOG MODAL
|--------------------------------------------------------------------------
|
| Opened from the Reports tab of both the Admin and SuperAdmin apps. It
| lists the recent create / update / delete actions recorded by the
| server and can export whatever is shown to a spreadsheet.
|
| The parent supplies `t` (Admin or SuperAdmin translate) and `accent`,
| so the same component serves both apps. The server scopes an Admin to
| their own department, so no scope is passed from here.
|
*/

const PAGE_SIZE = 10;
const ACTION_TABS = ['created', 'updated', 'deleted', 'assigned', 'released'];
const ENTITY_TABS = ['user', 'department', 'counter', 'role', 'position', 'kiosk'];

const ACTION_STYLES = {
  created: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  updated: 'border-amber-200 bg-amber-50 text-amber-700',
  deleted: 'border-red-200 bg-red-50 text-red-600',
  assigned: 'border-sky-200 bg-sky-50 text-sky-700',
  released: 'border-slate-200 bg-slate-100 text-slate-600',
};

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);

  return { start: toDateKey(start), end: toDateKey(end) };
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogModal({ onClose, t, accent = '#9D0A0E', onToast }) {
  const [range, setRange] = useState(defaultRange);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ status: 'idle', logs: [], total: 0 });
  const [exporting, setExporting] = useState(false);

  const requestRef = useRef(0);

  /* ---------- escape + scroll lock ---------- */

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  /* ---------- debounce the search box ---------- */

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ---------- load ---------- */

  const load = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setState({ status: 'error', logs: [], total: 0 });
      return;
    }

    setState((current) => ({ ...current, status: 'loading' }));

    try {
      const data = await getAuditLogs(firebaseUser, {
        startDate: range.start,
        endDate: range.end,
        search: search || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });

      if (requestId !== requestRef.current) return;

      setState({
        status: 'ready',
        logs: Array.isArray(data.logs) ? data.logs : [],
        total: Number(data.total) || 0,
      });
    } catch (error) {
      if (requestId !== requestRef.current) return;

      console.error('Failed to load audit logs:', error);
      setState({ status: 'error', logs: [], total: 0 });
    }
  }, [range.start, range.end, search, action, entityType, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /* ---------- export ---------- */

  async function exportLogs() {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser || exporting) return;

    setExporting(true);

    try {
      const data = await getAuditLogs(firebaseUser, {
        startDate: range.start,
        endDate: range.end,
        search: search || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        limit: 1000,
        offset: 0,
      });

      const headers = [
        t('reports.audit.col.datetime'),
        t('reports.audit.col.user'),
        t('reports.audit.col.role'),
        t('reports.audit.col.action'),
        t('reports.audit.col.entity'),
        t('reports.audit.col.item'),
        t('reports.audit.col.details'),
      ];

      const rows = (data.logs || []).map((log) => [
        formatDateTime(log.createdAt),
        log.actorName || '—',
        log.actorRole || '—',
        actionLabel(log.action),
        entityLabel(log.entityType),
        log.entityName || '—',
        log.details || '—',
      ]);

      const blob = buildXlsxBlob({
        sheetName: t('reports.audit.title'),
        headers,
        rows,
      });

      const fileName = `SWUMed_AuditLogs_${range.start}_to_${range.end}.xlsx`;

      downloadBlob(blob, fileName);

      if (onToast) {
        onToast({
          kind: 'success',
          title: t('reports.audit.exportedTitle'),
          message: t('reports.audit.exportedBody'),
          fileName,
        });
      }
    } catch (error) {
      console.error('Audit log export failed:', error);

      if (onToast) {
        onToast({
          kind: 'error',
          title: t('reports.audit.exportFailed'),
          message: t('reports.audit.exportFailedBody'),
        });
      }
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = state.total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, state.total);

  const actionLabel = (value) => t(`reports.audit.action.${value}`);
  const entityLabel = (value) => t(`reports.audit.entity.${value}`);

  const filterChips = [
    { id: '', label: t('reports.audit.filterAll') },
    ...ACTION_TABS.map((value) => ({ id: value, label: actionLabel(value) })),
  ];

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-log-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: accent }}
            >
              <ScrollText size={18} />
            </span>

            <div className="min-w-0">
              <h2 id="audit-log-modal-title" className="text-base font-bold text-[#1F2937]">
                {t('reports.audit.title')}
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">{t('reports.audit.subtitle')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] hover:text-[#1F2937]"
          >
            <X size={16} />
          </button>
        </div>

        {/* FILTERS */}

        <div className="flex flex-wrap items-center gap-3 border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#4B5563]">
            {t('reports.audit.from')}
            <input
              type="date"
              value={range.start}
              max={range.end}
              onChange={(event) => {
                setRange((current) => ({ ...current, start: event.target.value }));
                setPage(1);
              }}
              className="h-9 rounded-md border border-[#C3C6D7] bg-white px-2 text-xs text-[#1F2937] outline-none"
            />
          </label>

          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#4B5563]">
            {t('reports.audit.to')}
            <input
              type="date"
              value={range.end}
              min={range.start}
              onChange={(event) => {
                setRange((current) => ({ ...current, end: event.target.value }));
                setPage(1);
              }}
              className="h-9 rounded-md border border-[#C3C6D7] bg-white px-2 text-xs text-[#1F2937] outline-none"
            />
          </label>

          <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-md border border-[#C3C6D7] bg-white px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('reports.audit.search')}
              aria-label={t('reports.audit.search')}
              className="w-full bg-transparent text-xs text-[#1F2937] outline-none placeholder:text-slate-400"
            />
          </label>

          <select
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            aria-label={t('reports.audit.col.entity')}
            className="h-9 rounded-md border border-[#C3C6D7] bg-white px-2 text-xs font-semibold text-[#1F2937] outline-none"
          >
            <option value="">{t('reports.audit.filterEntityAll')}</option>
            {ENTITY_TABS.map((value) => (
              <option key={value} value={value}>
                {entityLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {/* ACTION CHIPS */}

        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
          {filterChips.map((chip) => {
            const active = action === chip.id;

            return (
              <button
                key={chip.id || 'all'}
                type="button"
                onClick={() => {
                  setAction(chip.id);
                  setPage(1);
                }}
                style={active ? { backgroundColor: accent, borderColor: accent, color: '#ffffff' } : undefined}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  active
                    ? ''
                    : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F8F9FA]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* TABLE */}

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          {state.status === 'loading' && (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, row) => (
                <div key={row} className="h-9 w-full animate-pulse rounded bg-[#F1F3F5]" />
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertTriangle size={22} className="text-red-600" />
              <p className="text-xs text-[#4B5563]">{t('reports.audit.error')}</p>
              <button
                type="button"
                onClick={load}
                style={{ borderColor: accent, color: accent }}
                className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-xs font-bold hover:bg-[#F8F9FA]"
              >
                <RefreshCw size={12} />
                {t('reports.retry')}
              </button>
            </div>
          )}

          {state.status === 'ready' && state.logs.length === 0 && (
            <p className="py-12 text-center text-xs text-slate-400">{t('reports.audit.empty')}</p>
          )}

          {state.status === 'ready' && state.logs.length > 0 && (
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  {[
                    t('reports.audit.col.datetime'),
                    t('reports.audit.col.user'),
                    t('reports.audit.col.action'),
                    t('reports.audit.col.entity'),
                    t('reports.audit.col.item'),
                    t('reports.audit.col.details'),
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#4B5563]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {state.logs.map((log) => (
                  <tr key={log.logId} className="border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#F8F9FA]">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[#4B5563]">
                      {formatDateTime(log.createdAt)}
                    </td>

                    <td className="px-3 py-3 text-xs text-[#1F2937]">
                      <span className="block font-semibold">{log.actorName || '—'}</span>
                      {log.actorRole && (
                        <span className="block text-[11px] capitalize text-[#98A2B3]">
                          {log.actorRole}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          ACTION_STYLES[log.action] || 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {actionLabel(log.action)}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-xs text-[#1F2937]">{entityLabel(log.entityType)}</td>

                    <td className="px-3 py-3 text-xs text-[#1F2937]">{log.entityName || '—'}</td>

                    <td className="px-3 py-3 text-xs text-[#4B5563]">{log.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <span className="text-xs text-[#4B5563]">
            {state.status === 'ready'
              ? t('reports.audit.showing', { from, to, total: state.total })
              : t('common.loading')}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || state.status !== 'ready'}
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('reports.previous')}
            </button>

            <span className="text-xs font-semibold text-[#4B5563]">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || state.status !== 'ready'}
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('reports.next')}
            </button>

            <button
              type="button"
              onClick={exportLogs}
              disabled={exporting || state.total === 0}
              style={{ backgroundColor: accent, color: '#ffffff' }}
              className="ml-2 flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              {t('reports.audit.export')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
