/**
 * AuthContext — provides Supabase session + user profile throughout the app.
 *
 * Wraps the entire app. Any child can call useAuth() to get:
 *   session, user, profile, loading, signIn, signUp, signOut, authError
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

// ── Profile from public.users table ──────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

// ── Context value shape ───────────────────────────────────────
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  supabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if Supabase is actually configured (not placeholder, not empty)
  // Uses the same logic as the client module so there's a single source of truth

  // Fetch user profile from public.users
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[Auth] Profile fetch error:', error.message);
        return null;
      }
      return data as UserProfile;
    } catch {
      return null;
    }
  }, []);

  // Initialise session from storage on mount
  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const p = await fetchProfile(s.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabaseConfigured, fetchProfile]);

  // ── Auth actions ─────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) setAuthError(error.message);
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const clearError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      loading,
      authError,
      supabaseConfigured,
      signIn,
      signUp,
      signOut,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
