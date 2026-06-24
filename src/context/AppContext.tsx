import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../services/authService';
// 'Exam' type isn't exported from ../services/ExamService. Use a local fallback type.
// Adjust this to the real shape if/when Exam is exported.
type Exam = any;

type AppUserRole = 'student' | 'instructor';

interface AppContextType {
  role: AppUserRole;
  setRole: (role: AppUserRole) => void;
  currentExam: Exam | null;
  setCurrentExam: (exam: Exam) => void;
  user: ReturnType<typeof useAuth>['user'];
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();

  const getAppRole = (userRole?: string): AppUserRole => {
    if (!userRole) return 'student';
    return userRole === 'instructor' || userRole === 'admin' ? 'instructor' : 'student';
  };

  const [role, setRole] = useState<AppUserRole>(getAppRole(auth.user?.role));
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);

  useEffect(() => {
    if (auth.user) {
      setRole(getAppRole(auth.user.role));
    }
  }, [auth.user]);

  const contextValue = useMemo(() => ({
    role,
    setRole,
    currentExam,
    setCurrentExam,
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    signOut: auth.signOut,
    updateRole: auth.updateRole,
  }), [role, auth.user, auth.isLoading, auth.isAuthenticated, auth.signOut, auth.updateRole, currentExam]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
