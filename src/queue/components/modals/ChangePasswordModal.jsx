import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Info,
  Lock,
  LockKeyhole,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';

// Email + OTP + reset-token change-password flow shared by every role's
// Settings page. The backend identifies the account purely by email
// (see server/services/passwordResetService.js), so this modal has no
// idea whether it's being opened from Admin or Staff settings.
const CHANGE_PASSWORD_API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CHANGE_PASSWORD_RULES = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (value) => value.length >= 8,
  },
  {
    key: 'upper',
    label: 'Include at least one uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: 'number',
    label: 'Include at least one number',
    test: (value) => /\d/.test(value),
  },
  {
    key: 'special',
    label: 'Include at least one special character',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

function IconButton({ onClick, label, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-5 w-5 items-center justify-center rounded text-[#98A2B3] transition hover:bg-[#F8F9FA] hover:text-[#344054] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ModalShell({ children, onClose, showClose = true, width = '520' }) {
  const widthClass =
    width === '430'
      ? 'max-w-[430px]'
      : width === '380'
        ? 'max-w-[380px]'
        : 'max-w-[520px]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 py-6">
      <div className={`relative w-full ${widthClass} max-h-[calc(100vh-48px)] overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-2xl`}>
        {showClose && (
          <div className="absolute right-5 top-5 z-10">
            <IconButton onClick={onClose} label="Close">
              <X size={20} strokeWidth={1.7} />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function StepLabel({ current, descriptor }) {
  return (
    <div className="flex items-center gap-2 text-[11px] leading-none tracking-[0.04em]">
      <span className="rounded-md bg-[#FBEAEA] px-3.5 py-1.5 font-bold text-[#9D0A0E]">
        STEP {current} OF 3
      </span>
      <span className="font-medium uppercase text-[#667085]">
        • {descriptor}
      </span>
    </div>
  );
}

function ProtocolFooter() {
  return (
    <div className="flex items-center justify-center gap-1.5 border-t border-[#F0F0F0] px-8 pb-5 pt-3 text-center text-[8px] uppercase tracking-[0.09em] text-[#A4A9B2]">
      <Lock size={9} />
      256-BIT ENCRYPTED HOSPITAL ADMINISTRATION PROTOCOL
    </div>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-[10px] leading-4 text-[#9D0A0E]">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] px-4 text-[15px] font-semibold text-white transition hover:bg-[#7d0809] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 h-[50px] w-full rounded-md border border-[#D0D5DD] bg-white px-4 text-[15px] font-medium text-[#344054] transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function PasswordField({ id, label, value, onChange, disabled, autoFocus }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10px] font-semibold text-[#1F2937]">
        {label} <span className="text-[#9D0A0E]">*</span>
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          autoFocus={autoFocus}
          disabled={disabled}
          className="h-10 w-full rounded-md border border-[#D0D5DD] bg-white px-3 pr-10 text-[12px] text-[#1F2937] outline-none transition placeholder:text-[#98A2B3] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShow((previous) => !previous)}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-[#667085] hover:text-[#344054] disabled:opacity-40"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function PasswordRules({ results }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5">
      <p className="mb-2 text-[10px] font-bold text-[#1F2937]">
        Password requirements:
      </p>
      <ul className="space-y-1.5">
        {results.map((rule) => (
          <li
            key={rule.key}
            className={`flex items-center gap-2 text-[10px] leading-4 ${
              rule.ok ? 'text-[#18824B]' : 'text-[#667085]'
            }`}
          >
            {rule.ok ? (
              <CheckCircle2 size={12} className="shrink-0 text-[#13A565]" />
            ) : (
              <Circle size={12} className="shrink-0 text-[#A4A9B2]" />
            )}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerificationCodeBoxes({ value, onChange, ariaLabel, autoFocus = false }) {
  const refs = useRef([]);

  function updateDigits(index, rawValue) {
    const digits = String(rawValue || '').replace(/\D/g, '');

    if (!digits) {
      const next = Array.from({ length: 6 }, (_, i) => value[i] || '');
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    const next = Array.from({ length: 6 }, (_, i) => value[i] || '');

    digits
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });

    onChange(next.join('').slice(0, 6));
    refs.current[Math.min(5, index + digits.length)]?.focus();
  }

  function handlePaste(event, index) {
    event.preventDefault();

    const pasted = event.clipboardData
      ?.getData('text')
      ?.replace(/\D/g, '')
      .slice(0, 6);

    if (!pasted) return;

    const next = Array.from({ length: 6 }, (_, i) => value[i] || '');

    pasted
      .slice(0, 6 - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });

    onChange(next.join('').slice(0, 6));

    refs.current[Math.min(5, index + pasted.length - 1)]?.focus();
  }

  function handleKeyDown(event, index) {
    const next = Array.from({ length: 6 }, (_, i) => value[i] || '');

    if (event.key === 'Backspace') {
      if (next[index]) {
        event.preventDefault();
        next[index] = '';
        onChange(next.join(''));
        return;
      }

      if (index > 0) {
        event.preventDefault();
        next[index - 1] = '';
        onChange(next.join(''));
        refs.current[index - 1]?.focus();
      }

      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }

    if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            autoFocus={autoFocus && index === 0}
            aria-label={`${ariaLabel} digit ${index + 1}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={1}
            value={value[index] || ''}
            onFocus={(event) => event.target.select()}
            onChange={(event) => updateDigits(index, event.target.value)}
            onPaste={(event) => handlePaste(event, index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="h-10 w-full min-w-0 rounded-md border border-[#D0D5DD] bg-white text-center text-[15px] font-semibold text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/15"
          />
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ children, rightLabel = '' }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label className="text-xs font-bold uppercase tracking-wide text-[#4B5563]">
        {children}
      </label>
      {rightLabel && (
        <span className="text-xs font-semibold uppercase text-[#98A2B3]">{rightLabel}</span>
      )}
    </div>
  );
}

export default function ChangePasswordModal({ onSuccess, onClose }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [completedAt, setCompletedAt] = useState(null);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const results = useMemo(
    () =>
      CHANGE_PASSWORD_RULES.map((rule) => ({
        ...rule,
        ok: rule.test(password),
      })),
    [password]
  );

  const allRulesMet = results.every((rule) => rule.ok);
  const verificationCode = code;
  const countdownLabel = `00:${String(resendCountdown).padStart(2, '0')}`;

  function close() {
    if (sending || verifying || resending || saving) return;
    (onClose || onSuccess)?.();
  }

  function handleCodeChange(next) {
    setCode(typeof next === 'function' ? next(code) : next);
    setError('');
  }

  async function sendVerificationCode() {
    setError('');

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email is required.');
      return;
    }

    setSending(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/send-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to send verification code.');
      }

      setEmail(trimmed);
      setCode('');
      setResendCountdown(60);
      setStep('code');
    } catch (sendError) {
      setError(
        sendError?.message ||
          'Unable to send verification code. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setError('');

    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/verify-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: verificationCode }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Invalid verification code.');
      }

      if (!result.resetToken) {
        throw new Error('Verification succeeded but no reset token was returned.');
      }

      setResetToken(result.resetToken);
      setPassword('');
      setConfirm('');
      setStep('password');
    } catch (verifyError) {
      setError(
        verifyError?.message ||
          'The verification code is invalid or has expired.'
      );
    } finally {
      setVerifying(false);
    }
  }

  async function resendCode() {
    if (resendCountdown > 0 || resending) return;

    setError('');
    setResending(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/send-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to resend verification code.');
      }

      setCode('');
      setResendCountdown(60);
    } catch (resendError) {
      setError(
        resendError?.message ||
          'Unable to resend the verification code.'
      );
    } finally {
      setResending(false);
    }
  }

  async function savePassword() {
    setError('');

    if (!resetToken || !email) {
      setError(
        'Your password reset session is missing or has expired. Please request a new verification code.'
      );
      return;
    }

    if (!allRulesMet) {
      setError('Your password does not meet all the requirements.');
      return;
    }

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${CHANGE_PASSWORD_API_BASE}/api/auth/forgot-password/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resetToken,
            email,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to update your password.');
      }

      setCompletedAt(new Date());
      setStep('success');
    } catch (resetError) {
      setError(
        resetError?.message ||
          'Unable to update your password. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function renderEmailStep() {
    return (
      <ModalShell onClose={close} width="520">
        <div className="relative px-8 pb-7 pt-8 text-center">
          <StepLabel current="1" descriptor="IDENTITY VERIFICATION" />

          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF5F5] text-[#9D0A0E]">
            <ShieldCheck size={27} strokeWidth={2.2} />
          </div>

          <h2 className="mt-5 text-[27px] font-bold tracking-[-0.6px] text-[#1F2937]">
            Change Password
          </h2>
          <p className="mx-auto mt-3 max-w-[390px] text-[14px] leading-6 text-[#475467]">
            For your security, we&apos;ll send a verification code to your registered email address.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendVerificationCode();
          }}
          className="space-y-5 px-8 pb-8"
        >
          <div>
            <label
              htmlFor="change-password-email"
              className="mb-2 block text-[13px] font-semibold text-[#1F2937]"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#344054]"
              />
              <input
                id="change-password-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !sending) sendVerificationCode();
                }}
                placeholder="Enter email"
                autoFocus
                disabled={sending}
                className="h-12 w-full rounded-md border border-[#D0D5DD] bg-white pl-11 pr-3 text-[15px] text-[#1F2937] outline-none transition placeholder:text-[#667085] focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/10 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-[#CFE2FF] bg-[#F3F8FF] px-4 py-4">
            <Info size={14} className="mt-0.5 shrink-0 text-[#344054]" />
            <p className="text-[9px] leading-4 text-[#475467]">
              Authorized admin verification code remains valid for 10 minutes. Check spam folder if not received.
            </p>
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send Verification Code'}
            {!sending && <ChevronRight size={18} />}
          </PrimaryButton>

          <SecondaryButton onClick={close} disabled={sending}>
            Cancel
          </SecondaryButton>
        </form>

        <ProtocolFooter />
      </ModalShell>
    );
  }

  function renderCodeStep() {
    return (
      <ModalShell onClose={close} width="430">
        <div className="relative px-8 pb-5 pt-7 text-center">
          <StepLabel current="2" descriptor="SECURITY VERIFICATION" />

          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#9D0A0E]">
            <LockKeyhole size={19} />
          </div>

          <h2 className="mt-4 text-[21px] font-bold tracking-[-0.4px] text-[#1F2937]">
            Verify Your Email
          </h2>
          <p className="mx-auto mt-1 max-w-[310px] text-[10px] leading-4 text-[#667085]">
            We sent a 6-digit verification code to your registered email address.
          </p>

          {email && (
            <span className="mt-3 inline-flex items-center rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1 text-[8px] font-semibold tracking-[0.05em] text-[#667085]">
              <Mail size={9} className="mr-1.5" />
              {email}
            </span>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            verifyCode();
          }}
          className="space-y-5 px-8 pb-6"
        >
          <div>
            <FieldLabel rightLabel="6 DIGITS">
              Verification Code
            </FieldLabel>
            <VerificationCodeBoxes
              value={verificationCode}
              onChange={handleCodeChange}
              ariaLabel="Verification code"
              autoFocus
            />
          </div>

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-3 text-center">
            <p className="text-[9px] text-[#98A2B3]">Didn&apos;t receive the code?</p>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[9px] text-[#98A2B3]">
              <span>Resend code {countdownLabel}</span>
              <span>•</span>
              <button
                type="button"
                onClick={resendCode}
                disabled={resendCountdown > 0 || resending || verifying}
                className="font-semibold text-[#9D0A0E] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton
            type="submit"
            disabled={verifying || verificationCode.length !== 6}
          >
            {verifying ? 'Verifying...' : 'Verify Code'}
            {!verifying && <ChevronRight size={18} />}
          </PrimaryButton>

          <SecondaryButton onClick={close} disabled={verifying}>
            Cancel
          </SecondaryButton>
        </form>

        <ProtocolFooter />
      </ModalShell>
    );
  }

  function renderPasswordStep() {
    return (
      <ModalShell onClose={close} width="520">
        <div className="relative px-8 pb-5 pt-7">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#FBF1F1] px-2.5 py-1 text-[10px] font-bold text-[#9D0A0E]">
              STEP 3 OF 3
            </span>
            <span className="text-[10px] font-medium text-[#667085]">
              Security Protocol
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF0F0] text-[#9D0A0E]">
              <ShieldCheck size={19} />
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
                ACCOUNT CREDENTIALS
              </div>
              <h2 className="mt-1 text-[21px] font-bold tracking-[-0.4px] text-[#1F2937]">
                Create New Password
              </h2>
              <p className="mt-1 max-w-[390px] text-[10px] leading-4.5 text-[#667085]">
                Create a new password for your SWU Med account. Ensure it complies with hospital clinical access safeguards.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            savePassword();
          }}
          className="space-y-5 px-8 pb-6"
        >
          <PasswordField
            id="change-password-new"
            label="New Password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setError('');
            }}
            disabled={saving}
            autoFocus
          />

          <PasswordField
            id="change-password-confirm"
            label="Confirm New Password"
            value={confirm}
            onChange={(value) => {
              setConfirm(value);
              setError('');
            }}
            disabled={saving}
          />

          <PasswordRules results={results} />

          <div className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <LockKeyhole size={12} className="mt-0.5 shrink-0 text-[#667085]" />
              <span className="text-[9px] leading-4 text-[#667085]">
                Keep your password private. Do not share it with other users.
              </span>
            </div>
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton
            type="submit"
            disabled={saving || !allRulesMet || !confirm}
          >
            {saving ? 'Saving...' : 'Change Password'}
            {!saving && <ChevronRight size={18} />}
          </PrimaryButton>

          <SecondaryButton onClick={close} disabled={saving}>
            Cancel
          </SecondaryButton>
        </form>

        <ProtocolFooter />
      </ModalShell>
    );
  }

  function renderSuccessStep() {
    const updated = completedAt
      ? completedAt.toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    return (
      <ModalShell onClose={() => onSuccess?.()} showClose={false} width="380">
        <div className="flex flex-col items-center px-7 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#9FE6CE] bg-[#E8FFF7] text-[#07855F]">
            <CheckCircle2 size={25} strokeWidth={2.4} />
          </div>
          <h2 className="mt-4 text-[17px] font-bold text-[#1F2937]">
            Password Changed Successfully
          </h2>
          <p className="mt-2 max-w-[280px] text-[10px] leading-4 text-[#667085]">
            Your password has been updated successfully.
          </p>

          <div className="mt-5 w-full rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#07855F]" />
              <div>
                <p className="text-[9px] font-bold leading-3 text-[#1F2937]">
                  Updated on {updated}
                </p>
                <p className="mt-0.5 text-[8px] text-[#667085]">
                  All active clinic session tokens refreshed automatically.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSuccess?.()}
            className="mt-4 h-9 w-full rounded-md bg-[#9D0A0E] text-[10px] font-bold text-white hover:bg-[#7d0809]"
          >
            DONE
          </button>
          <p className="mt-3 text-[8px] text-[#98A2B3]">
            Password updated successfully. You can continue using the system.
          </p>
        </div>
      </ModalShell>
    );
  }

  if (step === 'code') return renderCodeStep();
  if (step === 'password') return renderPasswordStep();
  if (step === 'success') return renderSuccessStep();

  return renderEmailStep();
}
