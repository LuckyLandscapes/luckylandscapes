import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create a client if we have credentials, otherwise export null
// The app checks isSupabaseConnected() to decide whether to hit Supabase or LocalStorage
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

/**
 * Returns true if Supabase environment variables are configured.
 * When false, the app runs in demo/localStorage mode.
 */
export function isSupabaseConnected() {
  return !!(supabaseUrl && supabaseAnonKey);
}
