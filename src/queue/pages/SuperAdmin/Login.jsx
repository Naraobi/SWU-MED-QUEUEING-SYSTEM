import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import { getLandingPath } from '../../services/accessControl';
import ChangePasswordModal from '../../components/changePasswordModal';
import LoginBG1 from '../../../assets/LoginBG1.jpg';
import Logo from '../../../assets/logo.png';

export default function Login() {
 const {
  signIn, signInWithGoogle,} = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // false = password hidden
  // true = password visible
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [showChangePassword, setShowChangePassword] =
    useState(false);

  const [loggedInUser, setLoggedInUser] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | TERMS AGREEMENT
  |--------------------------------------------------------------------------
  |
  | Once someone agrees and logs in successfully, this browser remembers it
  | and the checkbox is hidden on every later login.
  |
  */
  const TERMS_KEY = 'swumed_terms_accepted';

  const [alreadyAgreed] = useState(
    () => localStorage.getItem(TERMS_KEY) === 'true'
  );

  const [agreedToTerms, setAgreedToTerms] =
    useState(alreadyAgreed);

  async function handleSubmit(e) {
    e.preventDefault();

    setErrors({});

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return setErrors({
        email: 'Email is required.',
      });
    }

    if (!password) {
      return setErrors({
        password: 'Password is required.',
      });
    }

    setLoading(true);

    try {
      const result = await signIn(
        trimmedEmail,
        password
      );

      if (result.error) {
        setErrors({
          form: result.error.message,
        });

        return;
      }

      // Login succeeded - remember the agreement on this browser so the
      // checkbox is not shown again on later logins.
      localStorage.setItem(TERMS_KEY, 'true');

      /*
      |--------------------------------------------------------------------------
      | FIRST LOGIN PASSWORD CHANGE
      |--------------------------------------------------------------------------
      |
      | If the account was created with a temporary password,
      | show the Change Password popup after successful login.
      |
      */

if (result.user?.must_change_password === true) {
  setLoggedInUser(result.user);
  setShowChangePassword(true);
  return;
}
      /*
      |--------------------------------------------------------------------------
      | NORMAL LOGIN
      |--------------------------------------------------------------------------
      */

      const path = getLandingPath(
        result.user
      );

      if (path) {
        navigate(path, {
          replace: true,
        });
      } else {
        setErrors({
          form:
            'Your account does not have a valid role or access level.',
        });
      }
    } catch (error) {
      console.error(
        'LOGIN ERROR:',
        error
      );

      setErrors({
        form:
          error?.message ||
          'Unable to log in. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | GOOGLE SIGN-IN  (NOT WIRED YET)
  |--------------------------------------------------------------------------
  |
  | The design includes a "Continue with Google" button, but the project has
  | no Google provider configured. When the backend team enables it, replace
  | the body of this function with a Firebase signInWithPopup(GoogleAuthProvider)
  | call and then reuse the same getLandingPath(...) redirect as handleSubmit.
  |
  */
 async function handleGoogleSignIn() {
  setErrors({});
  setLoading(true);

  try {
    const result =
      await signInWithGoogle(
        email,
        password
      );

    if (result?.error) {
      setErrors({
        form: result.error.message,
      });

      return;
    }

    if (
      result.user?.must_change_password === true  ||
    result.hasPasswordProvider === false
    ) {
      setLoggedInUser(
        result.user
      );

      setShowChangePassword(
        true
      );

      return;
    }

    if (result?.user) {
      navigate(
        getLandingPath(
          result.user
        )
      );
    }

  } finally {
    setLoading(false);
  }
}


async function handlePasswordChangeSuccess(
  passwordStatus = {}
) {
  if (!loggedInUser) {
    setErrors({
      form:
        'Unable to retrieve your account information.',
    });

    return;
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE LOCAL USER
  |--------------------------------------------------------------------------
  |
  | The backend has already confirmed that the password
  | was changed successfully.
  |
  */

  const updatedUser = {
    ...loggedInUser,

    must_change_password: false,

    password_changed_at:
      passwordStatus.password_changed_at ||
      new Date().toISOString(),
  };

  setLoggedInUser(updatedUser);

  setShowChangePassword(false);

  /*
  |--------------------------------------------------------------------------
  | GO TO DASHBOARD
  |--------------------------------------------------------------------------
  */

  const path =
    getLandingPath(updatedUser);

  if (path) {
    navigate(path, {
      replace: true,
    });
  } else {
    setErrors({
      form:
        'Your account does not have a valid role or access level.',
    });
  }
}


  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${LoginBG1})`,
      }}
    >
      {/* Maroon wash over the building photo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#6B1119]/45"
      />

      <div className="relative z-10 flex min-h-screen flex-col gap-8 px-4 py-6 sm:px-8 lg:flex-row lg:items-stretch lg:gap-12 lg:px-12 lg:py-10">

        {/* =====================================================
            LOGIN CARD
        ===================================================== */}

        <div className="swu-pop w-full shrink-0 self-center rounded-2xl bg-white p-8 shadow-2xl sm:p-10 lg:max-w-md">

          {/* LOGO + TITLE */}

          <div className="flex flex-col items-center text-center">
            <img
              src={Logo}
              alt="SWUMed"
              className="h-9 w-auto object-contain"
            />

            <p className="mt-2 text-base font-bold text-[#1F2937]">
              Queuing Management System
            </p>
          </div>

          <div className="my-5 border-t border-[#E5E7EB]" />

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

            {/* EMAIL */}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-[#1F2937]"
              >
                Email
                <span className="ml-0.5 text-[#9D0A0E]">*</span>
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="example.swu@phinmaed.com"
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-md border border-[#E5E7EB] bg-[#F1F3F5] px-3 py-2.5 text-sm text-[#1F2937] transition-all duration-200 placeholder:text-[#9CA3AF] hover:border-[#9CA3AF] hover:bg-white focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
              />

              {errors.email && (
                <p className="mt-1.5 text-xs text-[#9D0A0E]">
                  {errors.email}
                </p>
              )}
            </div>

            {/* PASSWORD */}

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-[#1F2937]"
              >
                Password
                <span className="ml-0.5 text-[#9D0A0E]">*</span>
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-md border border-[#E5E7EB] bg-[#F1F3F5] px-3 py-2.5 pr-10 text-sm text-[#1F2937] transition-all duration-200 placeholder:text-[#9CA3AF] hover:border-[#9CA3AF] hover:bg-white focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (prev) => !prev
                    )
                  }
                  className="swu-press absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#4B5563] transition-colors hover:bg-[#F1F3F5] hover:text-[#9D0A0E] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="mt-1.5 text-xs text-[#9D0A0E]">
                  {errors.password}
                </p>
              )}

              {/* FORGOT PASSWORD */}

              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      '/forgot-password'
                    )
                  }
                  className="swu-press rounded text-xs font-semibold text-[#9D0A0E] underline-offset-4 transition-colors hover:text-[#7D080B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* TERMS */}

            {!alreadyAgreed && (
              <label className="-mx-2 flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs text-[#4B5563] transition-colors hover:bg-[#F8F9FA]">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) =>
                    setAgreedToTerms(
                      e.target.checked
                    )
                  }
                  disabled={loading}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[#9CA3AF] accent-[#9D0A0E] focus:ring-2 focus:ring-[#9D0A0E]/30"
                />

                <span>
                  I agree to the{' '}
                  <span className="font-semibold text-[#9D0A0E]">
                    Terms &amp; Conditions
                  </span>
                  {' '}and{' '}
                  <span className="font-semibold text-[#9D0A0E]">
                    Privacy Policy
                  </span>
                  .
                </span>
              </label>
            )}

            {/* GENERAL ERROR */}

            {errors.form && (
              <div className="swu-enter rounded-md border border-[#F0DADA] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9D0A0E]">
                {errors.form}
              </div>
            )}

            {/* LOGIN */}

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="swu-press group flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-3 text-base font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#7D080B] hover:shadow-lg hover:shadow-[#9D0A0E]/25 focus:outline-none focus:ring-4 focus:ring-[#9D0A0E]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm"
            >
              {loading
                ? 'Logging in...'
                : 'Login'}

              {!loading && <LogIn size={18} />}
            </button>

            {/* OR */}

            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-[#E5E7EB]" />

              <span className="text-xs font-medium text-[#9CA3AF]">
                OR
              </span>

              <span className="h-px flex-1 bg-[#E5E7EB]" />
            </div>

            {/* GOOGLE */}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="swu-press flex w-full items-center justify-center gap-2 rounded-md border border-[#E5E7EB] bg-white py-2.5 text-sm font-medium text-[#1F2937] transition-all duration-200 hover:border-[#9CA3AF] hover:bg-[#F8F9FA] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5h-1.9V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.8 35.9 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z" />
              </svg>

              Continue with Google
            </button>

          </form>

          {/* FOOTER */}

          <p className="mt-5 text-center text-xs text-[#6B7280]">
            For authorized users only.
          </p>
        </div>

        {/* =====================================================
            WELCOME PANEL
        ===================================================== */}

        <div className="swu-enter hidden flex-1 flex-col justify-end pb-12 lg:flex">
          <h1 className="text-3xl font-bold text-white">
            Welcome to SWUMed
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-white/90">
            Smart Queueing &amp; Workstation Management System designed to
            optimize patient routing, terminal efficiency, and department
            queues across clinical divisions.
          </p>
        </div>

      </div>

      {/* =====================================================
          CHANGE PASSWORD POPUP
      ===================================================== */}

      {showChangePassword && (
        <ChangePasswordModal
          onSuccess={
            handlePasswordChangeSuccess
          }
        />
      )}
    </div>
  );
}