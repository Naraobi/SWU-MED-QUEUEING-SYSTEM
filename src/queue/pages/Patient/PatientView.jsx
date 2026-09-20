import { useEffect, useRef, useState } from 'react';

import {
  getKiosks,
  getPatientDepartments,
  getWaitingCount,
  createPatientQueue,
  verifyKioskPin,
} from '../../services/backendApi';

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
  Lock,
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';
import logo from '../../../assets/logo.png';

import logoImage from '../../../assets/logo.png';
import { THEME } from '../../theme/colors';

/* =========================================================
   BRAND THEME
   (shared with Admin/Staff via src/queue/theme/colors.js;
   BORDER_DEFAULT and ICON_TINT are Patient-kiosk-specific)
========================================================= */

const BRAND_RED = THEME.primary;
const REGULAR_DARK = THEME.textMain;
const MUTED_RED = THEME.secondary;
const BORDER_DEFAULT = '#C3C6D7';
const SELECTED_BG = THEME.neutral;
const ICON_TINT = '#F7EEEE';

function getQueueThemeColor(queueType) {
  return queueType?.key === 'priority'
    ? BRAND_RED
    : REGULAR_DARK;
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
  const activeKioskId = localStorage.getItem(
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
    !isKioskUnlocked(activeKiosk.kiosk_id)
  ) {
    return null;
  }

  return activeKiosk;
}

/* =========================================================
   SWUMED WORDMARK
========================================================= */

