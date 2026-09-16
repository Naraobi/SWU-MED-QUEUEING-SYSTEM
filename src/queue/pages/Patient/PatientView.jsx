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
  Hourglass,
  Printer,
  DoorOpen,
  CheckCircle2,
  MapPin,
  ClipboardList,
  Lock,
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';

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
    description:
      'For patients who do not require priority assistance.',
    icon: User,
  },
  {
    key: 'priority',
    name: 'Priority Queue',
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
   KIOSK HEADER
========================================================= */

function KioskHeader() {
  const [now] = useState(new Date());

  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
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
    <div className="mb-6 flex items-center justify-between">
      <div>
        <span className="text-base font-bold text-red-600">
          SWU
        </span>

        <span className="text-base font-bold text-slate-800">
          Med
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {time}
        </span>

        <span className="flex items-center gap-1">
          &#128197;
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
    <div className="flex min-h-screen items-center justify-center bg-[#EAF3FB] px-4 py-10">
      <div className="w-full max-w-sm">
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
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 hover:border-slate-300"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-full bg-[#123C73] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0d2c56] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {continueLabel}
        <ArrowRight size={14} />
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
        <div className="mb-10">
          <span className="text-xl font-bold text-red-600">
            SWU
          </span>

          <span className="text-xl font-bold text-slate-800">
            Med
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          Welcome to
        </h1>

        <h1 className="mb-6 text-2xl font-bold text-[#123C73]">
          SWU Med Hospital
        </h1>

        <p className="mb-10 text-sm text-slate-500">
          Please tap below to get your queue number.
        </p>

        <button
          type="button"
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#123C73] py-4 text-base font-semibold text-white shadow-sm hover:bg-[#0d2c56]"
        >
          GET STARTED
          <ArrowRight size={18} />
        </button>
      </div>
    </Screen>
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

      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Select Your Kiosk
        </h1>

        <p className="text-sm text-slate-500">
          Please select the kiosk where you are getting your service.
        </p>
      </div>

      <div className="mb-8 space-y-3">
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
            Loading kiosks...
          </div>
        )}

        {!loading && kiosks.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
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
                className={`relative flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#123C73] bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#123C73] text-white">
                    <CheckCircle2 size={12} />
                  </span>
                )}

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Icon
                    size={16}
                    className="text-[#123C73]"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-bold uppercase tracking-wide ${
                        isSelected
                          ? 'text-[#123C73]'
                          : 'text-slate-800'
                      }`}
                    >
                      {currentKiosk.name}
                    </p>

                    {isUnlocked && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[9px] font-semibold text-green-700">
                        UNLOCKED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400">
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
   KIOSK PIN SCREEN
========================================================= */

function KioskPinScreen({
  kiosk,
  onBack,
  onSuccess,
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

 async function handleSubmit(event) {
  event.preventDefault();

  setError('');

  if (!kiosk?.kiosk_id) {
    setError('Invalid kiosk.');
    return;
  }

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
      'Incorrect PIN. Please try again.'
    );

    setPin('');
  } catch (error) {
    console.error(
      'Kiosk PIN verification error:',
      error
    );

    setError(
      error?.message ||
        'Unable to verify kiosk PIN.'
    );

    setPin('');
  }
}
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Lock
            size={22}
            className="text-[#123C73]"
          />
        </div>

        <h1 className="text-lg font-bold text-slate-900">
          Kiosk Access
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Enter the admin PIN to unlock
        </p>

        <p className="mt-2 text-sm font-bold text-[#123C73]">
          {kiosk.name}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label
            htmlFor="kiosk-pin"
            className="mb-2 block text-xs font-medium text-slate-500"
          >
            Admin PIN
          </label>

          <input
            id="kiosk-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(event) => {
              const value =
                event.target.value.replace(
                  /\D/g,
                  ''
                );

              setPin(value);
              setError('');
            }}
            placeholder="Enter 4-digit PIN"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-[#123C73] focus:ring-1 focus:ring-[#123C73]"
            autoFocus
          />

          {error && (
            <p className="mt-3 text-center text-xs font-medium text-red-500">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 hover:border-slate-300"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <button
            type="submit"
            disabled={pin.length !== 4}
            className="flex items-center gap-1.5 rounded-full bg-[#123C73] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0d2c56] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Unlock Kiosk
            <ArrowRight size={14} />
          </button>
        </div>
      </form>
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

      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Select Your Queue Type
        </h1>

        <p className="text-sm text-slate-500">
          Please select the queue type that applies to you.
        </p>

        {kiosk && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#123C73]">
            <MapPin size={11} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div className="mb-8 space-y-3">
        {QUEUE_TYPES.map((type) => {
          const Icon = type.icon;

          const isSelected =
            selected?.key === type.key;

          return (
            <button
              key={type.key}
              type="button"
              onClick={() => onSelect(type)}
              className={`relative w-full rounded-xl border p-5 text-center transition ${
                isSelected
                  ? 'border-[#123C73] bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#123C73] text-white">
                  <CheckCircle2 size={12} />
                </span>
              )}

              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                <Icon
                  size={16}
                  className="text-[#123C73]"
                />
              </div>

              <p
                className={`mb-1 text-sm font-bold uppercase tracking-wide ${
                  isSelected
                    ? 'text-[#123C73]'
                    : 'text-slate-800'
                }`}
              >
                {type.name}
              </p>

              <p className="text-xs text-slate-400">
                {type.description}
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

      <div className="mb-5 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          What do you need today?
        </h1>

        <p className="text-sm text-slate-500">
          Please select a department to get your queue number.
        </p>

        {kiosk && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#123C73]">
            <MapPin size={11} />
            {kiosk.name}
          </div>
        )}
      </div>

      <div
        className="mb-2 max-h-80 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
            Loading departments...
          </div>
        )}

        {!loading &&
          departments.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No departments are currently available.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Please contact the hospital administrator.
              </p>
            </div>
          )}

        {!loading &&
          departments.map((department) => {
            const Icon =
              getDepartmentIcon(
                department.name,
                department.classification
              );

            const isSelected =
              selected?.department_id ===
              department.department_id;

            return (
              <button
                key={department.department_id}
                type="button"
                onClick={() =>
                  onSelect(department)
                }
                className={`relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#123C73] bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#123C73] text-white">
                    <CheckCircle2 size={12} />
                  </span>
                )}

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Icon
                    size={16}
                    className="text-[#123C73]"
                  />
                </div>

                <div className="flex-1">
                  <p
                    className={`text-sm font-bold ${
                      isSelected
                        ? 'text-[#123C73]'
                        : 'text-slate-800'
                    }`}
                  >
                    {department.name}
                  </p>

                  <p className="mb-1 text-xs text-slate-400">
                    {getDepartmentDescription(
                      department
                    )}
                  </p>

                  <p className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {department.waiting ?? 0}{' '}
                      waiting
                    </span>

                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      ~{department.estMin ?? 0}{' '}
                      min
                    </span>
                  </p>
                </div>
              </button>
            );
          })}
      </div>

      {!loading &&
        departments.length > 0 && (
          <p className="mb-6 text-center text-[11px] text-slate-400">
            &darr; Swipe up for more
          </p>
        )}

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
  const ServiceIcon = service?.icon;

  return (
    <Screen>
      <KioskHeader />

      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Confirm Your Service
        </h1>

        <p className="text-sm text-slate-500">
          Please review your selected service before getting your queue number.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 space-y-3 text-sm">
          {/* QUEUE TYPE */}

          <div className="flex items-center gap-3">
            <Accessibility
              size={16}
              className="text-slate-400"
            />

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Queue Type
              </p>

              <p className="font-semibold text-slate-800">
                {queueType?.name}
              </p>
            </div>
          </div>

          {/* KIOSK */}

          <div className="flex items-center gap-3">
            <MapPin
              size={16}
              className="text-slate-400"
            />

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Kiosk
              </p>

              <p className="font-semibold text-slate-800">
                {kiosk?.name}
              </p>
            </div>
          </div>

          {/* DEPARTMENT */}

          <div className="flex items-center gap-3">
            {ServiceIcon && (
              <ServiceIcon
                size={16}
                className="text-slate-400"
              />
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Department
              </p>

              <p className="font-semibold text-slate-800">
                {service?.name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg bg-blue-50 px-4 py-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Current Queue
            </p>

            <p className="text-xl font-bold text-[#123C73]">
              {waitingAhead}
            </p>

            <p className="text-[10px] text-slate-400">
              people ahead
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Estimated Wait
            </p>

            <p className="text-xl font-bold text-[#123C73]">
              ~{service?.estMin ?? 0}
            </p>

            <p className="text-[10px] text-slate-400">
              min
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
  service,
  queueNumber,
  queueId,
  onPrint,
  onSkipPrint,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-5 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Your Queue Number
        </h1>

        <p className="text-sm text-slate-500">
          Please keep this slip until your number is called.
        </p>
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="px-6 py-6 text-center"
          style={{
            backgroundColor:
              queueType.key ===
              'priority'
                ? '#800000'
                : '#123C73',
          }}
        >
          <p className="mb-2 text-4xl font-bold text-white">
            {queueNumber}
          </p>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
            &#128100;
            {service.name}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4 p-4">
          <div className="space-y-2">
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
                  {service.waiting ?? 0}{' '}
                  people waiting
                </p>
              </div>
            </div>

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
                  {service.estMin ?? 0}{' '}
                  minutes
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <QRCodeSVG
              value={getTrackerUrl(queueId)}
              size={90}
              level="M"
              includeMargin={true}
            />

            <p className="mt-1 max-w-[90px] text-center text-[9px] text-slate-400">
              Scan the QR code to track your queue status on your phone.
            </p>
          </div>
        </div>
      </div>

      <p className="mb-3 text-center text-sm font-medium text-slate-700">
        Would you like to print your ticket?
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrint}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#123C73] py-3 text-xs font-semibold text-white hover:bg-[#0d2c56]"
        >
          <Printer size={14} />
          PRINT TICKET
        </button>

        <button
          type="button"
          onClick={onSkipPrint}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-600 hover:border-slate-300"
        >
          CONTINUE WITHOUT PRINTING
          <ArrowRight size={14} />
        </button>
      </div>
    </Screen>
  );
}

/* =========================================================
   PRINTING SCREEN
========================================================= */

function PrintingScreen({
  queueNumber,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="mb-5 text-base font-bold text-slate-900">
          Printing Your Ticket
        </h2>

        <div className="mx-auto mb-5 max-w-[220px] rounded-xl bg-[#123C73] px-4 py-4">
          <p className="text-[9px] uppercase tracking-wide text-white/60">
            Your queue number
          </p>

          <p className="text-2xl font-bold text-white">
            {queueNumber}
          </p>
        </div>

        <DoorOpen
          size={28}
          className="mx-auto mb-4 animate-pulse text-slate-300"
        />

        <p className="mb-4 text-xs text-slate-500">
          Please wait while your ticket is being printed.
          Take it with you to the waiting area.
        </p>

        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-[#123C73]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#123C73]" />
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
  queueNumber,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <CheckCircle2
            size={24}
            className="text-[#123C73]"
          />
        </div>

        <h2 className="mb-5 text-base font-bold text-slate-900">
          Ticket Printed Successfully!
        </h2>

        <div className="mx-auto mb-5 max-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">
            Your queue number
          </p>

          <p className="text-2xl font-bold text-slate-900">
            {queueNumber}
          </p>
        </div>

        <p className="mb-1 text-xs text-slate-500">
          Please take your ticket and proceed to the waiting area.
        </p>

        <p className="text-[11px] text-slate-400">
          Scan the QR code on your ticket to track your queue.
        </p>
      </div>
    </Screen>
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

  /*
    Loads departments for the selected kiosk through:

      Patient.jsx
          ↓
      backendApi.js
          ↓
      Node.js
          ↓
      MySQL
  */

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
      /*
        Get only departments assigned to this kiosk.
      */

      const data =
        await getPatientDepartments(
          kioskRecord.kiosk_id
        );

      const activeDepartments =
        (data || []).filter(
          (department) =>
            !department.status ||
            String(
              department.status
            ).toLowerCase() ===
              'active'
        );

      /*
        Get current waiting count for
        each department.
      */

      const departmentsWithWaiting =
        await Promise.all(
          activeDepartments.map(
            async (department) => {
              let waiting = 0;

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
      No active kiosk has been unlocked today.
      Patient must select a kiosk.
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

      /*
        Extra safety check.
      */

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

      /*
        Node.js returns:

        transaction_id
        queue_id
        queue_number
        queue_sequence
        patient_number
        department_id
        department
        kiosk_id
        kiosk
        queue_type
        is_priority
        status
        est_time
      */

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
          Number(
            result.est_time
          ) ||
          current?.estMin ||
          0,
      }));

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
     PRINTING → SUCCESS
  ======================================================= */

  useEffect(() => {
    if (
      step !== 'printing'
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        setStep('success');
      }, 2200);

    return () =>
      clearTimeout(timer);
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
     WELCOME
  ======================================================= */

  if (
    step === 'welcome'
  ) {
    return (
      <WelcomeScreen
        onStart={
          handleStart
        }
      />
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
      <KioskPinScreen
        kiosk={kiosk}
        onBack={() =>
          setStep('kiosk')
        }
        onSuccess={
          handleKioskPinSuccess
        }
      />
    );
  }

  /* =======================================================
     QUEUE TYPE
  ======================================================= */

  if (
    step === 'queueType'
  ) {
    return (
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
          onContinue={() => {
            if (!service) {
              return;
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
    );
  }

  /* =======================================================
     TICKET
  ======================================================= */

  if (
    step === 'ticket'
  ) {
    return (
      <TicketScreen
        queueType={
          queueType
        }
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
    );
  }

  /* =======================================================
     PRINTING
  ======================================================= */

  if (
    step === 'printing'
  ) {
    return (
      <PrintingScreen
        queueNumber={
          queueNumber
        }
      />
    );
  }

  /* =======================================================
     SUCCESS
  ======================================================= */

  return (
    <SuccessScreen
      queueNumber={
        queueNumber
      }
    />
  );
}