<<<<<<< HEAD
import { useState } from "react";
import {
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
} from "firebase/auth";
=======
import { useEffect, useMemo, useRef, useState } from "react";
import { updatePassword } from "firebase/auth";
>>>>>>> origin/design-round-3

import {
  ShieldCheck,
  Mail,
  Info,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  RotateCw,
  X,
} from "lucide-react";

import { auth } from "../../firebase";
import { markPasswordChanged } from "../services/backendApi";

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD - 4 STEP FLOW
|--------------------------------------------------------------------------
|
|   Step 1  email      Identity verification, sends the code
|   Step 2  code       6-digit code from the email
|   Step 3  password   New password + confirmation
|   Step 4  done       Success card
|
| Steps 1 and 2 reuse the verification endpoints the backend already has
| for the forgot-password flow, so no new API work is required:
|
|   POST /api/auth/forgot-password/send-code    { email }
|   POST /api/auth/forgot-password/verify-code  { email, code }
|
| Step 3 keeps the original logic untouched: Firebase updatePassword(),
| then markPasswordChanged() so MySQL / Firestore clear must_change_password.
|
*/

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;

/* Rules shown as a live checklist on step 3. */
const PASSWORD_RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    key: "uppercase",
    label: "Include at least one uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    label: "Include at least one number",
    test: (value) => /[0-9]/.test(value),
  },
  {
    key: "special",
    label: "Include at least one special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

/* m•••••@email.com */
function maskEmail(value) {
  const [name = "", domain = ""] = String(value || "").split("@");

  if (!name || !domain) {
    return value || "";
  }

  return `${name.slice(0, 1)}${"•".repeat(
    Math.max(name.length - 1, 3)
  )}@${domain}`;
}

function formatCountdown(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return `${m}:${s}`;
}

/* =========================================================
   SHARED PIECES
========================================================= */

function StepBadge({ step, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-[#9D0A0E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        Step {step} of 3
      </span>

      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
        {label}
      </span>
    </div>
  );
}

function CloseButton({ onClose, disabled }) {
  if (!onClose) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClose}
      disabled={disabled}
      aria-label="Close"
      className="text-[#9CA3AF] transition hover:text-[#1F2937] disabled:opacity-40"
    >
      <X size={18} />
    </button>
  );
}

function ErrorNote({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="swu-enter rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
      {message}
    </div>
  );
}

