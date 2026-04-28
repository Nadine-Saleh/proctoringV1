import { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole, Exam, AppContextType } from '../types';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('student');
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);

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
