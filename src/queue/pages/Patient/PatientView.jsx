import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase';

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
  CreditCard,
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
} from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';

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
   HOSPITAL LOCATIONS
========================================================= */

const LOCATIONS = [
  {
    key: 'main-lobby',
    name: 'Main Lobby',
    description: 'Information, Admission, Billing.',
    icon: Building2,
  },
  {
    key: 'lab-radiology',
    name: 'Laboratory & Radiology',
    description: 'Laboratory and radiology services.',
    icon: FlaskConical,
  },
  {
    key: 'opd-clinic',
    name: 'OPD / University Clinic',
    description: 'Outpatient and clinic services.',
    icon: Stethoscope,
  },
  {
    key: 'medical-arts',
    name: 'Medical Arts Building',
    description: 'Pharmacy, Clinics, Other services.',
    icon: Building,
  },
];

/* =========================================================
   SERVICES BY LOCATION
========================================================= */

const SERVICES_BY_LOCATION = {
  'main-lobby': [
    {
      queuePrefix: 'IN',
      name: 'Information',
      description:
        'General hospital inquiries and assistance.',
      waiting: 5,
      estMin: 32,
      icon: Info,
    },
    {
      queuePrefix: 'AD',
      name: 'Admission',
      description:
        'Patient admission and related services.',
      waiting: 2,
      estMin: 12,
      icon: BedDouble,
    },
    {
      queuePrefix: 'CH',
      name: 'CHAMP',
      description:
        'CHAMP assistance and HMO concerns.',
      waiting: 3,
      estMin: 18,
      icon: ShieldCheck,
    },
    {
      queuePrefix: 'CS',
      name: 'Cashier',
      description:
        'Cashier and payment transactions.',
      waiting: 4,
      estMin: 25,
      icon: Wallet,
    },
    {
      queuePrefix: 'BL',
      name: 'Billing',
      description:
        'Billing-related concerns and assistance.',
      waiting: 7,
      estMin: 36,
      icon: CreditCard,
    },
    {
      queuePrefix: 'CC',
      name: 'Credit and Collection',
      description:
        'Credit and collection assistance.',
      waiting: 2,
      estMin: 15,
      icon: ClipboardList,
    },
    {
      queuePrefix: 'MS',
      name: 'Medical Social Worker',
      description:
        'Medical social work assistance.',
      waiting: 2,
      estMin: 15,
      icon: Users,
    },
    {
      queuePrefix: 'PH',
      name: 'Phil Health',
      description:
        'PhilHealth assistance and processing.',
      waiting: 3,
      estMin: 20,
      icon: ShieldCheck,
    },
  ],

  'opd-clinic': [
    {
      queuePrefix: 'PD',
      name: 'Pedia',
      description:
        'Pediatric outpatient services.',
      waiting: 4,
      estMin: 28,
      icon: User,
    },
    {
      queuePrefix: 'SU',
      name: 'Surgery',
      description:
        'Surgery outpatient services.',
      waiting: 2,
      estMin: 22,
      icon: ClipboardList,
    },
    {
      queuePrefix: 'IM',
      name: 'Internal Medicine',
      description:
        'Internal medicine outpatient services.',
      waiting: 5,
      estMin: 35,
      icon: Stethoscope,
    },
    {
      queuePrefix: 'FM',
      name: 'FAMED',
      description:
        'Family medicine outpatient services.',
      waiting: 3,
      estMin: 24,
      icon: Stethoscope,
    },
  ],

  'lab-radiology': [
    {
      queuePrefix: 'LS',
      name: 'Lab-Specimen Collection',
      description:
        'Laboratory specimen collection.',
      waiting: 4,
      estMin: 25,
      icon: FlaskConical,
    },
    {
      queuePrefix: 'LR',
      name: 'LAB- Results',
      description:
        'Laboratory results and releasing.',
      waiting: 3,
      estMin: 18,
      icon: ClipboardList,
    },
    {
      queuePrefix: 'RR',
      name: 'Rad-Results',
      description:
        'Radiology results and releasing.',
      waiting: 2,
      estMin: 15,
      icon: FlaskConical,
    },
    {
      queuePrefix: 'CT',
      name: 'CT-Scan',
      description:
        'CT scan services.',
      waiting: 2,
      estMin: 30,
      icon: FlaskConical,
    },
    {
      queuePrefix: 'XR',
      name: 'X-Ray',
      description:
        'X-ray services.',
      waiting: 3,
      estMin: 25,
      icon: FlaskConical,
    },
  ],

  'medical-arts': [
    {
      queuePrefix: 'PH',
      name: 'Pharmacy',
      description:
        'Pharmacy services and assistance.',
      waiting: 5,
      estMin: 20,
      icon: Wallet,
    },
    {
      queuePrefix: 'WC',
      name: "Women's Health (Consultation)",
      description:
        "Women's health consultation services.",
      waiting: 2,
      estMin: 30,
      icon: Stethoscope,
    },
    {
      queuePrefix: 'WU',
      name: "Women's Health (Ultrasound)",
      description:
        "Women's health ultrasound services.",
      waiting: 2,
      estMin: 35,
      icon: FlaskConical,
    },
    {
      queuePrefix: 'PC',
      name: 'PT- Rehab (Consultation)',
      description:
        'Physical therapy consultation services.',
      waiting: 2,
      estMin: 25,
      icon: Stethoscope,
    },
    {
      queuePrefix: 'PS',
      name: 'PT-Rehab (Session)',
      description:
        'Physical therapy session services.',
      waiting: 3,
      estMin: 30,
      icon: Stethoscope,
    },
    {
      queuePrefix: 'CA',
      name: 'Cardiac',
      description:
        'Cardiac services and assistance.',
      waiting: 2,
      estMin: 30,
      icon: Stethoscope,
    },
  ],
};

