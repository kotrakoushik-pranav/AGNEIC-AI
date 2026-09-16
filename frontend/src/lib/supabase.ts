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

// Supabase is considered configured only when both vars are non-empty
// and don't contain placeholder text
function isConfigured(url: string, key: string): boolean {
  if (!url || !url.trim()) return false;
  if (!key || !key.trim()) return false;
  if (url.includes('YOUR_PROJECT_ID') || url.includes('placeholder')) return false;
  if (key.includes('placeholder')) return false;
  return true;
}

export const supabaseConfigured = isConfigured(supabaseUrl, supabaseAnonKey);

if (!supabaseConfigured) {
  console.info(
    '[Supabase] Not configured — running in local-development mode. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env to enable Auth + Realtime.',
  );
}

export const supabase = createClient<Database>(
  supabaseUrl?.trim() || 'https://placeholder.supabase.co',
  supabaseAnonKey?.trim() || 'placeholder',
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
