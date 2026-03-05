/**
 * lib/auth.ts — Auth helper functions wrapping Supabase auth.
 * All functions throw on error so callers can use try/catch.
 * Sessions are managed by the Supabase client and propagated via useAuth.
 */

import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import type { User } from '@/contracts/types';
import { supabase } from '@/lib/supabase';

// Required for expo-auth-session to complete the OAuth callback on mobile.
WebBrowser.maybeCompleteAuthSession();

/**
 * Initiate Google OAuth sign-in via an in-app browser.
 * Completes the PKCE code exchange and returns the resulting Supabase session.
 */
export async function signInWithGoogle(): Promise<Session> {
  const redirectUrl = makeRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned from Supabase');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled or failed');
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(result.url);

  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('No session returned after code exchange');

  return sessionData.session;
}

/**
 * Initiate phone OTP sign-in. Supabase sends a one-time code via SMS.
 * Phone must be in E.164 format (e.g. "+14155552671").
 */
export async function sendOTP(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/**
 * Verify the OTP code received via SMS to complete phone sign-in.
 * Returns the resulting Supabase session on success.
 */
export async function verifyOTP(phone: string, token: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  if (!data.session) throw new Error('No session returned after OTP verification');
  return data.session;
}

/**
 * Sign out the current user and clear the local session.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Retrieve the current active Supabase session, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Upsert the authenticated user's profile row in the public `users` table.
 * Call after sign-in to complete onboarding (VCH-8).
 */
export async function createOrUpdateUserProfile(params: {
  display_name: string;
  avatar_url?: string;
}): Promise<User> {
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authUser) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone ?? null,
      display_name: params.display_name,
      avatar_url: params.avatar_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

/**
 * Fetch the current user's profile row from the public `users` table.
 * Returns null if no profile row exists yet (pre-onboarding state).
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('id', authUser.id)
    .single();

  // PGRST116 = no rows returned — valid pre-onboarding state
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data as User;
}