/* =========================================================
   KIOSK HEADER
========================================================= */

function KioskHeader() {
  const [now] = useState(new Date());

  const time = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const date = now.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

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
        <h1 className="text-lg font-bold text-slate-900">
          Select Your Queue Type
        </h1>

        <p className="text-sm text-slate-500">
          Please select the queue type that applies to you.
        </p>
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
   LOCATION SCREEN
========================================================= */

function SelectLocationScreen({
  selected,
  onSelect,
  onBack,
  onContinue,
}) {
  return (
    <Screen>
      <KioskHeader />

      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Select Your Location
        </h1>

        <p className="text-sm text-slate-500">
          Please select the hospital area where you need service.
        </p>
      </div>

      <div className="mb-8 space-y-3">
        {LOCATIONS.map((loc) => {
          const Icon = loc.icon;

          const isSelected =
            selected?.key === loc.key;

          return (
            <button
              key={loc.key}
              type="button"
              onClick={() => onSelect(loc)}
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

              <div>
                <p
                  className={`text-sm font-bold uppercase tracking-wide ${
                    isSelected
                      ? 'text-[#123C73]'
                      : 'text-slate-800'
                  }`}
                >
                  {loc.name}
                </p>

                <p className="text-xs text-slate-400">
                  {loc.description}
                </p>
              </div>
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
   SERVICE SCREEN
========================================================= */

function SelectServiceScreen({
  location,
  selected,
  onSelect,
  onBack,
  onContinue,
}) {
  const services =
    SERVICES_BY_LOCATION[location.key] ?? [];

  return (
    <Screen>
      <KioskHeader />

      <div className="mb-5 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          What do you need today?
        </h1>

        <p className="text-sm text-slate-500">
          Please select a service to get your queue number.
        </p>
      </div>

      <div
        className="mb-2 max-h-80 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {services.map((service) => {
          const Icon = service.icon;

          const isSelected =
            selected?.name === service.name;

          return (
            <button
              key={service.name}
              type="button"
              onClick={() => onSelect(service)}
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
                  {service.name}
                </p>

                <p className="mb-1 text-xs text-slate-400">
                  {service.description}
                </p>

                <p className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {service.waiting} waiting
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    ~{service.estMin} min
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mb-6 text-center text-[11px] text-slate-400">
        &darr; Swipe up for more
      </p>

      <NavButtons
        onBack={onBack}
        onContinue={onContinue}
        disabled={!selected}
      />
    </Screen>
  );
}

/* =========================================================
   CONFIRM SCREEN
========================================================= */

function ConfirmScreen({
  queueType,
  location,
  service,
  waitingAhead,
  isGenerating,
  onBack,
  onConfirm,
}) {
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
                {queueType.name}
              </p>
            </div>
          </div>

          {/* LOCATION */}
          <div className="flex items-center gap-3">
            <MapPin
              size={16}
              className="text-slate-400"
            />

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Location
              </p>

              <p className="font-semibold text-slate-800">
                {location.name}
              </p>
            </div>
          </div>

          {/* SERVICE */}
          <div className="flex items-center gap-3">
            <service.icon
              size={16}
              className="text-slate-400"
            />

            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Service
              </p>

              <p className="font-semibold text-slate-800">
                {service.name}
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
              ~{service.estMin}
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
              queueType.key === 'priority'
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
                  {service.waiting} people waiting
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
                  {service.estMin} minutes
                </p>
              </div>
            </div>
          </div>

          {/* QR CODE */}
          <div className="flex flex-col items-center justify-center">
            <QRCodeSVG
              value={`${service.name}-${queueNumber}`}
              size={90}
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

function PrintingScreen({ queueNumber }) {
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

function SuccessScreen({ queueNumber }) {
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

export default function PatientView() {
  const [step, setStep] = useState('welcome');

  /*
    welcome
    queueType
    location
    select
    confirm
    ticket
    printing
    success
  */

  const [queueType, setQueueType] =
    useState(null);

  const [location, setLocation] =
    useState(null);

  const [service, setService] =
    useState(null);

  const [queueNumber, setQueueNumber] =
    useState('');

  const [isGenerating, setIsGenerating] =
    useState(false);

  /* =======================================================
     RESET
  ======================================================= */

  function handleReset() {
    setQueueType(null);
    setLocation(null);
    setService(null);
    setQueueNumber('');
    setIsGenerating(false);
    setStep('welcome');
  }

  /* =======================================================
     GENERATE QUEUE NUMBER
  ======================================================= */

  async function handleGenerateNumber() {
    try {
      setIsGenerating(true);

      /* ---------------------------------------------------
         VALIDATE SELECTIONS
      --------------------------------------------------- */

      if (!queueType) {
        throw new Error(
          'Please select a queue type.'
        );
      }

      if (!location) {
        throw new Error(
          'Please select a location.'
        );
      }

      if (!service) {
        throw new Error(
          'Please select a service.'
        );
      }

      /* ---------------------------------------------------
         1. GET DEPARTMENT INFORMATION
      --------------------------------------------------- */

      const cleanedServiceName =
        service.name.trim();

      const {
        data: deptData,
        error: deptError,
      } = await supabase
        .from('departments')
        .select('department_id, prefix')
        .ilike(
          'name',
          cleanedServiceName
        )
        .maybeSingle();

      if (deptError) {
        console.warn(
          'Issue fetching department info:',
          deptError
        );
      }

      if (
        !deptData ||
        !deptData.department_id
      ) {
        throw new Error(
          `Could not find the department ID for "${cleanedServiceName}" in the database. Please check your Supabase "departments" table and make sure the name matches.`
        );
      }

      /* ---------------------------------------------------
         2. DETERMINE QUEUE PREFIX
      --------------------------------------------------- */

      let finalPrefix =
        service.queuePrefix;

      if (deptData.prefix) {
        finalPrefix =
          deptData.prefix;
      }

      /* ---------------------------------------------------
         3. GET START OF TODAY
      --------------------------------------------------- */

      const startOfDay =
        new Date();

      startOfDay.setHours(
        0,
        0,
        0,
        0
      );

      /* ---------------------------------------------------
         4. COUNT TODAY'S QUEUE
      --------------------------------------------------- */

      const {
        count,
        error: countError,
      } = await supabase
        .from('queue_ticket')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq(
          'department_id',
          deptData.department_id
        )
        .gte(
          'issued_at',
          startOfDay.toISOString()
        );

      if (countError) {
        throw countError;
      }

      /* ---------------------------------------------------
         5. GENERATE NEXT QUEUE NUMBER
      --------------------------------------------------- */

      const nextSequence =
        (count || 0) + 1;

      const isPriority =
        queueType.key === 'priority';

      const paddedNumber =
        `${finalPrefix}-${String(
          nextSequence
        ).padStart(3, '0')}`;

      let formattedNumber =
        paddedNumber;

      if (isPriority) {
        formattedNumber =
          `P-${paddedNumber}`;
      }

      /* ---------------------------------------------------
         6. INSERT INTO PATIENT TABLE

         IMPORTANT:
         patient primary key is now transaction_id.
      --------------------------------------------------- */

      const {
        data: newPatient,
        error: patientError,
      } = await supabase
        .from('patient')
        .insert([
          {
            location:
              location.name,

            department:
              service.name,

            patient_number:
              formattedNumber,
          },
        ])
        .select(
          'transaction_id'
        )
        .single();

      if (patientError) {
        console.error(
          'Patient Insert Error:',
          JSON.stringify(
            patientError,
            null,
            2
          )
        );

        throw new Error(
          `Patient table error: ${patientError.message}`
        );
      }

      /* ---------------------------------------------------
         MAKE SURE TRANSACTION ID WAS CREATED
      --------------------------------------------------- */

      if (
        !newPatient?.transaction_id
      ) {
        throw new Error(
          'Patient was created, but no transaction ID was returned.'
        );
      }

      /* ---------------------------------------------------
         7. INSERT INTO QUEUE TICKET

         queue_ticket.patient_id remains the FK column.

         It should reference:
         patient.transaction_id
      --------------------------------------------------- */

      const {
        data: newTicket,
        error: ticketError,
      } = await supabase
        .from('queue_ticket')
        .insert([
          {
            queue_number:
              formattedNumber,

            queue_sequence:
              nextSequence,

            patient_id:
              newPatient.transaction_id,

            department_id:
              deptData.department_id,

            status:
              'waiting',

            is_priority:
              isPriority,
          },
        ])
        .select('queue_id')
        .single();

      if (ticketError) {
        console.error(
          'Ticket Insert Error:',
          JSON.stringify(
            ticketError,
            null,
            2
          )
        );

        throw new Error(
          `Queue ticket table error: ${ticketError.message}`
        );
      }

      /* ---------------------------------------------------
         8. VERIFY QUEUE TICKET
      --------------------------------------------------- */

      if (!newTicket?.queue_id) {
        throw new Error(
          'Queue ticket was created, but no queue ID was returned.'
        );
      }

      /* ---------------------------------------------------
         9. SUCCESS
      --------------------------------------------------- */

      setQueueNumber(
        formattedNumber
      );

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
    if (step !== 'printing') {
      return;
    }

    const timer =
      setTimeout(() => {
        setStep('success');
      }, 2200);

    return () => clearTimeout(timer);
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

    return () => clearTimeout(timer);
  }, [step]);

  /* =======================================================
     WELCOME
  ======================================================= */

  if (step === 'welcome') {
    return (
      <WelcomeScreen
        onStart={() =>
          setStep('queueType')
        }
      />
    );
  }

  /* =======================================================
     QUEUE TYPE
  ======================================================= */

  if (step === 'queueType') {
    return (
      <QueueTypeScreen
        selected={queueType}
        onSelect={setQueueType}
        onBack={handleReset}
        onContinue={() =>
          setStep('location')
        }
      />
    );
  }

  /* =======================================================
     LOCATION
  ======================================================= */

  if (step === 'location') {
    return (
      <SelectLocationScreen
        selected={location}
        onSelect={setLocation}
        onBack={() =>
          setStep('queueType')
        }
        onContinue={() =>
          setStep('select')
        }
      />
    );
  }

  /* =======================================================
     SERVICE
  ======================================================= */

  if (step === 'select') {
    return (
      <SelectServiceScreen
        location={location}
        selected={service}
        onSelect={setService}
        onBack={() =>
          setStep('location')
        }
        onContinue={() =>
          setStep('confirm')
        }
      />
    );
  }

  /* =======================================================
     CONFIRM
  ======================================================= */

  if (step === 'confirm') {
    return (
      <ConfirmScreen
        queueType={queueType}
        location={location}
        service={service}

        /*
          Temporary display value.

          Replace this later with your real
          database / AI waiting-time calculation.
        */
        waitingAhead={
          service.waiting * 5 + 2
        }

        isGenerating={
          isGenerating
        }

        onBack={() =>
          setStep('select')
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

  if (step === 'ticket') {
    return (
      <TicketScreen
        queueType={queueType}
        service={service}
        queueNumber={queueNumber}
        onPrint={handlePrint}
        onSkipPrint={handleReset}
      />
    );
  }

  /* =======================================================
     PRINTING
  ======================================================= */

  if (step === 'printing') {
    return (
      <PrintingScreen
        queueNumber={queueNumber}
      />
    );
  }

  /* =======================================================
     SUCCESS
  ======================================================= */

  return (
    <SuccessScreen
      queueNumber={queueNumber}
    />
  );
}
