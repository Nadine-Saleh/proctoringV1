import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, getUserProfile } from '../../services/authService';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      const email = formData.email.trim().toLowerCase();
      const password = formData.password;

      const loginPromise = login({
  email,
  password,
});

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Login request timeout'));
        }, 12000);
      });

      const result = await Promise.race([loginPromise, timeoutPromise]);

      if (!result.success) {
        let errorMessage = result.error || 'Login failed';

        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password.';
        }

        if (errorMessage.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email before signing in.';
        }

        if (errorMessage.includes('Failed to fetch')) {
          errorMessage = 'Connection failed. Please check Supabase URL and API key.';
        }

        setError(errorMessage);
        return;
      }

      let userProfile: { role?: string } | null = null;

      try {
        const profilePromise = getUserProfile();

        const profileTimeout = new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), 5000);
        });

        userProfile = await Promise.race([profilePromise, profileTimeout]);
      } catch (profileError) {
        console.error('[Login] Profile error:', profileError);
      }

      const detectedRole =
        userProfile?.role ||
        (email.includes('instructor') ? 'instructor' : 'student');

      const redirectPath =
        detectedRole === 'instructor' || detectedRole === 'admin'
          ? '/instructor/pricing'
          : '/student/face-setup';

      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('[Login] Error:', err);

      if (err instanceof Error && err.message === 'Login request timeout') {
        setError('Login is taking too long. Check Supabase connection or credentials.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh-burgundy flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center shadow-elevated mb-3">
            <LogIn className="w-5 h-5 text-white" />
          </div>

          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Examify
          </div>
        </div>

        <div className="card p-8 shadow-elevated">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-ink-900 tracking-tight2">
              Welcome back
            </h1>

            <p className="text-sm text-ink-600 mt-1">
              Sign in to continue to your dashboard.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-danger-50 border border-danger-200 rounded-lg animate-slide-down">
              <p className="text-sm text-danger-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="field-label">
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="field-input"
                placeholder="you@university.edu"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="field-input pr-11"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink-500 hover:text-ink-800 hover:bg-ink-50 rounded-md"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-lg btn-primary w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              Sign up
            </Link>
          </div>

          <div className="mt-7 pt-6 border-t border-ink-100 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">
              Demo Credentials
            </p>

            <div className="text-xs text-ink-500 font-mono space-y-1">
              <p>student@test.com / password123</p>
              <p>instructor@test.com / password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}