import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowRight,
  Mail,
  Info,
  Clock,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

import { auth } from '../../firebase';
import {
  requestSecurityPinVerification,
  verifySecurityPinCode,
  validateSecurityPin,
} from '../services/backendApi';

/*
 * Security PIN
 *
 * Setting or changing a PIN runs through the steps in the design:
 *
 *   email  ->  emailed code  ->  new PIN  ->  confirm  ->  done
 *
 * The server checks the code and stores the PIN in one call, so the code is
 * submitted together with the new PIN at the confirm step. A wrong code
 * therefore surfaces at the end, and the person is returned to the code
 * screen with the attempts they have left.
 *
 * mode="verify" is the short version: confirm an existing PIN before a
 * protected action such as resetting records.
 */

export const SECURITY_PIN_LENGTH = 6;
const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

/* Reads "is a PIN set?" without assuming one exact field name. */
export function readPinIsSet(statusResponse) {
  const data = statusResponse?.data ?? statusResponse ?? {};

  const value =
    statusResponse?.configured ??
    data.configured ??
    data.isSet ??
    data.is_set ??
    data.hasPin ??
    data.has_pin ??
    data.pinSet ??
    data.pin_set;

  return value === true || value === 1 || value === 'true';
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  const head = name.slice(0, 1);
  return `${head}${'\u2022'.repeat(Math.max(name.length - 1, 3))}@${domain}`;
}

/* ---------------------------------------------------------------
   Digit boxes over one real input
--------------------------------------------------------------- */

