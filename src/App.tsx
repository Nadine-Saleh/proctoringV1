import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';

import { AppProvider, useApp } from './context/AppContext';
import { MicrophoneProvider } from './context/MicrophoneContext';

import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';

import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';

import { Landing } from './pages/Landing';

import { StudentHome } from './pages/student/Home';
import { JoinExam } from './pages/student/JoinExam';
import { VerifyIdentity } from './pages/student/VerifyIdentity';
import { ReadyToStart } from './pages/student/ReadyToStart';
import { Exam } from './pages/student/Exam';
import { StudentResults } from './pages/student/Results';

import { InstructorDashboard } from './pages/instructor/Dashboard';
import { CreateExam } from './pages/instructor/CreateExam';
import { ExamDetail } from './pages/instructor/ExamDetail';
import { InstructorResults } from './pages/instructor/Results';
import { ProctoringReport } from './pages/instructor/Proctoring';
import { SubmissionDetail } from './pages/instructor/SubmissionDetail';

import { AdminDashboard } from './pages/admin/AdminDashboard';

function AppContent() {
  const { role, isAuthenticated, signOut, user, isLoading } = useApp();

  const location = useLocation();

  // check admin login
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // hide navbar in admin dashboard
  const hideNavigation = location.pathname.startsWith('/admin');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-50 grid-spotlight flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-brand-100" />
            <div className="absolute inset-0 rounded-full border-2 border-t-brand-700 animate-spin" />
          </div>

          <p className="text-sm font-medium text-ink-600">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  // IMPORTANT FIX
  // allow admin dashboard even if not authenticated from normal system
  if (!isAuthenticated && !isAdmin) {
    return (
      <div className="min-h-screen bg-ink-50">
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route path="/login" element={<Login />} />

          <Route path="/signup" element={<Signup />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Hide navbar in admin dashboard */}
      {!hideNavigation && (
        <Navigation
          onSignOut={signOut}
          userName={user?.full_name}
        />
      )}

      <Routes>
        {/* ADMIN ROUTE */}

        <Route path="/admin" element={<AdminDashboard />} />

        {/* STUDENT ROUTES */}

        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentHome />
            </ProtectedRoute>
          }
        />
        <Route
  path="/results"
  element={
    <ProtectedRoute requiredRole="student">
      <StudentResults />
    </ProtectedRoute>
  }
/>

        <Route
          path="/exam/join"
          element={
            <ProtectedRoute requiredRole="student">
              <JoinExam />
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

        {/* INSTRUCTOR ROUTES */}

        <Route
          path="/instructor"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/exams/new"
          element={
            <ProtectedRoute requiredRole="instructor">
              <CreateExam />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/exams/:examId"
          element={
            <ProtectedRoute requiredRole="instructor">
              <ExamDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/results"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorResults />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/exams/:examId/results/:sessionId"
          element={
            <ProtectedRoute requiredRole="instructor">
              <SubmissionDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/instructor/proctoring"
          element={
            <ProtectedRoute requiredRole="instructor">
              <ProctoringReport />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}

        <Route
          path="*"
          element={
            isAdmin ? (
              <Navigate to="/admin" replace />
            ) : role === 'student' ? (
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

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <MicrophoneProvider>
          <AppContent />
        </MicrophoneProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;