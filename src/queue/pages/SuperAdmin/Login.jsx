import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../services/Authcontext';
import { getLandingPath } from '../../services/accessControl';
import LoginBG1 from '../../../assets/LoginBG1.jpg';
import Logo from '../../../assets/logo.png';

export default function Login() {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      const path = getLandingPath(user);
      if (path) navigate(path, { replace: true });
    }
  }, [user, authLoading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setErrors({ email: 'Email is required.' });
    if (!password) return setErrors({ password: 'Password is required.' });

    setLoading(true);
    const result = await signIn(trimmedEmail, password);
    setLoading(false);

    if (result.error) {
      setErrors({ form: result.error.message });
      return;
    }

    const path = getLandingPath(result.user);
    if (path) {
      navigate(path, { replace: true });
    } else {
      setErrors({ form: 'Your account does not have a valid role or access level.' });
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-start bg-cover bg-center bg-no-repeat px-8 md:px-16 lg:px-24" style={{ backgroundImage: `url(${LoginBG1})` }}>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-100/80 via-slate-100/40 to-transparent pointer-events-none" />
      <div className="relative z-10 flex w-full max-w-xs sm:max-w-sm flex-col items-center">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={Logo} alt="SWUMed Logo" className="h-16 w-auto object-contain mb-2" />
          <p className="mt-0.5 text-xs font-semibold text-slate-500">Queuing System</p>
        </div>

        <div className="w-full rounded-xl border border-slate-100 bg-white p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-semibold text-slate-600">Username</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example.swu@phinmaed.com" autoComplete="email" disabled={loading} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" disabled={loading} className="w-full rounded-md border border-slate-300 px-3 py-2 pr-9 text-sm focus:border-[#00569c] focus:outline-none disabled:bg-slate-100" />
                <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'} disabled={loading}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            {errors.form && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errors.form}</div>}

            <button type="submit" disabled={loading} className="w-full rounded-md bg-[#00569c] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#004278] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <div className="pt-1 text-center">
              <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs font-medium text-[#00569c] hover:underline">Forgot Password?</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
