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

/**
 * Custom hook for authentication state management
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    try {
      const profile = await getUserProfile();
      if (profile) {
        setUser(profile);
      } else {
        console.warn('[useAuth] Profile fetch/creation failed, user may need manual setup');
        setUser(null);
      }
    } catch (error) {
      console.error('[useAuth] Error fetching user profile:', error);
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[useAuth] Error signing out:', error);
    }
    setUser(null);
  }, []);

  const updateRole = useCallback(async (role: UserRole) => {
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update({ role } as any)
      .eq('id', user.id);

    if (error) {
      console.error('[useAuth] Error updating role:', error);
      return;
    }

    setUser({ ...user, role });
  }, [user]);

  // Listen for auth state changes
  useEffect(() => {
    // Initial load
    fetchUserProfile();

    // Subscribe to auth changes
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

    // Cleanup subscription
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
