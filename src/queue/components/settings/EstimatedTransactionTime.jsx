import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Timer,
  Plus,
  Save,
  Search,
  PencilLine,
  X,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';

import { getDepartments, updateDepartment } from '../../services/backendApi';
import { useLanguage } from '../../services/language';

/*
 * =============================================================================
 * Estimated Transaction Time
 * =============================================================================
 *
 * How long each service takes. These are the numbers the waiting-time estimate
 * is built from, which is why they are editable here rather than hard-coded.
 *
 * TWO MODES, picked automatically:
 *
 *   SERVICE MODE  - the backend has a services table, so time is set per
 *                   service (Laboratory has both Specimen Collection and
 *                   Results Retrieval, each with its own number).
 *
 *                     GET  /api/service-times   -> [{ id, department_id,
 *                                                     department, service,
 *                                                     minutes }]
 *                     PUT  /api/service-times   <- [{ id, minutes }]
 *                     POST /api/service-times   <- { department_id, service,
 *                                                    minutes }
 *                     GET  /api/services        -> [{ id, department_id, name }]
 *
 *   DEPARTMENT MODE - no services table yet, so it falls back to the
 *                   department-level `est_time` that already exists and is
 *                   already used by the queue. Editing and saving work today;
 *                   only the per-service split is missing.
 *
 * FOR THE BACKEND TEAM: department mode is the honest version of what exists
 * now. Adding the services table is what unlocks the design as drawn - the
 * screen switches by itself once GET /api/service-times answers.
 * =============================================================================
 */

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`;

const MIN_MINUTES = 1;
const MAX_MINUTES = 480;

function clampMinutes(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return MIN_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, number));
}

/* =========================================================
   ADD MODAL
========================================================= */


function AddTimeModal({
  departments,
  onClose,
  onAdd,
  saving,
  error,
}) {
  const { t } = useLanguage();

  const [departmentId, setDepartmentId] = useState('');
  const [minutes, setMinutes] = useState(10);

  const ready =
    Boolean(departmentId) &&
    Number(minutes) >= MIN_MINUTES &&
    Number(minutes) <= MAX_MINUTES;

  return (
    <div
      className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-time-title"
        onClick={(event) => event.stopPropagation()}
        className="swu-pop w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2 id="add-time-title" className="text-base font-bold text-[#1F2937]">
              {t('sa.est.addTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Set the estimated service time for a department.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={t('sa.common.close')}
            className="shrink-0 rounded-md p-1 text-[#9CA3AF] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label
              htmlFor="est-department"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              {t('sa.common.department')} <span className="text-[#9D0A0E]">*</span>
            </label>

            <select
              id="est-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              disabled={saving}
              className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:opacity-60"
            >
              <option value="">{t('sa.est.selectDepartment')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="est-minutes"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
            >
              Estimated time <span className="text-[#9D0A0E]">*</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                id="est-minutes"
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={1}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                onBlur={(event) => setMinutes(clampMinutes(event.target.value))}
                disabled={saving}
                className="h-10 w-28 rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#1F2937] outline-none focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:opacity-60"
              />
              <span className="text-sm text-[#4B5563]">
                {t('sa.est.minutes')}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Enter a value from {MIN_MINUTES} to {MAX_MINUTES} minutes.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs text-[#9D0A0E]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-4 text-xs font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            {t('sa.common.cancel')}
          </button>

          <button
            type="button"
            onClick={() =>
              onAdd({
                departmentId,
                minutes: clampMinutes(minutes),
              })
            }
            disabled={saving || !ready}
            className="swu-press h-9 rounded-lg bg-[#9D0A0E] px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('sa.est.adding') : t('sa.est.addAction')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION
========================================================= */

export default function EstimatedTransactionTime() {
  const { t } = useLanguage();

  const [mode, setMode] = useState('department');
  const [rows, setRows] = useState([]);
  const [baseline, setBaseline] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

const load = useCallback(async () => {
  setLoading(true);
  setLoadError('');
  setSaveError('');

  try {
    const result = await getDepartments();

    const departmentRows = (
      Array.isArray(result) ? result : result?.data ?? []
    ).map((department) => {
      const id = String(
        department.department_id ?? department.id ?? ''
      );

      return {
        id,
        departmentId: id,
        department:
          department.name ||
          department.department_name ||
          'Department',
        service:
          department.name ||
          department.department_name ||
          'Department',
        minutes: clampMinutes(department.est_time ?? 15),
      };
    });

    setDepartments(
      departmentRows.map((row) => ({
        id: row.id,
        name: row.department,
        estTime: row.minutes,
      }))
    );

    setMode('department');
    setRows(departmentRows);
    setBaseline(departmentRows);
    setServices([]);
  } catch (error) {
    setDepartments([]);
    setRows([]);
    setBaseline([]);
    setLoadError(
      error?.message || 'Failed to load departments.'
    );
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (rows.length !== baseline.length) return true;

    return rows.some((row, index) => row.minutes !== baseline[index]?.minutes);
  }, [rows, baseline]);

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;

    return rows.filter(
      (row) =>
        row.service.toLowerCase().includes(text) ||
        row.department.toLowerCase().includes(text)
    );
  }, [rows, query]);

  function setMinutes(id, value) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, minutes: value } : row))
    );
  }

async function handleSave() {
  setSaving(true);
  setSaveError('');

  const baselineById = new Map(
    baseline.map((row) => [row.id, row.minutes])
  );

  const changed = rows.filter(
    (row) => row.minutes !== baselineById.get(row.id)
  );

  try {
    for (const row of changed) {
      await updateDepartment(row.departmentId, {
        est_time: clampMinutes(row.minutes),
      });
    }

    setBaseline(
      rows.map((row) => ({
        ...row,
        minutes: clampMinutes(row.minutes),
      }))
    );

    setRows((current) =>
      current.map((row) => ({
        ...row,
        minutes: clampMinutes(row.minutes),
      }))
    );

    setSavedAt(new Date());
    setEditingId(null);
  } catch (error) {
    setSaveError(
      error?.message || t('sa.est.saveFailed')
    );
  } finally {
    setSaving(false);
  }
}
async function handleAdd({ departmentId, minutes }) {
  setAdding(true);
  setAddError('');

  try {
    await updateDepartment(departmentId, {
      est_time: clampMinutes(minutes),
    });

    setShowAdd(false);

    // Refresh the displayed department estimates after saving.
    await load();
  } catch (error) {
    setAddError(
      error?.message || 'Failed to save the estimated time.'
    );
  } finally {
    setAdding(false);
  }
}
  return (
    <section className="swu-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-2.5">
          <Timer size={16} className="mt-0.5 shrink-0 text-[#9D0A0E]" />

          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              {t('sa.est.title')}
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              {t('sa.est.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button
  type="button"
  onClick={() => {
    setAddError('');
    setShowAdd(true);
  }}
  disabled={loading || departments.length === 0}
  title={
    departments.length === 0
      ? 'No departments available'
      : undefined
  }
            className="swu-press inline-flex items-center gap-1.5 rounded-lg border border-[#F0DADA] bg-white px-3.5 py-2 text-xs font-semibold text-[#9D0A0E] transition-colors hover:bg-[#FBF1F1] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#9CA3AF] disabled:hover:bg-white"
          >
            <Plus size={13} />
            {t('sa.est.addAction')}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="swu-press inline-flex items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
          >
            <Save size={13} />
            {saving ? t('sa.common.saving') : t('sa.common.saveChanges')}
          </button>
        </div>
      </div>

      <div className="border-t border-[#E5E7EB] px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={13}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('sa.est.searchPlaceholder')}
              aria-label={t('sa.est.searchPlaceholder')}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] pl-8 pr-3 text-xs text-[#1F2937] outline-none placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {dirty && (
            <span className="text-xs font-semibold text-[#9D0A0E]">
              {t('sa.est.unsaved')}
            </span>
          )}

          {!dirty && savedAt && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D8A4E]">
              <Check size={12} strokeWidth={3} />
              {t('sa.est.saved')}
            </span>
          )}
        </div>

        {mode === 'department' && !loading && !loadError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 text-xs leading-5 text-[#4B5563]">
            <Info size={13} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
            {t('sa.est.departmentMode')}
          </div>
        )}

        {saveError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs text-[#9D0A0E]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {saveError}
          </div>
        )}

        {loadError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs text-[#9D0A0E]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />

            <span>
              {loadError}

              <button
                type="button"
                onClick={load}
                className="ml-2 font-semibold underline"
              >
                {t('sa.common.retry')}
              </button>
            </span>
          </div>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F8F9FA]">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  {t('sa.common.department')}
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  {t('sa.est.service')}
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  {t('sa.est.column')}
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                  {t('sa.est.action')}
                </th>
              </tr>
            </thead>

            <tbody className="swu-stagger">
              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-xs text-[#9CA3AF]"
                  >
                    {t('sa.est.loading')}
                  </td>
                </tr>
              )}

              {!loading && shown.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-xs text-[#9CA3AF]"
                  >
                    {rows.length === 0 ? t('sa.est.empty') : t('sa.est.noMatch')}
                  </td>
                </tr>
              )}

              {!loading &&
                shown.map((row) => {
                  const editing = editingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[#F1F3F5] transition-colors last:border-0 hover:bg-[#F8F9FA]"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-[#E4EAF4] px-2 py-0.5 text-xs font-medium text-[#3E4A61]">
                          {row.department}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-[#1F2937]">
                        {row.service}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={MIN_MINUTES}
                            max={MAX_MINUTES}
                            step={1}
                            value={row.minutes}
                            readOnly={!editing}
                            onChange={(event) =>
                              setMinutes(row.id, event.target.value)
                            }
                            onBlur={(event) =>
                              setMinutes(row.id, clampMinutes(event.target.value))
                            }
                            aria-label={`${row.service} ${t('sa.est.minutes')}`}
                            className={`h-9 w-20 rounded-lg border px-3 text-sm outline-none transition ${
                              editing
                                ? 'border-[#9D0A0E] bg-white text-[#1F2937] ring-2 ring-[#9D0A0E]/10'
                                : 'cursor-default border-[#E5E7EB] bg-[#F8F9FA] text-[#4B5563]'
                            }`}
                          />

                          <span className="text-xs text-[#9CA3AF]">
                            {t('sa.est.min')}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(editing ? null : row.id)}
                          aria-label={
                            editing ? t('sa.common.done') : t('sa.common.edit')
                          }
                          title={
                            editing ? t('sa.common.done') : t('sa.common.edit')
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                            editing
                              ? 'border-[#9D0A0E] bg-[#FBF1F1] text-[#9D0A0E]'
                              : 'border-[#E5E7EB] text-[#9CA3AF] hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]'
                          }`}
                        >
                          {editing ? (
                            <Check size={13} strokeWidth={3} />
                          ) : (
                            <PencilLine size={13} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

{showAdd && (
  <AddTimeModal
    departments={departments}
    saving={adding}
    error={addError}
    onClose={() => !adding && setShowAdd(false)}
    onAdd={handleAdd}
  />
)}
    </section>
  );
}
