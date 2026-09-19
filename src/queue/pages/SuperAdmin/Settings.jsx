import { useEffect, useState } from 'react';
import { X, Sun, Moon, Monitor, Check, Pipette, ShieldCheck, LockKeyhole } from 'lucide-react';

import { auth } from '../../../firebase';
import {
  getSecurityPinStatus,
  requestSecurityPinVerification,
  verifySecurityPinCode,
} from '../../services/backendApi';

const LANGUAGES = ['English', 'Filipino', 'Cebuano'];

const THEME_MODES = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'device', label: 'Device', icon: Monitor },
];

// Each swatch is a 4-quadrant preview circle.
const THEME_SWATCHES = [
  { key: 'blue', colors: ['#9D0A0E', '#D4B0B1', '#7D080B', '#F0DADA'] },
  { key: 'slate', colors: ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB'] },
  { key: 'ocean', colors: ['#1E5FA8', '#5B8FC9', '#123C73', '#A8C4E0'] },
  { key: 'steel', colors: ['#64748B', '#94A3B8', '#334155', '#CBD5E1'] },

  { key: 'graphite', colors: ['#455A64', '#78909C', '#37474F', '#B0BEC5'] },
  { key: 'teal', colors: ['#14B8A6', '#5EEAD4', '#0F766E', '#99F6E4'] },
  { key: 'green', colors: ['#22C55E', '#86EFAC', '#15803D', '#BBF7D0'] },
  { key: 'moss', colors: ['#5F7A5F', '#8FA98F', '#3F5A3F', '#B8CBB8'] },

  { key: 'olive', colors: ['#A3A32B', '#C7C755', '#7A7A1F', '#DEDE8A'] },
  { key: 'orange', colors: ['#F97316', '#FDBA74', '#C2410C', '#FED7AA'] },
  { key: 'brown', colors: ['#6B4F3F', '#A98A76', '#4A362A', '#D6C0B1'] },
  { key: 'rose', colors: ['#E11D6B', '#F9A8C4', '#9F1239', '#FBCFE0'] },

  { key: 'mauve', colors: ['#8B6B6B', '#B08F8F', '#6A4F4F', '#D4BDBD'] },
  { key: 'pink', colors: ['#E879C6', '#F5B4E0', '#C0439C', '#FBDCF1'] },
  { key: 'purple', colors: ['#8B5CF6', '#C4B5FD', '#6D28D9', '#DDD6FE'] },
];

function quadrantGradient(colors) {
  const [a, b, c, d] = colors;
  return `conic-gradient(from 0deg, ${a} 0deg 90deg, ${b} 90deg 180deg, ${c} 180deg 270deg, ${d} 270deg 360deg)`;
}

/* ---------------- Department Customization Modal ---------------- */

function DepartmentCustomizationModal({ onClose }) {
  const [departmentName, setDepartmentName] = useState('Billing Department');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Department Customization</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FBF1F1] text-xs font-semibold text-[#9D0A0E]">
              JD
            </div>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Change
            </button>
          </div>

          <div className="rounded-lg border border-slate-300 px-3 py-2">
            <label
              htmlFor="department-name"
              className="block text-[10px] font-medium text-slate-500"
            >
              Department Name
            </label>
            <input
              id="department-name"
              type="text"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full border-none p-0 text-sm text-slate-800 focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Theme Modal ---------------- */

function ThemeModal({ onClose, onOpenColorPicker }) {
  const [mode, setMode] = useState('light');
  const [selectedSwatch, setSelectedSwatch] = useState('blue');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-[280px] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Theme</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Mode selector */}
          <div className="flex items-center gap-1.5">
            {THEME_MODES.map(({ key, label, icon: Icon }) => {
              const isActive = mode === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                    isActive
                      ? 'border border-slate-300 bg-white text-slate-800 shadow-sm'
                      : 'border border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Swatch grid */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {THEME_SWATCHES.map(({ key, colors }) => {
              const isSelected = selectedSwatch === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSwatch(key)}
                  aria-label={`${key} theme`}
                  className="relative flex aspect-square items-center justify-center rounded-lg bg-slate-50 transition hover:bg-slate-100"
                >
                  <span
                    className="block h-8 w-8 rounded-full"
                    style={{ background: quadrantGradient(colors) }}
                  />
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#9D0A0E] text-white">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom color launcher */}
            <button
              type="button"
              onClick={onOpenColorPicker}
              aria-label="Pick a custom color"
              className="relative flex aspect-square items-center justify-center rounded-lg bg-slate-50 transition hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C2603C] text-white">
                <Pipette size={14} />
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Color Picker Modal ---------------- */

function ColorPickerModal({ onClose }) {
  const [hue, setHue] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-800">Color Picker</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex items-center gap-3 px-5 py-5">
          <span
            className="h-7 w-7 shrink-0 rounded-full"
            style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
          />
          <input
            type="range"
            min="0"
            max="360"
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            aria-label="Hue"
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background:
                'linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Create PIN Modal ---------------- */

function CreatePinModal({ onClose, onContinue }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleContinue = () => {
    setError('');

    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    onContinue(pin);
  };

  const handlePinChange = (value, setter) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setter(digitsOnly);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Create Security PIN
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Protect sensitive system operations
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FBF1F1] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9D0A0E]">
              <ShieldCheck size={16} />
            </div>

            <p className="text-[11px] leading-4 text-slate-600">
              Create a 6-digit security PIN. This PIN will be required for
              protected kiosk and department operations.
            </p>
          </div>

          {/* New PIN */}
          <div>
            <label
              htmlFor="security-pin"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              New PIN
            </label>

            <input
              id="security-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value, setPin)}
              placeholder="Enter 6-digit PIN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm tracking-[0.35em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {/* Confirm PIN */}
          <div>
            <label
              htmlFor="confirm-security-pin"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Confirm PIN
            </label>

            <input
              id="confirm-security-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={confirmPin}
              onChange={(e) =>
                handlePinChange(e.target.value, setConfirmPin)
              }
              placeholder="Re-enter 6-digit PIN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm tracking-[0.35em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleContinue}
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PIN Verification Modal ---------------- */

function PinVerificationModal({
  onClose,
  onBack,
  onSuccess,
  firebaseUser,
  pendingPin,
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState('');

  const handleCodeChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setCode(digitsOnly);
    setError('');
    setMessage('');
  };

  const handleVerify = async () => {
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(code)) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    if (!/^\d{6}$/.test(pendingPin)) {
      setError('Your PIN is missing. Please go back and enter it again.');
      return;
    }

    if (!firebaseUser) {
      setError('Your authentication session is unavailable. Please log in again.');
      return;
    }

    try {
      setIsVerifying(true);

      await verifySecurityPinCode(
        firebaseUser,
        code,
        pendingPin
      );

      onSuccess();
    } catch (err) {
      setError(
        err?.message ||
          'Failed to verify the code. Please try again.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');

    if (!firebaseUser) {
      setError('Your authentication session is unavailable. Please log in again.');
      return;
    }

    try {
      setIsResending(true);

      await requestSecurityPinVerification(
        firebaseUser
      );

      setCode('');
      setMessage(
        'A new verification code has been sent to your registered email.'
      );
    } catch (err) {
      setError(
        err?.message ||
          'Failed to resend the verification code.'
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Verify Your Email
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Confirm your identity to create the PIN
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#FBF1F1] p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#9D0A0E]">
              <LockKeyhole size={15} />
            </div>

            <p className="text-[11px] leading-4 text-slate-600">
              We've sent a 6-digit verification code to your registered
              email address.
            </p>
          </div>

          <div>
            <label
              htmlFor="pin-verification-code"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Verification Code
            </label>

            <input
              id="pin-verification-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold tracking-[0.4em] text-slate-800 outline-none transition placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {error && (
            <p className="text-[11px] font-medium text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="text-[11px] font-medium text-green-600">
              {message}
            </p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-[11px] font-semibold text-[#9D0A0E] transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isVerifying}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PIN Success Modal ---------------- */

function PinSuccessModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex flex-col items-center px-6 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <Check size={24} strokeWidth={2.5} />
          </div>

          <h2 className="mt-4 text-base font-bold text-slate-800">
            PIN Created
          </h2>

          <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
            Your security PIN has been successfully created. You can now use
            it for protected kiosk and department operations.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-md bg-[#9D0A0E] px-6 py-2 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Settings Page ---------------- */

export default function Settings() {
  const [language, setLanguage] = useState('English');
  const [activeModal, setActiveModal] = useState(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinStatusLoading, setPinStatusLoading] = useState(true);
  const [pendingPin, setPendingPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
  let isMounted = true;

  const loadSecurityPinStatus = async () => {
    try {
      setPinStatusLoading(true);
      setPinError('');

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          'Your authentication session is unavailable.'
        );
      }

      const result =
        await getSecurityPinStatus(firebaseUser);

      if (isMounted) {
        setPinConfigured(
          Boolean(result.configured)
        );
      }
    } catch (error) {
      console.error(
        'Failed to load Security PIN status:',
        error
      );

      if (isMounted) {
        setPinError(
          error?.message ||
            'Failed to load Security PIN status.'
        );
      }
    } finally {
      if (isMounted) {
        setPinStatusLoading(false);
      }
    }
  };

  loadSecurityPinStatus();

  return () => {
    isMounted = false;
  };
}, []);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Manage system preferences, display configurations, and global rules.
        </p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Appearance</h2>

        <div className="mt-4 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setActiveModal('department')}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Department Customization
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('theme')}
            className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Theme
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Language</h2>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {LANGUAGES.map((lang) => {
            const isActive = language === lang;

            return (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'border border-slate-300 bg-white text-slate-800 shadow-sm'
                    : 'border border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Security
            </h2>

            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
                <ShieldCheck size={17} />
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-800">
                  Security PIN
                </h3>

                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                  {pinConfigured
                    ? 'Your security PIN is active and protects sensitive kiosk and department operations.'
                    : 'Create a 6-digit PIN to protect kiosk unlocking and department reset operations.'}
                   {pinError && (
                      <p className="mt-2 text-[11px] font-medium text-red-600">
                        {pinError}
                      </p>
                    )} 
                </p>

                {pinConfigured && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700">
                    <Check size={11} strokeWidth={3} />
                    Configured
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={pinStatusLoading}
            onClick={() => setActiveModal('createPin')}
            className="shrink-0 rounded-lg bg-[#9D0A0E] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#7D080B]"
          >
            {pinStatusLoading
              ? 'Loading...'
              : pinConfigured
                ? 'Change PIN'
                : 'Create PIN'}
          </button>
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'department' && (
        <DepartmentCustomizationModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'theme' && (
        <ThemeModal
          onClose={() => setActiveM_odal(null)}
          onOpenColorPicker={() => setActiveModal('colorPicker')}
        />
      )}

          {activeModal === 'createPin' && (
<CreatePinModal
  onClose={() => {
    setPendingPin('');
    setActiveModal(null);
  }}
  onContinue={async (pin) => {
    try {
      setPinError('');

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          'Your authentication session is unavailable. Please log in again.'
        );
      }

      setPendingPin(pin);

      await requestSecurityPinVerification(
        firebaseUser
      );

      setActiveModal('verifyPin');
    } catch (error) {
      console.error(
        'Failed to request Security PIN verification:',
        error
      );

      setPinError(
        error?.message ||
          'Failed to send the verification code.'
      );
    }
  }}
/>
      )}

      {activeModal === 'verifyPin' && (
<PinVerificationModal
  firebaseUser={auth.currentUser}
  pendingPin={pendingPin}
  onClose={() => {
    setPendingPin('');
    setActiveModal(null);
  }}
  onBack={() => setActiveModal('createPin')}
  onSuccess={() => {
    setPendingPin('');
    setPinConfigured(true);
    setActiveModal('pinSuccess');
  }}
/>
      )}

      {activeModal === 'pinSuccess' && (
        <PinSuccessModal
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}