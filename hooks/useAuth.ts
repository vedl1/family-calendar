/**
 * hooks/useAuth.ts — React hook that exposes the current auth state.
 * Subscribes to Supabase auth state changes so components re-render
 * automatically on sign-in, sign-out, and token refresh.
 */

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface AuthState {
  /** The authenticated Supabase user, or null when signed out. */
  user: User | null;
  /** The current Supabase session (contains access/refresh tokens), or null. */
  session: Session | null;
  /** True while the initial session is being fetched from storage. */
  loading: boolean;
}

/**
 * Returns the current auth state and stays in sync with Supabase auth events.
 *
 * @example
 * const { user, loading } = useAuth();
 * if (loading) return <Spinner />;
 * if (!user) return <Redirect href="/login" />;
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate from persisted session on mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Keep state in sync with auth events (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
