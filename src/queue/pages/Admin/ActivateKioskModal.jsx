
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Power, X, RefreshCw } from 'lucide-react';

import {
  getKiosks,
  getKioskUnlockStatus,
  remotelyUnlockKiosk,
} from '../../services/backendApi';

import { useLanguage } from './LanguageContext';
import InputPinModal from '../../components/modals/inputPinModal';
import { getAuth } from 'firebase/auth';

const ACCENT = 'var(--admin-accent, #9D0A0E)';
const ACCENT_TINT = 'var(--admin-accent-soft, #FBF1F1)';

export default function ActivateKioskModal({
  open,
  department,
  currentUser,
  onClose,
  onActivated,
}) {
  const { t } = useLanguage();

  const [kiosks, setKiosks] = useState([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  // Daily unlock status: true = unlocked, false = locked, null = checking.
  const [isUnlocked, setIsUnlocked] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const inFlight = useRef(false);

  // Load kiosks whenever the modal opens.
  useEffect(() => {
    if (!open) return undefined;

    let mounted = true;

    setError('');
    setLoadError('');
    setLoading(true);

    getKiosks()
      .then((data) => {
        if (mounted) {
          setKiosks(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        console.error('Failed to load kiosks:', err);

        if (mounted) {
          setKiosks([]);
          setLoadError(
            err?.message || t('kioskActivate.loadError')
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open]);

  // Get the kiosk assigned to this department.
  const departmentKiosk = useMemo(
    () =>
      kiosks.find(
        (kiosk) =>
          department?.kiosk_id &&
          String(kiosk.kiosk_id) === String(department.kiosk_id)
      ) || null,
    [kiosks, department]
  );

  const selectedKiosk = departmentKiosk;

  // Fetch and periodically refresh the kiosk's daily unlock status.
  useEffect(() => {
    if (!open || !departmentKiosk?.kiosk_id) {
      setIsUnlocked(null);
      return undefined;
    }

    let mounted = true;

    const refreshUnlockStatus = async () => {
      try {
        setStatusLoading(true);

        const result = await getKioskUnlockStatus(
          departmentKiosk.kiosk_id
        );

        if (mounted) {
          setIsUnlocked(result?.unlocked === true);
        }
      } catch (err) {
        console.error('Failed to fetch kiosk unlock status:', err);

        if (mounted) {
          setIsUnlocked(null);
        }
      } finally {
        if (mounted) setStatusLoading(false);
      }
    };

    refreshUnlockStatus();

    const intervalId = setInterval(() => {
      refreshUnlockStatus();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [open, departmentKiosk?.kiosk_id]);

  // Close with Escape, unless an unlock request is in progress.
  useEffect(() => {
    if (!open) return undefined;

    function handleKey(event) {
      if (event.key === 'Escape' && !inFlight.current) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  function handleClose() {
    if (inFlight.current) return;
    onClose();
  }

  function handleActivate() {
    if (!selectedKiosk || inFlight.current) return;

    setError('');
    setPinModalOpen(true);
  }

  async function handleVerifyPin(pin) {
    if (inFlight.current) {
      throw new Error('A request is already in progress.');
    }

    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Only department admins can unlock kiosks.');
    }

    if (
      !selectedKiosk ||
      String(selectedKiosk.kiosk_id) !== String(department?.kiosk_id)
    ) {
      throw new Error('Invalid kiosk selection for this department.');
    }

    inFlight.current = true;
    setActivating(true);
    setError('');

    try {
      const firebaseUser = getAuth().currentUser;

      if (!firebaseUser) {
        throw new Error('No authenticated Firebase user found.');
      }

      const result = await remotelyUnlockKiosk(
        firebaseUser,
        selectedKiosk.kiosk_id,
        pin
      );

      if (!result?.success || !result?.unlocked) {
        throw new Error(
          result?.message || 'The kiosk was not unlocked.'
        );
      }

      // Update the UI immediately after a successful unlock.
      setIsUnlocked(true);

      return result;
    } finally {
      inFlight.current = false;
      setActivating(false);
    }
  }

  if (!open) return null;

  return (
    <>
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

            <h2
              id="activate-kiosk-title"
              className="text-[22px] font-bold text-[#1F2937]"
            >
              {t('queue.activateKiosk')}
            </h2>

            <p className="mt-1 text-sm text-[#4B5563]">
              {t('kioskActivate.subtitle')}
            </p>
          </div>

          {/* BODY */}
          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
            {loading && (
              <p className="py-8 text-center text-sm text-[#9CA3AF]">
                {t('kioskActivate.loading')}
              </p>
            )}

            {!loading && loadError && (
              <p className="py-4 text-sm text-[#9D0A0E]">
                {loadError}
              </p>
            )}

            {!loading && !loadError && !departmentKiosk && (
              <p className="py-8 text-center text-sm text-[#4B5563]">
                No kiosk is assigned to this department.
              </p>
            )}

            {!loading && !loadError && departmentKiosk && (
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#FBF1F1] p-3">
                    <MapPin size={20} style={{ color: ACCENT }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1F2937]">
                      {departmentKiosk.name}
                    </p>

                    {departmentKiosk.location && (
                      <p className="text-sm text-[#6B7280]">
                        {departmentKiosk.location}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-[#6B7280]">
                      Assigned department kiosk
                    </p>
                  </div>
                </div>

                {/* DAILY UNLOCK STATUS */}
                <div className="mt-4 flex items-center justify-between border-t border-[#EEF0F3] pt-4">
                  <div>
                    <p className="text-sm font-semibold text-[#374151]">
                      Daily Unlock Status
                    </p>

                    <p className="mt-1 text-xs text-[#6B7280]">
                      Resets according to Philippine time
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {statusLoading && isUnlocked === null ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                        <RefreshCw size={12} className="animate-spin" />
                        Checking
                      </span>
                    ) : isUnlocked === true ? (
                      <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
                        UNLOCKED
                      </span>
                    ) : isUnlocked === false ? (
                      <span className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
                        LOCKED
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                        STATUS UNKNOWN
                      </span>
                    )}
                  </div>
                </div>
              </div>
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
              disabled={
                !selectedKiosk ||
                loading ||
                activating ||
                pinModalOpen
              }
              className="flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-bold text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              <Power size={15} />

              {activating
                ? t('kioskActivate.activating')
                : t('queue.activateKiosk')}
            </button>
          </div>
        </div>
      </div>

      <InputPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onVerify={handleVerifyPin}
        onSuccess={async () => {
          setPinModalOpen(false);

          // Refresh the status from the backend after unlocking.
          if (selectedKiosk?.kiosk_id) {
            try {
              const result = await getKioskUnlockStatus(
                selectedKiosk.kiosk_id
              );

              setIsUnlocked(result?.unlocked === true);
            } catch (err) {
              console.error(
                'Failed to refresh unlock status after activation:',
                err
              );
              setIsUnlocked(true);
            }
          }

          await onActivated?.(selectedKiosk);
          onClose();
        }}
        title="Authorize Kiosk Unlock"
        description={`Enter your Security PIN to unlock ${selectedKiosk?.name || 'the selected kiosk'}.`}
        confirmLabel="Unlock Kiosk"
        successMessage="Kiosk unlocked successfully."
      />
    </>
  );
}