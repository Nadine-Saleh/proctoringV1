import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import { getUserProfile, type UserProfile, type UserRole } from '../services/authService';

interface UseAuthReturn {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    await fetchUserProfile();
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateRole = useCallback(async (role: UserRole) => {
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', user.id);

    if (!error) {
      setUser({ ...user, role });
    }
  }, [user]);

  useEffect(() => {
    fetchUserProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUserProfile();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    refreshUser,
    signOut,
    updateRole,
  };
}
