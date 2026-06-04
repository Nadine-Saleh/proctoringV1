import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, getUserProfile } from '../../services/authService';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login({ email, password });

      if (!result.success) {
        let errorMessage = result.error || 'Login failed';

        if (errorMessage.includes('Invalid login credentials')) {
          errorMessage =
            'Invalid email or password. Please check your credentials.';
        } else if (errorMessage.includes('Email not confirmed')) {
          errorMessage =
            'Please verify your email address before logging in.';
        }

        setError(errorMessage);
        return;
      }

      // Fetch user profile to determine redirect
      const userProfile = await getUserProfile();

      const redirectPath =
        userProfile?.role === 'instructor' || userProfile?.role === 'admin'
          ? '/instructor'
          : '/student/face-setup';

      navigate(redirectPath);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('[Login] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh-burgundy flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Brand mark */}
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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="field-input pr-11"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink-500 hover:text-ink-800 hover:bg-ink-50 rounded-md transition-colors"
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
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              Sign up
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-ink-100">
            <p className="text-2xs uppercase tracking-wider text-ink-500 text-center mb-2 font-semibold">
              Demo credentials
            </p>
            <div className="text-2xs text-ink-500 space-y-1 font-mono text-center">
              <p>student@test.com&nbsp;/&nbsp;password123</p>
              <p>instructor@test.com&nbsp;/&nbsp;password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}