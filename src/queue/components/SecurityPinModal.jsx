import { useEffect, useRef, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  Mail,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

import { auth } from '../../firebase';
import {
  requestSecurityPinVerification,
  verifySecurityPinCode,
  validateSecurityPin,
} from '../services/backendApi';

export const SECURITY_PIN_LENGTH = 6;
const CODE_LENGTH = 6;

/* ---------------------------------------------------------------
   Reads "is a PIN set?" from the status response without assuming
   one exact field name - the endpoint returns the whole envelope.
--------------------------------------------------------------- */
export function readPinIsSet(statusResponse) {
  const d = statusResponse?.data ?? statusResponse ?? {};

  const value =
    d.isSet ??
    d.is_set ??
    d.hasPin ??
    d.has_pin ??
    d.pinSet ??
    d.pin_set ??
    d.configured ??
    statusResponse?.isSet ??
    statusResponse?.hasPin;

  return value === true || value === 1 || value === 'true';
}

/* ---------------------------------------------------------------
   Digit boxes over one real input: typing, backspace and paste
   all behave normally.
--------------------------------------------------------------- */
function DigitInput({
  id,
  value,
  onChange,
  length,
  disabled,
  autoFocus,
  secret = true,
  label,
}) {
  const [show, setShow] = useState(false);

  const digits = Array.from(
    { length },
    (_, index) => value[index] ?? ''
  );

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none flex items-center gap-2 rounded-lg border-2 border-[#E5E7EB] p-2"
      >
        {digits.map((digit, index) => (
          <span
            key={index}
            className={`flex h-10 flex-1 items-center justify-center rounded-md border text-lg font-bold text-[#1F2937] ${
              index === value.length && !disabled
                ? 'border-[#9D0A0E] bg-white'
                : 'border-[#E5E7EB] bg-white'
            }`}
          >
            {digit === ''
              ? ''
              : secret && !show
                ? '\u2022'
                : digit}
          </span>
        ))}

        {secret && (
          <span className="px-1 text-[#4B5563]">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </span>
        )}
      </div>

      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) =>
          onChange(
            event.target.value
              .replace(/\D/g, '')
              .slice(0, length)
          )
        }
        className="absolute inset-0 h-full w-full cursor-pointer rounded-lg opacity-0 disabled:cursor-not-allowed"
        aria-label={label}
      />

      {secret && (
        <button
          type="button"
          onClick={() => setShow((previous) => !previous)}
          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
          aria-label={show ? 'Hide' : 'Show'}
        />
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function Header({ icon: Icon, title, description, onClose, disabled, tone = 'red' }) {
  return (
    <div className="relative px-7 pb-5 pt-7 text-center">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={disabled}
          className="absolute right-5 top-5 rounded text-[#9CA3AF] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30 disabled:opacity-40"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}

      <div
        className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl ${
          tone === 'green'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-[#FBF1F1] text-[#9D0A0E]'
        }`}
      >
        <Icon size={20} />
      </div>

      <h2 className="mt-4 text-lg font-bold text-[#1F2937]">{title}</h2>

      {description && (
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-[#4B5563]">
          {description}
        </p>
      )}
    </div>
  );
}

function ErrorLine({ children }) {
  if (!children) return null;

  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-[#9D0A0E]">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

function PrimaryButton({ children, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function PrivacyNote() {
  return (
    <p className="mt-3 flex items-center gap-2 rounded-lg bg-[#F8F9FA] px-3 py-2.5 text-xs text-[#4B5563]">
      <ShieldCheck size={14} className="shrink-0" />
      Keep your Security PIN private. Do not share it with other users.
    </p>
  );
}

function ProtocolFooter() {
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-[#9CA3AF]">
      <Lock size={10} />
      256-bit encrypted hospital administration protocol
    </p>
  );
}

/* =========================================================
   SECURITY PIN MODAL

   mode="setup"  new PIN -> emailed code -> saved -> success
   mode="verify" confirm the PIN before a protected action

   onSuccess() fires only after the server has confirmed.
========================================================= */

export default function SecurityPinModal({
  mode = 'setup',
  title,
  description,
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState(mode === 'verify' ? 'verify' : 'pin');

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [configuredAt, setConfiguredAt] = useState(null);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape' && !busy) closeRef.current?.();
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [busy]);

  function currentUser() {
    const user = auth.currentUser;

    if (!user) {
      setError('Your session has expired. Please log in again.');
      return null;
    }

    return user;
  }

  /* ----- setup: step 1, choose the PIN, then request a code ----- */

  async function submitNewPin() {
    setError(null);

    if (pin.length !== SECURITY_PIN_LENGTH) {
      setError(`Please enter a ${SECURITY_PIN_LENGTH}-digit PIN. Only digits (0-9) are accepted.`);
      return;
    }

    if (pin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }

    const user = currentUser();
    if (!user) return;

    setBusy(true);

    try {
      await requestSecurityPinVerification(user);
      setCode('');
      setStep('code');
    } catch (requestError) {
      setError(requestError?.message || 'Failed to send the verification code.');
    } finally {
      setBusy(false);
    }
  }

  /* ----- setup: step 2, emailed code saves the PIN ----- */

  async function submitCode() {
    setError(null);

    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code sent to your email.`);
      return;
    }

    const user = currentUser();
    if (!user) return;

    setBusy(true);

    try {
      const result = await verifySecurityPinCode(user, code, pin);

      setConfiguredAt(
        result?.data?.configured_at ||
          result?.data?.updated_at ||
          new Date().toISOString()
      );

      setPin('');
      setConfirmPin('');
      setCode('');
      setStep('done');
    } catch (verifyError) {
      const remaining = verifyError?.attemptsRemaining;

      setError(
        (verifyError?.message || 'That code is incorrect.') +
          (Number.isFinite(remaining)
            ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : '')
      );

      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setError(null);

    const user = currentUser();
    if (!user) return;

    setBusy(true);

    try {
      await requestSecurityPinVerification(user);
      setCode('');
    } catch (requestError) {
      setError(requestError?.message || 'Failed to resend the code.');
    } finally {
      setBusy(false);
    }
  }

  /* ----- verify: before a protected action ----- */

  async function submitVerify() {
    setError(null);

    if (pin.length !== SECURITY_PIN_LENGTH) {
      setError(`Please enter your ${SECURITY_PIN_LENGTH}-digit Security PIN.`);
      return;
    }

    const user = currentUser();
    if (!user) return;

    setBusy(true);

    try {
      const result = await validateSecurityPin(user, pin);
      setPin('');
      onSuccess?.(result);
    } catch (validateError) {
      setError(validateError?.message || 'That PIN is incorrect. Please try again.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     SCREENS
  ======================================================= */

  if (step === 'done') {
    return (
      <Shell>
        <Header
          icon={Check}
          tone="green"
          title="Security PIN Set Successfully"
          description="Your Security PIN can now be used to authorize protected system actions."
        />

        <div className="px-7 pb-6">
          <div className="flex items-start gap-2 rounded-lg bg-[#F8F9FA] px-3 py-3">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-[#1F2937]">
                Protected Actions Active: Record Resets &amp; High-Level System Overrides
              </p>
              {configuredAt && (
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  Configured on {new Date(configuredAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onSuccess?.();
              onClose?.();
            }}
            className="mt-5 w-full rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#7D080B]"
          >
            Done
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF]">
            <RotateCw size={11} />
            You can update your PIN anytime in Settings.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === 'code') {
    return (
      <Shell>
        <Header
          icon={Mail}
          title="Verification Code"
          description="We sent a 6-digit verification code to your registered email address."
          onClose={onClose}
          disabled={busy}
        />

        <div className="px-7 pb-6">
          <DigitInput
            id="security-pin-code"
            value={code}
            onChange={setCode}
            length={CODE_LENGTH}
            disabled={busy}
            autoFocus
            secret={false}
            label="Verification code"
          />

          <ErrorLine>{error}</ErrorLine>

          <p className="mt-3 text-center text-xs text-[#4B5563]">
            Didn&rsquo;t receive the code?{' '}
            <button
              type="button"
              onClick={resendCode}
              disabled={busy}
              className="font-semibold text-[#9D0A0E] hover:underline disabled:opacity-50"
            >
              Resend Code
            </button>
          </p>

          <PrimaryButton
            onClick={submitCode}
            disabled={busy || code.length !== CODE_LENGTH}
          >
            {busy ? 'Please wait...' : 'Verify Code'}
            {!busy && <ArrowRight size={16} />}
          </PrimaryButton>

          <SecondaryButton
            onClick={() => {
              setError(null);
              setStep('pin');
            }}
            disabled={busy}
          >
            Back
          </SecondaryButton>
        </div>
      </Shell>
    );
  }

  if (step === 'verify') {
    return (
      <Shell>
        <Header
          icon={ShieldAlert}
          title={title || 'Enter Security PIN'}
          description={description || 'Enter your Security PIN to authorize this action.'}
          onClose={onClose}
          disabled={busy}
        />

        <div className="px-7 pb-6">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="security-pin-verify" className="text-sm font-semibold text-[#1F2937]">
              Security PIN<span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>
            <span className="text-xs uppercase tracking-wide text-[#9CA3AF]">
              {SECURITY_PIN_LENGTH} digits
            </span>
          </div>

          <DigitInput
            id="security-pin-verify"
            value={pin}
            onChange={setPin}
            length={SECURITY_PIN_LENGTH}
            disabled={busy}
            autoFocus
            label="Security PIN"
          />

          <ErrorLine>{error}</ErrorLine>
          <PrivacyNote />

          <PrimaryButton
            onClick={submitVerify}
            disabled={busy || pin.length !== SECURITY_PIN_LENGTH}
          >
            {busy ? 'Please wait...' : 'Verify & Continue'}
            {!busy && <ArrowRight size={16} />}
          </PrimaryButton>

          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
        </div>
      </Shell>
    );
  }

  /* ----- step === 'pin' (setup) ----- */

  return (
    <Shell>
      <Header
        icon={ShieldAlert}
        title={title || 'Set Up Security PIN'}
        description={
          description ||
          'Create a Security PIN to authorize protected system actions such as resetting records.'
        }
        onClose={onClose}
        disabled={busy}
      />

      <div className="px-7 pb-6">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="security-pin-new" className="text-sm font-semibold text-[#1F2937]">
            New Security PIN<span className="ml-0.5 text-[#9D0A0E]">*</span>
          </label>
          <span className="text-xs uppercase tracking-wide text-[#9CA3AF]">
            {SECURITY_PIN_LENGTH} digits
          </span>
        </div>

        <DigitInput
          id="security-pin-new"
          value={pin}
          onChange={setPin}
          length={SECURITY_PIN_LENGTH}
          disabled={busy}
          autoFocus
          label="New Security PIN"
        />

        <div className="mb-1.5 mt-4 flex items-baseline justify-between">
          <label htmlFor="security-pin-confirm" className="text-sm font-semibold text-[#1F2937]">
            Confirm Security PIN<span className="ml-0.5 text-[#9D0A0E]">*</span>
          </label>
          <span className="text-xs uppercase tracking-wide text-[#9CA3AF]">
            Match new PIN
          </span>
        </div>

        <DigitInput
          id="security-pin-confirm"
          value={confirmPin}
          onChange={setConfirmPin}
          length={SECURITY_PIN_LENGTH}
          disabled={busy}
          label="Confirm Security PIN"
        />

        <ErrorLine>{error}</ErrorLine>
        <PrivacyNote />

        <PrimaryButton
          onClick={submitNewPin}
          disabled={
            busy ||
            pin.length !== SECURITY_PIN_LENGTH ||
            confirmPin.length !== SECURITY_PIN_LENGTH
          }
        >
          {busy ? 'Sending code...' : 'Set Up PIN'}
          {!busy && <ArrowRight size={16} />}
        </PrimaryButton>

        <SecondaryButton onClick={onClose} disabled={busy}>
          Cancel
        </SecondaryButton>

        <ProtocolFooter />
      </div>
    </Shell>
  );
}
