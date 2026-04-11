import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { StudentHome } from './pages/student/Home';
import { Exam } from './pages/student/Exam';
import { StudentResults } from './pages/student/Results';
import { InstructorDashboard } from './pages/instructor/Dashboard';
import { CreateExam } from './pages/instructor/CreateExam';
import { InstructorResults } from './pages/instructor/Results';
import { ProctoringReport } from './pages/instructor/Proctoring';

function AppContent() {
  const { role, isAuthenticated, signOut, user, isLoading } = useApp();

  // Show loading spinner while checking auth
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

  // If not authenticated, show auth routes
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

  // Authenticated routes
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onSignOut={signOut} userName={user?.full_name} />
      <Routes>
        {/* Student Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam"
          element={
            <ProtectedRoute requiredRole="student">
              <Exam />
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
        {/* Instructor Routes */}
        <Route
          path="/instructor"
          element={
            <ProtectedRoute requiredRole="instructor">
              <InstructorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/create"
          element={
            <ProtectedRoute requiredRole="instructor">
              <CreateExam />
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
          path="/instructor/proctoring"
          element={
            <ProtectedRoute requiredRole="instructor">
              <ProctoringReport />
            </ProtectedRoute>
          }
        />
        {/* Redirect unknown routes */}
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
