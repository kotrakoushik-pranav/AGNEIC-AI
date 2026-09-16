/**
 * supabase.ts — Supabase client singleton.
 *
 * Only public keys are used here (VITE_ prefix = exposed to browser).
 * The service-role key NEVER goes in frontend code.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || supabaseUrl.includes('YOUR_PROJECT_ID')) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL is not configured. ' +
    'Copy frontend/.env.example → frontend/.env and fill in your Supabase credentials.',
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);

export type SupabaseClient = typeof supabase;