<<<<<<< HEAD
function Wordmark({
  size = 'text-xl',
  compact = false,
}) {
  const logoSize =
    size === 'text-2xl'
      ? 'h-14'
      : size === 'text-lg'
        ? 'h-10'
        : size === 'text-base'
          ? 'h-8'
          : 'h-9';

  return (
    <div
      className={`inline-flex items-center bg-transparent ${
        compact
          ? 'px-4 py-2'
          : 'px-8 py-5'
      }`}
    >
      <img
        src={logo}
        alt="SWUMed Logo"
        className={`${logoSize} w-auto object-contain mix-blend-multiply`}
      />
    </div>
=======
function Wordmark({ size = 'h-10' }) {
  return (
    <img
      src={logoImage}
      alt="SWU Med"
      className={`${size} w-auto object-contain mix-blend-multiply`}
    />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
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

  const date = now.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="mb-6 flex items-center justify-between">
<<<<<<< HEAD
      <Wordmark size="text-lg" />

      <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
        <span className="flex items-center gap-1.5">
          <Clock size={16} />
          {time}
        </span>

        <span className="flex items-center gap-1.5">
          <Calendar size={16} />
=======
      <Wordmark size="h-9" />

      <div className="flex items-center gap-3 text-[11px] font-medium text-[#434655]">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {time}
        </span>

        <span className="flex items-center gap-1">
          <Calendar size={12} />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
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
<<<<<<< HEAD
    <div
      className="flex min-h-screen cursor-default select-none items-center justify-center bg-[#F8F9FA] px-4 py-12 print:hidden"
      style={{ caretColor: 'transparent' }}
    >
      <div className="w-full max-w-md">
=======
    <div className="patient-kiosk flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6 py-8 print:hidden">
      <div className="flex w-full max-w-[420px] flex-col">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
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
    <div className="mt-1 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
<<<<<<< HEAD
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
=======
        className="flex items-center gap-1.5 rounded-md border bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        style={{ borderColor: REGULAR_DARK }}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
<<<<<<< HEAD
        className="flex items-center gap-1.5 rounded-lg bg-[#9D0A0E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
=======
        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-2 bg-white px-4 py-3 text-sm font-semibold text-[#1F2937] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: MUTED_RED }}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
      >
        {continueLabel}
        <ArrowRight size={15} />
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
<<<<<<< HEAD
      <div className="flex flex-col items-center px-2 text-center">
        <div className="mb-10">
          <Wordmark size="text-2xl" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900">
          Welcome to
        </h1>

        <h1 className="mb-6 text-3xl font-bold text-[#9D0A0E]">
          SWU Med Hospital
        </h1>

        <p className="mb-10 text-base text-slate-500">
=======
      <div className="flex flex-col items-center px-2 py-10 text-center">
        <Wordmark size="h-20" />

        <h1 className="mt-8 text-2xl font-semibold text-slate-900">
          Welcome to
        </h1>

        <h1 className="text-2xl font-bold text-[#9D0A0E]">
          SWU Med Hospital
        </h1>

        <p className="mt-3 text-sm text-slate-500">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          Please tap below to get your queue number.
        </p>

        <button
          type="button"
          onClick={onStart}
<<<<<<< HEAD
          className="flex w-full max-w-[24rem] self-center items-center justify-center gap-2 rounded-none bg-[#9D0A0E] px-12 py-5 text-center text-lg font-semibold text-white shadow-sm hover:bg-[#7d0809]"
        >
          <span>GET STARTED</span>
          <ArrowRight size={24} />
=======
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-4 text-base font-semibold text-white shadow-sm hover:bg-[#7d0809]"
        >
          GET STARTED
          <ArrowRight size={18} />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        </button>
      </div>
    </Screen>
  );
}

/* =========================================================
   NUMERIC KEYPAD
========================================================= */

function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
}) {
  const keys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
  ];

  const keyClass =
<<<<<<< HEAD
    'flex h-14 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-semibold text-slate-800 transition hover:border-slate-300 active:bg-slate-50';
=======
    'flex h-12 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-base font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100';
>>>>>>> jhon-paul-admin-staff-and-patient-number-2

  return (
    <div className="grid grid-cols-3 gap-2.5">
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
        className={`${keyClass} text-xs text-slate-400`}
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
        className={`${keyClass} text-xs text-slate-400`}
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

<<<<<<< HEAD
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Select Your Kiosk
        </h1>

        <p className="mt-1 text-sm text-slate-500">
=======
      <div className="mb-5 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Select Your Kiosk
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          Please select the kiosk where you are getting your service.
        </p>
      </div>

<<<<<<< HEAD
      <div className="mb-8 space-y-3">
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
=======
      <div className="mb-5 space-y-2.5">
        {loading && (
          <div className="rounded-md border border-[#E5E7EB] bg-white p-4 text-center text-sm text-slate-400">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
            Loading kiosks...
          </div>
        )}

        {!loading && kiosks.length === 0 && (
<<<<<<< HEAD
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
=======
          <div className="rounded-md border border-[#E5E7EB] bg-white p-4 text-center">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
            <p className="text-sm font-semibold text-slate-700">
              No kiosks are currently available.
            </p>

            <p className="mt-1 text-xs text-slate-400">
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
<<<<<<< HEAD
                className={`relative flex w-full items-center gap-3 rounded-lg border p-4 text-left transition ${
=======
                className={`relative flex w-full items-center gap-3 rounded-md border p-3.5 text-left shadow-sm transition ${
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                  isSelected
                    ? 'border-transparent'
                    : 'border-[#C3C6D7] bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
                style={
                  isSelected
                    ? { backgroundColor: BRAND_RED }
                    : undefined
                }
              >
<<<<<<< HEAD
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                    <CheckCircle2 size={12} />
                  </span>
                )}

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9D0A0E]/10">
                  <Icon
                    size={18}
                    className="text-[#9D0A0E]"
=======
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center ${
                    isSelected ? 'rounded-full' : 'rounded'
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? 'white'
                      : ICON_TINT,
                  }}
                >
                  <Icon
                    size={18}
                    style={{
                      color: isSelected
                        ? '#4B5563'
                        : BRAND_RED,
                    }}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
<<<<<<< HEAD
                      className={`text-sm font-bold uppercase tracking-wide ${
=======
                      className={`text-sm font-semibold uppercase tracking-wide ${
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                        isSelected
                          ? 'text-white'
                          : 'text-slate-800'
                      }`}
                    >
                      {currentKiosk.name}
                    </p>

                    {isUnlocked && (
<<<<<<< HEAD
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[9px] font-semibold text-green-700">
=======
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                        UNLOCKED
                      </span>
                    )}
                  </div>

                  <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
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

const KIOSK_PIN_LENGTH = 6;

function KioskPinScreen({
  kiosk,
  onBack,
  onSuccess,
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] =
    useState(false);

  async function handleSubmit() {
    setError('');

    if (!kiosk?.kiosk_id) {
      setError('Invalid kiosk.');
      return;
    }

    if (pin.length !== KIOSK_PIN_LENGTH) {
      return;
    }

    setSubmitting(true);

    try {
      const result =
        await verifyKioskPin(
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
      current.length >= KIOSK_PIN_LENGTH
        ? current
        : current + digit
    );
  }

  function handleBackspace() {
    setError('');

    setPin((current) =>
      current.slice(0, -1)
    );
  }

  function handleClear() {
    setError('');
    setPin('');
  }

  return (
    <Screen>
<<<<<<< HEAD
      <div className="mb-8 flex justify-center">
        <Wordmark size="text-2xl" />
      </div>

      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#9D0A0E]/10">
          <Lock
            size={22}
            className="text-[#9D0A0E]"
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          Enter Kiosk Code
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Please enter the kiosk code to activate.
        </p>

        {kiosk?.name && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#9D0A0E]/5 px-3 py-1.5 text-xs font-bold text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div className="mb-6 flex justify-center gap-3">
        {Array.from(
          { length: 4 },
          (_, index) => {
            const filled =
              index < pin.length;

            const isActive =
              index === pin.length;

            return (
              <div
                key={index}
                className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 bg-white text-lg font-bold ${
                  isActive
                    ? 'border-[#9D0A0E]'
                    : 'border-slate-200'
                }`}
              >
                {filled && (
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
                )}
              </div>
            );
          }
        )}
      </div>

      {error && (
        <p className="mb-4 text-center text-sm font-medium text-red-500">
=======
      <div className="mb-6 flex justify-center">
        <Wordmark size="h-16" />
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Enter Kiosk Code
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please enter the kiosk code to activate.
        </p>
      </div>

      <div className="mb-5 flex justify-center gap-2">
        {Array.from({ length: KIOSK_PIN_LENGTH }, (_, index) => {
          const filled = index < pin.length;
          const isActive = index === pin.length;

          return (
            <div
              key={index}
              className="flex h-12 w-12 items-center justify-center rounded border-2 bg-white"
              style={{
                backgroundColor: isActive
                  ? 'white'
                  : '#F8FAFC',
                borderColor: isActive
                  ? MUTED_RED
                  : filled
                    ? '#CBD5E1'
                    : '#E2E8F0',
                opacity: !filled && !isActive ? 0.5 : 1,
              }}
            >
              {filled && (
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
              )}

              {isActive && (
                <span className="h-6 w-0.5 animate-pulse rounded-full bg-[#B34C4C]" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mb-3 text-center text-xs font-medium text-red-500">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          {error}
        </p>
      )}

<<<<<<< HEAD
      <div className="mb-6">
=======
      <div className="mb-5">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClear={handleClear}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSubmit}
<<<<<<< HEAD
          disabled={
            pin.length !== 4 ||
            submitting
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Activating...'
            : 'Activate Kiosk'}
          <ArrowRight size={16} />
=======
          disabled={pin.length !== KIOSK_PIN_LENGTH || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Activating...' : 'Activate Kiosk'}
          <ArrowRight size={18} />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        </button>

        <button
          type="button"
          onClick={onBack}
<<<<<<< HEAD
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
=======
          className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700"
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        >
          <ArrowLeft size={14} />
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
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-6 text-center">
<<<<<<< HEAD
        <h1 className="text-2xl font-bold text-slate-900">
          Select Your Queue Type
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Please select the queue type that applies to you.
        </p>

        {kiosk && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#9D0A0E]/5 px-3 py-1.5 text-xs font-medium text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
=======
        <h1 className="text-2xl font-semibold text-slate-900">
          Select Your Queue Type
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please select the queue type that applies to you.
        </p>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
      </div>

      <div className="mb-8 space-y-3">
        {QUEUE_TYPES.map((type) => {
          const isSelected =
            selected?.key === type.key;

          return (
            <button
              key={type.key}
              type="button"
<<<<<<< HEAD
              onClick={() =>
                onSelect(type)
              }
              className={`relative mx-auto w-full max-w-sm rounded-lg border px-5 py-4 text-center transition ${
=======
              onClick={() => onSelect(type)}
              className={`relative w-full rounded-md border p-5 text-center shadow-sm transition ${
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                isSelected
                  ? 'border-transparent'
                  : 'border-[#C3C6D7] bg-white hover:border-slate-400 hover:bg-slate-50'
              }`}
              style={
                isSelected
                  ? { backgroundColor: BRAND_RED }
                  : undefined
              }
            >
<<<<<<< HEAD
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                  <CheckCircle2 size={12} />
                </span>
              )}

=======
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              <p
                className={`text-lg font-bold uppercase tracking-wide ${
                  isSelected
                    ? 'text-white'
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
   DEPARTMENT SCREEN
========================================================= */

function SelectDepartmentScreen({
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

      <div className="mb-5 text-center">
<<<<<<< HEAD
        <h1 className="text-2xl font-bold text-slate-900">
          What do you need today?
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Please select a service to get your queue number.
        </p>

        {kiosk && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#9D0A0E]/5 px-3 py-1.5 text-xs font-medium text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
=======
        <h1 className="text-2xl font-semibold text-slate-900">
          What do you need today?
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please select a service to get your queue number.
        </p>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
      </div>

      <div
        className="mb-3 max-h-[380px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {loading && (
<<<<<<< HEAD
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
=======
          <div className="rounded-md border border-[#E5E7EB] bg-white p-5 text-center text-sm text-slate-400">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
            Loading services...
          </div>
        )}

        {!loading &&
          departments.length === 0 && (
<<<<<<< HEAD
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
=======
            <div className="rounded-md border border-[#E5E7EB] bg-white p-5 text-center">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              <p className="text-sm font-semibold text-slate-700">
                No services are currently available.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Please contact the hospital administrator.
              </p>
            </div>
          )}

<<<<<<< HEAD
        {!loading &&
          departments.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {departments.map(
                (department) => {
                  const Icon =
                    getDepartmentIcon(
                      department.name,
                      department.classification
                    );
=======
        {!loading && departments.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {departments.map((department) => {
              const Icon =
                getDepartmentIcon(
                  department.name,
                  department.classification
                );
>>>>>>> jhon-paul-admin-staff-and-patient-number-2

                  const isSelected =
                    selected?.department_id ===
                    department.department_id;

                  const active =
                    isDepartmentActive(
                      department
                    );

<<<<<<< HEAD
                  return (
                    <button
                      key={
                        department.department_id
                      }
                      type="button"
                      disabled={!active}
                      onClick={() =>
                        active &&
                        onSelect(
                          department
                        )
                      }
                      className={`relative flex flex-col items-center gap-2 rounded-none border p-4 text-center transition ${
                        !active
                          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                          : isSelected
                            ? 'border-[#9D0A0E] bg-[#9D0A0E]/5 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isSelected &&
                        active && (
                          <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                            <CheckCircle2
                              size={14}
                            />
                          </span>
                        )}

                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          !active
                            ? 'bg-slate-200'
                            : 'bg-[#9D0A0E]/10'
                        }`}
                      >
                        <Icon
                          size={17}
                          className={
                            !active
                              ? 'text-slate-400'
                              : 'text-[#9D0A0E]'
                          }
                        />
                      </div>

                      <p
                        className={`text-xs font-bold uppercase leading-tight tracking-wide ${
                          !active
                            ? 'text-slate-400'
                            : isSelected
                              ? 'text-[#9D0A0E]'
                              : 'text-slate-800'
                        }`}
                      >
                        {department.name}
                      </p>

                      <p className="text-[10px] leading-tight text-slate-400">
                        {active
                          ? getDepartmentDescription(
                              department
                            )
                          : 'Inactive'}
                      </p>
                    </button>
                  );
                }
              )}
            </div>
          )}
=======
              return (
                <button
                  key={department.department_id}
                  type="button"
                  disabled={!active}
                  onClick={() =>
                    active && onSelect(department)
                  }
                  className={`relative flex flex-col items-center gap-1.5 rounded-md border p-3 text-center shadow-sm transition ${
                    !active
                      ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F1F3F5] opacity-60'
                      : isSelected
                        ? 'border-transparent'
                        : 'border-[#C3C6D7] bg-white hover:border-slate-400 hover:bg-slate-50'
                  }`}
                  style={
                    active && isSelected
                      ? { backgroundColor: BRAND_RED }
                      : undefined
                  }
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center ${
                      active && isSelected ? 'rounded-full' : 'rounded'
                    }`}
                    style={{
                      backgroundColor: !active
                        ? '#E5E7EB'
                        : isSelected
                          ? 'white'
                          : ICON_TINT,
                    }}
                  >
                    <Icon
                      size={16}
                      style={{
                        color: !active
                          ? '#94A3B8'
                          : isSelected
                            ? '#4B5563'
                            : BRAND_RED,
                      }}
                    />
                  </div>

                  <p
                    className={`text-[11px] font-bold uppercase leading-tight tracking-wide ${
                      !active
                        ? 'text-slate-400'
                        : isSelected
                          ? 'text-white'
                          : 'text-slate-800'
                    }`}
                  >
                    {department.name}
                  </p>

                  <p
                    className={`text-[9px] leading-tight ${
                      active && isSelected ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {active
                      ? getDepartmentDescription(department)
                      : 'Inactive'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
      </div>

      <p className="mb-4 mt-2 text-center text-xs text-slate-400">
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
  const ServiceIcon =
    service?.icon || ClipboardList;

  const QueueIcon =
    queueType?.icon || User;

  return (
    <Screen>
      <KioskHeader />

<<<<<<< HEAD
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Confirm Your Service
        </h1>

        <p className="mt-1 text-sm text-slate-500">
=======
      <div className="mb-5 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Confirm Your Service
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          Please review your selected service before getting your queue number.
        </p>
      </div>

<<<<<<< HEAD
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col items-center border-b border-slate-100 pb-4 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#9D0A0E]/10">
            <MapPin
              size={22}
=======
      <div className="mb-6 rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col items-center border-b border-[#C3C6D7]/30 pb-4 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#F7EEEE]">
            <MapPin
              size={18}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              className="text-[#9D0A0E]"
            />
          </div>

<<<<<<< HEAD
          <p className="text-sm font-bold text-slate-900">
=======
          <p className="text-base font-semibold text-slate-900">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
            {kiosk?.name}
          </p>
        </div>

<<<<<<< HEAD
        <div className="mb-4 space-y-2.5">
          <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3">
            <QueueIcon
              size={16}
              className="shrink-0 text-slate-700"
            />
=======
        <div className="space-y-2">
          <div
            className="flex items-center gap-3 rounded p-3"
            style={{ backgroundColor: SELECTED_BG }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#E5E7EB]">
              <QueueIcon
                size={15}
                className="text-slate-700"
              />
            </div>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2

            <p className="text-sm font-semibold text-slate-800">
              {queueType?.name}
            </p>
          </div>

<<<<<<< HEAD
          <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3">
            <ServiceIcon
              size={16}
              className="shrink-0 text-slate-700"
            />
=======
          <div
            className="flex items-center gap-3 rounded p-3"
            style={{ backgroundColor: SELECTED_BG }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#E5E7EB]">
              <ServiceIcon
                size={15}
                className="text-slate-700"
              />
            </div>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2

            <p className="text-sm font-semibold text-slate-800">
              {service?.name}
            </p>
          </div>
        </div>

<<<<<<< HEAD
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-100 px-4 py-3 text-center">
=======
        <div
          className="mt-3 grid grid-cols-2 rounded p-4 text-center"
          style={{ backgroundColor: SELECTED_BG }}
        >
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Current Queue
            </p>

<<<<<<< HEAD
            <p className="flex items-baseline justify-center gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {waitingAhead}
              </span>

=======
            <p className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-xl font-bold text-slate-900">
                {waitingAhead}
              </span>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              <span className="text-xs font-semibold text-[#9D0A0E]">
                people ahead
              </span>
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Estimated Wait
            </p>

<<<<<<< HEAD
            <p className="flex items-baseline justify-center gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                ~{service?.estMin ?? 0}
              </span>

=======
            <p className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-xl font-bold text-slate-900">
                ~{service?.estMin ?? 0}
              </span>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              <span className="text-xs font-semibold text-[#9D0A0E]">
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
  const themeColor =
    getQueueThemeColor(queueType);

  return (
    <Screen>
      <KioskHeader />

      <div className="mb-5 text-center">
<<<<<<< HEAD
        <h1 className="text-2xl font-bold text-slate-900">
          Your Queue Number
        </h1>

        <p className="mt-1 text-sm text-slate-500">
=======
        <h1 className="text-2xl font-semibold text-slate-900">
          Your Queue Number
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          Please keep this slip until your number is called.
        </p>
      </div>

<<<<<<< HEAD
      <div className="mx-auto mb-6 w-full max-w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="px-6 py-6 text-center"
          style={{
            backgroundColor: themeColor,
          }}
        >
          <p className="mb-3 text-5xl font-bold text-white">
            {queueNumber}
          </p>

          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {queueType?.label}
          </span>

          <p className="mt-3 text-[11px] text-white/70">
            SERVICE: {service?.name}
          </p>

          <p className="text-[11px] text-white/70">
            DEPARTMENT: {service?.name}
=======
      <div
        className="mb-5 overflow-hidden rounded-lg border bg-white shadow-sm"
        style={{ borderColor: BORDER_DEFAULT }}
      >
        <div
          className="px-6 py-6 text-center"
          style={{ backgroundColor: themeColor }}
        >
          <p className="mb-2 text-5xl font-bold text-white">
            {queueNumber}
          </p>

          <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {queueType?.label}
          </span>

          <p className="mt-1.5 text-xs text-white/70">
            SERVICE: {service?.name}
          </p>

          <p className="text-xs text-white/70">
            DEPARTMENT: {kiosk?.name}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 p-4">
          <div className="space-y-2">
<<<<<<< HEAD
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <Users
                size={14}
                className="text-slate-400"
              />

              <div>
                <p className="text-[11px] text-slate-400">
                  Waiting Info
                </p>

                <p className="text-xs font-semibold text-slate-700">
=======
            <div className="flex items-center gap-2.5 rounded-md bg-[#F3F5F7] px-3 py-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${themeColor}1A` }}
              >
                <Users
                  size={15}
                  style={{ color: themeColor }}
                />
              </div>

              <div>
                <p className="text-[10px] text-slate-400">
                  Waiting Info
                </p>

                <p className="text-sm font-semibold text-slate-700">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                  {service?.waiting ?? 0}{' '}
                  people waiting
                </p>
              </div>
            </div>

<<<<<<< HEAD
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <Hourglass
                size={14}
                className="text-slate-400"
              />

              <div>
                <p className="text-[11px] text-slate-400">
                  Estimated Wait
                </p>

                <p className="text-xs font-semibold text-slate-700">
=======
            <div className="flex items-center gap-2.5 rounded-md bg-[#F3F5F7] px-3 py-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${themeColor}1A` }}
              >
                <Hourglass
                  size={15}
                  style={{ color: themeColor }}
                />
              </div>

              <div>
                <p className="text-[10px] text-slate-400">
                  Estimated Wait
                </p>

                <p className="text-sm font-semibold text-slate-700">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
                  ~{service?.estMin ?? 0}{' '}
                  minutes
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <QRCodeSVG
              value={getTrackerUrl(queueId)}
<<<<<<< HEAD
              size={90}
=======
              size={96}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              level="M"
              includeMargin={true}
            />

<<<<<<< HEAD
            <p className="mt-1 max-w-[90px] text-center text-[9px] text-slate-400">
=======
            <p className="mt-1.5 max-w-[110px] text-center text-[10px] text-slate-400">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
              Scan the QR code to track your queue status on your phone.
            </p>
          </div>
        </div>
      </div>

<<<<<<< HEAD
      <p className="mb-5 text-center text-sm font-medium text-slate-700">
=======
      <p className="mb-3 text-center text-sm font-medium text-slate-700">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        Would you like to print your ticket?
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrint}
<<<<<<< HEAD
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#9D0A0E] py-3 text-xs font-semibold text-white hover:bg-[#7d0809]"
        >
          <Printer size={14} />
=======
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-3 text-sm font-semibold text-white hover:bg-[#7d0809]"
        >
          <Printer size={16} />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          PRINT TICKET
        </button>

        <button
          type="button"
          onClick={onSkipPrint}
<<<<<<< HEAD
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-600 hover:border-slate-300"
        >
          CONTINUE WITHOUT PRINTING
          <ArrowRight size={14} />
=======
          className="flex flex-1 items-center justify-center gap-2 rounded-md border bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          style={{ borderColor: REGULAR_DARK }}
        >
          CONTINUE WITHOUT PRINTING
          <ArrowRight size={16} />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
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
  const themeColor =
    getQueueThemeColor(queueType);

  return (
    <Screen>
      <KioskHeader />

<<<<<<< HEAD
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-5 text-base font-bold text-slate-900">
          Printing Your Ticket
        </h2>

        <div
          className="mx-auto mb-5 max-w-[220px] rounded-xl px-4 py-4"
          style={{
            backgroundColor: themeColor,
          }}
        >
          <p className="text-[9px] uppercase tracking-wide text-white/60">
            Your queue number
          </p>

          <p className="text-2xl font-bold text-white">
            {queueNumber}
          </p>
        </div>

        <DoorOpen
          size={48}
          className="mx-auto mb-6 animate-pulse text-slate-300"
        />

        <p className="mb-4 text-xs text-slate-500">
          Please wait while your ticket is being printed.
          Take it with you to the waiting area.
        </p>

        <p
          className="flex items-center justify-center gap-1.5 text-xs font-medium"
          style={{
            color: themeColor,
          }}
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{
              backgroundColor: themeColor,
            }}
          />

          Printing...
        </p>
=======
      <div className="relative">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-blue-600/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-blue-200/20 blur-2xl" />

        <div
          className="relative rounded-lg border bg-white p-6 text-center shadow-sm"
          style={{ borderColor: BORDER_DEFAULT }}
        >
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Printing Your Ticket
          </h2>

          <div
            className="mx-auto mb-4 max-w-[260px] rounded-md px-5 py-5"
            style={{ backgroundColor: themeColor }}
          >
            <p className="text-[10px] uppercase tracking-wide text-white/60">
              Your queue number
            </p>

            <p className="text-2xl font-bold text-white">
              {queueNumber}
            </p>
          </div>

          <DoorOpen
            size={28}
            className="mx-auto mb-3 animate-pulse text-slate-300"
          />

          <p className="mb-4 text-sm text-slate-500">
            Please wait while your ticket is being printed.
            Take it with you to the waiting area.
          </p>

          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium text-slate-600"
            style={{
              backgroundColor: ICON_TINT,
              borderColor: BORDER_DEFAULT,
            }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#B34C4C]" />
            Printing...
          </span>
        </div>
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
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
  const themeColor =
    getQueueThemeColor(queueType);

  return (
    <Screen>
      <KioskHeader />

<<<<<<< HEAD
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: `${themeColor}1A`,
          }}
=======
      <div className="relative">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-[#9D0A0E]/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#9D0A0E]/5 blur-2xl" />

        <div
          className="relative rounded-lg border bg-white p-6 text-center shadow-sm"
          style={{ borderColor: BORDER_DEFAULT }}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#DDFFEF]/80">
          <CheckCircle2
            size={24}
<<<<<<< HEAD
            style={{
              color: themeColor,
            }}
          />
        </div>

        <h2 className="mb-5 text-base font-bold text-slate-900">
=======
            style={{ color: '#065F46' }}
          />
        </div>

        <h2 className="mb-4 text-lg font-semibold text-slate-900">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          Ticket Printed Successfully!
        </h2>

        <div
<<<<<<< HEAD
          className="mx-auto mb-5 max-w-[220px] rounded-xl border px-4 py-4"
          style={{
            backgroundColor: `${themeColor}0D`,
            borderColor: `${themeColor}33`,
          }}
        >
          <p className="text-[9px] uppercase tracking-wide text-slate-400">
=======
          className="mx-auto mb-4 max-w-[260px] rounded border bg-white px-5 py-5"
          style={{ borderColor: BORDER_DEFAULT }}
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
            Your queue number
          </p>

          <p
            className="text-2xl font-bold"
<<<<<<< HEAD
            style={{
              color: themeColor,
            }}
=======
            style={{ color: themeColor }}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          >
            {queueNumber}
          </p>
        </div>

<<<<<<< HEAD
        <p className="mb-1 text-xs text-slate-500">
          Please take your ticket and proceed to the waiting area.
        </p>

        <p className="text-[11px] text-slate-400">
=======
        <p className="mb-1.5 text-sm text-slate-500">
          Please take your ticket and proceed to the waiting area.
        </p>

        <p className="text-xs text-slate-400">
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
          Scan the QR code on your ticket to track your queue.
        </p>
        </div>
      </div>
    </Screen>
  );
}

/* =========================================================
   PRINTED TICKET RECEIPT
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

  const themeColor =
    getQueueThemeColor(queueType);

  const now = new Date();

  const dateLabel =
    now.toLocaleDateString(undefined, {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });

  const timeLabel =
    now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className="patient-kiosk hidden print:flex print:min-h-screen print:items-center print:justify-center">
      <div className="w-full max-w-[320px] p-6 text-center">
<<<<<<< HEAD
        <Wordmark
          size="text-xl"
          compact
        />
=======
        <Wordmark size="h-10" />
>>>>>>> jhon-paul-admin-staff-and-patient-number-2

        <p className="mt-4 text-base font-medium uppercase tracking-wide text-slate-800">
          {kiosk?.name}
        </p>

        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Queue Number
        </p>

        <p
<<<<<<< HEAD
          className="text-5xl font-extrabold"
          style={{
            color: themeColor,
          }}
=======
          className="text-5xl font-semibold"
          style={{ color: themeColor }}
>>>>>>> jhon-paul-admin-staff-and-patient-number-2
        >
          {queueNumber}
        </p>

        <div className="my-4 border-t border-dashed border-slate-300" />

        <div className="space-y-1.5 text-left text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              Service:
            </span>

            <span className="font-semibold text-slate-800">
              {service?.name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              People Ahead:
            </span>

            <span className="font-semibold text-slate-800">
              {service?.waiting ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              Estimated Wait:
            </span>

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
    Kiosks are retrieved through:

      PatientView
          ↓
      backendApi.js
          ↓
      Node.js
          ↓
      MySQL / Firebase backend logic
  */

  async function fetchKiosks() {
    if (kioskFetchRef.current) {
      return kioskFetchRef.current;
    }

    const fetchPromise =
      (async () => {
        setKiosksLoading(true);
        setKiosksError('');

        try {
          const data =
            await getKiosks();

          const normalizedKiosks =
            (data || [])
              .map((item) => ({
                kiosk_id:
                  item?.kiosk_id ||
                  item?.id ||
                  '',

                name:
                  item?.name || '',

                status:
                  item?.status ?? null,
              }))
              .filter(
                (item) =>
                  item.kiosk_id &&
                  item.name
              )
              .filter(
                (item) =>
                  !item.status ||
                  String(
                    item.status
                  ).toLowerCase() ===
                    'active'
              )
              .sort((a, b) =>
                a.name.localeCompare(
                  b.name
                )
              );

          setKiosks(
            normalizedKiosks
          );
        } catch (error) {
          console.error(
            'Error fetching kiosks:',
            error
          );

          setKiosks([]);

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

  async function fetchDepartments(
    kioskRecord
  ) {
    if (!kioskRecord?.kiosk_id) {
      setDepartments([]);
      return;
    }

    setDepartmentsLoading(true);
    setDepartmentsError('');

    try {
      const data =
        await getPatientDepartments(
          kioskRecord.kiosk_id
        );

      const allDepartments =
        data || [];

      const departmentsWithWaiting =
        await Promise.all(
          allDepartments.map(
            async (department) => {
              let waiting = 0;

              if (
                isDepartmentActive(
                  department
                )
              ) {
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
    if (!kiosk) {
      setDepartments([]);
      setDepartmentsError('');
      return;
    }

    fetchDepartments(kiosk);
  }, [kiosk?.kiosk_id]);

  /* =======================================================
     GET STARTED
  ======================================================= */

  function handleStart() {
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

    /*
      Do NOT change requiresKioskSelection here.

      If the patient selected a kiosk manually,
      it remains true.

      If this terminal is already configured for a
      specific kiosk, it remains false.

      This allows the Back button to return to the
      correct screen.
    */

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
      Daily kiosk unlock is NOT cleared.

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

      if (
        String(
          service.kiosk_id
        ) !==
        String(
          kiosk.kiosk_id
        )
      ) {
        throw new Error(
          'The selected department does not belong to the selected kiosk.'
        );
      }

      /* ---------------------------------------------------
         CREATE QUEUE THROUGH NODE.JS
      --------------------------------------------------- */

      const result =
        await createPatientQueue({
          kiosk_id:
            kiosk.kiosk_id,

          kiosk_name:
            kiosk.name,

          department_id:
            service.department_id,

          department_name:
            service.name,

          queue_type:
            queueType.key ===
            'priority'
              ? 'Priority'
              : 'Regular',
        });

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

      setService((current) => ({
        ...current,

        waiting:
          current?.waiting ?? 0,

        estMin:
          Number(
            result.est_time
          ) ||
          current?.estMin ||
          0,
      }));

      /* ---------------------------------------------------
         REFRESH WAITING COUNT
      --------------------------------------------------- */

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
                waiting: latestWaiting,
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
     PRINTING → REAL PRINT → SUCCESS
  ======================================================= */

  useEffect(() => {
    if (step !== 'printing') {
      return;
    }

    const printTimer =
      setTimeout(() => {
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
    if (step !== 'success') {
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
     PRINT RECEIPT
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

  if (step === 'welcome') {
    return (
      <>
        <WelcomeScreen
          onStart={handleStart}
        />

        {receipt}
      </>
    );
  }

  /* =======================================================
     KIOSK
  ======================================================= */

  if (step === 'kiosk') {
    return (
      <>
        <SelectKioskScreen
          kiosks={kiosks}
          selected={kiosk}
          loading={kiosksLoading}
          onSelect={
            handleKioskSelect
          }
          onBack={handleReset}
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

  if (step === 'queueType') {
    return (
      <>
        <QueueTypeScreen
          selected={queueType}
          kiosk={kiosk}
          onSelect={(type) => {
            setQueueType(type);
            setService(null);
          }}
          onBack={() => {
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

  if (step === 'department') {
    return (
      <>
        <SelectDepartmentScreen
          kiosk={kiosk}
          departments={departments}
          loading={
            departmentsLoading
          }
          selected={service}
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

  if (step === 'confirm') {
    return (
      <>
        <ConfirmScreen
          queueType={queueType}
          kiosk={kiosk}
          service={service}
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

  if (step === 'ticket') {
    return (
      <>
        <TicketScreen
          queueType={queueType}
          kiosk={kiosk}
          service={service}
          queueNumber={queueNumber}
          queueId={queueId}
          onPrint={handlePrint}
          onSkipPrint={
            handleReset
          }
        />

        {receipt}
      </>
    );
  }

  /* =======================================================
     PRINTING
  ======================================================= */

  if (step === 'printing') {
    return (
      <>
        <PrintingScreen
          queueType={queueType}
          queueNumber={queueNumber}
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
        queueType={queueType}
        queueNumber={queueNumber}
      />

      {receipt}
    </>
  );
}