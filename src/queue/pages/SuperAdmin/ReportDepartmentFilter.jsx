import { useMemo, useRef, useState } from 'react';
import { Building2, Search } from 'lucide-react';

import { useLanguage } from '../Admin/LanguageContext';
import {
  ACCENT,
  TriggerButton,
  primaryButtonProps,
  tint,
  useDismiss,
} from '../Admin/ReportFilters';

// =====================================================
// DEPARTMENT FILTER (Super Admin → Reports)
// =====================================================
//
// Multi-select, built from the same pieces as the Admin report dropdowns
// (trigger, dismiss behaviour, accent variable) so it looks and behaves
// like them.
//
// departments: [{ id, name, code }]
// value:       null (every department) or an array of selected ids.
//
// States, as in the design: all departments, one department (its name on
// the trigger), several departments ("N Departments").

export default function DepartmentFilterDropdown({ departments, value, onApply }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState([]);
  const rootRef = useRef(null);

  useDismiss(rootRef, open, () => setOpen(false));

  const allIds = useMemo(() => departments.map((department) => String(department.id)), [departments]);

  function openPanel() {
    setPending(value ? value.map(String) : allIds);
    setQuery('');
    setOpen(true);
  }

  const needle = query.trim().toLowerCase();

  const visible = departments.filter((department) =>
    `${department.name} ${department.code}`.toLowerCase().includes(needle)
  );

  const allSelected = allIds.length > 0 && pending.length === allIds.length;

  function toggle(id) {
    setPending((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function apply() {
    // Nothing ticked or everything ticked both mean "no department filter".
    onApply(pending.length === 0 || allSelected ? null : pending);
    setOpen(false);
  }

  let triggerLabel = t('sa.rep.dept.all');

  if (value && value.length === 1) {
    triggerLabel =
      departments.find((department) => String(department.id) === String(value[0]))?.name || triggerLabel;
  } else if (value && value.length > 1) {
    triggerLabel = t('sa.rep.dept.count', { n: value.length });
  }

  return (
    <div className="relative" ref={rootRef}>
      <TriggerButton
        icon={Building2}
        label={triggerLabel}
        open={open}
        ariaLabel={t('sa.rep.dept.filter')}
        onClick={() => (open ? setOpen(false) : openPanel())}
        minWidth={190}
      />

      {open && (
        <div
          role="dialog"
          aria-label={t('sa.rep.dept.filter')}
          className="absolute left-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1F2937]">{t('sa.rep.dept.title')}</p>
              <p className="mt-0.5 text-[11px] text-[#98A2B3]">{t('sa.rep.dept.subtitle')}</p>
            </div>

            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={
                allSelected
                  ? { backgroundColor: '#F1F3F5', color: '#4B5563' }
                  : { backgroundColor: tint(12), color: ACCENT }
              }
            >
              {allSelected
                ? t('sa.rep.dept.badgeTotal', { n: allIds.length })
                : t('sa.rep.dept.badgeSelected', { n: pending.length })}
            </span>
          </div>

          <div className="px-3 pb-2">
            <label className="flex items-center gap-2 rounded-md border border-[#E5E7EB] px-2.5 py-2">
              <Search size={13} className="text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('sa.rep.dept.search')}
                aria-label={t('sa.rep.dept.search')}
                className="w-full bg-transparent text-xs text-[#1F2937] outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <label
            className="mx-3 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2"
            style={allSelected ? { backgroundColor: tint(10) } : undefined}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setPending(allSelected ? [] : allIds)}
              style={{ accentColor: ACCENT }}
              className="h-4 w-4"
            />
            <span className="flex-1 text-xs font-bold text-[#1F2937]">{t('sa.rep.dept.all')}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: tint(12), color: ACCENT }}
            >
              {t('sa.rep.dept.global')}
            </span>
          </label>

          <div className="max-h-56 overflow-y-auto px-3 py-1">
            {visible.length === 0 && (
              <p className="py-4 text-center text-[11px] text-slate-400">{t('sa.rep.dept.none')}</p>
            )}

            {visible.map((department) => {
              const id = String(department.id);
              const checked = pending.includes(id);

              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 hover:bg-[#F1F3F5]"
                  style={checked && !allSelected ? { backgroundColor: tint(8) } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    style={{ accentColor: ACCENT }}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#1F2937]">
                    {department.name}
                  </span>
                  {department.code && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={
                        checked
                          ? { backgroundColor: tint(12), color: ACCENT }
                          : { backgroundColor: '#F1F3F5', color: '#4B5563' }
                      }
                    >
                      {department.code}
                    </span>
                  )}
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
              {t('sa.rep.dept.clearAll')}
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
