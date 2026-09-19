import { useEffect, useRef, useState } from 'react';

import {
  getKiosks,
  getPatientDepartments,
  getWaitingCount,
  createPatientQueue,
  verifyKioskPin,
} from '../../services/backendApi';

import {
  getOfflineData,
  saveOfflineData,
  addPendingOperation,
} from '../../services/offlineStorage';

import { syncPendingOperations } from '../../services/queueSync';

import {
  ArrowRight,
  ArrowLeft,
  User,
  Accessibility,
  Building2,
  FlaskConical,
  Stethoscope,
  Building,
  Info,
  BedDouble,
  Wallet,
  ShieldCheck,
  Users,
  Clock,
  Calendar,
  Hourglass,
  Printer,
  DoorOpen,
  CheckCircle2,
  MapPin,
  ClipboardList,
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';

/* =========================================================
   BRAND THEME
========================================================= */

const BRAND_RED = '#9D0A0E';
const REGULAR_DARK = '#1F2937';

function getQueueThemeColor(queueType) {
  return queueType?.key === 'priority' ? BRAND_RED : REGULAR_DARK;
}

/* =========================================================
   QR TRACKER URL
========================================================= */

const TRACKER_BASE_URL =
  'https://swu-med-queueing-system-1.onrender.com/tracker';

function getTrackerUrl(queueId) {
  if (!queueId) {
    return TRACKER_BASE_URL;
  }

  const cleanQueueId = String(queueId).trim();

  if (!cleanQueueId) {
    return TRACKER_BASE_URL;
  }

  return `${TRACKER_BASE_URL}?ticket=${encodeURIComponent(
    cleanQueueId
  )}`;
}

/* =========================================================
   QUEUE TYPES
========================================================= */

const QUEUE_TYPES = [
  {
    key: 'regular',
    name: 'Regular Queue',
    label: 'REGULAR QUEUE',
    description:
      'For patients who do not require priority assistance.',
    icon: User,
  },
  {
    key: 'priority',
    name: 'Priority Queue',
    label: 'PRIORITY QUEUE',
    description:
      'For Senior Citizens, PWD, and Pregnant Patients.',
    icon: Accessibility,
  },
];

/* =========================================================
   KIOSK / DEPARTMENT ICONS
========================================================= */

function getKioskIcon(name = '') {
  const value = name.toLowerCase();

  if (
    value.includes('laboratory') ||
    value.includes('radiology') ||
    value.includes('lab')
  ) {
    return FlaskConical;
  }

  if (
    value.includes('clinic') ||
    value.includes('opd') ||
    value.includes('outpatient')
  ) {
    return Stethoscope;
  }

  if (
    value.includes('medical arts') ||
    value.includes('pharmacy')
  ) {
    return Building;
  }

  return Building2;
}

function getDepartmentIcon(
  name = '',
  classification = ''
) {
  const value =
    `${name} ${classification}`.toLowerCase();

  if (
    value.includes('lab') ||
    value.includes('radiology') ||
    value.includes('x-ray') ||
    value.includes('ultrasound') ||
    value.includes('scan')
  ) {
    return FlaskConical;
  }

  if (
    value.includes('clinic') ||
    value.includes('medicine') ||
    value.includes('surgery') ||
    value.includes('health') ||
    value.includes('pedia') ||
    value.includes('therapy') ||
    value.includes('cardiac')
  ) {
    return Stethoscope;
  }

  if (
    value.includes('billing') ||
    value.includes('cashier') ||
    value.includes('payment') ||
    value.includes('pharmacy')
  ) {
    return Wallet;
  }

  if (value.includes('admission')) {
    return BedDouble;
  }

  if (
    value.includes('social') ||
    value.includes('champ') ||
    value.includes('phil')
  ) {
    return ShieldCheck;
  }

  if (value.includes('information')) {
    return Info;
  }

  return ClipboardList;
}

function getDepartmentDescription(department) {
  if (department?.classification) {
    return department.classification;
  }

  if (department?.location) {
    return department.location;
  }

  return 'Department services and assistance.';
}

function isDepartmentActive(department) {
  return (
    !department?.status ||
    String(department.status).toLowerCase() === 'active'
  );
}

/* =========================================================
   KIOSK DAILY UNLOCK HELPERS
========================================================= */

/*
  The kiosk is unlocked PER DAY.

  Example:
    swu_kiosk_unlocked_<kiosk_id>_2026-09-14

  The kiosk automatically becomes locked again
  on the next calendar day.
*/

function getTodayKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function getKioskUnlockKey(kioskId) {
  return `swu_kiosk_unlocked_${kioskId}_${getTodayKey()}`;
}

function getActiveKioskKeyForToday() {
  return `swu_active_kiosk_${getTodayKey()}`;
}

function isKioskUnlocked(kioskId) {
  if (!kioskId) {
    return false;
  }

  return (
    localStorage.getItem(
      getKioskUnlockKey(kioskId)
    ) === 'true'
  );
}

function unlockKioskForToday(kioskId) {
  if (!kioskId) {
    return;
  }

  localStorage.setItem(
    getKioskUnlockKey(kioskId),
    'true'
  );

  localStorage.setItem(
    getActiveKioskKeyForToday(),
    kioskId
  );
}

function setActiveKioskForToday(kioskId) {
  if (!kioskId) {
    return;
  }

  localStorage.setItem(
    getActiveKioskKeyForToday(),
    kioskId
  );
}

function getActiveKioskForToday(kiosks) {
  const activeKioskId =
    localStorage.getItem(
      getActiveKioskKeyForToday()
    );

  if (!activeKioskId) {
    return null;
  }

  const activeKiosk = kiosks.find(
    (item) =>
      String(item.kiosk_id) ===
      String(activeKioskId)
  );

  if (
    !activeKiosk ||
    !isKioskUnlocked(
      activeKiosk.kiosk_id
    )
  ) {
    return null;
  }

  return activeKiosk;
}

/* =========================================================
   SWUMED WORDMARK
========================================================= */

function Wordmark({ size = 'text-xl', compact = false }) {
  return (
    <div
      className={`inline-flex items-center rounded-xl bg-white shadow-sm ${
        compact ? 'px-4 py-2' : 'px-8 py-5'
      }`}
    >
      <span className={`${size} font-extrabold leading-none`}>
        <span className="text-[#9D0A0E]">SWU</span>
        <span className="text-slate-900">Med</span>
      </span>
    </div>
  );
}

/* =========================================================
   KIOSK HEADER
========================================================= */

function KioskHeader() {
  const [now] = useState(new Date());

  const time = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const date = now.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }
  );

  return (
    <div className="mb-10 flex items-center justify-between">
      <Wordmark size="text-2xl" compact />

      <div className="flex items-center gap-5 text-lg font-semibold text-slate-700">
        <span className="flex items-center gap-2">
          <Clock size={20} />
          {time}
        </span>

        <span className="flex items-center gap-2">
          <Calendar size={20} />
          {date}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   SCREEN WRAPPER
========================================================= */

function Screen({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-12 py-16 print:hidden">
      <div className="w-full max-w-[984px]">
        {children}
      </div>
    </div>
  );
}

/* =========================================================
   NAVIGATION BUTTONS
========================================================= */

function NavButtons({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  disabled,
}) {
  return (
    <div className="flex justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-5 text-xl font-bold text-slate-600 hover:border-slate-300"
      >
        <ArrowLeft size={22} />
        Back
      </button>

      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className="flex items-center gap-2 rounded-xl bg-[#9D0A0E] px-10 py-5 text-xl font-bold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {continueLabel}
        <ArrowRight size={22} />
      </button>
    </div>
  );
}

/* =========================================================
   WELCOME SCREEN
========================================================= */

function WelcomeScreen({ onStart }) {
  return (
    <Screen>
      <div className="flex flex-col items-center px-2 text-center">
        <div className="mb-16">
          <Wordmark size="text-5xl" />
        </div>

        <h1 className="text-6xl font-extrabold text-slate-900">
          Welcome to
        </h1>

        <h1 className="mb-10 text-6xl font-extrabold text-[#9D0A0E]">
          SWU Med Hospital
        </h1>

        <p className="mb-16 text-3xl text-slate-500">
          Please tap below to get your queue number.
        </p>

        <button
          type="button"
          onClick={onStart}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#9D0A0E] py-8 text-3xl font-bold text-white shadow-sm hover:bg-[#7d0809]"
        >
          GET STARTED
          <ArrowRight size={30} />
        </button>
      </div>
    </Screen>
  );
}

/* =========================================================
   NUMERIC KEYPAD
========================================================= */

function NumericKeypad({ onDigit, onBackspace, onClear }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const keyClass =
    'flex h-20 items-center justify-center rounded-xl border border-slate-200 bg-white text-3xl font-semibold text-slate-800 transition hover:border-slate-300 active:bg-slate-50';

  return (
    <div className="grid grid-cols-3 gap-4">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onDigit(key)}
          className={keyClass}
        >
          {key}
        </button>
      ))}

      <button
        type="button"
        onClick={onClear}
        className={`${keyClass} text-lg text-slate-400`}
      >
        Clear
      </button>

      <button
        type="button"
        onClick={() => onDigit('0')}
        className={keyClass}
      >
        0
      </button>

      <button
        type="button"
        onClick={onBackspace}
        className={`${keyClass} text-lg text-slate-400`}
      >
        &#9003;
      </button>
    </div>
  );
}

