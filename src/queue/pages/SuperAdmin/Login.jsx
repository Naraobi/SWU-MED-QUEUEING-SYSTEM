import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import LoginBG1 from '../../../assets/LoginBG1.jpg';
import Logo from '../../../assets/logo.png'; 

export default function Login() {
  const { signIn, user, role } = useAuth();
  const navigate = useNavigate();

  // Redirect if a session already exists
  useEffect(() => {
    if (user && role) {
      // Normalize the role to lowercase to prevent case-sensitivity issues
      const currentRole = role.trim().toLowerCase();

      if (currentRole === 'superadmin') {
        navigate('/superadmin/Dashboard');
      } else if (currentRole === 'admin') {
        navigate('/admin');
      } else if (currentRole === 'staff') {
        navigate('/staff');
      }
    }
  }, [user, role, navigate]);

  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrors({ email: 'Email is required.' });
      return;
    }

    if (!password) {
      setErrors({ password: 'Password is required.' });
      return;
    }

    setLoading(true);

    const { error, role: fetchedRoleRaw } = await signIn(trimmedEmail, password);

    setLoading(false);

    if (error) {
      setErrors({ form: error.message });
      return;
    }

    // Normalize the role to lowercase to prevent case-sensitivity issues
    const fetchedRole = fetchedRoleRaw ? fetchedRoleRaw.trim().toLowerCase() : '';

    if (fetchedRole === 'superadmin') {
      navigate('/superadmin/Dashboard');
    } else if (fetchedRole === 'admin') {
      navigate('/admin');
    } else if (fetchedRole === 'staff') {
      navigate('/staff');
    } else {
      // This will now show exactly what the database returned if it doesn't match
      setErrors({ form: `Your account has an invalid role: "${fetchedRoleRaw}"` });
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-start bg-cover bg-center bg-no-repeat px-8 md:px-16 lg:px-24"
      style={{ backgroundImage: `url(${LoginBG1})` }}
    >
      {/* Light overlay on the left side to ensure text legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-100/80 via-slate-100/40 to-transparent pointer-events-none" />

      {/* Main Container for Header + Form Card */}
      <div className="relative z-10 flex w-full max-w-xs sm:max-w-sm flex-col items-center">
        
        {/* LOGO & TITLE (Outside the White Card) */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img 
            src={Logo} 
            alt="SWUMed Logo" 
            className="h-16 w-auto object-contain mb-2" 
          />
          <div className="text-3xl font-extrabold tracking-tight">
            
          </div>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            Queuing System
          </p>
        </div>

        {/* LOGIN FORM CARD */}
        <div className="w-full rounded-xl bg-white p-6 shadow-xl border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Username
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example.swu@phinmaed.com"
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100"
              />

              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 pr-9 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {errors.form && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errors.form}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[#00569c] py-2.5 text-sm font-semibold text-white hover:bg-[#004278] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs font-medium text-[#00569c] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}