import { createContext, useContext, useState, ReactNode } from 'react';

type UserRole = 'student' | 'instructor';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentExam: any | null;
  setCurrentExam: (exam: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('student');
  const [currentExam, setCurrentExam] = useState<any | null>(null);

  return (
    <AppContext.Provider value={{ role, setRole, currentExam, setCurrentExam }}>
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
