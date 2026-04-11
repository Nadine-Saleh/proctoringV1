import { createClient } from '@supabase/supabase-js';

// Database types (will be generated from schema)
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Simplified database types to avoid strict type checking
export type Database = any;

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client (without strict types for now)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to get current auth user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper to check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return user !== null;
};
