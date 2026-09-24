import { useEffect, useState } from 'react';
import {
  X,
  Sun,
  Moon,
  Monitor,
  Check,
  Pipette,
  ShieldCheck,
  LockKeyhole,
  Palette,
  Copy,
  Upload,
  KeyRound,
  Globe,
} from 'lucide-react';

import { auth } from '../../../firebase';
import {

  getSecurityPinStatus,
  requestSecurityPinVerification,
  verifySecurityPinCode,
} from '../../services/backendApi';

import ChangePasswordModal from '../../components/changePasswordModal';
import Logo from '../../../assets/logo.png';

const ACCENT_PRESETS = [
  '#9D0A0E',
  '#B34C4C',
  '#1F2937',
  '#0F766E',
  '#4B5563',
];

const CLOCK_FORMATS = [
  '12-Hour (1:30 PM)',
  '24-Hour (13:30)',
];

// Each swatch is a 4-quadrant preview circle.
const THEME_MODES = [
  { key: 'light', label: 'Light Mode', caption: 'Default hospital theme', icon: Sun },
  { key: 'dark', label: 'Dark Mode', caption: 'Dimmed high-contrast', icon: Moon },
  { key: 'system', label: 'System Default', caption: 'Follows OS preference', icon: Monitor },
];

const LANGUAGES = ['English', 'Filipino', 'Cebuano'];

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
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              Department Customization
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Customize department settings.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md p-1.5 text-[#4B5563] transition-colors hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#4B5563]">
              Department Name
            </label>

            <input
              type="text"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#9D0A0E] focus:ring-1 focus:ring-[#9D0A0E]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
}) {
  return (
    <section className="swu-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-2.5">
          <Icon
            size={16}
            className="mt-0.5 shrink-0 text-[#9D0A0E]"
          />

          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              {title}
            </h2>

            <p className="mt-0.5 text-xs text-[#4B5563]">
              {subtitle}
            </p>
          </div>
        </div>

        {badge && (
          <span className="shrink-0 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-2.5 py-1 text-xs font-medium text-[#4B5563]">
            {badge}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="border-t border-[#E5E7EB] px-6 py-5">
        {children}
      </div>
    </section>
  );
}
function FieldLabel({ children }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#4B5563]">
      {children}
    </p>
  );
}

function ThemeModal({ onClose, onOpenColorPicker }) {
  const [mode, setMode] = useState('system');
  const [selectedSwatch, setSelectedSwatch] = useState('blue');

  return (
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-xs overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <h2 className="text-sm font-bold text-[#1F2937]">
            Theme
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#1F2937]"
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
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'border border-[#E5E7EB] bg-white text-[#1F2937] shadow-sm'
                      : 'border border-transparent bg-[#F1F3F5] text-[#4B5563] hover:bg-[#E5E7EB]'
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
                  className="swu-press relative flex aspect-square items-center justify-center rounded-lg bg-[#F8F9FA] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F1F3F5] hover:shadow-sm"
                >
                  <span
                    className="block h-8 w-8 rounded-full"
                    style={{
                      background: quadrantGradient(colors),
                    }}
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
              className="swu-press relative flex aspect-square items-center justify-center rounded-lg bg-[#F8F9FA] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F1F3F5] hover:shadow-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C2603C] text-white">
                <Pipette size={14} />
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Hint({ children }) {
  return (
    <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">
      {children}
    </p>
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
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              Create Security PIN
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Protect sensitive system operations
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] transition hover:text-[#1F2937]"
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

            <p className="text-xs leading-4 text-[#4B5563]">
              Create a 6-digit security PIN. This PIN will be required for
              protected kiosk and department operations.
            </p>
          </div>

          {/* New PIN */}
          <div>
            <label
              htmlFor="security-pin"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
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
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm tracking-[0.35em] text-[#1F2937] outline-none transition placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {/* Confirm PIN */}
          <div>
            <label
              htmlFor="confirm-security-pin"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
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
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm tracking-[0.35em] text-[#1F2937] outline-none transition placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleContinue}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
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
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-[#1F2937]">
              Verify Your Email
            </h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">
              Confirm your identity to create the PIN
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA3AF] transition hover:text-[#1F2937]"
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

            <p className="text-xs leading-4 text-[#4B5563]">
              We've sent a 6-digit verification code to your registered
              email address.
            </p>
          </div>

          <div>
            <label
              htmlFor="pin-verification-code"
              className="mb-1.5 block text-xs font-semibold text-[#1F2937]"
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
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-center text-sm font-semibold tracking-[0.4em] text-[#1F2937] outline-none transition placeholder:tracking-normal placeholder:font-normal placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="text-xs font-medium text-green-600">
              {message}
            </p>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-xs font-semibold text-[#9D0A0E] transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E7EB] bg-[#F8F9FA] px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isVerifying}
            className="swu-press rounded-md border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#9CA3AF] hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="swu-press rounded-md bg-[#9D0A0E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
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
    <div className="swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex flex-col items-center px-6 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF1F1] text-[#9D0A0E]">
            <Check size={24} strokeWidth={2.5} />
          </div>

          <h2 className="mt-4 text-base font-bold text-[#1F2937]">
            PIN Created
          </h2>

          <p className="mt-2 max-w-xs text-xs leading-5 text-[#4B5563]">
            Your security PIN has been successfully created. You can now use
            it for protected kiosk and department operations.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="swu-press mt-6 rounded-md bg-[#9D0A0E] px-6 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-md hover:shadow-[#9D0A0E]/25"
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
  const [systemName, setSystemName] = useState(
    'SWUMed Queuing System'
  );

  const [accentColor, setAccentColor] = useState(
    ACCENT_PRESETS[0]
  );

  const [themeMode, setThemeMode] = useState('light');
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
  const [clockFormat, setClockFormat] = useState(
    CLOCK_FORMATS[0]
  );

  const [showChangePassword, setShowChangePassword] =
    useState(false);

  const [copied, setCopied] = useState(false);

  function handleCopyName() {
    navigator.clipboard
      ?.writeText(systemName)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }

  return (
    <div className="space-y-5">

      {/* =====================================================
          PAGE TITLE
      ===================================================== */}

      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">
          Settings
        </h1>

        <p className="mt-0.5 text-xs text-[#4B5563]">
          Manage system preferences, security, appearance, and localization.
        </p>
      </div>

      {/* =====================================================
          BRANDING & IDENTITY
      ===================================================== */}

      <SettingsSection
        icon={Palette}
        title="Branding &amp; Identity"
        subtitle="Customize your brand presence across patient kiosks, queue trackers, and staff monitors."
        badge="White label"
      >

        {/* SYSTEM NAME */}

        <div>
          <FieldLabel>System Name</FieldLabel>

          <div className="relative">
            <input
              id="system-name"
              type="text"
              value={systemName}
              onChange={(e) =>
                setSystemName(e.target.value)
              }
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 pr-10 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
            />

            <button
              type="button"
              onClick={handleCopyName}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
              aria-label="Copy system name"
              title={copied ? 'Copied' : 'Copy'}
            >
              {copied ? (
                <Check size={16} className="text-emerald-600" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>

          <Hint>
            Displayed on browser titles, kiosk welcome screens, and physical
            thermal ticket headers.
          </Hint>
        </div>

        {/* SYSTEM LOGO */}

        <div className="mt-6">
          <FieldLabel>System Logo</FieldLabel>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] px-4 py-3">

            <div className="flex items-center gap-4">
              <img
                src={Logo}
                alt="Current brand logo"
                className="h-7 w-auto object-contain"
              />

              <div>
                <p className="flex items-center gap-2 text-xs font-semibold text-[#1F2937]">
                  Current Brand Logo

                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/30">
                    Active
                  </span>
                </p>

                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  PNG or SVG, max 2MB
                </p>
              </div>
            </div>

            <label className="swu-press flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]">
              <Upload size={14} />
              Upload New Logo

              <input
                type="file"
                accept="image/png,image/svg+xml"
                className="hidden"
              />
            </label>

          </div>
        </div>

        {/* PRIMARY ACCENT COLOR */}

        <div className="mt-6">
          <FieldLabel>Primary Accent Color</FieldLabel>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2">
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs font-semibold uppercase text-[#1F2937]">
                Hex {accentColor}
              </span>
            </div>

            <div className="flex items-center gap-2 border-l border-[#E5E7EB] pl-4">
              <span className="text-xs text-[#4B5563]">Presets:</span>

              {ACCENT_PRESETS.map((preset) => {
                const isSelected = accentColor === preset;

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAccentColor(preset)}
                    aria-label={`Accent ${preset}`}
                    aria-pressed={isSelected}
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
                      isSelected
                        ? 'ring-2 ring-[#9D0A0E] ring-offset-2'
                        : 'ring-1 ring-black/10 hover:ring-[#9CA3AF]'
                    }`}
                    style={{ backgroundColor: preset }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Hint>
            Applies to primary action buttons, active navigation markers, ticket
            highlighted badges, and key queue alerts.
          </Hint>
        </div>
    </SettingsSection>

      {/* =====================================================
          PASSWORD & SECURITY
      ===================================================== */}

      <SettingsSection
        icon={ShieldCheck}
        title="Password &amp; Security"
        subtitle="Manage your account password and Admin PIN."
      >
        <div className="divide-y divide-[#E5E7EB]">

          {/* PASSWORD */}

          <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
            <div>
              <p className="text-sm font-bold text-[#1F2937]">Password</p>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                Keep your account secure by regularly updating your password.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="swu-press flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition-colors hover:border-[#F0DADA] hover:bg-[#FBF1F1] hover:text-[#9D0A0E]"
            >
              <KeyRound size={14} />
              Change Password
            </button>
          </div>

          {/* SECURITY PIN */}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                Security PIN

                {pinConfigured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-600/30">
                    <Check size={10} strokeWidth={3} />
                    PIN is set
                  </span>
                )}
              </p>

              <p className="mt-0.5 text-xs text-[#4B5563]">
                Used to authorize protected system actions such as resetting records.
              </p>

              {pinError && (
                <p className="mt-1.5 text-xs font-medium text-[#9D0A0E]">{pinError}</p>
              )}
            </div>

            <button
              type="button"
              disabled={pinStatusLoading}
              onClick={() => setActiveModal('createPin')}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] transition hover:bg-[#F1F3F5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LockKeyhole size={14} />
              {pinStatusLoading
                ? 'Loading...'
                : pinConfigured
                  ? 'Change PIN'
                  : 'Set PIN'}
            </button>
          </div>

        </div>
      </SettingsSection>

      {/* =====================================================
          APPEARANCE
      ===================================================== */}

      <SettingsSection
        icon={Monitor}
        title="Appearance"
        subtitle="Choose default theme settings for admin and kiosk interfaces."
      >
        <FieldLabel>Theme Mode</FieldLabel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_MODES.map(({ key, label, caption, icon: Icon }) => {
            const isSelected = themeMode === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setThemeMode(key)}
                aria-pressed={isSelected}
                className={`rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#9D0A0E] ring-1 ring-[#9D0A0E]'
                    : 'border-[#E5E7EB] hover:border-[#9CA3AF]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon size={14} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
                    <div>
                      <p className="text-xs font-bold text-[#1F2937]">{label}</p>
                      <p className="mt-0.5 text-xs text-[#9CA3AF]">{caption}</p>
                    </div>
                  </div>

                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? 'border-[#9D0A0E]' : 'border-[#D1D5DB]'
                    }`}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-[#9D0A0E]" />}
                  </span>
                </div>

                <div
                  aria-hidden="true"
                  className={`mt-3 overflow-hidden rounded-md border border-[#E5E7EB] px-3 py-3 ${
                    key === 'dark'
                      ? 'bg-[#1F2937]'
                      : key === 'system'
                        ? 'bg-gradient-to-r from-white to-[#1F2937]'
                        : 'bg-white'
                  }`}
                >
                  <span className={`block h-2 w-16 rounded-sm ${key === 'dark' ? 'bg-white/70' : 'bg-[#4B5563]'}`} />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-3 w-8 rounded-sm" style={{ backgroundColor: accentColor }} />
                    <span className={`h-3 flex-1 rounded-sm ${key === 'dark' ? 'bg-white/20' : 'bg-[#E5E7EB]'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* =====================================================
          LANGUAGE & REGIONAL SETTINGS
      ===================================================== */}

      <SettingsSection
        icon={Globe}
        title="Language &amp; Regional Settings"
        subtitle="Configure default language and regional time displays across touchpoints."
      >
        <div>
          <FieldLabel>Primary Language</FieldLabel>

          <div className="flex flex-wrap items-center gap-2">
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang;

              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[#B34C4C] text-white'
                      : 'border border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F1F3F5]'
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                  {lang}
                </button>
              );
            })}
          </div>

          <Hint>
            Sets the initial default locale for patient kiosk prompts and printed slips.
          </Hint>
        </div>

        <div className="mt-5 border-t border-[#E5E7EB] pt-5">
          <FieldLabel>Clock Format</FieldLabel>

          <select
            value={clockFormat}
            onChange={(e) => setClockFormat(e.target.value)}
            aria-label="Clock format"
            className="w-full max-w-xs rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20"
          >
            {CLOCK_FORMATS.map((format) => (
              <option key={format} value={format}>{format}</option>
            ))}
          </select>

          <Hint>
            Applied to TV Queue displays, timestamp audits, and ticket issuance times.
          </Hint>
        </div>
      </SettingsSection>

      {/* Modals */}
      {showChangePassword && (
        <ChangePasswordModal
          onSuccess={() => setShowChangePassword(false)}
        />
      )}

      {activeModal === 'department' && (
        <DepartmentCustomizationModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'theme' && (
        <ThemeModal
          onClose={() => setActiveModal(null)}
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