function PrimaryButton({ children, ...rest }) {
  return (
    <button
      type="submit"
      {...rest}
      className="swu-press flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className="swu-press w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-medium text-[#4B5563] transition hover:bg-[#F8F9FA] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  autoFocus,
}) {
<<<<<<< HEAD
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
=======
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#4B5563]">
        {label}
        <span className="ml-0.5 text-[#9D0A0E]">*</span>
      </label>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] py-2.5 pl-3 pr-10 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#9CA3AF] transition hover:text-[#4B5563] disabled:opacity-40"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
>>>>>>> origin/design-round-3

/* Six single-character boxes with auto-advance, backspace and paste. */
function CodeBoxes({ code, setCode, disabled }) {
  const inputs = useRef([]);

  function setDigit(index, raw) {
    const digit = raw.replace(/\D/g, "").slice(-1);

    setCode((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(event, index) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);

    if (!pasted) {
      return;
    }

    event.preventDefault();

    const next = Array.from(
      { length: CODE_LENGTH },
      (_, i) => pasted[i] || ""
    );

    setCode(next);
    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: CODE_LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={code[index] || ""}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={index === 0}
          className={`h-11 w-10 rounded-lg border text-center text-lg font-bold text-[#1F2937] transition focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-50 ${
            code[index]
              ? "border-[#9D0A0E] bg-white"
              : "border-[#E5E7EB] bg-[#F8F9FA] focus:border-[#9D0A0E] focus:bg-white"
          }`}
        />
      ))}
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

export default function ChangePasswordModal({ onSuccess, onClose }) {
  const currentEmail = auth.currentUser?.email || "";

  const [step, setStep] = useState("email");

  const [email, setEmail] = useState(currentEmail);
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [changedAt, setChangedAt] = useState(null);

  /* Whatever markPasswordChanged() returned, handed to onSuccess on finish. */
  const [passwordStatus, setPasswordStatus] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  /* Resend countdown. */
  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timer = setTimeout(
      () => setSecondsLeft((current) => current - 1),
      1000
    );

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const ruleResults = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(newPassword),
      })),
    [newPassword]
  );

  const allRulesPassed = ruleResults.every((rule) => rule.passed);

  /* ----- step 1: send the verification code ----- */
  async function handleSendCode(event) {
    event.preventDefault();
    setError("");

    const trimmed = email.trim();

    if (!trimmed) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/forgot-password/send-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to send verification code."
        );
      }

      setEmail(trimmed);
      setCode(Array(CODE_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
      setStep("code");
    } catch (sendError) {
      setError(
        sendError?.message ||
          "Unable to send verification code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (secondsLeft > 0 || loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/forgot-password/send-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to resend verification code."
        );
      }

      setCode(Array(CODE_LENGTH).fill(""));
      setSecondsLeft(RESEND_SECONDS);
    } catch (resendError) {
      setError(
        resendError?.message ||
          "Unable to resend verification code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ----- step 2: verify the code ----- */
  async function handleVerifyCode(event) {
    event.preventDefault();
    setError("");

    const verificationCode = code.join("");

    if (verificationCode.length !== CODE_LENGTH) {
      setError(
        `Please enter the complete ${CODE_LENGTH}-digit verification code.`
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/forgot-password/verify-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            code: verificationCode,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Invalid verification code.");
      }

      setStep("password");
    } catch (verifyError) {
      setError(
        verifyError?.message ||
          "Invalid verification code. Please try again."
      );
      setCode(Array(CODE_LENGTH).fill(""));
    } finally {
      setLoading(false);
    }
  }

  /* ----- step 3: change the password (original logic) ----- */
  async function handleChangePassword(event) {
    event.preventDefault();
    setError("");

    // --------------------------------------------------
    // VALIDATE PASSWORD
    // --------------------------------------------------

    if (!newPassword) {
      setError("Please create a new password.");
      return;
    }

<<<<<<< HEAD
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
=======
    if (!allRulesPassed) {
      setError("Your new password does not meet all the requirements.");
>>>>>>> origin/design-round-3
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
<<<<<<< HEAD
=======
      return;
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setError("Your session has expired. Please log in again.");
>>>>>>> origin/design-round-3
      return;
    }

    setLoading(true);

    try {
<<<<<<< HEAD
      // --------------------------------------------------
      // GET CURRENT FIREBASE USER
      // --------------------------------------------------

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      // --------------------------------------------------
      // CHECK CURRENT FIREBASE AUTH PROVIDERS
      // --------------------------------------------------

      const beforeProviders =
        firebaseUser.providerData.map(
          (provider) => provider.providerId
        );

      console.log(
        "BEFORE PASSWORD CHANGE PROVIDERS:",
        beforeProviders
      );

      // --------------------------------------------------
      // CHECK IF PASSWORD PROVIDER ALREADY EXISTS
      // --------------------------------------------------

      const hasPasswordProvider =
        beforeProviders.includes("password");
if (hasPasswordProvider) {
  console.log("PASSWORD CHANGE ACTION: updatePassword()");
  
  await updatePassword(
    firebaseUser,
    newPassword
  );

  console.log("PASSWORD CHANGE: updatePassword SUCCESS");
} else {
  console.log("PASSWORD CHANGE ACTION: linkWithCredential()");

  const emailCredential =
    EmailAuthProvider.credential(
      firebaseUser.email,
      newPassword
    );

  const linkedResult =
    await linkWithCredential(
      firebaseUser,
      emailCredential
    );

  console.log(
    "PASSWORD CHANGE: linkWithCredential SUCCESS",
    linkedResult.user.providerData.map(
      (provider) => provider.providerId
    )
  );
}
      // --------------------------------------------------
      // VERIFY PASSWORD PROVIDER WAS ADDED
      // --------------------------------------------------

      // Refresh provider information from Firebase.
      await firebaseUser.reload();
console.log(
  "PASSWORD CHANGE - FINAL PROVIDERS:",
  firebaseUser.providerData.map(
    (provider) => provider.providerId
  )
);
      const finalProviders =
        firebaseUser.providerData.map(
          (provider) => provider.providerId
        );

      console.log(
        "FINAL FIREBASE PROVIDERS:",
        finalProviders
      );

      if (!finalProviders.includes("password")) {
        throw new Error(
          "The password was not successfully added to your Firebase account."
        );
      }

      console.log(
        "FIREBASE PASSWORD OPERATION SUCCESSFUL"
      );

      // --------------------------------------------------
      // UPDATE BACKEND PASSWORD STATUS
      // --------------------------------------------------
      //
      // This does NOT store the actual password.
      //
      // It only updates your backend account information,
      // such as:
      //
      // must_change_password = 0
      // password_changed_at = current time
      //
      const passwordStatus =
        await markPasswordChanged(firebaseUser);

      console.log(
        "markPasswordChanged SUCCESS:",
        passwordStatus
      );

      // --------------------------------------------------
      // TELL LOGIN PAGE PASSWORD SETUP IS COMPLETE
      // --------------------------------------------------

      await onSuccess(passwordStatus);

    } catch (error) {
      console.error(
        "PASSWORD CHANGE ERROR:",
        error
      );

      // --------------------------------------------------
      // FIREBASE ERROR HANDLING
      // --------------------------------------------------

      switch (error?.code) {
        case "auth/email-already-in-use":
          setError(
            "This email is already connected to another Firebase account."
          );
          break;

        case "auth/provider-already-linked":
          setError(
            "Email and password authentication is already linked to this account."
          );
          break;

        case "auth/requires-recent-login":
          setError(
            "For security, please log in again before changing your password."
          );
          break;

        case "auth/weak-password":
          setError(
            "The password is too weak. Please create a stronger password."
          );
          break;

        case "auth/network-request-failed":
          setError(
            "Network error. Please check your internet connection and try again."
          );
          break;

        default:
          setError(
            error?.message ||
              "Unable to change password. Please try again."
          );
          break;
      }

=======
      /*
       * STEP 1:
       * Change the password in Firebase Authentication.
       */
      await updatePassword(firebaseUser, newPassword);

      /*
       * STEP 2:
       * Tell the Node.js backend that the password has been changed.
       *
       * This updates:
       * - MySQL
       * - Firestore
       * - must_change_password = false
       */
      const status = await markPasswordChanged(firebaseUser);

      /*
       * STEP 3:
       * Show the success card, then hand control back to the caller.
       */
      setPasswordStatus(status);
      setChangedAt(new Date());
      setStep("done");
    } catch (changeError) {
      console.error("Password change error:", changeError);

      setError(
        changeError?.message ||
          "Unable to change password. Please try again."
      );
>>>>>>> origin/design-round-3
    } finally {
      setLoading(false);
    }
  }

  /* ----- step 4: hand back to Login.jsx / Settings.jsx ----- */
  async function handleFinish() {
    await onSuccess(passwordStatus);
  }

<<<<<<< HEAD
        {/* -------------------------------------------- */}
        {/* HEADER */}
        {/* -------------------------------------------- */}

        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">
            Change Your Password
          </h2>
=======
  const shell =
    "swu-enter-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4";
>>>>>>> origin/design-round-3

  /* =======================================================
     STEP 4 - SUCCESS
  ======================================================= */
  if (step === "done") {
    return (
      <div className={shell}>
        <div key={step} className="swu-pop w-full max-w-sm rounded-2xl bg-white shadow-2xl">
          <div className="flex justify-center pt-3">
            <span className="h-1 w-10 rounded-full bg-[#F6E7E7]" />
          </div>

          <div className="px-6 pb-2 pt-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={28} />
            </div>

            <h2 className="text-lg font-bold text-[#1F2937]">
              Password Changed Successfully
            </h2>

            <p className="mt-1.5 text-xs leading-5 text-[#4B5563]">
              Your password has been updated successfully.
            </p>

            <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 text-[11px] font-medium text-[#4B5563]">
              <Clock size={13} className="text-[#9D0A0E]" />
              Updated on{" "}
              {(changedAt || new Date()).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div className="px-6 pb-3 pt-4">
            <PrimaryButton type="button" onClick={handleFinish}>
              Continue
              <ArrowRight size={15} />
            </PrimaryButton>
          </div>

          <p className="px-6 pb-5 text-center text-[10px] text-[#9CA3AF]">
            All active clinic session tokens refreshed automatically.
          </p>
        </div>
      </div>
    );
  }

<<<<<<< HEAD
        {/* -------------------------------------------- */}
        {/* FORM */}
        {/* -------------------------------------------- */}

        <form
          onSubmit={handleChangePassword}
          className="space-y-4"
        >

          {/* ------------------------------------------ */}
          {/* NEW PASSWORD */}
          {/* ------------------------------------------ */}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">
              Create a Password
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              placeholder="Enter new password"
              disabled={loading}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100"
            />
          </div>

          {/* ------------------------------------------ */}
          {/* CONFIRM PASSWORD */}
          {/* ------------------------------------------ */}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Confirm new password"
              disabled={loading}
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100"
            />
          </div>

          {/* ------------------------------------------ */}
          {/* ERROR */}
          {/* ------------------------------------------ */}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
=======
  /* =======================================================
     STEP 3 - CREATE NEW PASSWORD
  ======================================================= */
  if (step === "password") {
    return (
      <div className={shell}>
        <div key={step} className="swu-pop w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FBF1F1] text-[#9D0A0E]">
                <ShieldCheck size={13} />
              </span>

              <StepBadge step={3} label="Security Protocol" />
>>>>>>> origin/design-round-3
            </div>

<<<<<<< HEAD
          {/* ------------------------------------------ */}
          {/* SUBMIT */}
          {/* ------------------------------------------ */}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#00569c] py-2.5 text-sm font-semibold text-white hover:bg-[#004278] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Changing Password..."
              : "Change Password"}
          </button>

=======
            <CloseButton onClose={onClose} disabled={loading} />
          </div>

          <form onSubmit={handleChangePassword} className="px-6 pb-6">
            <h2 className="text-lg font-bold text-[#1F2937]">
              Create New Password
            </h2>

            <p className="mt-1 text-xs leading-5 text-[#4B5563]">
              Create a new password for your SWUMed account. Ensure it
              complies with hospital clinical data access safeguards.
            </p>

            <div className="mt-5 space-y-4">
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Enter new password"
                disabled={loading}
                autoFocus
              />

              <PasswordField
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm new password"
                disabled={loading}
              />

              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3">
                <p className="text-xs font-bold text-[#1F2937]">
                  Password requirements:
                </p>

                <div className="mt-2 space-y-1.5">
                  {ruleResults.map((rule) => (
                    <div
                      key={rule.key}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                          rule.passed
                            ? "bg-emerald-500 text-white"
                            : "border border-[#D1D5DB] bg-white text-transparent"
                        }`}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>

                      <span
                        className={
                          rule.passed
                            ? "text-[#1F2937]"
                            : "text-[#9CA3AF]"
                        }
                      >
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <ErrorNote message={error} />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="swu-press rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#4B5563] transition hover:bg-[#F8F9FA] disabled:opacity-40"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={loading}
                className="swu-press flex items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Changing Password..." : "Change Password"}
                {!loading && <ArrowRight size={15} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* =======================================================
     STEP 2 - VERIFY YOUR EMAIL
  ======================================================= */
  if (step === "code") {
    return (
      <div className={shell}>
        <div key={step} className="swu-pop w-full max-w-sm rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between px-6 pt-5">
            <StepBadge step={2} label="Security Verification" />
            <CloseButton onClose={onClose} disabled={loading} />
          </div>

          <form onSubmit={handleVerifyCode} className="px-6 pb-6">
            <div className="text-center">
              <div className="mx-auto mb-3 mt-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FBF1F1] text-[#9D0A0E]">
                <ShieldCheck size={20} />
              </div>

              <h2 className="text-base font-bold text-[#1F2937]">
                Verify Your Email
              </h2>

              <p className="mx-auto mt-1 max-w-[17rem] text-[11px] leading-5 text-[#4B5563]">
                We sent a {CODE_LENGTH}-digit verification code to your
                registered email address.
              </p>

              <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-[11px] font-medium text-[#4B5563]">
                <Mail size={12} className="text-[#9D0A0E]" />
                {maskEmail(email)}
              </div>
            </div>

            <div className="mt-5">
              <CodeBoxes
                code={code}
                setCode={setCode}
                disabled={loading}
              />
            </div>

            <div className="mt-4 text-center">
              <p className="text-[11px] text-[#4B5563]">
                Didn&apos;t receive the code?
              </p>

              <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px]">
                <RotateCw size={11} className="text-[#9CA3AF]" />

                {secondsLeft > 0 ? (
                  <span className="text-[#9CA3AF]">
                    Resend code in{" "}
                    <span className="font-semibold text-[#1F2937]">
                      {formatCountdown(secondsLeft)}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="font-semibold text-[#9D0A0E] underline decoration-[#9D0A0E]/40 underline-offset-2 transition hover:decoration-[#9D0A0E] disabled:opacity-40"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <ErrorNote message={error} />

              <PrimaryButton disabled={loading}>
                {loading ? "Verifying..." : "Verify Code"}
                {!loading && <ArrowRight size={15} />}
              </PrimaryButton>

              <SecondaryButton
                onClick={() => {
                  setError("");
                  setCode(Array(CODE_LENGTH).fill(""));
                  setStep("email");
                }}
                disabled={loading}
              >
                Cancel
              </SecondaryButton>
            </div>
          </form>

          <p className="flex items-center justify-center gap-1 border-t border-[#F1F3F5] py-3 text-[10px] text-[#9CA3AF]">
            <Lock size={10} />
            256-bit encrypted hospital administrator protocol
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     STEP 1 - IDENTITY VERIFICATION
  ======================================================= */
  return (
    <div className={shell}>
      <div key={step} className="swu-pop w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-5">
          <StepBadge step={1} label="Identity Verification" />
          <CloseButton onClose={onClose} disabled={loading} />
        </div>

        <form onSubmit={handleSendCode} className="px-6 pb-6">
          <div className="text-center">
            <div className="mx-auto mb-3 mt-2 flex h-11 w-11 items-center justify-center rounded-xl bg-[#FBF1F1] text-[#9D0A0E]">
              <ShieldCheck size={20} />
            </div>

            <h2 className="text-base font-bold text-[#1F2937]">
              Change Password
            </h2>

            <p className="mx-auto mt-1 max-w-[17rem] text-[11px] leading-5 text-[#4B5563]">
              For your security, we&apos;ll send a verification code to your
              registered email address.
            </p>
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-xs font-semibold text-[#4B5563]">
              Email
            </label>

            <div className="relative">
              <Mail
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter email"
                disabled={loading}
                autoFocus
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] py-2.5 pl-9 pr-3 text-sm text-[#1F2937] transition focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5">
            <Info size={13} className="mt-0.5 shrink-0 text-[#9CA3AF]" />

            <p className="text-[10px] leading-4 text-[#4B5563]">
              Authorized admin verification code remains valid for 10
              minutes. Check spam folder if not received.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <ErrorNote message={error} />

            <PrimaryButton disabled={loading}>
              {loading ? "Sending..." : "Send Verification Code"}
              {!loading && <ArrowRight size={15} />}
            </PrimaryButton>

            {onClose && (
              <SecondaryButton onClick={onClose} disabled={loading}>
                Cancel
              </SecondaryButton>
            )}
          </div>
>>>>>>> origin/design-round-3
        </form>
      </div>
    </div>
  );
}