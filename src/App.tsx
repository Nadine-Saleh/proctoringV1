import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
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

function AppContent() {
  const { role, isAuthenticated, signOut, user, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onSignOut={signOut} userName={user?.full_name} />
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentHome />
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

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
