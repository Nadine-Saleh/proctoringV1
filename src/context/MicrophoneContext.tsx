// src/context/MicrophoneContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import { useMicrophone, UseMicrophoneReturn } from '../hooks/useMicrophone';

const MicrophoneContext = createContext<UseMicrophoneReturn | null>(null);

export const MicrophoneProvider = ({ children }: { children: ReactNode }) => {
  const microphone = useMicrophone();
  
  return (
    <MicrophoneContext.Provider value={microphone}>
      {children}
    </MicrophoneContext.Provider>
  );
};

export const useMicrophoneContext = (): UseMicrophoneReturn => {
  const context = useContext(MicrophoneContext);
  if (!context) {
    throw new Error('useMicrophoneContext must be used within a MicrophoneProvider');
  }
  return context;
};
