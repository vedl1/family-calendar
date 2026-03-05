/**
 * lib/auth.ts — Pure auth helper functions wrapping Supabase auth.
 * All functions return the raw Supabase AuthError on failure so callers
 * can decide how to surface errors in the UI.
 */

import { supabase } from '@/lib/supabase';

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Register a new user with email and password.
 * The returned user may need to verify their email before signing in,
 * depending on the Supabase project settings.
 */
export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

/**
 * Initiate phone OTP sign-in. Supabase sends a one-time code via SMS.
 * Phone must be in E.164 format (e.g. "+14155552671").
 */
export async function signInWithPhone(phone: string) {
  return supabase.auth.signInWithOtp({ phone });
}

/**
 * Verify the OTP code received via SMS to complete phone sign-in.
 * Phone must be the same E.164 value passed to signInWithPhone.
 */
export async function verifyPhoneOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' });
}

/**
 * Sign out the current user and clear the local session.
 */
export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Retrieve the current active session, or null if not authenticated.
 */
export async function getSession() {
  return supabase.auth.getSession();
}
