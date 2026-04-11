import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../services/authService';

type AppUserRole = 'student' | 'instructor';

interface AppContextType {
  role: AppUserRole;
  setRole: (role: AppUserRole) => void;
  currentExam: any | null;
  setCurrentExam: (exam: any) => void;
  // Auth state
  user: ReturnType<typeof useAuth>['user'];
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  
  // Derive app role from user role
  const getAppRole = (userRole?: string): AppUserRole => {
    if (!userRole) return 'student';
    return userRole === 'instructor' || userRole === 'admin' 
      ? 'instructor' 
      : 'student';
  };

  const [role, setRole] = useState<AppUserRole>(getAppRole(auth.user?.role));
  const [currentExam, setCurrentExam] = useState<any | null>(null);

  // Update role when user changes
  useEffect(() => {
    if (auth.user) {
      setRole(getAppRole(auth.user.role));
    }
  }, [auth.user]);

  return (
    <AppContext.Provider 
      value={{ 
        role, 
        setRole, 
        currentExam, 
        setCurrentExam,
        // Auth state
        user: auth.user,
        isLoading: auth.isLoading,
        isAuthenticated: auth.isAuthenticated,
        signOut: auth.signOut,
        updateRole: auth.updateRole,
      }}
    >
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
