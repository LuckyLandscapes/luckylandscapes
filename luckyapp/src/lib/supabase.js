import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns true if Supabase environment variables are configured.
 * When false, the app runs in demo/localStorage mode.
 */
export function isSupabaseConnected() {
  return !!(supabaseUrl && supabaseAnonKey);
}
