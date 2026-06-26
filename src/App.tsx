import { useEffect, useState, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { AppProvider, useApp } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './lib/supabase/client';

import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { Landing } from './pages/Landing';

import { StudentHome } from './pages/student/Home';
import { JoinExam } from './pages/student/JoinExam';
import { VerifyIdentity } from './pages/student/VerifyIdentity';
import { FaceSetup } from './pages/student/FaceSetup';
import { ReadyToStart } from './pages/student/ReadyToStart';
import { Exam } from './pages/student/Exam';
import { StudentResults } from './pages/student/Results';

import { InstructorDashboard } from './pages/instructor/Dashboard';
import { CreateExam } from './pages/instructor/CreateExam';
import { ExamDetail } from './pages/instructor/ExamDetail';
import { InstructorResults } from './pages/instructor/Results';
import { ProctoringReport } from './pages/instructor/Proctoring';
import { SubmissionDetail } from './pages/instructor/SubmissionDetail';
import InstructorPricing from './pages/instructor/InstructorPricing';
import InstructorCheckout from './pages/instructor/InstructorCheckout';

type SubscriptionState = 'checking' | 'active' | 'pending' | 'inactive';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <p className="text-sm text-ink-600">Loading...</p>
    </div>
  );
}

function LandingReturnButton() {
  const navigate = useNavigate();
  const { signOut } = useApp();

  const goToLanding = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <button
      type="button"
      onClick={goToLanding}
      style={{
        position: 'fixed',
        top: '22px',
        right: '88px',
        zIndex: 9999,
        width: '34px',
        height: '34px',
        border: 'none',
        background: 'transparent',
        color: '#6b5d63',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      title="Back to landing page"
      aria-label="Back to landing page"
    >
      <LogOut size={18} />
    </button>
  );
}

function PendingSubscriptionNotice() {
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md card p-8 text-center shadow-elevated">
        <h1 className="text-2xl font-semibold text-ink-900 mb-3">
          Payment under review
        </h1>

        <p className="text-sm text-ink-600 leading-6">
          Your subscription payment has been submitted and is currently pending
          approval. Once approved, you will be able to access your instructor
          dashboard.
        </p>
      </div>
    </div>
  );
}

function InstructorSubscriptionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>('checking');

  useEffect(() => {
    let mounted = true;

    const checkSubscription = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (mounted) setState('inactive');
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('subscription_status, subscription_expires_at')
          .eq('id', user.id)
          .maybeSingle();

        if (error || !data) {
          if (mounted) setState('inactive');
          return;
        }

        const status = data.subscription_status;
        const expiresAt = data.subscription_expires_at;

        const isExpired = expiresAt
          ? new Date(expiresAt).getTime() <= Date.now()
          : false;

        if (status === 'active' && !isExpired) {
          if (mounted) setState('active');
          return;
        }

        if (status === 'pending') {
          if (mounted) setState('pending');
          return;
        }

        if (mounted) setState('inactive');
      } catch {
        if (mounted) setState('inactive');
      }
    };

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  if (state === 'checking') {
    return <LoadingScreen />;
  }

  if (state === 'pending') {
    return <PendingSubscriptionNotice />;
  }

  if (state === 'inactive') {
    return <Navigate to="/instructor/pricing" replace />;
  }

  return <>{children}</>;
}

function InstructorPaymentRedirect({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>('checking');

  useEffect(() => {
    let mounted = true;

    const checkSubscription = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (mounted) setState('inactive');
          return;
        }

        const { data } = await supabase
          .from('users')
          .select('subscription_status, subscription_expires_at')
          .eq('id', user.id)
          .maybeSingle();

        const status = data?.subscription_status;
        const expiresAt = data?.subscription_expires_at;

        const isExpired = expiresAt
          ? new Date(expiresAt).getTime() <= Date.now()
          : false;

        if (status === 'active' && !isExpired) {
          if (mounted) setState('active');
          return;
        }

        if (status === 'pending') {
          if (mounted) setState('pending');
          return;
        }

        if (mounted) setState('inactive');
      } catch {
        if (mounted) setState('inactive');
      }
    };

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  if (state === 'checking') {
    return <LoadingScreen />;
  }

  if (state === 'active') {
    return <Navigate to="/instructor" replace />;
  }

  if (state === 'pending') {
    return <PendingSubscriptionNotice />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { role, isAuthenticated, isLoading } = useApp();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div>
      <Navigation />
      <LandingReturnButton />

      <Routes>
        <Route
          path="/"
          element={
            role === 'student' ? (
              <ProtectedRoute requiredRole="student">
                <StudentHome />
              </ProtectedRoute>
            ) : (
              <Navigate to="/instructor" replace />
            )
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/join"
          element={
            <ProtectedRoute requiredRole="student">
              <JoinExam />
            </ProtectedRoute>
          }
        />

        <Route
          path="/join"
          element={
            <ProtectedRoute requiredRole="student">
              <JoinExam />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/face-setup"
          element={
            <ProtectedRoute requiredRole="student">
              <FaceSetup />
            </ProtectedRoute>
          }
        />

        <Route
          path="/exam/:sessionId/verify"
          element={
            <ProtectedRoute requiredRole="student">
              <VerifyIdentity />
            </ProtectedRoute>
          }
        />

        <Route
          path="/exam/:sessionId/ready"
          element={
            <ProtectedRoute requiredRole="student">
              <ReadyToStart />
            </ProtectedRoute>
          }
        />

        <Route
          path="/exam/:sessionId"
          element={
            <ProtectedRoute requiredRole="student">
              <Exam />
            </ProtectedRoute>
          }
        />

        <Route
          path="/exam/:sessionId/results"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentResults />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/pricing"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorPaymentRedirect>
                <InstructorPricing />
              </InstructorPaymentRedirect>
            </ProtectedRoute>
          }
        />

        <Route
          path="/checkout"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorPaymentRedirect>
                <InstructorCheckout />
              </InstructorPaymentRedirect>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/checkout"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorPaymentRedirect>
                <InstructorCheckout />
              </InstructorPaymentRedirect>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <InstructorDashboard />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/create"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <CreateExam />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/exams/:examId"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <ExamDetail />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/exams/:examId/results"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <InstructorResults />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/results"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <InstructorResults />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/proctoring/:sessionId"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <ProctoringReport />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/submissions/:submissionId"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorSubscriptionGate>
                <SubmissionDetail />
              </InstructorSubscriptionGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            role === 'student' ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/instructor" replace />
            )
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </BrowserRouter>
  );
}