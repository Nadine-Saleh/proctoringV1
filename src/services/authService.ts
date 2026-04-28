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

export async function signup({ email, password, fullName, role }: SignupData) {
  try {
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email address' };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user account' };
    }

    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
      } as any);

    if (profileError) {
      return { success: false, error: `Failed to create profile: ${profileError.message}` };
    }

    return { success: true, user: authData.user };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

export async function login({ email, password }: LoginData) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    // Use getSession() instead of getUser() for faster initial load
    // it retrieves the session from local storage without necessarily a network request
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return null;
    }

    const user = session.user;

    // Fetch user profile from database
    const { data: dbData, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (dbError || !dbData) {
      return await createMissingProfile(user);
    }

    return dbData as UserProfile;
  } catch (error) {
    console.error('[authService] getUserProfile error:', error);
    return null;
  }
}

async function createMissingProfile(user: any): Promise<UserProfile | null> {
  try {
    const userMetadata = user.user_metadata || {};
    const fullName = userMetadata.full_name || user.email?.split('@')[0] || 'User';
    const role = userMetadata.role || 'student';

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        role,
      } as any)
      .select()
      .single();

    if (error) {
      return null;
    }

    return data as UserProfile;
  } catch {
    return null;
  }
}

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

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  return user !== null;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
