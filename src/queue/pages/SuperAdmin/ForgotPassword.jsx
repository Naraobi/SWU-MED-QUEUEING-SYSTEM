import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ShieldAlert,
  ShieldCheck,
  Mail,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import LoginBG1 from '../../../assets/LoginBG1.jpg';



function RecoveryShell({ children }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-10"
      style={{ backgroundImage: `url(${LoginBG1})` }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#6B1119]/45"
      />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function CardHeader({ icon: Icon, title, description, tone = 'red' }) {
  return (
    <div className="px-7 pb-5 pt-8 text-center">
      <div
        className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl ${
          tone === 'green'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-[#FBF1F1] text-[#9D0A0E]'
        }`}
      >
        <Icon size={20} />
      </div>

      <h1 className="mt-4 text-xl font-bold text-[#1F2937]">{title}</h1>

      {description && (
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#4B5563]">
          {description}
        </p>
      )}
    </div>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      {children}
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#7D080B] focus:outline-none focus:ring-4 focus:ring-[#9D0A0E]/30 disabled:cursor-not-allowed disabled:opacity-50"
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
      className="mt-2 w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-medium text-[#4B5563] transition hover:bg-[#F1F3F5] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ProtocolFooter() {
  return (
    <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-[#E5E7EB] pt-4 text-xs uppercase tracking-wide text-[#9CA3AF]">
      <Lock size={10} />
      256-bit encrypted hospital administration protocol
    </p>
  );
}


/* =========================================================
   /forgot-password
========================================================= */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);

  const [step, setStep] = useState('email');

  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
const codeInputRefs = useRef([]);

  function handleCodeChange(index, value) {
    // Only allow one number per box
    const numericValue = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = numericValue;

    setCode(newCode);
    setError(null);

    // Automatically move to next box
    if (numericValue && index < 5) {
     codeInputRefs.current[index + 1]?.focus();
    }
  }

 function handleCodeKeyDown(index, event) {
  if (
    event.key === 'Backspace' &&
    !code[index] &&
    index > 0
  ) {
    codeInputRefs.current[index - 1]?.focus();
  }

  if (event.key === 'ArrowLeft' && index > 0) {
    codeInputRefs.current[index - 1]?.focus();
  }

  if (event.key === 'ArrowRight' && index < 5) {
    codeInputRefs.current[index + 1]?.focus();
  }
}

  function handleCodePaste(event) {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    if (!pasted) return;

    const newCode = ['', '', '', '', '', ''];

    pasted.split('').forEach((digit, index) => {
      newCode[index] = digit;
    });

    setCode(newCode);

    const nextIndex = Math.min(pasted.length, 5);
   codeInputRefs.current[nextIndex]?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError('Email is required.');
      return;
    }

    setSending(true);

    try {
      /*
       * NEW BACKEND FLOW
       *
       * The backend will:
       * 1. Check the SWU Med account
       * 2. Generate a 6-digit verification code
       * 3. Store the code temporarily
       * 4. Send the code using your SWU Med email
       */

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password/send-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: trimmed,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to send verification code.'
        );
      }

      setEmail(trimmed);
      setCode(['', '', '', '', '', '']);
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

  async function handleVerifyCode(event) {
    event.preventDefault();
    setError(null);

    const verificationCode = code.join('');

    if (verificationCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password/verify-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            code: verificationCode,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Invalid verification code.'
        );
      }

      /*
       * The backend should return a short-lived
       * reset token after the code is verified.
       *
       * We pass it to the password page.
       */

           sessionStorage.setItem(
        'swu_password_reset_token',
        result.resetToken
      );

      sessionStorage.setItem(
        'swu_password_reset_email',
        email
      );

      navigate('/reset-password', {
        replace: true,
      });

    } catch (verifyError) {
      setError(
        verifyError?.message ||
          'The verification code is invalid or has expired.'
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendCode() {
    setError(null);
    setResending(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password/send-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Unable to resend verification code.'
        );
      }

      setCode(['', '', '', '', '', '']);

    } catch (resendError) {
      setError(
        resendError?.message ||
          'Unable to resend the verification code.'
      );
    } finally {
      setResending(false);
    }
  }

  /* =====================================================
     STEP 2 — VERIFICATION CODE
  ===================================================== */

  if (step === 'code') {
    return (
      <RecoveryShell>
        <CardHeader
          icon={Mail}
          tone="green"
          title="Verify Your Email"
          description={
            <>
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-[#1F2937]">
                {email}
              </span>
            </>
          }
        />

        <form
          onSubmit={handleVerifyCode}
          className="px-7 pb-7"
        >
          <label className="mb-3 block text-center text-sm font-semibold text-[#1F2937]">
            Verification Code
          </label>

          <div
            className="flex justify-center gap-2"
            onPaste={handleCodePaste}
          >
            {code.map((digit, index) => (
              <input
                key={index}
               ref={(element) => {
  codeInputRefs.current[index] = element;
}}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(event) =>
                  handleCodeChange(
                    index,
                    event.target.value
                  )
                }
                onKeyDown={(event) =>
                  handleCodeKeyDown(
                    index,
                    event
                  )
                }
                autoFocus={index === 0}
                disabled={verifying}
                className="h-12 w-10 rounded-lg border border-[#E5E7EB] bg-white text-center text-lg font-bold text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
                aria-label={`Verification digit ${index + 1}`}
              />
            ))}
          </div>

          <ErrorBox>{error}</ErrorBox>

          <PrimaryButton
            type="submit"
            disabled={
              verifying ||
              code.join('').length !== 6
            }
          >
            {verifying
              ? 'Verifying...'
              : 'Verify Code'}

            {!verifying && (
              <ArrowRight size={16} />
            )}
          </PrimaryButton>

          <div className="mt-4 text-center">
            <p className="text-xs text-[#6B7280]">
              Didn't receive the code?
            </p>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={resending}
              className="mt-1 text-xs font-semibold text-[#9D0A0E] hover:underline disabled:opacity-50"
            >
              {resending
                ? 'Sending...'
                : 'Resend Code'}
            </button>
          </div>

          <SecondaryButton
            onClick={() => {
              setStep('email');
              setCode([
                '',
                '',
                '',
                '',
                '',
                '',
              ]);
              setError(null);
            }}
            disabled={verifying}
          >
            <span className="flex items-center justify-center gap-1.5">
              <ArrowLeft size={14} />
              Change Email
            </span>
          </SecondaryButton>

          <ProtocolFooter />
        </form>
      </RecoveryShell>
    );
  }

  /* =====================================================
     STEP 1 — EMAIL
  ===================================================== */

  return (
    <RecoveryShell>
      <CardHeader
        icon={ShieldAlert}
        title="Forgot Password?"
        description="Enter your registered account email address to continue."
      />

      <form
        onSubmit={handleSubmit}
        className="px-7 pb-7"
      >
        <label
          htmlFor="recovery-email"
          className="mb-1.5 block text-sm font-semibold text-[#1F2937]"
        >
          Email
        </label>

        <div className="relative">
          <Mail
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
          />

          <input
            id="recovery-email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="Enter email"
            autoComplete="email"
            autoFocus
            disabled={sending}
            className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
          />
        </div>

        <ErrorBox>{error}</ErrorBox>

        <PrimaryButton
          type="submit"
          disabled={sending}
        >
          {sending
            ? 'Sending Code...'
            : 'Continue'}

          {!sending && (
            <ArrowRight size={16} />
          )}
        </PrimaryButton>

        <SecondaryButton
          onClick={() =>
            navigate('/superadmin/login')
          }
          disabled={sending}
        >
          Back to Login
        </SecondaryButton>

        <ProtocolFooter />
      </form>
    </RecoveryShell>
  );
}

/* =========================================================
   /reset-password  (opened from the emailed link)
========================================================= */

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'Include at least one uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', label: 'Include at least one number', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'Include at least one special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function PasswordField({ id, label, value, onChange, disabled, autoFocus }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#1F2937]">
        {label}
        <span className="ml-0.5 text-[#9D0A0E]">*</span>
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
          className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 pr-10 text-sm text-[#1F2937] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() => setShow((previous) => !previous)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#4B5563] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
export function ResetPassword() {
  const navigate = useNavigate();

  const resetToken = sessionStorage.getItem(
    'swu_password_reset_token'
  );

  const accountEmail = sessionStorage.getItem(
    'swu_password_reset_email'
  );

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState(null);

  const results = useMemo(
    () =>
      RULES.map((rule) => ({
        ...rule,
        ok: rule.test(password),
      })),
    [password]
  );

  const allRulesMet = results.every(
    (rule) => rule.ok
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!resetToken || !accountEmail) {
      setError(
        'Your password reset session is missing or has expired. Please request a new verification code.'
      );
      return;
    }

    if (!allRulesMet) {
      setError(
        'Your password does not meet all the requirements.'
      );
      return;
    }

    if (password !== confirm) {
      setError(
        'The two passwords do not match.'
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resetToken,
            email: accountEmail,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Unable to update your password.'
        );
      }

      // Remove the temporary reset information
      sessionStorage.removeItem(
        'swu_password_reset_token'
      );

      sessionStorage.removeItem(
        'swu_password_reset_email'
      );

      setCompletedAt(new Date());

    } catch (resetError) {
      setError(
        resetError?.message ||
          'Unable to reset your password. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * User reached this page without successfully
   * completing the OTP verification.
   */
  if (!resetToken || !accountEmail) {
    return (
      <RecoveryShell>
        <CardHeader
          icon={AlertTriangle}
          title="Reset Session Expired"
          description="Your password reset session is missing or has expired. Please request a new verification code."
        />

        <div className="px-7 pb-7">
          <PrimaryButton
            onClick={() =>
              navigate('/forgot-password')
            }
          >
            Request New Code
            <ArrowRight size={16} />
          </PrimaryButton>

          <SecondaryButton
            onClick={() =>
              navigate('/superadmin/login')
            }
          >
            Back to Login
          </SecondaryButton>
        </div>
      </RecoveryShell>
    );
  }

  if (completedAt) {
    return (
      <RecoveryShell>
        <CardHeader
          icon={Check}
          tone="green"
          title="Password Reset Complete!"
          description="Your password has been successfully updated. You can now log in with your new credentials."
        />

        <div className="px-7 pb-7">
          <p className="flex items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-xs text-[#4B5563]">
            <ShieldCheck
              size={13}
              className="text-[#9D0A0E]"
            />

            Updated on{' '}
            {completedAt.toLocaleString()}
          </p>

          <PrimaryButton
            onClick={() =>
              navigate('/superadmin/login')
            }
          >
            Back to Login
            <ArrowRight size={16} />
          </PrimaryButton>
        </div>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell>
      <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-7 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
          <ShieldAlert size={18} />
        </div>

        <h1 className="text-lg font-bold text-[#1F2937]">
          Set New Password
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 px-7 pb-7 pt-5"
      >
        <p className="text-sm leading-6 text-[#4B5563]">
          Create a strong new password for{' '}
          <span className="font-semibold text-[#1F2937]">
            {accountEmail}
          </span>
          .
        </p>

        <PasswordField
          id="new-password"
          label="New Password"
          value={password}
          onChange={setPassword}
          disabled={saving}
          autoFocus
        />

        <PasswordField
          id="confirm-password"
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          disabled={saving}
        />

        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3">
          <p className="mb-2 text-xs font-bold text-[#1F2937]">
            Password requirements:
          </p>

          <ul className="space-y-1.5">
            {results.map((rule) => (
              <li
                key={rule.key}
                className={`flex items-center gap-2 text-xs ${
                  rule.ok
                    ? 'text-emerald-700'
                    : 'text-[#4B5563]'
                }`}
              >
                {rule.ok ? (
                  <CheckCircle2
                    size={14}
                    className="shrink-0 text-emerald-600"
                  />
                ) : (
                  <Circle
                    size={14}
                    className="shrink-0 text-[#9CA3AF]"
                  />
                )}

                {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <ErrorBox>{error}</ErrorBox>

        <PrimaryButton
          type="submit"
          disabled={
            saving ||
            !allRulesMet ||
            !confirm
          }
        >
          {saving
            ? 'Updating...'
            : 'Update Password & Login'}

          {!saving && (
            <ArrowRight size={16} />
          )}
        </PrimaryButton>

        <button
          type="button"
          onClick={() =>
            navigate('/superadmin/login')
          }
          disabled={saving}
          className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-[#4B5563] transition hover:text-[#9D0A0E]"
        >
          <ArrowLeft size={12} />
          Back to Login
        </button>
      </form>
    </RecoveryShell>
  );
}