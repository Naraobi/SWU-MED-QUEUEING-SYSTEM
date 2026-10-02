import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, MapPin, Power, Search, X } from 'lucide-react';

import { getKiosks, updateKiosk } from '../../services/backendApi';
import { useLanguage } from './LanguageContext';

// Admin "Activate Kiosk" modal (Queue Management).
//
// Lists the INACTIVE kiosks of the Admin's own department (the department's
// kiosk_id, same scoping as Terminal Management) and activates the chosen one
// with the existing kiosk update call, the same one Super Admin's Kiosk
// Management uses to switch a kiosk's status (PUT /api/kiosks/:id).
//
// Rendered as a sibling inside the page, not a portal, so the Admin accent
// (--admin-accent, set on .admin-shell) and theme reach it.

const ACCENT = 'var(--admin-accent, #9D0A0E)';
const ACCENT_TINT = 'var(--admin-accent-soft, #FBF1F1)';

export default function ActivateKioskModal({ open, department, onClose, onActivated }) {
  const { t } = useLanguage();

  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  // A ref, not state: two fast clicks would both read a stale
  // `activating === false`. The ref updates synchronously.
  const inFlight = useRef(false);

  // Fresh data every time the modal opens.
  useEffect(() => {
    if (!open) return undefined;

    let mounted = true;

    setSearch('');
    setSelectedId('');
    setError('');
    setLoadError('');
    setLoading(true);

    getKiosks()
      .then((data) => {
        if (mounted) setKiosks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Failed to load kiosks:', err);
        if (mounted) {
          setKiosks([]);
          setLoadError(err?.message || t('kioskActivate.loadError'));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc closes (not while a request is running).
  useEffect(() => {
    if (!open) return undefined;

    function handleKey(event) {
      if (event.key === 'Escape' && !inFlight.current) onClose();
    }

    document.addEventListener('keydown', handleKey);

    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Only this Admin's department kiosk, and only if it is inactive.
  const inactiveKiosks = useMemo(
    () =>
      kiosks.filter(
        (kiosk) =>
          department?.kiosk_id &&
          String(kiosk.kiosk_id) === String(department.kiosk_id) &&
          String(kiosk.status || '').toLowerCase() === 'inactive'
      ),
    [kiosks, department]
  );

  const visibleKiosks = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return inactiveKiosks;

    return inactiveKiosks.filter(
      (kiosk) =>
        String(kiosk.name || '').toLowerCase().includes(term) ||
        String(kiosk.location || '').toLowerCase().includes(term)
    );
  }, [inactiveKiosks, search]);

  const selectedKiosk =
    inactiveKiosks.find((kiosk) => String(kiosk.kiosk_id) === String(selectedId)) || null;

  function handleClose() {
    if (inFlight.current) return;
    onClose();
  }

  async function handleActivate() {
    if (!selectedKiosk || inFlight.current) return;

    inFlight.current = true;
    setActivating(true);
    setError('');

    try {
      await updateKiosk(selectedKiosk.kiosk_id, {
        name: selectedKiosk.name,
        status: 'active',
      });

      inFlight.current = false;
      setActivating(false);

      await onActivated?.(selectedKiosk);
    } catch (err) {
      console.error('Failed to activate kiosk:', err);

      // The modal stays open so the failure can be read and retried.
      setError(err?.message || t('kioskActivate.error'));
      inFlight.current = false;
      setActivating(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4 py-6"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activate-kiosk-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* HEADER */}
        <div className="relative border-b border-[#EEF0F3] px-7 pb-5 pt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={activating}
            aria-label={t('common.close')}
            className="absolute right-5 top-5 rounded p-1 text-[#9CA3AF] transition hover:text-[#1F2937] disabled:opacity-40"
          >
            <X size={20} />
          </button>

          <h2 id="activate-kiosk-title" className="text-[22px] font-bold text-[#1F2937]">
            {t('queue.activateKiosk')}
          </h2>
          <p className="mt-1 text-sm text-[#4B5563]">{t('kioskActivate.subtitle')}</p>
        </div>

        {/* BODY */}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2.5">
            <Search size={16} className="shrink-0 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('kioskActivate.searchPlaceholder')}
              aria-label={t('kioskActivate.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF]"
            />
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#F1F3F5] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]" />
              {t('kioskActivate.inactiveOnly')}
            </span>
          </div>

          <div className="mb-3 mt-5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]">
              {t('kioskActivate.available')}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {t('kioskActivate.inactiveCount', { count: inactiveKiosks.length })}
            </span>
          </div>

          {loading && (
            <p className="py-8 text-center text-sm text-[#9CA3AF]">{t('kioskActivate.loading')}</p>
          )}

          {!loading && loadError && (
            <p className="flex items-start gap-1.5 py-4 text-sm text-[#9D0A0E]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {loadError}
            </p>
          )}

          {!loading && !loadError && inactiveKiosks.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#E5E7EB] py-8 text-center text-sm text-[#4B5563]">
              {t('kioskActivate.empty')}
            </p>
          )}

          {!loading && !loadError && inactiveKiosks.length > 0 && visibleKiosks.length === 0 && (
            <p className="py-6 text-center text-sm text-[#9CA3AF]">{t('kioskActivate.noMatch')}</p>
          )}

          {!loading && visibleKiosks.length > 0 && (
            <div className="space-y-3" role="radiogroup" aria-label={t('kioskActivate.available')}>
              {visibleKiosks.map((kiosk) => {
                const isSelected = String(kiosk.kiosk_id) === String(selectedId);

                return (
                  <button
                    key={kiosk.kiosk_id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={activating}
                    onClick={() => {
                      setSelectedId(String(kiosk.kiosk_id));
                      setError('');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border-2 bg-white px-4 py-3.5 text-left transition hover:border-[#9CA3AF] disabled:cursor-not-allowed"
                    style={
                      isSelected
                        ? { borderColor: ACCENT, backgroundColor: ACCENT_TINT }
                        : { borderColor: '#E5E7EB' }
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                      style={
                        isSelected
                          ? { borderColor: ACCENT, backgroundColor: ACCENT }
                          : { borderColor: '#D1D5DB' }
                      }
                    >
                      {isSelected && <Check size={13} strokeWidth={3} className="text-white" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-[#1F2937]">
                        {kiosk.name}
                      </span>
                      {kiosk.location && (
                        <span className="mt-0.5 flex items-center gap-1 text-sm text-[#4B5563]">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{kiosk.location}</span>
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 rounded-full bg-[#F1F3F5] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#4B5563]">
                      {t('kioskActivate.inactiveBadge')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedKiosk && (
            <div
              className="mt-5 flex items-start gap-3 rounded-lg border-l-4 bg-[#F8F9FA] px-4 py-3.5"
              style={{ borderLeftColor: '#E5E7EB' }}
            >
              <Info size={16} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4B5563]">
                  {t('kioskActivate.selectedKiosk')}
                </p>
                <p className="mt-0.5 text-[15px] font-bold text-[#1F2937]">
                  {selectedKiosk.name}
                  {selectedKiosk.location ? ` — ${selectedKiosk.location}` : ''}
                </p>
                <p className="mt-0.5 text-sm text-[#4B5563]">{t('kioskActivate.selectedNote')}</p>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 flex items-start gap-1.5 text-sm text-[#9D0A0E]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end gap-3 border-t border-[#EEF0F3] px-7 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={activating}
            className="h-11 rounded-lg border border-[#D1D5DB] bg-white px-6 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5] disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={handleActivate}
            disabled={!selectedKiosk || activating}
            className="flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-bold text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            <Power size={15} />
            {activating ? t('kioskActivate.activating') : t('queue.activateKiosk')}
          </button>
        </div>
      </div>
    </div>
  );
}
