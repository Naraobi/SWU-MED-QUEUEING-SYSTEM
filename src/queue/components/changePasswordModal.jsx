import { useMemo, useState } from "react";
import { updatePassword } from "firebase/auth";

import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
} from "lucide-react";

import { auth } from "../../firebase";
import { markPasswordChanged } from "../services/backendApi";


/* =========================================================
   PASSWORD REQUIREMENTS
========================================================= */

const RULES = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    key: "upper",
    label: "Include at least one uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    label: "Include at least one number",
    test: (value) => /\d/.test(value),
  },
  {
    key: "special",
    label: "Include at least one special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];


/* =========================================================
   PASSWORD FIELD
========================================================= */

function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  autoFocus,
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-[#1F2937]"
      >
        {label}
        <span className="ml-0.5 text-[#9D0A0E]">
          *
        </span>
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          autoComplete="new-password"
          autoFocus={autoFocus}
          disabled={disabled}
          className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 pr-10 text-sm text-[#1F2937] outline-none transition focus:border-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={() =>
            setShow((previous) => !previous)
          }
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#4B5563] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30 disabled:opacity-50"
          aria-label={
            show
              ? "Hide password"
              : "Show password"
          }
        >
          {show ? (
            <EyeOff size={16} />
          ) : (
            <Eye size={16} />
          )}
        </button>
      </div>
    </div>
  );
}


/* =========================================================
   ERROR BOX
========================================================= */

function ErrorBox({ children }) {
  if (!children) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2.5 text-xs text-[#9D0A0E]">
      <AlertTriangle
        size={13}
        className="mt-0.5 shrink-0"
      />

      <span>{children}</span>
    </div>
  );
}


/* =========================================================
   CHANGE PASSWORD MODAL
========================================================= */

export default function ChangePasswordModal({
  onSuccess,
}) {
  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  /*
   * Check every password requirement
   * against the ACTUAL password being typed.
   */
  const results = useMemo(
    () =>
      RULES.map((rule) => ({
        ...rule,
        ok: rule.test(newPassword),
      })),
    [newPassword]
  );

  const allRulesMet = results.every(
    (rule) => rule.ok
  );

  const passwordsMatch =
    newPassword === confirmPassword &&
    confirmPassword.length > 0;


  /* =====================================================
     CHANGE PASSWORD
  ===================================================== */

  async function handleChangePassword(e) {
    e.preventDefault();

    setError("");

    if (!newPassword) {
      setError(
        "Please create a new password."
      );
      return;
    }

    if (!allRulesMet) {
      setError(
        "Your password does not meet all the requirements."
      );
      return;
    }

    if (!confirmPassword) {
      setError(
        "Please confirm your new password."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "The two passwords do not match."
      );
      return;
    }

    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      setError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * STEP 1:
       * Change the password in Firebase Authentication.
       */
      await updatePassword(
        firebaseUser,
        newPassword
      );

      /*
       * STEP 2:
       * Tell the Node.js backend that the password
       * has been changed.
       */
      const passwordStatus =
        await markPasswordChanged(
          firebaseUser
        );

      /*
       * STEP 3:
       * Tell Login.jsx that everything succeeded.
       */
      await onSuccess(passwordStatus);

    } catch (error) {
      console.error(
        "Password change error:",
        error
      );

      setError(
        error?.message ||
          "Unable to change your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">

      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-7 py-5">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FBF1F1] text-[#9D0A0E]">
            <ShieldAlert size={18} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#1F2937]">
              Change Your Password
            </h2>

            <p className="mt-0.5 text-xs text-[#6B7280]">
              Update your account password securely.
            </p>
          </div>

        </div>


        {/* =================================================
            FORM
        ================================================= */}

        <form
          onSubmit={handleChangePassword}
          className="space-y-4 px-7 pb-7 pt-5"
        >

          <p className="text-sm leading-6 text-[#4B5563]">
            For security, please create a strong new
            password before continuing.
          </p>


          {/* =================================================
              NEW PASSWORD
          ================================================= */}

          <PasswordField
            id="change-new-password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            disabled={loading}
            autoFocus
          />


          {/* =================================================
              CONFIRM PASSWORD
          ================================================= */}

          <PasswordField
            id="change-confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={loading}
          />


          {/* =================================================
              PASSWORD REQUIREMENTS
          ================================================= */}

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
                      ? "text-emerald-700"
                      : "text-[#4B5563]"
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


          {/* =================================================
              PASSWORD MATCH STATUS
          ================================================= */}

          {confirmPassword && (
            <div
              className={`flex items-center gap-2 text-xs ${
                passwordsMatch
                  ? "text-emerald-700"
                  : "text-[#9D0A0E]"
              }`}
            >
              {passwordsMatch ? (
                <CheckCircle2
                  size={14}
                  className="shrink-0 text-emerald-600"
                />
              ) : (
                <AlertTriangle
                  size={14}
                  className="shrink-0"
                />
              )}

              {passwordsMatch
                ? "Passwords match."
                : "Passwords do not match."}
            </div>
          )}


          {/* =================================================
              ERROR
          ================================================= */}

          <ErrorBox>
            {error}
          </ErrorBox>


          {/* =================================================
              SUBMIT
          ================================================= */}

          <button
            type="submit"
            disabled={
              loading ||
              !allRulesMet ||
              !passwordsMatch
            }
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#9D0A0E] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#7D080B] focus:outline-none focus:ring-4 focus:ring-[#9D0A0E]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Changing Password..."
              : "Change Password"}

            {!loading && (
              <ArrowRight size={16} />
            )}
          </button>


          {/* =================================================
              SECURITY FOOTER
          ================================================= */}

          <p className="flex items-center justify-center gap-1.5 border-t border-[#E5E7EB] pt-4 text-[10px] uppercase tracking-wide text-[#9CA3AF]">
            <Lock size={10} />
            256-bit encrypted hospital administration protocol
          </p>

        </form>

      </div>
    </div>
  );
}