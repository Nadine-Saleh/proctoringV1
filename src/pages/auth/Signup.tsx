import { useState, FormEvent, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup, getUserProfile } from '../../services/authService';
import { CustomDropdown, DropdownOption } from '../../components/ui/CustomDropdown';
import { 
  Eye, 
  EyeOff, 
  UserPlus, 
  Loader2, 
  Users, 
  GraduationCap 
} from 'lucide-react';

export function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'instructor',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({ ...prev, role: role as 'student' | 'instructor' }));
  };

  const roleOptions: DropdownOption[] = useMemo(() => [
    { 
      id: 'student', 
      label: 'Student', 
      description: 'Taking exams and viewing results',
      icon: <Users className="w-4 h-4" />
    },
    { 
      id: 'instructor', 
      label: 'Instructor', 
      description: 'Creating exams and proctoring',
      icon: <GraduationCap className="w-4 h-4" />
    }
  ], []);

  const validateForm = (): string | null => {
    if (!formData.fullName.trim()) {
      return 'Full name is required';
    }

    if (formData.fullName.trim().length < 2) {
      return 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      return 'Email is required';
    }

    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }

    if (formData.password.length > 100) {
      return 'Password must be less than 100 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError('');

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      const cleanFullName = formData.fullName.trim();

      const result = await signup({
        email: cleanEmail,
        password: formData.password,
        fullName: cleanFullName,
        role: formData.role,
      });

      if (!result.success) {
        let errorMessage = result.error || 'Signup failed';

        if (errorMessage.includes('User already registered')) {
          errorMessage = 'An account with this email already exists.';
        } else if (errorMessage.includes('email rate limit exceeded')) {
          errorMessage =
            'Too many email requests. Please try login if the account already exists, or create the user from Supabase with Auto Confirm.';
        } else if (errorMessage.includes('Email address')) {
          errorMessage =
            'This email was rejected. Please try another valid email address.';
        }

        setError(errorMessage);
        return;
      }

      const userProfile = await getUserProfile();

      const actualRole = userProfile?.role || formData.role;

      const redirectPath =
        actualRole === 'instructor' || actualRole === 'admin'
          ? '/instructor/pricing'
          : '/student/face-setup';

      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('[Signup] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh-burgundy flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center shadow-elevated mb-3">
            <UserPlus className="w-5 h-5 text-white" />
          </div>

          <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Examify
          </div>
        </div>

        <div className="card p-8 shadow-elevated">
          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-ink-900 tracking-tight2">
              Create your account
            </h1>

            <p className="text-sm text-ink-600 mt-1">
              Join Examify and start your secure exam experience.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-danger-50 border border-danger-200 rounded-lg animate-slide-down">
              <p className="text-sm text-danger-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="field-label">
                Full name
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                required
                className="field-input"
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>

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
              <CustomDropdown
                label="I am a..."
                options={roleOptions}
                value={formData.role}
                onChange={handleRoleChange}
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
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
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

            <div>
              <label htmlFor="confirmPassword" className="field-label">
                Confirm password
              </label>

              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="field-input pr-11"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-ink-500 hover:text-ink-800 hover:bg-ink-50 rounded-md"
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showConfirmPassword ? (
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
                  Creating account…
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

