import { useState } from "react";
import {
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
} from "firebase/auth";

import { auth } from "../../firebase";
import { markPasswordChanged } from "../services/backendApi";

export default function ChangePasswordModal({
  onSuccess,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();

    setError("");

    // --------------------------------------------------
    // VALIDATE PASSWORD
    // --------------------------------------------------

    if (!newPassword) {
      setError("Please create a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
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

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">

        {/* -------------------------------------------- */}
        {/* HEADER */}
        {/* -------------------------------------------- */}

        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">
            Change Your Password
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            For security, please create a new password
            before continuing.
          </p>
        </div>

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
            </div>
          )}

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

        </form>
      </div>
    </div>
  );
}