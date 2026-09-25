import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';


import {
  getKiosks,
  getPatientDepartments,
  getWaitingCount,
  createPatientQueue,
validateKioskSecurityPin,
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
  Lock,
  Check,
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';

import logoImage from '../../../assets/logo-transparent.png';
import { THEME } from '../../theme/colors';
const TransitionContext = createContext({ leaving: false });

const EXIT_MS = 140;
const RESPECT_REDUCED_MOTION = false;

function prefersReducedMotion() {
  if (!RESPECT_REDUCED_MOTION) {
    return false;
  }

  return (
    typeof window !== 'undefined' &&
    Boolean(
      window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches
    )
  );
}

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
  (import.meta.env.VITE_TRACKER_URL ||
    `${window.location.origin}/tracker`).replace(
      /\/+$/,
      ''
    );

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
   ESTIMATED WAIT
========================================================= */

/*
  What the patient is shown is how long until they are served,
  which is a function of the queue in front of them — not the
  department's configured est_time, which is how long a single
  visit takes once it starts. Using est_time on its own showed
  the same "~5 min" to someone who was next and to someone with
  twenty people ahead of them.

  The real per-patient duration comes from the backend as an
  average over recently completed visits; est_time is only the
  fallback for a department that has not completed any yet.
*/

function getEstimatedWaitMinutes({
  waiting,
  averageServiceMinutes,
  activeCounters,
  fallbackMinutes,
}) {
  const peopleAhead = Math.max(
    0,
    Number(waiting) || 0
  );

  if (peopleAhead === 0) {
    return 0;
  }

  const minutesPerPatient =
    Number(averageServiceMinutes) ||
    Number(fallbackMinutes) ||
    0;

  if (minutesPerPatient <= 0) {
    return 0;
  }

  // Counters serve in parallel, so the queue drains faster than
  // one-at-a-time when a department has several open.
  const lanes = Math.max(
    1,
    Number(activeCounters) || 1
  );

  return Math.max(
    1,
    Math.ceil(
      (peopleAhead * minutesPerPatient) / lanes
    )
  );
}

function withEstimatedWait(service, waiting) {
  if (!service) {
    return service;
  }

  const nextWaiting = Math.max(
    0,
    Number(waiting) || 0
  );

  return {
    ...service,

    waiting: nextWaiting,

    estMin: getEstimatedWaitMinutes({
      waiting: nextWaiting,
      averageServiceMinutes:
        service.averageServiceMinutes,
      activeCounters:
        service.activeCounters,
      fallbackMinutes:
        service.serviceMinutes,
    }),
  };
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

function Wordmark({ size = 'h-10' }) {
  return (
    <img
      src={logoImage}
      alt="SWU Med"
      className={`${size} w-auto object-contain mix-blend-multiply`}
    />
  );
}

const KIOSK_STEPS = [
  { key: 'queueType', label: 'Queue Type' },
  { key: 'department', label: 'Service' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'ticket', label: 'Ticket' },
];

const PROGRESS_START = -0.35;

let lastStepProgress = PROGRESS_START;

function resetStepProgress() {
  lastStepProgress = PROGRESS_START;
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getStepStates(progress, done) {
  const active = Math.floor(progress + 0.0001);

  return KIOSK_STEPS.map((_, index) => {
    if (done ? index <= active : index < active) {
      return 'complete';
    }

    if (index === active) {
      return 'current';
    }

    return 'upcoming';
  });
}

function StepProgress({ currentStep }) {
  const target = KIOSK_STEPS.findIndex(
    (item) => item.key === currentStep
  );

  // Once the ticket is issued there is nothing left to do, so every
  // step reads as complete instead of leaving the last one looking
  // "in progress" on a screen the patient is already done with.
  const done = currentStep === 'ticket';

  const [progress, setProgress] = useState(
    lastStepProgress
  );

  // Captured once on mount so only the circles that actually change
  // pop — otherwise every circle re-pops each time a screen arrives.
  const [initialStates] = useState(() =>
    getStepStates(lastStepProgress, done)
  );

  useEffect(() => {
    const from = lastStepProgress;
    const to = target;
    const distance = Math.abs(to - from);

    // Already there, so there is nothing to travel.
    if (distance < 0.001) {
      lastStepProgress = to;
      return undefined;
    }

    const duration = prefersReducedMotion()
      ? 0
      : 260 +
        380 * Math.min(distance, 1) +
        160 * Math.max(0, distance - 1);

    const start = performance.now();
    let frame;

    const tick = (now) => {
      const t =
        duration <= 0
          ? 1
          : Math.min(
              1,
              (now - start) / duration
            );

      const value =
        from +
        (to - from) * easeInOutCubic(t);

      lastStepProgress = value;
      setProgress(value);

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target]);

  const states = getStepStates(progress, done);

  return (
    <div className="mt-5 flex items-start">
      {KIOSK_STEPS.map((stepItem, index) => {
        const isLast =
          index === KIOSK_STEPS.length - 1;

        const state = states[index];

        const shouldPop =
          state !== 'upcoming' &&
          state !== initialStates[index];

        const fill = Math.min(
          1,
          Math.max(0, progress - index)
        );

        const moving = fill > 0.02 && fill < 0.98;

        const circleClass =
          state === 'complete'
            ? 'border-2 border-[#9D0A0E] bg-[#9D0A0E] text-white'
            : state === 'current'
              ? 'border-2 border-[#9D0A0E] bg-[#F8F9FA] text-[#9D0A0E]'
              : 'border border-[#D0D5DD] bg-[#F8F9FA] text-[#98A2B3]';

        const labelClass =
          state === 'current'
            ? 'text-[#9D0A0E]'
            : state === 'complete'
              ? 'text-[#1F2937]'
              : 'text-[#98A2B3]';

        return (
          <div
            key={stepItem.key}
            className={`flex items-center ${isLast ? '' : 'flex-1'}`}
          >
            <div className="flex flex-col items-center">
              <div className="relative flex h-6 w-6 items-center justify-center">
                {state === 'current' && (
                  <span
                    className="kiosk-step-halo"
                    aria-hidden="true"
                  />
                )}

                <div
                  key={state}
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-300 ${circleClass} ${
                    shouldPop ? 'kiosk-step-pop' : ''
                  }`}
                  aria-current={
                    state === 'current'
                      ? 'step'
                      : undefined
                  }
                >
                  {state === 'complete' ? (
                    <Check
                      size={12}
                      strokeWidth={3}
                      className={
                        shouldPop
                          ? 'kiosk-check-in'
                          : ''
                      }
                    />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>

              <span
                className={`mt-1 whitespace-nowrap text-[8px] font-semibold uppercase tracking-wide transition-colors duration-300 ${labelClass}`}
              >
                {stepItem.label}
              </span>
            </div>

            {!isLast && (
              <div className="relative mx-1.5 mb-4 h-0.5 flex-1 rounded-full bg-[#E5E7EB]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#9D0A0E]"
                  style={{ width: `${fill * 100}%` }}
                >
                  <span
                    className="kiosk-line-tip"
                    style={{
                      opacity: moving ? 1 : 0,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   KIOSK HEADER
========================================================= */

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(
    () => new Date()
  );

  useEffect(() => {
    const id = setInterval(
      () => setNow(new Date()),
      intervalMs
    );

    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

function KioskHeader({ step = null }) {
  const now = useNow();

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
    <div className="mb-6">
      <div className="flex items-center justify-between">
        {/* Logo size: change "h-7" below (e.g. h-6 smaller, h-8/h-9 bigger) to resize */}
        <Wordmark size="h-3.5" />

        <div className="flex items-center gap-3 text-[11px] font-medium text-[#434655]">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {time}
          </span>

          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {date}
          </span>
        </div>
      </div>

      {step && <StepProgress currentStep={step} />}
    </div>
  );
}

function Screen({
  children,
  stepKey = 'screen',
  header = null,
}) {
  const { leaving } = useContext(
    TransitionContext
  );

  return (
    <div className="patient-kiosk flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6 py-8 print:hidden">
      <div className="flex w-full max-w-[420px] flex-col">
        {header}

        <div
          key={stepKey}
          className={`flex flex-col kiosk-step-enter ${
            leaving ? 'kiosk-step-exit' : ''
          }`}
        >
          {children}
        </div>
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
        className="kiosk-nav-button group flex items-center gap-1.5 rounded-md border bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        style={{ borderColor: REGULAR_DARK }}
      >
        <ArrowLeft
          size={15}
          className="transition-transform duration-200 group-hover:-translate-x-0.5"
        />
        Back
      </button>

      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className="kiosk-nav-button group flex flex-1 items-center justify-center gap-1.5 rounded-md border-2 bg-white px-4 py-3 text-sm font-semibold text-[#1F2937] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: MUTED_RED }}
      >
        {continueLabel}
        <ArrowRight
          size={15}
          className="transition-transform duration-200 group-enabled:group-hover:translate-x-0.5"
        />
      </button>
    </div>
  );
}

/* =========================================================
   WELCOME SCREEN
========================================================= */

function WelcomeScreen({ onStart }) {
  return (
    <Screen stepKey="welcome">
      <div className="flex flex-col items-center px-2 py-10 text-center">
        <div className="kiosk-stagger-1">
          <Wordmark size="h-20" />
        </div>

        <div className="kiosk-stagger-2">
          <h1 className="mt-8 text-2xl font-semibold text-slate-900">
            Welcome to
          </h1>

          <h1 className="text-2xl font-bold text-[#9D0A0E]">
            SWU Med Hospital
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Please tap below to get your queue number.
          </p>
        </div>

        <div className="kiosk-stagger-3 w-full">
          <button
            type="button"
            onClick={onStart}
            className="kiosk-button group mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-4 text-base font-semibold text-white shadow-sm hover:bg-[#7d0809]"
          >
            GET STARTED
            <ArrowRight
              size={18}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </button>
        </div>
      </div>
    </Screen>
  );
}
function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
}) {
  const keys = [ '1', '2', '3', '4', '5', '6', '7', '8', '9', ];
const keyClass =
    'kiosk-button flex h-12 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-base font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100';

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


function SelectKioskScreen({
  kiosks,
  selected,
  onSelect,
  onBack,
  onContinue,
  loading,
}) {
  return (
    <Screen stepKey="kiosk" header={<KioskHeader />}>
      <div className="mb-5 text-center kiosk-stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Select Your Kiosk
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please select the kiosk where you are getting your service.
        </p>
      </div>

      <div className="mb-5 space-y-2.5">
        {loading && (
          <div className="rounded-md border border-[#E5E7EB] bg-white p-4 text-center text-sm text-slate-400">
            Loading kiosks...
          </div>
        )}

        {!loading && kiosks.length === 0 && (
          <div className="rounded-md border border-[#E5E7EB] bg-white p-4 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No kiosks are currently available.
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Please contact the hospital administrator.
            </p>
          </div>
        )}

        {!loading &&
          kiosks.map((currentKiosk, index) => {
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
              <div
                key={currentKiosk.kiosk_id}
                className="kiosk-item-enter"
                style={{
                  animationDelay: `${80 + index * 45}ms`,
                }}
              >
              <button
                type="button"
                onClick={() =>
                  onSelect(currentKiosk)
                }
                className={`kiosk-card relative flex w-full items-center gap-3 rounded-md border p-3.5 text-left shadow-sm ${
                  isSelected
                    ? 'border-transparent kiosk-selected'
                    : 'border-[#C3C6D7] bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
                style={
                  isSelected
                    ? { backgroundColor: BRAND_RED }
                    : undefined
                }
              >
                <div
                  className={`kiosk-icon-motion flex h-10 w-10 shrink-0 items-center justify-center ${
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
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold uppercase tracking-wide ${ isSelected ? 'text-white' : 'text-slate-800' }`}>
                      {currentKiosk.name}
                    </p>

                    {isUnlocked && ( <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700"> UNLOCKED </span> )}
                  </div>

                  <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                    Select this kiosk to continue.
                  </p>
                </div>
              </button>
              </div>
            );
          })}
      </div>

      <div className="kiosk-stagger-4">
        <NavButtons
          onBack={onBack}
          onContinue={onContinue}
          disabled={!selected || loading}
        />
      </div>
    </Screen>
  );
}

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
    setError(
      'Please enter the 6-digit Security PIN.'
    );
    return;
  }

  setSubmitting(true);

  try {
    await validateKioskSecurityPin(
      kiosk.kiosk_id,
      pin
    );

    unlockKioskForToday(
      kiosk.kiosk_id
    );

    onSuccess();

  } catch (error) {
    console.error(
      'Kiosk Security PIN verification error:',
      error
    );

    setError(
      error?.message ||
        'Invalid Security PIN. Please try again.'
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
    <Screen stepKey="kioskPin">
      <div className="mb-6 flex justify-center kiosk-stagger-1">
        <Wordmark size="h-16" />
      </div>

      <div className="mb-6 text-center kiosk-stagger-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Enter Security PIN
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Enter your 6-digit Security PIN to activate this kiosk.
        </p>

        {kiosk?.name && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#9D0A0E]/5 px-4 py-2 text-sm font-bold text-[#9D0A0E]">
            <MapPin size={16} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {Array.from(
          { length: KIOSK_PIN_LENGTH },
          (_, index) => {
            const filled =
              index < pin.length;

            const isActive =
              index === pin.length;

            return (
              <div
                key={index}
                className={`flex h-12 w-12 items-center justify-center rounded-md border-2 bg-white ${
                  isActive
                    ? 'border-[#9D0A0E]'
                    : 'border-slate-200'
                }`}
              >
                {filled && (
                  <span className="h-3 w-3 rounded-full bg-slate-800" />
                )}
              </div>
            );
          }
        )}
      </div>

      {error && (
        <p className="mb-5 text-center text-sm font-medium text-red-500">
          {error}
        </p>
      )}

      <div className="mb-6 kiosk-stagger-3">
        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClear={handleClear}
        />
      </div>

      <div className="flex flex-col gap-3 kiosk-stagger-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            pin.length !== KIOSK_PIN_LENGTH ||
            submitting
          }
          className="kiosk-button group flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-4 text-base font-semibold text-white hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Activating...'
            : 'Activate Kiosk'}

          <ArrowRight
            size={18}
            className="transition-transform duration-200 group-enabled:group-hover:translate-x-0.5"
          />
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="kiosk-button flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
    </Screen>
  );
}

  function QueueTypeScreen({
  selected,
  onSelect,
  onBack,
  onContinue,
}) {
  return (
    <Screen
      stepKey="queueType"
      header={<KioskHeader step="queueType" />}
    >
      <div className="mb-6 text-center kiosk-stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Select Your Queue Type
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please select the queue type that applies to you.
        </p>
      </div>

      <div className="mb-8 space-y-3">
        {QUEUE_TYPES.map((type, index) => {
          const isSelected =
            selected?.key === type.key;

          return (
            <div
              key={type.key}
              className="kiosk-item-enter"
              style={{
                animationDelay: `${80 + index * 60}ms`,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(type)}
                className={`kiosk-card relative w-full rounded-md border p-5 text-center shadow-sm ${
                  isSelected
                    ? 'border-transparent kiosk-selected'
                    : 'border-[#C3C6D7] bg-white hover:border-slate-400 hover:bg-slate-50'
                }`}
                style={
                  isSelected
                    ? { backgroundColor: BRAND_RED }
                    : undefined
                }
              >
                <p
                  className={`text-lg font-bold uppercase tracking-wide transition-colors duration-200 ${
                    isSelected
                      ? 'text-white'
                      : 'text-slate-800'
                  }`}
                >
                  {type.label}
                </p>
              </button>
            </div>
          );
        })}
      </div>

      <div className="kiosk-stagger-4">
        <NavButtons
          onBack={onBack}
          onContinue={onContinue}
          disabled={!selected}
        />
      </div>
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
    <Screen
      stepKey="department"
      header={<KioskHeader step="department" />}
    >
      <div className="mb-5 text-center kiosk-stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          What do you need today?
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please select a service to get your queue number.
        </p>
      </div>

      <div
        className="mb-3 max-h-[380px] overflow-y-auto p-1 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollBehavior: 'smooth',
        }}
      >
        {loading && (
          <div className="rounded-md border border-[#E5E7EB] bg-white p-5 text-center text-sm text-slate-400">
            Loading services...
          </div>
        )}

        {!loading &&
          departments.length === 0 && (
            <div className="rounded-md border border-[#E5E7EB] bg-white p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No services are currently available.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Please contact the hospital administrator.
              </p>
            </div>
          )}

        {!loading && departments.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {departments.map((department, index) => {
              const Icon =
                getDepartmentIcon(
                  department.name,
                  department.classification
                );

                  const isSelected =
                    selected?.department_id ===
                    department.department_id;

                  const active =
                    isDepartmentActive(
                      department
                    );

              return (
                <div
                  key={department.department_id}
                  className="kiosk-item-enter flex"
                  style={{
                    animationDelay: `${70 + index * 30}ms`,
                  }}
                >
                <button
                  type="button"
                  disabled={!active}
                  onClick={() =>
                    active && onSelect(department)
                  }
                  className={`kiosk-card relative flex w-full flex-col items-center gap-1.5 rounded-md border p-3 text-center shadow-sm ${
                    !active
                      ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F1F3F5] opacity-60'
                      : isSelected
                        ? 'border-transparent kiosk-selected'
                        : 'border-[#C3C6D7] bg-white hover:border-slate-400 hover:bg-slate-50'
                  }`}
                  style={
                    active && isSelected
                      ? { backgroundColor: BRAND_RED }
                      : undefined
                  }
                >
                  <div
                    className={`kiosk-icon-motion flex h-9 w-9 shrink-0 items-center justify-center ${
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mb-4 mt-2 text-center text-xs text-slate-400">
        <span className="kiosk-hint-bob">&darr;</span> Swipe up for more
      </p>

      <div className="kiosk-stagger-4">
        <NavButtons
          onBack={onBack}
          onContinue={onContinue}
          disabled={
            loading ||
            departments.length === 0 ||
            !selected
          }
        />
      </div>
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
    <Screen
      stepKey="confirm"
      header={<KioskHeader step="confirm" />}
    >
      <div className="mb-5 text-center kiosk-stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Confirm Your Service
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please review your selected service before getting your queue number.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm kiosk-stagger-2">
        <div className="mb-3 flex flex-col items-center border-b border-[#C3C6D7]/30 pb-4 text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#F7EEEE]">
            <MapPin
              size={18}
              className="text-[#9D0A0E]"
            />
          </div>

          <p className="text-base font-semibold text-slate-900">
            {kiosk?.name}
          </p>
        </div>

        <div className="space-y-2">
          <div
            className="kiosk-item-enter flex items-center gap-3 rounded p-3"
            style={{
              backgroundColor: SELECTED_BG,
              animationDelay: '140ms',
            }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#E5E7EB]">
              <QueueIcon
                size={15}
                className="text-slate-700"
              />
            </div>

            <p className="text-sm font-semibold text-slate-800">
              {queueType?.name}
            </p>
          </div>

          <div
            className="kiosk-item-enter flex items-center gap-3 rounded p-3"
            style={{
              backgroundColor: SELECTED_BG,
              animationDelay: '190ms',
            }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#E5E7EB]">
              <ServiceIcon
                size={15}
                className="text-slate-700"
              />
            </div>

            <p className="text-sm font-semibold text-slate-800">
              {service?.name}
            </p>
          </div>
        </div>

        <div
          className="kiosk-item-enter mt-3 grid grid-cols-2 rounded p-4 text-center"
          style={{
            backgroundColor: SELECTED_BG,
            animationDelay: '240ms',
          }}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Current Queue
            </p>

            <p className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-xl font-bold text-slate-900">
                {waitingAhead}
              </span>
              <span className="text-xs font-semibold text-[#9D0A0E]">
                people ahead
              </span>
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Estimated Wait
            </p>

            <p className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-xl font-bold text-slate-900">
                ~{service?.estMin ?? 0}
              </span>
              <span className="text-xs font-semibold text-[#9D0A0E]">
                min
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="kiosk-stagger-4">
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
      </div>
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
    <Screen
      stepKey="ticket"
      header={<KioskHeader step="ticket" />}
    >
      <div className="mb-5 text-center kiosk-stagger-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Your Queue Number
        </h1>

        <p className="mt-1.5 text-sm text-slate-500">
          Please keep this slip until your number is called.
        </p>
      </div>

      <div
        className="kiosk-ticket-reveal mb-5 overflow-hidden rounded-lg border bg-white shadow-sm"
        style={{ borderColor: BORDER_DEFAULT }}
      >
        <div
          className="px-6 py-6 text-center"
          style={{ backgroundColor: themeColor }}
        >
          <p className="mb-2 text-5xl font-bold text-white">
            <span className="kiosk-number-pop">
              {queueNumber}
            </span>
          </p>

          <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {queueType?.label}
          </span>

          <p className="mt-1.5 text-xs text-white/70">
            SERVICE: {service?.name}
          </p>

          <p className="text-xs text-white/70">
            DEPARTMENT: {kiosk?.name}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 p-4">
          <div className="space-y-2">
            <div
              className="kiosk-item-enter flex items-center gap-2.5 rounded-md bg-[#F3F5F7] px-3 py-2.5"
              style={{ animationDelay: '260ms' }}
            >
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
                  {service?.waiting ?? 0}{' '}
                  people waiting
                </p>
              </div>
            </div>

            <div
              className="kiosk-item-enter flex items-center gap-2.5 rounded-md bg-[#F3F5F7] px-3 py-2.5"
              style={{ animationDelay: '310ms' }}
            >
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
                  ~{service?.estMin ?? 0}{' '}
                  minutes
                </p>
              </div>
            </div>
          </div>

          <div
            className="kiosk-item-enter flex flex-col items-center justify-center"
            style={{ animationDelay: '360ms' }}
          >
            <QRCodeSVG
              value={getTrackerUrl(queueId)}
              size={96}
              level="M"
              includeMargin={true}
            />

            <p className="mt-1.5 max-w-[110px] text-center text-[10px] text-slate-400">
              Scan the QR code to track your queue status on your phone.
            </p>
          </div>
        </div>
      </div>

      <p className="mb-3 text-center text-sm font-medium text-slate-700 kiosk-stagger-3">
        Would you like to print your ticket?
      </p>

      <div className="flex gap-3 kiosk-stagger-4">
        <button
          type="button"
          onClick={onPrint}
          className="kiosk-button flex flex-1 items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-3 text-sm font-semibold text-white hover:bg-[#7d0809]"
        >
          <Printer size={16} />
          PRINT TICKET
        </button>

        <button
          type="button"
          onClick={onSkipPrint}
          className="kiosk-button group flex flex-1 items-center justify-center gap-2 rounded-md border bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          style={{ borderColor: REGULAR_DARK }}
        >
          CONTINUE WITHOUT PRINTING
          <ArrowRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
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
    <Screen
      stepKey="printing"
      header={<KioskHeader step="ticket" />}
    >
      <div className="relative">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-blue-600/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-blue-200/20 blur-2xl" />

        <div
          className="kiosk-ticket-reveal relative rounded-lg border bg-white p-6 text-center shadow-sm"
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

          <div className="mx-auto mb-4 h-1 max-w-[220px] overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="kiosk-print-bar h-full w-full rounded-full bg-[#9D0A0E]" />
          </div>

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
    <Screen
      stepKey="success"
      header={<KioskHeader step="ticket" />}
    >
      <div className="relative">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-[#9D0A0E]/5 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#9D0A0E]/5 blur-2xl" />

        <div
          className="kiosk-ticket-reveal relative rounded-lg border bg-white p-6 text-center shadow-sm"
          style={{ borderColor: BORDER_DEFAULT }}
        >
        <div className="kiosk-soft-pulse mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#DDFFEF]/80">
          <CheckCircle2
            size={24}
            style={{ color: '#065F46' }}
          />
        </div>

        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Ticket Printed Successfully!
        </h2>

        <div
          className="mx-auto mb-4 max-w-[260px] rounded border bg-white px-5 py-5"
          style={{ borderColor: BORDER_DEFAULT }}
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Your queue number
          </p>

          <p
            className="text-2xl font-bold"
            style={{ color: themeColor }}
          >
            <span className="kiosk-number-pop">
              {queueNumber}
            </span>
          </p>
        </div>

        <p className="mb-1.5 text-sm text-slate-500">
          Please take your ticket and proceed to the waiting area.
        </p>

        <p className="text-xs text-slate-400">
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
        <Wordmark size="h-10" />

        <p className="mt-4 text-base font-medium uppercase tracking-wide text-slate-800">
          {kiosk?.name}
        </p>

        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Queue Number
        </p>

        <p
          className="text-5xl font-semibold"
          style={{ color: themeColor }}
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
/* =========================================================
   MAIN PATIENT VIEW
========================================================= */

export default function PatientView({
  kioskId = null,
}) {
  /* =======================================================
     PATIENT FLOW STATE
  ======================================================= */

  const [step, setStepState] =
    useState('welcome');

  const [leaving, setLeaving] =
    useState(false);

  const transitionLock = useRef(false);

  /*
    Plays the exit animation, swaps the screen, then plays the
    entrance. `beforeSwap` runs in the gap so state changes land
    while the old screen is already faded out.

    The lock stops a double tap on a kiosk touchscreen from firing
    two transitions and leaving `leaving` stuck on.
  */
  function goTo(nextStep, beforeSwap) {
    // A transition is already mid-flight; dropping this one keeps the
    // screen and the state it carries in step with each other.
    if (transitionLock.current) {
      return;
    }

    // Already here, so there is nothing to animate — but the caller's
    // state changes still have to land (resetting from the welcome
    // screen, for instance).
    if (nextStep === step) {
      beforeSwap?.();
      return;
    }

    transitionLock.current = true;
    setLeaving(true);

    window.setTimeout(
      () => {
        beforeSwap?.();
        setStepState(nextStep);
        setLeaving(false);
        transitionLock.current = false;
      },
      prefersReducedMotion() ? 0 : EXIT_MS
    );
  }

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

  const [
    kiosksLoading,
    setKiosksLoading,
  ] = useState(true);

  const [
    kiosksError,
    setKiosksError,
  ] = useState('');

  const kioskFetchRef =
    useRef(null);

  /* =======================================================
     DEPARTMENTS
  ======================================================= */

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    departmentsLoading,
    setDepartmentsLoading,
  ] = useState(false);

  const [
    departmentsError,
    setDepartmentsError,
  ] = useState('');

  /* =======================================================
     FETCH KIOSKS
  ======================================================= */

  async function fetchKiosks() {
    if (kioskFetchRef.current) {
      return kioskFetchRef.current;
    }

    const fetchPromise =
      (async () => {
        setKiosksLoading(true);
        setKiosksError('');

        try {
          let data = [];

          try {
            /* ---------------------------------------------
               ONLINE
            --------------------------------------------- */

            data = await getKiosks();

            await saveOfflineData(
              'kiosks',
              data || []
            );
          } catch (onlineError) {
            /* ---------------------------------------------
               OFFLINE FALLBACK
            --------------------------------------------- */

            console.warn(
              'Unable to fetch kiosks from backend. Trying offline cache:',
              onlineError
            );

            data =
              await getOfflineData(
                'kiosks'
              );

            if (
              !data ||
              !Array.isArray(data)
            ) {
              throw new Error(
                'No cached kiosk data is available for offline use.'
              );
            }
          }

          /* ---------------------------------------------
             NORMALIZE
          --------------------------------------------- */

          const normalizedKiosks =
            (data || [])
              .map((item) => ({
                kiosk_id:
                  item?.kiosk_id ||
                  item?.id ||
                  '',

                name:
                  item?.name ||
                  '',

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

          if (
            normalizedKiosks.length === 0
          ) {
            setKiosksError(
              'No kiosks are currently available.'
            );
          }
        } catch (error) {
          console.error(
            'Error fetching kiosks:',
            error
          );

          /*
            Do not destroy already-loaded
            kiosk data if a refresh fails.
          */
          setKiosks(
            (currentKiosks) => {
              if (
                currentKiosks.length > 0
              ) {
                return currentKiosks;
              }

              return [];
            }
          );

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
     AUTOMATIC OFFLINE QUEUE SYNCHRONIZATION
  ======================================================= */

  useEffect(() => {
    console.log(
      'QUEUE SYNC: initializing...'
    );

    syncPendingOperations();

    const handleOnline = () => {
      console.log(
        'QUEUE SYNC: connection restored. Starting synchronization...'
      );

      syncPendingOperations();
    };

    window.addEventListener(
      'online',
      handleOnline
    );

    const syncInterval =
      setInterval(() => {
        syncPendingOperations();
      }, 10000);

    return () => {
      window.removeEventListener(
        'online',
        handleOnline
      );

      clearInterval(
        syncInterval
      );
    };
  }, []);

  /* =======================================================
     UPDATE OFFLINE TICKET AFTER SYNC
  ======================================================= */

  useEffect(() => {
    const handleQueueSyncSuccess =
      (event) => {
        const {
          local_id,
          queue_id,
          queue_number,
          queue_data,
        } =
          event.detail || {};

        if (
          !local_id ||
          local_id !== queueId
        ) {
          return;
        }

        console.log(
          'QUEUE SYNC: updating current ticket with backend queue:',
          queue_number
        );

        setQueueId(
          String(queue_id)
        );

        setQueueNumber(
          queue_number
        );

        setService(
          (current) =>
            current
              ? {
                  ...current,

                  serviceMinutes:
                    Number(
                      queue_data?.est_time
                    ) ||
                    current.serviceMinutes ||
                    0,
                }
              : current
        );
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
     FETCH DEPARTMENTS
  ======================================================= */

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
        /* ---------------------------------------------
           ONLINE
        --------------------------------------------- */

        data =
          await getPatientDepartments(
            kioskRecord.kiosk_id
          );

        await saveOfflineData(
          `departments_${kioskRecord.kiosk_id}`,
          data || []
        );
      } catch (onlineError) {
        /* ---------------------------------------------
           OFFLINE FALLBACK
        --------------------------------------------- */

        console.warn(
          'Unable to fetch departments from backend. Trying offline cache:',
          onlineError
        );

        data =
          await getOfflineData(
            `departments_${kioskRecord.kiosk_id}`
          );

        if (
          !data ||
          !Array.isArray(data)
        ) {
          throw new Error(
            'No cached department data is available for offline use.'
          );
        }
      }

      const allDepartments =
        data || [];

      /* ---------------------------------------------
         WAITING COUNTS
      --------------------------------------------- */

      const departmentsWithWaiting =
        await Promise.all(
          allDepartments.map(
            async (department) => {
              let waiting = 0;
              let averageServiceMinutes = 0;
              let activeCounters = 0;

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

                  averageServiceMinutes =
                    Number(
                      waitingData?.average_service_minutes
                    ) || 0;

                  activeCounters =
                    Number(
                      waitingData?.active_counters
                    ) || 0;
                } catch (error) {
                  console.warn(
                    `Unable to get waiting count for ${department.name}:`,
                    error
                  );
                }
              }

              const serviceMinutes =
                Number(
                  department.est_time
                ) || 0;

              return {
                ...department,

                queuePrefix:
                  department.prefix ||
                  '',

                serviceMinutes,

                averageServiceMinutes,

                activeCounters,

                waiting,

                estMin:
                  getEstimatedWaitMinutes({
                    waiting,
                    averageServiceMinutes,
                    activeCounters,
                    fallbackMinutes:
                      serviceMinutes,
                  }),

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

      setDepartmentsError('');
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
      setDepartmentsLoading(
        false
      );
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

    /* ---------------------------------------------
       ALREADY UNLOCKED
    --------------------------------------------- */

    if (activeKiosk) {
      setKiosk(activeKiosk);
      setQueueType(null);
      setService(null);

      setRequiresKioskSelection(
        false
      );

      resetStepProgress();
      goTo('queueType');

      return;
    }

    /* ---------------------------------------------
       CONFIGURED KIOSK BUT NOT UNLOCKED
    --------------------------------------------- */

    if (configuredKiosk) {
      setKiosk(
        configuredKiosk
      );

      setQueueType(null);
      setService(null);

      setRequiresKioskSelection(
        false
      );

      resetStepProgress();
      goTo('kioskPin');

      return;
    }

    /* ---------------------------------------------
       PATIENT MUST SELECT KIOSK
    --------------------------------------------- */

    setKiosk(null);
    setQueueType(null);
    setService(null);

    setRequiresKioskSelection(
      true
    );

    resetStepProgress();
    goTo('kiosk');
  }

  /* =======================================================
     KIOSK SELECTION
  ======================================================= */

  function handleKioskSelect(
    selectedKiosk
  ) {
    setKiosk(
      selectedKiosk
    );

    setQueueType(null);
    setService(null);
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

    setQueueType(null);
    setService(null);

    resetStepProgress();
    goTo('queueType');
  }

  /* =======================================================
     RESET PATIENT FLOW
  ======================================================= */

  function handleReset() {
    goTo('welcome', () => {
      /*
        IMPORTANT:
        Do not remove the daily kiosk unlock.
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

      resetStepProgress();
    });
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

      /* ---------------------------------------------
         VALIDATE
      --------------------------------------------- */

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

      /* ---------------------------------------------
         REQUEST DATA
      --------------------------------------------- */

      const requestData = {
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
      };

      /* ---------------------------------------------
         CREATE QUEUE ONLINE
      --------------------------------------------- */

      let result;

      try {
        result =
          await createPatientQueue(
            requestData
          );
      } catch (onlineError) {
        console.warn(
          'Unable to create queue through backend. Saving as pending offline operation:',
          onlineError
        );

        /* -------------------------------------------
           OFFLINE QUEUE
        ------------------------------------------- */

        const localQueueId =
          `offline-${crypto.randomUUID()}`;

        const pendingOperation = {
          type:
            'CREATE_PATIENT_QUEUE',

          local_id:
            localQueueId,

          payload:
            requestData,

          created_at:
            new Date().toISOString(),

          status:
            'pending',
        };

        await addPendingOperation(
          pendingOperation
        );

        const offlineQueueNumber =
          `OFFLINE-${Date.now()}`;

        setQueueId(
          localQueueId
        );

        setQueueNumber(
          offlineQueueNumber
        );

        goTo('ticket');

        return;
      }

      /* ---------------------------------------------
         VALIDATE SERVER RESPONSE
      --------------------------------------------- */

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

      /* ---------------------------------------------
         SAVE QUEUE
      --------------------------------------------- */

      setQueueId(
        String(
          result.queue_id
        )
      );

      setQueueNumber(
        result.queue_number
      );

      /* ---------------------------------------------
         UPDATE SERVICE
      --------------------------------------------- */

      /*
        est_time is the department's configured per-visit
        duration, so it belongs in the fallback field rather
        than in estMin, which is the wait recomputed below.
      */
      setService(
        (current) =>
          current
            ? {
                ...current,

                serviceMinutes:
                  Number(
                    result.est_time
                  ) ||
                  current.serviceMinutes ||
                  0,
              }
            : current
      );

      /* ---------------------------------------------
         REFRESH WAITING COUNT
      --------------------------------------------- */

      try {
        const waitingData =
          await getWaitingCount(
            service.department_id
          );

        const latestWaiting =
          Math.max(
            0,
            (
              Number(
                waitingData?.waiting_count
              ) || 0
            ) - 1
          );

        setService(
          (current) =>
            withEstimatedWait(
              current,
              latestWaiting
            )
        );
      } catch (error) {
        console.warn(
          'Unable to refresh waiting count after ticket creation:',
          error
        );
      }

      goTo('ticket');
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
    goTo('printing');
  }

  /* =======================================================
     PRINTING → PRINT → SUCCESS
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
        goTo('success');
      }, 2200);

    return () => {
      clearTimeout(
        printTimer
      );

      clearTimeout(
        advanceTimer
      );
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
     SCREEN ROUTING
  ======================================================= */

  function renderStep() {
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

              resetStepProgress();
              goTo('queueType');
            } else {
              resetStepProgress();
              goTo('kioskPin');
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
              ? goTo('kiosk')
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
              goTo('kiosk');
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

            fetchDepartments(
              kiosk
            );

            goTo('department');
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
          departments={
            departments
          }
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
            goTo('queueType')
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

              setService(
                (current) =>
                  withEstimatedWait(
                    current,
                    waitingData?.waiting_count
                  )
              );
            } catch (error) {
              console.warn(
                'Unable to refresh waiting count:',
                error
              );
            }

            goTo('confirm');
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
          queueType={
            queueType
          }
          kiosk={kiosk}
          service={service}
          waitingAhead={
            service?.waiting ??
            0
          }
          isGenerating={
            isGenerating
          }
          onBack={() =>
            goTo('department')
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
          queueType={
            queueType
          }
          kiosk={kiosk}
          service={service}
          queueNumber={
            queueNumber
          }
          queueId={
            queueId
          }
          onPrint={
            handlePrint
          }
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
          queueType={
            queueType
          }
          queueNumber={
            queueNumber
          }
        />{receipt}</>);}

  return (
    <>
      <SuccessScreen queueType={ queueType }queueNumber={ queueNumber }   />

      {receipt}
    </>
  );
  }

  return (
    <TransitionContext.Provider
      value={{ leaving }}
    >
      {renderStep()}
    </TransitionContext.Provider>
  );
}