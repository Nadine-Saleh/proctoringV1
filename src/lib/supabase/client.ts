import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('SUPABASE URL:', supabaseUrl);
console.log('SUPABASE KEY EXISTS:', Boolean(supabaseAnonKey));

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL in .env file');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);