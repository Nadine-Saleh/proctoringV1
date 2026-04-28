import { useState, useEffect, useCallback, useRef } from 'react';
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
  const isFetchingRef = useRef(false);

  const fetchUserProfile = useCallback(async (force = false) => {
    if (isFetchingRef.current && !force) return;
    
    isFetchingRef.current = true;
    try {
      const profile = await getUserProfile();
      setUser(profile);
    } catch (error) {
      console.error('[useAuth] Error fetching profile:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    await fetchUserProfile(true);
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
    // Initial fetch
    fetchUserProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUserProfile();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION') {
          // If INITIAL_SESSION fires and we have no session, we're definitely not logged in
          if (!session) {
            setIsLoading(false);
          } else {
            await fetchUserProfile();
          }
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
