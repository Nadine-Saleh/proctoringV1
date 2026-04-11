import { supabase } from '../lib/supabase/client';

export type UserRole = 'student' | 'instructor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Sign up a new user and create their profile
 */
export async function signup({ email, password, fullName, role }: SignupData) {
  try {
    // Validate password (Supabase requires min 6 characters)
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email address' };
    }

    console.log('[AuthService] Attempting signup:', { email, fullName, role });

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
        // Disable email confirmation for development
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      console.error('[AuthService] Signup error:', authError);
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      console.error('[AuthService] No user returned from signup');
      return { success: false, error: 'Failed to create user account' };
    }

    console.log('[AuthService] Auth user created:', authData.user.id);

    // Step 2: Create user profile in public.users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: fullName,
        role: role,
      } as any);

    if (profileError) {
      console.error('[AuthService] Profile creation error:', profileError);
      return { success: false, error: `Failed to create profile: ${profileError.message}` };
    }

    console.log('[AuthService] Signup successful');
    return { success: true, user: authData.user };
  } catch (error) {
    console.error('[AuthService] Unexpected signup error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    };
  }
}

/**
 * Sign in an existing user
 */
export async function login({ email, password }: LoginData) {
  try {
    console.log('[AuthService] Attempting login:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: error.message };
    }

    console.log('[AuthService] Login successful');
    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('[AuthService] Unexpected login error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    };
  }
}

/**
 * Sign out the current user
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Get the current user's profile
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[Auth] Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: Partial<UserProfile>) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('users')
    .update(updates as any)
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if user is authenticated
 */
export async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  return user !== null;
}

/**
 * Get session info
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