/* =========================================================
   SELECT KIOSK SCREEN
========================================================= */

function SelectKioskScreen({
  kiosks,
  selected,
  onSelect,
  onBack,
  onContinue,
  loading,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900">
          Select Your Kiosk
        </h1>

        <p className="mt-3 text-2xl text-slate-500">
          Please select the kiosk where you are getting your service.
        </p>
      </div>

      <div className="mb-10 space-y-4">
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xl text-slate-400">
            Loading kiosks...
          </div>
        )}

        {!loading && kiosks.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-xl font-semibold text-slate-700">
              No kiosks are currently available.
            </p>

            <p className="mt-2 text-lg text-slate-400">
              Please contact the hospital administrator.
            </p>
          </div>
        )}

        {!loading &&
          kiosks.map((currentKiosk) => {
            const Icon = getKioskIcon(
              currentKiosk.name
            );

            const isSelected =
              selected?.kiosk_id ===
              currentKiosk.kiosk_id;

            const isUnlocked =
              isKioskUnlocked(
                currentKiosk.kiosk_id
              );

            return (
              <button
                key={currentKiosk.kiosk_id}
                type="button"
                onClick={() =>
                  onSelect(currentKiosk)
                }
                className={`relative flex w-full items-center gap-5 rounded-xl border p-6 text-left transition ${
                  isSelected
                    ? 'border-[#9D0A0E] bg-[#9D0A0E]/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {isSelected && (
                  <span className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                    <CheckCircle2 size={18} />
                  </span>
                )}

                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#9D0A0E]/10">
                  <Icon
                    size={28}
                    className="text-[#9D0A0E]"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`text-xl font-bold uppercase tracking-wide ${
                        isSelected
                          ? 'text-[#9D0A0E]'
                          : 'text-slate-800'
                      }`}
                    >
                      {currentKiosk.name}
                    </p>

                    {isUnlocked && (
                      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700">
                        UNLOCKED
                      </span>
                    )}
                  </div>

                  <p className="text-base text-slate-400">
                    Select this kiosk to continue.
                  </p>
                </div>
              </button>
            );
          })}
      </div>

      <NavButtons
        onBack={onBack}
        onContinue={onContinue}
        disabled={!selected || loading}
      />
    </Screen>
  );
}

/* =========================================================
   KIOSK CODE SCREEN
========================================================= */

function KioskPinScreen({
  kiosk,
  onBack,
  onSuccess,
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');

    if (!kiosk?.kiosk_id) {
      setError('Invalid kiosk.');
      return;
    }

    if (pin.length !== 4) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await verifyKioskPin(
        kiosk.kiosk_id,
        pin
      );

      if (result?.valid) {
        unlockKioskForToday(
          kiosk.kiosk_id
        );

        onSuccess();

        return;
      }

      setError(
        'Incorrect code. Please try again.'
      );

      setPin('');
    } catch (error) {
      console.error(
        'Kiosk PIN verification error:',
        error
      );

      setError(
        error?.message ||
          'Unable to verify kiosk code.'
      );

      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDigit(digit) {
    setError('');

    setPin((current) =>
      current.length >= 4
        ? current
        : current + digit
    );
  }

  function handleBackspace() {
    setError('');
    setPin((current) => current.slice(0, -1));
  }

  function handleClear() {
    setError('');
    setPin('');
  }

  return (
    <Screen>
      <div className="mb-12 flex justify-center">
        <Wordmark size="text-4xl" />
      </div>

      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900">
          Enter Kiosk Code
        </h1>

        <p className="mt-3 text-2xl text-slate-500">
          Please enter the kiosk code to activate.
        </p>

        {kiosk?.name && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#9D0A0E]/5 px-4 py-2 text-lg font-bold text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div className="mb-10 flex justify-center gap-4">
        {Array.from({ length: 4 }, (_, index) => {
          const filled = index < pin.length;
          const isActive = index === pin.length;

          return (
            <div
              key={index}
              className={`flex h-20 w-20 items-center justify-center rounded-xl border-2 bg-white text-2xl font-bold ${
                isActive
                  ? 'border-[#9D0A0E]'
                  : 'border-slate-200'
              }`}
            >
              {filled && (
                <span className="h-4 w-4 rounded-full bg-slate-800" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mb-6 text-center text-lg font-medium text-red-500">
          {error}
        </p>
      )}

      <div className="mb-10">
        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClear={handleClear}
        />
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pin.length !== 4 || submitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#9D0A0E] py-6 text-2xl font-bold text-white shadow-sm hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Activating...' : 'Activate Kiosk'}
          <ArrowRight size={24} />
        </button>

        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-2 text-lg font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>
    </Screen>
  );
}

/* =========================================================
   QUEUE TYPE SCREEN
========================================================= */

function QueueTypeScreen({
  selected,
  onSelect,
  onBack,
  onContinue,
  kiosk,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900">
          Select Your Queue Type
        </h1>

        <p className="mt-3 text-2xl text-slate-500">
          Please select the queue type that applies to you.
        </p>

        {kiosk && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#9D0A0E]/5 px-4 py-2 text-lg font-medium text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div className="mb-10 space-y-5">
        {QUEUE_TYPES.map((type) => {
          const isSelected =
            selected?.key === type.key;

          return (
            <button
              key={type.key}
              type="button"
              onClick={() => onSelect(type)}
              className={`relative w-full rounded-xl border p-10 text-center transition ${
                isSelected
                  ? 'border-[#9D0A0E] bg-[#9D0A0E]/5 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {isSelected && (
                <span className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                  <CheckCircle2 size={18} />
                </span>
              )}

              <p
                className={`text-4xl font-extrabold uppercase tracking-wide ${
                  isSelected
                    ? 'text-[#9D0A0E]'
                    : 'text-slate-800'
                }`}
              >
                {type.label}
              </p>
            </button>
          );
        })}
      </div>

      <NavButtons
        onBack={onBack}
        onContinue={onContinue}
        disabled={!selected}
      />
    </Screen>
  );
}