function DigitInput({ id, value, onChange, length, disabled, autoFocus, secret, label, invalid }) {
  const [show, setShow] = useState(false);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className={`pointer-events-none flex items-center gap-1.5 rounded-lg border-2 p-1.5 ${
          invalid ? 'border-[#9D0A0E]' : 'border-[#E5E7EB]'
        }`}
      >
        {digits.map((digit, index) => (
          <span
            key={index}
            className={`flex h-10 flex-1 items-center justify-center rounded-md border text-base font-bold text-[#1F2937] ${
              index === value.length && !disabled
                ? 'border-[#9D0A0E] bg-white'
                : 'border-[#E5E7EB] bg-white'
            }`}
          >
            {digit === '' ? '' : secret && !show ? '\u2022' : digit}
          </span>
        ))}

        {secret && (
          <span className="px-1 text-[#4B5563]">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
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
          onChange(event.target.value.replace(/\D/g, '').slice(0, length))
        }
        className="absolute inset-0 h-full w-full cursor-pointer rounded-lg opacity-0 disabled:cursor-not-allowed"
        aria-label={label}
      />

      {secret && (
        <button
          type="button"
          onClick={() => setShow((previous) => !previous)}
          className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
          aria-label={show ? 'Hide' : 'Show'}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Shared pieces
--------------------------------------------------------------- */

function Shell({ children }) {
  return (
    <div className="swu-enter-fade fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 py-6">
      <div className="swu-pop w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function Head({ icon: Icon, title, description, onClose, disabled, tone = 'red' }) {
  return (
    <div className="relative px-7 pb-4 pt-7 text-center">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={disabled}
          aria-label="Close"
          className="swu-press absolute right-5 top-5 rounded text-[#9CA3AF] transition-colors hover:text-[#1F2937] disabled:opacity-40"
        >
          <X size={16} />
        </button>
      )}

      <div
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === 'green'
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-[#FBF1F1] text-[#9D0A0E]'
        }`}
      >
        <Icon size={18} />
      </div>

      <h2 className="mt-3 text-base font-bold text-[#1F2937]">{title}</h2>

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
    <p className="mt-2 flex items-start gap-1.5 text-xs text-[#9D0A0E]">
      <AlertTriangle size={11} className="mt-0.5 shrink-0" />
      {children}
    </p>
  );
}

function Primary({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="swu-press mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Secondary({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="swu-press mt-2 w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-medium text-[#4B5563] transition-colors hover:bg-[#F1F3F5] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/* =========================================================
   SECURITY PIN MODAL
========================================================= */

export default function SecurityPinModal({
  mode = 'setup',
  isChange = false,
  onClose,
  onSuccess,
}) {
  const accountEmail = auth.currentUser?.email || '';

  const [step, setStep] = useState(mode === 'verify' ? 'verify' : 'email');

  const [email, setEmail] = useState(accountEmail);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [configuredAt, setConfiguredAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape' && !busy) closeRef.current?.();
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [busy]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const currentUser = useCallback(() => {
    const user = auth.currentUser;
    if (!user) {
      setError('Your session has expired. Please log in again.');
      return null;
    }
    return user;
  }, []);

  /* ----- step 1: send the code ----- */

  async function sendCode(next = 'code') {
    setError(null);

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (
      accountEmail &&
      email.trim().toLowerCase() !== accountEmail.toLowerCase()
    ) {
      setError('That does not match your registered email address.');
      return;
    }

    const user = currentUser();
    if (!user) return;

    setBusy(true);

    try {
      await requestSecurityPinVerification(user);
      setCode('');
      setSecondsLeft(RESEND_SECONDS);
      setStep(next);
    } catch (requestError) {
      setError(requestError?.message || 'Failed to send the verification code.');
    } finally {
      setBusy(false);
    }
  }

  /* ----- final step: the server checks the code and stores the PIN ----- */

  async function commit() {
    setError(null);

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
    } catch (commitError) {
      const remaining = commitError?.attemptsRemaining;

      setError(
        (commitError?.message || 'That verification code is incorrect.') +
          (Number.isFinite(remaining)
            ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : '')
      );

      // The code is what failed - send them back to enter it again.
      setCode('');
      setStep('code');
    } finally {
      setBusy(false);
    }
  }

  /* ----- verify mode ----- */

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
     STEP 5 — success
  ======================================================= */

  if (step === 'done') {
    return (
      <Shell>
        <Head
          icon={Check}
          tone="green"
          title="Security PIN Set Successfully"
          description="Your Security PIN can now be used to authorize protected system actions."
        />

        <div className="px-7 pb-7">
          <div className="flex items-start gap-2 rounded-lg bg-[#F8F9FA] px-3 py-3 text-left">
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
            className="swu-press mt-5 w-full rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#7D080B]"
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

  /* =======================================================
     STEP 4 — are you sure
  ======================================================= */

  if (step === 'confirm') {
    return (
      <Shell>
        <Head
          icon={ShieldAlert}
          title={isChange ? 'Change Security PIN?' : 'Set Security PIN?'}
          description={
            isChange
              ? 'Are you sure you want to change your security PIN? Make sure you remember your new PIN before continuing.'
              : 'Make sure you remember your new PIN before continuing.'
          }
          onClose={onClose}
          disabled={busy}
        />

        <div className="px-7 pb-7">
          <ErrorLine>{error}</ErrorLine>

          <Primary onClick={commit} disabled={busy}>
            {busy ? 'Please wait...' : 'Confirm Change'}
            {!busy && <ArrowRight size={15} />}
          </Primary>

          <Secondary onClick={() => setStep('pin')} disabled={busy}>
            Cancel
          </Secondary>
        </div>
      </Shell>
    );
  }

  /* =======================================================
     STEP 3 — choose the PIN
  ======================================================= */

  if (step === 'pin') {
    const matches =
      pin.length === SECURITY_PIN_LENGTH &&
      confirmPin.length === SECURITY_PIN_LENGTH;

    return (
      <Shell>
        <Head
          icon={ShieldAlert}
          title="Set Up Security PIN"
          description="Create an Security PIN to authorize protected system actions such as resetting records."
          onClose={onClose}
          disabled={busy}
        />

        <div className="px-7 pb-7">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="new-pin" className="text-xs font-bold text-[#1F2937]">
              New Security PIN
              <span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>
            <span className="text-xs uppercase tracking-wide text-[#9CA3AF]">
              6 digits
            </span>
          </div>

          <DigitInput
            id="new-pin"
            value={pin}
            onChange={setPin}
            length={SECURITY_PIN_LENGTH}
            disabled={busy}
            autoFocus
            secret
            label="New Security PIN"
            invalid={Boolean(error)}
          />

          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[#9D0A0E]">
            <Info size={11} className="mt-0.5 shrink-0" />
            Please enter a 6-digit PIN. Only digits (0-9) are accepted.
          </p>

          <div className="mb-1.5 mt-3 flex items-baseline justify-between">
            <label htmlFor="confirm-pin" className="text-xs font-bold text-[#1F2937]">
              Confirm Security PIN
              <span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>
            <span className="text-xs uppercase tracking-wide text-[#9CA3AF]">
              Match new PIN
            </span>
          </div>

          <DigitInput
            id="confirm-pin"
            value={confirmPin}
            onChange={setConfirmPin}
            length={SECURITY_PIN_LENGTH}
            disabled={busy}
            secret
            label="Confirm Security PIN"
          />

          <p className="mt-3 flex items-center gap-2 rounded-lg bg-[#F8F9FA] px-3 py-2.5 text-xs text-[#4B5563]">
            <ShieldCheck size={13} className="shrink-0" />
            Keep your Security PIN private. Do not share it with other users.
          </p>

          <ErrorLine>{error}</ErrorLine>

          <Primary
            onClick={() => {
              if (pin !== confirmPin) {
                setError('The two PINs do not match.');
                return;
              }
              setError(null);
              setStep('confirm');
            }}
            disabled={busy || !matches}
          >
            {isChange ? 'Change PIN' : 'Set Up PIN'}
            <ArrowRight size={15} />
          </Primary>

          <Secondary onClick={onClose} disabled={busy}>
            Cancel
          </Secondary>
        </div>
      </Shell>
    );
  }

  /* =======================================================
     STEP 2 — the emailed code
  ======================================================= */

  if (step === 'code') {
    return (
      <Shell>
        <Head
          icon={ShieldAlert}
          title="Verify Your Email"
          description="We sent a 6-digit verification code to your registered email address."
          onClose={onClose}
          disabled={busy}
        />

        <div className="px-7 pb-7">
          <p className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1 text-xs text-[#4B5563]">
            <Mail size={11} />
            {maskEmail(accountEmail || email)}
          </p>

          <DigitInput
            id="pin-code"
            value={code}
            onChange={setCode}
            length={CODE_LENGTH}
            disabled={busy}
            autoFocus
            secret={false}
            label="Verification code"
            invalid={Boolean(error)}
          />

          <ErrorLine>{error}</ErrorLine>

          <p className="mt-3 text-center text-xs text-[#9CA3AF]">
            Didn&rsquo;t receive the code?
          </p>

          <p className="mt-1 flex items-center justify-center gap-2 text-xs text-[#4B5563]">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              Resend code in{' '}
              <span className="font-semibold text-[#1F2937]">
                {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                {String(secondsLeft % 60).padStart(2, '0')}
              </span>
            </span>

            <button
              type="button"
              onClick={() => sendCode('code')}
              disabled={busy || secondsLeft > 0}
              className="font-semibold text-[#9D0A0E] transition-colors hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline"
            >
              Resend Code
            </button>
          </p>

          <Primary
            onClick={() => {
              setError(null);
              setStep('pin');
            }}
            disabled={busy || code.length !== CODE_LENGTH}
          >
            Verify Code
            <ArrowRight size={15} />
          </Primary>

          <Secondary onClick={onClose} disabled={busy}>
            Cancel
          </Secondary>
        </div>
      </Shell>
    );
  }

  /* =======================================================
     verify mode — confirm an existing PIN
  ======================================================= */

  if (step === 'verify') {
    return (
      <Shell>
        <Head
          icon={ShieldAlert}
          title="Enter Security PIN"
          description="Enter your Security PIN to authorize this action."
          onClose={onClose}
          disabled={busy}
        />

        <div className="px-7 pb-7">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="verify-pin" className="text-xs font-bold text-[#1F2937]">
              Security PIN
              <span className="ml-0.5 text-[#9D0A0E]">*</span>
            </label>
            <span className="text-xs uppercase tracking-wide text-[#9CA3AF]">
              6 digits
            </span>
          </div>

          <DigitInput
            id="verify-pin"
            value={pin}
            onChange={setPin}
            length={SECURITY_PIN_LENGTH}
            disabled={busy}
            autoFocus
            secret
            label="Security PIN"
            invalid={Boolean(error)}
          />

          <ErrorLine>{error}</ErrorLine>

          <p className="mt-3 flex items-center gap-2 rounded-lg bg-[#F8F9FA] px-3 py-2.5 text-xs text-[#4B5563]">
            <ShieldCheck size={13} className="shrink-0" />
            Keep your Security PIN private. Do not share it with other users.
          </p>

          <Primary
            onClick={submitVerify}
            disabled={busy || pin.length !== SECURITY_PIN_LENGTH}
          >
            {busy ? 'Please wait...' : 'Verify & Continue'}
            {!busy && <ArrowRight size={15} />}
          </Primary>

          <Secondary onClick={onClose} disabled={busy}>
            Cancel
          </Secondary>
        </div>
      </Shell>
    );
  }

  /* =======================================================
     STEP 1 — email
  ======================================================= */

  return (
    <Shell>
      <Head
        icon={ShieldAlert}
        title={isChange ? 'Change Security PIN' : 'Set Up Security PIN'}
        description="For your security, we'll send a verification code to your registered email address."
        onClose={onClose}
        disabled={busy}
      />

      <div className="px-7 pb-7">
        <label htmlFor="pin-email" className="mb-1.5 block text-xs font-bold text-[#1F2937]">
          Email
        </label>

        <div className="relative">
          <Mail
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
          />

          <input
            id="pin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            autoComplete="email"
            disabled={busy}
            className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
          />
        </div>

        <ErrorLine>{error}</ErrorLine>

        <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#F8F9FA] px-3 py-2.5 text-xs text-[#4B5563]">
          <Info size={13} className="mt-0.5 shrink-0 text-[#9D0A0E]" />
          Authorized admin verification code remains valid for 10 minutes. Check
          spam folder if not received.
        </p>

        <Primary onClick={() => sendCode('code')} disabled={busy || !email.trim()}>
          {busy ? 'Sending...' : 'Send Verification Code'}
          {!busy && <ArrowRight size={15} />}
        </Primary>

        <Secondary onClick={onClose} disabled={busy}>
          Cancel
        </Secondary>
      </div>
    </Shell>
  );
}