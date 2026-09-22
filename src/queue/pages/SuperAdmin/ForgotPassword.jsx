import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
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

import { auth } from '../../../firebase';
import LoginBG1 from '../../../assets/LoginBG1.jpg';

/*
 * Password recovery uses Firebase Authentication's built-in reset:
 *
 *   /forgot-password  -> sendPasswordResetEmail()  emails a reset link
 *   /reset-password   -> confirmPasswordReset()    sets the new password
 *
 * No backend is involved. For the emailed link to open /reset-password
 * (instead of Firebase's default page), set the action URL in
 * Firebase Console -> Authentication -> Templates -> Password reset.
 */

/* =========================================================
   SHARED LAYOUT
========================================================= */

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

function friendlyAuthError(error, fallback) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Unable to connect. Check your internet connection.';
    case 'auth/expired-action-code':
      return 'This reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This reset link is invalid or has already been used.';
    case 'auth/weak-password':
      return 'That password is too weak. Please choose a stronger one.';
    default:
      return error?.message || fallback;
  }
}

/* =========================================================
   /forgot-password
========================================================= */

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();

    if (!trimmed) {
      setError('Email is required.');
      return;
    }

    setSending(true);

    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSentTo(trimmed);
    } catch (sendError) {
      // Do not reveal whether an account exists for this address.
      if (sendError?.code === 'auth/user-not-found') {
        setSentTo(trimmed);
      } else {
        setError(friendlyAuthError(sendError, 'Unable to send the reset email.'));
      }
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <RecoveryShell>
        <CardHeader
          icon={Mail}
          tone="green"
          title="Check Your Email"
          description="If an account exists for this address, a password reset link is on its way."
        />

        <div className="px-7 pb-7">
          <p className="mx-auto w-fit rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-xs font-medium text-[#1F2937]">
            {sentTo}
          </p>

          <p className="mt-4 text-center text-xs leading-5 text-[#4B5563]">
            Open the link in the email to set a new password. It expires after a
            short time, so use it soon.
          </p>

          <PrimaryButton onClick={() => navigate('/superadmin/login')}>
            Back to Login
            <ArrowRight size={16} />
          </PrimaryButton>

          <SecondaryButton onClick={() => setSentTo(null)}>
            Use a different email
          </SecondaryButton>
        </div>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell>
      <CardHeader
        icon={ShieldAlert}
        title="Forgot Password?"
        description="Enter your registered account email address to receive a password reset link."
      />

      <form onSubmit={handleSubmit} className="px-7 pb-7">
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
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email"
            autoComplete="email"
            autoFocus
            disabled={sending}
            className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
          />
        </div>

        <ErrorBox>{error}</ErrorBox>

        <PrimaryButton type="submit" disabled={sending}>
          {sending ? 'Sending...' : 'Send Reset Link'}
          {!sending && <ArrowRight size={16} />}
        </PrimaryButton>

        <SecondaryButton
          onClick={() => navigate('/superadmin/login')}
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
  const [params] = useSearchParams();
  const oobCode = params.get('oobCode');

  const [checking, setChecking] = useState(true);
  const [accountEmail, setAccountEmail] = useState(null);
  const [linkError, setLinkError] = useState(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!oobCode) {
      setLinkError('This page must be opened from the link in your reset email.');
      setChecking(false);
      return undefined;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (!cancelled) setAccountEmail(email);
      })
      .catch((verifyError) => {
        if (!cancelled) {
          setLinkError(friendlyAuthError(verifyError, 'This reset link is not valid.'));
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const results = useMemo(
    () => RULES.map((rule) => ({ ...rule, ok: rule.test(password) })),
    [password]
  );

  const allRulesMet = results.every((rule) => rule.ok);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

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
      await confirmPasswordReset(auth, oobCode, password);
      setCompletedAt(new Date());
    } catch (resetError) {
      setError(friendlyAuthError(resetError, 'Unable to reset your password.'));
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <RecoveryShell>
        <p className="px-7 py-12 text-center text-sm text-[#4B5563]">
          Checking your reset link...
        </p>
      </RecoveryShell>
    );
  }

  if (linkError) {
    return (
      <RecoveryShell>
        <CardHeader icon={AlertTriangle} title="Link Not Valid" description={linkError} />
        <div className="px-7 pb-7">
          <PrimaryButton onClick={() => navigate('/forgot-password')}>
            Request a New Link
            <ArrowRight size={16} />
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/superadmin/login')}>
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
            <ShieldCheck size={13} className="text-[#9D0A0E]" />
            Updated on {completedAt.toLocaleString()}
          </p>

          <PrimaryButton onClick={() => navigate('/superadmin/login')}>
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
        <h1 className="text-lg font-bold text-[#1F2937]">Set New Password</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-7 pb-7 pt-5">
        <p className="text-sm leading-6 text-[#4B5563]">
          Create a strong new password for{' '}
          <span className="font-semibold text-[#1F2937]">{accountEmail}</span>.
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
          <p className="mb-2 text-xs font-bold text-[#1F2937]">Password requirements:</p>
          <ul className="space-y-1.5">
            {results.map((rule) => (
              <li
                key={rule.key}
                className={`flex items-center gap-2 text-xs ${
                  rule.ok ? 'text-emerald-700' : 'text-[#4B5563]'
                }`}
              >
                {rule.ok ? (
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                ) : (
                  <Circle size={14} className="shrink-0 text-[#9CA3AF]" />
                )}
                {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <ErrorBox>{error}</ErrorBox>

        <PrimaryButton type="submit" disabled={saving || !allRulesMet || !confirm}>
          {saving ? 'Updating...' : 'Update Password & Login'}
          {!saving && <ArrowRight size={16} />}
        </PrimaryButton>

        <button
          type="button"
          onClick={() => navigate('/superadmin/login')}
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
