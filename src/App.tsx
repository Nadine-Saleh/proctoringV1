import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { StudentHome } from './pages/student/Home';
import { Exam } from './pages/student/Exam';
import { StudentResults } from './pages/student/Results';
import { InstructorDashboard } from './pages/instructor/Dashboard';
import { CreateExam } from './pages/instructor/CreateExam';
import { InstructorResults } from './pages/instructor/Results';
import { ProctoringReport } from './pages/instructor/Proctoring';

const StudentRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<StudentHome />} />
      <Route path="/exam" element={<Exam />} />
      <Route path="/results" element={<StudentResults />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const InstructorRoutes = () => {
  return (
    <Routes>
      <Route path="/instructor" element={<InstructorDashboard />} />
      <Route path="/instructor/create" element={<CreateExam />} />
      <Route path="/instructor/results" element={<InstructorResults />} />
      <Route path="/instructor/proctoring" element={<ProctoringReport />} />
      <Route path="*" element={<Navigate to="/instructor" replace />} />
    </Routes>
  );
};

const AppContent = () => {
  const { role } = useApp();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      {role === 'student' ? <StudentRoutes /> : <InstructorRoutes />}
    </div>
  );
};

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
