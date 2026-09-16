import { useState } from "react";
import { updatePassword } from "firebase/auth";

import { auth } from "../../firebase";
import { markPasswordChanged } from "../services/backendApi";

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

  async function handleChangePassword(e) {
    e.preventDefault();

    setError("");

    if (!newPassword) {
      setError("Please create a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        "Passwords do not match."
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
       *
       * This updates:
       * - MySQL
       * - Firestore
       * - must_change_password = false
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
          "Unable to change password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">

        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">
            Change Your Password
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            For security, please create a new password
            before continuing.
          </p>
        </div>

        <form
          onSubmit={handleChangePassword}
          className="space-y-4"
        >
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100"
            />
          </div>

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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

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

