/**
 * hooks/useAuth.ts — Exposes auth state and bound action functions.
 * Uses User from @/contracts/types (the public users profile row),
 * not the raw Supabase auth user object.
 */

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { User } from '@/contracts/types';
import { supabase } from '@/lib/supabase';
import {
  signInWithGoogle as authSignInWithGoogle,
  sendOTP as authSendOTP,
  verifyOTP as authVerifyOTP,
  signOut as authSignOut,
  createOrUpdateUserProfile,
  getCurrentUser,
} from '@/lib/auth';

export interface AuthState {
  /** Profile row from the public users table, or null when signed out / pre-onboarding. */
  user: User | null;
  /** Supabase session (access/refresh tokens), or null when signed out. */
  session: Session | null;
  /** True while the initial session and profile are being fetched from storage. */
  isLoading: boolean;
  /** Derived convenience — true when a valid session exists. */
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  sendOTP: (phone: string) => Promise<void>;
  verifyOTP: (phone: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (params: { display_name: string; avatar_url?: string }) => Promise<void>;
}

/**
 * Returns live auth state and bound action functions.
 *
 * @example
 * const { user, isLoading, isAuthenticated, signOut } = useAuth();
 * if (isLoading) return <Spinner />;
 * if (!isAuthenticated) return <Redirect href="/login" />;
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate from persisted session on mount, then fetch profile row.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const profile = await getCurrentUser();
        setUser(profile);
      }
      setIsLoading(false);
    });

    // Keep session and profile in sync with all auth events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          const profile = await getCurrentUser();
          setUser(profile);
        } else {
          setUser(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    await authSignInWithGoogle();
    // Session update handled by onAuthStateChange.
  };

  const sendOTP = async (phone: string): Promise<void> => {
    await authSendOTP(phone);
  };

  const verifyOTP = async (phone: string, token: string): Promise<void> => {
    await authVerifyOTP(phone, token);
    // Session update handled by onAuthStateChange.
  };

  const signOut = async (): Promise<void> => {
    await authSignOut();
  };

  const updateProfile = async (params: {
    display_name: string;
    avatar_url?: string;
  }): Promise<void> => {
    const updated = await createOrUpdateUserProfile(params);
    setUser(updated);
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated: session !== null,
    signInWithGoogle,
    sendOTP,
    verifyOTP,
    signOut,
    updateProfile,
  };
}