/* =========================================================
   DEPARTMENT (SELECT SERVICES) SCREEN
========================================================= */

function SelectDepartmentScreen({
  kiosk,
  departments,
  selected,
  onSelect,
  onBack,
  onContinue,
  loading,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900">
          What do you need today?
        </h1>

        <p className="mt-3 text-2xl text-slate-500">
          Please select a service to get your queue number.
        </p>

        {kiosk && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#9D0A0E]/5 px-4 py-2 text-lg font-medium text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div
        className="mb-4 max-h-[620px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xl text-slate-400">
            Loading services...
          </div>
        )}

        {!loading &&
          departments.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-xl font-semibold text-slate-700">
                No services are currently available.
              </p>

              <p className="mt-2 text-lg text-slate-400">
                Please contact the hospital administrator.
              </p>
            </div>
          )}

        {!loading && departments.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {departments.map((department) => {
              const Icon =
                getDepartmentIcon(
                  department.name,
                  department.classification
                );

              const isSelected =
                selected?.department_id ===
                department.department_id;

              const active = isDepartmentActive(department);

              return (
                <button
                  key={department.department_id}
                  type="button"
                  disabled={!active}
                  onClick={() =>
                    active && onSelect(department)
                  }
                  className={`relative flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition ${
                    !active
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                      : isSelected
                        ? 'border-[#9D0A0E] bg-[#9D0A0E]/5 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {isSelected && active && (
                    <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                      <CheckCircle2 size={14} />
                    </span>
                  )}

                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
                      !active ? 'bg-slate-200' : 'bg-[#9D0A0E]/10'
                    }`}
                  >
                    <Icon
                      size={28}
                      className={
                        !active
                          ? 'text-slate-400'
                          : 'text-[#9D0A0E]'
                      }
                    />
                  </div>

                  <p
                    className={`text-xl font-bold uppercase leading-tight tracking-wide ${
                      !active
                        ? 'text-slate-400'
                        : isSelected
                          ? 'text-[#9D0A0E]'
                          : 'text-slate-800'
                    }`}
                  >
                    {department.name}
                  </p>

                  <p className="text-base leading-tight text-slate-400">
                    {active
                      ? getDepartmentDescription(department)
                      : 'Inactive'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="mb-8 mt-4 text-center text-lg text-slate-400">
        &darr; Swipe up for more
      </p>

      <NavButtons
        onBack={onBack}
        onContinue={onContinue}
        disabled={
          loading ||
          departments.length === 0 ||
          !selected
        }
      />
    </Screen>
  );
}

/* =========================================================
   CONFIRM SCREEN
========================================================= */

function ConfirmScreen({
  queueType,
  kiosk,
  service,
  waitingAhead,
  isGenerating,
  onBack,
  onConfirm,
}) {
  const ServiceIcon = service?.icon || ClipboardList;
  const QueueIcon = queueType?.icon || User;

  return (
    <Screen>
      <KioskHeader />

      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900">
          Confirm Your Service
        </h1>

        <p className="mt-3 text-2xl text-slate-500">
          Please review your selected service before getting your queue number.
        </p>
      </div>

      <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center border-b border-slate-100 pb-6 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#9D0A0E]/10">
            <MapPin
              size={28}
              className="text-[#9D0A0E]"
            />
          </div>

          <p className="text-2xl font-bold text-slate-900">
            {kiosk?.name}
          </p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-4 rounded-xl bg-slate-100 px-6 py-5">
            <QueueIcon
              size={24}
              className="shrink-0 text-slate-700"
            />

            <p className="text-xl font-semibold text-slate-800">
              {queueType?.name}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-slate-100 px-6 py-5">
            <ServiceIcon
              size={24}
              className="shrink-0 text-slate-700"
            />

            <p className="text-xl font-semibold text-slate-800">
              {service?.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-100 px-6 py-5 text-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Current Queue
            </p>

            <p className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-extrabold text-slate-900">
                {waitingAhead}
              </span>
              <span className="text-lg font-semibold text-[#9D0A0E]">
                people ahead
              </span>
            </p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Estimated Wait
            </p>

            <p className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-extrabold text-slate-900">
                ~{service?.estMin ?? 0}
              </span>
              <span className="text-lg font-semibold text-[#9D0A0E]">
                min
              </span>
            </p>
          </div>
        </div>
      </div>

      <NavButtons
        onBack={onBack}
        onContinue={onConfirm}
        continueLabel={
          isGenerating
            ? 'Generating...'
            : 'Generate Queue Number'
        }
        disabled={isGenerating}
      />
    </Screen>
  );
}

/* =========================================================
   TICKET SCREEN
========================================================= */

function TicketScreen({
  queueType,
  kiosk,
  service,
  queueNumber,
  queueId,
  onPrint,
  onSkipPrint,
}) {
  const themeColor = getQueueThemeColor(queueType);

  return (
    <Screen>
      <KioskHeader />

      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900">
          Your Queue Number
        </h1>

        <p className="mt-3 text-2xl text-slate-500">
          Please keep this slip until your number is called.
        </p>
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="px-10 py-12 text-center"
          style={{ backgroundColor: themeColor }}
        >
          <p className="mb-6 text-8xl font-extrabold text-white">
            {queueNumber}
          </p>

          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-base font-bold uppercase tracking-wide text-white">
            {queueType?.label}
          </span>

          <p className="mt-4 text-lg text-white/70">
            SERVICE: {service?.name}
          </p>

          <p className="text-lg text-white/70">
            DEPARTMENT: {kiosk?.name}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-8 p-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-5 py-4">
              <Users
                size={22}
                className="text-slate-400"
              />

              <div>
                <p className="text-base text-slate-400">
                  Waiting Info
                </p>

                <p className="text-xl font-semibold text-slate-700">
                  {service?.waiting ?? 0}{' '}
                  people waiting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-5 py-4">
              <Hourglass
                size={22}
                className="text-slate-400"
              />

              <div>
                <p className="text-base text-slate-400">
                  Estimated Wait
                </p>

                <p className="text-xl font-semibold text-slate-700">
                  ~{service?.estMin ?? 0}{' '}
                  minutes
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <QRCodeSVG
              value={getTrackerUrl(queueId)}
              size={160}
              level="M"
              includeMargin={true}
            />

            <p className="mt-2 max-w-[160px] text-center text-sm text-slate-400">
              Scan the QR code to track your queue status on your phone.
            </p>
          </div>
        </div>
      </div>

      <p className="mb-5 text-center text-2xl font-medium text-slate-700">
        Would you like to print your ticket?
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onPrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#9D0A0E] py-5 text-xl font-bold text-white hover:bg-[#7d0809]"
        >
          <Printer size={22} />
          PRINT TICKET
        </button>

        <button
          type="button"
          onClick={onSkipPrint}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-5 text-xl font-bold text-slate-600 hover:border-slate-300"
        >
          CONTINUE WITHOUT PRINTING
          <ArrowRight size={22} />
        </button>
      </div>
    </Screen>
  );
}

/* =========================================================
   PRINTING SCREEN
========================================================= */

function PrintingScreen({
  queueType,
  queueNumber,
}) {
  const themeColor = getQueueThemeColor(queueType);

  return (
    <Screen>
      <KioskHeader />

      <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center shadow-sm">
        <h2 className="mb-8 text-4xl font-bold text-slate-900">
          Printing Your Ticket
        </h2>

        <div
          className="mx-auto mb-8 max-w-[420px] rounded-xl px-8 py-8"
          style={{ backgroundColor: themeColor }}
        >
          <p className="text-base uppercase tracking-wide text-white/60">
            Your queue number
          </p>

          <p className="text-5xl font-bold text-white">
            {queueNumber}
          </p>
        </div>

        <DoorOpen
          size={48}
          className="mx-auto mb-6 animate-pulse text-slate-300"
        />

        <p className="mb-6 text-xl text-slate-500">
          Please wait while your ticket is being printed.
          Take it with you to the waiting area.
        </p>

        <p
          className="flex items-center justify-center gap-2 text-lg font-medium"
          style={{ color: themeColor }}
        >
          <span
            className="h-2.5 w-2.5 animate-pulse rounded-full"
            style={{ backgroundColor: themeColor }}
          />
          Printing...
        </p>
      </div>
    </Screen>
  );
}

/* =========================================================
   SUCCESS SCREEN
========================================================= */

function SuccessScreen({
  queueType,
  queueNumber,
}) {
  const themeColor = getQueueThemeColor(queueType);

  return (
    <Screen>
      <KioskHeader />

      <div className="rounded-2xl border border-slate-200 bg-white p-14 text-center shadow-sm">
        <div
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${themeColor}1A` }}
        >
          <CheckCircle2
            size={40}
            style={{ color: themeColor }}
          />
        </div>

        <h2 className="mb-8 text-4xl font-bold text-slate-900">
          Ticket Printed Successfully!
        </h2>

        <div
          className="mx-auto mb-8 max-w-[420px] rounded-xl border px-8 py-8"
          style={{
            backgroundColor: `${themeColor}0D`,
            borderColor: `${themeColor}33`,
          }}
        >
          <p className="text-base uppercase tracking-wide text-slate-400">
            Your queue number
          </p>

          <p
            className="text-5xl font-bold"
            style={{ color: themeColor }}
          >
            {queueNumber}
          </p>
        </div>

        <p className="mb-2 text-xl text-slate-500">
          Please take your ticket and proceed to the waiting area.
        </p>

        <p className="text-lg text-slate-400">
          Scan the QR code on your ticket to track your queue.
        </p>
      </div>
    </Screen>
  );
}

/* =========================================================
   PRINTED TICKET RECEIPT (real printable output)
========================================================= */

function PrintedTicketReceipt({
  kiosk,
  service,
  queueType,
  queueNumber,
  queueId,
}) {
  if (!queueNumber) {
    return null;
  }

  const themeColor = getQueueThemeColor(queueType);
  const now = new Date();

  const dateLabel = now.toLocaleDateString(undefined, {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });

  const timeLabel = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="hidden print:flex print:min-h-screen print:items-center print:justify-center">
      <div className="w-full max-w-[320px] p-6 text-center">
        <Wordmark size="text-xl" compact />

        <p className="mt-4 text-base font-bold uppercase tracking-wide text-slate-800">
          {kiosk?.name}
        </p>

        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Queue Number
        </p>

        <p
          className="text-5xl font-extrabold"
          style={{ color: themeColor }}
        >
          {queueNumber}
        </p>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <div className="space-y-1.5 text-left text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Service:</span>
            <span className="font-semibold text-slate-800">
              {service?.name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">People Ahead:</span>
            <span className="font-semibold text-slate-800">
              {service?.waiting ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Estimated Wait:</span>
            <span className="font-semibold text-slate-800">
              {service?.estMin ?? 0} minutes
            </span>
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{dateLabel}</span>
          <span>{timeLabel}</span>
        </div>

        <div className="my-4 flex justify-center">
          <QRCodeSVG
            value={getTrackerUrl(queueId)}
            size={130}
            level="M"
            includeMargin={true}
          />
        </div>

        <p className="text-xs text-slate-400">
          Scan the QR code to track your queue.
        </p>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <p className="text-xs text-slate-400">
          Please keep this ticket until your number is called.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PATIENT VIEW
========================================================= */

export default function PatientView({
  kioskId = null,
}) {
  const [step, setStep] =
    useState('welcome');

    console.log('PATIENT CURRENT STEP:', step);

  const [queueType, setQueueType] =
    useState(null);

  const [kiosk, setKiosk] =
    useState(null);

  const [service, setService] =
    useState(null);

  const [queueNumber, setQueueNumber] =
    useState('');

  const [queueId, setQueueId] =
    useState('');

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [
    requiresKioskSelection,
    setRequiresKioskSelection,
  ] = useState(false);

  /* =======================================================
     KIOSKS
  ======================================================= */

  const [kiosks, setKiosks] =
    useState([]);

  const [kiosksLoading, setKiosksLoading] =
    useState(true);

  const [kiosksError, setKiosksError] =
    useState('');

  const kioskFetchRef =
    useRef(null);

  /*
    Kiosks are now retrieved through:

      Patient.jsx
          ↓
      backendApi.js
          ↓
      Node.js
          ↓
      MySQL / Firebase backend logic

    Patient.jsx no longer talks directly to
    Supabase or Firebase.
  */

async function fetchKiosks() {
  if (kioskFetchRef.current) {
    return kioskFetchRef.current;
  }

  const fetchPromise = (async () => {
    setKiosksLoading(true);
    setKiosksError('');

    try {
      let data = [];

      try {
        // Try the backend first.
        data = await getKiosks();

        // Cache the successful kiosk response for offline use.
        await saveOfflineData('kiosks', data || []);
      } catch (onlineError) {
  console.warn(
    'Unable to fetch kiosks from backend. Trying offline cache:',
    onlineError
  );

  console.log('OFFLINE CACHE: attempting to read kiosks...');

  data = await getOfflineData('kiosks');

  console.log(
    'OFFLINE CACHE: kiosks retrieved:',
    data
  );

  if (!data || !Array.isArray(data)) {
    throw new Error(
      'No cached kiosk data is available for offline use.'
    );
  }
}

      const normalizedKiosks = (data || [])
        .map((item) => ({
          kiosk_id:
            item?.kiosk_id ||
            item?.id ||
            '',
          name:
            item?.name || '',
          status:
            item?.status ??
            null,
        }))
        .filter(
          (item) =>
            item.kiosk_id &&
            item.name
        )
        .filter(
          (item) =>
            !item.status ||
            String(item.status).toLowerCase() ===
              'active'
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name)
        );

      setKiosks(normalizedKiosks);
      setKiosksError('');

      console.log(
  'NORMALIZED OFFLINE KIOSKS:',
  normalizedKiosks
);

      if (normalizedKiosks.length === 0) {
        setKiosksError(
          'No kiosks are currently available.'
        );
      }
    } catch (error) {
  console.error(
    'Error fetching kiosks:',
    error
  );

  // Keep already-loaded kiosk data if it exists.
  // This prevents a failed refresh from wiping out
  // valid offline-cached kiosks.
  setKiosks((currentKiosks) => {
    if (currentKiosks.length > 0) {
      return currentKiosks;
    }

    return [];
  });

  setKiosksError(
    error?.message ||
      'Unable to load kiosks.'
  );
} finally {
      setKiosksLoading(false);
    }
  })();

  kioskFetchRef.current =
    fetchPromise;

  try {
    return await fetchPromise;
  } finally {
    kioskFetchRef.current = null;
  }
}

  /* =======================================================
     INITIAL KIOSK LOAD
  ======================================================= */

  useEffect(() => {
    fetchKiosks();
  }, []);

   /* =======================================================
     AUTOMATIC QUEUE SYNCHRONIZATION
  ======================================================= */

  useEffect(() => {
  console.log('QUEUE SYNC: initializing...');

  // Try to sync immediately when PatientView loads.
  syncPendingOperations();

  const handleOnline = () => {
    console.log(
      'QUEUE SYNC: connection restored. Starting synchronization...'
    );

    syncPendingOperations();
  };

  window.addEventListener('online', handleOnline);

  // Also retry periodically in case the browser remains "online"
  // while the backend itself was temporarily unavailable.
  const syncInterval = setInterval(() => {
    syncPendingOperations();
  }, 10000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(syncInterval);
  };
}, []);


  /* =======================================================
     UPDATE OFFLINE TICKET AFTER QUEUE SYNCHRONIZATION
  ======================================================= */

  useEffect(() => {
    const handleQueueSyncSuccess = (event) => {
      const {
        local_id,
        queue_id,
        queue_number,
        queue_data,
      } = event.detail || {};

      if (!local_id || local_id !== queueId) {
        return;
      }

      console.log(
        'QUEUE SYNC: updating current ticket with backend queue:',
        queue_number
      );

      setQueueId(String(queue_id));
      setQueueNumber(queue_number);

      setService((current) => ({
        ...current,
        estMin:
          Number(queue_data?.est_time) ||
          current?.estMin ||
          0,
        waiting:
          current?.waiting ?? 0,
      }));
    };

    window.addEventListener(
      'queue-sync-success',
      handleQueueSyncSuccess
    );

    return () => {
      window.removeEventListener(
        'queue-sync-success',
        handleQueueSyncSuccess
      );
    };
  }, [queueId]);
  
  /* =======================================================
     REFRESH KIOSKS WHEN KIOSK SCREEN OPENS
  ======================================================= */

  useEffect(() => {
    if (step === 'kiosk') {
      fetchKiosks();
    }
  }, [step]);

  /* =======================================================
     DEPARTMENTS
  ======================================================= */

  const [departments, setDepartments] =
    useState([]);

  const [
    departmentsLoading,
    setDepartmentsLoading,
  ] = useState(false);

  const [
    departmentsError,
    setDepartmentsError,
  ] = useState('');

  /*
    Loads departments for the selected kiosk through:

      Patient.jsx
          ↓
      backendApi.js
          ↓
      Node.js
          ↓
      MySQL

    Inactive departments are kept in the list (not hidden)
    so the kiosk can show them greyed-out/disabled, matching
    the reference design.
  */

  async function fetchDepartments(
    kioskRecord
  ) {
      console.log(
    'FETCH DEPARTMENTS STARTED:',
    kioskRecord
  );

    if (!kioskRecord?.kiosk_id) {
      setDepartments([]);
      return;
    }

    setDepartmentsLoading(true);
    setDepartmentsError('');

    try {
  let data = [];

  try {
    // Try the backend first.
    data = await getPatientDepartments(
  kioskRecord.kiosk_id
);

console.log(
  'DEPARTMENTS FROM BACKEND:',
  data
);

// Save the successful response for offline use.
await saveOfflineData(
  `departments_${kioskRecord.kiosk_id}`,
  data || []
);

console.log(
  'DEPARTMENTS SAVED TO OFFLINE CACHE:',
  `departments_${kioskRecord.kiosk_id}`
);

  } catch (onlineError) {
    console.warn(
      'Unable to fetch departments from backend. Trying offline cache:',
      onlineError
    );

    // Backend unavailable — use the last cached departments.
    data = await getOfflineData(
      `departments_${kioskRecord.kiosk_id}`
    );

    console.log(
      'OFFLINE CACHE: departments retrieved:',
      data
    );

    if (!data || !Array.isArray(data)) {
      throw new Error(
        'No cached department data is available for offline use.'
      );
    }
  }

  setDepartmentsError('');

  const allDepartments = data || [];

      /*
        Get current waiting count for
        each active department.
      */

      const departmentsWithWaiting =
        await Promise.all(
          allDepartments.map(
            async (department) => {
              let waiting = 0;

              if (isDepartmentActive(department)) {
                try {
                  const waitingData =
                    await getWaitingCount(
                      department.department_id
                    );

                  waiting =
                    Number(
                      waitingData?.waiting_count
                    ) || 0;
                } catch (error) {
                  console.warn(
                    `Unable to get waiting count for ${department.name}:`,
                    error
                  );

                  waiting = 0;
                }
              }

              return {
                ...department,

                queuePrefix:
                  department.prefix ||
                  '',

                estMin:
                  Number(
                    department.est_time
                  ) || 0,

                waiting,

                icon:
                  getDepartmentIcon(
                    department.name,
                    department.classification
                  ),
              };
            }
          )
        );

      setDepartments(
        departmentsWithWaiting
      );
    } catch (error) {
      console.error(
        'Error fetching departments:',
        error
      );

      setDepartments([]);

      setDepartmentsError(
        error?.message ||
          'Unable to load departments.'
      );
    } finally {
      setDepartmentsLoading(false);
    }
  }

  /* =======================================================
     FETCH DEPARTMENTS WHEN KIOSK CHANGES
  ======================================================= */

useEffect(() => {
  console.log('DEPARTMENT EFFECT — kiosk:', kiosk);

  if (!kiosk) {
    setDepartments([]);
    setDepartmentsError('');
    return;
  }

  console.log(
    'DEPARTMENT EFFECT — fetching departments for:',
    kiosk.kiosk_id,
    kiosk.name
  );

  fetchDepartments(kiosk);
}, [kiosk?.kiosk_id]);

  /* =======================================================
     GET STARTED
  ======================================================= */

  function handleStart() {
    /*
      If PatientView is configured for a specific
      physical kiosk, use that kiosk.
    */

    const configuredKiosk =
      kioskId
        ? kiosks.find(
            (item) =>
              String(
                item.kiosk_id
              ) ===
              String(kioskId)
          )
        : null;

    /*
      If the configured kiosk is already
      unlocked today, go directly to Queue Type.
    */

    const activeKiosk =
      configuredKiosk
        ? isKioskUnlocked(
            configuredKiosk.kiosk_id
          )
          ? configuredKiosk
          : null
        : getActiveKioskForToday(
            kiosks
          );

    if (activeKiosk) {
      setKiosk(activeKiosk);
      setQueueType(null);
      setService(null);

      setRequiresKioskSelection(
        false
      );

      setStep('queueType');

      return;
    }

    /*
      This terminal is bound to a specific kiosk but has
      not been unlocked yet today — go straight to the
      kiosk code screen instead of a kiosk picker.
    */

    if (configuredKiosk) {
      setKiosk(configuredKiosk);
      setQueueType(null);
      setService(null);

      setRequiresKioskSelection(
        false
      );

      setStep('kioskPin');

      return;
    }

    /*
      No specific kiosk is configured and no active
      kiosk has been unlocked today. Patient must
      select a kiosk.
    */

    setKiosk(null);
    setQueueType(null);
    setService(null);

    setRequiresKioskSelection(
      true
    );

    setStep('kiosk');
  }

  /* =======================================================
     KIOSK SELECTION
  ======================================================= */

  function handleKioskSelect(
    selectedKiosk
  ) {
    setKiosk(selectedKiosk);
    setQueueType(null);
    setService(null);

    /*
      If this kiosk was already unlocked today,
      skip PIN.
    */

    if (
      isKioskUnlocked(
        selectedKiosk.kiosk_id
      )
    ) {
      setActiveKioskForToday(
        selectedKiosk.kiosk_id
      );

      setStep('queueType');

      return;
    }

    /*
      First use of this kiosk today.
      Require PIN.
    */

    setStep('kioskPin');
  }

  /* =======================================================
     KIOSK PIN SUCCESS
  ======================================================= */

  function handleKioskPinSuccess() {
    if (!kiosk?.kiosk_id) {
      return;
    }

    setActiveKioskForToday(
      kiosk.kiosk_id
    );

    setRequiresKioskSelection(
      true
    );

    setQueueType(null);
    setService(null);

    setStep('queueType');
  }

  /* =======================================================
     RESET PATIENT FLOW
  ======================================================= */

  function handleReset() {
    /*
      IMPORTANT:
      The daily kiosk unlock is NOT cleared.

      This only resets the current patient session.
    */

    setQueueType(null);
    setKiosk(null);
    setService(null);
    setQueueNumber('');
    setQueueId('');
    setIsGenerating(false);

    setRequiresKioskSelection(
      false
    );

    setDepartments([]);
    setDepartmentsError('');

    setStep('welcome');
  }

  /* =======================================================
     GENERATE QUEUE NUMBER
  ======================================================= */

async function handleGenerateNumber() {
  if (isGenerating) {
    return;
  }

  try {
    setIsGenerating(true);

    /* ---------------------------------------------------
       VALIDATE
    --------------------------------------------------- */

    if (!queueType) {
      throw new Error(
        'Please select a queue type.'
      );
    }

    if (!kiosk) {
      throw new Error(
        'Please select a kiosk.'
      );
    }

    if (!service) {
      throw new Error(
        'Please select a department.'
      );
    }

    if (!service.department_id) {
      throw new Error(
        'The selected department does not have a valid department ID.'
      );
    }

    /* Extra safety check. */
    if (
      String(service.kiosk_id) !==
      String(kiosk.kiosk_id)
    ) {
      throw new Error(
        'The selected department does not belong to the selected kiosk.'
      );
    }

    const requestData = {
      kiosk_id: kiosk.kiosk_id,
      kiosk_name: kiosk.name,
      department_id: service.department_id,
      department_name: service.name,
      queue_type:
        queueType.key === 'priority'
          ? 'Priority'
          : 'Regular',
    };

    /* ---------------------------------------------------
       CREATE QUEUE THROUGH NODE.JS
    --------------------------------------------------- */

    let result;

    try {
      result = await createPatientQueue(
        requestData
      );
    } catch (onlineError) {
      console.warn(
        'Unable to create queue through backend. Saving as pending offline operation:',
        onlineError
      );

      /* ---------------------------------------------------
         OFFLINE QUEUE FALLBACK

         The backend normally creates the authoritative
         queue number. Since the backend is unavailable,
         do NOT invent an official queue sequence.

         Save the exact request so it can be submitted
         to the backend when the connection returns.
      --------------------------------------------------- */

      const localQueueId =
        `offline-${crypto.randomUUID()}`;

      const pendingOperation = {
        type: 'CREATE_PATIENT_QUEUE',
        local_id: localQueueId,
        payload: requestData,
        created_at: new Date().toISOString(),
        status: 'pending',
      };

      await addPendingOperation(
        pendingOperation
      );

      console.log(
        'OFFLINE QUEUE SAVED:',
        pendingOperation
      );

      /* ---------------------------------------------------
         CREATE A TEMPORARY LOCAL TICKET

         This is NOT an authoritative hospital queue
         number. It identifies this offline ticket until
         the backend assigns the real queue number.
      --------------------------------------------------- */

      const offlineQueueNumber =
        `OFFLINE-${Date.now()}`;

      setQueueId(localQueueId);

      setQueueNumber(
        offlineQueueNumber
      );

      setService((current) => ({
        ...current,
        waiting:
          current?.waiting ?? 0,
        estMin:
          Number(current?.estMin) || 0,
      }));

      setStep('ticket');

      return;
    }

    /* ---------------------------------------------------
       VALIDATE ONLINE RESPONSE
    --------------------------------------------------- */

    if (!result) {
      throw new Error(
        'The server did not return queue information.'
      );
    }

    if (!result.queue_id) {
      throw new Error(
        'Queue was created, but no queue ID was returned.'
      );
    }

    if (!result.queue_number) {
      throw new Error(
        'Queue was created, but no queue number was returned.'
      );
    }

    /* ---------------------------------------------------
       SAVE QUEUE INFORMATION
    --------------------------------------------------- */

    setQueueId(
      String(result.queue_id)
    );

    setQueueNumber(
      result.queue_number
    );

    /*
      Update the selected service with
      the latest values returned by Node.
    */

    setService((current) => ({
      ...current,
      waiting:
        current?.waiting ?? 0,
      estMin:
        Number(result.est_time) ||
        current?.estMin ||
        0,
    }));

    /*
      Refresh the waiting count once more right after
      the ticket is created.
    */

    try {
      const waitingData =
        await getWaitingCount(
          service.department_id
        );

      const latestWaiting =
        Math.max(
          0,
          (Number(
            waitingData?.waiting_count
          ) || 0) - 1
        );

      setService((current) =>
        current
          ? {
              ...current,
              waiting:
                latestWaiting,
            }
          : current
      );
    } catch (error) {
      console.warn(
        'Unable to refresh waiting count after ticket creation:',
        error
      );
    }

    /* ---------------------------------------------------
       SHOW TICKET
    --------------------------------------------------- */

    setStep('ticket');
  } catch (error) {
    console.error(
      'Queue generation error:',
      error
    );

    alert(
      `Database Error: ${
        error?.message ||
        'Unable to generate queue number.'
      }`
    );
  } finally {
    setIsGenerating(false);
  }
}

  /* =======================================================
     PRINT
  ======================================================= */

  function handlePrint() {
    setStep('printing');
  }

  /* =======================================================
     PRINTING → TRIGGER REAL PRINT → SUCCESS
  ======================================================= */

  useEffect(() => {
    if (
      step !== 'printing'
    ) {
      return;
    }

    /*
      Trigger the browser's real print dialog. The printable
      receipt is rendered by <PrintedTicketReceipt /> below,
      which is the only thing visible via the print:* classes
      when printing.
    */

    const printTimer = setTimeout(() => {
      window.print();
    }, 400);

    const advanceTimer =
      setTimeout(() => {
        setStep('success');
      }, 2200);

    return () => {
      clearTimeout(printTimer);
      clearTimeout(advanceTimer);
    };
  }, [step]);

  /* =======================================================
     SUCCESS → RESET
  ======================================================= */

  useEffect(() => {
    if (
      step !== 'success'
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        handleReset();
      }, 4000);

    return () =>
      clearTimeout(timer);
  }, [step]);

  /* =======================================================
     RENDER
  ======================================================= */

  const receipt = (
    <PrintedTicketReceipt
      kiosk={kiosk}
      service={service}
      queueType={queueType}
      queueNumber={queueNumber}
      queueId={queueId}
    />
  );

  /* =======================================================
     WELCOME
  ======================================================= */

  if (
    step === 'welcome'
  ) {
    return (
      <>
        <WelcomeScreen
          onStart={
            handleStart
          }
        />
        {receipt}
      </>
    );
  }

  /* =======================================================
     KIOSK
  ======================================================= */

  if (
    step === 'kiosk'
  ) {
    return (
      <>
        <SelectKioskScreen
          kiosks={kiosks}
          selected={kiosk}
          loading={
            kiosksLoading
          }
          onSelect={
            handleKioskSelect
          }
          onBack={
            handleReset
          }
          onContinue={() => {
            if (!kiosk) {
              return;
            }

            if (
              isKioskUnlocked(
                kiosk.kiosk_id
              )
            ) {
              setActiveKioskForToday(
                kiosk.kiosk_id
              );

              setStep(
                'queueType'
              );
            } else {
              setStep(
                'kioskPin'
              );
            }
          }}
        />

        {kiosksError && (
          <p className="fixed bottom-3 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[10px] font-medium text-red-600 shadow-sm">
            {kiosksError}
          </p>
        )}

        {receipt}
      </>
    );
  }

  /* =======================================================
     KIOSK PIN
  ======================================================= */

  if (
    step === 'kioskPin' &&
    kiosk
  ) {
    return (
      <>
        <KioskPinScreen
          kiosk={kiosk}
          onBack={() =>
            requiresKioskSelection
              ? setStep('kiosk')
              : handleReset()
          }
          onSuccess={
            handleKioskPinSuccess
          }
        />
        {receipt}
      </>
    );
  }

  /* =======================================================
     QUEUE TYPE
  ======================================================= */

  if (
    step === 'queueType'
  ) {
    return (
      <>
        <QueueTypeScreen
          selected={
            queueType
          }
          kiosk={kiosk}
          onSelect={(type) => {
            setQueueType(type);
            setService(null);
          }}
          onBack={() => {
            /*
              If the patient entered through kiosk
              selection, return to kiosk selection.

              If a physical kiosk was already unlocked,
              return to welcome.
            */

            if (
              requiresKioskSelection
            ) {
              setStep('kiosk');
            } else {
              handleReset();
            }
          }}
          onContinue={() => {
            if (!queueType) {
              return;
            }

            if (!kiosk) {
              return;
            }

            /*
              Refresh departments before moving
              to department selection.
            */

            fetchDepartments(kiosk);

            setStep(
              'department'
            );
          }}
        />
        {receipt}
      </>
    );
  }

  /* =======================================================
     DEPARTMENT
  ======================================================= */

  if (
    step === 'department'
  ) {
    return (
      <>
        <SelectDepartmentScreen
          kiosk={kiosk}
          departments={
            departments
          }
          loading={
            departmentsLoading
          }
          selected={
            service
          }
          onSelect={(department) => {
            setService(
              department
            );
          }}
          onBack={() =>
            setStep(
              'queueType'
            )
          }
          onContinue={async () => {
            if (!service) {
              return;
            }

            /*
              The waiting count on `service` was fetched once
              when the kiosk/department list first loaded, so it
              can be stale by the time the patient reaches this
              step (staff may have already called people). Refresh
              it right before showing the confirm screen so the
              numbers reflect what's actually happening now.
            */

            try {
              const waitingData =
                await getWaitingCount(
                  service.department_id
                );

              setService((current) =>
                current
                  ? {
                      ...current,
                      waiting:
                        Number(
                          waitingData?.waiting_count
                        ) || 0,
                    }
                  : current
              );
            } catch (error) {
              console.warn(
                'Unable to refresh waiting count:',
                error
              );
            }

            setStep(
              'confirm'
            );
          }}
        />

        {departmentsError && (
          <p className="fixed bottom-3 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[10px] font-medium text-red-600 shadow-sm">
            {departmentsError}
          </p>
        )}

        {receipt}
      </>
    );
  }

  /* =======================================================
     CONFIRM
  ======================================================= */

  if (
    step === 'confirm'
  ) {
    return (
      <>
        <ConfirmScreen
          queueType={
            queueType
          }
          kiosk={kiosk}
          service={
            service
          }
          waitingAhead={
            service?.waiting ?? 0
          }
          isGenerating={
            isGenerating
          }
          onBack={() =>
            setStep(
              'department'
            )
          }
          onConfirm={
            handleGenerateNumber
          }
        />
        {receipt}
      </>
    );
  }

  /* =======================================================
     TICKET
  ======================================================= */

  if (
    step === 'ticket'
  ) {
    return (
      <>
        <TicketScreen
          queueType={
            queueType
          }
          kiosk={kiosk}
          service={
            service
          }
          queueNumber={
            queueNumber
          }
          queueId={
            queueId
          }
          onPrint={
            handlePrint
          }
          onSkipPrint={() =>
            handleReset()
          }
        />
        {receipt}
      </>
    );
  }

  /* =======================================================
     PRINTING
  ======================================================= */

  if (
    step === 'printing'
  ) {
    return (
      <>
        <PrintingScreen
          queueType={
            queueType
          }
          queueNumber={
            queueNumber
          }
        />
        {receipt}
      </>
    );
  }

  /* =======================================================
     SUCCESS
  ======================================================= */

  return (
    <>
      <SuccessScreen
        queueType={
          queueType
        }
        queueNumber={
          queueNumber
        }
      />
      {receipt}
    </>
  );
}
