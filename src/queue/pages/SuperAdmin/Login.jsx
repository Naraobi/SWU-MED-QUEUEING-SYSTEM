import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import { getLandingPath } from '../../services/accessControl';
import ChangePasswordModal from '../../components/changePasswordModal';
import LoginBG1 from '../../../assets/LoginBG1.jpg';
import Logo from '../../../assets/logo.png';

export default function Login() {
  const { signIn } = useAuth();
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

      /*
      |--------------------------------------------------------------------------
      | FIRST LOGIN PASSWORD CHANGE
      |--------------------------------------------------------------------------
      |
      | If the account was created with a temporary password,
      | show the Change Password popup after successful login.
      |
      */

      if (
        result.user?.must_change_password === true
      ) {
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
      className="relative flex min-h-screen items-center justify-start bg-cover bg-center bg-no-repeat px-8 md:px-16 lg:px-24"
      style={{
        backgroundImage: `url(${LoginBG1})`,
      }}
    >
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">

        {/* =====================================================
            LOGO + TITLE
        ===================================================== */}

        <div className="flex flex-col items-center text-center">
          <img
            src={Logo}
            alt="SWUMed"
            className="h-8 w-auto object-contain"
          />

          <p className="mt-2 text-base font-bold text-[#1F2937]">
            Queuing Management System
          </p>
        </div>

        <div className="mt-4 border-t border-[#E5E7EB]" />

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4"
        >

          {/* =================================================
              EMAIL
          ================================================= */}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-[#1F2937]"
            >
              Username
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
              className="w-full rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
            />

            {errors.email && (
              <p className="mt-1.5 text-xs text-[#9D0A0E]">
                {errors.email}
              </p>
            )}
          </div>

          {/* =================================================
              PASSWORD
          ================================================= */}

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-[#1F2937]"
            >
              Password
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
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
                className="w-full rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2.5 pr-10 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#9D0A0E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/20 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (prev) => !prev
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#4B5563] transition hover:text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
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

            {/* =================================================
                FORGOT PASSWORD
            ================================================= */}

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/forgot-password'
                  )
                }
                className="rounded text-xs font-medium text-[#9D0A0E] transition hover:underline focus:outline-none focus:ring-2 focus:ring-[#9D0A0E]/30"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {/* =================================================
              GENERAL ERROR
          ================================================= */}

          {errors.form && (
            <div className="rounded-md border border-[#9D0A0E]/20 bg-[#9D0A0E]/5 px-3 py-2 text-xs text-[#9D0A0E]">
              {errors.form}
            </div>
          )}

          {/* =================================================
              LOGIN BUTTON
          ================================================= */}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#9D0A0E] py-3 text-sm font-bold text-white transition-colors hover:bg-[#7D080B] focus:outline-none focus:ring-4 focus:ring-[#9D0A0E]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? 'Logging in...'
              : 'Login'}

            {!loading && <LogIn size={16} />}
          </button>

        </form>

        {/* =====================================================
            FOOTER
        ===================================================== */}

        <p className="mt-4 text-center text-xs text-[#4B5563]">
          For authorized users only.
        </p>
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